<!-- components/HologramMap.vue -->
<template>
  <div ref="mapContainer" class="map-container"></div>

  <!-- ================= Thang máy chọn tầng (Elevator HUD) =================
       Chỉ hiện khi đã chọn 1 tòa nhà. Mỗi nút là 1 tầng, có 3 trạng thái:
       - active  : tầng đang xem (cam)
       - detail  : tầng có phòng đã cập nhật thông tin chi tiết (cyan phát sáng)
       - trơn    : tầng chỉ có hình khối, chưa có dữ liệu chi tiết
       Nút ✕ dưới cùng để thoát khỏi tòa nhà, quay lại toàn cảnh campus. -->
  <Transition name="hud-slide">
    <div v-if="currentBuildingId" class="elevator-hud" role="group" :aria-label="`Chọn tầng toà ${currentBuildingId}`">
      <div class="elevator-label">{{ currentBuildingId }}</div>

      <button
        v-for="floor in availableFloors"
        :key="floor"
        class="floor-btn"
        :class="{
          active: floor === currentFloor,
          detail: floorsWithDetail.has(floor) && floor !== currentFloor
        }"
        :aria-pressed="floor === currentFloor"
        :aria-label="floorsWithDetail.has(floor) ? `Tầng ${floor}, có dữ liệu chi tiết` : `Tầng ${floor}`"
        :title="floorsWithDetail.has(floor) ? `Tầng ${floor} — có dữ liệu chi tiết` : `Tầng ${floor}`"
        @click="selectFloor(floor)"
      >
        L{{ floor }}
      </button>

      <button class="floor-btn exit-btn" aria-label="Thoát khỏi toà nhà, về toàn cảnh" title="Thoát khỏi toà nhà" @click="exitBuilding">
        ✕
      </button>
    </div>
  </Transition>

  <!-- ================= Thông báo tòa chưa định vị GPS ================= -->
  <Transition name="fade">
    <div v-if="currentBuildingId && !isGeolocated" class="calib-notice">
      <span class="calib-dot"></span>
      Sơ đồ phòng tòa <b>{{ currentBuildingId }}</b> chưa được định vị GPS — đang chờ hiệu chỉnh tọa độ.
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
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
const emit = defineEmits(['room-selected', 'building-selected', 'floor-selected', 'ready'])

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

const INITIAL_BEARING = -17.6

// Cấu hình tầng theo tòa nhà (building_id -> [tầng...]), load 1 lần
let floorsConfig = {}
// Cache dữ liệu geojson của từng tầng đã fetch, tránh load lại
const floorCache = new Map()
// Tâm (centroid) mỗi tòa nhà, tính từ campus-buildings.json sau khi load
let buildingCenters = {}
// Bản đồ tên phòng: room_id -> { en, vi } (chỉ có cho AD, B3)
const roomNameMap = ref({})

// ----------------------------------------------------------------
// Hệ số biến đổi Affine: CAD-XY (mét cục bộ, gốc riêng từng tòa) -> lat/lng thật.
// lon = a*x + b*y + c ; lat = d*x + e*y + f
//
// - B1, B5: giải sẵn bằng least-squares từ điểm đối chiếu CAD <-> GPS thật
//   (nguồn: hệ thống MSI_Laboratories). Giữ nguyên vì đã kiểm chứng.
// - AD, B2, B3, B6: giải tự động bằng cách khớp 4 góc hình chữ nhật bao nhỏ
//   nhất của cụm phòng (CAD) với 4 góc footprint GPS trong campus-buildings.json.
//   Chiều xoay được chọn theo bearing chung của campus (~19.78°, lấy từ B1/B5)
//   và ràng buộc không phản chiếu (det > 0). Phương pháp này tái tạo lại affine
//   đã biết của B1/B5 với sai số RMS ~0.3–0.4m nên đáng tin cho 4 tòa còn lại.
//   Nếu footprint 1 tòa được hiệu chỉnh lại, cần giải lại affine tương ứng.
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
  },
  AD: {
    a: 8.766061793685426e-9,
    b: -2.9401918155464064e-9,
    c: 106.61628563445295,
    d: 2.949511826570467e-9,
    e: 8.738362378840202e-9,
    f: 11.107702556018145
  },
  B2: {
    a: 8.934000874052131e-9,
    b: -3.0617993522497056e-9,
    c: 106.61556743104268,
    d: 3.2196508335119185e-9,
    e: 8.496017971414428e-9,
    f: 11.107734813646012
  },
  B3: {
    a: 8.936440007959682e-9,
    b: -3.0696022659468247e-9,
    c: 106.61564963590135,
    d: 3.243586829736276e-9,
    e: 8.457006822971136e-9,
    f: 11.107323754174958
  },
  B6: {
    a: 8.875957765081311e-9,
    b: -3.145148965918998e-9,
    c: 106.6163603769583,
    d: 3.2835800566738925e-9,
    e: 8.501705317206016e-9,
    f: 11.107779247247372
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

// ---- Tiện ích hình học ----------------------------------------------------
// Khung tọa độ hợp lệ quanh VGU. Dùng để phát hiện tòa nhà CHƯA định vị GPS
// (dữ liệu phòng còn ở hệ CAD thô -> giá trị nằm ngoài khung này).
const VGU_BOUNDS = { minLon: 106.60, maxLon: 106.63, minLat: 11.10, maxLat: 11.12 }
function isLatLng([lon, lat]) {
  return lon >= VGU_BOUNDS.minLon && lon <= VGU_BOUNDS.maxLon
    && lat >= VGU_BOUNDS.minLat && lat <= VGU_BOUNDS.maxLat
}

function polygonCentroid(coordinates) {
  const pts = coordinates[0]
  let sx = 0, sy = 0
  const n = pts.length - 1
  for (let i = 0; i < n; i++) { sx += pts[i][0]; sy += pts[i][1] }
  return [sx / n, sy / n]
}

// ---- Trạng thái phản ứng ---------------------------------------------------
const currentBuildingId = ref(null)
const currentFloor = ref(null)
const currentRoomId = ref(null)
const availableFloors = ref([])
const isGeolocated = ref(false)
// geojson đã transform của tòa đang chọn (để tra centroid phòng, đặt marker)
let currentBuildingGeojson = null

// Tập các tầng (của tòa đang chọn) có ít nhất 1 phòng đã cập nhật thông tin chi tiết
const floorsWithDetail = computed(() => {
  const s = new Set()
  if (!currentBuildingGeojson) return s
  for (const f of currentBuildingGeojson.features) {
    const p = f.properties || {}
    if (p.room_id && roomNameMap.value[p.room_id]) s.add(p.floor)
  }
  return s
})

// ---- Khởi tạo bản đồ -------------------------------------------------------
onMounted(() => {
  if (!mapContainer.value) return

  map = new maplibregl.Map({
    container: mapContainer.value,
    style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    center: props.initialCenter,
    zoom: props.initialZoom,
    pitch: props.initialPitch,
    bearing: INITIAL_BEARING,
    antialias: true
  })

  map.addControl(new maplibregl.NavigationControl(), 'top-right')
  map.addControl(new maplibregl.ScaleControl(), 'bottom-left')

  map.on('load', async () => {
    console.log('[HologramMap] Map loaded successfully')
    try {
      await Promise.all([
        loadCampusBuildings(),
        initRoomsLayer(),
        loadFloorsConfig(),
        loadRoomNames()
      ])
    } catch (e) {
      console.error('[HologramMap] Init error:', e)
    } finally {
      // Báo parent tắt overlay loading dù thành công hay có lỗi cục bộ.
      emit('ready')
    }
  })

  // Click vào tòa nhà -> vào tòa đó
  map.on('click', 'vgu-buildings-3d', (e) => {
    const feature = e.features[0]
    const buildingId = feature.properties?.building_id || feature.properties?.cluster_id
    if (buildingId) selectBuilding(buildingId)
  })

  // Click vào phòng (polygon) -> mở chi tiết + bay tới phòng
  map.on('click', 'vgu-rooms-fill', (e) => {
    const feature = e.features[0]
    const roomId = feature.properties?.room_id
    if (roomId) {
      selectRoom(roomId, polygonCentroid(feature.geometry.coordinates), feature.properties)
    }
  })

  // Con trỏ phản hồi khi hover
  const setPointer = (v) => () => { map.getCanvas().style.cursor = v ? 'pointer' : '' }
  map.on('mouseenter', 'vgu-buildings-3d', setPointer(true))
  map.on('mouseleave', 'vgu-buildings-3d', setPointer(false))
  map.on('mouseenter', 'vgu-rooms-fill', setPointer(true))
  map.on('mouseleave', 'vgu-rooms-fill', setPointer(false))
})

// ---- Nạp khối 3D các tòa nhà + layer focus ---------------------------------
async function loadCampusBuildings() {
  try {
    const response = await fetch(`${base}campus-buildings.json`)
    const data = await response.json()

    // Tính tâm mỗi tòa để camera bay tới khi chọn
    buildingCenters = {}
    for (const f of data.features) {
      const id = f.properties?.building_id || f.id
      if (id && f.geometry?.type === 'Polygon') {
        buildingCenters[id] = polygonCentroid(f.geometry.coordinates)
      }
    }

    map.addSource('vgu-campus', { type: 'geojson', data })

    // Khối 3D của TẤT CẢ các tòa (nền)
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

    // Viền cam của tất cả các tòa
    map.addLayer({
      id: 'vgu-buildings-outline',
      type: 'line',
      source: 'vgu-campus',
      paint: { 'line-color': '#EF5A24', 'line-width': 1, 'line-opacity': 0.6 }
    })

    // Khối 3D "vỏ trong suốt" cho tòa đang chọn (hiệu ứng X-ray)
    map.addLayer({
      id: 'vgu-selected-3d',
      type: 'fill-extrusion',
      source: 'vgu-campus',
      paint: {
        'fill-extrusion-color': '#0C2B5C',
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': ['get', 'base_height'],
        'fill-extrusion-opacity': 0.12
      },
      filter: ['==', ['get', 'building_id'], '']
    })

    // Viền sáng đậm cho tòa đang chọn
    map.addLayer({
      id: 'vgu-selected-outline',
      type: 'line',
      source: 'vgu-campus',
      paint: { 'line-color': '#EF5A24', 'line-width': 3, 'line-opacity': 0.95 },
      filter: ['==', ['get', 'building_id'], '']
    })

    console.log('[HologramMap] Campus buildings loaded')
  } catch (error) {
    console.error('[HologramMap] Failed to load campus buildings:', error)
  }
}

// ---- Layer phòng (rỗng ban đầu) --------------------------------------------
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
    paint: { 'line-color': '#00ffcc', 'line-width': 1.5, 'line-opacity': 0.8 }
  })
}

// ---- Cấu hình tầng ---------------------------------------------------------
async function loadFloorsConfig() {
  try {
    const response = await fetch(`${base}data/floors-config.json`)
    floorsConfig = await response.json()
  } catch (error) {
    console.error('[HologramMap] Failed to load floors-config.json:', error)
  }
}

// ---- Bản đồ tên phòng (từ info_data.json; hiện chỉ có AD & B3) --------------
async function loadRoomNames() {
  try {
    const response = await fetch(`${base}data/info_data.json`)
    const json = await response.json()
    const rows = Array.isArray(json) ? json : (json?.data || [])
    const map_ = {}
    for (const r of rows) {
      // Khớp theo room_number (đúng với room_id trong geojson của AD/B3)
      const key = r.room_number
      if (!key) continue
      const en = (r.heading_1 || '').trim()
      const vi = (r.heading_2 || '').trim()
      if (en || vi) map_[key] = { en, vi }
    }
    roomNameMap.value = map_
    console.log('[HologramMap] Room names loaded:', Object.keys(map_).length)
  } catch (error) {
    console.warn('[HologramMap] Không tải được info_data.json (tên phòng):', error)
  }
}

// ---- Chọn tòa nhà ----------------------------------------------------------
async function selectBuilding(buildingId) {
  if (buildingId === currentBuildingId.value) return
  currentBuildingId.value = buildingId
  currentRoomId.value = null

  const floors = floorsConfig[buildingId] || []
  availableFloors.value = [...floors].sort((a, b) => a - b)

  // Hiệu ứng focus: làm mờ các tòa khác, làm nổi tòa đang chọn
  map.setFilter('vgu-buildings-3d', ['!=', ['get', 'building_id'], buildingId])
  map.setFilter('vgu-buildings-outline', ['!=', ['get', 'building_id'], buildingId])
  map.setFilter('vgu-selected-3d', ['==', ['get', 'building_id'], buildingId])
  map.setFilter('vgu-selected-outline', ['==', ['get', 'building_id'], buildingId])

  // Camera bay tới, nhìn từ trên xuống để xem sơ đồ tầng
  const center = buildingCenters[buildingId] || props.initialCenter
  map.flyTo({ center, zoom: 19.2, pitch: 0, bearing: 0, duration: 1500 })

  // Nạp phòng của tòa (đã transform sang lat/lng nếu có affine)
  currentBuildingGeojson = await getBuildingRoomsData(buildingId)

  // Kiểm tra tòa đã định vị GPS chưa (toạ độ nằm trong khung VGU)
  isGeolocated.value = !!(currentBuildingGeojson?.features?.length
    && isLatLng(currentBuildingGeojson.features[0].geometry.coordinates[0][0]))

  if (isGeolocated.value && map.getSource('vgu-rooms')) {
    map.getSource('vgu-rooms').setData(currentBuildingGeojson)
  } else {
    // Chưa định vị -> không đổ polygon sai ra bản đồ
    if (map.getSource('vgu-rooms')) {
      map.getSource('vgu-rooms').setData({ type: 'FeatureCollection', features: [] })
    }
  }

  // Emit lên parent để mở/đồng bộ HUD ngữ cảnh
  const defaultFloor = availableFloors.value[0] ?? null
  emit('building-selected', { buildingId, floor: defaultFloor })

  if (defaultFloor != null) selectFloor(defaultFloor)
}

// ---- Đổi tầng --------------------------------------------------------------
function selectFloor(floorNumber) {
  currentFloor.value = floorNumber
  currentRoomId.value = null

  const filter = ['all',
    ['==', ['get', 'floor'], floorNumber],
    currentBuildingId.value ? ['==', ['get', 'building_id'], currentBuildingId.value] : true
  ]
  map.setFilter('vgu-rooms-fill', filter)
  map.setFilter('vgu-rooms-outline', filter)

  renderRoomMarkers(floorNumber)
  emit('floor-selected', { buildingId: currentBuildingId.value, floor: floorNumber })
}

// ---- Chọn phòng ------------------------------------------------------------
function selectRoom(roomId, centroid, propsObj = {}) {
  currentRoomId.value = roomId
  emit('room-selected', {
    roomId,
    buildingId: propsObj.building_id || currentBuildingId.value,
    floor: propsObj.floor ?? currentFloor.value
  })
  if (centroid && isLatLng(centroid)) {
    map.flyTo({ center: centroid, zoom: 20.6, pitch: 30, bearing: 10, duration: 1200 })
  }
}

// ---- Thoát khỏi tòa nhà ----------------------------------------------------
function exitBuilding() {
  currentBuildingId.value = null
  currentFloor.value = null
  currentRoomId.value = null
  availableFloors.value = []
  isGeolocated.value = false
  currentBuildingGeojson = null

  clearRoomMarkers()

  // Khôi phục hiển thị toàn bộ khối tòa nhà
  map.setFilter('vgu-buildings-3d', null)
  map.setFilter('vgu-buildings-outline', null)
  map.setFilter('vgu-selected-3d', ['==', ['get', 'building_id'], ''])
  map.setFilter('vgu-selected-outline', ['==', ['get', 'building_id'], ''])

  // Ẩn layer phòng
  if (map.getSource('vgu-rooms')) {
    map.getSource('vgu-rooms').setData({ type: 'FeatureCollection', features: [] })
  }

  // Camera bay về toàn cảnh campus
  map.flyTo({
    center: props.initialCenter,
    zoom: props.initialZoom,
    pitch: props.initialPitch,
    bearing: INITIAL_BEARING,
    duration: 1500
  })

  // Báo parent: đã rời tòa (store sẽ tự clear cả phòng đang mở)
  emit('building-selected', { buildingId: null, floor: null })
}

// ---- Marker phòng (chấm phát sáng + thẻ nhãn) ------------------------------
let roomMarkers = []

function clearRoomMarkers() {
  roomMarkers.forEach(m => m.remove())
  roomMarkers = []
}

function renderRoomMarkers(floorNumber) {
  clearRoomMarkers()
  if (!isGeolocated.value || !currentBuildingGeojson) return

  const rooms = currentBuildingGeojson.features.filter(
    f => f.properties?.floor === floorNumber
  )

  rooms.forEach(room => {
    const centroid = polygonCentroid(room.geometry.coordinates)
    if (!isLatLng(centroid)) return

    const roomId = room.properties.room_id
    const name = roomNameMap.value[roomId]
    const label = name ? (name.vi || name.en) : ''

    const el = document.createElement('div')
    // Dự án KHÔNG dùng Tailwind nên đặt style trực tiếp (các class utility trước
    // đây là vô tác dụng). width/height 0 để marker tự canh giữa quanh centroid.
    el.className = 'vgu-room-marker'
    el.style.cssText = 'position:relative;width:0;height:0;cursor:pointer;pointer-events:auto;'
    el.innerHTML = `
      <div class="room-dot">
        <span class="room-ping"></span>
        <span class="room-core"></span>
      </div>
      <div class="room-marker-card">
        <div class="room-marker-id">${roomId}</div>
        ${label ? `<div class="room-marker-name">${label}</div>` : ''}
      </div>
    `
    el.addEventListener('click', (e) => {
      e.stopPropagation()
      selectRoom(roomId, centroid, room.properties)
    })

    const marker = new maplibregl.Marker({ element: el }).setLngLat(centroid).addTo(map)
    roomMarkers.push(marker)
  })
}

// ---- Fetch + cache phòng của 1 tòa (gộp mọi tầng), transform về lat/lng -----
async function getBuildingRoomsData(buildingId) {
  if (floorCache.has(buildingId)) return floorCache.get(buildingId)
  try {
    const response = await fetch(`${base}data/rooms/${buildingId}.geojson`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const raw = await response.json()
    const data = transformBuildingGeojson(buildingId, raw)
    floorCache.set(buildingId, data)
    return data
  } catch (error) {
    console.error(`[HologramMap] Failed to load rooms for building ${buildingId}:`, error)
    return null
  }
}

onUnmounted(() => {
  clearRoomMarkers()
  if (map) { map.remove(); map = null }
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
:deep(.maplibregl-ctrl button) { background: transparent; color: #00ffcc; }
:deep(.maplibregl-ctrl button:hover) { background: rgba(239, 90, 36, 0.2); }

:deep(.maplibregl-popup-content) {
  background: rgba(15, 30, 54, 0.95);
  border: 1px solid rgba(239, 90, 36, 0.4);
  color: white;
  font-family: 'Be Vietnam Pro', sans-serif;
  backdrop-filter: blur(8px);
}
:deep(.maplibregl-popup-tip) { border-top-color: rgba(15, 30, 54, 0.95); }

/* ================= Thang máy chọn tầng ================= */
.elevator-hud {
  position: absolute;
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 8px;
  background: rgba(15, 30, 54, 0.9);
  border: 1px solid rgba(239, 90, 36, 0.3);
  border-radius: 999px;
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
}

.elevator-label {
  text-align: center;
  font-family: 'Space Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #EF5A24;
  padding-bottom: 4px;
  margin-bottom: 2px;
  border-bottom: 1px solid rgba(239, 90, 36, 0.2);
}

.floor-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.7);
  font-family: 'Space Mono', monospace;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.25s ease;
}
.floor-btn:hover {
  border-color: rgba(239, 90, 36, 0.6);
  color: #fff;
}

/* Tầng có dữ liệu chi tiết -> viền + chữ cyan phát sáng */
.floor-btn.detail {
  border-color: rgba(6, 182, 212, 0.6);
  background: rgba(6, 182, 212, 0.08);
  color: #06B6D4;
  box-shadow: 0 0 8px rgba(6, 182, 212, 0.25);
}
.floor-btn.detail:hover { color: #fff; border-color: #06B6D4; }

/* Tầng đang xem -> cam đặc, phát sáng mạnh */
.floor-btn.active {
  background: #EF5A24;
  border-color: #EF5A24;
  color: #fff;
  box-shadow: 0 0 12px #EF5A24;
}

.exit-btn {
  margin-top: 4px;
  color: #EF5A24;
  border-color: rgba(239, 90, 36, 0.25);
  font-size: 14px;
}
.exit-btn:hover { background: rgba(239, 90, 36, 0.12); color: #fff; }

/* ================= Thông báo chưa định vị ================= */
.calib-notice {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 90vw;
  padding: 10px 18px;
  background: rgba(15, 30, 54, 0.92);
  border: 1px solid rgba(239, 90, 36, 0.4);
  border-radius: 6px;
  backdrop-filter: blur(8px);
  color: #e0e0e0;
  font-family: 'Space Mono', monospace;
  font-size: 12px;
  line-height: 1.4;
}
.calib-notice b { color: #EF5A24; }
.calib-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #EF5A24;
  box-shadow: 0 0 8px #EF5A24;
  animation: calib-pulse 1.4s ease-in-out infinite;
  flex-shrink: 0;
}
@keyframes calib-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.6); }
}

/* ================= Marker phòng ================= */
:deep(.room-dot) {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}
:deep(.room-ping) {
  position: absolute;
  display: inline-flex;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: #EF5A24;
  opacity: 0.75;
  animation: room-ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
}
:deep(.room-core) {
  position: relative;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #EF5A24;
  box-shadow: 0 0 6px #EF5A24;
}
@keyframes room-ping {
  75%, 100% { transform: scale(2); opacity: 0; }
}
:deep(.room-marker-card) {
  position: absolute;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  min-width: 96px;
  max-width: 160px;
  padding: 5px 10px;
  text-align: center;
  border-radius: 4px;
  background: rgba(15, 30, 54, 0.95);
  border: 1px solid rgba(239, 90, 36, 0.3);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(6px);
  transition: transform 0.2s ease, border-color 0.2s ease;
}
:deep(.room-marker-card:hover) {
  transform: translateX(-50%) scale(1.05);
  border-color: #EF5A24;
}
:deep(.room-marker-id) {
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.5px;
  color: #EF5A24;
  text-transform: uppercase;
}
:deep(.room-marker-name) {
  font-family: 'Be Vietnam Pro', sans-serif;
  font-size: 9px;
  line-height: 1.2;
  color: rgba(255, 255, 255, 0.82);
  margin-top: 2px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ================= Transitions ================= */
.hud-slide-enter-active, .hud-slide-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.hud-slide-enter-from, .hud-slide-leave-to {
  opacity: 0;
  transform: translateY(-50%) translateX(-16px);
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* Tôn trọng người dùng tắt hiệu ứng chuyển động */
@media (prefers-reduced-motion: reduce) {
  :deep(.room-ping) { animation: none; opacity: 0.4; }
  .calib-dot { animation: none; }
  .hud-slide-enter-active, .hud-slide-leave-active,
  .fade-enter-active, .fade-leave-active { transition: none; }
}

/* Responsive: thu nhỏ thang máy trên màn hình hẹp */
@media (max-width: 640px) {
  .elevator-hud { left: 10px; gap: 6px; padding: 8px 6px; }
  .floor-btn { width: 34px; height: 34px; font-size: 11px; }
  :deep(.room-marker-card) { min-width: 84px; max-width: 130px; padding: 4px 8px; }
  :deep(.room-marker-id) { font-size: 9px; }
  :deep(.room-marker-name) { font-size: 8px; -webkit-line-clamp: 1; }
}
</style>
