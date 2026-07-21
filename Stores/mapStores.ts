// stores/mapStore.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useMapStore = defineStore('map', () => {
  // Trạng thái (State)
  const rooms = ref([])
  const selectedRoom = ref(null)
  const selectedBuilding = ref(null)
  const selectedFloor = ref(null)
  const mapCoordinates = ref({ lng: 106.6155, lat: 11.1083 }) // Tọa độ trung tâm VGU (khớp initialCenter trong HologramMap.vue)
  const mapZoom = ref(16)
  const isLoading = ref(false)

  // Getters (Tính toán dữ liệu phái sinh)
  const getRoomByNumber = computed(() => {
    return (roomNumber) => rooms.value.find(room => room.room_number === roomNumber)
  })

  // Hành động (Actions)
  async function fetchRoomsData() {
    isLoading.value = true
    try {
      // URL của Google Apps Script sau khi bạn đã sửa lỗi Code.gs và Deploy lại
      const apiUrl = 'YOUR_GOOGLE_SCRIPT_WEB_APP_URL'
      const response = await fetch(apiUrl)
      const json = await response.json()
      
      if (json.status === 'success') {
        rooms.value = json.data
      }
    } catch (error) {
      console.error('Lỗi khi tải dữ liệu phòng:', error)
    } finally {
      isLoading.value = false
    }
  }

  function focusOnRoom(roomId, buildingId, floor) {
    selectedRoom.value = roomId
    selectedBuilding.value = buildingId
    selectedFloor.value = floor
  }

  function focusOnBuilding(buildingId, floor) {
    selectedBuilding.value = buildingId
    selectedFloor.value = floor
    selectedRoom.value = null
  }

  // Chỉ đổi tầng đang xem, KHÔNG đụng tới phòng/tòa đang chọn
  // (dùng khi người dùng bấm nút tầng trên thang máy mà panel phòng vẫn mở)
  function setFloor(floor) {
    selectedFloor.value = floor
  }

  function clearSelection() {
    selectedRoom.value = null
  }

  // Trả về các thuộc tính để dùng trong Component
  return { 
    rooms, 
    selectedRoom, 
    selectedBuilding,
    selectedFloor,
    mapCoordinates, 
    mapZoom, 
    isLoading, 
    getRoomByNumber, 
    fetchRoomsData, 
    focusOnRoom, 
    focusOnBuilding,
    setFloor,
    clearSelection 
  }
})

