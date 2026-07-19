<template>
  <div class="relative w-full h-full">
    <!-- Map Container with Zoom-dependent Class -->
    <div 
      ref="mapContainer" 
      :class="[
        'w-full h-full rounded-lg overflow-hidden border border-[#EF5A24]/10 shadow-2xl transition-all duration-300',
        { 'map-zoomed-in': zoomLevel <= mapZoomedInThreshold }
      ]"
    ></div>

    <!-- Unified Top Context HUD Bar -->
    <div class="absolute top-4 sm:top-6 left-1/2 -translate-x-1/2 z-20 w-[92%] sm:w-[90%] max-w-xl pointer-events-none">
      <div class="vgu-panel px-3 py-2 sm:px-5 sm:py-2.5 rounded-lg text-[10px] sm:text-xs font-technical flex items-center justify-between border border-[#EF5A24]/30 shadow-lg bg-[#0F1E36]/90 backdrop-blur-md">
        <div class="flex items-center gap-1.5 sm:gap-2">
          <span class="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#EF5A24] animate-pulse"></span>
          <span class="text-[#EF5A24] font-bold uppercase tracking-wider line-clamp-1">
            {{ hudContextTitle }}
          </span>
        </div>
        <div class="text-[#06B6D4] font-semibold text-[8px] sm:text-[9px] uppercase tracking-widest hidden sm:block">
          {{ hudContextGuidance }}
        </div>
      </div>
    </div>

    <!-- Map Overlay Controls -->
    <div class="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 z-20 flex flex-col gap-2">
      <div class="vgu-panel px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg text-[9px] sm:text-xs font-technical flex flex-col gap-0.5 sm:gap-1">
        <div class="text-[#EF5A24] font-bold text-[10px] sm:text-xs">VGU MSI HOLOGRAPHIC MAP</div>
        <div class="text-white/60">LAT: {{ mapCenter[1].toFixed(4) }} | LON: {{ mapCenter[0].toFixed(4) }}</div>
        <div class="text-white/60">ZOOM: {{ zoomLevel.toFixed(1) }} | PITCH: {{ pitchLevel }}°</div>
      </div>
    </div>

    <!-- Left Hand Elevator UI (Floors) -->
    <Transition name="scale-fade">
      <div v-if="selectedBuilding" class="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1.5 sm:gap-2 bg-[#0F1E36]/90 backdrop-blur-md border border-[#EF5A24]/30 p-1.5 sm:p-2 rounded-full shadow-lg">
        <button 
          v-for="floorNum in floors" 
          :key="floorNum" 
          @click="selectFloor(floorNum)"
          :class="[
            'w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-technical font-bold border transition-all duration-300',
            selectedFloor === floorNum 
              ? 'bg-[#EF5A24] border-[#EF5A24] text-white shadow-[0_0_10px_#EF5A24]' 
              : floorsWithLabs.has(floorNum)
                ? 'border-[#06B6D4]/60 bg-[#06B6D4]/10 text-[#06B6D4] shadow-[0_0_8px_rgba(6,182,212,0.2)] hover:border-[#06B6D4] hover:text-white'
                : 'border-white/10 hover:border-[#EF5A24]/60 text-white/70 hover:text-white'
          ]"
        >
          L{{ floorNum }}
        </button>
        <button 
          @click="resetMap" 
          class="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-[10px] sm:text-xs border border-[#EF5A24]/20 text-[#EF5A24] hover:bg-[#EF5A24]/10 transition-all duration-300"
          title="Exit Building"
        >
          ✕
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const hudContextTitle = computed(() => {
  if (!props.selectedBuilding) {
    return 'FOCUS: VGU CAMPUS OVERVIEW'
  }
  const nameMap = {
    'cluster-1': 'Academic Cluster 1',
    'cluster-2': 'Academic Cluster 2',
    'cluster-3': 'Academic Cluster 3',
    'cluster-5': 'Academic Cluster 5',
    'cluster-6': 'Academic Cluster 6'
  }
  const buildingName = nameMap[props.selectedBuilding] || props.selectedBuilding.replace('-', ' ').toUpperCase()
  if (props.selectedFloor) {
    return `FOCUS: ${buildingName} // FLOOR ${props.selectedFloor}`
  }
  return `FOCUS: ${buildingName}`
})

const hudContextGuidance = computed(() => {
  if (!props.selectedBuilding) {
    return 'CLICK A CLUSTER TO ENTER INTERNAL LAB CELLS'
  }
  return 'USE ELEVATOR HUD ON THE RIGHT TO CHANGE LEVELS'
})

const props = defineProps({
  selectedBuilding: {
    type: String,
    default: null
  },
  selectedFloor: {
    type: Number,
    default: null
  },
  selectedRoomId: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['select-building', 'select-floor', 'select-room', 'reset'])

const mapContainer = ref(null)
let map = null
const mapLoaded = ref(false)
const currentFloorGeojson = ref(null)
let resizeObserver = null

const config = useRuntimeConfig()
const displayOnlyRoomsWithMachines = computed(() => config.public.displayOnlyRoomsWithMachines)
const mapZoomedInThreshold = computed(() => config.public.mapZoomedInThreshold ?? 17.5)
const defaultZoomLevel = computed(() => config.public.defaultZoomLevel ?? 17.5)

const zoomLevel = ref(defaultZoomLevel.value)
const pitchLevel = ref(45)
const mapCenter = ref([106.6155, 11.1083])
const floorsConfig = ref({})
const floors = computed(() => {
  if (!props.selectedBuilding || !floorsConfig.value) return [2, 1]
  return floorsConfig.value[props.selectedBuilding] || [2, 1]
})

const floorsWithLabs = computed(() => {
  if (!props.selectedBuilding || !labs.value) return new Set()
  const matching = labs.value.filter(l => l.building_id === props.selectedBuilding)
  return new Set(matching.map(l => l.floor))
})

const { data: labs } = await useAsyncData('map-labs', () => queryCollection('labs').all())

function getRoomsFilter(buildingId = null) {
  const roomTypeFilter = ['==', ['get', 'type'], 'laboratory']
  let filters = [roomTypeFilter]
  if (buildingId) {
    filters.push(['==', ['get', 'building_id'], buildingId])
  }
  
  if (displayOnlyRoomsWithMachines.value) {
    const labRoomIds = (labs.value || []).map(l => l.room_id)
    if (labRoomIds.length > 0) {
      filters.push(['match', ['get', 'room_id'], ...labRoomIds.flatMap(id => [id, true]), false])
    } else {
      filters.push(['==', ['get', 'room_id'], ''])
    }
  }
  
  return filters.length > 1 ? ['all', ...filters] : roomTypeFilter
}

// Initialize Map
onMounted(async () => {
  try {
    const res = await fetch('/data/floorplans/floors-config.json')
    floorsConfig.value = await res.json()
  } catch (err) {
    console.error('Failed to load floors config', err)
  }

  if (!mapContainer.value) return

  map = new maplibregl.Map({
    container: mapContainer.value,
    style: {
      version: 8,
      sources: {
        'osm-tiles': {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
          ],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors, © CartoDB',
          maxzoom: 19
        }
      },
      layers: [
        {
          id: 'osm-raster',
          type: 'raster',
          source: 'osm-tiles',
          minzoom: 0,
          maxzoom: 22
        }
      ]
    },
    center: props.selectedBuilding ? (buildingCenters[props.selectedBuilding] || [106.6155, 11.1083]) : [106.6155, 11.1083],
    zoom: props.selectedBuilding ? 18.2 : defaultZoomLevel.value,
    pitch: props.selectedBuilding ? 0 : 45,
    bearing: props.selectedBuilding ? 0 : -20
  })
  if (typeof window !== 'undefined') {
    window.map = map
  }


  // Listen to camera events for UI display
  map.on('zoom', () => {
    zoomLevel.value = map.getZoom()
  })
  map.on('pitch', () => {
    pitchLevel.value = Math.round(map.getPitch())
  })
  map.on('move', () => {
    const center = map.getCenter()
    mapCenter.value = [center.lng, center.lat]
  })

  map.on('load', () => {
    mapLoaded.value = true
    // Add VGU Buildings Shell Data
    map.addSource('vgu-buildings', {
      type: 'geojson',
      data: '/data/floorplans/campus-buildings.json'
    })

    // Add 3D building extrusions
    map.addLayer({
      id: 'vgu-buildings-extrusion',
      type: 'fill-extrusion',
      source: 'vgu-buildings',
      paint: {
        'fill-extrusion-color': '#0C2B5C',
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': ['get', 'base_height'],
        'fill-extrusion-opacity': 0.75
      }
    })

    // Glowing outline for buildings
    map.addLayer({
      id: 'vgu-buildings-outline',
      type: 'line',
      source: 'vgu-buildings',
      paint: {
        'line-color': '#EF5A24',
        'line-width': 1.5,
        'line-opacity': 0.6
      }
    })

    // Add 3D building extrusion for selected building (highly translucent/holographic X-ray shell)
    map.addLayer({
      id: 'vgu-selected-building-extrusion',
      type: 'fill-extrusion',
      source: 'vgu-buildings',
      paint: {
        'fill-extrusion-color': '#0C2B5C',
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': ['get', 'base_height'],
        'fill-extrusion-opacity': 0.1
      },
      filter: ['==', ['get', 'building_id'], '']
    })

    // Glowing outline for selected building
    map.addLayer({
      id: 'vgu-selected-building-outline',
      type: 'line',
      source: 'vgu-buildings',
      paint: {
        'line-color': '#EF5A24',
        'line-width': 3.0,
        'line-opacity': 0.9
      },
      filter: ['==', ['get', 'building_id'], '']
    })

    // Add empty source for Floorplans to be loaded dynamically
    map.addSource('vgu-floorplan', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    })

    // Add room layers
    map.addLayer({
      id: 'vgu-rooms-fill',
      type: 'fill',
      source: 'vgu-floorplan',
      paint: {
        'fill-color': [
          'match',
          ['get', 'department'],
          'Materials Science', '#EF5A24',
          'Chemical Engineering', '#06B6D4',
          'Applied Physics', '#8B5CF6',
          'Chemistry', '#EC4899',
          'Electrical Engineering', '#3B82F6',
          'Computer Science', '#10B981',
          'Mechanical Engineering', '#34D399',
          'Mechatronics', '#14B8A6',
          'Civil Engineering', '#6B7280',
          'Finance', '#F59E0B',
          'Business Administration', '#F59E0B',
          'General Education', '#4B5563',
          '#1E293B'
        ],
        'fill-opacity': 0.4
      },
      filter: getRoomsFilter(),
      layout: {
        visibility: 'none'
      }
    })

    // Add room outlines
    map.addLayer({
      id: 'vgu-rooms-outline',
      type: 'line',
      source: 'vgu-floorplan',
      paint: {
        'line-color': '#EF5A24',
        'line-width': 2,
        'line-opacity': 0.8
      },
      filter: getRoomsFilter(),
      layout: {
        visibility: 'none'
      }
    })

    // Interaction handlers
    map.on('click', 'vgu-buildings-extrusion', (e) => {
      if (!e.features || !e.features[0]) return
      const bProps = e.features[0].properties
      emit('select-building', bProps.building_id)
    })

    map.on('click', 'vgu-rooms-fill', (e) => {
      if (!e.features || !e.features[0]) return
      const rProps = e.features[0].properties
      emit('select-room', rProps.room_id)
    })

    // Pointer feedback
    map.on('mouseenter', 'vgu-buildings-extrusion', () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', 'vgu-buildings-extrusion', () => {
      map.getCanvas().style.cursor = ''
    })

    map.on('mouseenter', 'vgu-rooms-fill', () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', 'vgu-rooms-fill', () => {
      map.getCanvas().style.cursor = ''
    })

    // If a building is already selected on load, apply initial filters and zoom
    if (props.selectedBuilding) {
      map.setFilter('vgu-buildings-extrusion', ['!=', ['get', 'building_id'], props.selectedBuilding])
      map.setFilter('vgu-buildings-outline', ['!=', ['get', 'building_id'], props.selectedBuilding])
      map.setFilter('vgu-selected-building-extrusion', ['==', ['get', 'building_id'], props.selectedBuilding])
      map.setFilter('vgu-selected-building-outline', ['==', ['get', 'building_id'], props.selectedBuilding])
      
      map.setFilter('vgu-rooms-fill', getRoomsFilter(props.selectedBuilding))
      map.setFilter('vgu-rooms-outline', getRoomsFilter(props.selectedBuilding))
      
      if (props.selectedFloor) {
        loadFloorplan(props.selectedFloor)
      }

      // Induce camera zoom-in transition smoothly after style loads
      if (!props.selectedRoomId) {
        const coords = buildingCenters[props.selectedBuilding] || [106.6155, 11.1083]
        setTimeout(() => {
          map.flyTo({
            center: coords,
            zoom: 19.5,
            pitch: 0,
            bearing: 0,
            duration: 1500
          })
        }, 100)
      }
    } else {
      renderClusterLabels()
    }
  })

  // Resize observer to ensure MapLibre canvas updates when container dimensions change
  if (typeof window !== 'undefined' && 'ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(() => {
      if (map) {
        map.resize()
      }
    })
    if (mapContainer.value) {
      resizeObserver.observe(mapContainer.value)
    }
  }
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
  if (map) map.remove()
  clearRoomMarkers()
  clearClusterMarkers()
})

const buildingCenters = {
  'cluster-1': [106.6150547, 11.1086567],
  'cluster-2': [106.6152379, 11.1081542],
  'cluster-3': [106.6154201, 11.1077056],
  'cluster-5': [106.6160420, 11.1088469],
  'cluster-6': [106.6162763, 11.1081780]
}

let clusterMarkers = []

function clearClusterMarkers() {
  clusterMarkers.forEach(m => m.remove())
  clusterMarkers = []
}

function renderClusterLabels() {
  clearClusterMarkers()
  if (props.selectedBuilding) return // Hide when a building is selected
  
  const clusters = [
    { id: 'cluster-1', label: 'Cluster 1', name: 'Materials Science / Physics', coords: [106.6150547, 11.1086567] },
    { id: 'cluster-2', label: 'Cluster 2', name: 'Electrical Engineering / IT / CS', coords: [106.6152379, 11.1081542] },
    { id: 'cluster-3', label: 'Cluster 3', name: 'Mechanical Eng. / Mechatronics', coords: [106.6154201, 11.1077056] },
    { id: 'cluster-5', label: 'Cluster 5', name: 'Chemical & Civil Engineering', coords: [106.6160420, 11.1088469] },
    { id: 'cluster-6', label: 'Cluster 6', name: 'Business / Finance', coords: [106.6162763, 11.1081780] }
  ]

  clusters.forEach(c => {
    const el = document.createElement('div')
    // Outer container is a 0x0 absolute point so that coordinates are locked
    el.className = 'relative w-0 h-0 cursor-pointer pointer-events-auto'
    el.innerHTML = `
      <!-- Pulsing Dot (locked exactly at 0,0) -->
      <div class="cluster-marker-dot absolute -translate-x-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center pointer-events-auto">
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#EF5A24] opacity-75"></span>
        <span class="relative inline-flex rounded-full h-2 w-2 bg-[#EF5A24] shadow-[0_0_8px_#EF5A24]"></span>
      </div>
      
      <!-- Cluster Card (positioned relative to the dot, 0x0 offset layout) -->
      <div class="cluster-marker-card absolute top-4 left-1/2 -translate-x-1/2 px-3.5 py-2 rounded bg-[#0F1E36]/95 border border-[#06B6D4]/30 hover:border-[#EF5A24] text-white shadow-xl backdrop-blur-md transition-all duration-300 hover:scale-105 text-center min-w-[140px] pointer-events-auto">
        <div class="cluster-title text-[10px] font-technical font-extrabold text-[#EF5A24] uppercase tracking-wider">${c.label}</div>
        <div class="cluster-subtitle text-[8px] text-white/60 font-sans mt-0.5 leading-tight">${c.name}</div>
        <div class="cluster-action text-[8px] font-technical text-[#06B6D4] mt-1.5 uppercase font-bold tracking-widest animate-pulse">ENTER BLOCK →</div>
      </div>
    `

    el.addEventListener('click', (e) => {
      e.stopPropagation()
      emit('select-building', c.id)
    })

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat(c.coords)
      .addTo(map)

    clusterMarkers.push(marker)
  })
}

let roomMarkers = []

function clearRoomMarkers() {
  roomMarkers.forEach(marker => marker.remove())
  roomMarkers = []
}

function getPolygonCentroid(coordinates) {
  const pts = coordinates[0]
  let sumLon = 0
  let sumLat = 0
  const count = pts.length - 1
  for (let i = 0; i < count; i++) {
    sumLon += pts[i][0]
    sumLat += pts[i][1]
  }
  return [sumLon / count, sumLat / count]
}

async function loadFloorplan(floorNum) {
  console.log('loadFloorplan called with:', floorNum)
  if (!map || !mapLoaded.value) {
    console.log('loadFloorplan aborted: map is not loaded yet')
    return
  }
  try {
    const url = `/data/floorplans/msi-floor${floorNum}.json`
    console.log('loadFloorplan: fetching from', url)
    const res = await fetch(url)
    const data = await res.json()
    console.log('loadFloorplan: fetched features count:', data.features ? data.features.length : 'no features')
    const source = map.getSource('vgu-floorplan')
    if (source) {
      console.log('loadFloorplan: source found, setting data')
      source.setData(data)
      map.setLayoutProperty('vgu-rooms-fill', 'visibility', 'visible')
      map.setLayoutProperty('vgu-rooms-outline', 'visibility', 'visible')
    }

    currentFloorGeojson.value = data

    // Clear previous room markers
    clearRoomMarkers()

    // Add HTML markers for rooms inside the selected building
    if (props.selectedBuilding) {
      let bRooms = data.features.filter(f => f.properties.building_id === props.selectedBuilding && f.properties.type === 'laboratory')
      
      // Filter rooms depending on displayOnlyRoomsWithMachines option
      if (displayOnlyRoomsWithMachines.value) {
        const labRoomIds = new Set((labs.value || []).map(l => l.room_id))
        bRooms = bRooms.filter(room => labRoomIds.has(room.properties.room_id))
      }

      bRooms.forEach(room => {
        const centroid = getPolygonCentroid(room.geometry.coordinates)
        const roomId = room.properties.room_id.replace('lab-', '').replace('room-', '').toUpperCase()
        
        // Find matching name in labs collection
        const matchingLab = (labs.value || []).find(l => l.room_id === room.properties.room_id)
        const roomName = matchingLab ? matchingLab.name : room.properties.name

        // Create HTML element for the marker (absolute 0x0 centering)
        const el = document.createElement('div')
        el.className = 'relative w-0 h-0 cursor-pointer pointer-events-auto'
        el.innerHTML = `
          <!-- Pulsing Dot (locked exactly at 0,0) -->
          <div class="absolute -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 flex items-center justify-center pointer-events-auto">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#EF5A24] opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-[#EF5A24] shadow-[0_0_6px_#EF5A24]"></span>
          </div>
          <!-- Label Tag (positioned below the dot, 0x0 offset layout) -->
          <div class="room-marker-card absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded bg-[#0F1E36]/95 border border-[#EF5A24]/30 hover:border-[#EF5A24] text-white shadow-lg backdrop-blur-sm transition-all duration-300 hover:scale-105 text-center min-w-[120px] max-w-[155px] pointer-events-auto">
            <div class="room-title text-[10px] font-technical font-extrabold text-[#EF5A24] uppercase tracking-wider">${roomId}</div>
            <div class="room-subtitle text-[9px] text-white/80 font-sans leading-tight mt-0.5 line-clamp-2">${roomName}</div>
          </div>
        `

        // Bind click handler
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          emit('select-room', room.properties.room_id)
        })

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(centroid)
          .addTo(map)

        roomMarkers.push(marker)
      })
    }

    if (props.selectedRoomId) {
      setTimeout(() => {
        zoomToRoom(props.selectedRoomId)
      }, 300)
    }
  } catch (err) {
    console.error('Failed to load floorplan data', err)
  }
}

function zoomToRoom(roomId) {
  if (!map || !mapLoaded.value || !roomId || !currentFloorGeojson.value) return
  const roomFeature = currentFloorGeojson.value.features.find(f => f.properties.room_id === roomId)
  if (roomFeature && roomFeature.geometry && roomFeature.geometry.coordinates) {
    const centroid = getPolygonCentroid(roomFeature.geometry.coordinates)
    map.flyTo({
      center: centroid,
      zoom: 20.8,
      pitch: 30,
      bearing: 10,
      duration: 1200
    })
  }
}

// Watch room selection changes to automatically zoom into/out of rooms
watch(() => props.selectedRoomId, (newRoomId) => {
  if (newRoomId) {
    zoomToRoom(newRoomId)
  } else {
    // If deselected, restore building cluster view
    if (props.selectedBuilding) {
      const coords = buildingCenters[props.selectedBuilding] || [106.6155, 11.1083]
      map.flyTo({
        center: coords,
        zoom: 19.5,
        pitch: 0,
        bearing: 0,
        duration: 1000
      })
    }
  }
})

// Watch building selection and floor changes in sync to zoom and load floorplans
watch([() => props.selectedBuilding, () => props.selectedFloor], async ([newBuilding, newFloor], [oldBuilding, oldFloor]) => {
  console.log('VguMap Watch triggered:', { newBuilding, newFloor, oldBuilding, oldFloor })
  if (!map || !mapLoaded.value) {
    console.log('VguMap Watch aborted: map is not loaded yet')
    return
  }

  if (newBuilding) {
    if (newBuilding !== oldBuilding) {
      // Clear cluster labels
      clearClusterMarkers()

      // Zoom into specific cluster
      const coords = buildingCenters[newBuilding] || [106.6155, 11.1083]
      map.flyTo({
        center: coords,
        zoom: 19.5,
        pitch: 0, // Top down to explore floorplans
        bearing: 0,
        duration: 1500
      })

      // Update building filters (split layers setup)
      map.setFilter('vgu-buildings-extrusion', ['!=', ['get', 'building_id'], newBuilding])
      map.setFilter('vgu-buildings-outline', ['!=', ['get', 'building_id'], newBuilding])
      map.setFilter('vgu-selected-building-extrusion', ['==', ['get', 'building_id'], newBuilding])
      map.setFilter('vgu-selected-building-outline', ['==', ['get', 'building_id'], newBuilding])
      
      // Set filters for room layers
      map.setFilter('vgu-rooms-fill', getRoomsFilter(newBuilding))
      map.setFilter('vgu-rooms-outline', getRoomsFilter(newBuilding))
    }

    if (newFloor) {
      await loadFloorplan(newFloor)
    } else {
      map.setLayoutProperty('vgu-rooms-fill', 'visibility', 'none')
      map.setLayoutProperty('vgu-rooms-outline', 'visibility', 'none')
      clearRoomMarkers()
    }
  } else {
    if (newBuilding !== oldBuilding) {
      // Zoom out to campus view
      map.flyTo({
        center: [106.6155, 11.1083],
        zoom: defaultZoomLevel.value,
        pitch: 45,
        bearing: -20,
        duration: 1500
      })

      // Restore all shells and default opacities
      map.setFilter('vgu-buildings-extrusion', null)
      map.setFilter('vgu-buildings-outline', null)
      map.setFilter('vgu-selected-building-extrusion', ['==', ['get', 'building_id'], ''])
      map.setFilter('vgu-selected-building-outline', ['==', ['get', 'building_id'], ''])
      
      // Hide floorplan layers and reset filters
      map.setFilter('vgu-rooms-fill', getRoomsFilter())
      map.setFilter('vgu-rooms-outline', getRoomsFilter())
      map.setLayoutProperty('vgu-rooms-fill', 'visibility', 'none')
      map.setLayoutProperty('vgu-rooms-outline', 'visibility', 'none')

      // Clear room HTML markers
      clearRoomMarkers()

      // Restore cluster labels
      renderClusterLabels()
    }
  }
})

function selectFloor(floorNum) {
  emit('select-floor', floorNum)
}

function resetMap() {
  emit('reset')
}
</script>

<style scoped>
/* Ensure maplibre popups align correctly with theme */
:deep(.maplibregl-popup-content) {
  background: rgba(15, 30, 54, 0.9) !important;
  border: 1px solid rgba(239, 90, 36, 0.4) !important;
  color: white !important;
  font-family: 'Be Vietnam Pro', sans-serif;
  backdrop-filter: blur(8px);
}
:deep(.maplibregl-popup-tip) {
  border-top-color: rgba(15, 30, 54, 0.9) !important;
}

/* Scoped zoom classes for cluster markers */
:deep(.cluster-marker-dot) {
  display: flex !important;
}
:deep(.cluster-marker-card) {
  display: block !important;
}

:deep(.map-zoomed-in) .cluster-marker-card {
  display: none !important;
}

@media (max-width: 768px) {
  :deep(.cluster-marker-card) {
    min-width: 110px !important;
    padding: 6px 8px !important;
  }
  :deep(.cluster-title) {
    font-size: 8px !important;
  }
  :deep(.cluster-subtitle) {
    font-size: 7px !important;
    margin-top: 1px !important;
  }
  :deep(.cluster-action) {
    font-size: 7px !important;
    margin-top: 4px !important;
  }
  :deep(.room-marker-card) {
    min-width: 95px !important;
    max-width: 125px !important;
    padding: 4px 6px !important;
  }
  :deep(.room-title) {
    font-size: 8px !important;
  }
  :deep(.room-subtitle) {
    font-size: 7px !important;
    margin-top: 1px !important;
    -webkit-line-clamp: 1 !important;
  }
}
</style>
