#!/usr/bin/env node

/**
 * VGUMap Data Sync Script
 * Fetches data from Google Sheets APIs and saves as local JSON files
 * 
 * Usage: node fetch_sheets.js
 * 
 * Cron example (run every 10 minutes):
 * 0/10 * * * * /usr/bin/node /path/to/fetch_sheets.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const API_ENDPOINTS = {
    MAP: 'https://script.google.com/macros/s/AKfycbxFmunolmZ5LSC6exu6OnGE0dZi9VYrf6gWBqMJQOrFUe8MdRQAiz0XT825JwkGd-O0/exec',
    INFO: 'https://script.google.com/macros/s/AKfycbzhMONbzVtaRnlIe3hiumaNXBPbQN6qybuANtguLcWMO1ZM0Nmu0NtWZ2yfGsJWORM5dA/exec',
    DRIVE_LIST: 'https://script.google.com/macros/s/AKfycbw4PtDoCILXSiIn1AAYzJhUhSvmJ6ufKD-5R-QKZGzbBy-yQTfC_bPTKJEErwt1d_iS/exec'
};

const OUTPUT_FILES = {
    map_data: path.join(__dirname, 'map_data.json'),
    info_data: path.join(__dirname, 'info_data.json'),
    drive_data: path.join(__dirname, 'drive_data.json')
};

const REQUEST_OPTIONS = {
    headers: {
        'User-Agent': 'VGUMap-CronBot/1.0',
        'Accept': 'application/json'
    }
};

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Fetch data from URL with redirect handling
 * @param {string} url - The URL to fetch
 * @returns {Promise<any>} Parsed JSON response
 */
function fetchData(url) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        console.log(`📡 Fetching: ${url}`);

        https.get(url, REQUEST_OPTIONS, (res) => {
            // Handle redirects
            if (res.statusCode === 302 || res.statusCode === 301) {
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
                    console.error(`Raw preview: ${data.substring(0, 200)}`);
                    reject(new Error(`JSON Parse Failed: ${error.message}`));
                }
            });
        }).on('error', reject);
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

// ═══════════════════════════════════════════════════════════════
// MAIN EXECUTION
// ═══════════════════════════════════════════════════════════════

async function main() {
    console.log('═══════════════════════════════════════════════════════');
    console.log(`🕐 Starting Google Sheets Data Sync at ${new Date().toISOString()}`);
    console.log('═══════════════════════════════════════════════════════\n');

    const totalStart = Date.now();
    const errors = [];

    const tasks = [
        { name: 'MAP', url: API_ENDPOINTS.MAP + '?t=' + Date.now(), file: OUTPUT_FILES.map_data },
        { name: 'INFO', url: API_ENDPOINTS.INFO + '?t=' + Date.now(), file: OUTPUT_FILES.info_data },
        { name: 'DRIVE_LIST', url: API_ENDPOINTS.DRIVE_LIST + '?t=' + Date.now(), file: OUTPUT_FILES.drive_data }
    ];

    for (const task of tasks) {
        try {
            console.log(`--- Fetching ${task.name} data ---`);
            const data = await fetchData(task.url);
            saveToFile(task.file, data);
        } catch (error) {
            errors.push({ source: task.name, error: error.message });
            console.error(`⚠️ Failed: ${task.name} - ${error.message}\n`);
        }
    }

    // Summary
    const totalDuration = Date.now() - totalStart;
    console.log('\n═══════════════════════════════════════════════════════');
    console.log(`🏁 Completed in ${totalDuration}ms`);

    if (errors.length > 0) {
        console.log(`⚠️ Warnings: ${errors.length} source(s) failed:`);
        errors.forEach(e => console.log(`   - ${e.source}: ${e.error}`));
        process.exit(1);
    } else {
        console.log('✅ All data sources synced successfully!');
        process.exit(0);
    }
}

main();
