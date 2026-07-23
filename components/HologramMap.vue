<!-- components/HologramMap.vue -->
<template>
  <div ref="mapContainer" class="map-container"></div>

  <!-- ================= Thanh tìm kiếm toàn cục (Global Search) ================= -->
  <!-- Đứng độc lập, luôn hiển thị. Sẽ tự thay đổi placeholder và logic lọc khi click vào toà -->
  <div class="global-search-container">
    <div class="search-wrapper">
      <!-- Icon kính lúp -->
      <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
      <input
        v-model="searchQuery"
        type="text"
        class="global-search-input"
        :placeholder="currentBuildingId ? `Tìm phòng trong toà ${currentBuildingId}…` : 'Tìm phòng trên toàn Campus…'"
        @input="onSearchInput"
        @focus="onSearchInput"
      />
    </div>
    
    <div v-if="searchResults.length > 0" class="global-search-results">
      <button
        v-for="r in searchResults"
        :key="r.id"
        class="global-search-item"
        @click="goToRoom(r)"
      >
        <div class="rs-info">
          <span class="rs-id">{{ r.roomNumber }}</span>
          <!-- Hàm lọc lặp tên vẫn được giữ nguyên -->
          <span class="rs-name">{{ formatRoomName(r.roomName) }}</span>
        </div>
        <!-- Chỉ hiện thẻ tên Toà nếu đang tìm ở chế độ Campus -->
        <span v-if="!currentBuildingId" class="rs-building">{{ r.buildingId }}</span>
      </button>
    </div>
    <div v-else-if="searchQuery.trim() && !isSearching" class="global-search-results">
      <div class="room-search-empty">Không tìm thấy phòng phù hợp.</div>
    </div>
  </div>

  <!-- ================= Thang máy chọn tầng (Elevator HUD) ================= -->
  <Transition name="hud-slide">
    <div v-if="currentBuildingId" class="floor-bar" role="group" :aria-label="`Chọn tầng toà ${currentBuildingId}`">
      <button class="floor-btn exit-btn" aria-label="Thoát khỏi toà nhà, về toàn cảnh" title="Thoát khỏi toà nhà" @click="exitBuilding">
        ✕
      </button>

      <div class="floor-bar-label">{{ currentBuildingId }}</div>

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
    </div>
  </Transition>

  <!-- ================= Thông báo tòa chưa định vị GPS ================= -->
  <Transition name="fade">
    <div v-if="currentBuildingId && !isGeolocated" class="calib-notice">
      <span class="calib-dot"></span>
      Sơ đồ phòng tòa <b>{{ currentBuildingId }}</b> chưa được định vị GPS — đang chờ hiệu chỉnh tọa độ.
    </div>
  </Transition>

  <!-- ================= Bảng thông tin chi tiết phòng ================= -->
  <Transition name="fade">
    <RoomDetailPanel
      v-if="currentRoomId"
      :room-id="currentRoomId"
      :building-id="currentBuildingId"
      @close="closeRoomDetail"
    />
  </Transition>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import RoomDetailPanel from '~/components/RoomDetailPanel.vue'

const { searchRooms } = useVguData()

const config = useRuntimeConfig()
const base = config.app.baseURL

const mapContainer = ref(null)
let map = null

const emit = defineEmits(['room-selected', 'building-selected', 'floor-selected', 'equipment-selected', 'ready'])

const props = defineProps({
  initialCenter: {
    type: Array,
    default: () => [106.6155, 11.1083]
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

let floorsConfig = {}
const floorCache = new Map()
let buildingCenters = {}
const roomNameMap = ref({})

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

const BUILDING_AFFINE = {
  B1: {
    a: 8.953441376466221e-9, b: -3.1497975865435756e-9, c: 106.61539732322666,
    d: 3.182455243237762e-9, e: 8.530074661663595e-9, f: 11.108226425177252
  },
  B5: {
    a: 9.348060047786096e-9, b: -3.137160929858734e-9, c: 106.61606158856533,
    d: 3.3218630132168528e-9, e: 8.497975978545847e-9, f: 11.108450685256834
  },
  AD: {
    a: 8.766061793685426e-9, b: -2.9401918155464064e-9, c: 106.61628563445295,
    d: 2.949511826570467e-9, e: 8.738362378840202e-9, f: 11.107702556018145
  },
  B2: {
    a: 8.934000874052131e-9, b: -3.0617993522497056e-9, c: 106.61556743104268,
    d: 3.2196508335119185e-9, e: 8.496017971414428e-9, f: 11.107734813646012
  },
  B3: {
    a: 8.936440007959682e-9, b: -3.0696022659468247e-9, c: 106.61564963590135,
    d: 3.243586829736276e-9, e: 8.457006822971136e-9, f: 11.107323754174958
  },
  B6: {
    a: 8.875957765081311e-9, b: -3.145148965918998e-9, c: 106.6163603769583,
    d: 3.2835800566738925e-9, e: 8.501705317206016e-9, f: 11.107779247247372
  }
}

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

function transformBuildingGeojson(buildingId, geojson) {
  const coeffs = BUILDING_AFFINE[buildingId]
  if (!coeffs) return geojson
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

const currentBuildingId = ref(null)
const currentFloor = ref(null)
const currentRoomId = ref(null)
const availableFloors = ref([])
const isGeolocated = ref(false)
let currentBuildingGeojson = null

const floorsWithDetail = computed(() => {
  const s = new Set()
  if (!currentBuildingGeojson) return s
  for (const f of currentBuildingGeojson.features) {
    const p = f.properties || {}
    if (p.room_id && roomNameMap.value[p.room_id]) s.add(p.floor)
  }
  return s
})

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
      emit('ready')
    }
  })

  map.on('click', 'vgu-buildings-3d', (e) => {
    const feature = e.features[0]
    const buildingId = feature.properties?.building_id || feature.properties?.cluster_id
    if (buildingId) selectBuilding(buildingId)
  })

  map.on('click', 'vgu-rooms-fill', (e) => {
    const feature = e.features[0]
    const roomId = feature.properties?.room_id
    if (roomId) {
      selectRoom(roomId, polygonCentroid(feature.geometry.coordinates), feature.properties)
    }
  })

  const setPointer = (v) => () => { map.getCanvas().style.cursor = v ? 'pointer' : '' }
  map.on('mouseenter', 'vgu-buildings-3d', setPointer(true))
  map.on('mouseleave', 'vgu-buildings-3d', setPointer(false))
  map.on('mouseenter', 'vgu-rooms-fill', setPointer(true))
  map.on('mouseleave', 'vgu-rooms-fill', setPointer(false))

  // ===== Hover highlight cho từng khối thiết bị trong phòng =====
  map.on('mousemove', 'vgu-equipment-fill', (e) => {
    if (!e.features.length) return
    map.getCanvas().style.cursor = 'pointer'
    const id = e.features[0].id
    if (hoveredEquipmentId !== null && hoveredEquipmentId !== id) {
      map.setFeatureState({ source: 'vgu-equipment', id: hoveredEquipmentId }, { hover: false })
    }
    if (id !== undefined && hoveredEquipmentId !== id) {
      hoveredEquipmentId = id
      map.setFeatureState({ source: 'vgu-equipment', id }, { hover: true })
    }
  })
  map.on('mouseleave', 'vgu-equipment-fill', () => {
    map.getCanvas().style.cursor = ''
    if (hoveredEquipmentId !== null) {
      map.setFeatureState({ source: 'vgu-equipment', id: hoveredEquipmentId }, { hover: false })
      hoveredEquipmentId = null
    }
  })
  map.on('click', 'vgu-equipment-fill', (e) => {
    const feature = e.features[0]
    const equipmentId = feature?.properties?.equipment_id
    if (equipmentId) emit('equipment-selected', { equipmentId, roomId: currentRoomId.value })
  })
})

async function loadCampusBuildings() {
  try {
    const response = await fetch(`${base}campus-buildings.json`)
    const data = await response.json()

    buildingCenters = {}
    for (const f of data.features) {
      const id = f.properties?.building_id || f.id
      if (id && f.geometry?.type === 'Polygon') {
        buildingCenters[id] = polygonCentroid(f.geometry.coordinates)
      }
    }

    map.addSource('vgu-campus', { type: 'geojson', data })
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
    map.addLayer({
      id: 'vgu-buildings-outline',
      type: 'line',
      source: 'vgu-campus',
      paint: { 'line-color': '#EF5A24', 'line-width': 1, 'line-opacity': 0.6 }
    })
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
    map.addLayer({
      id: 'vgu-selected-outline',
      type: 'line',
      source: 'vgu-campus',
      paint: { 'line-color': '#EF5A24', 'line-width': 3, 'line-opacity': 0.95 },
      filter: ['==', ['get', 'building_id'], '']
    })
  } catch (error) {
    console.error('[HologramMap] Failed to load campus buildings:', error)
  }
}

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

  // ================= Layer thiết bị trong phòng =================
  // Chỉ hiện khi có phòng đang được chọn (xem loadEquipmentForRoom / watch currentRoomId).
  // `generateId: true` để MapLibre tự gán id số cho từng feature, cần cho feature-state (hover).
  map.addSource('vgu-equipment', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    generateId: true
  })
  map.addLayer({
    id: 'vgu-equipment-fill',
    type: 'fill',
    source: 'vgu-equipment',
    paint: {
      'fill-color': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        '#00ffcc', // highlight xanh khi hover
        '#38bdf8'  // màu mặc định của khối thiết bị
      ],
      'fill-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        0.75,
        0.4
      ]
    }
  })
  map.addLayer({
    id: 'vgu-equipment-outline',
    type: 'line',
    source: 'vgu-equipment',
    paint: {
      'line-color': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        '#00ffcc',
        '#38bdf8'
      ],
      'line-width': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        2.5,
        1.2
      ]
    }
  })
}

async function loadFloorsConfig() {
  try {
    const response = await fetch(`${base}data/floors-config.json`)
    floorsConfig = await response.json()
  } catch (error) {
    console.error('[HologramMap] Failed to load floors-config.json:', error)
  }
}

async function loadRoomNames() {
  try {
    const response = await fetch(`${base}data/info_data.json`)
    const json = await response.json()
    const rows = Array.isArray(json) ? json : (json?.data || [])
    const map_ = {}
    for (const r of rows) {
      const key = r.room_number
      if (!key) continue
      const en = (r.heading_1 || '').trim()
      const vi = (r.heading_2 || '').trim()
      if (en || vi) map_[key] = { en, vi }
    }
    roomNameMap.value = map_
  } catch (error) {
    console.warn('[HologramMap] Không tải được info_data.json:', error)
  }
}

async function selectBuilding(buildingId) {
  if (buildingId === currentBuildingId.value) return
  currentBuildingId.value = buildingId
  currentRoomId.value = null

  const floors = floorsConfig[buildingId] || []
  availableFloors.value = [...floors].sort((a, b) => a - b)

  map.setFilter('vgu-buildings-3d', ['!=', ['get', 'building_id'], buildingId])
  map.setFilter('vgu-buildings-outline', ['!=', ['get', 'building_id'], buildingId])
  map.setFilter('vgu-selected-3d', ['==', ['get', 'building_id'], buildingId])
  map.setFilter('vgu-selected-outline', ['==', ['get', 'building_id'], buildingId])

  const center = buildingCenters[buildingId] || props.initialCenter
  map.flyTo({ center, zoom: 19.2, pitch: 0, bearing: 0, duration: 1500 })

  currentBuildingGeojson = await getBuildingRoomsData(buildingId)

  isGeolocated.value = !!(currentBuildingGeojson?.features?.length
    && isLatLng(currentBuildingGeojson.features[0].geometry.coordinates[0][0]))

  if (isGeolocated.value && map.getSource('vgu-rooms')) {
    map.getSource('vgu-rooms').setData(currentBuildingGeojson)
  } else {
    if (map.getSource('vgu-rooms')) {
      map.getSource('vgu-rooms').setData({ type: 'FeatureCollection', features: [] })
    }
  }

  const defaultFloor = availableFloors.value[0] ?? null
  emit('building-selected', { buildingId, floor: defaultFloor })
  if (defaultFloor != null) selectFloor(defaultFloor)
}

function selectFloor(floorNumber) {
  currentFloor.value = floorNumber
  currentRoomId.value = null
  updateRoomHighlightPaint()

  const filter = ['all',
    ['==', ['get', 'floor'], floorNumber],
    currentBuildingId.value ? ['==', ['get', 'building_id'], currentBuildingId.value] : true
  ]
  map.setFilter('vgu-rooms-fill', filter)
  map.setFilter('vgu-rooms-outline', filter)

  renderRoomMarkers(floorNumber)
  emit('floor-selected', { buildingId: currentBuildingId.value, floor: floorNumber })
}

const searchQuery = ref('')
const searchResults = ref([])
const isSearching = ref(false)
let searchDebounce = null

function onSearchInput() {
  clearTimeout(searchDebounce)
  const q = searchQuery.value.trim()
  if (!q) {
    searchResults.value = []
    return
  }
  searchDebounce = setTimeout(async () => {
    isSearching.value = true
    try {
      // [FIX] Lấy nhiều kết quả hơn (VD: 50) để tự do lọc trên máy khách nếu đang ở trong 1 toà
      const rawResults = await searchRooms(q, 50)
      
      if (currentBuildingId.value) {
        // Lọc kết quả thuộc toà đang xem, sau đó cắt lấy top 8
        searchResults.value = rawResults
          .filter(r => r.buildingId === currentBuildingId.value)
          .slice(0, 8)
      } else {
        // Đang xem toàn trường
        searchResults.value = rawResults.slice(0, 8)
      }
    } finally {
      isSearching.value = false
    }
  }, 250)
}

async function goToRoom(result) {
  if (!result?.buildingId) return
  searchQuery.value = ''
  searchResults.value = []

  if (currentBuildingId.value !== result.buildingId) {
    currentBuildingId.value = null
    await selectBuilding(result.buildingId)
  }
  if (result.floor != null && result.floor !== currentFloor.value) {
    selectFloor(result.floor)
  }

  const feature = currentBuildingGeojson?.features?.find(
    f => f.properties?.room_id === result.id
  )
  const centroid = feature ? polygonCentroid(feature.geometry.coordinates) : null
  selectRoom(result.id, centroid, feature?.properties || { building_id: result.buildingId, floor: result.floor })
}

// ================= Làm nổi bật phòng đang chọn, làm mờ phòng xung quanh =================
// Viền phòng được chọn dùng đúng màu theo loại phòng (giống màu fill mặc định),
// tăng độ dày viền + độ đục fill để nổi bật; các phòng còn lại bị mờ đi.
const ROOM_TYPE_COLOR_EXPR = ['match', ['get', 'type'],
  'laboratory', '#00ffcc',
  'corridor', '#334155',
  '#EF5A24'
]

function updateRoomHighlightPaint() {
  if (!map || !map.getLayer('vgu-rooms-fill') || !map.getLayer('vgu-rooms-outline')) return
  const selId = currentRoomId.value

  if (!selId) {
    map.setPaintProperty('vgu-rooms-fill', 'fill-opacity', 0.35)
    map.setPaintProperty('vgu-rooms-outline', 'line-color', ROOM_TYPE_COLOR_EXPR)
    map.setPaintProperty('vgu-rooms-outline', 'line-width', 1.5)
    map.setPaintProperty('vgu-rooms-outline', 'line-opacity', 0.8)
    return
  }

  map.setPaintProperty('vgu-rooms-fill', 'fill-opacity', [
    'case', ['==', ['get', 'room_id'], selId], 0.6, 0.1
  ])
  map.setPaintProperty('vgu-rooms-outline', 'line-color', [
    'case', ['==', ['get', 'room_id'], selId], ROOM_TYPE_COLOR_EXPR, '#334155'
  ])
  map.setPaintProperty('vgu-rooms-outline', 'line-width', [
    'case', ['==', ['get', 'room_id'], selId], 3, 1
  ])
  map.setPaintProperty('vgu-rooms-outline', 'line-opacity', [
    'case', ['==', ['get', 'room_id'], selId], 1, 0.25
  ])
}

function selectRoom(roomId, centroid, propsObj = {}) {
  currentRoomId.value = roomId
  updateRoomHighlightPaint()
  emit('room-selected', {
    roomId,
    buildingId: propsObj.building_id || currentBuildingId.value,
    floor: propsObj.floor ?? currentFloor.value
  })
  if (centroid && isLatLng(centroid)) {
    map.flyTo({ center: centroid, zoom: 20.6, pitch: 30, bearing: 10, duration: 1200 })
  }
}

function closeRoomDetail() {
  currentRoomId.value = null
  updateRoomHighlightPaint()
}

function exitBuilding() {
  currentBuildingId.value = null
  currentFloor.value = null
  currentRoomId.value = null
  availableFloors.value = []
  isGeolocated.value = false
  currentBuildingGeojson = null
  
  // Dọn dẹp ô tìm kiếm
  searchQuery.value = ''
  searchResults.value = []

  clearRoomMarkers()
  clearEquipmentLayer()
  updateRoomHighlightPaint()

  map.setFilter('vgu-buildings-3d', null)
  map.setFilter('vgu-buildings-outline', null)
  map.setFilter('vgu-selected-3d', ['==', ['get', 'building_id'], ''])
  map.setFilter('vgu-selected-outline', ['==', ['get', 'building_id'], ''])

  if (map.getSource('vgu-rooms')) {
    map.getSource('vgu-rooms').setData({ type: 'FeatureCollection', features: [] })
  }

  map.flyTo({
    center: props.initialCenter,
    zoom: props.initialZoom,
    pitch: props.initialPitch,
    bearing: INITIAL_BEARING,
    duration: 1500
  })

  emit('building-selected', { buildingId: null, floor: null })
}

let hoveredEquipmentId = null
const equipmentCache = new Map()

// Tải geojson thiết bị của 1 phòng (public/data/equipment/{roomId}.geojson), áp
// CHUNG affine transform của building (giống hệt transformBuildingGeojson dùng
// cho rooms) vì file này được sinh ra ở CÙNG hệ toạ độ mét cục bộ của building.
// Nếu phòng chưa có file thiết bị (404) thì chỉ cần xoá layer, không phải lỗi.
async function loadEquipmentForRoom(buildingId, roomId) {
  if (!map.getSource('vgu-equipment')) return
  const cacheKey = `${buildingId}:${roomId}`
  try {
    let data = equipmentCache.get(cacheKey)
    if (!data) {
      const response = await fetch(`${base}data/equipment/${roomId}.geojson`)
      if (!response.ok) {
        clearEquipmentLayer()
        return
      }
      const raw = await response.json()
      data = transformBuildingGeojson(buildingId, raw)
      equipmentCache.set(cacheKey, data)
    }
    map.getSource('vgu-equipment').setData(data)
  } catch (error) {
    console.warn(`[HologramMap] Không tải được thiết bị cho phòng ${roomId}:`, error)
    clearEquipmentLayer()
  }
}

function clearEquipmentLayer() {
  hoveredEquipmentId = null
  if (map?.getSource('vgu-equipment')) {
    map.getSource('vgu-equipment').setData({ type: 'FeatureCollection', features: [] })
  }
}

// Chỉ hiện thiết bị khi có phòng đang được chọn — khớp đúng yêu cầu "thiết bị
// của phòng chỉ hiện lên khi nhấn vào phòng đó".
watch(currentRoomId, (roomId) => {
  if (!roomId || !currentBuildingId.value) {
    clearEquipmentLayer()
    return
  }
  loadEquipmentForRoom(currentBuildingId.value, roomId)
})

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
    el.className = 'vgu-room-marker'
    el.style.cssText = 'position:relative;width:0;height:0;cursor:pointer;pointer-events:auto;'
    el.innerHTML = `
      <div class="room-dot">
        <span class="room-ping"></span>
        <span class="room-core"></span>
      </div>
      <div class="room-marker-card">
        <div class="room-marker-id">${roomId}</div>
        ${label ? `<div class="room-marker-name">${formatRoomName(label)}</div>` : ''}
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

// Cho phép component cha (pages/index.vue) gọi trực tiếp khi người dùng chọn
// phòng từ danh sách trong FloorPanel, để bản đồ bay camera zoom vào đúng
// phòng đó — giống hệt hành vi khi bấm thẳng vào phòng trên map.
defineExpose({ goToRoom })
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


/* ================= Thanh tìm kiếm TOÀN CỤC (Mới) ================= */
.global-search-container {
  position: absolute;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 70;
  width: 320px;
  max-width: 90vw;
}

.search-wrapper {
  position: relative;
  width: 100%;
}

.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  color: #94a3b8;
}

.global-search-input {
  width: 100%;
  height: 44px;
  padding: 0 16px 0 40px; /* Nhường chỗ cho icon */
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(11, 17, 32, 0.85);
  color: #fff;
  font-family: 'Space Mono', monospace;
  font-size: 13px;
  outline: none;
  backdrop-filter: blur(8px);
  transition: all 0.2s ease;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
}

.global-search-input::placeholder { color: rgba(255, 255, 255, 0.5); }

.global-search-input:focus {
  border-color: #EF5A24;
  background: rgba(11, 17, 32, 0.95);
}

.global-search-results {
  margin-top: 8px;
  width: 100%;
  max-height: 320px;
  overflow-y: auto;
  background: rgba(11, 17, 32, 0.95);
  border: 1px solid rgba(239, 90, 36, 0.3);
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  backdrop-filter: blur(8px);
}

.global-search-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  text-align: left;
  background: transparent;
  border: none;
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
  color: #e2e8f0;
  transition: background 0.15s;
}

.global-search-item:hover { background: rgba(239, 90, 36, 0.15); }

.rs-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rs-id {
  font-family: 'Space Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  color: #EF5A24;
}

.rs-name { 
  font-size: 11px; 
  color: #94a3b8; 
}

.rs-building {
  font-size: 10px;
  font-weight: 700;
  color: #94a3b8;
  background: rgba(255,255,255,0.1);
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 10px;
}

.room-search-empty {
  padding: 10px;
  font-size: 11px;
  color: #64748b;
  text-align: center;
}

/* Scrollbar cho search results */
.global-search-results::-webkit-scrollbar { width: 6px; }
.global-search-results::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 4px;
}


/* ================= Thang máy chọn tầng ================= */
.floor-bar {
  position: absolute;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 60;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: rgba(15, 30, 54, 0.9);
  border: 1px solid rgba(239, 90, 36, 0.3);
  border-radius: 999px;
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
}

.floor-bar-label {
  font-family: 'Space Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #EF5A24;
  padding: 0 6px 0 4px;
  border-right: 1px solid rgba(239, 90, 36, 0.2);
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

.floor-btn.detail {
  border-color: rgba(6, 182, 212, 0.6);
  background: rgba(6, 182, 212, 0.08);
  color: #06B6D4;
  box-shadow: 0 0 8px rgba(6, 182, 212, 0.25);
}
.floor-btn.detail:hover { color: #fff; border-color: #06B6D4; }

.floor-btn.active {
  background: #EF5A24;
  border-color: #EF5A24;
  color: #fff;
  box-shadow: 0 0 12px #EF5A24;
}

.exit-btn {
  margin-right: 4px;
  color: #EF5A24;
  border-color: rgba(239, 90, 36, 0.25);
  font-size: 14px;
}
.exit-btn:hover { background: rgba(239, 90, 36, 0.12); color: #fff; }


/* ================= Thông báo chưa định vị ================= */
.calib-notice {
  position: absolute;
  bottom: 80px; /* Đẩy lên một chút cho đỡ cấn thanh tầng */
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
  line-clamp: 2;
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

@media (prefers-reduced-motion: reduce) {
  :deep(.room-ping) { animation: none; opacity: 0.4; }
  .calib-dot { animation: none; }
  .hud-slide-enter-active, .hud-slide-leave-active,
  .fade-enter-active, .fade-leave-active { transition: none; }
}

@media (max-width: 640px) {
  .floor-bar { gap: 6px; padding: 6px 8px; max-width: 94vw; }
  .floor-btn { width: 34px; height: 34px; font-size: 11px; }
  
  .global-search-container { width: 90vw; }
  .global-search-input { font-size: 12px; }

  :deep(.room-marker-card) { min-width: 84px; max-width: 130px; padding: 4px 8px; }
  :deep(.room-marker-id) { font-size: 9px; }
  :deep(.room-marker-name) { font-size: 8px; line-clamp: 1; -webkit-line-clamp: 1; }
}
</style>
