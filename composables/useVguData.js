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
      return room || null
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

  return { getRoomInfo, getRoomEquipment }
}
