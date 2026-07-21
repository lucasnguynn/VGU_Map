<!-- components/HologramMap.vue -->
<template>
  <div ref="mapContainer" class="map-container"></div>

  <!-- Bộ chọn tầng, chỉ hiện khi đã chọn 1 tòa nhà có nhiều tầng -->
  <div v-if="availableFloors.length > 1" class="floor-switcher">
    <button
      v-for="floor in availableFloors"
      :key="floor"
      class="floor-btn"
      :class="{ active: floor === currentFloor }"
      @click="selectFloor(floor)"
    >
      {{ floor }}
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const mapContainer = ref(null)
let map = null

// Emit events lên parent
const emit = defineEmits(['room-selected', 'building-selected'])

// Props từ parent (nếu cần)
const props = defineProps({
  initialCenter: {
    type: Array,
    default: () => [106.6155, 11.1083] // Tọa độ VGU
  },
  initialZoom: {
    type: Number,
    default: 17.5
  },
  initialPitch: {
    type: Number,
    default: 45
  }
})

// Cấu hình tầng theo tòa nhà (building_id -> [tầng...]), load 1 lần
let floorsConfig = {}
// Cache dữ liệu geojson của từng tầng đã fetch, tránh load lại
const floorCache = new Map()

const currentBuildingId = ref(null)
const currentFloor = ref(null)
const availableFloors = ref([])

onMounted(() => {
  if (!mapContainer.value) return

  // Khởi tạo MapLibre
  map = new maplibregl.Map({
    container: mapContainer.value,
    style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    center: props.initialCenter,
    zoom: props.initialZoom,
    pitch: props.initialPitch,
    bearing: -17.6,
    antialias: true
  })

  // Add navigation controls
  map.addControl(new maplibregl.NavigationControl(), 'top-right')
  map.addControl(new maplibregl.ScaleControl(), 'bottom-left')

  // Khi map load xong
  map.on('load', async () => {
    console.log('[HologramMap] Map loaded successfully')

    // Load campus buildings + khung layer phòng (rỗng ban đầu) + cấu hình tầng
    await Promise.all([
      loadCampusBuildings(),
      initRoomsLayer(),
      loadFloorsConfig()
    ])
  })

  // Handle click events trên buildings
  map.on('click', 'vgu-buildings-3d', (e) => {
    const feature = e.features[0]
    const buildingId = feature.properties?.building_id || feature.properties?.cluster_id

    if (buildingId) {
      emit('building-selected', {
        buildingId,
        floor: currentFloor.value
      })
      selectBuilding(buildingId)
    }
  })

  // Handle click events trên rooms
  map.on('click', 'vgu-rooms-fill', (e) => {
    const feature = e.features[0]
    const roomId = feature.properties?.room_id

    if (roomId) {
      emit('room-selected', {
        roomId,
        buildingId: feature.properties?.building_id,
        floor: feature.properties?.floor ?? currentFloor.value
      })
    }
  })

  // Hover effect - buildings
  map.on('mouseenter', 'vgu-buildings-3d', () => {
    map.getCanvas().style.cursor = 'pointer'
  })
  map.on('mouseleave', 'vgu-buildings-3d', () => {
    map.getCanvas().style.cursor = ''
  })

  // Hover effect - rooms
  map.on('mouseenter', 'vgu-rooms-fill', () => {
    map.getCanvas().style.cursor = 'pointer'
  })
  map.on('mouseleave', 'vgu-rooms-fill', () => {
    map.getCanvas().style.cursor = ''
  })
})

// Load campus buildings từ JSON
async function loadCampusBuildings() {
  try {
    const response = await fetch('/campus-buildings.json')
    const data = await response.json()

    // Add source
    map.addSource('vgu-campus', {
      type: 'geojson',
      data: data
    })

    // Add 3D buildings layer
    map.addLayer({
      id: 'vgu-buildings-3d',
      type: 'fill-extrusion',
      source: 'vgu-campus',
      paint: {
        'fill-extrusion-color': '#1a1a2e',
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': ['get', 'base_height'],
        'fill-extrusion-opacity': 0.9
      }
    })

    // Add outline layer
    map.addLayer({
      id: 'vgu-buildings-outline',
      type: 'line',
      source: 'vgu-campus',
      paint: {
        'line-color': '#EF5A24',
        'line-width': 1,
        'line-opacity': 0.6
      }
    })

    console.log('[HologramMap] Campus buildings loaded')
  } catch (error) {
    console.error('[HologramMap] Failed to load campus buildings:', error)
  }
}

// Tạo source + layer cho phòng (rỗng ban đầu), dữ liệu sẽ được nạp khi chọn tòa nhà
async function initRoomsLayer() {
  map.addSource('vgu-rooms', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  })

  map.addLayer({
    id: 'vgu-rooms-fill',
    type: 'fill',
    source: 'vgu-rooms',
    paint: {
      'fill-color': [
        'match', ['get', 'type'],
        'laboratory', '#00ffcc',
        'corridor', '#334155',
        '#EF5A24'
      ],
      'fill-opacity': 0.35
    }
  })

  map.addLayer({
    id: 'vgu-rooms-outline',
    type: 'line',
    source: 'vgu-rooms',
    paint: {
      'line-color': '#00ffcc',
      'line-width': 1.5,
      'line-opacity': 0.8
    }
  })
}

// Load cấu hình tầng cho từng tòa nhà
async function loadFloorsConfig() {
  try {
    const response = await fetch('/data/floors-config.json')
    floorsConfig = await response.json()
  } catch (error) {
    console.error('[HologramMap] Failed to load floors-config.json:', error)
  }
}

// Được gọi khi người dùng click vào 1 tòa nhà
async function selectBuilding(buildingId) {
  currentBuildingId.value = buildingId
  const floors = floorsConfig[buildingId] || []
  availableFloors.value = [...floors].sort((a, b) => a - b)

  if (!availableFloors.value.length) return

  // Nạp toàn bộ phòng của tòa nhà này (tất cả các tầng), rồi lọc hiển thị theo tầng
  const geojson = await getBuildingRoomsData(buildingId)
  if (geojson && map.getSource('vgu-rooms')) {
    map.getSource('vgu-rooms').setData(geojson)
  }

  // Mặc định vào tầng 1 (hoặc tầng nhỏ nhất có sẵn)
  const defaultFloor = availableFloors.value[0]
  selectFloor(defaultFloor)
}

// Được gọi khi người dùng đổi tầng — dữ liệu tòa nhà đã nạp sẵn ở selectBuilding(),
// đổi tầng chỉ cần đổi filter, không cần fetch lại
function selectFloor(floorNumber) {
  currentFloor.value = floorNumber

  const filter = ['all',
    ['==', ['get', 'floor'], floorNumber],
    currentBuildingId.value ? ['==', ['get', 'building_id'], currentBuildingId.value] : true
  ]
  map.setFilter('vgu-rooms-fill', filter)
  map.setFilter('vgu-rooms-outline', filter)
}

// Fetch + cache dữ liệu geojson phòng của 1 tòa nhà (gộp tất cả các tầng của tòa đó)
// Nguồn: public/data/rooms/{building_id}.geojson — dựng từ CSV CAD thật bằng
// scripts/build_rooms_geojson.py (xem README trong file đó về hệ tọa độ).
async function getBuildingRoomsData(buildingId) {
  if (floorCache.has(buildingId)) return floorCache.get(buildingId)

  try {
    const response = await fetch(`/data/rooms/${buildingId}.geojson`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    floorCache.set(buildingId, data)
    return data
  } catch (error) {
    console.error(`[HologramMap] Failed to load rooms for building ${buildingId}:`, error)
    return null
  }
}

onUnmounted(() => {
  if (map) {
    map.remove()
    map = null
  }
})
</script>

<style scoped>
.map-container {
  width: 100%;
  height: 100vh;
  position: absolute;
  top: 0;
  left: 0;
}

/* Customize MapLibre controls */
:deep(.maplibregl-ctrl) {
  background: rgba(15, 30, 54, 0.9);
  border: 1px solid rgba(239, 90, 36, 0.3);
  border-radius: 4px;
}

:deep(.maplibregl-ctrl button) {
  background: transparent;
  color: #00ffcc;
}

:deep(.maplibregl-ctrl button:hover) {
  background: rgba(239, 90, 36, 0.2);
}

:deep(.maplibregl-popup-content) {
  background: rgba(15, 30, 54, 0.95);
  border: 1px solid rgba(239, 90, 36, 0.4);
  color: white;
  font-family: 'Be Vietnam Pro', sans-serif;
  backdrop-filter: blur(8px);
}

:deep(.maplibregl-popup-tip) {
  border-top-color: rgba(15, 30, 54, 0.95);
}

.floor-switcher {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 6px;
  padding: 6px;
  background: rgba(15, 30, 54, 0.85);
  border: 1px solid rgba(0, 255, 204, 0.3);
  border-radius: 6px;
  backdrop-filter: blur(8px);
  z-index: 10;
}

.floor-btn {
  min-width: 36px;
  padding: 8px 10px;
  background: transparent;
  border: 1px solid rgba(0, 255, 204, 0.2);
  border-radius: 4px;
  color: #00ffcc;
  font-family: 'Space Mono', monospace;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.floor-btn:hover {
  background: rgba(0, 255, 204, 0.1);
}

.floor-btn.active {
  background: rgba(239, 90, 36, 0.25);
  border-color: #EF5A24;
  color: #fff;
}
</style>
