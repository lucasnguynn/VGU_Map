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
        <span class="building">{{ room.building || 'N/A' }}</span>
        <span class="separator">//</span>
        <span class="level">FLOOR {{ room.level || 'N/A' }}</span>
      </div>
      <h2 class="room-name">{{ room.name || 'N/A' }}</h2>
      <p class="department">{{ room.department || 'N/A' }}</p>
    </div>

    <!-- Vùng nội dung có thể cuộn -->
    <div class="panel-content">
      
      <!-- 2. Ảnh thực tế -->
      <div class="photo-section">
        <template v-if="room.photos && room.photos.length > 0">
          <div class="photo-grid" :class="{'single-photo': room.photos.length === 1}">
            <img v-for="(photo, index) in room.photos.slice(0, 2)" :key="index" :src="photo" alt="Room Photo" class="room-image" />
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
            <span>Sẽ cập nhật ảnh thực tế tại đây cho phòng {{ room.name }}</span>
          </div>
        </div>
      </div>

      <!-- 3. Thông tin người phụ trách (Room Incharge) -->
      <div class="info-card">
        <h3 class="card-title">ROOM INCHARGE</h3>
        <div class="card-body">
          <p class="incharge-name">{{ room.occupant || 'N/A' }}</p>
          <p class="incharge-position">{{ room.position || 'N/A' }}</p>
          <p class="incharge-email"><a :href="'mailto:' + room.email" v-if="room.email">{{ room.email }}</a><span v-else>N/A</span></p>
          <p class="incharge-phone" v-if="room.phone">Tel: {{ room.phone }}</p>
        </div>
      </div>

      <!-- 4. Thông tin mô tả (Room Description) -->
      <div class="info-card">
        <h3 class="card-title">ROOM DESCRIPTION</h3>
        <div class="card-body">
          <p class="description-text">{{ room.description || 'N/A' }}</p>
          <div class="working-hours mt-2">
            <strong class="text-highlight">Thời gian hoạt động/có mặt:</strong>
            <p>{{ room.workingHours || 'N/A' }}</p>
          </div>
        </div>
      </div>

      <!-- 5. Featured Facility / Instruments -->
      <div class="info-card">
        <h3 class="card-title highlight-title">
          FEATURED INSTRUMENTS ({{ room.instruments ? room.instruments.length : 0 }})
        </h3>
        <div class="card-body">
          <ul v-if="room.instruments && room.instruments.length > 0" class="instrument-list">
            <li v-for="(item, index) in room.instruments" :key="index">
              <span class="item-id">{{ item.id }}</span> - {{ item.name }}
            </li>
          </ul>
          <div v-else class="empty-instruments">
            <p>No highlighted instruments available.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 6. Action Button -->
    <div class="panel-footer">
      <button class="action-btn">VIEW ALL MACHINES IN THIS ROOM</button>
    </div>
  </div>
</template>

<script setup>
// Khai báo props nhận dữ liệu từ Component cha (Map)
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  room: {
    type: Object,
    default: () => ({
      building: '',
      level: '',
      name: '',
      department: '',
      photos: [], // Array link ảnh ['url1', 'url2']
      occupant: '',
      position: '',
      email: '',
      phone: '',
      description: '',
      workingHours: '',
      instruments: [] // Array object thiết bị [{id: '01', name: 'Machine A'}]
    })
  }
});

const emit = defineEmits(['close']);

// Hàm đóng panel
const closePanel = () => {
  emit('close');
};
</script>

<style scoped>
/* Tổng quan Panel */
.room-detail-panel {
  position: absolute;
  top: 0;
  right: 0;
  width: 400px;
  height: 100vh;
  background-color: #0b1120; /* Màu nền dark blue theo thiết kế */
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
  color: #f97316; /* Màu cam */
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
  background-color: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: #475569;
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
  margin: 0 0 4px 0;
  font-size: 13px;
  line-height: 1.5;
}
.incharge-name {
  font-weight: 700;
  font-size: 16px !important;
  color: #ffffff;
}
.incharge-position {
  color: #cbd5e1;
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
.item-id {
  color: #f97316;
  font-weight: bold;
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
  background-color: #f97316; /* Nút màu cam */
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
