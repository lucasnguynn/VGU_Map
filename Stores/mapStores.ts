// stores/mapStore.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useMapStore = defineStore('map', () => {
  // Trạng thái (State)
  const rooms = ref([])
  const selectedRoom = ref(null)
  const mapCoordinates = ref({ lng: 106.666, lat: 11.111 }) // Tọa độ trung tâm VGU
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

  function focusOnRoom(roomInfo, coordinates) {
    selectedRoom.value = roomInfo
    if (coordinates) {
      mapCoordinates.value = coordinates
      mapZoom.value = 19 // Phóng to vào phòng
    }
  }

  function clearSelection() {
    selectedRoom.value = null
  }

  // Trả về các thuộc tính để dùng trong Component
  return { 
    rooms, 
    selectedRoom, 
    mapCoordinates, 
    mapZoom, 
    isLoading, 
    getRoomByNumber, 
    fetchRoomsData, 
    focusOnRoom, 
    clearSelection 
  }
})