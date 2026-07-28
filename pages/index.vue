<template>
  <div class="map-page">
    <!-- Luồng 3D chỉ chạy ở client -->
    <ClientOnly fallback-tag="div" fallback-class="loading-overlay">
      <HologramMap
        ref="hologramMapRef"
        @room-selected="handleRoomSelected"
        @building-selected="handleBuildingSelected"
        @floor-selected="handleFloorSelected"
        @equipment-selected="handleEquipmentSelected"
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
        <span>ĐANG TẢI BẢN ĐỒ…</span>
      </div>
    </header>

    <div class="hud-bar">
      <div class="hud-context-panel">
        <span class="pulse-dot" aria-hidden="true"></span>
        <span>{{ contextTitle }}</span>
      </div>

      <!-- Nút mở Buildings Dashboard Panel -->
      <button
        class="buildings-toggle-btn"
        :class="{ active: showBuildingsPanel }"
        @click="showBuildingsPanel = !showBuildingsPanel"
        :aria-expanded="showBuildingsPanel"
        aria-controls="buildings-dashboard-panel"
        title="Xem danh sách toà nhà"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 21h18" /><path d="M5 21V6a1 1 0 0 1 1-1h5v16" />
          <path d="M15 21V10a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v11" />
          <path d="M9 8h.01" /><path d="M9 12h.01" /><path d="M9 16h.01" />
        </svg>
        <span class="btn-label">Toà nhà</span>
      </button>
    </div>

    <!-- Panel danh sách phòng theo tầng (bên trái) -->
    <transition name="cyber-slide-left">
      <FloorPanel
        v-if="selectedBuilding && selectedFloor != null"
        :building-id="selectedBuilding"
        :cluster-label="String(selectedBuilding).toUpperCase()"
        :floor="selectedFloor"
        :selected-room-id="selectedRoom"
        @select-room="handleFloorRoomSelect"
      />
    </transition>

    <!-- Panel thông tin phòng (bên phải) -->
    <transition name="cyber-slide">
      <RoomDetailPanel
        v-if="selectedRoom"
        ref="roomDetailPanelRef"
        :room-id="selectedRoom"
        :building-id="selectedBuilding"
        @close="closePanel"
      />
    </transition>

    <!-- Buildings Dashboard Panel (overlay trên bản đồ) -->
    <BuildingsDashboardPanel
      v-model="showBuildingsPanel"
      @select-building="handleBuildingFromPanel"
    />

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
import { computed, ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useMapStore } from '~/Stores/mapStores'
import HologramMap from '~/components/HologramMap.vue'
import RoomDetailPanel from '~/components/RoomDetailPanel.vue'
import FloorPanel from '~/components/FloorPanel.vue'
import BuildingsDashboardPanel from '~/components/BuildingsDashboardPanel.vue'

const route = useRoute()
const router = useRouter()
const mapStore = useMapStore()
const { selectedRoom, selectedBuilding, selectedFloor, isLoading } = storeToRefs(mapStore)
const hologramMapRef = ref(null)
const roomDetailPanelRef = ref(null)

// Trạng thái hiển thị Buildings Dashboard Panel
const showBuildingsPanel = ref(false)

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

// Người dùng chọn toà từ BuildingsDashboardPanel -> bay camera vào toà đó.
// Panel đã tự đóng trước khi emit, nên chỉ cần gọi selectBuilding() ở đây.
const handleBuildingFromPanel = async (buildingId) => {
  await nextTick()
  if (hologramMapRef.value?.selectBuilding) {
    hologramMapRef.value.selectBuilding(String(buildingId))
  } else {
    // Dự phòng: nếu map chưa sẵn sàng, cập nhật store để FloorPanel hiện đúng toà
    mapStore.focusOnBuilding(String(buildingId), 1)
  }
}
// Nhấn phòng trong FloorPanel -> bay camera zoom vào đúng phòng trên map
// (giống hệt bấm thẳng vào phòng), đồng thời mở RoomDetailPanel bên phải.
// goToRoom() bên trong HologramMap tự emit 'room-selected' -> handleRoomSelected
// ở trên sẽ cập nhật store, nên không cần gọi mapStore.focusOnRoom ở đây nữa.
const handleFloorRoomSelect = ({ roomId, buildingId }) => {
  const bId = buildingId ?? selectedBuilding.value
  if (hologramMapRef.value?.goToRoom) {
    hologramMapRef.value.goToRoom({ id: roomId, buildingId: bId, floor: selectedFloor.value })
  } else {
    // Dự phòng nếu ref chưa sẵn sàng (ví dụ map chưa mount xong)
    mapStore.focusOnRoom(roomId, bId, selectedFloor.value)
  }
}

const onMapReady = async () => {
  isLoading.value = false
  // Đọc ?building=ID từ URL (được buildings.vue bơm vào khi người dùng bấm
  // "Vào toà nhà"). Gọi selectBuilding() ngay sau khi map báo ready để
  // camera fly thẳng vào toà đó. Sau đó xoá query khỏi URL (replace thay
  // push để không tạo thêm entry lịch sử điều hướng).
  const targetBuilding = route.query.building
  if (targetBuilding && hologramMapRef.value?.selectBuilding) {
    await nextTick()
    hologramMapRef.value.selectBuilding(String(targetBuilding))
    router.replace({ path: '/', query: {} })
  }
}

// Bấm vào 1 khối thiết bị trên map (layer vgu-equipment-fill trong HologramMap)
// -> đảm bảo đúng phòng đang được chọn (bấm thiết bị thường xảy ra khi phòng
// đã mở sẵn, nhưng vẫn phòng hờ trường hợp khác), rồi mở thẳng
// EquipmentSidePanel ở chế độ chi tiết máy đó — bỏ qua nút
// "VIEW ALL MACHINES..." + bước chọn từ danh sách.
const handleEquipmentSelected = async ({ roomId, buildingId, properties }) => {
  if (roomId && selectedRoom.value !== roomId) {
    mapStore.focusOnRoom(roomId, buildingId ?? properties?.building_id ?? selectedBuilding.value, properties?.floor ?? selectedFloor.value)
    await nextTick()
  }
  roomDetailPanelRef.value?.openEquipment(properties)
}

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
.hud-bar {
  position: absolute;
  top: 68px;
  left: 24px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}
.hud-bar > * { pointer-events: auto; }

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

/* Nút mở Buildings Dashboard Panel */
.buildings-toggle-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 14px;
  background: rgba(15, 30, 54, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 4px;
  backdrop-filter: blur(8px);
  font-family: 'Space Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.5px;
  color: #B3BFCD;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background-color 0.15s;
  white-space: nowrap;
}
.buildings-toggle-btn:hover {
  color: #fff;
  border-color: rgba(0, 255, 204, 0.5);
  background: rgba(15, 30, 54, 0.95);
}
.buildings-toggle-btn.active {
  color: #EF5A24;
  border-color: #EF5A24;
  background: rgba(239, 90, 36, 0.1);
}
.buildings-toggle-btn:focus-visible { outline: 2px solid #00ffcc; outline-offset: 2px; }
.btn-label { text-transform: uppercase; }
@media (max-width: 480px) { .btn-label { display: none; } }

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
.cyber-slide-left-enter-active, .cyber-slide-left-leave-active {
  transition: transform 0.35s ease, opacity 0.35s ease;
}
.cyber-slide-left-enter-from, .cyber-slide-left-leave-to { transform: translateX(-30px); opacity: 0; }

/* Tôn trọng người dùng tắt hiệu ứng chuyển động */
@media (prefers-reduced-motion: reduce) {
  .pulse-dot, .cyber-loader { animation: none; }
  .fade-enter-active, .fade-leave-active,
  .cyber-slide-enter-active, .cyber-slide-leave-active { transition: none; }
}

@media (max-width: 640px) {
  .app-header { padding: 10px 14px; }
  .header-title { font-size: 16px; }
  .hud-bar { top: 58px; left: 14px; gap: 6px; }
  .hud-context-panel { font-size: 11px; padding: 6px 12px; }
  .buildings-toggle-btn { padding: 6px 10px; font-size: 10px; }
}

.shell {
  background: linear-gradient(180deg, var(--surface-panel) 0%, var(--surface-root) 100%);
  border-bottom: 1px solid var(--line-soft);
}

.brand-mark {
  filter: none;
  box-shadow: none;
}

.page-title {
  color: var(--ink-strong);
  font-family: var(--type-main);
  text-transform: none;
  letter-spacing: 0;
}

.page-title em {
  color: var(--brand-accent);
  font-style: normal;
}

.quick-indicator {
  background: var(--brand-accent);
}

.quick-indicator::after {
  background: var(--brand-accent);
}

.map-hud {
  background: var(--surface-panel);
  border: 1px solid var(--line-soft);
}

.map-hud__accent {
  color: var(--brand-accent);
}

.map-frame {
  background: var(--surface-root);
}

.loading-copy {
  color: var(--ink-strong);
}
</style>
