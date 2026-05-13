#!/usr/bin/env node

/**
 * VGUMap Unified Data Sync Script
 *
 * Fetches MAP, INFO, and DRIVE payloads sequentially and writes:
 * - map_data.json
 * - info_data.json (with flattened occupants)
 * - drive_data.json
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
  process.exitCode = 1;
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  process.exit(1);
});

const API_ENDPOINTS = {
  MAP: 'https://script.google.com/macros/s/AKfycbxFmunolmZ5LSC6exu6OnGE0dZi9VYrf6gWBqMJQOrFUe8MdRQAiz0XT825JwkGd-O0/exec',
  INFO: 'https://script.google.com/macros/s/AKfycbzhMONbzVtaRnlIe3hiumaNXBPbQN6qybuANtguLcWMO1ZM0Nmu0NtWZ2yfGsJWORM5dA/exec',
  DRIVE: 'https://script.google.com/macros/s/AKfycbw4PtDoCILXSiIn1AAYzJhUhSvmJ6ufKD-5R-QKZGzbBy-yQTfC_bPTKJEErwt1d_iS/exec'
};

const OUTPUT_FILES = {
  MAP: path.join(__dirname, 'map_data.json'),
  INFO: path.join(__dirname, 'info_data.json'),
  DRIVE: path.join(__dirname, 'drive_data.json')
};

const REQUEST_OPTIONS = {
  headers: {
    'User-Agent': 'VGUMap-UnifiedSyncBot/1.0',
    Accept: 'application/json'
  },
  timeout: 30000
};

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const request = https.get(url, REQUEST_OPTIONS, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const location = res.headers.location;
        if (!location) return reject(new Error('Redirect without location header'));
        return resolve(fetchJson(location));
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }

      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          console.log(`✅ Fetched ${url} in ${Date.now() - startedAt}ms (${raw.length} bytes)`);
          resolve(parsed);
        } catch (err) {
          reject(new Error(`JSON parse failed for ${url}: ${err.message}`));
        }
      });
    });

    request.on('timeout', () => request.destroy(new Error('Request timed out after 30s')));
    request.on('error', reject);
  });
}

function writeJson(file, payload) {
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`💾 Wrote ${path.basename(file)}`);
}

function assertNonEmptyArrayResponse(payload, sourceName) {
  const data = Array.isArray(payload) ? payload : payload && payload.data;
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`${sourceName}: expected non-empty array payload/data`);
  }
  return data;
}

function normalizeInfoPayload(payload) {
  const rows = assertNonEmptyArrayResponse(payload, 'INFO');
  const transformed = rows.map((room) => {
    const flat = { ...room };
    if (Array.isArray(room.occupants_list)) {
      const cleaned = room.occupants_list
        .map((x) => String(x || '').trim())
        .filter(Boolean);
      flat.occupants_list = cleaned;
      flat.occupants_flat = cleaned.join(', ');
      if (cleaned.length > 0) flat.occupant_display = flat.occupants_flat;
    } else if (typeof room.occupants_list === 'string') {
      flat.occupants_flat = room.occupants_list;
      if (room.occupants_list.trim()) flat.occupant_display = room.occupants_list.trim();
    } else {
      flat.occupants_list = [];
      flat.occupants_flat = '';
    }
    return flat;
  });

  return {
    status: 'success',
    total_rooms: transformed.length,
    last_updated: new Date().toISOString(),
    data: transformed
  };
}

async function main() {
  console.log(`🕐 Unified sync started at ${new Date().toISOString()}`);

  const mapPayload = await fetchJson(`${API_ENDPOINTS.MAP}?t=${Date.now()}`);
  assertNonEmptyArrayResponse(mapPayload, 'MAP');
  writeJson(OUTPUT_FILES.MAP, mapPayload);

  const infoPayload = await fetchJson(`${API_ENDPOINTS.INFO}?t=${Date.now()}`);
  const normalizedInfo = normalizeInfoPayload(infoPayload);
  writeJson(OUTPUT_FILES.INFO, normalizedInfo);

  const drivePayload = await fetchJson(`${API_ENDPOINTS.DRIVE}?t=${Date.now()}`);
  if (!drivePayload || typeof drivePayload !== 'object') {
    throw new Error('DRIVE: expected JSON object');
  }
  writeJson(OUTPUT_FILES.DRIVE, drivePayload);

  console.log('🏁 Unified sync completed successfully');
}

main().catch((err) => {
  console.error('❌ Unified sync failed:', err.message);
  process.exit(1);
});
