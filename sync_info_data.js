#!/usr/bin/env node

/**
 * VGUMap Info Data Sync Script
 * Fetches room data from Google Apps Script API and updates info_data.json
 * 
 * Features:
 * - Runs every 5 minutes via cron
 * - Validates API response (status === 'success' and data array exists)
 * - Flattens occupants_list array to comma-separated string
 * - Failsafe: Never overwrites file if fetched data is invalid/empty
 * 
 * Usage: node sync_info_data.js
 * 
 * Cron schedule: every 5 minutes
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const API_ENDPOINTS = {
    INFO: 'https://script.google.com/macros/s/AKfycbzhMONbzVtaRnlIe3hiumaNXBPbQN6qybuANtguLcWMO1ZM0Nmu0NtWZ2yfGsJWORM5dA/exec'
};

const OUTPUT_FILE = path.join(__dirname, 'info_data.json');

const REQUEST_OPTIONS = {
    headers: {
        'User-Agent': 'VGUMap-InfoSyncBot/1.0',
        'Accept': 'application/json'
    },
    timeout: 30000 // 30 seconds timeout
};

// Critical keys that must be preserved in each room object
const CRITICAL_KEYS = [
    'room_number',
    'heading_1',
    'heading_2',
    'department',
    'area',
    'unbounded_height',
    'capacity',
    'status',
    'is_active'
];

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Fetch data from URL with redirect handling and timeout
 * @param {string} url - The URL to fetch
 * @returns {Promise<any>} Parsed JSON response
 */
function fetchData(url) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        console.log(`📡 Fetching: ${url}`);

        const request = https.get(url, REQUEST_OPTIONS, (res) => {
            // Handle redirects (Google Apps Script often returns 302)
            if (res.statusCode === 302 || res.statusCode === 301) {
                console.log(`↪️ Redirect to: ${res.headers.location}`);
                fetchData(res.headers.location).then(resolve).catch(reject);
                return;
            }

            if (res.statusCode !== 200) {
                const error = new Error(`HTTP Error: ${res.statusCode}`);
                console.error(`❌ ${error.message}`);
                reject(error);
                return;
            }

            let data = '';
            res.on('data', (chunk) => { data += chunk; });

            res.on('end', () => {
                const duration = Date.now() - startTime;
                try {
                    const jsonData = JSON.parse(data);
                    console.log(`✅ Success (${duration}ms) - ${data.length} bytes`);
                    resolve(jsonData);
                } catch (error) {
                    console.error(`❌ JSON Parse Error: ${error.message}`);
                    console.error(`Raw preview: ${data.substring(0, 200)}...`);
                    reject(new Error(`JSON Parse Failed: ${error.message}`));
                }
            });
        });

        // Handle request timeout
        request.on('error', (error) => {
            console.error(`❌ Request Error: ${error.message}`);
            reject(error);
        });

        request.on('timeout', () => {
            request.destroy();
            reject(new Error('Request timeout after 30 seconds'));
        });
    });
}

/**
 * Validate the API response structure
 * @param {any} data - The fetched data
 * @returns {{valid: boolean, error?: string}} Validation result
 */
function validateResponse(data) {
    // Check if data exists
    if (!data) {
        return { valid: false, error: 'Fetched data is null or undefined' };
    }

    // Check status field
    if (data.status !== 'success') {
        return { valid: false, error: `Invalid status: expected 'success', got '${data.status}'` };
    }

    // Check data array exists
    if (!Array.isArray(data.data)) {
        return { valid: false, error: 'Missing or invalid "data" array in response' };
    }

    // Check data array is not empty
    if (data.data.length === 0) {
        return { valid: false, error: 'Data array is empty - refusing to overwrite with empty data' };
    }

    return { valid: true };
}

/**
 * Flatten room object - convert occupants_list array to comma-separated string
 * @param {Object} room - The room object to transform
 * @returns {Object} Transformed flat room object
 */
function flattenRoomData(room) {
    const flattened = {};

    // Copy all existing properties
    for (const key of Object.keys(room)) {
        flattened[key] = room[key];
    }

    // Flatten occupants_list array to comma-separated string
    if (Array.isArray(room.occupants_list)) {
        flattened.occupants_flat = room.occupants_list.join(', ');
    } else if (typeof room.occupants_list === 'string') {
        flattened.occupants_flat = room.occupants_list;
    } else {
        flattened.occupants_flat = '';
    }

    // Also update occupant_display if it exists and occupants_list has data
    if (Array.isArray(room.occupants_list) && room.occupants_list.length > 0) {
        flattened.occupant_display = flattened.occupants_flat;
    }

    return flattened;
}

/**
 * Transform and flatten the entire data array
 * @param {Array} data - Array of room objects
 * @returns {Array} Transformed flat array
 */
function transformData(data) {
    return data.map((room, index) => {
        try {
            return flattenRoomData(room);
        } catch (error) {
            console.warn(`⚠️ Warning: Failed to flatten room at index ${index}: ${error.message}`);
            // Return original room if flattening fails
            return room;
        }
    });
}

/**
 * Save data to JSON file
 * @param {string} filePath - Output file path
 * @param {any} data - Data to save
 */
function saveToFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        const stats = fs.statSync(filePath);
        console.log(`💾 Saved: ${path.basename(filePath)} (${(stats.size / 1024).toFixed(2)} KB)`);
    } catch (error) {
        console.error(`❌ File Write Error: ${filePath} - ${error.message}`);
        throw error;
    }
}

/**
 * Check if the existing file is valid (for fallback reference)
 * @param {string} filePath - Path to the existing file
 * @returns {boolean} Whether the file exists and is valid JSON
 */
function existingFileIsValid(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            return false;
        }
        const content = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(content);
        return parsed && parsed.data && Array.isArray(parsed.data);
    } catch {
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════
// MAIN EXECUTION
// ═══════════════════════════════════════════════════════════════

async function main() {
    console.log('═══════════════════════════════════════════════════════');
    console.log(`🕐 Starting Info Data Sync at ${new Date().toISOString()}`);
    console.log('═══════════════════════════════════════════════════════\n');

    const totalStart = Date.now();
    const outputFile = OUTPUT_FILE;

    try {
        // Step 1: Fetch data from API
        console.log('--- Fetching INFO data ---');
        const rawData = await fetchData(API_ENDPOINTS.INFO);

        // Step 2: Validate response
        console.log('--- Validating response ---');
        const validation = validateResponse(rawData);
        if (!validation.valid) {
            throw new Error(`Validation failed: ${validation.error}`);
        }
        console.log(`✅ Validation passed - ${rawData.data.length} rooms found`);

        // Step 3: Transform and flatten data
        console.log('--- Transforming data (flattening occupants_list) ---');
        const transformedData = transformData(rawData.data);
        
        // Preserve metadata from original response
        const outputPayload = {
            status: rawData.status,
            total_rooms: transformedData.length,
            last_updated: new Date().toISOString(),
            data: transformedData
        };

        // Step 4: Save to file
        console.log('--- Saving to file ---');
        saveToFile(outputFile, outputPayload);

        // Summary
        const totalDuration = Date.now() - totalStart;
        console.log('\n═══════════════════════════════════════════════════════');
        console.log(`🏁 Completed successfully in ${totalDuration}ms`);
        console.log(`✅ Info data synced: ${transformedData.length} rooms`);
        console.log('═══════════════════════════════════════════════════════');
        process.exit(0);

    } catch (error) {
        const totalDuration = Date.now() - totalStart;
        console.error('\n═══════════════════════════════════════════════════════');
        console.error(`❌ Sync FAILED after ${totalDuration}ms`);
        console.error(`Error: ${error.message}`);
        console.error('═══════════════════════════════════════════════════════');
        
        // Failsafe check
        if (existingFileIsValid(outputFile)) {
            console.log('\n✅ FAILSAFE: Existing info_data.json remains intact');
        } else {
            console.log('\n⚠️ WARNING: No valid backup file exists');
        }
        
        process.exit(1);
    }
}

main();
