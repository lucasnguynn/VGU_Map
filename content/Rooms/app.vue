<!-- app.vue -->
<template>
  <div class="app-container">
    <!-- Nền tảng bản đồ MapLibre -->
    <HologramMap 
      @room-selected="handleRoomSelected"
      @building-selected="handleBuildingSelected"
    />

    <!-- Header HUD -->
    <header class="app-header">
      <div class="header-content">
        <img src="/VGU-Full-Color-logo-05-_1_.svg" class="header-logo" alt="VGU Logo" />
        <h1 class="header-title">
          VGU <span class="title-accent">MSI</span> Holographic Map
        </h1>
      </div>
      <div class="sys-status">
        <span class="pulse-dot"></span>
        <span>SYSTEM: ONLINE</span>
      </div>
    </header>

    <!-- Context Bar - Hiển thị thông tin ngữ cảnh -->
    <div class="hud-bar">
      <div class="hud-context-panel">
        <span class="pulse-dot"></span>
        <span id="hud-context-title">{{ contextTitle }}</span>
      </div>
    </div>

    <!-- Panel thông tin phòng (Slide-in từ phải) -->
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

// Components
const HologramMap = defineAsyncComponent(() => import('~/components/HologramMap.vue'))
const RoomDetailPanel = defineAsyncComponent(() => import('~/components/RoomDetailPanel.vue'))

// State Management
const isLoading = ref(true)
const selectedRoom = ref(null)
const selectedBuilding = ref(null)
const selectedFloor = ref(null)
const vguData = ref(null)

// Composables
const { syncAll, getRoomInfo, getRoomEquipment } = useVguData()

// Context Title dựa trên trạng thái
const contextTitle = computed(() => {
  if (!selectedBuilding.value) {
    return 'FOCUS: VGU CAMPUS OVERVIEW'
  }
  if (selectedRoom.value) {
    return `FOCUS: ${selectedRoom.value}`
  }
  return `BUILDING: ${selectedBuilding.value.toUpperCase()} | FLOOR ${selectedFloor.value || '-'}`
})

// Event Handlers
const handleRoomSelected = async ({ roomId, buildingId, floor }) => {
  selectedRoom.value = roomId
  selectedBuilding.value = buildingId
  selectedFloor.value = floor
  
  // Load room data từ Nuxt Content
  const roomInfo = await getRoomInfo(roomId)
  console.log('[app.vue] Room selected:', roomId, roomInfo)
}

const handleBuildingSelected = ({ buildingId, floor }) => {
  selectedBuilding.value = buildingId
  selectedFloor.value = floor
  selectedRoom.value = null
}

const closePanel = () => {
  selectedRoom.value = null
}

// Initialize App
onMounted(async () => {
  try {
    // Sync dữ liệu ban đầu
    vguData.value = await syncAll()
    console.log('[app.vue] Initial data sync completed')
  } catch (error) {
    console.error('[app.vue] Failed to initialize:', error)
  } finally {
    isLoading.value = false
  }
})
</script>

<style scoped>
.app-container {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #070A12;
  font-family: 'Be Vietnam Pro', sans-serif;
  color: #00ffcc;
}

/* Header Styles */
.app-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 30;
  padding: 15px 25px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(180deg, rgba(7, 10, 18, 0.95) 0%, rgba(7, 10, 18, 0) 100%);
}

.header-content {
  display: flex;
  align-items: center;
  gap: 15px;
}

.header-logo {
  height: 40px;
  width: auto;
}

.header-title {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 1px;
  color: white;
}

.title-accent {
  color: #EF5A24;
  font-weight: 700;
}

.sys-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Space Mono', monospace;
  font-size: 11px;
  color: #00ffcc;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #00ffcc;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}

/* HUD Bar */
.hud-bar {
  position: absolute;
  top: 80px;
  left: 20px;
  z-index: 20;
}

.hud-context-panel {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 20px;
  background: rgba(15, 30, 54, 0.85);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(239, 90, 36, 0.3);
  border-radius: 4px;
  font-family: 'Space Mono', monospace;
  font-size: 12px;
  color: #EF5A24;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
}

/* Loading Overlay */
.loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: rgba(7, 10, 18, 0.95);
  gap: 20px;
}

.loading-overlay p {
  font-family: 'Space Mono', monospace;
  font-size: 14px;
  letter-spacing: 2px;
  color: #00ffcc;
}

.cyber-loader {
  width: 60px;
  height: 60px;
  border: 3px solid rgba(239, 90, 36, 0.3);
  border-top-color: #EF5A24;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Transitions */
.cyber-slide-enter-active,
.cyber-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.cyber-slide-enter-from,
.cyber-slide-leave-to {
  transform: translateX(100%) skewX(-5deg);
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
