#!/usr/bin/env node

/*
 * Cron Job Script: Fetch data from Google Sheets APIs and save as local JSON files
 * Run this script every 10 minutes via cron.
 * Example (add to crontab):
 * 0/10 * * * * /usr/bin/node /path/to/fetch_sheets.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration - Google Sheets Apps Script API URLs
const CONFIG = {
    API_MAP: 'https://script.google.com/macros/s/AKfycbxFmunolmZ5LSC6exu6OnGE0dZi9VYrf6gWBqMJQOrFUe8MdRQAiz0XT825JwkGd-O0/exec',
    // Đã cập nhật API_INFO với link mới chứa dữ liệu phòng chuẩn hóa (heading, department, is_active...)
    API_INFO: 'https://script.google.com/macros/s/AKfycbzhMONbzVtaRnlIe3hiumaNXBPbQN6qybuANtguLcWMO1ZM0Nmu0NtWZ2yfGsJWORM5dA/exec',
    API_DRIVE_LIST: 'https://script.google.com/macros/s/AKfycbw4PtDoCILXSiIn1AAYzJhUhSvmJ6ufKD-5R-QKZGzbBy-yQTfC_bPTKJEErwt1d_iS/exec'
};

// Output file paths (relative to script directory)
const OUTPUT_DIR = __dirname;
const OUTPUT_FILES = {
    map_data: path.join(OUTPUT_DIR, 'map_data.json'),
    info_data: path.join(OUTPUT_DIR, 'info_data.json'),
    drive_data: path.join(OUTPUT_DIR, 'drive_data.json')
};

/**
 * Fetch data from a URL using HTTPS with proper redirect handling for Google Apps Script
 * @param {string} url - The URL to fetch
 * @returns {Promise<any>} - The parsed JSON response
 */
function fetchData(url) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        console.log(`📡 Fetching: ${url}`);
        
        // Follow redirects manually for Google Apps Script
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; VGUMap-CronBot/1.0)',
                'Accept': 'application/json'
            }
        };
        
        https.get(url, options, (res) => {
            let data = '';
            
            // Handle redirects
            if (res.statusCode === 302 || res.statusCode === 301) {
                fetchData(res.headers.location).then(resolve).catch(reject);
                return;
            }
            
            if (res.statusCode !== 200) {
                console.error(`❌ HTTP Error: ${res.statusCode}`);
                reject(new Error(`HTTP Error: ${res.statusCode}`));
                return;
            }
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                const duration = Date.now() - startTime;
                try {
                    const jsonData = JSON.parse(data);
                    console.log(`✅ Success (${duration}ms) - Received ${data.length} bytes`);
                    resolve(jsonData);
                } catch (error) {
                    console.error(`❌ JSON Parse Error: ${error.message}`);
                    console.error(`Raw response preview: ${data.substring(0, 200)}`);
                    reject(new Error(`Failed to parse JSON: ${error.message}`));
                }
            });
        }).on('error', (error) => {
            console.error(`❌ Fetch Error: ${error.message}`);
            reject(error);
        });
    });
}

/**
 * Save data to a JSON file
 * @param {string} filePath - The output file path
 * @param {any} data - The data to save
 */
function saveToFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        const stats = fs.statSync(filePath);
        console.log(`💾 Saved: ${path.basename(filePath)} (${(stats.size / 1024).toFixed(2)} KB)`);
    } catch (error) {
        console.error(`❌ File Write Error for ${filePath}: ${error.message}`);
        throw error;
    }
}

/**
 * Main function to run the cron job
 */
async function main() {
    console.log('═══════════════════════════════════════════════════════');
    console.log(`🕐 Starting Google Sheets Data Sync at ${new Date().toISOString()}`);
    console.log('═══════════════════════════════════════════════════════');
    
    const totalStart = Date.now();
    const errors = [];
    
    // Fetch and save each data source
    try {
        console.log('\n--- Fetching MAP data ---');
        const mapData = await fetchData(CONFIG.API_MAP);
        saveToFile(OUTPUT_FILES.map_data, mapData);
    } catch (error) {
        errors.push({ source: 'API_MAP', error: error.message });
        console.error(`⚠️ Failed to fetch MAP data: ${error.message}`);
    }
    
    try {
        console.log('\n--- Fetching INFO data ---');
        const infoData = await fetchData(CONFIG.API_INFO);
        saveToFile(OUTPUT_FILES.info_data, infoData);
    } catch (error) {
        errors.push({ source: 'API_INFO', error: error.message });
        console.error(`⚠️ Failed to fetch INFO data: ${error.message}`);
    }
    
    try {
        console.log('\n--- Fetching DRIVE_LIST data ---');
        const driveData = await fetchData(CONFIG.API_DRIVE_LIST);
        saveToFile(OUTPUT_FILES.drive_data, driveData);
    } catch (error) {
        errors.push({ source: 'API_DRIVE_LIST', error: error.message });
        console.error(`⚠️ Failed to fetch DRIVE_LIST data: ${error.message}`);
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

// Run the script
main();
