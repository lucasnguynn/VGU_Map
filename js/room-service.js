/**
 * VGUMap Room Service
 * Handles room data management, search functionality, and detail view rendering
 */

import { 
    FLOOR_ROOMS, 
    FLOOR_NAMES, 
    BUILDINGS, 
    ROOM_TYPE_COLORS,
    ROOM_CATEGORIES 
} from './config.js';
import { 
    processRoomInfo, 
    isExcludedRoom, 
    parseRoomNumber,
    getActiveRooms 
} from './data-service.js';

/**
 * Room data store (cached)
 */
let roomDataCache = {};
let driveImagesCache = {};
let isDataLoaded = false;

/**
 * Initialize room service by loading all data
 * @returns {Promise<void>}
 */
export async function initialize() {
    if (isDataLoaded) return;
    
    try {
        // Data loading will be handled by the main app
        isDataLoaded = true;
    } catch (error) {
        console.error('Failed to initialize room service:', error);
        throw error;
    }
}

/**
 * Set room data cache
 * @param {Object} data - Processed room data
 */
export function setRoomData(data) {
    roomDataCache = data;
}

/**
 * Set drive images cache
 * @param {Object} images - Drive images mapping
 */
export function setDriveImages(images) {
    driveImagesCache = images;
}

/**
 * Get room data by ID
 * @param {string} roomId - Room identifier
 * @returns {Object|null} - Room data or null
 */
export function getRoomData(roomId) {
    return roomDataCache[roomId] || null;
}

/**
 * Get drive image ID for a room
 * @param {string} roomId - Room identifier
 * @returns {string|null} - Drive file ID or null
 */
export function getDriveImageId(roomId) {
    return driveImagesCache[roomId] || null;
}

/**
 * Get active rooms for a floor (excluding CR, LB, WC)
 * @param {string} floorKey - Floor key (e.g., 'bld_ad_f2')
 * @returns {Array} - Array of active room codes
 */
export function getActiveRoomsForFloor(floorKey) {
    const floorRooms = FLOOR_ROOMS[floorKey] || [];
    return getActiveRooms(floorRooms);
}

/**
 * Search rooms by query string
 * @param {string} query - Search query
 * @param {boolean} includeExcluded - Whether to include excluded rooms (default: false)
 * @returns {Array} - Array of matching room IDs
 */
export function searchRooms(query, includeExcluded = false) {
    if (!query || typeof query !== 'string') {
        return [];
    }

    const normalizedQuery = query.trim().toLowerCase();
    const results = [];

    for (const roomId of Object.keys(roomDataCache)) {
        // Skip excluded rooms unless explicitly included
        if (!includeExcluded && isExcludedRoom(roomId)) {
            continue;
        }

        if (roomId.toLowerCase().includes(normalizedQuery)) {
            results.push(roomId);
        }
    }

    return results;
}

/**
 * Parse and validate room code format
 * @param {string} roomCode - Room code to parse
 * @returns {Object|null} - Parsed room info or null if invalid
 */
export function parseAndValidateRoom(roomCode) {
    const parsed = parseRoomNumber(roomCode);
    
    if (!parsed) {
        return null;
    }

    // Validate building exists
    const buildingExists = BUILDINGS.some(b => b.id === `bld_${parsed.buildingCode.toLowerCase()}`);
    
    if (!buildingExists) {
        return null;
    }

    return parsed;
}

/**
 * Get comprehensive room details for display
 * @param {string} roomId - Room identifier
 * @returns {Object} - Complete room details object
 */
export function getRoomDetails(roomId) {
    const roomInfo = roomDataCache[roomId];

    if (roomInfo) {
        // Format occupancy from staff list
        const occupancy = roomInfo.staffList && roomInfo.staffList.length > 0
            ? roomInfo.staffList.join(', ')
            : '__';

        // Parse equipment array
        const rawEquip = roomInfo['Equipment'] || roomInfo['Thiết bị'] || '';
        const equipArray = rawEquip ? String(rawEquip).split(',').map(e => e.trim()).filter(Boolean) : [];

        return {
            id: roomId,
            name: roomInfo['Room: Name'] || roomInfo['Name'] || `Phòng ${roomId}`,
            owner: roomInfo['Department'] || '__',
            occupancy: occupancy,
            area: roomInfo['Room: Area'] || roomInfo['area'] || '--',
            height: roomInfo['Abound height'] || roomInfo['unbounded_height'] || '--',
            type: roomInfo['FM_Room_Type'] || roomInfo['fm_room_type'] || 'Chưa phân loại',
            capacity: roomInfo['Capacity'] || '--',
            function: roomInfo['Function'] || roomInfo['fm_room_function'] || '__',
            equipment: equipArray,
            status: roomInfo['Status'] || (roomInfo['is_active'] ? 'Hoạt động' : 'Không hoạt động')
        };
    }

    // Return default/empty room details
    return {
        id: roomId,
        name: `Phòng ${roomId}`,
        owner: '__',
        occupancy: '__',
        area: '--',
        height: '--',
        type: 'Chưa phân loại',
        capacity: '--',
        function: '__',
        equipment: [],
        status: 'Trống'
    };
}

/**
 * Get room type category for styling
 * @param {string} roomId - Room identifier
 * @param {string} roomType - Room type string
 * @returns {string} - Category key for styling
 */
export function getRoomTypeCategory(roomId, roomType) {
    // Check predefined categories first
    if (ROOM_CATEGORIES[roomId]) {
        return ROOM_CATEGORIES[roomId];
    }

    // Determine category from type string
    const typeLower = String(roomType).toLowerCase();
    
    if (typeLower.includes('office') || typeLower.includes('văn phòng')) {
        return 'office';
    }
    if (typeLower.includes('hội trường') || typeLower.includes('hall')) {
        return 'hall';
    }
    if (typeLower.includes('large') || typeLower.includes('phòng lớn')) {
        return 'large';
    }
    if (/^(LB|CR)/i.test(roomId)) {
        return 'lb';
    }
    if (/^WC/i.test(roomId)) {
        return 'wc';
    }

    return 'default';
}

/**
 * Get style colors for room type badge
 * @param {string} categoryId - Category ID
 * @returns {Array} - [backgroundColor, textColor]
 */
export function getTypeBadgeColors(categoryId) {
    const category = getRoomTypeCategory('', categoryId);
    return ROOM_TYPE_COLORS[category] || ROOM_TYPE_COLORS.office;
}

/**
 * Build search dropdown options for a floor
 * @param {string} floorKey - Floor key (e.g., 'bld_ad_f2')
 * @returns {Array} - Array of option objects {value, label}
 */
export function buildSearchDropdownOptions(floorKey) {
    const activeRooms = getActiveRoomsForFloor(floorKey);
    
    return activeRooms.map(roomCode => ({
        value: roomCode,
        label: `Phòng ${roomCode}`
    }));
}

/**
 * Find room location from room code
 * @param {string} roomCode - Room code (e.g., 'AD-301')
 * @returns {Object|null} - {buildingCode, floorNumber, building} or null
 */
export function findRoomLocation(roomCode) {
    const parsed = parseAndValidateRoom(roomCode);
    
    if (!parsed) {
        return null;
    }

    const building = BUILDINGS.find(b => 
        b.id === `bld_${parsed.buildingCode.toLowerCase()}` ||
        b.code === parsed.buildingCode
    );

    if (!building) {
        return null;
    }

    return {
        buildingCode: parsed.buildingCode,
        floorNumber: parsed.floorNumber,
        building: building
    };
}

/**
 * Generate Google Drive thumbnail URL
 * @param {string} imageId - Google Drive file ID
 * @param {number} size - Thumbnail size (default: 1000)
 * @returns {string} - Thumbnail URL
 */
export function getDriveThumbnailUrl(imageId, size = 1000) {
    if (!imageId) {
        return null;
    }
    return `https://drive.google.com/thumbnail?id=${imageId}&sz=w${size}`;
}

/**
 * Check if room data is loaded
 * @returns {boolean}
 */
export function isDataReady() {
    return isDataLoaded && Object.keys(roomDataCache).length > 0;
}

/**
 * Clear all cached data
 */
export function clearCache() {
    roomDataCache = {};
    driveImagesCache = {};
    isDataLoaded = false;
}

/**
 * Export for backward compatibility with existing code
 */
export const BLDS = BUILDINGS;
export const FLN = FLOOR_NAMES;
