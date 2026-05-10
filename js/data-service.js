/**
 * VGUMap Data Service
 * Handles data fetching from Google Sheets APIs with caching support
 */

import { DATA_FILES, CACHE_CONFIG, EXCLUDED_ROOM_CODES } from './config.js';

/**
 * Cache utility for storing and retrieving API responses
 */
export const cacheService = {
    /**
     * Get cached data if it exists and is not expired
     * @param {string} key - Cache key
     * @returns {any|null} - Cached data or null if expired/not found
     */
    get(key) {
        try {
            const cached = localStorage.getItem(key);
            if (!cached) return null;
            
            const { data, timestamp } = JSON.parse(cached);
            const now = Date.now();
            
            // Check if cache is expired
            if (now - timestamp > CACHE_CONFIG.TTL) {
                localStorage.removeItem(key);
                return null;
            }
            
            return data;
        } catch (error) {
            console.warn(`Cache read error for key ${key}:`, error);
            return null;
        }
    },
    
    /**
     * Store data in cache with timestamp
     * @param {string} key - Cache key
     * @param {any} data - Data to cache
     */
    set(key, data) {
        try {
            const cacheEntry = {
                data,
                timestamp: Date.now()
            };
            localStorage.setItem(key, JSON.stringify(cacheEntry));
        } catch (error) {
            console.warn(`Cache write error for key ${key}:`, error);
            // Storage might be full, clear old entries
            if (error.name === 'QuotaExceededError') {
                localStorage.clear();
            }
        }
    },
    
    /**
     * Clear all cached data
     */
    clear() {
        Object.values(CACHE_CONFIG.KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
    }
};

/**
 * Parse room number string to extract building code, floor, and room number
 * Format: [BuildingCode]-[Floor][RoomNumber] (e.g., "AD-301" -> building: "AD", floor: 3, room: "01")
 * @param {string} roomNumber - Room number string (e.g., "AD-301", "FC-202")
 * @returns {Object|null} - Parsed room info or null if invalid format
 */
export function parseRoomNumber(roomNumber) {
    if (!roomNumber || typeof roomNumber !== 'string') {
        return null;
    }
    
    // Match pattern: 2 chars before hyphen, then digits
    const match = roomNumber.match(/^([A-Z]{2})-(\d+)(.*)$/i);
    if (!match) {
        return null;
    }
    
    const [, buildingCode, floorAndRoom, suffix] = match;
    const floorNumber = parseInt(floorAndRoom.charAt(0), 10);
    const roomDigits = floorAndRoom.slice(1, 4); // First 3 digits after floor
    
    return {
        buildingCode: buildingCode.toUpperCase(),
        floorNumber,
        roomNumber: roomDigits,
        fullRoomSuffix: suffix,
        originalCode: roomNumber
    };
}

/**
 * Check if a room code should be excluded from search dropdown
 * Excludes rooms containing CR (Corridor), LB (Lobby), WC (Restroom)
 * @param {string} roomCode - Room code to check
 * @returns {boolean} - True if room should be excluded
 */
export function isExcludedRoom(roomCode) {
    if (!roomCode) return true;
    
    const upperCode = roomCode.toUpperCase();
    
    // Check if any exclusion code is present in the room code
    return EXCLUDED_ROOM_CODES.some(code => 
        upperCode.includes(`-${code}`) || 
        upperCode.includes(`.${code}`) ||
        upperCode.startsWith(`${code}-`) ||
        upperCode.startsWith(`${code}.`)
    );
}

/**
 * Fetch data from a URL with proper error handling and caching
 * @param {string} url - The URL to fetch
 * @param {string} cacheKey - Cache storage key
 * @param {boolean} useCache - Whether to use cache (default: true)
 * @returns {Promise<any>} - The parsed JSON response
 */
export async function fetchData(url, cacheKey, useCache = true) {
    // Try to get from cache first
    if (useCache) {
        const cachedData = cacheService.get(cacheKey);
        if (cachedData) {
            console.log(`✅ Cache hit for ${cacheKey}`);
            return cachedData;
        }
    }
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        
        // Cache the response
        if (useCache && cacheKey) {
            cacheService.set(cacheKey, data);
            console.log(`✅ Cached data for ${cacheKey}`);
        }
        
        return data;
    } catch (error) {
        console.error(`❌ Fetch error from ${url}:`, error.message);
        
        // If fetch fails, try to return stale cache data if available
        if (useCache) {
            const staleCache = cacheService.get(cacheKey);
            if (staleCache) {
                console.log(`⚠️ Returning stale cache for ${cacheKey}`);
                return staleCache;
            }
        }
        
        throw error;
    }
}

/**
 * Load room map data from local JSON file with caching
 * @returns {Promise<Array>} - Array of room boundary data
 */
export async function loadMapData() {
    return await fetchData(DATA_FILES.MAP_COORDINATES, CACHE_CONFIG.KEYS.MAP);
}

/**
 * Load room information data from local JSON file with caching
 * @returns {Promise<Object>} - Room information object
 */
export async function loadRoomInfo() {
    return await fetchData(DATA_FILES.ROOM_SCHEDULE, CACHE_CONFIG.KEYS.ROOMS);
}

/**
 * Load drive images mapping from local JSON file with caching
 * @returns {Promise<Object>} - Drive images mapping object
 */
export async function loadDriveImages() {
    return await fetchData(DATA_FILES.DRIVE_LIST, CACHE_CONFIG.KEYS.DRIVE);
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
        const roomId = row['room_number'] || row['Room: Number'] || row.Room_Number || row.Number;
        
        if (!roomId) return;

        // Skip excluded rooms (CR, LB, WC)
        if (isExcludedRoom(roomId)) {
            return;
        }

        if (!roomData[roomId]) {
            roomData[roomId] = {
                ...row,
                staffList: []
            };
        }

        // Aggregate staff names
        const staffName = row['FM_Staff_Name'] || row['occupant_display'];
        if (staffName && staffName.trim() !== '' && !roomData[roomId].staffList.includes(staffName)) {
            roomData[roomId].staffList.push(staffName);
        }

        // Update fields if available
        roomData[roomId]['Room: Area'] = row['Room: Area'] || row['area'] || roomData[roomId]['Room: Area'];
        roomData[roomId]['FM_Room_Type'] = row['FM_Room_Type'] || row['fm_room_type'] || roomData[roomId]['FM_Room_Type'];
        roomData[roomId]['Room: Name'] = row['Room: Name'] || row['heading_1'] || roomData[roomId]['Room: Name'];
        roomData[roomId]['Department'] = row['Department'] || row['department'] || roomData[roomId]['Department'];
        roomData[roomId]['Capacity'] = row['Capacity'] || roomData[roomId]['Capacity'];
        roomData[roomId]['Function'] = row['Function'] || row['fm_room_function'] || roomData[roomId]['Function'];
        roomData[roomId]['Abound height'] = row['Abound height'] || row['unbounded_height'] || roomData[roomId]['Abound height'];
        roomData[roomId]['Equipment'] = row['Equipment'] || roomData[roomId]['Equipment'];
        roomData[roomId]['Status'] = row['Status'] || (row['is_active'] ? 'Hoạt động' : 'Không hoạt động');
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
                maxX: -Infinity, maxY: -Infinity 
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

/**
 * Get list of active rooms for a floor (excluding CR, LB, WC)
 * @param {Array} floorRooms - Array of room codes for a floor
 * @returns {Array} - Filtered array of active room codes
 */
export function getActiveRooms(floorRooms) {
    return floorRooms.filter(roomCode => !isExcludedRoom(roomCode));
}
