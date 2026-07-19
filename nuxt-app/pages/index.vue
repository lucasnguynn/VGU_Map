<template>
  <div class="app-container">
    <div id="map-container" class="map-container" ref="mapElement"></div>
    <transition name="slide-up">
      <div v-if="selectedBuilding" class="building-info-panel">
        <div class="panel-header">
          <h2>{{ selectedBuildingInfo.name || 'Building Detail' }}</h2>
          <button @click="selectedBuilding = null">Close</button>
        </div>
        <div class="room-list">
          <div v-for="room in buildingRooms" :key="room.room_number" class="room-card">
            <h3>Room: {{ room.room_number }}</h3>
            <p><strong>Function:</strong> {{ room.heading_2 || room.fm_room_function }}</p>
            <p><strong>Responsible:</strong> {{ room.occupant_display || 'Not updated' }}</p>
            <p><strong>Status:</strong> {{ room.status }}</p>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import maplibregl from 'maplibre-gl'
import campusBuildings from '~/assets/data/campus-buildings.json'

const mapElement = ref(null)
const selectedBuilding = ref(null)

const { data: sheetsData } = await useFetch(
  '/api/sheets/exec?nocache=true',
  {
    transform: (payload) => {
      if (payload?.status === 'success') {
        return payload.data.map(room => ({
          ...room,
          occupant_display: room.occupants_flat || room.occupants_list?.join(', ') || ''
        }))
      }
      return []
    }
  }
)

const buildingRooms = computed(() => {
  if (!selectedBuilding.value || !sheetsData.value) return []
  return sheetsData.value.filter(room => room.sheet_source === selectedBuilding.value)
})

const selectedBuildingInfo = computed(() => {
  if (!selectedBuilding.value) return {}
  const feature = campusBuildings.features.find(f => f.properties.building_id === selectedBuilding.value)
  return feature ? feature.properties : {}
})

onMounted(() => {
  const map = new maplibregl.Map({
    container: mapElement.value,
    style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json ',
    center: [106.6155, 11.1083],
    zoom: 17,
    pitch: 45
  })

  map.on('load', () => {
    map.addSource('campus-buildings', { type: 'geojson', data: campusBuildings })
    map.addLayer({
      id: 'buildings-extrusion',
      type: 'fill-extrusion',
      source: 'campus-buildings',
      paint: {
        'fill-extrusion-color': '#005a9c',
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': ['get', 'base_height'],
        'fill-extrusion-opacity': 0.8
      }
    })
    map.on('click', 'buildings-extrusion', (e) => {
      if (e.features.length) selectedBuilding.value = e.features[0].properties.building_id
    })
    map.on('mouseenter', 'buildings-extrusion', () => map.getCanvas().style.cursor = 'pointer')
    map.on('mouseleave', 'buildings-extrusion', () => map.getCanvas().style.cursor = '')
  })
})
</script>

<style scoped>
.app-container { position: relative; width: 100vw; height: 100vh; overflow: hidden; }
.map-container { width: 100%; height: 100%; }
.building-info-panel {
  position: absolute; bottom: 0; left: 0; width: 100%; max-height: 50vh;
  background: rgba(0,0,0,0.85); color: #00ffcc; border-top: 2px solid #00ffcc;
  overflow-y: auto; z-index: 10; padding: 20px; backdrop-filter: blur(10px);
}
.panel-header { display: flex; justify-content: space-between; align-items: center; }
.room-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px; margin-top: 15px; }
.room-card { border: 1px solid #333; padding: 15px; background: rgba(255,255,255,0.05); }
.slide-up-enter-active, .slide-up-leave-active { transition: all 0.3s ease; }
.slide-up-enter-from, .slide-up-leave-to { transform: translateY(100%); opacity: 0; }
</style>
