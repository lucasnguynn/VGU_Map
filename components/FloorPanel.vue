<template>
  <!-- Tablet: nền mờ phía sau panel để tách khỏi bản đồ, bấm ra ngoài = thu gọn
       (không đóng hẳn panel vì panel còn phụ thuộc building/floor đang chọn ở
       trang cha — xem pages/index.vue). -->
  <div
    v-if="tier === 'tablet'"
    class="adaptive-backdrop"
    style="z-index: 89"
    @click="isCollapsed = true"
  ></div>

  <div
    class="floor-panel"
    :class="[`tier-${tier}`, { 'is-collapsed': tier !== 'mobile' && isCollapsed }]"
    :style="tier === 'mobile' ? sheetStyle : null"
  >
    <!-- Mobile: tay cầm kéo/tap thay cho nút thu gọn (bottom sheet) -->
    <div
      v-if="tier === 'mobile'"
      class="adaptive-sheet-handle"
      @pointerdown="onSheetDragStart"
    ></div>

    <!-- Desktop/tablet: nút thu gọn/mở rộng dạng tab bám cạnh -->
    <button
      v-else
      class="toggle-btn"
      @click="isCollapsed = !isCollapsed"
      :title="isCollapsed ? 'Mở danh sách phòng' : 'Thu gọn'"
    >
      <svg v-if="!isCollapsed" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="9" y1="3" x2="9" y2="21"></line>
      </svg>
      <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="15" y1="3" x2="15" y2="21"></line>
      </svg>
    </button>

    <!-- Gói nội dung vào 1 wrapper để tránh bị tràn khi thu gọn -->
    <div class="panel-content-wrapper">
      <!-- Breadcrumb -->
      <div class="breadcrumb">
        <span class="crumb">CAMPUS</span>
        <span class="sep">/</span>
        <span class="crumb active">{{ clusterLabel }}</span>
      </div>

      <h2 class="floor-title">Floor {{ floor }} Rooms</h2>

      <!-- [FIX] Tabs phân loại luôn hiển thị -->
      <div class="type-tabs" v-if="roomTypes.length > 0">
        <button
          v-for="type in roomTypes"
          :key="type"
          class="type-tab"
          :class="{ active: activeType === type }"
          @click="activeType = type"
        >
          {{ typeLabel(type) }}
          <span class="tab-count">{{ countByType(type) }}</span>
        </button>
      </div>

      <!-- Danh sách phòng -->
      <div class="room-list">
        <div v-if="isLoading" class="state-msg">Đang tải danh sách phòng…</div>

        <div v-else-if="loadError" class="state-msg error">{{ loadError }}</div>

        <div v-else-if="filteredRooms.length === 0" class="state-msg">
          Không có phòng nào thuộc loại này.
        </div>

        <button
          v-for="room in filteredRooms"
          :key="room.id"
          class="room-card"
          :class="{ selected: selectedRoomId === room.id }"
          @click="handleSelectRoom(room)"
        >
          <div class="room-card-top">
            <span class="room-number">{{ room.roomNumber }}</span>
            <span class="room-status" :class="statusClass(room.status)">
              {{ statusLabel(room.status) }}
            </span>
          </div>
          <span class="room-name">{{ formatRoomName(room.roomName) }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useDeviceTier } from '~/composables/useDeviceTier'
import { useBottomSheet } from '~/composables/useBottomSheet'
import { usePanelLayout } from '~/composables/usePanelLayout'

const props = defineProps({
  buildingId: { type: String, default: null },
  clusterLabel: { type: String, default: 'CLUSTER' },
  floor: { type: [String, Number], default: null },
  selectedRoomId: { type: String, default: null }
})

const emit = defineEmits(['select-room'])

const { getRoomsByFloor } = useVguData()
const { tier } = useDeviceTier()
const { setPanelState } = usePanelLayout()
onMounted(() => setPanelState({ floorVisible: true }))
onBeforeUnmount(() => setPanelState({ floorVisible: false }))
// Mobile: panel này là bottom sheet kéo-thả, mặc định "hé mở" (peek) để vẫn
// thấy bản đồ phía sau, người dùng kéo/chạm tay cầm để xem toàn bộ danh sách.
const { sheetStyle, onDragStart: onSheetDragStart, reset: resetSheet } = useBottomSheet({ peek: 0.4, full: 0.88 })

const isLoading = ref(false)
const loadError = ref('')
const rooms = ref([])
const activeType = ref('all')

const isCollapsed = ref(false)

const ROOM_TYPE_ORDER = ['administration', 'teaching', 'laboratory', 'workshop', 'other']
const ROOM_TYPE_LABELS = {
  administration: 'Administration',
  teaching: 'Teaching',
  laboratory: 'Laboratory',
  workshop: 'Workshop',
  other: 'Khác'
}

const formatRoomName = (name) => {
  if (!name || typeof name !== 'string') return name
  const parts = name.split(/\s*-\s*/)
  if (parts.length > 1 && parts.length % 2 === 0) {
    const halfIndex = parts.length / 2
    const firstHalf = parts.slice(0, halfIndex).join(' - ')
    const secondHalf = parts.slice(halfIndex).join(' - ')
    if (firstHalf === secondHalf) return firstHalf
  }
  return name
}

// [FIX] Hàm trích xuất chính xác tầng từ Mã Phòng xử lý được chuẩn 101 và 2.CR1
const getFloorFromRoomNumber = (roomNumber, buildingId) => {
  if (!roomNumber) return null
  let s = String(roomNumber).toUpperCase()
  const b = (buildingId || '').toUpperCase()
  
  // Xóa tiền tố tòa nhà nếu có (VD: bỏ "AD-" trong "AD-101")
  if (b && s.startsWith(b + '-')) {
    s = s.substring(b.length + 1)
  }
  
  // Lấy cụm số đứng ngay đầu (vd: "101", "2")
  const match = s.match(/^(\d+)/)
  if (!match) return null

  const numStr = match[1]

  // Nếu ngay sau số là dấu chấm (vd: "2.CR1"), tầng là số đó
  if (s[numStr.length] === '.') {
    return numStr
  }

  // Nếu là mã phòng chuẩn 3-4 số (vd: "101", "214"), bỏ 2 số cuối để lấy tầng
  if (numStr.length >= 3) {
    return numStr.slice(0, numStr.length - 2)
  }

  return numStr
}

const loadRooms = async () => {
  if (!props.buildingId || props.floor == null) {
    rooms.value = []
    return
  }
  isLoading.value = true
  loadError.value = ''
  try {
    const fetchedRooms = await getRoomsByFloor(props.buildingId, props.floor)
    const expectedFloor = String(props.floor)

    // Lọc các phòng sai tầng từ Data
    rooms.value = fetchedRooms.filter(r => {
      const dataFloor = String(r.floor)
      const extractedFloor = getFloorFromRoomNumber(r.roomNumber, props.buildingId)
      
      // Nếu có thể trích xuất ra tầng từ mã phòng và nó khác với tầng đang xem -> Lọc bỏ
      if (extractedFloor && extractedFloor !== expectedFloor) {
        return false
      }
      return dataFloor === expectedFloor
    })

  } catch (err) {
    console.error('[FloorPanel] Lỗi khi tải danh sách phòng theo tầng:', err)
    loadError.value = 'Không tải được dữ liệu phòng. Vui lòng thử lại sau.'
    rooms.value = []
  } finally {
    isLoading.value = false
    activeType.value = 'all'
  }
}

// AFTER — watch with immediate:true already fires on mount; onMounted call is redundant
watch(() => [props.buildingId, props.floor], () => {
  loadRooms()
  isCollapsed.value = false
  resetSheet() // mobile: mỗi lần đổi tầng, sheet quay về trạng thái hé mở
}, { immediate: true })
// M-4 FIX: removed onMounted(loadRooms) — the watch above with { immediate: true }
// already executes loadRooms() synchronously before mount, making the onMounted
// call a duplicate that fires a second parallel network request.

// [FIX] Luôn luôn trả về mảng có tab 'all' để người dùng dễ chọn lại
const roomTypes = computed(() => {
  const present = new Set(rooms.value.map(r => r.roomType))
  const ordered = ROOM_TYPE_ORDER.filter(t => present.has(t))
  const extra = [...present].filter(t => !ROOM_TYPE_ORDER.includes(t))
  const types = [...ordered, ...extra]
  
  return types.length > 0 ? ['all', ...types] : []
})

const typeLabel = (type) => (type === 'all' ? 'Tất cả' : (ROOM_TYPE_LABELS[type] || type))

const countByType = (type) =>
  type === 'all' ? rooms.value.length : rooms.value.filter(r => r.roomType === type).length

const filteredRooms = computed(() => {
  if (activeType.value === 'all' || !activeType.value) return rooms.value
  return rooms.value.filter(r => r.roomType === activeType.value)
})

const statusClass = (status) => {
  if (status === 'active') return 'is-active'
  if (status === 'inactive') return 'is-inactive'
  return 'is-unknown'
}
const statusLabel = (status) => {
  const map = { active: 'ACTIVE', inactive: 'INACTIVE' }
  return map[status] || (status || '').toUpperCase()
}

const handleSelectRoom = (room) => {
  emit('select-room', { roomId: room.id, buildingId: props.buildingId })
}
</script>

<style scoped>
.floor-panel {
  position: absolute;
  top: var(--header-h, 64px);
  /* Bám vào tổng độ rộng cột trái — được usePanelLayout.js cập nhật đồng bộ
     mỗi khi BuildingsPanel thay đổi trạng thái. Transition trên left để panel
     trượt mượt cùng lúc với BuildingsPanel, không bao giờ lệch. */
  left: var(--panels-left-width, 336px);
  width: 280px;
  height: calc(100vh - var(--header-h, 64px));
  background-color: #0b1120;
  border-right: 1px solid #1f2d40;
  color: #e2e8f0;
  font-family: 'Inter', sans-serif;
  box-shadow: 4px 0 15px rgba(0,0,0,0.5);
  z-index: 90;
  /* Slide-in từ trái (Vue transition) + left animate theo panels-left-width */
  transition:
    left 0.38s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.38s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: visible;
  will-change: left, transform;
}

.floor-panel.is-collapsed {
  transform: translateX(-100%);
}

/* ===== Tier: tablet (641–1024px) ===== */
.floor-panel.tier-tablet {
  width: min(280px, 75vw);
}

/* ===== Tier: mobile (<=640px) =====
   Chuyển hẳn từ side-dock sang bottom sheet kéo-thả: neo đáy màn hình, bo góc
   trên, chiều cao do useBottomSheet.js điều khiển qua style inline (sheetStyle).
   is-collapsed không áp dụng ở tier này (xem điều kiện trong template). */
.floor-panel.tier-mobile {
  top: auto;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  border-right: none;
  border-top: 1px solid #1f2d40;
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.floor-panel.tier-mobile .panel-content-wrapper {
  padding-top: 0;
}

.panel-content-wrapper {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  padding: 16px 16px 0;
  overflow: hidden;
}

/* NÚT TOGGLE */
.toggle-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  background-color: transparent; 
  border: none;
  border-radius: 6px;
  color: #94a3b8;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 91;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.toggle-btn:hover {
  color: #f1f5f9;
  background-color: rgba(255, 255, 255, 0.1);
}

.floor-panel.is-collapsed .toggle-btn {
  right: -36px;
  top: 80px;
  width: 36px;
  height: 36px;
  background-color: #0b1120;
  border: 1px solid #1f2d40;
  border-left: none;
  border-radius: 0 8px 8px 0;
  box-shadow: 4px 0 10px rgba(0,0,0,0.3);
}

.breadcrumb {
  font-size: 11px;
  letter-spacing: 0.5px;
  color: #64748b;
  margin-bottom: 10px;
  text-transform: uppercase;
  flex-shrink: 0;
  padding-right: 32px; 
}
.breadcrumb .crumb.active {
  color: #f1f5f9;
  font-weight: 700;
}
.breadcrumb .sep {
  margin: 0 6px;
}
.floor-title {
  margin: 0 0 14px;
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
  padding-right: 32px; 
}
.type-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 14px;
  flex-wrap: wrap;
  flex-shrink: 0;
}
.type-tab {
  background: #0f172a;
  border: 1px solid #1e293b;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.3px;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s;
}
.type-tab:hover {
  border-color: #f97316;
  color: #f1f5f9;
}
.type-tab.active {
  background: #1d4ed8;
  border-color: #1d4ed8;
  color: #fff;
}
.tab-count {
  background: rgba(255,255,255,0.15);
  border-radius: 4px;
  padding: 0 5px;
  font-size: 10px;
}
.room-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 16px;
}
.room-list::-webkit-scrollbar { width: 6px; }
.room-list::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 4px;
}
.state-msg {
  text-align: center;
  color: #94a3b8;
  font-size: 12px;
  padding: 24px 0;
}
.state-msg.error {
  color: #f87171;
}
.room-card {
  background-color: #101a2c;
  border: 1px solid #1e293b;
  border-left: 3px solid #1e293b;
  border-radius: 6px;
  padding: 10px 12px;
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: border-color 0.15s, background-color 0.15s;
}
.room-card:hover {
  border-color: #f97316;
  border-left-color: #f97316;
}
.room-card.selected {
  background-color: #1e293b;
  border-left-color: #f97316;
}
.room-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.room-number {
  font-size: 12px;
  font-weight: 800;
  color: #fff;
  letter-spacing: 0.3px;
}
.room-status {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.5px;
  padding: 2px 6px;
  border-radius: 4px;
}
.room-status.is-active {
  color: #22c55e;
  background: rgba(34, 197, 94, 0.12);
}
.room-status.is-inactive {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.12);
}
.room-status.is-unknown {
  color: #94a3b8;
  background: rgba(148, 163, 184, 0.12);
}
.room-name {
  font-size: 12px;
  color: #94a3b8;
}
</style>
