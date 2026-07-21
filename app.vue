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
        <img src="/VGU-Logo.png" class="header-logo" alt="VGU Logo" />
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
import { computed, onMounted, storeToRefs } from 'vue'
import { useVguData } from '~/composables/useVguData'
import { useMapStore } from '~/Stores/mapStores'

// Bỏ defineAsyncComponent đi, ClientOnly sẽ tự động gánh vác luồng tải
import HologramMap from '~/components/HologramMap.vue'
import RoomDetailPanel from '~/components/RoomDetailPanel.vue'

// Dùng Pinia store làm nguồn state chính thay vì ref() cục bộ (sửa bug: mapStores.ts
// trước đây được viết sẵn nhưng chưa từng được import/dùng ở đâu)
const mapStore = useMapStore()
const { selectedRoom, selectedBuilding, selectedFloor, isLoading } = storeToRefs(mapStore)

const { syncAll, getRoomInfo } = useVguData()

const contextTitle = computed(() => {
  if (!selectedBuilding.value) return 'FOCUS: VGU CAMPUS OVERVIEW'
  if (selectedRoom.value) return `FOCUS: ${selectedRoom.value}`
  return `BUILDING: ${selectedBuilding.value.toUpperCase()} | FLOOR ${selectedFloor.value || '-'}`
})

const handleRoomSelected = async ({ roomId, buildingId, floor }) => {
  mapStore.focusOnRoom(roomId, buildingId, floor)
  await getRoomInfo(roomId)
}

const handleBuildingSelected = ({ buildingId, floor }) => {
  mapStore.focusOnBuilding(buildingId, floor)
}

const closePanel = () => {
  mapStore.clearSelection()
}

onMounted(async () => {
  isLoading.value = true
  try {
    await syncAll()
  } catch (error) {
    console.error('[System Error] Failed to init data:', error)
  } finally {
    isLoading.value = false
  }
})
</script>

<style scoped>
* {
  box-sizing: border-box;
}

.app-container {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #05080d;
  font-family: 'Space Mono', monospace;
  color: #e0e0e0;
}

/* Header HUD */
.app-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  background: linear-gradient(180deg, rgba(5, 10, 15, 0.85) 0%, rgba(5, 10, 15, 0) 100%);
  pointer-events: none;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 14px;
}

.header-logo {
  height: 36px;
  width: auto;
  filter: drop-shadow(0 0 6px rgba(0, 255, 204, 0.4));
}

.header-title {
  font-family: 'Be Vietnam Pro', sans-serif;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  letter-spacing: 0.5px;
  margin: 0;
}

.title-accent {
  color: #EF5A24;
}

.sys-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  letter-spacing: 1px;
  color: #00ffcc;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #00ffcc;
  box-shadow: 0 0 8px #00ffcc;
  animation: pulse 1.6s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.7); }
}

/* HUD Bar */
.hud-bar {
  position: absolute;
  top: 68px;
  left: 24px;
  z-index: 20;
  pointer-events: none;
}

.hud-context-panel {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  background: rgba(15, 30, 54, 0.75);
  border: 1px solid rgba(0, 255, 204, 0.25);
  border-radius: 4px;
  backdrop-filter: blur(8px);
  font-size: 12px;
  letter-spacing: 0.5px;
  color: #00ffcc;
}

/* Loading overlay */
.loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  background: #05080d;
  color: #00ffcc;
  font-size: 13px;
  letter-spacing: 1px;
}

.cyber-loader {
  width: 56px;
  height: 56px;
  border: 3px solid rgba(0, 255, 204, 0.2);
  border-top-color: #00ffcc;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.cyber-slide-enter-active,
.cyber-slide-leave-active {
  transition: transform 0.35s ease, opacity 0.35s ease;
}

.cyber-slide-enter-from,
.cyber-slide-leave-to {
  transform: translateX(30px);
  opacity: 0;
}
</style>
