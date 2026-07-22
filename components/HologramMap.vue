import { ref } from 'vue'

const isPanelOpen = ref(false)
const selectedRoomData = ref({})

const handleRoomClick = async (roomId) => {
  try {
    const roomData = await queryContent(`/rooms/${roomId.toLowerCase()}`).findOne()

    // Xử lý logic hiển thị ảnh: Nếu có 1 link dạng string, gom nó thành Array để Panel dễ xử lý
    let roomPhotos = [];
    if (roomData.image) {
      roomPhotos = Array.isArray(roomData.image) ? roomData.image : [roomData.image];
    }

    // Hàm tiện ích: Loại bỏ các dữ liệu rác (placeholder từ sheet) 
    const cleanData = (data) => {
      if (!data || data === '__' || data === '--' || data === 'Chưa cập nhật' || data === 'unknown') return '';
      return data;
    };

    // Ánh xạ (Mapping) từ file MD sang các Props của RoomDetailPanel
    selectedRoomData.value = {
      building: cleanData(roomData.building_id),        // Cột: building_id
      level: cleanData(roomData.floor),                 // Cột: floor
      name: cleanData(roomData.name) || roomId,         // Cột: name
      department: cleanData(roomData.departments),      // Cột: departments
      photos: roomPhotos,                               // Cột: image
      
      // Lấy thông tin người phụ trách từ object head_of_lab
      occupant: roomData.head_of_lab ? cleanData(roomData.head_of_lab.name) : '',
      position: roomData.head_of_lab && cleanData(roomData.head_of_lab.name) ? 'Room Incharge' : '',
      office: roomData.head_of_lab ? cleanData(roomData.head_of_lab.office) : '',
      email: roomData.head_of_lab ? cleanData(roomData.head_of_lab.email) : '',
      phone: '', // Sẽ cập nhật trong sheet sau
      
      // Do trong sheet không có cột 'description', mình sẽ ghép các thông tin lại với nhau
      description: `Phân loại: ${cleanData(roomData.room_type) || 'N/A'} | Diện tích: ${cleanData(roomData.area_m2) || 'N/A'} m2 | Sức chứa: ${cleanData(roomData.capacity) || 'N/A'}`,
      
      status: cleanData(roomData.status),               // Cột: status
      instruments: roomData.highlighted_equipment || [] // Cột: highlighted_equipment
    }
    
    // Mở Panel
    isPanelOpen.value = true

  } catch (error) {
    console.error(`Không tìm thấy dữ liệu cho phòng: ${roomId}`, error)
    // Fallback nếu không có file MD
    selectedRoomData.value = { name: roomId, description: 'Chưa có thông tin cập nhật cho phòng này.' }
    isPanelOpen.value = true
  }
}
