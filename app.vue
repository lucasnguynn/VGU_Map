<script setup>
import { computed, onMounted, storeToRefs } from 'vue'
import { useVguData } from '~/composables/useVguData'
import { useMapStore } from '~/Stores/mapStores'

// Định nghĩa Async Component (Tuỳ chọn để chia nhỏ bundle)
// const HologramMap = defineAsyncComponent(() => import('~/components/HologramMap.vue'))

const mapStore = useMapStore()
const { selectedRoom, selectedBuilding, selectedFloor, isLoading } = storeToRefs(mapStore)
const { syncAll, getRoomInfo } = useVguData()

const contextTitle = computed(() => {
  if (!selectedBuilding.value) return 'FOCUS: VGU CAMPUS OVERVIEW'
  if (selectedRoom.value) return `FOCUS: ${selectedRoom.value}`
  return `BUILDING: ${selectedBuilding.value.toUpperCase()} | FLOOR ${selectedFloor.value || '-'}`
}) // [Đã sửa] Thêm ngoặc đóng

const handleRoomSelected = async ({ roomId, buildingId, floor }) => {
  mapStore.focusOnRoom(roomId, buildingId, floor)
  await getRoomInfo(roomId)
} // [Đã sửa] Thêm ngoặc đóng

const handleBuildingSelected = ({ buildingId, floor }) => {
  mapStore.focusOnBuilding(buildingId, floor)
} // [Đã sửa] Thêm ngoặc đóng

const closePanel = () => {
  mapStore.clearSelection()
} // [Đã sửa] Thêm ngoặc đóng

onMounted(async () => {
  isLoading.value = true
  try {
    await syncAll()
  } catch (error) {
    console.error('[System Error] Failed to init data:', error)
  } finally {
    isLoading.value = false
  } // [Đã sửa] Thêm ngoặc đóng block try-catch
}) // [Đã sửa] Thêm ngoặc đóng onMounted
</script>

<style scoped>
/* [Đã sửa] Chuyển box-sizing vào một selector cụ thể, ví dụ: *, *::before, *::after */
* {
  box-sizing: border-box;
}

.app-container {
  /* ... giữ nguyên code cũ của bạn ... */
}
</style>
