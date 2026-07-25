<template>
  <div class="map-page">
    <!-- Luồng 3D chỉ chạy ở client -->
    <ClientOnly fallback-tag="div" fallback-class="loading-overlay">
      <HologramMap
        ref="hologramMapRef"
        @room-selected="handleRoomSelected"
        @building-selected="handleBuildingSelected"
        @floor-selected="handleFloorSelected"
        @ready="onMapReady"
      />
    </ClientOnly>

    <!-- Header giờ nằm ở layouts/default.vue (AppHeader.vue), dùng chung cho mọi trang.
         Trang này chỉ còn giữ HUD context-panel riêng của bản đồ, đẩy xuống dưới
         header (top: var(--header-h)) để không còn đè lên nhau. -->
    <div class="hud-bar">
      <div class="hud-context-panel">
        <span class="pulse-dot" aria-hidden="true"></span>
        <span>{{ contextTitle }}</span>
      </div>
    </div>

    <!-- Panel danh sách phòng theo tầng (bên trái).
         [FIX-mobile-sheets] Trên desktop/tablet đây là side-dock nên mở song
         song với RoomDetailPanel không sao. Trên mobile, cả 2 panel này biến
         thành bottom sheet cùng neo đáy màn hình -> mở đồng thời sẽ chồng lên
         nhau, rối và khó thấy thông tin phòng thật sự cần xem. Nên trên mobile
         chỉ hiện 1 sheet tại 1 thời điểm: ẩn FloorPanel khi đã có phòng được
         chọn (RoomDetailPanel lúc đó là ưu tiên), hiện lại khi đóng chi tiết. -->
    <transition name="cyber-slide-left">
      <FloorPanel
        v-if="selectedBuilding && selectedFloor != null && !(isMobile && selectedRoom)"
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
import { computed, ref, onMounted, onBeforeUnmount, inject, watchEffect } from 'vue'
import { storeToRefs } from 'pinia'
import { useMapStore } from '~/Stores/mapStores'
import { useDeviceTier } from '~/composables/useDeviceTier'
import HologramMap from '~/components/HologramMap.vue'
import RoomDetailPanel from '~/components/RoomDetailPanel.vue'
import FloorPanel from '~/components/FloorPanel.vue'

const { isMobile } = useDeviceTier()
const mapStore = useMapStore()
const { selectedRoom, selectedBuilding, selectedFloor, isLoading } = storeToRefs(mapStore)
const hologramMapRef = ref(null)

const contextTitle = computed(() => {
  if (!selectedBuilding.value) return 'TIÊU ĐIỂM: TOÀN CẢNH KHUÔN VIÊN VGU'
  if (selectedRoom.value) return `PHÒNG: ${selectedRoom.value}`
  return `TOÀ: ${String(selectedBuilding.value).toUpperCase()} · TẦNG ${selectedFloor.value ?? '-'}`
})

// Bơm dòng trạng thái vào AppHeader (khai báo ở layouts/default.vue) mà không cần
// layout biết gì về Pinia/HologramMap. Khi đang loading hiện "ĐANG TẢI…", sau đó
// đồng bộ với contextTitle của chính trang map.
const headerStatus = inject('header-status', ref(''))
watchEffect(() => {
  headerStatus.value = isLoading.value ? 'ĐANG TẢI BẢN ĐỒ…' : contextTitle.value
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
  hologramMapRef.value?.closeRoomDetail?.()
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

/* HUD Bar — nội dung riêng của trang map, đẩy xuống dưới AppHeader dùng chung
   qua biến --header-h (khai báo ở layouts/default.vue) thay vì số cứng 68px
   trước đây, để không vỡ layout nếu chiều cao header đổi. */
.hud-bar {
  position: absolute;
  top: calc(var(--header-h, 64px) + 4px);
  left: 24px;
  z-index: 20;
  pointer-events: none;
}
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

/* Loading overlay — z-index cao hơn RoomDetailPanel (z:100) và EquipmentSidePanel
   (z:99, hoặc 101 khi màn hẹp phủ toàn màn hình — xem EquipmentSidePanel.vue)
   không quan trọng vì overlay chỉ hiện lúc mới vào, nhưng trước đây trùng z:100
   với RoomDetailPanel là một "hoà" dễ vỡ nếu sau này thêm hiệu ứng — tách rõ
   ràng để loading luôn thắng khi đang hiện. */
.loading-overlay {
  position: absolute; inset: 0; z-index: 150;
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
  .hud-bar { top: calc(var(--header-h-mobile, 54px) + 4px); left: 14px; }
  .hud-context-panel { font-size: 11px; padding: 6px 12px; }
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
