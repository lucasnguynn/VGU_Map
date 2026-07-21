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

// ----------------------------------------------------
// [CẬP NHẬT] Lấy baseURL để sửa lỗi fetch file trên GitHub Pages
// ----------------------------------------------------
const config = useRuntimeConfig()
const base = config.app.baseURL

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

// ----------------------------------------------------------------
// Hệ số biến đổi Affine: CAD-XY (mét cục bộ, gốc riêng từng tòa) -> lat/lng thật.
// lon = a*x + b*y + c ; lat = d*x + e*y + f
// Lấy trực tiếp từ hệ thống MSI_Laboratories (đã giải sẵn bằng least-squares
// từ nhiều điểm đối chiếu CAD <-> GPS thật cho tòa B1 và B5).
// TODO: chưa có hệ số thật cho AD, B2, B3, B6 -> phòng các tòa này sẽ CHƯA
// hiển thị đúng vị trí cho tới khi có hệ số affine tương ứng.
// ----------------------------------------------------------------
const BUILDING_AFFINE = {
  B1: {
    a: 8.953441376466221e-9,
    b: -3.1497975865435756e-9,
    c: 106.61539732322666,
    d: 3.182455243237762e-9,
    e: 8.530074661663595e-9,
    f: 11.108226425177252
  },
  B5: {
    a: 9.348060047786096e-9,
    b: -3.137160929858734e-9,
    c: 106.61606158856533,
    d: 3.3218630132168528e-9,
    e: 8.497975978545847e-9,
    f: 11.108450685256834
  }
}

// Áp affine transform lên 1 vòng điểm [[x,y], ...].
// LƯU Ý: build_rooms_geojson.py đã đổi CAD-mm -> mét (UNIT_TO_METERS = 1/1000)
// khi xuất rooms/*.geojson, nhưng hệ số affine (a,b,c,d,e,f) bên dưới được giải
// sẵn trên toạ độ CAD-mm GỐC (chưa đổi đơn vị) -> phải nhân lại x1000 (m -> mm)
// trước khi áp affine, nếu không toàn bộ tòa nhà sẽ bị co lại thành 1 điểm.
const METERS_TO_MM = 1000

function transformRing(ring, coeffs) {
  return ring.map(([x, y]) => {
    const xMm = x * METERS_TO_MM
    const yMm = y * METERS_TO_MM
    return [
      coeffs.a * xMm + coeffs.b * yMm + coeffs.c,
      coeffs.d * xMm + coeffs.e * yMm + coeffs.f
    ]
  })
}

// Áp affine transform lên toàn bộ FeatureCollection của 1 tòa nhà.
// Nếu tòa chưa có hệ số affine (AD, B2, B3, B6), trả nguyên geojson gốc
// (toạ độ vẫn sai vị trí thật, nhưng ít nhất không crash).
function transformBuildingGeojson(buildingId, geojson) {
  const coeffs = BUILDING_AFFINE[buildingId]
  if (!coeffs) {
    console.warn(`[HologramMap] Chưa có hệ số affine cho tòa ${buildingId} — toạ độ phòng có thể sai vị trí thật.`)
    return geojson
  }

  return {
    type: 'FeatureCollection',
    features: geojson.features.map(f => ({
      ...f,
      geometry: {
        ...f.geometry,
        coordinates: f.geometry.coordinates.map(ring => transformRing(ring, coeffs))
      }
    }))
  }
}

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
    // [CẬP NHẬT] Thêm biến base và bỏ dấu '/' ở đầu
    const response = await fetch(`${base}campus-buildings.json`)
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
    // [CẬP NHẬT] Thêm biến base và bỏ dấu '/' ở đầu
    const response = await fetch(`${base}data/floors-config.json`)
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
    // [CẬP NHẬT] Thêm biến base và bỏ dấu '/' ở đầu
    const response = await fetch(`${base}data/rooms/${buildingId}.geojson`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const raw = await response.json()
    // Chuyển toạ độ CAD cục bộ -> lat/lng thật bằng affine transform (nếu có hệ số)
    const data = transformBuildingGeojson(buildingId, raw)
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
