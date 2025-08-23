<template>
  <div ref="mapContainerRef" class="map-container">
    <div v-if="loading" class="map-overlay">
      <n-spin size="small" />
      <n-text depth="3" style="margin-left: 8px;">地图渲染中...</n-text>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { NSpin, NText } from 'naive-ui';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const props = defineProps({
  stops: {
    type: Array,
    required: true
  }
});

const mapContainerRef = ref(null);
const loading = ref(true);
let mapInstance = null;
let resizeObserver = null;

const initializeMap = (element) => {
  if (!element || mapInstance) return;

  const validStops = props.stops.filter(s => s.lat != null && s.lon != null && s.lat !== 0 && s.lon !== 0);
  if (validStops.length === 0) {
    loading.value = false;
    return;
  }

  mapInstance = L.map(element).setView([35.8617, 104.1954], 4);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(mapInstance);

  const latLngs = validStops.map(s => [s.lat, s.lon]);
  const polyline = L.polyline(latLngs, { color: '#2ea043', weight: 4 }).addTo(mapInstance);
  mapInstance.fitBounds(polyline.getBounds(), { padding: [20, 20] });

  validStops.forEach(s => {
    L.circleMarker([s.lat, s.lon], {
      radius: 4,
      color: '#e6edf3',
      fillColor: '#161b22',
      weight: 2,
      fillOpacity: 1
    }).addTo(mapInstance).bindPopup(s.n);
  });

  loading.value = false;
};

onMounted(() => {
  if (mapContainerRef.value) {
    resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.contentRect.height > 0) {
          initializeMap(mapContainerRef.value);
          if (resizeObserver) {
            resizeObserver.disconnect();
          }
        }
      }
    });
    resizeObserver.observe(mapContainerRef.value);
  }
});

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
  if (mapInstance) {
    mapInstance.remove();
  }
});
</script>

<style scoped>
.map-container {
  position: relative;
  height: 300px;
  width: 100%;
  border-radius: 6px;
  margin-top: 12px;
  background-color: #30363d;
  overflow: hidden;
}
.map-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
</style>