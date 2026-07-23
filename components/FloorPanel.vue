<template>
  <div class="floor-panel">
    <!-- Breadcrumb -->
    <div class="breadcrumb">
      <span class="crumb">CAMPUS</span>
      <span class="sep">/</span>
      <span class="crumb active">{{ clusterLabel }}</span>
    </div>

    <h2 class="floor-title">Floor {{ floor }} Rooms</h2>

    <!-- Tabs phân loại theo FM-Room-Type -->
    <div class="type-tabs" v-if="roomTypes.length > 1">
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
        <!-- Áp dụng hàm lọc lặp tên ở đây -->
        <span class="room-name">{{ formatRoomName(room.roomName) }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'

const props = defineProps({
  buildingId: { type: String, default: null },
  clusterLabel: { type: String, default: 'CLUSTER' },
  floor: { type: [String, Number], default: null },
  selectedRoomId: { type: String, default: null }
})

const emit = defineEmits(['select-room'])

const { getRoomsByFloor } = useVguData()

const isLoading = ref(false)
const loadError = ref('')
const rooms = ref([])
const activeType = ref('all')

const ROOM_TYPE_ORDER = ['administration', 'teaching', 'laboratory', 'workshop', 'other']
const ROOM_TYPE_LABELS = {
  administration: 'Administration',
  teaching: 'Teaching',
  laboratory: 'Laboratory',
  workshop: 'Workshop',
  other: 'Khác'
}

// Helper: Lọc bỏ tên bị lặp lại
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

const loadRooms = async () => {
  if (!props.buildingId || props.floor == null) {
    rooms.value = []
    return
  }
  isLoading.value = true
  loadError.value = ''
  try {
    rooms.value = await getRoomsByFloor(props.buildingId, props.floor)
  } catch (err) {
    console.error('[FloorPanel] Lỗi khi tải danh sách phòng theo tầng:', err)
    loadError.value = 'Không tải được dữ liệu phòng. Vui lòng thử lại sau.'
    rooms.value = []
  } finally {
    isLoading.value = false
    activeType.value = 'all'
  }
}

watch(() => [props.buildingId, props.floor], loadRooms, { immediate: true })
onMounted(loadRooms)

const roomTypes = computed(() => {
  const present = new Set(rooms.value.map(r => r.roomType))
  const ordered = ROOM_TYPE_ORDER.filter(t => present.has(t))
  const extra = [...present].filter(t => !ROOM_TYPE_ORDER.includes(t))
  const types = [...ordered, ...extra]
  return types.length > 1 ? ['all', ...types] : types
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
  top: 0;
  left: 0;
  width: 280px;
  height: 100vh;
  background-color: #0b1120;
  border-right: 1px solid #1f2d40;
  display: flex;
  flex-direction: column;
  color: #e2e8f0;
  font-family: 'Inter', sans-serif;
  padding: 16px 16px 0;
  overflow: hidden;
  box-shadow: 4px 0 15px rgba(0,0,0,0.5);
  z-index: 90;
}
.breadcrumb {
  font-size: 11px;
  letter-spacing: 0.5px;
  color: #64748b;
  margin-bottom: 10px;
  text-transform: uppercase;
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
}
.type-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 14px;
  flex-wrap: wrap;
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
