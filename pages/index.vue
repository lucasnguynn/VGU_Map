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

    <div class="hud-bar">
      <div class="hud-context-panel">
        <span class="pulse-dot" aria-hidden="true"></span>
        <span>{{ contextTitle }}</span>
      </div>
    </div>

    <!-- Panel danh sách phòng theo tầng.
         :force-collapse drives auto-collapse when RoomDetailPanel opens.
         User can still manually toggle via the panel's own toggle-btn. -->
    <transition name="floor-panel-enter">
      <FloorPanel
        v-if="selectedBuilding && selectedFloor != null"
        :building-id="selectedBuilding"
        :cluster-label="String(selectedBuilding).toUpperCase()"
        :floor="selectedFloor"
        :selected-room-id="selectedRoom"
        :force-collapse="!!selectedRoom"
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

    <!-- Buildings Dashboard Panel (overlay trên bản đồ).
         Auto-collapses to tab when a building/floor/room is selected. -->
    <BuildingsDashboardPanel
      v-model="showBuildingsPanel"
      :force-collapse="!!selectedBuilding"
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
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useMapStore } from '~/Stores/mapStores'
import { usePanelLayout } from '~/composables/usePanelLayout'
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

// Panel layout orchestration
const { setPanelState } = usePanelLayout()

// BuildingsDashboardPanel is always mounted; its visibility is driven by v-model.
const showBuildingsPanel = ref(true)

// ─── Panel Stage Auto-collapse ────────────────────────────────────────────────
// Stage 0: nothing selected   → BuildingsPanel OPEN,  FloorPanel hidden,    RoomDetail hidden
// Stage 1: building selected  → BuildingsPanel COLLAPSED, FloorPanel OPEN,  RoomDetail hidden
// Stage 2: room selected      → BuildingsPanel COLLAPSED, FloorPanel COLLAPSED, RoomDetail OPEN
//
// We drive this via the :force-collapse props passed into the child panels
// (handled in template above), and by notifying usePanelLayout so it updates
// --panels-left-width correctly for the HUD bar.

watch(selectedRoom, (roomId) => {
  // Tell usePanelLayout whether RoomDetailPanel is visible so it can collapse
  // --panels-left-width to tab-only width, giving the map space on both sides.
  setPanelState({ roomDetailVisible: !!roomId })
}, { immediate: true })

watch(selectedBuilding, (buildingId) => {
  // When a building is first selected (and no room yet), keep RoomDetail closed
  // and tell layout the FloorPanel will appear.
  if (!buildingId) {
    setPanelState({ roomDetailVisible: false })
  }
}, { immediate: true })
// ─────────────────────────────────────────────────────────────────────────────

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
const closePanel = () => {
  mapStore.clearSelection()
  // clearSelection() only nulls selectedRoom, keeping building/floor intact
  // so FloorPanel stays open. Layout watcher above will re-expand left panels.
}

// Người dùng chọn toà từ BuildingsDashboardPanel -> bay camera vào toà đó.
const handleBuildingFromPanel = async (buildingId) => {
  await nextTick()
  if (hologramMapRef.value?.selectBuilding) {
    hologramMapRef.value.selectBuilding(String(buildingId))
  } else {
    mapStore.focusOnBuilding(String(buildingId), 1)
  }
}

// Nhấn phòng trong FloorPanel -> bay camera zoom vào đúng phòng trên map.
const handleFloorRoomSelect = ({ roomId, buildingId }) => {
  const bId = buildingId ?? selectedBuilding.value
  if (hologramMapRef.value?.goToRoom) {
    hologramMapRef.value.goToRoom({ id: roomId, buildingId: bId, floor: selectedFloor.value })
  } else {
    mapStore.focusOnRoom(roomId, bId, selectedFloor.value)
  }
}

const onMapReady = async () => {
  isLoading.value = false
  const targetBuilding = route.query.building
  if (targetBuilding && hologramMapRef.value?.selectBuilding) {
    await nextTick()
    hologramMapRef.value.selectBuilding(String(targetBuilding))
    router.replace({ path: '/', query: {} })
  }
}

const handleEquipmentSelected = async ({ roomId, buildingId, properties }) => {
  if (roomId && selectedRoom.value !== roomId) {
    mapStore.focusOnRoom(
      roomId,
      buildingId ?? properties?.building_id ?? selectedBuilding.value,
      properties?.floor ?? selectedFloor.value
    )
    // Q-2 FIX: two nextTick() calls ensure ref is live after v-if + <transition> delay.
    await nextTick()
    await nextTick()
  }
  roomDetailPanelRef.value?.openEquipment(properties)
}

// Keyboard: Esc closes room panel; second Esc clears building selection entirely.
const onKey = (e) => {
  if (e.key !== 'Escape') return
  if (selectedRoom.value) {
    closePanel()
  } else if (selectedBuilding.value) {
    mapStore.focusOnBuilding(null, null)
  }
}

let safety
onMounted(() => {
  isLoading.value = true
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

/* HUD Bar — bám theo --panels-left-width (set bởi usePanelLayout.js).
   Khi RoomDetailPanel mở, usePanelLayout thu --panels-left-width về tab-only
   (36px) nên HUD bar tự trượt sang trái, nhường chỗ cho bản đồ ở giữa. */
.hud-bar {
  position: absolute;
  top: 76px;
  left: calc(var(--panels-left-width, 336px) + 16px);
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: none;
  transition: left 0.38s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: left;
}
.hud-bar > * { pointer-events: auto; }

.hud-context-panel {
  display: flex; align-items: center; gap: 10px;
  padding: 7px 14px;
  background: rgba(7, 10, 18, 0.82);
  border: 1px solid rgba(0, 255, 204, 0.22);
  border-radius: 6px;
  backdrop-filter: blur(10px);
  font-family: 'Space Mono', monospace;
  font-size: 11px; letter-spacing: 0.5px; color: #00ffcc;
  white-space: nowrap;
  max-width: 60vw;
  overflow: hidden;
  text-overflow: ellipsis;
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

/* RoomDetailPanel — trượt từ phải */
.cyber-slide-enter-active, .cyber-slide-leave-active {
  transition: transform 0.38s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.38s ease;
}
.cyber-slide-enter-from, .cyber-slide-leave-to { transform: translateX(24px); opacity: 0; }

/* FloorPanel — fade + slide từ trái */
.floor-panel-enter-enter-active, .floor-panel-enter-leave-active {
  transition: opacity 0.32s ease, transform 0.32s cubic-bezier(0.4, 0, 0.2, 1);
}
.floor-panel-enter-enter-from, .floor-panel-enter-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}

/* Tôn trọng người dùng tắt hiệu ứng chuyển động */
@media (prefers-reduced-motion: reduce) {
  .pulse-dot, .cyber-loader { animation: none; }
  .fade-enter-active, .fade-leave-active,
  .cyber-slide-enter-active, .cyber-slide-leave-active { transition: none; }
}

/* Mobile: panel là bottom sheet, HUD bar về góc trên trái */
@media (max-width: 640px) {
  .hud-bar {
    top: 58px;
    left: 14px !important;
    gap: 6px;
    transition: none;
  }
  .hud-context-panel { font-size: 10px; padding: 6px 10px; }
}
</style>
