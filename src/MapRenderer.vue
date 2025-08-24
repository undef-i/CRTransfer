<template>
  <div ref="mapContainerRef" class="map-container">
    <div v-if="loading" class="map-overlay">
      <n-spin size="small" />
      <n-text depth="3" style="margin-left: 8px;">地图渲染中...</n-text>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { NSpin, NText } from 'naive-ui';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

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

const isDark = ref(true);

const updateThemeFromStorage = () => {
  const savedTheme = localStorage.getItem("theme");
  isDark.value = savedTheme === "dark";
};

const getThemeColors = () => {
  return {
    polylineColor: '#24292f',
    markerColor : '#000000',
    markerFillColor: '#000000',
    containerBg : '#f6f8fa',
    tileLayer: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
  };
};

const initializeMap = (element) => {
  if (!element || mapInstance) return;

  const validStops = props.stops.filter(s => s.lat != null && s.lon != null && s.lat !== 0 && s.lon !== 0);
  if (validStops.length === 0) {
    loading.value = false;
    return;
  }

  const colors = getThemeColors();

  mapInstance = new maplibregl.Map({
      container: element,
      attributionControl: true,
      style: {
      version: 8,
      sources: {
        'osm-tiles': {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors'
        }
      },
      layers: [
        {
          id: 'osm-tiles',
          type: 'raster',
          source: 'osm-tiles',
          minzoom: 0,
          maxzoom: 19
        }
      ]
    },
    center: [104.1954, 35.8617],
    zoom: 4
  });

  mapInstance.on('load', () => {
    const coordinates = validStops.map(s => [s.lon, s.lat]);
    
    mapInstance.addSource('railway-route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: coordinates
        }
      }
    });

    mapInstance.addLayer({
      id: 'railway-line',
      type: 'line',
      source: 'railway-route',
      paint: {
        'line-color': colors.polylineColor,
        'line-width': 4,
        'line-opacity': 0.8
      }
    });

    mapInstance.addSource('stations', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: validStops.map(s => ({
          type: 'Feature',
          properties: {
            name: s.n,
            lines: s.rn || []
          },
          geometry: {
            type: 'Point',
            coordinates: [s.lon, s.lat]
          }
        }))
      }
    });

    mapInstance.addLayer({
      id: 'stations-layer',
      type: 'circle',
      source: 'stations',
      paint: {
        'circle-radius': 4,
        'circle-color': '#000000',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });

    mapInstance.on('click', 'stations-layer', (e) => {
      const coordinates = e.features[0].geometry.coordinates.slice();
      const name = e.features[0].properties.name;
      const lines = JSON.parse(e.features[0].properties.lines || '[]');

      const popupContent = document.createElement('div');
      popupContent.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 4px; color: black">${name}</div>
        ${lines.length > 0 ? 
          `<div style="display: flex; flex-wrap: wrap; gap: 3px; margin-top: 4px;">
            ${lines.map(line => 
              `<span style="background: #1a7f37; color: white; padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 500;">${line}</span>`
            ).join('')}
          </div>` : 
          ''
        }
      `;

      new maplibregl.Popup()
        .setLngLat(coordinates)
        .setDOMContent(popupContent)
        .addTo(mapInstance);
    });

    mapInstance.on('mouseenter', 'stations-layer', () => {
      mapInstance.getCanvas().style.cursor = 'pointer';
    });

    mapInstance.on('mouseleave', 'stations-layer', () => {
      mapInstance.getCanvas().style.cursor = '';
    });

    const bounds = new maplibregl.LngLatBounds();
    coordinates.forEach(coord => bounds.extend(coord));
    mapInstance.fitBounds(bounds, { padding: 20 });

    loading.value = false;
  });

  mapInstance.on('error', (error) => {
    console.error('Map loading error:', error);
    loading.value = false;
  });
};

const updateMapTheme = () => {
  if (!mapInstance || !mapContainerRef.value) return;
  
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }
  initializeMap(mapContainerRef.value);
};

const handleThemeChange = () => {
  updateThemeFromStorage();
  updateMapTheme();
};

onMounted(() => {
  updateThemeFromStorage();
  
  window.addEventListener('storage', handleThemeChange);
  
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
  window.removeEventListener('storage', handleThemeChange);
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
  if (mapInstance) {
    mapInstance.remove();
  }
});

watch(() => props.stops, () => {
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }
  if (mapContainerRef.value) {
    initializeMap(mapContainerRef.value);
  }
}, { deep: true });
</script>

<style scoped>
.map-container {
  position: relative;
  height: 300px;
  width: 100%;
  border-radius: 6px;
  margin-top: 12px;
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