<template>
  <div ref="mapContainer" class="map-view"></div>
</template>

<script setup>
import { shallowRef, onMounted } from 'vue';
import maplibregl from 'maplibre-gl';

const mapContainer = shallowRef(null);
const map = shallowRef(null);

onMounted(() => {
  map.value = new maplibregl.Map({
    container: mapContainer.value,
    style: '/map-style.json', // Style Cyberpunk của bạn
    center: [106.6155, 11.1083],
    zoom: 17.5
  });
  
  // Tích hợp Click Event tại đây thay vì file cũ
  map.value.on('click', 'layer-id', (e) => {
    const properties = e.features[0].properties;
    // Emit event lên parent để mở Modal thông tin
    emit('room-selected', properties);
  });
});

const emit = defineEmits(['room-selected']);
</script>

<style scoped>
.map-view { width: 100%; height: 100vh; }
</style>