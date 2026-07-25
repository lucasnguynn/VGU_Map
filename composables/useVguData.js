// composables/useVguData.js
// Chỉ còn 2 hàm được UI dùng: getRoomInfo + getRoomEquipment (đọc từ Nuxt Content).
// Đã bỏ syncAll/normalizeInfo/getFloorPlan/fetchJson: syncAll trước đây được gọi
// trong app.vue lúc mounted, fetch 3 file JSON rồi VỨT ĐI (HologramMap tự nạp
// dữ liệu riêng) — vừa thừa request vừa dễ 404. Việc "đồng bộ dữ liệu" giờ do
// pipeline CI (scripts/sync_all_data.js) lo, không phải phía client.

export const useVguData = () => {
  /**
   * Lấy thông tin phòng từ Nuxt Content (content/Rooms/*.md).
   * @param {string} roomId  ví dụ "AD-247"
   */
  const getRoomInfo = async (roomId) => {
    try {
      const { queryContent } = await import('#imports')
      // LƯU Ý: @nuxt/content viết thường TẤT CẢ _path, nên content/Rooms -> /rooms.
      // queryContent('Rooms') (chữ hoa) KHÔNG khớp -> luôn null (đây là lý do tên
      // phòng không hiện). Lọc theo trường room_id (duy nhất ở file phòng) để
      // không phụ thuộc hoa/thường của thư mục.
      const room = await queryContent()
        .where({ room_id: roomId })
        .findOne()
      // Chuẩn hoá về field name mà RoomDetailPanel.vue mong đợi (roomName,
      // buildingId, rawRoomType, area, capacity, rawStatus…) — trước đây hàm
      // này trả thẳng bản ghi thô (name, building_id, room_type, area_m2…),
      // không khớp field RoomDetailPanel đọc, nên panel luôn hiện "N/A".
      return room ? { ...normalizeRoom(room), roomFunction: '' } : null
    } catch (error) {
      console.error(`[useVguData] Không lấy được thông tin phòng ${roomId}:`, error)
      return null
    }
  }

  /**
   * Lấy danh sách thiết bị đặt trong phòng (content/equipment/**).
   * Query cả cây /equipment rồi lọc theo location.room_id để không phụ thuộc
   * vào phân biệt hoa/thường của thư mục con "Equipment".
   * @param {string} roomId
   */
  const getRoomEquipment = async (roomId) => {
    try {
      const { queryContent } = await import('#imports')
      const equipments = await queryContent('equipment')
        .where({ 'location.room_id': roomId })
        .find()
      return equipments || []
    } catch (error) {
      console.error(`[useVguData] Không lấy được thiết bị của ${roomId}:`, error)
      return []
    }
  }

  /**
   * Alias của getRoomEquipment — tên gọi mà EquipmentSidePanel.vue (trước đây là
   * MachineViewerModal.vue) mong đợi. Trả về danh sách bản ghi thiết bị thô
   * (content/equipment/**), để EquipmentSidePanel tự chuẩn hoá qua normalizeMachine().
   * @param {string} roomId
   */
  const getEquipmentListByRoom = async (roomId) => getRoomEquipment(roomId)

  /**
   * Lấy chi tiết đầy đủ 1 thiết bị theo id (trường `id` trong frontmatter,
   * ví dụ "spectrometer-01"), dùng khi EquipmentSidePanel mở view chi tiết.
   * @param {string} equipmentId
   */
  const getEquipmentInfo = async (equipmentId) => {
    try {
      const { queryContent } = await import('#imports')
      const equipment = await queryContent('equipment')
        .where({ id: equipmentId })
        .findOne()
      return equipment || null
    } catch (error) {
      console.error(`[useVguData] Không lấy được chi tiết thiết bị ${equipmentId}:`, error)
      return null
    }
  }

  /**
   * Lấy danh sách phòng của 1 tầng thuộc 1 tòa (content/Rooms/*.md), CHUẨN HOÁ
   * field cho FloorPanel.vue dùng thẳng: id, roomNumber, roomName, roomType, status.
   * (Trước đây FloorPanel gọi hàm này nhưng composable chưa có -> luôn báo lỗi
   * "Không tải được dữ liệu phòng".)
   * @param {string} buildingId ví dụ "AD"
   * @param {string|number} floor ví dụ 3
   */
  const getRoomsByFloor = async (buildingId, floor) => {
    if (!buildingId || floor == null) return []
    try {
      const { queryContent } = await import('#imports')
      const floorNum = Number(floor)
      const rooms = await queryContent()
        .where({ building_id: buildingId, floor: floorNum })
        .find()
      return (rooms || []).map(normalizeRoom)
    } catch (error) {
      console.error(`[useVguData] Không lấy được danh sách phòng ${buildingId} tầng ${floor}:`, error)
      throw error
    }
  }

  /**
   * Tìm phòng theo từ khoá (room_id hoặc tên phòng), dùng cho ô tìm kiếm phòng
   * trên thanh điều hướng. Trả về danh sách rút gọn kèm buildingId/floor để
   * điều hướng bản đồ tới đúng phòng.
   * @param {string} query
   * @param {number} limit
   */
  const searchRooms = async (query, limit = 8) => {
    const q = (query || '').trim()
    if (!q) return []
    try {
      const { queryContent } = await import('#imports')
      const all = await queryContent().find()
      const qLower = q.toLowerCase()
      return (all || [])
        .filter(r => r.room_id)
        .filter(r =>
          String(r.room_id).toLowerCase().includes(qLower) ||
          String(r.name || '').toLowerCase().includes(qLower)
        )
        .slice(0, limit)
        .map(normalizeRoom)
    } catch (error) {
      console.error(`[useVguData] Không tìm được phòng với từ khoá "${q}":`, error)
      return []
    }
  }

  // Các nhóm phân loại phòng thật sự xuất hiện trong dữ liệu (room_type trong
  // content/Rooms/*.md). Giá trị "___" (chưa cập nhật) và các giá trị hiếm gặp
  // khác được gộp về "other" để không phá vỡ tab phân loại trên FloorPanel.
  const ROOM_TYPE_MAP = {
    'Administration': 'administration',
    'Laboratory': 'laboratory',
    'Workshop': 'workshop',
    'Teaching': 'teaching',
    'Other functions': 'other'
  }
  const normalizeRoomType = (raw) => ROOM_TYPE_MAP[raw] || 'other'

  const normalizeStatus = (raw) => {
    const s = (raw || '').toLowerCase()
    if (s === 'occupied' || s === 'active') return 'active'
    if (s === 'vacant') return 'inactive'
    return 'unknown'
  }

  // Chuẩn hoá 1 bản ghi phòng thô từ Nuxt Content về shape UI cần.
  const normalizeRoom = (r) => ({
    id: r.room_id,
    roomNumber: r.room_id,
    roomName: r.name || '',
    roomType: normalizeRoomType(r.room_type),
    rawRoomType: r.room_type || '',
    status: normalizeStatus(r.status),
    rawStatus: r.status || '',
    buildingId: r.building_id || null,
    floor: r.floor ?? null,
    department: Array.isArray(r.departments) ? r.departments.join(', ') : (r.departments || ''),
    area: r.area_m2 || '',
    capacity: r.capacity || '',
    occupants: r.head_of_lab?.name ? [r.head_of_lab.name] : []
  })

  return {
    getRoomInfo,
    getRoomEquipment,
    getEquipmentListByRoom,
    getEquipmentInfo,
    getRoomsByFloor,
    searchRooms
  }
}
