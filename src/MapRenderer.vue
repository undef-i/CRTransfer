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
    attributionControl: false, 
    style: {
    "version": 8,
    "name": "ZHCN PUBLIC",
    "metadata": {
        "owner": "PKKJ"
    },
    "center": [
        120,
        40
    ],
    "zoom": 5,
    "bearing": 0,
    "pitch": 0,
    "sources": {
        "railbase": {
            "type": "vector",
            "url": "http://geogv.org:9090/data/public-20250615.json"
        }
    },
    "sprite": "http://geogv.org:9090/styles/zhcn/sprite",
    "glyphs": "http://geogv.org:9090/fonts/{fontstack}/{range}.pbf",
    "layers": [
        {
            "id": "background",
            "type": "background",
            "paint": {
                "background-color": "#f8f4f0"
            }
        },
        {
            "id": "ocean",
            "type": "fill",
            "source": "railbase",
            "source-layer": "water",
            "paint": {
                "fill-color": "hsl(210, 67%, 85%)"
            }
        },
        {
            "id": "water",
            "type": "fill",
            "source": "railbase",
            "source-layer": "natural",
            "filter": [
                "==",
                "natural",
                "water"
            ],
            "paint": {
                "fill-color": "hsl(210, 67%, 85%)"
            }
        },
        {
            "id": "waterway-river",
            "type": "line",
            "source": "railbase",
            "source-layer": "waterway",
            "layout": {
                "line-cap": "round"
            },
            "paint": {
                "line-color": "hsl(210, 67%, 85%)",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            1,
                            0.4
                        ],
                        [
                            3,
                            1
                        ],
                        [
                            7,
                            2
                        ]
                    ]
                }
            }
        },
        {
            "id": "aerodrome",
            "metadata": {
                "description": "The shape of the boundary of airport"
            },
            "type": "fill",
            "source": "railbase",
            "source-layer": "aerodrome",
            "paint": {
                "fill-color": "#E9E7E2",
                "fill-outline-color": "#D1CFCB"
            }
        },
        {
            "id": "highway-secondary",
            "type": "line",
            "source": "railbase",
            "source-layer": "highway",
            "filter": [
                "all",
                [
                    "in",
                    "class",
                    "secondary",
                    "secondary_link"
                ]
            ],
            "layout": {
                "line-cap": "round",
                "line-join": "round",
                "visibility": "visible"
            },
            "paint": {
                "line-color": "#ffffff",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            6.5,
                            0
                        ],
                        [
                            8,
                            0.8
                        ],
                        [
                            20,
                            15
                        ]
                    ]
                }
            }
        },
        {
            "id": "highway-tertiary",
            "type": "line",
            "source": "railbase",
            "source-layer": "highway",
            "filter": [
                "==",
                "class",
                "tertiary"
            ],
            "layout": {
                "line-cap": "round",
                "line-join": "round",
                "visibility": "visible"
            },
            "paint": {
                "line-color": "#ffffff",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            6.5,
                            0
                        ],
                        [
                            8,
                            0.5
                        ],
                        [
                            20,
                            13
                        ]
                    ]
                }
            }
        },
        {
            "id": "highway-unclassified-residential",
            "type": "line",
            "source": "railbase",
            "source-layer": "highway",
            "filter": [
                "all",
                [
                    "in",
                    "class",
                    "minor"
                ]
            ],
            "layout": {
                "line-cap": "round",
                "line-join": "round",
                "visibility": "visible"
            },
            "paint": {
                "line-color": "#ffffff",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            6.5,
                            0
                        ],
                        [
                            10,
                            0.4
                        ],
                        [
                            20,
                            10
                        ]
                    ]
                }
            }
        },
        {
            "id": "highway-motorway-casing",
            "type": "line",
            "source": "railbase",
            "source-layer": "highway",
            "minzoom": 5,
            "filter": [
                "all",
                [
                    "in",
                    "class",
                    "motorway",
                    "motorway_link"
                ]
            ],
            "layout": {
                "line-cap": "round",
                "line-join": "round",
                "visibility": "visible"
            },
            "paint": {
                "line-color": "#ffd680",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            5,
                            0.4
                        ],
                        [
                            6,
                            0.6
                        ],
                        [
                            7,
                            1.5
                        ],
                        [
                            20,
                            22
                        ]
                    ]
                }
            }
        },
        {
            "id": "highway-trunk-primary-casing",
            "type": "line",
            "source": "railbase",
            "source-layer": "highway",
            "filter": [
                "all",
                [
                    "all",
                    [
                        "in",
                        "class",
                        "primary",
                        "trunk",
                        "primary_link",
                        "trunk_link"
                    ]
                ]
            ],
            "layout": {
                "line-join": "round",
                "visibility": "visible"
            },
            "paint": {
                "line-color": "#ffe6b3",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            5,
                            0.4
                        ],
                        [
                            6,
                            0.6
                        ],
                        [
                            7,
                            1.5
                        ],
                        [
                            20,
                            26
                        ]
                    ]
                }
            }
        },
        {
            "id": "highway-trunk-primary",
            "type": "line",
            "source": "railbase",
            "source-layer": "highway",
            "filter": [
                "all",
                [
                    "all",
                    [
                        "in",
                        "class",
                        "primary",
                        "trunk",
                        "primary_link",
                        "trunk_link"
                    ]
                ]
            ],
            "layout": {
                "line-cap": "round",
                "line-join": "round",
                "visibility": "visible"
            },
            "paint": {
                "line-color": "#fff1e6",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            6.5,
                            0
                        ],
                        [
                            7,
                            0.5
                        ],
                        [
                            20,
                            18
                        ]
                    ]
                }
            }
        },
        {
            "id": "highway-motorway",
            "type": "line",
            "source": "railbase",
            "source-layer": "highway",
            "minzoom": 5,
            "filter": [
                "all",
                [
                    "==",
                    "$type",
                    "LineString"
                ],
                [
                    "all",
                    [
                        "in",
                        "class",
                        "motorway",
                        "motorway_link"
                    ]
                ]
            ],
            "layout": {
                "line-cap": "round",
                "line-join": "round",
                "visibility": "visible"
            },
            "paint": {
                "line-color": "#ffefcd",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            6.5,
                            0
                        ],
                        [
                            7,
                            0.5
                        ],
                        [
                            20,
                            18
                        ]
                    ]
                }
            }
        },
        {
            "id": "admin2b",
            "type": "line",
            "source": "railbase",
            "source-layer": "admin2b",
            "layout": {
                "line-cap": "round",
                "line-join": "round"
            },
            "filter": [
                "==",
                "dispute",
                0
            ],
            "paint": {
                "line-color": "hsl(248, 7%, 66%)",
                "line-width": {
                    "base": 1,
                    "stops": [
                        [
                            0,
                            0.6
                        ],
                        [
                            4,
                            1.4
                        ],
                        [
                            5,
                            2
                        ],
                        [
                            12,
                            5
                        ]
                    ]
                }
            }
        },
        {
            "id": "admin2b-disputed",
            "type": "line",
            "source": "railbase",
            "source-layer": "admin2b",
            "filter": [
                "==",
                "dispute",
                1
            ],
            "layout": {
                "line-cap": "round",
                "line-join": "round"
            },
            "paint": {
                "line-color": "hsl(248, 7%, 70%)",
                "line-dasharray": [
                    1,
                    3
                ],
                "line-width": {
                    "base": 1,
                    "stops": [
                        [
                            0,
                            0.6
                        ],
                        [
                            4,
                            1.4
                        ],
                        [
                            5,
                            2
                        ],
                        [
                            12,
                            5
                        ]
                    ]
                }
            }
        },
        {
            "id": "admin4b",
            "type": "line",
            "source": "railbase",
            "source-layer": "admin4b",
            "layout": {
                "line-join": "round"
            },
            "paint": {
                "line-color": "#CDCDBC",
                "line-dasharray": [
                    3,
                    1,
                    1,
                    1
                ],
                "line-width": {
                    "base": 1,
                    "stops": [
                        [
                            4,
                            0.4
                        ],
                        [
                            5,
                            1
                        ],
                        [
                            12,
                            3
                        ]
                    ]
                }
            }
        },
        {
            "id": "rail-f",
            "type": "line",
            "source": "railbase",
            "source-layer": "rail",
            "layout": {
                "visibility": "visible"
            },
            "filter": [
                "in",
                "TYPE",
                "F",
                "F_TRUNK"
            ],
            "paint": {
                "line-color": "#86b300",
                "line-width": {
                    "base": 1,
                    "stops": [
                        [
                            3,
                            0.5
                        ],
                        [
                            5,
                            1
                        ],
                        [
                            7,
                            1.25
                        ],
                        [
                            9,
                            1.75
                        ]
                    ]
                }
            }
        },
        {
            "id": "rail-f2_trunk-h",
            "type": "line",
            "source": "railbase",
            "source-layer": "rail",
            "minzoom": 14,
            "filter": [
                "in",
                "TYPE",
                "F2_TRUNK"
            ],
            "paint": {
                "line-color": "#86b300",
                "line-width": {
                    "base": 1,
                    "stops": [
                        [
                            7,
                            1.25
                        ],
                        [
                            9,
                            1.75
                        ]
                    ]
                }
            }
        },
        {
            "id": "rail-f2_trunk_l",
            "type": "line",
            "source": "railbase",
            "source-layer": "rail",
            "maxzoom": 14,
            "filter": [
                "in",
                "TYPE",
                "F2_TRUNK"
            ],
            "paint": {
                "line-color": "#86b300",
                "line-width": {
                    "base": 1,
                    "stops": [
                        [
                            3,
                            1
                        ],
                        [
                            5,
                            1.75
                        ],
                        [
                            7,
                            2.5
                        ],
                        [
                            9,
                            3
                        ]
                    ]
                }
            }
        },
        {
            "id": "rail-f2",
            "type": "line",
            "source": "railbase",
            "source-layer": "rail",
            "layout": {
                "visibility": "visible"
            },
            "filter": [
                "in",
                "TYPE",
                "F2"
            ],
            "paint": {
                "line-color": "#86b300",
                "line-width": {
                    "base": 1,
                    "stops": [
                        [
                            3,
                            1
                        ],
                        [
                            5,
                            1.75
                        ],
                        [
                            7,
                            2.5
                        ],
                        [
                            9,
                            3
                        ]
                    ]
                }
            }
        },
        {
            "id": "rail-r",
            "type": "line",
            "source": "railbase",
            "source-layer": "rail",
            "layout": {
                "visibility": "visible"
            },
            "filter": [
                "in",
                "TYPE",
                "R",
                "R_TRUNK"
            ],
            "paint": {
                "line-color": "#33a02c",
                "line-width": {
                    "base": 1,
                    "stops": [
                        [
                            3,
                            0.5
                        ],
                        [
                            5,
                            1
                        ],
                        [
                            7,
                            1.25
                        ],
                        [
                            9,
                            1.75
                        ]
                    ]
                }
            }
        },
        {
            "id": "rail-r2_trunk-h",
            "type": "line",
            "source": "railbase",
            "source-layer": "rail",
            "minzoom": 14,
            "filter": [
                "in",
                "TYPE",
                "R2_TRUNK"
            ],
            "paint": {
                "line-color": "#33a02c",
                "line-width": {
                    "base": 1,
                    "stops": [
                        [
                            7,
                            1.25
                        ],
                        [
                            9,
                            1.75
                        ]
                    ]
                }
            }
        },
        {
            "id": "rail-r2_trunk_l",
            "type": "line",
            "source": "railbase",
            "source-layer": "rail",
            "maxzoom": 14,
            "filter": [
                "in",
                "TYPE",
                "R2_TRUNK"
            ],
            "paint": {
                "line-color": "#33a02c",
                "line-width": {
                    "base": 1,
                    "stops": [
                        [
                            3,
                            1
                        ],
                        [
                            5,
                            1.75
                        ],
                        [
                            7,
                            2.5
                        ],
                        [
                            9,
                            3
                        ]
                    ]
                }
            }
        },
        {
            "id": "rail-r2",
            "type": "line",
            "source": "railbase",
            "source-layer": "rail",
            "filter": [
                "in",
                "TYPE",
                "R2"
            ],
            "paint": {
                "line-color": "#33a02c",
                "line-width": {
                    "base": 2.5,
                    "stops": [
                        [
                            3,
                            1
                        ],
                        [
                            5,
                            1.75
                        ],
                        [
                            7,
                            2.5
                        ],
                        [
                            9,
                            3
                        ]
                    ]
                }
            }
        },
        {
            "id": "rail-rr1",
            "type": "line",
            "source": "railbase",
            "source-layer": "rail",
            "layout": {
                "visibility": "visible"
            },
            "filter": [
                "in",
                "TYPE",
                "RR1",
                "RR1_TRUNK"
            ],
            "paint": {
                "line-color": "#ff9900",
                "line-width": {
                    "base": 1,
                    "stops": [
                        [
                            3,
                            0.5
                        ],
                        [
                            5,
                            1
                        ],
                        [
                            7,
                            1.25
                        ],
                        [
                            9,
                            1.75
                        ]
                    ]
                }
            }
        },
        {
            "id": "rail-rr_trunk-h",
            "type": "line",
            "source": "railbase",
            "source-layer": "rail",
            "minzoom": 14,
            "filter": [
                "in",
                "TYPE",
                "RR_TRUNK"
            ],
            "paint": {
                "line-color": "#ff9900",
                "line-width": {
                    "base": 1,
                    "stops": [
                        [
                            7,
                            1.25
                        ],
                        [
                            9,
                            1.75
                        ]
                    ]
                }
            }
        },
        {
            "id": "rail-rr_trunk_l",
            "type": "line",
            "source": "railbase",
            "source-layer": "rail",
            "maxzoom": 14,
            "filter": [
                "in",
                "TYPE",
                "RR_TRUNK"
            ],
            "paint": {
                "line-color": "#ff9900",
                "line-width": {
                    "base": 1,
                    "stops": [
                        [
                            3,
                            1
                        ],
                        [
                            5,
                            1.75
                        ],
                        [
                            7,
                            2.5
                        ],
                        [
                            9,
                            3
                        ]
                    ]
                }
            }
        },
        {
            "id": "rail-rr",
            "type": "line",
            "source": "railbase",
            "source-layer": "rail",
            "layout": {
                "visibility": "visible"
            },
            "filter": [
                "in",
                "TYPE",
                "RR"
            ],
            "paint": {
                "line-color": "#ff9900",
                "line-width": {
                    "base": 1,
                    "stops": [
                        [
                            3,
                            1
                        ],
                        [
                            5,
                            1.75
                        ],
                        [
                            7,
                            2.5
                        ],
                        [
                            9,
                            3
                        ]
                    ]
                }
            }
        },
        {
            "id": "rail-hsr1",
            "type": "line",
            "source": "railbase",
            "source-layer": "rail",
            "layout": {
                "visibility": "visible"
            },
            "filter": [
                "in",
                "TYPE",
                "HSR1",
                "HSR1_TRUNK"
            ],
            "paint": {
                "line-color": "#ff3300",
                "line-width": {
                    "base": 1,
                    "stops": [
                        [
                            3,
                            0.5
                        ],
                        [
                            5,
                            1
                        ],
                        [
                            7,
                            1.25
                        ],
                        [
                            9,
                            1.75
                        ]
                    ]
                }
            }
        },
        {
            "id": "rail-hsr_trunk_l",
            "type": "line",
            "source": "railbase",
            "source-layer": "rail",
            "maxzoom": 14,
            "filter": [
                "in",
                "TYPE",
                "HSR_TRUNK"
            ],
            "paint": {
                "line-color": "#ff3300",
                "line-width": {
                    "base": 1,
                    "stops": [
                        [
                            3,
                            1
                        ],
                        [
                            5,
                            1.75
                        ],
                        [
                            7,
                            2.5
                        ],
                        [
                            9,
                            3
                        ]
                    ]
                }
            }
        },
        {
            "id": "rail-hsr_trunk_h",
            "type": "line",
            "source": "railbase",
            "source-layer": "rail",
            "minzoom": 14,
            "filter": [
                "in",
                "TYPE",
                "HSR_TRUNK"
            ],
            "paint": {
                "line-color": "#ff3300",
                "line-width": {
                    "base": 1,
                    "stops": [
                        [
                            7,
                            1.25
                        ],
                        [
                            9,
                            1.75
                        ]
                    ]
                }
            }
        },
        {
            "id": "rail-hsr",
            "type": "line",
            "source": "railbase",
            "source-layer": "rail",
            "layout": {
                "visibility": "visible"
            },
            "filter": [
                "in",
                "TYPE",
                "HSR"
            ],
            "paint": {
                "line-color": "#ff3300",
                "line-width": {
                    "base": 1,
                    "stops": [
                        [
                            3,
                            1
                        ],
                        [
                            5,
                            1.75
                        ],
                        [
                            7,
                            2.5
                        ],
                        [
                            9,
                            3
                        ]
                    ]
                }
            }
        },
        {
            "id": "sea-poi",
            "type": "symbol",
            "source": "railbase",
            "source-layer": "worldplace",
            "filter": [
                "==",
                "ty",
                "SEA"
            ],
            "layout": {
                "text-padding": 1,
                "text-font": [
                    "Open Sans Italic",
                    "Noto Sans Regular"
                ],
                "text-anchor": "center",
                "text-field": "{zh}",
                "text-offset": [
                    0,
                    0
                ],
                "text-size": {
                    "base": 1,
                    "stops": [
                        [
                            3,
                            12
                        ],
                        [
                            7,
                            16
                        ],
                        [
                            11,
                            18
                        ]
                    ]
                }
            },
            "paint": {
                "text-color": "#6193D3"
            }
        },
        {
            "id": "water-poi",
            "type": "symbol",
            "source": "railbase",
            "source-layer": "water_poi",
            "layout": {
                "text-padding": 1,
                "text-font": [
                    "Open Sans Italic",
                    "Noto Sans Regular"
                ],
                "text-anchor": "center",
                "text-field": "{zh}",
                "text-offset": [
                    0,
                    0
                ],
                "text-size": {
                    "base": 1,
                    "stops": [
                        [
                            5,
                            10
                        ],
                        [
                            9,
                            12
                        ],
                        [
                            11,
                            13
                        ]
                    ]
                }
            },
            "paint": {
                "text-color": "#3276b5"
            }
        },
        {
            "id": "ocean-poi",
            "type": "symbol",
            "source": "railbase",
            "source-layer": "ocean_poi",
            "layout": {
                "text-padding": 1,
                "text-font": [
                    "Open Sans Italic",
                    "Noto Sans Regular"
                ],
                "text-anchor": "center",
                "text-field": "{zh}",
                "text-offset": [
                    0,
                    0
                ],
                "text-size": {
                    "base": 1,
                    "stops": [
                        [
                            5,
                            13
                        ],
                        [
                            9,
                            15
                        ],
                        [
                            11,
                            17
                        ]
                    ]
                }
            },
            "paint": {
                "text-color": "#3276b5"
            }
        },
        {
            "id": "location-city-lv4",
            "type": "symbol",
            "source": "railbase",
            "source-layer": "worldplace",
            "filter": [
                "all",
                [
                    "in",
                    "ty",
                    "CN_TOWN",
                    "TOWN"
                ]
            ],
            "layout": {
                "text-padding": 1,
                "text-font": [
                    "Open Sans Regular",
                    "Noto Sans Regular"
                ],
                "text-anchor": "center",
                "text-field": "{zh}",
                "text-size": {
                    "base": 1,
                    "stops": [
                        [
                            5,
                            11
                        ],
                        [
                            7,
                            11
                        ],
                        [
                            9,
                            12
                        ],
                        [
                            11,
                            13
                        ]
                    ]
                },
                "visibility": "visible"
            },
            "paint": {
                "text-color": "#bc9c7a",
                "text-halo-color": "hsla(0, 0%, 100%, 0.75)",
                "text-halo-blur": 0.5,
                "text-halo-width": 2
            }
        },
        {
            "id": "location-city-lv3",
            "type": "symbol",
            "source": "railbase",
            "source-layer": "worldplace",
            "filter": [
                "all",
                [
                    "in",
                    "ty",
                    "CITY",
                    "DISTRICT",
                    "IMPT_CITY"
                ]
            ],
            "layout": {
                "icon-image": {
                    "base": 1,
                    "stops": [
                        [
                            1,
                            "dot_10"
                        ],
                        [
                            7,
                            ""
                        ]
                    ]
                },
                "text-padding": 1,
                "text-font": [
                    "Open Sans Regular",
                    "Noto Sans Regular"
                ],
                "text-anchor": {
                    "base": 1,
                    "stops": [
                        [
                            0,
                            "bottom"
                        ],
                        [
                            7,
                            "center"
                        ]
                    ]
                },
                "text-field": "{zh}",
                "text-offset": [
                    0,
                    -0.4
                ],
                "text-size": {
                    "base": 1,
                    "stops": [
                        [
                            5,
                            12
                        ],
                        [
                            7,
                            13
                        ],
                        [
                            9,
                            15
                        ],
                        [
                            11,
                            16
                        ]
                    ]
                },
                "visibility": "visible"
            },
            "paint": {
                "text-color": "#999999",
                "text-halo-color": "hsla(0, 0%, 100%, 0.75)",
                "text-halo-blur": 0.5,
                "text-halo-width": 2
            }
        },
        {
            "id": "location-city-lv2",
            "type": "symbol",
            "source": "railbase",
            "source-layer": "worldplace",
            "filter": [
                "all",
                [
                    "in",
                    "ty",
                    "IMPT_MAJOR_CITY",
                    "MAJOR_CITY"
                ]
            ],
            "layout": {
                "icon-image": {
                    "base": 1,
                    "stops": [
                        [
                            1,
                            "dot_11"
                        ],
                        [
                            7,
                            ""
                        ]
                    ]
                },
                "text-padding": 1,
                "text-font": [
                    "Open Sans Regular",
                    "Noto Sans Regular"
                ],
                "text-anchor": {
                    "base": 1,
                    "stops": [
                        [
                            0,
                            "bottom"
                        ],
                        [
                            7,
                            "center"
                        ]
                    ]
                },
                "text-field": "{zh}",
                "text-offset": [
                    0,
                    -0.4
                ],
                "text-size": {
                    "base": 1,
                    "stops": [
                        [
                            5,
                            13
                        ],
                        [
                            7,
                            14
                        ],
                        [
                            9,
                            16
                        ],
                        [
                            11,
                            18
                        ]
                    ]
                },
                "visibility": "visible"
            },
            "paint": {
                "text-color": "#6b6b6b",
                "text-halo-color": "hsla(0, 0%, 100%, 0.75)",
                "text-halo-blur": 0.5,
                "text-halo-width": 2
            }
        },
        {
            "id": "location-city-capital",
            "type": "symbol",
            "source": "railbase",
            "source-layer": "worldplace",
            "filter": [
                "==",
                "ty",
                "CAPITAL"
            ],
            "layout": {
                "icon-image": {
                    "base": 1,
                    "stops": [
                        [
                            1,
                            "dot_12"
                        ],
                        [
                            7,
                            ""
                        ]
                    ]
                },
                "text-padding": 1,
                "text-font": [
                    "Open Sans Regular",
                    "Noto Sans Regular"
                ],
                "text-anchor": {
                    "base": 1,
                    "stops": [
                        [
                            0,
                            "bottom"
                        ],
                        [
                            7,
                            "center"
                        ]
                    ]
                },
                "text-field": "{zh}",
                "text-offset": [
                    0,
                    -0.4
                ],
                "text-size": {
                    "base": 1,
                    "stops": [
                        [
                            5,
                            13
                        ],
                        [
                            7,
                            14
                        ],
                        [
                            9,
                            16
                        ],
                        [
                            11,
                            18
                        ]
                    ]
                },
                "visibility": "visible"
            },
            "paint": {
                "text-color": "#6b6b6b",
                "text-halo-color": "hsla(0, 0%, 100%, 0.75)",
                "text-halo-blur": 0.5,
                "text-halo-width": 2
            }
        },
        {
            "id": "location-country-lv1",
            "type": "symbol",
            "source": "railbase",
            "source-layer": "worldplace",
            "filter": [
                "all",
                [
                    "==",
                    "ty",
                    "COUNTRY"
                ]
            ],
            "layout": {
                "text-padding": 1,
                "text-font": [
                    "Roboto Condensed Regular",
                    "Noto Sans Regular"
                ],
                "text-anchor": "center",
                "text-field": "{zh}",
                "text-offset": [
                    0,
                    0
                ],
                "text-size": {
                    "base": 1,
                    "stops": [
                        [
                            2,
                            10
                        ],
                        [
                            7,
                            17
                        ]
                    ]
                },
                "visibility": "visible"
            },
            "paint": {
                "text-color": "#00004d",
                "text-halo-color": "hsla(0, 0%, 100%, 0.75)",
                "text-halo-blur": 0.5,
                "text-halo-width": 2
            }
        },
        {
            "id": "station-0-circle",
            "type": "circle",
            "source": "railbase",
            "source-layer": "station",
            "filter": [
                "==",
                "class",
                0
            ],
            "paint": {
                "circle-radius": {
                    "base": 1,
                    "stops": [
                        [
                            2,
                            2.5
                        ],
                        [
                            4,
                            3.5
                        ],
                        [
                            6,
                            4.5
                        ]
                    ]
                },
                "circle-color": "#ff4000",
                "circle-stroke-width": 2,
                "circle-stroke-color": "#6b6b6b"
            }
        },
        {
            "id": "station-1-circle",
            "type": "circle",
            "source": "railbase",
            "source-layer": "station",
            "filter": [
                "==",
                "class",
                1
            ],
            "paint": {
                "circle-radius": {
                    "base": 1,
                    "stops": [
                        [
                            2,
                            2.25
                        ],
                        [
                            4,
                            3
                        ],
                        [
                            6,
                            3.5
                        ]
                    ]
                },
                "circle-color": "#ff8000",
                "circle-stroke-width": 2.5,
                "circle-stroke-color": "#6b6b6b"
            }
        },
        {
            "id": "station-2-circle",
            "type": "circle",
            "source": "railbase",
            "source-layer": "station",
            "filter": [
                "==",
                "class",
                2
            ],
            "paint": {
                "circle-radius": {
                    "base": 1,
                    "stops": [
                        [
                            2,
                            2
                        ],
                        [
                            4,
                            2.2
                        ],
                        [
                            6,
                            2.9
                        ]
                    ]
                },
                "circle-color": "#ffbf00",
                "circle-stroke-width": 2,
                "circle-stroke-color": "#6b6b6b"
            }
        },
        {
            "id": "station-4-circle",
            "type": "circle",
            "source": "railbase",
            "source-layer": "station",
            "filter": [
                "==",
                "class",
                4
            ],
            "paint": {
                "circle-radius": {
                    "base": 1,
                    "stops": [
                        [
                            4,
                            2.2
                        ],
                        [
                            6,
                            2.5
                        ]
                    ]
                },
                "circle-color": "#ffff00",
                "circle-stroke-width": 1.75,
                "circle-stroke-color": "#8c8c8c"
            }
        },
        {
            "id": "station-5-circle",
            "type": "circle",
            "source": "railbase",
            "source-layer": "station",
            "filter": [
                "==",
                "class",
                5
            ],
            "paint": {
                "circle-radius": {
                    "base": 1,
                    "stops": [
                        [
                            4,
                            2.2
                        ],
                        [
                            6,
                            2.5
                        ]
                    ]
                },
                "circle-color": "#bfbfbf",
                "circle-stroke-width": 1.75,
                "circle-stroke-color": "#8c8c8c"
            }
        },
        {
            "id": "poi",
            "type": "symbol",
            "source": "railbase",
            "source-layer": "poi",
            "layout": {
                "text-padding": 2,
                "text-font": [
                    "Open Sans Regular",
                    "Noto Sans Regular"
                ],
                "text-anchor": "top",
                "icon-image": "{icon}_11",
                "text-field": "{zh}",
                "text-offset": [
                    0,
                    0.6
                ],
                "text-size": {
                    "base": 1,
                    "stops": [
                        [
                            5,
                            11
                        ],
                        [
                            9,
                            11
                        ],
                        [
                            11,
                            12
                        ]
                    ]
                },
                "text-max-width": 9
            },
            "paint": {
                "text-color": {
                    "type": "identity",
                    "property": "text_color"
                },
                "text-halo-color": "#ffffff",
                "text-halo-blur": 0.5,
                "text-halo-width": 1
            }
        },
        {
            "id": "island",
            "type": "symbol",
            "source": "railbase",
            "source-layer": "island",
            "layout": {
                "text-padding": 2,
                "text-font": [
                    "Open Sans Regular",
                    "Noto Sans Regular"
                ],
                "text-anchor": "top",
                "icon-image": "{icon}_11",
                "text-field": "{zh}",
                "text-offset": [
                    0,
                    0.6
                ],
                "text-size": {
                    "base": 1,
                    "stops": [
                        [
                            5,
                            11
                        ],
                        [
                            9,
                            11
                        ],
                        [
                            11,
                            12
                        ]
                    ]
                },
                "text-max-width": 9
            },
            "paint": {
                "text-color": "#656565"
            }
        },
        {
            "id": "station-2-r-text",
            "type": "symbol",
            "source": "railbase",
            "source-layer": "station",
            "filter": [
                "all",
                [
                    "==",
                    "ac",
                    "R"
                ],
                [
                    "in",
                    "class",
                    2,
                    4,
                    5
                ]
            ],
            "layout": {
                "text-padding": 1,
                "text-font": [
                    "Noto Sans Regular"
                ],
                "text-anchor": "left",
                "text-field": "{zh}",
                "text-offset": [
                    0.5,
                    0
                ],
                "text-size": {
                    "base": 1,
                    "stops": [
                        [
                            2,
                            10
                        ],
                        [
                            4,
                            11
                        ],
                        [
                            6,
                            12
                        ],
                        [
                            8,
                            13
                        ],
                        [
                            11,
                            13
                        ]
                    ]
                }
            },
            "paint": {
                "text-color": {
                    "property": "class",
                    "stops": [
                        [
                            2,
                            "#0066FF"
                        ],
                        [
                            4,
                            "#0066FF"
                        ],
                        [
                            5,
                            "#515151"
                        ]
                    ]
                },
                "text-halo-color": "hsla(0, 0%, 100%, 0.75)",
                "text-halo-blur": 0.5,
                "text-halo-width": 2
            }
        },
        {
            "id": "station-2-l-text",
            "type": "symbol",
            "source": "railbase",
            "source-layer": "station",
            "filter": [
                "all",
                [
                    "==",
                    "ac",
                    "L"
                ],
                [
                    "in",
                    "class",
                    2,
                    4,
                    5
                ]
            ],
            "layout": {
                "text-padding": 1,
                "text-font": [
                    "Noto Sans Regular"
                ],
                "text-anchor": "right",
                "text-field": "{zh}",
                "text-offset": [
                    -0.5,
                    0
                ],
                "text-size": {
                    "base": 1,
                    "stops": [
                        [
                            2,
                            10
                        ],
                        [
                            4,
                            11
                        ],
                        [
                            6,
                            12
                        ],
                        [
                            8,
                            13
                        ],
                        [
                            11,
                            13
                        ]
                    ]
                }
            },
            "paint": {
                "text-color": {
                    "property": "class",
                    "stops": [
                        [
                            2,
                            "#0066FF"
                        ],
                        [
                            4,
                            "#0066FF"
                        ],
                        [
                            5,
                            "#515151"
                        ]
                    ]
                },
                "text-halo-color": "hsla(0, 0%, 100%, 0.75)",
                "text-halo-blur": 0.5,
                "text-halo-width": 2
            }
        },
        {
            "id": "station-2-t-text",
            "type": "symbol",
            "source": "railbase",
            "source-layer": "station",
            "filter": [
                "all",
                [
                    "==",
                    "ac",
                    "T"
                ],
                [
                    "in",
                    "class",
                    2,
                    4,
                    5
                ]
            ],
            "layout": {
                "text-padding": 1,
                "text-font": [
                    "Noto Sans Regular"
                ],
                "text-anchor": "bottom",
                "text-field": "{zh}",
                "text-offset": [
                    0,
                    -0.5
                ],
                "text-size": {
                    "base": 1,
                    "stops": [
                        [
                            2,
                            10
                        ],
                        [
                            4,
                            11
                        ],
                        [
                            6,
                            12
                        ],
                        [
                            8,
                            13
                        ],
                        [
                            11,
                            13
                        ]
                    ]
                }
            },
            "paint": {
                "text-color": {
                    "property": "class",
                    "stops": [
                        [
                            2,
                            "#0066FF"
                        ],
                        [
                            4,
                            "#0066FF"
                        ],
                        [
                            5,
                            "#515151"
                        ]
                    ]
                },
                "text-halo-color": "hsla(0, 0%, 100%, 0.75)",
                "text-halo-blur": 0.5,
                "text-halo-width": 2
            }
        },
        {
            "id": "station-2-b-text",
            "type": "symbol",
            "source": "railbase",
            "source-layer": "station",
            "filter": [
                "all",
                [
                    "==",
                    "ac",
                    "B"
                ],
                [
                    "in",
                    "class",
                    2,
                    4,
                    5
                ]
            ],
            "layout": {
                "text-padding": 1,
                "text-font": [
                    "Noto Sans Regular"
                ],
                "text-anchor": "top",
                "text-field": "{zh}",
                "text-offset": [
                    0,
                    0.4
                ],
                "text-size": {
                    "base": 1,
                    "stops": [
                        [
                            2,
                            10
                        ],
                        [
                            4,
                            11
                        ],
                        [
                            6,
                            12
                        ],
                        [
                            8,
                            13
                        ],
                        [
                            11,
                            13
                        ]
                    ]
                }
            },
            "paint": {
                "text-color": {
                    "property": "class",
                    "stops": [
                        [
                            2,
                            "#0066FF"
                        ],
                        [
                            4,
                            "#0066FF"
                        ],
                        [
                            5,
                            "#515151"
                        ]
                    ]
                },
                "text-halo-color": "hsla(0, 0%, 100%, 0.75)",
                "text-halo-blur": 0.5,
                "text-halo-width": 2
            }
        },
        {
            "id": "station-2-lt-text",
            "type": "symbol",
            "source": "railbase",
            "source-layer": "station",
            "filter": [
                "all",
                [
                    "==",
                    "ac",
                    "LT"
                ],
                [
                    "in",
                    "class",
                    2,
                    4,
                    5
                ]
            ],
            "layout": {
                "text-padding": 1,
                "text-font": [
                    "Noto Sans Regular"
                ],
                "text-anchor": "bottom-right",
                "text-field": "{zh}",
                "text-offset": [
                    -0.3,
                    -0.4
                ],
                "text-size": {
                    "base": 1,
                    "stops": [
                        [
                            2,
                            10
                        ],
                        [
                            4,
                            11
                        ],
                        [
                            6,
                            12
                        ],
                        [
                            8,
                            13
                        ],
                        [
                            11,
                            13
                        ]
                    ]
                }
            },
            "paint": {
                "text-color": {
                    "property": "class",
                    "stops": [
                        [
                            2,
                            "#0066FF"
                        ],
                        [
                            4,
                            "#0066FF"
                        ],
                        [
                            5,
                            "#515151"
                        ]
                    ]
                },
                "text-halo-color": "hsla(0, 0%, 100%, 0.75)",
                "text-halo-blur": 0.5,
                "text-halo-width": 2
            }
        },
        {
            "id": "station-2-lb-text",
            "type": "symbol",
            "source": "railbase",
            "source-layer": "station",
            "filter": [
                "all",
                [
                    "==",
                    "ac",
                    "LB"
                ],
                [
                    "in",
                    "class",
                    2,
                    4,
                    5
                ]
            ],
            "layout": {
                "text-padding": 1,
                "text-font": [
                    "Noto Sans Regular"
                ],
                "text-anchor": "top-right",
                "text-field": "{zh}",
                "text-offset": [
                    -0.2,
                    0.2
                ],
                "text-size": {
                    "base": 1,
                    "stops": [
                        [
                            2,
                            10
                        ],
                        [
                            4,
                            11
                        ],
                        [
                            6,
                            12
                        ],
                        [
                            8,
                            13
                        ],
                        [
                            11,
                            13
                        ]
                    ]
                }
            },
            "paint": {
                "text-color": {
                    "property": "class",
                    "stops": [
                        [
                            2,
                            "#0066FF"
                        ],
                        [
                            4,
                            "#0066FF"
                        ],
                        [
                            5,
                            "#515151"
                        ]
                    ]
                },
                "text-halo-color": "hsla(0, 0%, 100%, 0.75)",
                "text-halo-blur": 0.5,
                "text-halo-width": 2
            }
        },
        {
            "id": "station-2-rt-text",
            "type": "symbol",
            "source": "railbase",
            "source-layer": "station",
            "filter": [
                "all",
                [
                    "==",
                    "ac",
                    "RT"
                ],
                [
                    "in",
                    "class",
                    2,
                    4,
                    5
                ]
            ],
            "layout": {
                "text-padding": 1,
                "text-font": [
                    "Noto Sans Regular"
                ],
                "text-anchor": "bottom-left",
                "text-field": "{zh}",
                "text-offset": [
                    0.3,
                    -0.4
                ],
                "text-size": {
                    "base": 1,
                    "stops": [
                        [
                            2,
                            10
                        ],
                        [
                            4,
                            11
                        ],
                        [
                            6,
                            12
                        ],
                        [
                            8,
                            13
                        ],
                        [
                            11,
                            13
                        ]
                    ]
                }
            },
            "paint": {
                "text-color": {
                    "property": "class",
                    "stops": [
                        [
                            2,
                            "#0066FF"
                        ],
                        [
                            4,
                            "#0066FF"
                        ],
                        [
                            5,
                            "#515151"
                        ]
                    ]
                },
                "text-halo-color": "hsla(0, 0%, 100%, 0.75)",
                "text-halo-blur": 0.5,
                "text-halo-width": 2
            }
        },
        {
            "id": "station-2-rb-text",
            "type": "symbol",
            "source": "railbase",
            "source-layer": "station",
            "filter": [
                "all",
                [
                    "==",
                    "ac",
                    "RB"
                ],
                [
                    "in",
                    "class",
                    2,
                    4,
                    5
                ]
            ],
            "layout": {
                "text-padding": 1,
                "text-font": [
                    "Noto Sans Regular"
                ],
                "text-anchor": "top-left",
                "text-field": "{zh}",
                "text-offset": [
                    0.2,
                    0.2
                ],
                "text-size": {
                    "base": 1,
                    "stops": [
                        [
                            2,
                            10
                        ],
                        [
                            4,
                            11
                        ],
                        [
                            6,
                            12
                        ],
                        [
                            8,
                            13
                        ],
                        [
                            11,
                            13
                        ]
                    ]
                }
            },
            "paint": {
                "text-color": {
                    "property": "class",
                    "stops": [
                        [
                            2,
                            "#0066FF"
                        ],
                        [
                            4,
                            "#0066FF"
                        ],
                        [
                            5,
                            "#515151"
                        ]
                    ]
                },
                "text-halo-color": "hsla(0, 0%, 100%, 0.75)",
                "text-halo-blur": 0.5,
                "text-halo-width": 2
            }
        },
        {
            "id": "station-0-r-text",
            "type": "symbol",
            "source": "railbase",
            "source-layer": "station",
            "filter": [
                "all",
                [
                    "==",
                    "ac",
                    "R"
                ],
                [
                    "in",
                    "class",
                    0,
                    1
                ]
            ],
            "layout": {
                "text-padding": 1,
                "text-font": [
                    "Noto Sans Bold"
                ],
                "text-anchor": "left",
                "text-field": "{zh}",
                "text-offset": [
                    0.5,
                    0
                ],
                "text-size": {
                    "base": 1,
                    "stops": [
                        [
                            2,
                            10
                        ],
                        [
                            4,
                            11
                        ],
                        [
                            6,
                            13
                        ],
                        [
                            8,
                            14
                        ],
                        [
                            11,
                            14
                        ]
                    ]
                }
            },
            "paint": {
                "text-color": {
                    "property": "class",
                    "stops": [
                        [
                            0,
                            "#001027"
                        ],
                        [
                            1,
                            "#0066FF"
                        ]
                    ]
                },
                "text-halo-color": "hsla(0, 0%, 100%, 0.75)",
                "text-halo-blur": 0.5,
                "text-halo-width": 2
            }
        },
        {
            "id": "station-0-l-text",
            "type": "symbol",
            "source": "railbase",
            "source-layer": "station",
            "filter": [
                "all",
                [
                    "==",
                    "ac",
                    "L"
                ],
                [
                    "in",
                    "class",
                    0,
                    1
                ]
            ],
            "layout": {
                "text-padding": 1,
                "text-font": [
                    "Noto Sans Bold"
                ],
                "text-anchor": "right",
                "text-field": "{zh}",
                "text-offset": [
                    -0.5,
                    0
                ],
                "text-size": {
                    "base": 1,
                    "stops": [
                        [
                            2,
                            10
                        ],
                        [
                            4,
                            11
                        ],
                        [
                            6,
                            13
                        ],
                        [
                            8,
                            14
                        ],
                        [
                            11,
                            14
                        ]
                    ]
                }
            },
            "paint": {
                "text-color": {
                    "property": "class",
                    "stops": [
                        [
                            0,
                            "#001027"
                        ],
                        [
                            1,
                            "#0066FF"
                        ]
                    ]
                },
                "text-halo-color": "hsla(0, 0%, 100%, 0.75)",
                "text-halo-blur": 0.5,
                "text-halo-width": 2
            }
        },
        {
            "id": "station-0-t-text",
            "type": "symbol",
            "source": "railbase",
            "source-layer": "station",
            "filter": [
                "all",
                [
                    "==",
                    "ac",
                    "T"
                ],
                [
                    "in",
                    "class",
                    0,
                    1
                ]
            ],
            "layout": {
                "text-padding": 1,
                "text-font": [
                    "Noto Sans Bold"
                ],
                "text-anchor": "bottom",
                "text-field": "{zh}",
                "text-offset": [
                    0,
                    -0.6
                ],
                "text-size": {
                    "base": 1,
                    "stops": [
                        [
                            2,
                            10
                        ],
                        [
                            4,
                            11
                        ],
                        [
                            6,
                            13
                        ],
                        [
                            8,
                            14
                        ],
                        [
                            11,
                            14
                        ]
                    ]
                }
            },
            "paint": {
                "text-color": {
                    "property": "class",
                    "stops": [
                        [
                            0,
                            "#001027"
                        ],
                        [
                            1,
                            "#0066FF"
                        ]
                    ]
                },
                "text-halo-color": "hsla(0, 0%, 100%, 0.75)",
                "text-halo-blur": 0.5,
                "text-halo-width": 2
            }
        },
        {
            "id": "station-0-b-text",
            "type": "symbol",
            "source": "railbase",
            "source-layer": "station",
            "filter": [
                "all",
                [
                    "==",
                    "ac",
                    "B"
                ],
                [
                    "in",
                    "class",
                    0,
                    1
                ]
            ],
            "layout": {
                "text-padding": 1,
                "text-font": [
                    "Noto Sans Bold"
                ],
                "text-anchor": "top",
                "text-field": "{zh}",
                "text-offset": [
                    0,
                    0.4
                ],
                "text-size": {
                    "base": 1,
                    "stops": [
                        [
                            2,
                            10
                        ],
                        [
                            4,
                            11
                        ],
                        [
                            6,
                            13
                        ],
                        [
                            8,
                            14
                        ],
                        [
                            11,
                            14
                        ]
                    ]
                }
            },
            "paint": {
                "text-color": {
                    "property": "class",
                    "stops": [
                        [
                            0,
                            "#001027"
                        ],
                        [
                            1,
                            "#0066FF"
                        ]
                    ]
                },
                "text-halo-color": "hsla(0, 0%, 100%, 0.75)",
                "text-halo-blur": 0.5,
                "text-halo-width": 2
            }
        },
        {
            "id": "station-0-lt-text",
            "type": "symbol",
            "source": "railbase",
            "source-layer": "station",
            "filter": [
                "all",
                [
                    "==",
                    "ac",
                    "LT"
                ],
                [
                    "in",
                    "class",
                    0,
                    1
                ]
            ],
            "layout": {
                "text-padding": 1,
                "text-font": [
                    "Noto Sans Bold"
                ],
                "text-anchor": "bottom-right",
                "text-field": "{zh}",
                "text-offset": [
                    -0.3,
                    -0.4
                ],
                "text-size": {
                    "base": 1,
                    "stops": [
                        [
                            2,
                            10
                        ],
                        [
                            4,
                            11
                        ],
                        [
                            6,
                            13
                        ],
                        [
                            8,
                            14
                        ],
                        [
                            11,
                            14
                        ]
                    ]
                }
            },
            "paint": {
                "text-color": {
                    "property": "class",
                    "stops": [
                        [
                            0,
                            "#001027"
                        ],
                        [
                            1,
                            "#0066FF"
                        ]
                    ]
                },
                "text-halo-color": "hsla(0, 0%, 100%, 0.75)",
                "text-halo-blur": 0.5,
                "text-halo-width": 2
            }
        },
        {
            "id": "station-0-lb-text",
            "type": "symbol",
            "source": "railbase",
            "source-layer": "station",
            "filter": [
                "all",
                [
                    "==",
                    "ac",
                    "LB"
                ],
                [
                    "in",
                    "class",
                    0,
                    1
                ]
            ],
            "layout": {
                "text-padding": 1,
                "text-font": [
                    "Noto Sans Bold"
                ],
                "text-anchor": "top-right",
                "text-field": "{zh}",
                "text-offset": [
                    -0.2,
                    0.2
                ],
                "text-size": {
                    "base": 1,
                    "stops": [
                        [
                            2,
                            10
                        ],
                        [
                            4,
                            11
                        ],
                        [
                            6,
                            13
                        ],
                        [
                            8,
                            14
                        ],
                        [
                            11,
                            14
                        ]
                    ]
                }
            },
            "paint": {
                "text-color": {
                    "property": "class",
                    "stops": [
                        [
                            0,
                            "#001027"
                        ],
                        [
                            1,
                            "#0066FF"
                        ]
                    ]
                },
                "text-halo-color": "hsla(0, 0%, 100%, 0.75)",
                "text-halo-blur": 0.5,
                "text-halo-width": 2
            }
        },
        {
            "id": "station-0-rt-text",
            "type": "symbol",
            "source": "railbase",
            "source-layer": "station",
            "filter": [
                "all",
                [
                    "==",
                    "ac",
                    "RT"
                ],
                [
                    "in",
                    "class",
                    0,
                    1
                ]
            ],
            "layout": {
                "text-padding": 1,
                "text-font": [
                    "Noto Sans Bold"
                ],
                "text-anchor": "bottom-left",
                "text-field": "{zh}",
                "text-offset": [
                    0.3,
                    -0.4
                ],
                "text-size": {
                    "base": 1,
                    "stops": [
                        [
                            2,
                            10
                        ],
                        [
                            4,
                            11
                        ],
                        [
                            6,
                            13
                        ],
                        [
                            8,
                            14
                        ],
                        [
                            11,
                            14
                        ]
                    ]
                }
            },
            "paint": {
                "text-color": {
                    "property": "class",
                    "stops": [
                        [
                            0,
                            "#001027"
                        ],
                        [
                            1,
                            "#0066FF"
                        ]
                    ]
                },
                "text-halo-color": "hsla(0, 0%, 100%, 0.75)",
                "text-halo-blur": 0.5,
                "text-halo-width": 2
            }
        },
        {
            "id": "station-0-rb-text",
            "type": "symbol",
            "source": "railbase",
            "source-layer": "station",
            "filter": [
                "all",
                [
                    "==",
                    "ac",
                    "RB"
                ],
                [
                    "in",
                    "class",
                    0,
                    1
                ]
            ],
            "layout": {
                "text-padding": 1,
                "text-font": [
                    "Noto Sans Bold"
                ],
                "text-anchor": "top-left",
                "text-field": "{zh}",
                "text-offset": [
                    0.2,
                    0.2
                ],
                "text-size": {
                    "base": 1,
                    "stops": [
                        [
                            2,
                            10
                        ],
                        [
                            4,
                            11
                        ],
                        [
                            6,
                            13
                        ],
                        [
                            8,
                            14
                        ],
                        [
                            11,
                            14
                        ]
                    ]
                }
            },
            "paint": {
                "text-color": {
                    "property": "class",
                    "stops": [
                        [
                            0,
                            "#001027"
                        ],
                        [
                            1,
                            "#0066FF"
                        ]
                    ]
                },
                "text-halo-color": "hsla(0, 0%, 100%, 0.75)",
                "text-halo-blur": 0.5,
                "text-halo-width": 2
            }
        }
    ]
},
    center: [104.1954, 35.8617],
    zoom: 4
  });

  mapInstance.on('load', () => {
    mapInstance.addControl(new maplibregl.AttributionControl({
      customAttribution: '© OpenStreetMap contributors & 贵广十标段. & Kejing Peng, © 2021'
    }), 'bottom-right');

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

    validStops.forEach(s => {
      const popupContent = document.createElement('div');
      popupContent.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 4px; color: black">${s.n}</div>
        ${s.rn && s.rn.length > 0 ? 
          `<div style="display: flex; flex-wrap: wrap; gap: 3px; margin-top: 4px;">
            ${s.rn.map(line => 
              `<span style="background: #1a7f37; color: white; padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 500;">${line}</span>`
            ).join('')}
          </div>` : 
          ''
        }
      `;

      new maplibregl.Marker({
        color: colors.markerColor,
        scale: 0.8
      })
        .setLngLat([s.lon, s.lat])
        .setPopup(new maplibregl.Popup().setDOMContent(popupContent))
        .addTo(mapInstance);
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