/**
 * VGU Map - Room Service Module
 * Handles room data lookup, categorization, and fallback management
 */

import { DEPARTMENT_COLORS, DEFAULT_COLOR } from './config.js';

// Fallback room data for when API is unavailable
const FALLBACK_ROOMS = {
  'LB-101': {
    room_id: 'LB-101',
    name: 'Materials Science Lab 1',
    type: 'laboratory',
    department: 'Materials Science',
    floor: 1,
    building_id: 'cluster-1'
  },
  'CR-201': {
    room_id: 'CR-201',
    name: 'Computer Lab 1',
    type: 'laboratory',
    department: 'Computer Science',
    floor: 2,
    building_id: 'cluster-2'
  }
};

/**
 * Get room details by ID
 * @param {string} roomId - Room identifier
 * @param {Object} roomsData - Rooms data object (keyed by room_id)
 * @returns {Object|null} - Room details or null if not found
 */
export function getRoomDetails(roomId, roomsData = {}) {
  if (!roomId) {
    console.warn('[RoomService] Room ID is required');
    return null;
  }

  // Try to find in provided data first
  if (roomsData && roomsData[roomId]) {
    return {
      ...roomsData[roomId],
      source: 'api'
    };
  }

  // Fallback to hardcoded data
  if (FALLBACK_ROOMS[roomId]) {
    console.log(`[RoomService] Using fallback data for ${roomId}`);
    return {
      ...FALLBACK_ROOMS[roomId],
      source: 'fallback'
    };
  }

  console.warn(`[RoomService] Room ${roomId} not found`);
  return null;
}

/**
 * Get room category/type with proper classification
 * @param {Object} room - Room object
 * @returns {string} - Room category
 */
export function getRoomCategory(room) {
  if (!room) {
    return 'unknown';
  }

  const roomType = room.type || room.room_type || '';
  const department = room.department || '';

  // Laboratory types
  if (roomType === 'laboratory' || roomType === 'lab') {
    if (department.includes('Computer') || department.includes('IT')) {
      return 'computer-lab';
    } else if (department.includes('Chemistry') || department.includes('Chemical')) {
      return 'chemistry-lab';
    } else if (department.includes('Physics')) {
      return 'physics-lab';
    } else if (department.includes('Materials')) {
      return 'materials-lab';
    } else if (department.includes('Mechanical') || department.includes('Mechatronics')) {
      return 'mechanical-lab';
    } else if (department.includes('Electrical')) {
      return 'electrical-lab';
    }
    return 'laboratory';
  }

  // Classroom types
  if (roomType === 'classroom' || roomType === 'lecture-hall') {
    return 'classroom';
  }

  // Office types
  if (roomType === 'office') {
    return 'office';
  }

  // Meeting rooms
  if (roomType === 'meeting-room' || roomType === 'conference') {
    return 'meeting-room';
  }

  // Other spaces
  if (roomType === 'common-area' || roomType === 'lounge') {
    return 'common-area';
  }

  return 'other';
}

/**
 * Get color for room based on type or department
 * @param {Object} room - Room object
 * @returns {string} - Hex color code
 */
export function getRoomColor(room) {
  if (!room) {
    return DEFAULT_COLOR;
  }

  // Check department-based color first
  if (room.department) {
    for (const [key, color] of Object.entries(DEPARTMENT_COLORS)) {
      if (room.department.includes(key)) {
        return color;
      }
    }
  }

  // Type-based colors
  const category = getRoomCategory(room);
  const typeColors = {
    'computer-lab': '#10B981',
    'chemistry-lab': '#EC4899',
    'physics-lab': '#8B5CF6',
    'materials-lab': '#EF5A24',
    'mechanical-lab': '#34D399',
    'electrical-lab': '#3B82F6',
    'laboratory': '#EF5A24',
    'classroom': '#6B7280',
    'office': '#4B5563',
    'meeting-room': '#F59E0B',
    'common-area': '#14B8A6'
  };

  return typeColors[category] || DEFAULT_COLOR;
}

/**
 * Search rooms by query string
 * @param {string} query - Search query
 * @param {Array} rooms - Array of room objects
 * @returns {Array} - Matching rooms
 */
export function searchRooms(query, rooms = []) {
  if (!query || !Array.isArray(rooms)) {
    return [];
  }

  const normalizedQuery = query.toLowerCase().trim();

  return rooms.filter(room => {
    const roomId = (room.room_id || '').toLowerCase();
    const roomName = (room.name || '').toLowerCase();
    const department = (room.department || '').toLowerCase();

    return roomId.includes(normalizedQuery) ||
           roomName.includes(normalizedQuery) ||
           department.includes(normalizedQuery);
  });
}

/**
 * Filter rooms by multiple criteria
 * @param {Array} rooms - Array of room objects
 * @param {Object} filters - Filter criteria
 * @returns {Array} - Filtered rooms
 */
export function filterRooms(rooms, filters = {}) {
  if (!Array.isArray(rooms)) {
    return [];
  }

  return rooms.filter(room => {
    // Filter by building
    if (filters.building_id && room.building_id !== filters.building_id) {
      return false;
    }

    // Filter by floor
    if (filters.floor && room.floor !== filters.floor) {
      return false;
    }

    // Filter by department
    if (filters.department && !room.department?.includes(filters.department)) {
      return false;
    }

    // Filter by type
    if (filters.type && getRoomCategory(room) !== filters.type) {
      return false;
    }

    return true;
  });
}

/**
 * Group rooms by a specific property
 * @param {Array} rooms - Array of room objects
 * @param {string} groupBy - Property to group by
 * @returns {Object} - Grouped rooms object
 */
export function groupRoomsBy(rooms, groupBy = 'building_id') {
  if (!Array.isArray(rooms)) {
    return {};
  }

  return rooms.reduce((acc, room) => {
    const key = room[groupBy] || 'unknown';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(room);
    return acc;
  }, {});
}

/**
 * Sort rooms by property
 * @param {Array} rooms - Array of room objects
 * @param {string} sortBy - Property to sort by
 * @param {boolean} ascending - Sort direction
 * @returns {Array} - Sorted rooms
 */
export function sortRooms(rooms, sortBy = 'room_id', ascending = true) {
  if (!Array.isArray(rooms)) {
    return [];
  }

  return [...rooms].sort((a, b) => {
    const aVal = a[sortBy] || '';
    const bVal = b[sortBy] || '';

    if (ascending) {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });
}

/**
 * Get room equipment list
 * @param {Object} room - Room object
 * @returns {Array} - Equipment array
 */
export function getRoomEquipment(room) {
  if (!room) {
    return [];
  }
  return room.equipment || [];
}

/**
 * Get room occupants as formatted string
 * @param {Object} room - Room object
 * @returns {string} - Formatted occupants string
 */
export function getRoomOccupants(room) {
  if (!room) {
    return '';
  }

  if (room.occupants_list && Array.isArray(room.occupants_list)) {
    return room.occupants_list.join(', ');
  }

  return room.occupants_flat || '';
}

/**
 * Validate room data structure
 * @param {Object} room - Room object to validate
 * @returns {boolean} - Validation result
 */
export function validateRoomData(room) {
  if (!room || typeof room !== 'object') {
    return false;
  }

  // Required fields
  const requiredFields = ['room_id'];
  for (const field of requiredFields) {
    if (!room[field]) {
      console.warn(`[RoomService] Missing required field: ${field}`);
      return false;
    }
  }

  return true;
}

/**
 * Merge room data from multiple sources
 * @param {Object} primary - Primary room data
 * @param {Object} secondary - Secondary room data
 * @returns {Object} - Merged room data
 */
export function mergeRoomData(primary, secondary) {
  if (!primary && !secondary) {
    return null;
  }

  if (!primary) {
    return secondary;
  }

  if (!secondary) {
    return primary;
  }

  return {
    ...secondary,
    ...primary,
    // Ensure room_id is preserved
    room_id: primary.room_id || secondary.room_id
  };
}

/**
 * Export default room service object
 */
export default {
  getRoomDetails,
  getRoomCategory,
  getRoomColor,
  searchRooms,
  filterRooms,
  groupRoomsBy,
  sortRooms,
  getRoomEquipment,
  getRoomOccupants,
  validateRoomData,
  mergeRoomData
};
