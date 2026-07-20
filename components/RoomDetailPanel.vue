<!-- components/RoomDetailPanel.vue -->
<template>
  <div class="room-panel">
    <!-- Header -->
    <div class="panel-header" :style="{ borderColor: ambientColor }">
      <div class="sys-status">TELEMETRY: ONLINE</div>
      <h2>{{ roomDetails?.name || roomId }}</h2>
      <div class="meta-info">
        <span>TÒA: {{ roomDetails?.building_id || 'N/A' }}</span> |
        <span>TẦNG: {{ roomDetails?.floor || 'N/A' }}</span>
      </div>
      <button @click="$emit('close')" class="btn-close">[ ĐÓNG ]</button>
    </div>

    <!-- Content -->
    <div class="panel-content">
      <!-- Loading State -->
      <div v-if="isLoading" class="loading-state">
        <div class="cyber-loader small"></div>
        <p>LOADING ROOM DATA...</p>
      </div>

      <!-- Room Info -->
      <template v-else-if="roomDetails">
        <!-- Thông tin phụ trách -->
        <div class="info-block">
          <h4>[ GIÁM SÁT VIÊN ]</h4>
          <p>{{ roomDetails?.head_of_lab?.name || 'Chưa cập nhật' }}</p>
          <p class="email">{{ roomDetails?.head_of_lab?.email || '' }}</p>
        </div>

        <!-- Danh sách thiết bị -->
        <div v-if="equipmentList && equipmentList.length > 0" class="equipment-list">
          <h4>[ TÀI SẢN THIẾT BỊ ]</h4>

          <div 
            v-for="equip in equipmentList" 
            :key="equip._id || equip.id" 
            class="equip-card" 
            :style="{ '--accent': equip.media?.ambient_color || '#00ffcc' }"
          >
            <div class="equip-title">{{ equip.title }} - {{ equip.model }}</div>

            <!-- Hiệu ứng X-Ray Flashlight -->
            <div 
              class="xray-container" 
              @mousemove="updateFlashlight($event)" 
              @mouseleave="hideFlashlight"
            >
              <!-- Ảnh vỏ máy (Nền) -->
              <img :src="equip.media?.images?.[0] || '/placeholder.jpg'" class="equip-img exterior" />
              <!-- Ảnh bản vẽ mạch (Ẩn dưới lớp mask) -->
              <img 
                :src="equip.media?.internal_blueprint || '/placeholder.svg'" 
                class="equip-img blueprint" 
                :style="flashlightStyle" 
              />
            </div>

            <!-- Render nội dung Markdown động -->
            <ContentRenderer v-if="equip.body" :value="equip" class="equip-desc" />
            
            <!-- Fallback description -->
            <p v-else class="equip-desc">{{ equip.description || 'Không có mô tả chi tiết.' }}</p>
          </div>
        </div>

        <div v-else class="empty-state">
          [ KHÔNG TÌM THẤY DỮ LIỆU THIẾT BỊ TẠI PHÒNG NÀY ]
        </div>
      </template>

      <!-- Error State -->
      <div v-else-if="error" class="error-state">
        <p>{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useVguData } from '~/composables/useVguData'

const props = defineProps({
  roomId: {
    type: String,
    required: true
  },
  buildingId: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['close'])

// Composables
const { getRoomInfo, getRoomEquipment } = useVguData()

// State
const isLoading = ref(true)
const error = ref(null)
const roomDetails = ref(null)
const equipmentList = ref([])

// Ambient color từ thiết bị đầu tiên
const ambientColor = computed(() => {
  return equipmentList.value[0]?.media?.ambient_color || '#00ffcc'
})

// Flashlight effect state
const flashlightPos = ref({ x: -100, y: -100 })
const isHovering = ref(false)

const updateFlashlight = (e) => {
  const rect = e.target.getBoundingClientRect()
  flashlightPos.value = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  }
  isHovering.value = true
}

const hideFlashlight = () => {
  isHovering.value = false
}

const flashlightStyle = computed(() => {
  if (!isHovering.value) {
    return { clipPath: 'circle(0px at 0 0)' }
  }
  return {
    clipPath: `circle(80px at ${flashlightPos.value.x}px ${flashlightPos.value.y}px)`
  }
})

// Load room data
onMounted(async () => {
  try {
    isLoading.value = true
    
    // Load room info từ Nuxt Content
    roomDetails.value = await getRoomInfo(props.roomId)
    
    // Load equipment list
    equipmentList.value = await getRoomEquipment(props.roomId)
    
    console.log('[RoomDetailPanel] Loaded data for:', props.roomId, {
      room: roomDetails.value,
      equipmentCount: equipmentList.value.length
    })
  } catch (err) {
    console.error('[RoomDetailPanel] Failed to load room data:', err)
    error.value = 'KHÔNG THỂ TẢI DỮ LIỆU PHÒNG'
  } finally {
    isLoading.value = false
  }
})
</script>

<style scoped>
.room-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  bottom: 20px;
  width: 450px;
  max-width: calc(100vw - 40px);
  background: rgba(5, 10, 15, 0.65);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(0, 255, 204, 0.3);
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.8), inset 0 0 20px rgba(0, 255, 204, 0.05);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  font-family: 'Space Mono', monospace;
  color: #e0e0e0;
  z-index: 50;
  overflow: hidden;
}

.panel-header {
  padding: 20px;
  background: linear-gradient(90deg, rgba(0, 255, 204, 0.1) 0%, transparent 100%);
  border-bottom: 2px solid;
  position: relative;
}

.panel-header h2 {
  margin: 10px 0 5px;
  font-size: 22px;
  color: #fff;
  font-family: 'Be Vietnam Pro', sans-serif;
}

.meta-info {
  font-size: 11px;
  color: #00ffcc;
  opacity: 0.8;
}

.sys-status {
  font-size: 10px;
  color: #00ffcc;
  letter-spacing: 1px;
}

.btn-close {
  position: absolute;
  top: 15px;
  right: 15px;
  background: none;
  border: none;
  color: #ff3366;
  cursor: pointer;
  font-family: 'Space Mono', monospace;
  font-size: 12px;
  transition: all 0.2s;
}

.btn-close:hover {
  color: #ff6699;
  transform: scale(1.1);
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.info-block {
  margin-bottom: 25px;
  padding-bottom: 15px;
  border-bottom: 1px solid rgba(0, 255, 204, 0.2);
}

.info-block h4 {
  font-size: 12px;
  color: #EF5A24;
  margin-bottom: 10px;
  letter-spacing: 1px;
}

.info-block p {
  font-size: 13px;
  margin: 5px 0;
}

.info-block .email {
  color: #06B6D4;
  font-size: 12px;
}

.equipment-list h4 {
  font-size: 12px;
  color: #EF5A24;
  margin-bottom: 15px;
  letter-spacing: 1px;
}

.equip-card {
  margin-bottom: 25px;
  padding: 15px;
  background: rgba(15, 30, 54, 0.5);
  border: 1px solid rgba(0, 255, 204, 0.15);
  border-radius: 4px;
}

.equip-title {
  font-size: 14px;
  font-weight: bold;
  color: var(--accent);
  margin-bottom: 12px;
  font-family: 'Be Vietnam Pro', sans-serif;
}

.xray-container {
  position: relative;
  width: 100%;
  height: 200px;
  margin-bottom: 15px;
  overflow: hidden;
  border-radius: 4px;
  background: #0a0f1a;
}

.equip-img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.equip-img.blueprint {
  filter: invert(1) hue-rotate(180deg);
  opacity: 0.8;
}

.equip-desc {
  font-size: 12px;
  line-height: 1.6;
  color: #ccc;
  margin-top: 10px;
}

.empty-state,
.error-state,
.loading-state {
  text-align: center;
  padding: 40px 20px;
  color: #666;
  font-size: 13px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

.cyber-loader.small {
  width: 40px;
  height: 40px;
  border: 2px solid rgba(239, 90, 36, 0.3);
  border-top-color: #EF5A24;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Scrollbar styling */
.panel-content::-webkit-scrollbar {
  width: 6px;
}

.panel-content::-webkit-scrollbar-track {
  background: rgba(15, 30, 54, 0.5);
}

.panel-content::-webkit-scrollbar-thumb {
  background: rgba(239, 90, 36, 0.5);
  border-radius: 3px;
}

.panel-content::-webkit-scrollbar-thumb:hover {
  background: rgba(239, 90, 36, 0.8);
}
</style>
