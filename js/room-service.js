/**
 * VGUMap Room Service
 * Handles room data lookup and detail management
 */

import { ROOM_CATEGORIES, ROOM_TYPE_COLORS } from './config.js';

// Fallback hardcoded room data (used when API data is unavailable)
const FALLBACK_ROOM_DATA = {
    'AD-101': {
        name: 'Phòng đa năng 101',
        owner: 'Phòng Hành chính — VGU',
        area: 95,
        cap: 30,
        type: 'Phòng lớn',
        func: 'Phòng làm việc và tiếp khách tầng 1',
        equip: ['Bàn họp', 'TV 65 inch', 'Điều hòa', 'Hệ thống âm thanh'],
        status: 'Hoạt động'
    },
    'AD-103': {
        name: 'Phòng 103',
        owner: 'Phòng HC–TC — VGU',
        area: 55,
        cap: 15,
        type: 'Văn phòng',
        func: 'Phòng làm việc tầng 1',
        equip: ['Máy tính', 'Bàn làm việc', 'Điều hòa'],
        status: 'Hoạt động'
    },
    'AD-104': {
        name: 'Phòng 104',
        owner: 'Phòng HC–TC — VGU',
        area: 65,
        cap: 18,
        type: 'Văn phòng',
        func: 'Phòng làm việc tầng 1',
        equip: ['Máy tính', 'Bàn làm việc', 'Điều hòa'],
        status: 'Hoạt động'
    },
    'AD-201': {
        name: 'Hội trường chính Tầng 2',
        owner: 'Ban Giám hiệu — VGU',
        area: 900,
        cap: 400,
        type: 'Hội trường',
        func: 'Sự kiện lớn, hội nghị toàn trường',
        equip: ['Sân khấu', 'Âm thanh JBL', '4 Màn hình LED', '400 ghế'],
        status: 'Hoạt động'
    },
    'AD-601': {
        name: 'Hội trường 601',
        owner: 'Admin Building — VGU',
        area: 410,
        cap: 150,
        type: 'Phòng lớn',
        func: 'Hội thảo quy mô lớn tầng 6',
        equip: ['Âm thanh', 'Máy chiếu 4K', '150 ghế'],
        status: 'Hoạt động'
    },
    'AD-609': {
        name: 'Hội trường lớn 609',
        owner: 'Admin Building — VGU',
        area: 520,
        cap: 250,
        type: 'Phòng lớn',
        func: 'Hội nghị quy mô lớn',
        equip: ['Sân khấu', 'Âm thanh JBL', '3 Màn hình LED', '250 ghế'],
        status: 'Hoạt động'
    },
    'AD-614': {
        name: 'Khu đa năng 614',
        owner: 'Admin Building — VGU',
        area: 450,
        cap: 200,
        type: 'Phòng lớn',
        func: 'Không gian đa năng tầng 6',
        equip: ['Âm thanh', 'Máy chiếu', 'Bàn ghế linh hoạt'],
        status: 'Hoạt động'
    }
};

/**
 * Get detailed room information
 * @param {string} roomId - Room identifier
 * @param {Object} sheetRoomData - Room data from API
 * @returns {Object} - Room detail object
 */
export function getRoomDetails(roomId, sheetRoomData = {}) {
    const roomInfo = sheetRoomData[roomId];

    if (roomInfo) {
        const occupancy = roomInfo.staffList && roomInfo.staffList.length > 0
            ? roomInfo.staffList.join(', ')
            : '__';

        const rawEquip = roomInfo['Equipment'] || roomInfo['Thiết bị'] || '';
        const equipArray = rawEquip ? String(rawEquip).split(',').map(e => e.trim()) : [];

        return {
            name: roomInfo['Room: Name'] || roomInfo['Name'] || `Phòng ${roomId}`,
            owner: roomInfo['Department'] || '__',
            occupancy: occupancy,
            area: roomInfo['Room: Area'] || roomInfo['Area'] || '--',
            height: roomInfo['Abound height'] || roomInfo['Height'] || '--',
            type: roomInfo['FM_Room_Type'] || roomInfo['Type'] || 'Chưa phân loại',
            cap: roomInfo['Capacity'] || '--',
            func: roomInfo['Function'] || '__',
            equip: equipArray,
            status: roomInfo['Status'] || 'Hoạt động'
        };
    }

    // Fallback to hardcoded data
    if (FALLBACK_ROOM_DATA[roomId]) {
        return FALLBACK_ROOM_DATA[roomId];
    }

    // Default empty room
    return {
        name: `Phòng ${roomId}`,
        owner: '__',
        occupancy: '__',
        area: '--',
        height: '--',
        type: 'Chưa phân loại',
        cap: '--',
        func: '__',
        equip: [],
        status: 'Trống'
    };
}

/**
 * Get room category for styling
 * @param {string} roomId - Room identifier
 * @returns {string} - Category key
 */
export function getRoomCategory(roomId) {
    return ROOM_CATEGORIES[roomId] || 'office';
}

/**
 * Get color theme for room type
 * @param {string} type - Room type
 * @returns {Array} - [backgroundColor, textColor]
 */
export function getRoomTypeColors(type) {
    const typeLower = String(type).toLowerCase();
    
    if (typeLower.includes('office')) return ROOM_TYPE_COLORS.office;
    if (typeLower.includes('hội trường')) return ROOM_TYPE_COLORS.hall;
    if (typeLower.includes('large')) return ROOM_TYPE_COLORS.large;
    
    return ROOM_TYPE_COLORS.office;
}
