#!/usr/bin/env node
// scripts/sync_all_data.js
// -----------------------------------------------------------------------------
// Nguồn dữ liệu DUY NHẤT cho pipeline cập nhật tự động (thay cho file
// "sync_all_data.js" bị thiếu mà workflow cũ gọi tới nhưng không tồn tại).
//
// Luồng:
//   Google Sheet  --(Apps Script /exec)-->  JSON
//        -> public/data/info_data.json   (chỉ ghi khi dữ liệu THỰC SỰ đổi)
//        -> content/Rooms/<room>.md      (regenerate cho các phòng có trong sheet)
//
// Yêu cầu: biến môi trường APPS_SCRIPT_URL trỏ tới Web App URL đã Deploy của Code.gs.
// Chạy trong CI (Node 20 có sẵn global fetch). Thoát mã != 0 nếu fetch thất bại
// để GitHub Actions báo đỏ thay vì "xanh giả".
// -----------------------------------------------------------------------------
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INFO_PATH = path.join(ROOT, 'public', 'data', 'info_data.json');
const DRIVE_PATH = path.join(ROOT, 'public', 'data', 'drive_data.json');
const ROOMS_DIR = path.join(ROOT, 'content', 'Rooms');

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || '';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function log(...args) { console.log('[sync]', ...args); }
function fail(msg) { console.error('[sync] ❌', msg); process.exit(1); }

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
  'Chưa cập nhật': 'unknown'
};

function roomIdFrom(roomNumber) {
  return String(roomNumber).replace(/\s+/g, '-').toUpperCase();
}

function floorFrom(roomId) {
  const m = roomId.match(/(?:AD-|B\d-)?(\d)\d{2}/) || roomId.match(/^(\d)\./);
  return m ? parseInt(m[1], 10) : 1;
}

// Canonical hoá mảng phòng để so sánh "có đổi hay không" mà KHÔNG bị nhiễu bởi
// last_updated (nếu so cả last_updated thì lần fetch nào cũng khác -> deploy vô ích).
function canonical(rooms) {
  const cleaned = rooms
    .map(r => ({
      sheet_source: r.sheet_source ?? '',
      room_number: r.room_number ?? '',
      heading_1: r.heading_1 ?? '',
      heading_2: r.heading_2 ?? '',
      department: r.department ?? '',
      fm_room_function: r.fm_room_function ?? '',
      fm_room_type: r.fm_room_type ?? '',
      area: r.area ?? '',
      unbounded_height: r.unbounded_height ?? '',
      capacity: r.capacity ?? '',
      status: r.status ?? '',
      occupant_display: r.occupant_display ?? ''
    }))
    .sort((a, b) => a.room_number.localeCompare(b.room_number));
  return JSON.stringify(cleaned);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Fetch dữ liệu từ Apps Script
// ─────────────────────────────────────────────────────────────────────────────
async function fetchRooms() {
  if (!APPS_SCRIPT_URL) {
    fail('Thiếu biến môi trường APPS_SCRIPT_URL (Web App URL của Code.gs). ' +
         'Đặt trong repo: Settings → Secrets and variables → Actions → Variables.');
  }
  log('Đang gọi Apps Script…');
  let res;
  try {
    res = await fetch(APPS_SCRIPT_URL, { redirect: 'follow' });
  } catch (e) {
    fail(`Không gọi được Apps Script: ${e.message}`);
  }
  if (!res.ok) fail(`Apps Script trả HTTP ${res.status} ${res.statusText}`);

  let payload;
  try { payload = await res.json(); }
  catch (e) { fail(`Phản hồi không phải JSON hợp lệ: ${e.message}`); }

  if (payload.status && payload.status !== 'success') {
    fail(`Apps Script báo lỗi: ${payload.message || 'unknown'}`);
  }
  const rooms = Array.isArray(payload) ? payload : (payload.data || []);
  if (!Array.isArray(rooms) || rooms.length === 0) {
    fail('Apps Script trả về 0 phòng — dừng để tránh ghi đè dữ liệu rỗng.');
  }
  log(`Nhận ${rooms.length} phòng.`);
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

    const floor = floorFrom(roomId);
    const status = STATUS_MAP[room.status] || 'unknown';
    counts[status]++;

    const imageUrl = driveImageUrl(driveData[roomId]);
    if (imageUrl) images++;

    const name = yamlSafe(
      (room.heading_1 || 'Unknown') + (room.heading_2 ? ' - ' + room.heading_2 : '')
    );

    const md = `---
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
  log('Regenerate content/Rooms:', counts, `| ${images} phòng có ảnh Drive`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Main
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const rooms = await fetchRooms();
  const driveData = readJsonSafe(DRIVE_PATH, {});

  // So sánh với dữ liệu hiện có: chỉ ghi khi nội dung thật sự đổi
  const existing = readJsonSafe(INFO_PATH, null);
  const existingRooms = existing && Array.isArray(existing.data) ? existing.data : [];
  if (existing && canonical(existingRooms) === canonical(rooms)) {
    log('✅ Dữ liệu không đổi — bỏ qua ghi file (sẽ không deploy).');
    process.exit(0);
  }

  const payload = {
    status: 'success',
    total_rooms: rooms.length,
    last_updated: new Date().toISOString(),
    data: rooms
  };
  fs.mkdirSync(path.dirname(INFO_PATH), { recursive: true });
  fs.writeFileSync(INFO_PATH, JSON.stringify(payload, null, 2));
  log('Đã ghi', path.relative(ROOT, INFO_PATH));

  regenerateRooms(rooms, driveData);
  log('✅ Hoàn tất — có thay đổi, workflow sẽ commit & deploy.');
})();
