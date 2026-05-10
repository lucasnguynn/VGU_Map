/**
 * VGUMap Data Service
 * Handles data fetching from Google Sheets APIs and local JSON files
 */

import { DATA_FILES } from './config.js';

/**
 * Fetch data from a URL with proper error handling
 * @param {string} url - The URL to fetch
 * @returns {Promise<any>} - The parsed JSON response
 */
export async function fetchData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`❌ Fetch error from ${url}:`, error.message);
        throw error;
    }
}

/**
 * Load room map data from local JSON file
 * @returns {Promise<Array>} - Array of room boundary data
 */
export async function loadMapData() {
    return await fetchData(DATA_FILES.MAP);
}

/**
 * Load room information data from local JSON file
 * @returns {Promise<Object>} - Room information object
 */
export async function loadRoomInfo() {
    return await fetchData(DATA_FILES.INFO);
}

/**
 * Load drive images mapping from local JSON file
 * @returns {Promise<Object>} - Drive images mapping object
 */
export async function loadDriveImages() {
    return await fetchData(DATA_FILES.DRIVE_LIST);
}

/**
 * Process raw room info data into a structured format
 * @param {Array|Object} rawData - Raw data from API
 * @returns {Object} - Processed room data indexed by room ID
 */
export function processRoomInfo(rawData) {
    const dataArray = Array.isArray(rawData) ? rawData : (rawData.data || rawData.items || []);
    const roomData = {};

    dataArray.forEach(row => {
        const roomId = row['Room: Number'] || row.Room_Number || row.Number;
        
        if (!roomId) return;

        if (!roomData[roomId]) {
            roomData[roomId] = {
                ...row,
                staffList: []
            };
        }

        // Aggregate staff names
        const staffName = row['FM_Staff_Name'];
        if (staffName && staffName.trim() !== '' && !roomData[roomId].staffList.includes(staffName)) {
            roomData[roomId].staffList.push(staffName);
        }

        // Update fields if available
        roomData[roomId]['Room: Area'] = row['Room: Area'] || roomData[roomId]['Room: Area'];
        roomData[roomId]['FM_Room_Type'] = row['FM_Room_Type'] || roomData[roomId]['FM_Room_Type'];
        roomData[roomId]['Room: Name'] = row['Room: Name'] || roomData[roomId]['Room: Name'];
    });

    return roomData;
}

/**
 * Filter map data by floor
 * @param {Array} mapData - All map data
 * @param {string} floorId - Floor identifier (e.g., 'bld_ad_f2')
 * @returns {Array} - Filtered map data for the specified floor
 */
export function filterMapDataByFloor(mapData, floorId) {
    const floorNumber = floorId.split('_f')[1];
    const floorPrefix = `AD-${floorNumber}`;

    return mapData.filter(item => {
        if (!item.Room_Number) return false;
        const roomNum = item.Room_Number;
        
        // Match rooms on this floor
        if (roomNum.startsWith(floorPrefix)) return true;
        
        // Match common areas (LB, CR, WC) associated with this floor
        if (/^(LB|CR|WC)/i.test(roomNum)) {
            return roomNum.includes(floorPrefix) || roomNum.endsWith(floorNumber);
        }
        
        return false;
    });
}

/**
 * Build room paths from map data segments
 * @param {Array} floorData - Map data segments for a floor
 * @returns {Object} - Rooms object with path data and bounds
 */
export function buildRoomPaths(floorData) {
    const rooms = {};
    let minMapX = Infinity, minMapY = Infinity;
    let maxMapX = -Infinity, maxMapY = -Infinity;

    floorData.forEach(d => {
        const roomNum = d.Room_Number;
        
        if (!rooms[roomNum]) {
            rooms[roomNum] = { 
                paths: [], 
                minX: Infinity, minY: Infinity, 
                maxX: -Infinity, maxY: Infinity 
            };
        }

        const sx = parseFloat(d.StartX) || 0;
        const sy = parseFloat(d.StartY) || 0;
        const ex = parseFloat(d.EndX) || 0;
        const ey = parseFloat(d.EndY) || 0;

        rooms[roomNum].paths.push({ sx, sy, ex, ey });
        rooms[roomNum].minX = Math.min(rooms[roomNum].minX, sx, ex);
        rooms[roomNum].maxX = Math.max(rooms[roomNum].maxX, sx, ex);
        rooms[roomNum].minY = Math.min(rooms[roomNum].minY, sy, ey);
        rooms[roomNum].maxY = Math.max(rooms[roomNum].maxY, sy, ey);

        minMapX = Math.min(minMapX, sx, ex);
        maxMapX = Math.max(maxMapX, sx, ex);
        minMapY = Math.min(minMapY, sy, ey);
        maxMapY = Math.max(maxMapY, sy, ey);
    });

    return { rooms, bounds: { minMapX, minMapY, maxMapX, maxMapY } };
}
