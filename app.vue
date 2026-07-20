<template>
  <div class="app-container">
    <!-- Cố lập luồng 3D chỉ chạy ở Client -->
    <ClientOnly fallback-tag="div" fallback-class="loading-overlay">
      <HologramMap 
        @room-selected="handleRoomSelected"
        @building-selected="handleBuildingSelected"
      />
    </ClientOnly>

    <!-- Header HUD -->
    <header class="app-header">
      <div class="header-content">
        <!-- Chuyển sang dùng ảnh WebP tối ưu thay vì SVG base64 -->
        <img src="/images/vgu-logo-optimized.webp" class="header-logo" alt="VGU Logo" />
        <h1 class="header-title">
          VGU <span class="title-accent">MSI</span> Holographic Map
        </h1>
      </div>
      <div class="sys-status">
        <span class="pulse-dot"></span>
        <span>SYSTEM: ONLINE</span>
      </div>
    </header>

    <div class="hud-bar">
      <div class="hud-context-panel">
        <span class="pulse-dot"></span>
        <span id="hud-context-title">{{ contextTitle }}</span>
      </div>
    </div>

    <!-- Panel thông tin -->
    <transition name="cyber-slide">
      <RoomDetailPanel 
        v-if="selectedRoom"
        :room-id="selectedRoom"
        :building-id="selectedBuilding"
        @close="closePanel"
      />
    </transition>

    <!-- Loading State -->
    <transition name="fade">
      <div v-if="isLoading" class="loading-overlay">
        <div class="cyber-loader"></div>
        <p>INITIALIZING HOLOGRAPHIC SYSTEM...</p>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useVguData } from '~/composables/useVguData'

// Bỏ defineAsyncComponent đi, ClientOnly sẽ tự động gánh vác luồng tải
import HologramMap from '~/components/HologramMap.vue'
import RoomDetailPanel from '~/components/RoomDetailPanel.vue'

const isLoading = ref(true)
const selectedRoom = ref(null)
const selectedBuilding = ref(null)
const selectedFloor = ref(null)
const vguData = ref(null)

const { syncAll, getRoomInfo } = useVguData()

const contextTitle = computed(() => {
  if (!selectedBuilding.value) return 'FOCUS: VGU CAMPUS OVERVIEW'
  if (selectedRoom.value) return `FOCUS: ${selectedRoom.value}`
  return `BUILDING: ${selectedBuilding.value.toUpperCase()} | FLOOR ${selectedFloor.value || '-'}`
})

const handleRoomSelected = async ({ roomId, buildingId, floor }) => {
  selectedRoom.value = roomId
  selectedBuilding.value = buildingId
  selectedFloor.value = floor
  const roomInfo = await getRoomInfo(roomId)
}

const handleBuildingSelected = ({ buildingId, floor }) => {
  selectedBuilding.value = buildingId
  selectedFloor.value = floor
  selectedRoom.value = null
}

const closePanel = () => {
  selectedRoom.value = null
}

onMounted(async () => {
  try {
    vguData.value = await syncAll()
  } catch (error) {
    console.error('[System Error] Failed to init data:', error)
  } finally {
    isLoading.value = false
  }
})
</script>

<style scoped>
/* CSS của bạn ở đây giữ nguyên vì nó đã chuẩn UX/UI */
</style>
