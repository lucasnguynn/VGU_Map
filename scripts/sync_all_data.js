#!/usr/bin/env node
// scripts/sync_all_data.js
// -----------------------------------------------------------------------------
// Nguồn dữ liệu DUY NHẤT cho pipeline cập nhật tự động.
//
// Luồng:
//   Google Sheet  --(Apps Script /exec)-->  JSON
//        -> public/data/info_data.json   (chỉ ghi khi dữ liệu THỰC SỰ đổi)
//        -> content/Rooms/<room>.md      (regenerate cho các phòng có trong sheet)
//
// Yêu cầu: biến môi trường APPS_SCRIPT_URL trỏ tới Web App URL (/exec) của Code.gs.
// Chạy trong CI (Node 20 có sẵn global fetch). Thoát mã != 0 nếu fetch thất bại
// để GitHub Actions báo đỏ thay vì "xanh giả".
// -----------------------------------------------------------------------------
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT       = path.resolve(__dirname, '..');
const INFO_PATH  = path.join(ROOT, 'public', 'data', 'info_data.json');
const DRIVE_PATH = path.join(ROOT, 'public', 'data', 'drive_data.json');
const ROOMS_DIR  = path.join(ROOT, 'content', 'Rooms');

// ─── Tunables ────────────────────────────────────────────────────────────────
const FETCH_TIMEOUT_MS = 25_000;   // 25 s — Apps Script cold-starts can be slow
const MAX_RETRIES      = 3;        // Retry on transient 5xx / network errors
const RETRY_BASE_MS    = 3_000;    // 3 s → 6 s → 12 s (exponential backoff)

// ─── Env ─────────────────────────────────────────────────────────────────────
const APPS_SCRIPT_URL = (process.env.APPS_SCRIPT_URL || '').trim();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function log(...args)  { console.log('[sync]', ...args); }
function warn(...args) { console.warn('[sync] ⚠', ...args); }

/**
 * Print a clear, actionable error and exit 1.
 * Never leaks the full secret URL — shows only the safe prefix.
 */
function fail(msg, hint = '') {
  console.error('\n[sync] ✖ ' + msg);
  if (hint) console.error('[sync]   →', hint);
  console.error('');
  process.exit(1);
}

function readJsonSafe(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function yamlSafe(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function driveImageUrl(fileId) {
  return fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000` : '';
}

const STATUS_MAP = {
  'Đang sử dụng': 'operational',
  'Chưa sử dụng': 'vacant',
  'Chưa cập nhật': 'unknown',
};

function roomIdFrom(roomNumber) {
  return String(roomNumber).replace(/\s+/g, '-').toUpperCase();
}

function floorFrom(roomId) {
  const m = roomId.match(/(?:AD-|B\d-)?\d{0,2}(\d)\d{2}/)
         || roomId.match(/^(\d)\./);
  return m ? parseInt(m[1], 10) : 1;
}

// Canonical form for change-detection: strips last_updated so a re-fetch of
// identical data never triggers an unnecessary commit + deploy.
function canonical(rooms) {
  const cleaned = rooms
    .map(r => ({
      sheet_source:      r.sheet_source      ?? '',
      room_number:       r.room_number       ?? '',
      heading_1:         r.heading_1         ?? '',
      heading_2:         r.heading_2         ?? '',
      department:        r.department        ?? '',
      fm_room_function:  r.fm_room_function  ?? '',
      fm_room_type:      r.fm_room_type      ?? '',
      area:              r.area              ?? '',
      unbounded_height:  r.unbounded_height  ?? '',
      capacity:          r.capacity          ?? '',
      status:            r.status            ?? '',
      occupant_display:  r.occupant_display  ?? '',
    }))
    .sort((a, b) => a.room_number.localeCompare(b.room_number));
  return JSON.stringify(cleaned);
}

// ─────────────────────────────────────────────────────────────────────────────
// URL pre-flight validation
// ─────────────────────────────────────────────────────────────────────────────
function validateUrl(url) {
  if (!url) {
    fail(
      'Thiếu biến môi trường APPS_SCRIPT_URL.',
      'GitHub repo → Settings → Secrets and variables → Actions → Variables tab\n' +
      '  → New repository variable → Name: APPS_SCRIPT_URL\n' +
      '  → Value: https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec'
    );
  }

  let parsed;
  try { parsed = new URL(url); }
  catch {
    fail(
      `APPS_SCRIPT_URL không phải URL hợp lệ: "${url}"`,
      'Giá trị phải bắt đầu bằng https://script.google.com/macros/s/…/exec'
    );
  }

  if (!parsed.hostname.endsWith('script.google.com')) {
    warn(`URL không phải script.google.com — hostname: ${parsed.hostname}`);
  }

  if (url.includes('/macros/s/') && url.endsWith('/dev')) {
    fail(
      'URL kết thúc bằng /dev thay vì /exec.',
      'URL /dev yêu cầu phiên đăng nhập Google — không hoạt động trong CI.\n' +
      '  Thay /dev bằng /exec và cập nhật biến APPS_SCRIPT_URL.'
    );
  }

  if (url.includes('/d/') && url.includes('/edit')) {
    fail(
      'Đây là URL script editor, không phải Web App URL.',
      'Trong Apps Script: Deploy → Manage deployments → copy URL kết thúc bằng /exec'
    );
  }

  if (!url.endsWith('/exec') && !url.includes('/exec?')) {
    warn(
      'APPS_SCRIPT_URL không kết thúc bằng /exec — có thể gây lỗi 404.\n' +
      '  URL đúng: https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec'
    );
  }

  // Log safe prefix only — never log the full URL (it contains the deployment ID)
  const safePart = url.replace(/(\/macros\/s\/)([^/]+)(\/.*)/, '$1***$3');
  log(`URL: ${safePart}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Robust fetch: timeout + retry + content-type guard
// ─────────────────────────────────────────────────────────────────────────────

/** Single fetch attempt with AbortController timeout. */
async function fetchOnce(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal:   controller.signal,
      headers:  { Accept: 'application/json, text/plain, */*' },
    });
    return res;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${FETCH_TIMEOUT_MS / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch with exponential-backoff retry.
 * Retries only on network errors and 5xx — 4xx are bugs, not transients.
 */
async function fetchWithRetry(url) {
  let lastErr;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    log(`Lần thử ${attempt}/${MAX_RETRIES}…`);
    try {
      const res = await fetchOnce(url);

      // ── 4xx: configuration error — no point retrying ──────────────────────
      if (res.status === 404) {
        fail(
          `Apps Script trả HTTP 404 Not Found.`,
          'Nguyên nhân thường gặp và cách sửa:\n\n' +
          '  1. URL sai hoặc deployment đã bị xoá.\n' +
          '     → Apps Script → Deploy → Manage deployments\n' +
          '       → Chọn deployment đang active → Copy Web App URL → Cập nhật APPS_SCRIPT_URL\n\n' +
          '  2. Web App được Deploy với "Who has access: Only myself".\n' +
          '     → GitHub Actions không có phiên Google → Google trả 404/redirect.\n' +
          '     FIX: Apps Script → Deploy → Manage deployments → Edit (bút chì)\n' +
          '       → Who has access → chọn "Anyone" → Deploy → copy URL mới.\n\n' +
          '  3. URL kết thúc bằng /dev thay vì /exec.\n' +
          '     → Đổi /dev → /exec trong biến APPS_SCRIPT_URL.\n\n' +
          '  4. Script bị giới hạn bởi Google Workspace domain policy.\n' +
          '     → Liên hệ Google Workspace Admin để mở "Run as anyone".'
        );
      }

      if (res.status === 401 || res.status === 403) {
        fail(
          `Apps Script trả HTTP ${res.status} — lỗi xác thực/phân quyền.`,
          '→ Kiểm tra "Who has access" trong Manage deployments — phải là "Anyone".'
        );
      }

      // ── 5xx: transient server error — retry ───────────────────────────────
      if (res.status >= 500) {
        warn(`HTTP ${res.status} ${res.statusText} — có thể thử lại.`);
        lastErr = new Error(`HTTP ${res.status}`);
        // fall through to retry logic below
      } else if (!res.ok) {
        fail(`Apps Script trả HTTP ${res.status} ${res.statusText}.`);
      } else {
        // ── 2xx: check we actually got JSON, not an HTML login redirect ───────
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json') && !contentType.includes('text/plain')) {
          // Read the body to detect an HTML login page
          const body = await res.text();
          const isHtml = body.trimStart().startsWith('<!') || body.trimStart().startsWith('<html');
          if (isHtml) {
            fail(
              `Apps Script trả về trang HTML (${res.status}) thay vì JSON.`,
              'Đây là trang đăng nhập Google — Web App chưa được mở public.\n' +
              '  FIX: Apps Script → Deploy → Manage deployments → Edit\n' +
              '    → Who has access → "Anyone" → Re-deploy\n' +
              '    → Copy URL mới và cập nhật APPS_SCRIPT_URL.\n' +
              '  Content-Type nhận được: ' + contentType
            );
          }
          warn(`Content-Type không phải JSON: ${contentType} — vẫn thử parse.`);
          // Return a synthetic Response wrapping the already-read text
          return { ok: true, _text: body };
        }
        return res;
      }
    } catch (err) {
      warn(`Lần thử ${attempt} thất bại: ${err.message}`);
      lastErr = err;
    }

    if (attempt < MAX_RETRIES) {
      const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
      log(`Chờ ${delay / 1000}s trước khi thử lại…`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  fail(
    `Tất cả ${MAX_RETRIES} lần thử đều thất bại: ${lastErr?.message || 'unknown error'}`,
    'Kiểm tra kết nối mạng của runner hoặc trạng thái Apps Script.'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Fetch dữ liệu từ Apps Script
// ─────────────────────────────────────────────────────────────────────────────
async function fetchRooms() {
  validateUrl(APPS_SCRIPT_URL);
  log('Đang gọi Apps Script…');

  const res = await fetchWithRetry(APPS_SCRIPT_URL);

  let payload;
  try {
    // Handle the synthetic response from the HTML-detection path
    const raw = res._text !== undefined ? res._text : await res.text();
    payload = JSON.parse(raw);
  } catch (e) {
    fail(
      `Phản hồi không phải JSON hợp lệ: ${e.message}`,
      'Kiểm tra Code.gs: hàm doGet() phải return ContentService\n' +
      '  .createTextOutput(JSON.stringify(data))\n' +
      '  .setMimeType(ContentService.MimeType.JSON)'
    );
  }

  if (payload.status && payload.status !== 'success') {
    fail(`Apps Script báo lỗi: ${payload.message || 'unknown'}`);
  }

  const rooms = Array.isArray(payload) ? payload : (payload.data || []);
  if (!Array.isArray(rooms) || rooms.length === 0) {
    fail('Apps Script trả về 0 phòng — dừng để tránh ghi đè dữ liệu rỗng.');
  }

  log(`✔ Nhận ${rooms.length} phòng từ Apps Script.`);
  return rooms;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Regenerate content/Rooms/*.md (upsert, KHÔNG xoá file cũ ngoài sheet)
// ─────────────────────────────────────────────────────────────────────────────
function regenerateRooms(rooms, driveData) {
  fs.mkdirSync(ROOMS_DIR, { recursive: true });
  let images = 0;
  const counts = { operational: 0, vacant: 0, unknown: 0 };

  for (const room of rooms) {
    const roomId = roomIdFrom(room.room_number);
    if (!roomId) continue;

    const floor  = floorFrom(roomId);
    const status = STATUS_MAP[room.status] || 'unknown';
    counts[status] = (counts[status] || 0) + 1;

    const imageUrl = driveImageUrl(driveData[roomId]);
    if (imageUrl) images++;

    const name = yamlSafe(
      (room.heading_1 || 'Unknown') + (room.heading_2 ? ' - ' + room.heading_2 : '')
    );

    const md =
`---
room_id: "${roomId}"
name: "${name}"
building_id: "${yamlSafe(room.sheet_source || 'UNKNOWN')}"
floor: ${floor}
departments:
  - "${yamlSafe(room.department || 'General')}"
room_type: "${yamlSafe(room.fm_room_function || '___')}"
area_m2: "${yamlSafe(room.area || '--')}"
capacity: "${yamlSafe(room.capacity || '--')}"
head_of_lab:
  name: "${yamlSafe(room.occupant_display || 'Chưa cập nhật')}"
  email: "contact@vgu.edu.vn"
  office: "${roomId}"
status: "${status}"
highlighted_equipment: []
image: "${imageUrl}"
vr_panorama: ""
---

Trang thông tin không gian kiến trúc cho khu vực **${yamlSafe(room.heading_1)}**.
Hệ thống cảm biến và dữ liệu telemetry đang được đồng bộ.
`;
    fs.writeFileSync(path.join(ROOMS_DIR, `${roomId}.md`), md);
  }

  log(`Đã regenerate ${rooms.length} file Rooms/. Trạng thái:`, counts,
      `| ${images} phòng có ảnh Drive.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Main
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  log('─── Bắt đầu đồng bộ dữ liệu ───────────────────────────────────────────');
  log(`Node ${process.version} | ${new Date().toISOString()}`);

  const rooms     = await fetchRooms();
  const driveData = readJsonSafe(DRIVE_PATH, {});

  // So sánh với dữ liệu hiện có: chỉ ghi khi nội dung thật sự đổi
  const existing      = readJsonSafe(INFO_PATH, null);
  const existingRooms = existing && Array.isArray(existing.data) ? existing.data : [];

  if (existing && canonical(existingRooms) === canonical(rooms)) {
    log('✅ Dữ liệu không đổi — bỏ qua ghi file (workflow sẽ không commit/deploy).');
    log('─── Hoàn tất (no-op) ───────────────────────────────────────────────────');
    process.exit(0);
  }

  const payload = {
    status:       'success',
    total_rooms:  rooms.length,
    last_updated: new Date().toISOString(),
    data:         rooms,
  };
  fs.mkdirSync(path.dirname(INFO_PATH), { recursive: true });
  fs.writeFileSync(INFO_PATH, JSON.stringify(payload, null, 2));
  log('Đã ghi', path.relative(ROOT, INFO_PATH));

  regenerateRooms(rooms, driveData);

  log('✅ Có thay đổi — workflow sẽ commit & kích hoạt deploy.');
  log('─── Hoàn tất ───────────────────────────────────────────────────────────');
})();
