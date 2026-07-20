/**
 * VGU Map - Data Service Module
 * Handles data fetching, processing, and transformation
 */

import { API_ENDPOINTS } from './config.js';

/**
 * Fetch JSON with proper error handling and UTF-8 support
 * @param {string} url - The URL to fetch from
 * @returns {Promise<any>} - Parsed JSON response
 * @throws {Error} - If fetch fails or response is not OK
 */
export async function fetchJson(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json; charset=utf-8'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[DataService] Failed to fetch ${url}:`, error);
    throw error;
  }
}

/**
 * Load map data from GeoJSON source
 * @param {string} [url=API_ENDPOINTS.mapData] - Optional custom URL
 * @returns {Promise<Object>} - Map GeoJSON data
 */
export async function loadMapData(url = API_ENDPOINTS.mapData) {
  return fetchJson(url);
}

/**
 * Load room information data
 * @param {string} [url=API_ENDPOINTS.infoData] - Optional custom URL
 * @returns {Promise<Array>} - Array of room information
 */
export async function loadRoomInfo(url = API_ENDPOINTS.infoData) {
  return fetchJson(url);
}

/**
 * Load drive image mappings
 * @param {string} [url=API_ENDPOINTS.driveData] - Optional custom URL
 * @returns {Promise<Object>} - Drive data mappings
 */
export async function loadDriveData(url = API_ENDPOINTS.driveData) {
  return fetchJson(url);
}

/**
 * Load floors configuration
 * @param {string} [url=API_ENDPOINTS.floorsConfig] - Optional custom URL
 * @returns {Promise<Object>} - Floors configuration object
 */
export async function loadFloorsConfig(url = API_ENDPOINTS.floorsConfig) {
  return fetchJson(url);
}

/**
 * Load campus buildings GeoJSON
 * @param {string} [url='/public/campus-buildings.json'] - Optional custom URL
 * @returns {Promise<Object>} - Campus buildings GeoJSON
 */
export async function loadCampusBuildings(url = '/public/campus-buildings.json') {
  return fetchJson(url);
}

/**
 * Transform info_data into labs format for compatibility
 * @param {Array} infoData - Raw info_data array
 * @returns {Array} - Transformed labs array
 */
export function transformInfoToLabs(infoData) {
  if (!Array.isArray(infoData)) {
    console.warn('[DataService] Info data is not an array');
    return [];
  }

  return infoData
    .filter(item => item.room_number && item.room_number.includes('.'))
    .map(item => {
      const parts = item.room_number.split('.');
      const floor = parseInt(parts[0]) || 1;
      const roomId = parts.slice(1).join('.');

      // Determine building from room prefix
      let buildingId = 'cluster-1'; // default
      if (roomId.startsWith('LB')) {
        buildingId = 'cluster-1';
      } else if (roomId.startsWith('CR')) {
        buildingId = 'cluster-2';
      }

      return {
        room_id: roomId,
        name: item.heading_2 || item.heading_1 || roomId,
        type: item.fm_room_type === 'laboratory' ? 'laboratory' : 'other',
        department: item.department || 'General',
        building_id: buildingId,
        floor: floor
      };
    });
}

/**
 * Normalize room info data into a keyed object
 * @param {Array} infoData - Array of room information
 * @returns {Object} - Object with room_id as keys
 */
export function normalizeRoomInfo(infoData) {
  if (!Array.isArray(infoData)) {
    return {};
  }

  return infoData.reduce((acc, room) => {
    if (room.room_id) {
      acc[room.room_id] = {
        ...room,
        occupants_flat: room.occupants_list?.join(', ') || '',
        equipment_count: room.equipment?.length || 0
      };
    }
    return acc;
  }, {});
}

/**
 * Filter rooms by floor number
 * @param {Array} rooms - Array of room objects
 * @param {number} floor - Floor number to filter by
 * @returns {Array} - Filtered rooms array
 */
export function filterRoomsByFloor(rooms, floor) {
  if (!Array.isArray(rooms)) {
    return [];
  }
  return rooms.filter(room => room.floor === floor);
}

/**
 * Filter rooms by building ID
 * @param {Array} rooms - Array of room objects
 * @param {string} buildingId - Building ID to filter by
 * @returns {Array} - Filtered rooms array
 */
export function filterRoomsByBuilding(rooms, buildingId) {
  if (!Array.isArray(rooms)) {
    return [];
  }
  return rooms.filter(room => room.building_id === buildingId);
}

/**
 * Get unique floors from rooms data
 * @param {Array} rooms - Array of room objects
 * @returns {Set<number>} - Set of unique floor numbers
 */
export function getUniqueFloors(rooms) {
  if (!Array.isArray(rooms)) {
    return new Set();
  }
  return new Set(rooms.map(room => room.floor));
}

/**
 * Construct room path from building and room IDs
 * @param {string} buildingId - Building identifier
 * @param {string} roomId - Room identifier
 * @returns {string} - Constructed path
 */
export function constructRoomPath(buildingId, roomId) {
  return `/${buildingId}/${roomId}`;
}

/**
 * Sync all data from multiple endpoints
 * @returns {Promise<{map: Object, info: Object, drive: Object, labs: Array}>}
 */
export async function syncAllData() {
  try {
    // Load all data in parallel
    const [mapData, infoData, driveData, floorsConfig] = await Promise.all([
      loadMapData(),
      loadRoomInfo(),
      loadDriveData(),
      loadFloorsConfig()
    ]);

    // Transform and normalize data
    const labs = transformInfoToLabs(infoData);
    const normalizedInfo = normalizeRoomInfo(infoData);

    console.log('[DataService] Data sync completed:', {
      mapFeatures: mapData?.features?.length || 0,
      infoRooms: Object.keys(normalizedInfo).length,
      driveItems: Object.keys(driveData).length,
      labsCount: labs.length
    });

    return {
      map: mapData,
      info: normalizedInfo,
      drive: driveData,
      floorsConfig,
      labs
    };
  } catch (error) {
    console.error('[DataService] Data Sync Failed:', error);
    throw error;
  }
}

/**
 * Get floors that have labs for a specific building
 * @param {string} buildingId - Building ID
 * @param {Array} labs - Labs array
 * @returns {Set<number>} - Set of floor numbers with labs
 */
export function getFloorsWithLabs(buildingId, labs) {
  if (!buildingId || !Array.isArray(labs)) {
    return new Set();
  }
  const matching = labs.filter(lab => lab.building_id === buildingId);
  return new Set(matching.map(lab => lab.floor));
}

// Export all functions as default export for convenience
export default {
  fetchJson,
  loadMapData,
  loadRoomInfo,
  loadDriveData,
  loadFloorsConfig,
  loadCampusBuildings,
  transformInfoToLabs,
  normalizeRoomInfo,
  filterRoomsByFloor,
  filterRoomsByBuilding,
  getUniqueFloors,
  constructRoomPath,
  syncAllData,
  getFloorsWithLabs
};
