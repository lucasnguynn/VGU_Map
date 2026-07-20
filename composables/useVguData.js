// composables/useVguData.js
// Composable để quản lý dữ liệu VGU Map - thay thế sync_all_data.js

export const useVguData = () => {
  /**
   * Fetch JSON với handling UTF-8 và error chuẩn
   * @param {string} url - URL endpoint
   * @returns {Promise<any>}
   */
  const fetchJson = async (url) => {
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json; charset=utf-8'
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error(`[useVguData] Failed to fetch ${url}:`, error)
      throw error
    }
  }

  /**
   * Chuẩn hóa data từ info_data.json
   * @param {Array} infoData - Mảng dữ liệu phòng
   * @returns {Object} - Object map với room_id làm key
   */
  const normalizeInfo = (infoData) => {
    // info_data.json gốc có dạng { status, total_rooms, last_updated, data: [...] }
    const rooms = Array.isArray(infoData) ? infoData : (infoData?.data || [])
    if (!Array.isArray(rooms)) return {}

    return rooms.reduce((acc, room) => {
      if (room.room_id) {
        acc[room.room_id] = {
          ...room,
          occupants_flat: room.occupants_list?.join(', ') || '',
          equipment_count: room.equipment?.length || 0
        }
      }
      return acc
    }, {})
  }

  /**
   * Sync tất cả dữ liệu từ các endpoints
   * @returns {Promise<{map: Object, info: Object, drive: Object}>}
   */
  const syncAll = async () => {
    try {
      // Load song song tất cả dữ liệu
      const [mapData, infoData, driveData] = await Promise.all([
        fetchJson('/data/json-tung/map_data.json'),
        fetchJson('/data/info_data.json'),
        fetchJson('/data/drive_data.json')
      ])

      const result = {
        map: mapData,
        info: normalizeInfo(infoData),
        drive: driveData
      }

      console.log('[useVguData] Data sync completed:', {
        mapFeatures: mapData?.features?.length || 0,
        infoRooms: Object.keys(result.info).length,
        driveItems: Object.keys(driveData).length
      })

      return result
    } catch (error) {
      console.error('[useVguData] Data Sync Failed:', error)
      throw error
    }
  }

  /**
   * Lấy thông tin phòng từ Nuxt Content
   * @param {string} roomId - Room ID (ví dụ: "AD-247")
   * @returns {Promise<Object|null>}
   */
  const getRoomInfo = async (roomId) => {
    try {
      const { queryContent } = await import('#imports')
      const room = await queryContent('labs')
        .where({ room_id: roomId })
        .findOne()
      
      return room || null
    } catch (error) {
      console.error(`[useVguData] Failed to get room info for ${roomId}:`, error)
      return null
    }
  }

  /**
   * Lấy danh sách thiết bị trong phòng
   * @param {string} roomId - Room ID
   * @returns {Promise<Array>}
   */
  const getRoomEquipment = async (roomId) => {
    try {
      const { queryContent } = await import('#imports')
      const equipments = await queryContent('equipment')
        .where({ 'location.room_id': roomId })
        .find()
      
      return equipments || []
    } catch (error) {
      console.error(`[useVguData] Failed to get equipment for ${roomId}:`, error)
      return []
    }
  }

  /**
   * Lấy dữ liệu floor plan cho tòa nhà
   * @param {string} buildingId - Building ID (ví dụ: "cluster-1")
   * @param {number} floor - Floor number
   * @returns {Promise<Object|null>}
   */
  const getFloorPlan = async (buildingId, floor) => {
    try {
      const floorMap = {
        'cluster-1': 'msi-floor',
        'cluster-2': 'msi-floor',
        'cluster-3': 'msi-floor',
        'cluster-5': 'msi-floor',
        'cluster-6': 'msi-floor'
      }
      
      const prefix = floorMap[buildingId] || 'msi-floor'
      const filename = `/data/json-tung/${prefix}${floor}.json`
      
      return await fetchJson(filename)
    } catch (error) {
      console.error(`[useVguData] Failed to get floor plan:`, error)
      return null
    }
  }

  return {
    fetchJson,
    syncAll,
    getRoomInfo,
    getRoomEquipment,
    getFloorPlan
  }
}
