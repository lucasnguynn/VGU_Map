#!/usr/bin/env node
const https = require('https');
const fs = require('fs');
const path = require('path');

// Validate required environment variables at build/start time
function validateEnv() {
  const requiredVars = ['MAP_API_URL', 'INFO_API_URL', 'DRIVE_API_URL'];
  const missing = requiredVars.filter(varName => !process.env[varName]);
  if (missing.length > 0) {
    console.error('❌ Fatal: Missing required environment variables:', missing.join(', '));
    console.error('Please set these as GitHub Secrets or environment variables.');
    process.exit(1);
  }
}

validateEnv();

const API_ENDPOINTS = {
  MAP: process.env.MAP_API_URL,
  INFO: process.env.INFO_API_URL,
  DRIVE: process.env.DRIVE_API_URL
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
  // Validate new backend structure: { status: "success", data: [...] } or { status: "error", message: "..." }
  if (payload && payload.status === 'error') {
    throw new Error(`${name}: ${payload.message || 'Backend returned error status'}`);
  }
  if (payload && payload.status !== 'success') {
    throw new Error(`${name}: unexpected status "${payload.status}"`);
  }
  const arr = Array.isArray(payload) ? payload : payload && payload.data;
  if (!Array.isArray(arr) || !arr.length) throw new Error(`${name}: empty dataset`);
  return arr;
}

function normalizeInfo(payload) {
  const rows = extractArray(payload, 'INFO');
  const data = rows.map((room) => {
    // Backend is single source of truth - occupants_list is already an array
    // Just ensure it exists and add occupants_flat for convenience
    const list = Array.isArray(room.occupants_list) ? room.occupants_list : [];
    return {
      ...room,
      occupants_flat: list.join(', ')
    };
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
  const mapPayload = await fetchJson(`${API_ENDPOINTS.MAP}?nocache=true&v=${Date.now()}`);
  // MAP API returns raw array or object without status field - use relaxed validation
  const mapData = Array.isArray(mapPayload) ? mapPayload : (mapPayload && typeof mapPayload === 'object' ? mapPayload : null);
  if (!mapData || (Array.isArray(mapData) && !mapData.length)) throw new Error('MAP: empty dataset');
  writeJsonAtomic(OUTPUT.MAP, mapData);

  const infoPayload = await fetchJson(`${API_ENDPOINTS.INFO}?nocache=true&v=${Date.now()}`);
  writeJsonAtomic(OUTPUT.INFO, normalizeInfo(infoPayload));

  const drivePayload = await fetchJson(`${API_ENDPOINTS.DRIVE}?nocache=true&v=${Date.now()}`);
  if (!drivePayload || typeof drivePayload !== 'object') throw new Error('DRIVE: invalid payload');
  writeJsonAtomic(OUTPUT.DRIVE, drivePayload);
  console.log('✅ Sync completed');
}

run().catch((e) => { console.error('❌ Sync failed:', e.message); process.exit(1); });
