#!/usr/bin/env node
const https = require('https');
const fs = require('fs');
const path = require('path');

const API_ENDPOINTS = {
  MAP: 'https://script.google.com/macros/s/AKfycbxFmunolmZ5LSC6exu6OnGE0dZi9VYrf6gWBqMJQOrFUe8MdRQAiz0XT825JwkGd-O0/exec',
  INFO: 'https://script.google.com/macros/s/AKfycbz3qWkjrU3ue194Y0KLJVMGWu0_z30TbryExqw2k9Buyt4NIVqKxzsqgQQUQMdZkUdA/exec',
  DRIVE: 'https://script.google.com/macros/s/AKfycbw4PtDoCILXSiIn1AAYzJhUhSvmJ6ufKD-5R-QKZGzbBy-yQTfC_bPTKJEErwt1d_iS/exec'
};

const OUTPUT = { MAP: 'map_data.json', INFO: 'info_data.json', DRIVE: 'drive_data.json' };

function fetchJson(url, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { Accept: 'application/json', 'User-Agent': 'VGUMap-Sync/2.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) return resolve(fetchJson(res.headers.location, timeoutMs));
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      let raw = '';
      res.on('data', (d) => raw += d);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error(`Invalid JSON from ${url}: ${e.message}`)); } });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`Timeout ${timeoutMs}ms for ${url}`)));
    req.on('error', reject);
  });
}

function extractArray(payload, name) {
  const arr = Array.isArray(payload) ? payload : payload && payload.data;
  if (!Array.isArray(arr) || !arr.length) throw new Error(`${name}: empty dataset`);
  return arr;
}

function normalizeInfo(payload) {
  const rows = extractArray(payload, 'INFO');
  const data = rows.map((room) => {
    const flat = { ...room };
    const list = Array.isArray(room.occupants_list)
      ? room.occupants_list.map((x) => String(x || '').trim()).filter(Boolean)
      : String(room.occupants_list || '').split(',').map((x) => x.trim()).filter(Boolean);
    flat.occupants_list = list;
    flat.occupants_flat = list.join(', ');
    if (flat.occupants_flat) flat.occupant_display = flat.occupants_flat;
    return flat;
  });
  return { status: 'success', total_rooms: data.length, last_updated: new Date().toISOString(), data };
}

function writeJsonAtomic(filename, data) {
  const finalPath = path.join(__dirname, filename);
  const tempPath = `${finalPath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
  fs.renameSync(tempPath, finalPath);
  console.log(`💾 ${filename} updated`);
}

async function run() {
  console.log(`🕐 Sync started ${new Date().toISOString()}`);
  const mapPayload = await fetchJson(`${API_ENDPOINTS.MAP}?v=${Date.now()}`);
  extractArray(mapPayload, 'MAP');
  writeJsonAtomic(OUTPUT.MAP, mapPayload);

  const infoPayload = await fetchJson(`${API_ENDPOINTS.INFO}?v=${Date.now()}`);
  writeJsonAtomic(OUTPUT.INFO, normalizeInfo(infoPayload));

  const drivePayload = await fetchJson(`${API_ENDPOINTS.DRIVE}?v=${Date.now()}`);
  if (!drivePayload || typeof drivePayload !== 'object') throw new Error('DRIVE: invalid payload');
  writeJsonAtomic(OUTPUT.DRIVE, drivePayload);
  console.log('✅ Sync completed');
}

run().catch((e) => { console.error('❌ Sync failed:', e.message); process.exit(1); });
