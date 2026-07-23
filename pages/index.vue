<template>
  <div class="map-page">
    <!-- Luồng 3D chỉ chạy ở client -->
    <ClientOnly fallback-tag="div" fallback-class="loading-overlay">
      <HologramMap
        @room-selected="handleRoomSelected"
        @building-selected="handleBuildingSelected"
        @floor-selected="handleFloorSelected"
        @ready="onMapReady"
      />
    </ClientOnly>

    <!-- Header HUD -->
    <header class="app-header">
      <div class="header-content">
        <img src="/VGU-Logo.png" class="header-logo" alt="Logo VGU" />
        <h1 class="header-title">
          <span class="title-accent">VGU</span> MAP
        </h1>
      </div>
      <div class="sys-status" role="status" aria-live="polite">
        <span class="pulse-dot" aria-hidden="true"></span>
        <span>SYSTEM: ONLINE</span>
      </div>
    </header>

    <div class="hud-bar">
      <div class="hud-context-panel">
        <span class="pulse-dot" aria-hidden="true"></span>
        <span>{{ contextTitle }}</span>
      </div>
    </div>

    <!-- Panel thông tin phòng -->
    <transition name="cyber-slide">
      <RoomDetailPanel
        v-if="selectedRoom"
        :room-id="selectedRoom"
        :building-id="selectedBuilding"
        @close="closePanel"
      />
    </transition>

    <!-- Loading overlay: tắt khi bản đồ báo 'ready' (có timeout an toàn) -->
    <transition name="fade">
      <div v-if="isLoading" class="loading-overlay">
        <div class="cyber-loader" aria-hidden="true"></div>
        <p>ĐANG KHỞI TẠO HỆ THỐNG BẢN ĐỒ…</p>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useMapStore } from '~/Stores/mapStores'
import HologramMap from '~/components/HologramMap.vue'
import RoomDetailPanel from '~/components/RoomDetailPanel.vue'

const mapStore = useMapStore()
const { selectedRoom, selectedBuilding, selectedFloor, isLoading } = storeToRefs(mapStore)

const contextTitle = computed(() => {
  if (!selectedBuilding.value) return 'TIÊU ĐIỂM: TOÀN CẢNH KHUÔN VIÊN VGU'
  if (selectedRoom.value) return `PHÒNG: ${selectedRoom.value}`
  return `TOÀ: ${String(selectedBuilding.value).toUpperCase()} · TẦNG ${selectedFloor.value ?? '-'}`
})

const handleRoomSelected = ({ roomId, buildingId, floor }) => {
  mapStore.focusOnRoom(roomId, buildingId, floor)
}
const handleBuildingSelected = ({ buildingId, floor }) => {
  mapStore.focusOnBuilding(buildingId, floor)
}
const handleFloorSelected = ({ floor }) => {
  mapStore.setFloor(floor)
}
const closePanel = () => mapStore.clearSelection()

const onMapReady = () => { isLoading.value = false }

// Đóng panel bằng phím Esc
const onKey = (e) => { if (e.key === 'Escape' && selectedRoom.value) closePanel() }

let safety
onMounted(() => {
  isLoading.value = true
  // Nếu vì lý do nào đó bản đồ không phát 'ready', vẫn ẩn overlay sau 6s.
  safety = setTimeout(() => { isLoading.value = false }, 6000)
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  clearTimeout(safety)
  window.removeEventListener('keydown', onKey)
})
</script>

<style scoped>
.map-page {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

/* Header HUD */
.app-header {
  position: absolute;
  top: 0; left: 0; right: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  background: linear-gradient(180deg, rgba(5, 10, 15, 0.85) 0%, rgba(5, 10, 15, 0) 100%);
  pointer-events: none;
}
.header-content { display: flex; align-items: center; gap: 14px; }
.header-logo { height: 36px; width: auto; filter: drop-shadow(0 0 6px rgba(0, 255, 204, 0.4)); }
.header-title {
  font-family: 'Be Vietnam Pro', sans-serif;
  font-size: 18px; font-weight: 600; color: #fff; letter-spacing: 0.5px; margin: 0;
}
.title-accent { color: #EF5A24; }
.sys-status {
  display: flex; align-items: center; gap: 8px;
  font-size: 11px; letter-spacing: 1px; color: #00ffcc;
}
.pulse-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #00ffcc; box-shadow: 0 0 8px #00ffcc;
  animation: pulse 1.6s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.7); }
}

/* HUD Bar */
.hud-bar { position: absolute; top: 68px; left: 24px; z-index: 20; pointer-events: none; }
.hud-context-panel {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 16px;
  background: rgba(15, 30, 54, 0.75);
  border: 1px solid rgba(0, 255, 204, 0.25);
  border-radius: 4px;
  backdrop-filter: blur(8px);
  font-family: 'Space Mono', monospace;
  font-size: 12px; letter-spacing: 0.5px; color: #00ffcc;
}

/* Loading overlay */
.loading-overlay {
  position: absolute; inset: 0; z-index: 100;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 20px; background: #05080d; color: #00ffcc;
  font-family: 'Space Mono', monospace; font-size: 13px; letter-spacing: 1px;
}
.cyber-loader {
  width: 56px; height: 56px;
  border: 3px solid rgba(0, 255, 204, 0.2); border-top-color: #00ffcc;
  border-radius: 50%; animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.cyber-slide-enter-active, .cyber-slide-leave-active {
  transition: transform 0.35s ease, opacity 0.35s ease;
}
.cyber-slide-enter-from, .cyber-slide-leave-to { transform: translateX(30px); opacity: 0; }

/* Tôn trọng người dùng tắt hiệu ứng chuyển động */
@media (prefers-reduced-motion: reduce) {
  .pulse-dot, .cyber-loader { animation: none; }
  .fade-enter-active, .fade-leave-active,
  .cyber-slide-enter-active, .cyber-slide-leave-active { transition: none; }
}

@media (max-width: 640px) {
  .app-header { padding: 10px 14px; }
  .header-title { font-size: 16px; }
  .hud-bar { top: 58px; left: 14px; }
  .hud-context-panel { font-size: 11px; padding: 6px 12px; }
}
</style>
