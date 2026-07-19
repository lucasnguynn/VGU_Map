<template>
  <div class="app-container">
    <!-- NỀN TẢNG BẢN ĐỒ MAPLIBRE -->
    <div id="map-container" ref="mapElement" class="map-layer"></div>

    <!-- UI HUD (Tắt/Mở khi click vào tòa nhà/phòng) -->
    <transition name="cyber-slide">
      <div v-if="selectedRoom" class="cyber-panel">
        
        <!-- HEADER PHÒNG -->
        <div class="panel-header" :style="{ borderColor: ambientColor }">
          <div class="sys-status">TELEMETRY: ONLINE</div>
          <h2>{{ roomDetails?.name }}</h2>
          <div class="meta-info">
            <span>TÒA: {{ roomDetails?.building_id }}</span> | 
            <span>TẦNG: {{ roomDetails?.floor }}</span>
          </div>
          <button @click="closePanel" class="btn-close">[ ĐÓNG ]</button>
        </div>

        <div class="panel-content">
          <!-- THÔNG TIN PHỤ TRÁCH -->
          <div class="info-block">
            <h4>[ GIÁM SÁT VIÊN ]</h4>
            <p>{{ roomDetails?.head_of_lab?.name }}</p>
          </div>

          <!-- DANH SÁCH MÁY MÓC (Lấy từ content/equipment) -->
          <div v-if="equipmentList && equipmentList.length > 0" class="equipment-list">
            <h4>[ TÀI SẢN THIẾT BỊ ]</h4>
            
            <div v-for="equip in equipmentList" :key="equip.id" class="equip-card" :style="{ '--accent': equip.media.ambient_color }">
              <div class="equip-title">{{ equip.title }} - {{ equip.model }}</div>
              
              <!-- HIỆU ỨNG X-RAY FLASHLIGHT -->
              <div class="xray-container" @mousemove="updateFlashlight($event)" @mouseleave="hideFlashlight">
                <!-- Ảnh vỏ máy (Nền) -->
                <img :src="equip.media.images[0] || '/placeholder.jpg'" class="equip-img exterior" />
                <!-- Ảnh bản vẽ mạch (Ẩn dưới lớp mask) -->
                <img :src="equip.media.internal_blueprint || '/placeholder.svg'" class="equip-img blueprint" :style="flashlightStyle" />
              </div>

              <!-- Render nội dung Markdown động -->
              <ContentRenderer :value="equip" class="equip-desc" />
            </div>
          </div>
          
          <div v-else class="empty-state">
            [ KHÔNG TÌM THẤY DỮ LIỆU THIẾT BỊ TẠI PHÒNG NÀY ]
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import maplibregl from 'maplibre-gl'

// State Management
const mapElement = ref(null)
const selectedBuilding = ref(null)
const selectedRoom = ref(null)

// Dữ liệu từ Nuxt Content
const roomDetails = ref(null)
const equipmentList = ref([])
const ambientColor = computed(() => equipmentList.value[0]?.media?.ambient_color || '#00ffcc')

// Logic cho hiệu ứng X-Ray Flashlight
const flashlightPos = ref({ x: -100, y: -100 })
const isHovering = ref(false)

const updateFlashlight = (e) => {
  const rect = e.target.getBoundingClientRect()
  flashlightPos.value = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  isHovering.value = true
}
const hideFlashlight = () => { isHovering.value = false }

const flashlightStyle = computed(() => {
  if (!isHovering.value) return { clipPath: 'circle(0px at 0 0)' }
  return { clipPath: `circle(80px at ${flashlightPos.value.x}px ${flashlightPos.value.y}px)` }
})

// Đóng Panel
const closePanel = () => {
  selectedRoom.value = null
  roomDetails.value = null
}

// Khởi tạo MapLibre
onMounted(() => {
  const map = new maplibregl.Map({
    container: mapElement.value,
    style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json', // Futuristic Dark Map
    center: [106.6155, 11.1083],
    zoom: 17.5,
    pitch: 50,
    bearing: -17.6,
    antialias: true
  })

  map.on('load', async () => {
    // Giả lập load file campus-buildings.json của bạn
    map.addSource('vgu-campus', { type: 'geojson', data: '/campus-buildings.json' })
    
    map.addLayer({
      id: 'vgu-buildings-3d',
      type: 'fill-extrusion',
      source: 'vgu-campus',
      paint: {
        'fill-extrusion-color': '#0d1b2a',
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': ['get', 'base_height'],
        'fill-extrusion-opacity': 0.8,
      }
    })

    // Khi click vào tòa nhà trên bản đồ
    map.on('click', 'vgu-buildings-3d', async (e) => {
      const bId = e.features[0].properties.building_id
      
      // Giả lập: Lấy tạm 1 phòng trong toà nhà để test UI (Thực tế bạn sẽ show danh sách phòng trước)
      // Ở đây ta mô phỏng click thẳng vào phòng AD-247
      selectedRoom.value = "AD-247" 

      // 1. DÙNG NUXT CONTENT TÌM THÔNG TIN PHÒNG
      const labInfo = await queryContent('labs').where({ room_id: selectedRoom.value }).findOne()
      roomDetails.value = labInfo

      // 2. DÙNG NUXT CONTENT TÌM TẤT CẢ MÁY MÓC TRONG PHÒNG ĐÓ
      const equips = await queryContent('equipment').where({ 'location.room_id': selectedRoom.value }).find()
      equipmentList.value = equips
    })
  })
})
</script>

<style scoped>
.app-container { position: relative; width: 100vw; height: 100vh; overflow: hidden; background: #000; }
.map-layer { position: absolute; inset: 0; }

.cyber-panel {
  position: absolute;
  top: 20px; right: 20px; bottom: 20px;
  width: 450px;
  background: rgba(5, 10, 15, 0.65);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(0, 255, 204, 0.3);
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.8), inset 0 0 20px rgba(0, 255, 204, 0.05);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  font-family: 'Space Mono', monospace;
  color: #e0e0e0;
}

.panel-header {
  padding: 20px;
  background: linear-gradient(90deg, rgba(0,255,204,0.1) 0%, transparent 100%);
  border-bottom: 2px solid;
  position: relative;
}

.panel-header h2 { margin: 0; font-size: 22px; color: #fff; }

.btn-close { position: absolute; top: 15px; right: 15px; background: none; border: none; color: #ff3366; cursor: pointer; }

.equip-desc { font-size: 13px; line-height: 1.6; margin-top: 15px; color: #ccc; }

/* ANIMATION */
.cyber-slide-enter-active, .cyber-slide-leave-active { transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
.cyber-slide-enter-from, .cyber-slide-leave-to { transform: translateX(100%) skewX(-5deg); opacity: 0; }
</style>