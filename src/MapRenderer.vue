<template>
  <div ref="mapContainerRef" class="map-container">
    <div v-if="loading" class="map-overlay">
      <n-spin size="small" />
      <n-text depth="3" style="margin-left: 8px">地图渲染中...</n-text>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, inject } from "vue";
import { NSpin, NText } from "naive-ui";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

function wgs84ToGcj02(lng, lat) {
  const PI = 3.14159265358979324;
  const A = 6378245.0;
  const EE = 0.00669342162296594323;

  function transformLat(lng, lat) {
    let ret =
      -100.0 +
      2.0 * lng +
      3.0 * lat +
      0.2 * lat * lat +
      0.1 * lng * lat +
      0.2 * Math.sqrt(Math.abs(lng));
    ret +=
      ((20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) *
        2.0) /
      3.0;
    ret +=
      ((20.0 * Math.sin(lat * PI) + 40.0 * Math.sin((lat / 3.0) * PI)) * 2.0) /
      3.0;
    ret +=
      ((160.0 * Math.sin((lat / 12.0) * PI) +
        320 * Math.sin((lat * PI) / 30.0)) *
        2.0) /
      3.0;
    return ret;
  }

  function transformLng(lng, lat) {
    let ret =
      300.0 +
      lng +
      2.0 * lat +
      0.1 * lng * lng +
      0.1 * lng * lat +
      0.1 * Math.sqrt(Math.abs(lng));
    ret +=
      ((20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) *
        2.0) /
      3.0;
    ret +=
      ((20.0 * Math.sin(lng * PI) + 40.0 * Math.sin((lng / 3.0) * PI)) * 2.0) /
      3.0;
    ret +=
      ((150.0 * Math.sin((lng / 12.0) * PI) +
        300.0 * Math.sin((lng / 30.0) * PI)) *
        2.0) /
      3.0;
    return ret;
  }

  function outOfChina(lng, lat) {
    return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
  }

  if (outOfChina(lng, lat)) {
    return [lng, lat];
  }

  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI);
  dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI);
  const mgLat = lat + dLat;
  const mgLng = lng + dLng;

  return [mgLng, mgLat];
}

const props = defineProps({
  stops: {
    type: Array,
    required: true,
  },
});

const mapContainerRef = ref(null);
const loading = ref(true);
let mapInstance = null;
let resizeObserver = null;

const isDark = ref(true);
const isChinaUser = inject("isChinaUser", false);

const updateThemeFromStorage = () => {
  const savedTheme = localStorage.getItem("theme");
  isDark.value = savedTheme === "dark";
};

const getThemeColors = () => {
  const isDarkMode = isDark.value;
  if (isChinaUser.value) {
    return {
      polylineColor: "#000000",
      markerColor: "#000000",
      markerFillColor: "#000000",
      containerBg: isDarkMode ? "#1a1a1a" : "#ffffff",
      tileLayer:
        "https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}",
    };
  } else {
    return {
      polylineColor: "#000000",
      markerColor: "#000000",
      markerFillColor: isDarkMode ? "#000000" : "#ffffff",
      containerBg: isDarkMode ? "#0d1117" : "#f6f8fa",
      tileLayer: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    };
  }
};

const initializeMap = (element) => {
  if (!element || mapInstance) return;

  let validStops = props.stops.filter(
    (s) => s.lat != null && s.lon != null && s.lat !== 0 && s.lon !== 0
  );
  if (validStops.length === 0) {
    loading.value = false;
    return;
  }

  if (isChinaUser.value) {
    validStops = validStops.map((stop) => {
      const [lng, lat] = wgs84ToGcj02(stop.lon, stop.lat);
      return { ...stop, lon: lng, lat: lat };
    });
  }

  const colors = getThemeColors();

  const tileSource = isChinaUser.value
    ? {
      type: "raster",
      tiles: [
        "http://wprd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&x={x}&y={y}&z={z}",
        "http://wprd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&x={x}&y={y}&z={z}",
        "http://wprd03.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&x={x}&y={y}&z={z}",
        "http://wprd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&x={x}&y={y}&z={z}",
      ],
      tileSize: 128,
      attribution: "© 高德地图",
    }
    : {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    };

  mapInstance = new maplibregl.Map({
    container: element,
    attributionControl: true,
    style: {
      version: 8,
      sources: {
        "map-tiles": tileSource,
      },
      layers: [
        {
          id: "map-tiles",
          type: "raster",
          source: "map-tiles",
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
    center: isChinaUser.value ? [104.1954, 35.8617] : [104.1954, 35.8617],
    zoom: isChinaUser.value ? 5 : 4,
  });

  mapInstance.on("load", () => {
    const coordinates = validStops.map((s) => [s.lon, s.lat]);

    if (coordinates.length >= 2) {
      mapInstance.addSource("railway-route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: coordinates,
          },
        },
      });

      mapInstance.addLayer({
        id: "railway-line",
        type: "line",
        source: "railway-route",
        paint: {
          "line-color": colors.polylineColor,
          "line-width": 4,
          "line-opacity": 0.8,
        },
      });
    }

    const sortedFeatures = validStops
      .map((s) => ({
        type: "Feature",
        properties: {
          name: s.n,
          lines: s.rn || [],
          isStop: s.st,
          lineName: s.ln
        },
        geometry: {
          type: "Point",
          coordinates: [s.lon, s.lat],
        },
      }))
      .sort((a, b) => {
        return Number(a.properties.isStop) - Number(b.properties.isStop);
      });

    mapInstance.addSource("stations", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: sortedFeatures,
      },
    });
    mapInstance.addLayer({
      id: "stations-layer",
      type: "circle",
      source: "stations",
      paint: {
        "circle-radius": [
          "case",
          ["==", ["get", "isStop"], false], 2,
          4
        ],
        "circle-color": [
          "case",
          ["==", ["get", "isStop"], false], "#888888",
          colors.markerFillColor
        ],
        "circle-stroke-width": [
          "case",
          ["==", ["get", "isStop"], false], 0,
          2
        ],
        "circle-stroke-color": colors.markerColor,
      },
    });

    mapInstance.on("click", "stations-layer", (e) => {
      const coordinates = e.features[0].geometry.coordinates.slice();
      const name = e.features[0].properties.name;
      const lines = JSON.parse(e.features[0].properties.lines || "[]");

      const popupContent = document.createElement("div");
      popupContent.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 4px; color: black">${name}</div>
        ${lines.length > 0
          ? `<div style="display: flex; flex-wrap: wrap; gap: 3px; margin-top: 4px;">
            ${lines
            .map(
              (line) =>
                `<span style="background: #1a7f37; color: white; padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 500;">${line}</span>`
            )
            .join("")}
          </div>`
          : ""
        }
      `;

      new maplibregl.Popup()
        .setLngLat(coordinates)
        .setDOMContent(popupContent)
        .addTo(mapInstance);
    });

    mapInstance.on("mouseenter", "stations-layer", () => {
      mapInstance.getCanvas().style.cursor = "pointer";
    });

    mapInstance.on("mouseleave", "stations-layer", () => {
      mapInstance.getCanvas().style.cursor = "";
    });

    const bounds = new maplibregl.LngLatBounds();
    coordinates.forEach((coord) => bounds.extend(coord));
    mapInstance.fitBounds(bounds, { padding: 20, animate: false });

    loading.value = false;
  });

  mapInstance.on("error", (error) => {
    console.error("Map loading error:", error);
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
  window.addEventListener("storage", handleThemeChange);

  if (mapContainerRef.value) {
    setTimeout(() => {
      initializeMap(mapContainerRef.value);
    }, 0);
  }
});

onUnmounted(() => {
  window.removeEventListener("storage", handleThemeChange);
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
  if (mapInstance) {
    mapInstance.remove();
  }
});

watch(
  () => props.stops,
  () => {
    if (mapInstance) {
      mapInstance.remove();
      mapInstance = null;
    }
    if (mapContainerRef.value) {
      initializeMap(mapContainerRef.value);
    }
  },
  { deep: true }
);
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