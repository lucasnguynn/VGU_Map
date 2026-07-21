// Stores/mapStores.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// Store chỉ giữ TRẠNG THÁI LỰA CHỌN (toà / tầng / phòng) + cờ loading.
// Dữ liệu phòng do HologramMap.vue tự nạp từ geojson; panel chi tiết do
// useVguData() nạp từ Nuxt Content. Đã bỏ các state/action chết trước đây
// (rooms, mapCoordinates, mapZoom, getRoomByNumber, fetchRoomsData với URL
// placeholder 'YOUR_GOOGLE_SCRIPT_WEB_APP_URL' — không nơi nào gọi tới).
export const useMapStore = defineStore('map', () => {
  const selectedRoom = ref<string | null>(null)
  const selectedBuilding = ref<string | null>(null)
  const selectedFloor = ref<number | null>(null)
  const isLoading = ref(false)

  const hasSelection = computed(() => !!selectedBuilding.value || !!selectedRoom.value)

  function focusOnRoom(roomId: string, buildingId: string | null, floor: number | null) {
    selectedRoom.value = roomId
    if (buildingId) selectedBuilding.value = buildingId
    if (floor != null) selectedFloor.value = floor
  }

  function focusOnBuilding(buildingId: string | null, floor: number | null) {
    selectedBuilding.value = buildingId
    selectedFloor.value = floor
    selectedRoom.value = null
  }

  // Chỉ đổi tầng đang xem, KHÔNG đụng tới phòng/toà đang chọn.
  function setFloor(floor: number | null) {
    selectedFloor.value = floor
  }

  // Đóng panel phòng (giữ nguyên toà/tầng đang xem).
  function clearSelection() {
    selectedRoom.value = null
  }

  return {
    selectedRoom,
    selectedBuilding,
    selectedFloor,
    isLoading,
    hasSelection,
    focusOnRoom,
    focusOnBuilding,
    setFloor,
    clearSelection
  }
})
