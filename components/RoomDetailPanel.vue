<template>
  <div class="room-detail-panel">
    <!-- Nút Đóng -->
    <button class="close-btn" @click="closePanel">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>

    <!-- 1. Header Section -->
    <div class="panel-header">
      <div class="room-location">
        <span class="building">{{ display.building || 'N/A' }}</span>
        <span class="separator">//</span>
        <span class="level">FLOOR {{ display.level ?? 'N/A' }}</span>
      </div>
      <!-- Tên phòng đã được xử lý để không bị lặp -->
      <h2 class="room-name">{{ display.name || 'N/A' }}</h2>
      <p class="department">{{ display.department || 'N/A' }}</p>
    </div>

    <!-- Vùng nội dung có thể cuộn -->
    <div class="panel-content">
      <div v-if="isLoading" class="state-msg">Đang tải dữ liệu phòng…</div>

      <template v-else>
        <!-- 2. Ảnh thực tế -->
        <div class="photo-section">
          <template v-if="display.photos && display.photos.length > 0">
            <div class="photo-grid" :class="{'single-photo': display.photos.length === 1}">
              <img v-for="(photo, index) in display.photos.slice(0, 2)" :key="index" :src="photo" alt="Room Photo" class="room-image" />
            </div>
          </template>
          <div v-else class="no-photo-placeholder">
            <div class="placeholder-content">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="7" width="18" height="14" rx="2" ry="2"></rect>
                <circle cx="12" cy="14" r="3"></circle>
                <path d="M16 3h-8l-2 4h12l-2-4z"></path>
              </svg>
              <p>Chưa có ảnh thực tế</p>
              <span>Sẽ cập nhật ảnh thực tế tại đây cho phòng {{ display.name }}</span>
            </div>
          </div>
        </div>

        <!-- 3. Thông tin nhân sự (Hỗ trợ nhiều người) -->
        <div class="info-card" v-if="display.occupants.length > 0 || display.office || display.email">
          <div class="card-body">
            <!-- Vòng lặp hiển thị từng staff trên một dòng -->
            <p v-for="(person, idx) in display.occupants" :key="idx" class="incharge-name">
              {{ person }}
            </p>
            <p class="incharge-position" v-if="display.office">
              Office: {{ display.office }}
            </p>
            <p class="incharge-email">
              <a :href="'mailto:' + display.email" v-if="display.email">{{ display.email }}</a>
              <span v-else>N/A</span>
            </p>
            <p class="incharge-phone" v-if="display.phone">Tel: {{ display.phone }}</p>
          </div>
        </div>

        <!-- 4. Thông tin mô tả (Tách xuống dòng) -->
        <div class="info-card">
          <h3 class="card-title">ROOM DESCRIPTION</h3>
          <div class="card-body">
            <p><strong>Phân loại:</strong> {{ display.roomType }}</p>
            <p><strong>Diện tích:</strong> {{ display.area }} m2</p>
            <p><strong>Sức chứa:</strong> {{ display.capacity }}</p>
            
            <div class="working-hours mt-2">
              <strong class="text-highlight">Trạng thái / Hoạt động:</strong>
              <p>{{ display.status || 'N/A' }}</p>
            </div>
          </div>
        </div>

        <!-- 5. Featured Facility / Instruments -->
        <div class="info-card">
          <h3 class="card-title highlight-title">
            FEATURED INSTRUMENTS ({{ display.instruments ? display.instruments.length : 0 }})
          </h3>
          <div class="card-body">
            <ul v-if="display.instruments && display.instruments.length > 0" class="instrument-list">
              <li v-for="(item, index) in display.instruments" :key="index">
                {{ item.name || item }}
              </li>
            </ul>
            <div v-else class="empty-instruments">
              <p>No highlighted instruments available.</p>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- 6. Action Button -->
    <div class="panel-footer">
      <button class="action-btn">VIEW ALL MACHINES IN THIS ROOM</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'

const props = defineProps({
  roomId: { type: String, default: null },
  buildingId: { type: String, default: null }
})

const emit = defineEmits(['close'])
const closePanel = () => emit('close')

const { getRoomInfo } = useVguData()

const isLoading = ref(false)
const roomData = ref(null)

// 1. Biến lưu trữ dữ liệu ảnh từ JSON
const roomImageMap = ref({})

// 2. Fetch file JSON từ thư mục public khi Component vừa mount
onMounted(async () => {
  try {
    const data = await $fetch('/data/drive_data.json')
    if (data) roomImageMap.value = data
  } catch (error) {
    console.error('Không thể tải file drive_data.json:', error)
  }
})

const cleanData = (data) => {
  if (!data || data === '___' || data === '--' || data === 'Chưa cập nhật' || data === 'unknown') return ''
  return data
}

const fetchRoom = async (id) => {
  if (!id) {
    roomData.value = null
    return
  }
  isLoading.value = true
  roomData.value = await getRoomInfo(id)
  isLoading.value = false
}

watch(() => props.roomId, fetchRoom, { immediate: true })

const display = computed(() => {
  const r = roomData.value
  if (!r) {
    return {
      building: cleanData(props.buildingId),
      level: null,
      name: props.roomId || '',
      department: '',
      photos: [],
      occupants: [],
      office: '',
      email: '',
      phone: '',
      roomType: 'N/A',
      area: 'N/A',
      capacity: 'N/A',
      status: '',
      instruments: []
    }
  }

  // --- UPDATE ẢNH TỪ BIẾN JSON ĐÃ FETCH ---
  let photos = []
  if (props.roomId && roomImageMap.value[props.roomId]) {
    photos = [`https://drive.google.com/uc?export=view&id=${roomImageMap.value[props.roomId]}`]
  } else if (r.image) {
    photos = Array.isArray(r.image) ? r.image.filter(Boolean) : [r.image]
  }

  const departments = Array.isArray(r.departments)
    ? r.departments.map(cleanData).filter(Boolean).join(', ')
    : cleanData(r.departments)

  // XỬ LÝ LỖI LẶP TÊN PHÒNG (Nâng cấp)
  let roomName = cleanData(r.name) || props.roomId;
  if (typeof roomName === 'string' && roomName.includes('-')) {
    const parts = roomName.split('-').map(p => p.trim());
    if (parts.length > 1 && parts.length % 2 === 0) {
      const halfIndex = parts.length / 2;
      const firstHalf = parts.slice(0, halfIndex).join(' - ');
      const secondHalf = parts.slice(halfIndex).join(' - ');
      if (firstHalf === secondHalf) {
        roomName = firstHalf;
      }
    }
  }

  // XỬ LÝ NHIỀU NHÂN SỰ
  let occupantsList = [];
  const rawName = r.head_of_lab ? cleanData(r.head_of_lab.name) : '';
  if (rawName) {
    if (Array.isArray(rawName)) {
      occupantsList = rawName.map(cleanData).filter(Boolean);
    } else if (typeof rawName === 'string') {
      occupantsList = rawName.split(/,|\r?\n/).map(name => name.trim()).filter(Boolean);
    }
  }

  return {
    building: cleanData(r.building_id) || cleanData(props.buildingId),
    level: r.floor ?? null,
    name: roomName,
    department: departments,
    photos, 
    occupants: occupantsList, 
    office: r.head_of_lab ? cleanData(r.head_of_lab.office) : '',
    email: r.head_of_lab ? cleanData(r.head_of_lab.email) : '',
    phone: r.head_of_lab ? cleanData(r.head_of_lab.phone) : '',
    roomType: cleanData(r.room_type) || 'N/A',
    area: cleanData(r.area_m2) || 'N/A',
    capacity: cleanData(r.capacity) || 'N/A',
    status: cleanData(r.status),
    instruments: r.highlighted_equipment || []
  }
})
</script>

<style scoped>
/* Tổng quan Panel */
.room-detail-panel {
  position: absolute;
  top: 0;
  right: 0;
  width: 400px;
  height: 100vh;
  background-color: #0b1120;
  border-left: 1px solid #1f2d40;
  display: flex;
  flex-direction: column;
  color: #e2e8f0;
  font-family: 'Inter', sans-serif;
  box-shadow: -4px 0 15px rgba(0,0,0,0.5);
  z-index: 100;
}

/* Nút Đóng */
.close-btn {
  position: absolute;
  top: 15px;
  right: 15px;
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  transition: color 0.2s;
}
.close-btn:hover {
  color: #f87171;
}

/* Header */
.panel-header {
  padding: 24px 20px 16px;
  border-bottom: 1px dashed #1f2d40;
}
.room-location {
  font-size: 10px;
  font-weight: 700;
  color: #f97316;
  letter-spacing: 1px;
  margin-bottom: 8px;
  text-transform: uppercase;
}
.room-location .separator {
  margin: 0 4px;
  color: #64748b;
}
.room-name {
  font-size: 22px;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 4px 0;
}
.department {
  font-size: 13px;
  color: #94a3b8;
  margin: 0;
}

/* Scroll Content */
.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.panel-content::-webkit-scrollbar {
  width: 6px;
}
.panel-content::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 4px;
}

.state-msg {
  padding: 20px 0;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
}

/* Photo Section */
.photo-section {
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
}
.photo-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.photo-grid.single-photo {
  grid-template-columns: 1fr;
}
.room-image {
  width: 100%;
  height: 160px;
  object-fit: cover;
  border-radius: 6px;
}
.no-photo-placeholder {
  width: 100%;
  height: 180px;
  background-color: #1e293b;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: #94a3b8;
  text-align: center;
}
.placeholder-content svg {
  margin-bottom: 8px;
  color: #94a3b8;
}
.placeholder-content p {
  font-weight: 600;
  margin: 0;
  font-size: 14px;
}
.placeholder-content span {
  font-size: 11px;
  color: #94a3b8;
}

/* Info Cards */
.info-card {
  background-color: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 8px;
  padding: 16px;
}
.card-title {
  font-size: 10px;
  font-weight: 700;
  color: #94a3b8;
  letter-spacing: 1px;
  margin: 0 0 12px 0;
  text-transform: uppercase;
}
.highlight-title {
  color: #f97316;
}
.card-body p {
  margin: 0 0 6px 0;
  font-size: 13px;
  line-height: 1.5;
}
.card-body p strong {
  color: #cbd5e1;
}
.incharge-name {
  font-weight: 700;
  font-size: 16px !important;
  color: #ffffff;
  margin-bottom: 4px !important;
}
.incharge-position {
  color: #cbd5e1;
  margin-top: 8px !important;
}
.incharge-email a {
  color: #0ea5e9;
  text-decoration: none;
}
.incharge-email a:hover {
  text-decoration: underline;
}
.mt-2 {
  margin-top: 12px;
}
.text-highlight {
  color: #f8fafc;
  font-size: 12px;
}

/* Instruments List */
.instrument-list {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 13px;
}
.instrument-list li {
  padding: 6px 0;
  border-bottom: 1px solid #1e293b;
}
.instrument-list li:last-child {
  border-bottom: none;
}
.empty-instruments {
  background-color: #1e293b;
  padding: 12px;
  border-radius: 4px;
  text-align: center;
  color: #64748b;
  font-style: italic;
  font-size: 12px;
}

/* Footer & Button */
.panel-footer {
  padding: 16px 20px;
  border-top: 1px solid #1f2d40;
}
.action-btn {
  width: 100%;
  background-color: #f97316;
  color: #ffffff;
  border: none;
  padding: 14px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 1px;
  border-radius: 6px;
  cursor: pointer;
  text-transform: uppercase;
  transition: background-color 0.2s;
}
.action-btn:hover {
  background-color: #ea580c;
}
</style>
