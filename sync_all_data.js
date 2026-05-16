#!/usr/bin/env node
/**
 * VGUMap Data Sync Script
 * 
 * Fetches data from Google Apps Script endpoints and saves to local JSON files.
 * Uses Node 18+ native fetch API with robust error handling.
 */

import { readFileSync, writeFileSync, renameSync } from 'fs';
import { join } from 'path';

const API_ENDPOINTS = {
  MAP: 'https://script.google.com/macros/s/AKfycbxFmunolmZ5LSC6exu6OnGE0dZi9VYrf6gWBqMJQOrFUe8MdRQAiz0XT825JwkGd-O0/exec',
  INFO: 'https://script.google.com/macros/s/AKfycbyuDcu459ywB1sTX0qjGQ1KwLFInWv_D9FUca06gu203SFtRgAaK3hTOvY8cN7nwwiYeg/exec',
  DRIVE: 'https://script.google.com/macros/s/AKfycbw4PtDoCILXSiIn1AAYzJhUhSvmJ6ufKD-5R-QKZGzbBy-yQTfC_bPTKJEErwt1d_iS/exec'
};

const OUTPUT = { MAP: 'map_data.json', INFO: 'info_data.json', DRIVE: 'drive_data.json' };

/**
 * Fetch JSON from URL with retry logic and timeout.
 * @param {string} url - The URL to fetch.
 * @param {number} timeoutMs - Timeout in milliseconds.
 * @param {number} retries - Number of retry attempts.
 * @returns {Promise<object>} Parsed JSON response.
 */
async function fetchJson(url, timeoutMs = 30000, retries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const response = await fetch(url, {
        headers: { 
          'Accept': 'application/json', 
          'User-Agent': 'VGUMap-Sync/3.0 (Node.js)' 
        },
        signal: controller.signal,
        redirect: 'follow'
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;
      
      if (attempt < retries) {
        console.warn(`⚠️ Attempt ${attempt}/${retries} failed for ${url}: ${error.message}. Retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  
  throw lastError;
}

/**
 * Extract array from payload (handles wrapped or direct arrays).
 * @param {object} payload - The response payload.
 * @param {string} name - Name for error messages.
 * @returns {Array} Extracted array.
 */
function extractArray(payload, name) {
  const arr = Array.isArray(payload) ? payload : payload?.data;
  if (!Array.isArray(arr) || !arr.length) {
    throw new Error(`${name}: empty dataset`);
  }
  return arr;
}

/**
 * Normalize info data with proper occupant list handling.
 * @param {object} payload - Raw info payload.
 * @returns {object} Normalized info data structure.
 */
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
  return { 
    status: 'success', 
    total_rooms: data.length, 
    last_updated: new Date().toISOString(), 
    data 
  };
}

/**
 * Write JSON atomically using temp file + rename.
 * @param {string} filename - Target filename.
 * @param {object} data - Data to serialize.
 */
function writeJsonAtomic(filename, data) {
  const finalPath = join(process.cwd(), filename);
  const tempPath = `${finalPath}.tmp`;
  writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
  renameSync(tempPath, finalPath);
  console.log(`💾 ${filename} updated`);
}

/**
 * Update file content using marker-based replacement.
 * Looks for <!-- VERSION_MARKER --> or // VERSION_MARKER patterns.
 * @param {string} filePath - Path to file.
 * @param {string} markerName - Marker identifier.
 * @param {string} newValue - New value to insert.
 * @returns {boolean} True if replacement was made.
 */
function updateWithMarker(filePath, markerName, newValue) {
  const original = readFileSync(filePath, 'utf8');
  
  // Pattern 1: HTML/XML comment markers <!-- MARKER_NAME: value -->
  const htmlPattern = new RegExp(`(<!--\\s*${markerName}:\\s*)[^>]*?(-->)`, 'g');
  if (htmlPattern.test(original)) {
    const updated = original.replace(htmlPattern, `$1${newValue}$2`);
    if (original !== updated) {
      writeFileSync(filePath, updated, 'utf8');
      return true;
    }
  }
  
  // Pattern 2: JS comment markers // MARKER_NAME: value
  const jsPattern = new RegExp(`(//\\s*${markerName}:\\s*).*$`, 'gm');
  if (jsPattern.test(original)) {
    const updated = original.replace(jsPattern, `$1${newValue}`);
    if (original !== updated) {
      writeFileSync(filePath, updated, 'utf8');
      return true;
    }
  }
  
  // Pattern 3: const declaration markers const NAME = 'value';
  const constPattern = new RegExp(`(const\\s+${markerName}\\s*=\\s*['\"])[^'\"]*?(['\"];?)`, 'g');
  if (constPattern.test(original)) {
    const updated = original.replace(constPattern, `$1${newValue}$2`);
    if (original !== updated) {
      writeFileSync(filePath, updated, 'utf8');
      return true;
    }
  }
  
  return false;
}

async function run() {
  console.log(`🕐 Sync started ${new Date().toISOString()}`);
  
  try {
    // Fetch and save MAP data
    const mapPayload = await fetchJson(`${API_ENDPOINTS.MAP}?nocache=${Date.now()}`);
    extractArray(mapPayload, 'MAP');
    writeJsonAtomic(OUTPUT.MAP, mapPayload);

    // Fetch and save INFO data
    const infoPayload = await fetchJson(`${API_ENDPOINTS.INFO}?nocache=${Date.now()}`);
    writeJsonAtomic(OUTPUT.INFO, normalizeInfo(infoPayload));

    // Fetch and save DRIVE data
    const drivePayload = await fetchJson(`${API_ENDPOINTS.DRIVE}?nocache=${Date.now()}`);
    if (!drivePayload || typeof drivePayload !== 'object') {
      throw new Error('DRIVE: invalid payload');
    }
    writeJsonAtomic(OUTPUT.DRIVE, drivePayload);
    
    // ============================================================
    // TASK 3: Generate version token for cache invalidation
    // Uses marker-based replacement instead of fragile regex
    // ============================================================
    const buildVersion = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    
    // Update sw.js with new version using marker
    const swPath = join(process.cwd(), 'sw.js');
    const swUpdated = updateWithMarker(swPath, 'SW_VERSION', buildVersion);
    if (swUpdated) {
      console.log(`✅ sw.js version stamped: ${buildVersion}`);
    } else {
      console.warn('⚠️ Could not find SW_VERSION marker in sw.js');
    }
    
    // Update index.html with new version using data attribute marker
    const htmlPath = join(process.cwd(), 'index.html');
    const htmlOriginal = readFileSync(htmlPath, 'utf8');
    const htmlAttrPattern = /(data-app-version=")[^"]*(")/;
    if (htmlAttrPattern.test(htmlOriginal)) {
      const htmlUpdated = htmlOriginal.replace(htmlAttrPattern, `$1${buildVersion}$2`);
      writeFileSync(htmlPath, htmlUpdated, 'utf8');
      console.log(`✅ index.html version stamped: ${buildVersion}`);
    } else {
      console.warn('⚠️ Could not find data-app-version attribute in index.html');
    }
    
    // DO NOT mutate manifest.json with non-standard version key
    // The version is now tracked via HTML data attribute and SW constant only
    
    console.log('✅ Sync completed');
  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    process.exit(1);
  }
}

run();
