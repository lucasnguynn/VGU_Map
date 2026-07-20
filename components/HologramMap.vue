<!-- components/HologramMap.vue -->
<template>
  <div ref="mapContainer" class="map-container"></div>
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
  map.on('load', () => {
    console.log('[HologramMap] Map loaded successfully')
    
    // Load campus buildings data
    loadCampusBuildings()
  })

  // Handle click events trên buildings/rooms
  map.on('click', 'vgu-buildings-3d', (e) => {
    const feature = e.features[0]
    const buildingId = feature.properties?.building_id || feature.properties?.cluster_id
    
    if (buildingId) {
      emit('building-selected', {
        buildingId,
        floor: feature.properties?.floor || null
      })
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
        floor: feature.properties?.floor
      })
    }
  })

  // Hover effect
  map.on('mouseenter', 'vgu-buildings-3d', () => {
    map.getCanvas().style.cursor = 'pointer'
  })

  map.on('mouseleave', 'vgu-buildings-3d', () => {
    map.getCanvas().style.cursor = ''
  })
})

// Load campus buildings từ JSON
async function loadCampusBuildings() {
  try {
    const response = await fetch('/public/campus-buildings.json')
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
</style>
