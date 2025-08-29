<template>
  <n-config-provider
    :theme="currentTheme"
    :theme-overrides="currentThemeOverrides"
    style="height: 100%"
  >
    <n-layout style="min-height: 100vh">
      <n-layout-header bordered style="padding: 12px 0">
        <div style="max-width: 600px; margin: 0 auto; padding: 0 24px">
          <div class="header-desktop">
            <n-space justify="space-between" align="center">
              <n-space align="center" :size="12">
                <n-h1 style="margin: 0; font-size: 20px; font-weight: 600"
                  >铁路换乘查询</n-h1
                >
                <n-text depth="3" style="font-size: 10px">
                  <a
                    href="/vanilla/"
                    target="_blank"
                    style="color: #2ea043; text-decoration: none"
                    >旧版</a
                  >
                </n-text>
              </n-space>
              <n-space align="center" :size="16">
                <n-text depth="3" style="font-size: 12px">
                  © 2025 noxylva.
                  <a
                    href="https://github.com/undef-i/CRTransfer"
                    target="_blank"
                    style="color: #2ea043; text-decoration: none"
                    >GitHub</a
                  >
                </n-text>
                <n-button
                  size="small"
                  @click="toggleTheme"
                  :title="isDark ? '切换到亮色主题' : '切换到暗色主题'"
                >
                  <template #icon>
                    <n-icon>
                      <component :is="isDark ? SunnyOutline : MoonOutline" />
                    </n-icon>
                  </template>
                </n-button>
              </n-space>
            </n-space>
          </div>

          <div class="header-mobile">
            <div
              style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
              "
            >
              <n-space align="center" :size="8">
                <n-icon size="24" color="#18a058"><TrainOutline /></n-icon>
                <n-h1 style="margin: 0; font-size: 18px; font-weight: 600"
                  >铁路换乘查询</n-h1
                >
              </n-space>
              <n-text depth="3" style="font-size: 10px">
                <a
                  href="/vanilla/"
                  target="_blank"
                  style="color: #2ea043; text-decoration: none"
                  >旧版</a
                >
              </n-text>
            </div>
            <div
              style="
                display: flex;
                justify-content: space-between;
                align-items: center;
              "
            >
              <n-text depth="3" style="font-size: 12px">
                © 2025 noxylva.
                <a
                  href="https://github.com/undef-i/CRTransfer"
                  target="_blank"
                  style="color: #2ea043; text-decoration: none"
                  >GitHub</a
                >
              </n-text>
              <n-button
                size="small"
                @click="toggleTheme"
                :title="isDark ? '切换到亮色主题' : '切换到暗色主题'"
              >
                <template #icon>
                  <n-icon>
                    <component :is="isDark ? SunnyOutline : MoonOutline" />
                  </n-icon>
                </template>
              </n-button>
            </div>
          </div>
        </div>
      </n-layout-header>

      <n-layout-content
        style="
          padding: 24px 10px;
          max-width: 600px;
          margin: 0 auto;
          width: 100%;
        "
      >
        <n-space vertical :size="24">
          <n-alert type="warning" :show-icon="true">
            站点位置信息来源网络，目前有较多错漏，仅供辅助参考。数据有效期至
            {{ version.slice(0, 4) }} 年 {{ version.slice(4, 6) }} 月
            {{ version.slice(6, 8) }} 日。
          </n-alert>
          <n-card title="" hoverable style="box-shadow: none">
            <n-space vertical :size="20">
              <n-button-group class="full-width-responsive-group">
                <n-button
                  :type="mode === 'time' ? 'primary' : 'default'"
                  :ghost="mode !== 'time'"
                  @click="mode = 'time'"
                >
                  <span class="long-text">最短在途时间</span>
                  <span class="short-text">时间</span>
                </n-button>
                <n-button
                  :type="mode === 'xfer' ? 'primary' : 'default'"
                  :ghost="mode !== 'xfer'"
                  @click="mode = 'xfer'"
                >
                  <span class="long-text">最少换乘次数</span>
                  <span class="short-text">换乘</span>
                </n-button>
                <n-button
                  :type="mode === 'km' ? 'primary' : 'default'"
                  :ghost="mode !== 'km'"
                  @click="mode = 'km'"
                >
                  <span class="long-text">最短途径里程</span>
                  <span class="short-text">里程</span>
                </n-button>
              </n-button-group>
              <div class="trip-planner-container">
                <div class="input-group">
                  <n-auto-complete
                    v-model:value="origin"
                    :options="originOptions"
                    placeholder="起点"
                    clearable
                  />
                  <n-button
                    :type="escOrigin ? 'primary' : 'default'"
                    :ghost="!escOrigin"
                    @click="escOrigin = !escOrigin"
                  >
                    同城站
                  </n-button>
                </div>

                <n-button
                  text
                  circle
                  class="swap-button"
                  @click="swapOriginDestination"
                >
                  <template #icon
                    ><n-icon :component="SwapHorizontalOutline"
                  /></template>
                </n-button>

                <div class="input-group">
                  <n-auto-complete
                    v-model:value="destination"
                    :options="destinationOptions"
                    placeholder="终点"
                    clearable
                  />
                  <n-button
                    :type="escDestination ? 'primary' : 'default'"
                    :ghost="!escDestination"
                    @click="escDestination = !escDestination"
                  >
                    同城站
                  </n-button>
                </div>
              </div>

              <n-divider style="margin: 0" />

              <div class="search-actions-container">
                <n-collapse-transition :show="mode !== 'km'">
                  <n-input-group>
                    <n-input-group-label>最短换乘时间</n-input-group-label>
                    <n-input-number
                      v-model:value="mtt"
                      :min="0"
                      :show-button="false"
                      placeholder="任意"
                      style="text-align: center; min-width: 80px"
                    />
                    <n-input-group-label>分钟</n-input-group-label>
                  </n-input-group>
                </n-collapse-transition>

                <n-space
                  justify="end"
                  align="center"
                  class="search-button-wrapper"
                >
                  <n-button
                    :type="running ? 'error' : 'primary'"
                    :ghost="running"
                    :loading="!ready"
                    :disabled="(!origin || !destination) && !ready"
                    @click="handlePrimaryButtonClick"
                  >
                    <template #icon
                      ><n-icon :component="primaryButtonIcon"
                    /></template>
                    {{ running ? "停止" : "搜索" }}
                  </n-button>
                </n-space>
              </div>
            </n-space>
          </n-card>

          <n-alert v-if="statusMessage" :type="statusType" :show-icon="true">{{
            statusMessage
          }}</n-alert>
          <n-progress
            v-if="progressVisible"
            type="line"
            :percentage="progressPercent"
            :show-indicator="false"
            processing
          />
          <n-space v-if="journeys.length > 0" vertical :size="16">
            <n-card
              v-for="(journey, index) in displayedJourneys"
              :key="journey.id"
              hoverable
              style="box-shadow: none"
              :title="`方案 ${index + 1}`"
            >
              <n-space :size="12" style="margin-bottom: 20px"
                ><n-tag
                  :type="journey.searchMode === 'km' ? 'info' : 'success'"
                  round
                  ><template #icon
                    ><n-icon
                      :component="
                        journey.searchMode === 'km' ? Location : TimeOutline
                      " /></template
                  >{{
                    journey.searchMode === "km"
                      ? `${journey.tkm} 公里`
                      : formatDuration(journey.tdur)
                  }}</n-tag
                ><n-tag type="warning" round
                  ><template #icon
                    ><n-icon :component="SwapHorizontalOutline" /></template
                  >{{ calculateTransfers(journey) }} 次换乘</n-tag
                >
              </n-space>
              <n-timeline>
                <n-timeline-item
                  v-for="(segment, segIndex) in journey.segments"
                  :key="segIndex"
                  :type="segment.type"
                  :color="segment.color"
                >
                  <div v-if="segment.train === '换乘'">
                    <n-space align="center">
                      <n-text strong style="font-size: 16px">换乘</n-text>
                      <n-text depth="3">等待:</n-text>
                      <n-text type="warning">{{
                        formatDuration(segment.transferTime)
                      }}</n-text>
                    </n-space>
                  </div>

                  <div v-else class="segment-content">
                    <div class="segment-part segment-route">
                      <n-text strong style="font-size: 15px">
                        <span>{{ segment.train }}</span>
                        <n-tag
                          v-if="segment.isNonDaily"
                          type="error"
                          size="small"
                          round
                          style="margin-left: 8px"
                          >非每日</n-tag
                        >
                      </n-text>
                      <n-text style="font-size: 15px; margin-left: 8px"
                        >{{ segment.from }} → {{ segment.to }}</n-text
                      >
                    </div>

                    <div class="segment-part segment-details">
                      <n-text
                        depth="3"
                        style="font-size: 13px; white-space: nowrap"
                        >{{ segment.details }}</n-text
                      >
                    </div>
                  </div>
                </n-timeline-item>
              </n-timeline>

              <n-collapse style="margin-top: 20px">
                <n-collapse-item>
                  <template #header>
                    <div
                      @click="handleExpandJourney(journey)"
                      style="width: 100%; user-select: none"
                    >
                      <n-space align="center" :size="8">
                        <n-icon><map-outline /></n-icon>
                        <n-text>途经站点与线路图</n-text>
                      </n-space>
                    </div>
                  </template>
                  <div
                    v-if="journey.stationsLoading"
                    style="text-align: center; padding: 20px"
                  >
                    <n-spin size="small" /><n-text
                      depth="3"
                      style="margin-left: 8px"
                      >正在加载站点数据...</n-text
                    >
                  </div>
                  <div v-else-if="journey.stationsError" style="padding: 10px">
                    <n-alert type="error" :show-icon="true">{{
                      journey.stationsError
                    }}</n-alert>
                  </div>
                  <div
                    v-else-if="journey.allStops && journey.allStops.length > 0"
                  >
                    <div style="margin-bottom: 12px">
                      <n-text
                        depth="3"
                        style="display: block; line-height: 1.6"
                      >
                        <span
                          v-for="(stop, index) in journey.allStops"
                          :key="stop.n"
                          style="
                            display: inline-flex;
                            align-items: center;
                            flex-wrap: wrap;
                          "
                        >
                          {{ stop.n }}
                          <n-tag
                            v-for="line in stop.rn"
                            :key="line"
                            size="tiny"
                            type="success"
                            :bordered="false"
                            style="
                              margin-left: 4px;
                              margin-right: 4px;
                              font-size: 10px;
                              padding: 1px 6px;
                            "
                          >
                            {{ line }}
                          </n-tag>
                          <span
                            v-if="index < journey.allStops.length - 1"
                            style="margin: 0 4px"
                            >→</span
                          >
                        </span>
                      </n-text>
                    </div>
                    <MapRenderer :stops="journey.allStops" />
                  </div>
                  <n-empty
                    v-else
                    description="未能获取到该线路的途经站点信息。"
                    style="padding: 20px"
                  />
                </n-collapse-item>
              </n-collapse>
            </n-card>
            <div
              v-if="
                displayCount < journeys.length ||
                (running && journeys.length >= displayCount)
              "
              ref="scrollObserver"
              style="height: 20px"
            ></div>
          </n-space>
        </n-space>
      </n-layout-content>
    </n-layout>
  </n-config-provider>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, provide } from "vue";
import {
  darkTheme,
  NConfigProvider,
  NLayout,
  NLayoutHeader,
  NLayoutContent,
  NSpace,
  NIcon,
  NH1,
  NText,
  NCard,
  NGrid,
  NGi,
  NAutoComplete,
  NSwitch,
  NButtonGroup,
  NButton,
  NCollapseTransition,
  NFormItem,
  NInputNumber,
  NDivider,
  NAlert,
  NProgress,
  NTag,
  NTimeline,
  NTimelineItem,
  NCollapse,
  NCollapseItem,
  NSpin,
  NEmpty,
  NInputGroup,
  NInputGroupLabel,
} from "naive-ui";
import {
  TrainOutline,
  Location,
  TimeOutline,
  SwapHorizontalOutline,
  SearchOutline,
  StopCircleOutline,
  MapOutline,
  LogoGithub,
} from "@vicons/ionicons5";
import { SunnyOutline, MoonOutline } from "@vicons/ionicons5";
import MapRenderer from "./MapRenderer.vue";
import { pinyin } from "pinyin-pro";

const processedStations = ref([]);

function getCommonPrefixLength(str1, str2) {
  let i = 0;
  while (i < str1.length && i < str2.length && str1[i] === str2[i]) {
    i++;
  }
  return i;
}

function damerauLevenshteinDistance(a, b) {
  const d = [];
  const lenA = a.length;
  const lenB = b.length;

  for (let i = 0; i <= lenA; i++) {
    d[i] = [];
    d[i][0] = i;
  }
  for (let j = 0; j <= lenB; j++) {
    d[0][j] = j;
  }

  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[lenA][lenB];
}

function calculateMatchScore(query, stationEntry) {
  let score = 0;
  let queryIndex = 0;
  let continuousBonus = 0;

  for (let i = 0; i < stationEntry.pinyin_array.length; i++) {
    const fullPinyin = stationEntry.pinyin_array[i];
    const initial = stationEntry.initials_array[i];

    if (queryIndex >= query.length) {
      score += 5;
      break;
    }

    const remainingQuery = query.substring(queryIndex);

    if (remainingQuery.startsWith(fullPinyin)) {
      queryIndex += fullPinyin.length;
      score += 10;
      score += continuousBonus * 5;
      continuousBonus++;
    } else if (remainingQuery.startsWith(initial)) {
      queryIndex += initial.length;
      score += 2;
      continuousBonus = 0;
    } else {
      return 0;
    }
  }

  if (queryIndex < query.length) {
    return 0;
  }

  return score;
}

const preprocessStations = () => {
  if (stationNames.value.length === 0) return;
  const result = stationNames.value.flatMap((name) => {
    try {
      const originalPinyinArray = pinyin(name, {
        toneType: "none",
        type: "array",
      });
      const originalInitialsArray = pinyin(name, {
        pattern: "first",
        toneType: "none",
        type: "array",
      });
      const originalEntry = {
        name: name,
        isAlias: false,
        pinyin: originalPinyinArray.join(""),
        initials: originalInitialsArray.join(""),
        pinyin_array: originalPinyinArray,
        initials_array: originalInitialsArray,
      };

      const aliasName = name + "站";
      const aliasPinyinArray = pinyin(aliasName, {
        toneType: "none",
        type: "array",
      });
      const aliasInitialsArray = pinyin(aliasName, {
        pattern: "first",
        toneType: "none",
        type: "array",
      });
      const aliasEntry = {
        name: name,
        isAlias: true,
        pinyin: aliasPinyinArray.join(""),
        initials: aliasInitialsArray.join(""),
        pinyin_array: aliasPinyinArray,
        initials_array: aliasInitialsArray,
      };

      return [originalEntry, aliasEntry];
    } catch (e) {
      console.error(`Error processing station "${name}":`, e);
      return [];
    }
  });

  processedStations.value = result;
  console.log(
    `Preprocessing complete. Generated ${result.length} searchable entries.`
  );
};

const swapOriginDestination = () => {
  [origin.value, destination.value] = [destination.value, origin.value];
  [escOrigin.value, escDestination.value] = [
    escDestination.value,
    escOrigin.value,
  ];
};

const isDark = ref(true);

const currentTheme = computed(() => (isDark.value ? darkTheme : null));
const currentThemeOverrides = computed(() => (isDark.value ? null : null));

const toggleTheme = () => {
  isDark.value = !isDark.value;
  localStorage.setItem("theme", isDark.value ? "dark" : "light");

  window.dispatchEvent(
    new CustomEvent("theme-changed", {
      detail: { isDark: isDark.value },
    })
  );

  localStorage.setItem("theme-updated", Date.now().toString());
};

const isChinaUser = ref(false);

async function checkChinaUser() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    try {
      const response = await fetch("https://ipapi.co/json/", {
        method: "GET",
        mode: "cors",
        credentials: "omit",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const country = data.country || data.country_code || "";
        const isChina =
          country.toLowerCase() === "cn" || country.toLowerCase() === "china";
        return isChina;
      }
    } catch (e) {
      clearTimeout(timeoutId);
    }

    return false;
  } catch (error) {
    return false;
  }
}

onMounted(async () => {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme) {
    isDark.value = savedTheme === "dark";
  } else {
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    isDark.value = prefersDark;
  }

  try {
    isChinaUser.value = await checkChinaUser();
  } catch (error) {
    isChinaUser.value = false;
  }
});

provide("isChinaUser", isChinaUser);
const origin = ref("");
const destination = ref("");
const escOrigin = ref(false);
const escDestination = ref(false);
const mode = ref("time");
const mtt = ref(0);
const progressVisible = ref(false);
const progressValue = ref(0);
const progressMax = ref(0);
const running = ref(false);
const ready = ref(false);
const statusMessage = ref("正在初始化...");
const version = ref("");
const journeys = ref([]);
const displayCount = ref(0);
const scrollObserver = ref(null);
let w = null;
const stationNames = ref([]);
let nonDailyTrains = [];
const BATCH_SIZE = 20;
const gtsPromiseMap = new Map();
const rawJourneyBuffer = new Map();
let journeyResultBuffer = [];
let bufferUpdateInterval = null;

const primaryButtonIcon = computed(() =>
  running.value ? StopCircleOutline : SearchOutline
);
const progressPercent = computed(() =>
  progressMax.value > 0
    ? Math.round((progressValue.value / progressMax.value) * 100)
    : 0
);
const statusType = computed(() => {
  const msg = statusMessage.value;
  if (msg.includes("错误")) return "error";
  if (msg.includes("共") || msg.includes("查询到")) return "success";
  if (running.value || msg.includes("加载")) return "info";
  if (msg.includes("就绪") || msg.includes("查询条件更改")) return "success";
  return "default";
});

const getStationOptions = (inputValue) => {
  const input = inputValue.trim();
  if (!input) return [];

  const scoredResults = new Map();
  const containsChinese = /[\u4e00-\u9fa5]/.test(input);
  const lowerCaseInput = input.toLowerCase();

  for (const stationEntry of processedStations.value) {
    let maxScore = 0;

    if (containsChinese) {
      if (stationEntry.name.includes(input)) {
        if (stationEntry.name.startsWith(input)) {
          maxScore = 200 + (stationEntry.name === input ? 50 : 0);
        } else {
          maxScore = 50;
        }
      }
    } else {
      if (stationEntry.initials === lowerCaseInput) {
        maxScore = 250;
      } else if (stationEntry.pinyin === lowerCaseInput) {
        maxScore = 200;
      }

      if (maxScore === 0) {
        const intentScore = calculateMatchScore(lowerCaseInput, stationEntry);
        if (intentScore > 0) {
          maxScore = 100 + intentScore;
        }
      }

      if (maxScore < 100) {
        const fullPinyinDistance = damerauLevenshteinDistance(
          lowerCaseInput,
          stationEntry.pinyin
        );
        if (fullPinyinDistance <= 3) {
          const prefixLength = getCommonPrefixLength(
            lowerCaseInput,
            stationEntry.pinyin
          );
          let score = prefixLength * 8 - fullPinyinDistance * 10;
          if (score > maxScore) maxScore = score;
        }
      }

      if (maxScore < 50) {
        const initialsDistance = damerauLevenshteinDistance(
          lowerCaseInput,
          stationEntry.initials
        );
        if (initialsDistance <= 2) {
          const prefixLength = getCommonPrefixLength(
            lowerCaseInput,
            stationEntry.initials
          );
          let score = prefixLength * 5 - initialsDistance * 5;
          if (score > maxScore) maxScore = score;
        }
      }
    }

    if (maxScore > 0) {
      if (stationEntry.isAlias) {
        maxScore -= 1;
      }

      if (
        !scoredResults.has(stationEntry.name) ||
        maxScore > scoredResults.get(stationEntry.name).score
      ) {
        scoredResults.set(stationEntry.name, {
          name: stationEntry.name,
          score: maxScore,
        });
      }
    }
  }

  const finalResults = Array.from(scoredResults.values());
  finalResults.sort((a, b) => b.score - a.score);

  return finalResults
    .slice(0, 10)
    .map((item) => ({ label: item.name, value: item.name }));
};

const originOptions = computed(() => getStationOptions(origin.value));
const destinationOptions = computed(() => getStationOptions(destination.value));
const displayedJourneys = computed(() =>
  journeys.value.slice(0, displayCount.value)
);

const formatDuration = (m) => {
  if (m === null) return "N/A";
  const d = Math.floor(m / 1440),
    rem = m % 1440,
    h = Math.floor(rem / 60),
    mins = rem % 60;
  let p = [];
  if (d > 0) p.push(`${d} 天`);
  if (h > 0) p.push(`${h} 小时`);
  if (mins > 0) p.push(`${mins} 分钟`);
  return p.length > 0 ? p.join(" ") : "0 分钟";
};
const formatArrivalTime = (am) => {
  if (am === null) return "N/A";
  const day = Math.floor(am / 1440),
    rem = am % 1440,
    h = Math.floor(rem / 60),
    m = rem % 60;
  return `第 ${day + 1} 天 ${h.toString().padStart(2, "0")}:${m
    .toString()
    .padStart(2, "0")}`;
};

const formatTrainNumber = (trainNumber) => {
  if (!trainNumber) return trainNumber;

  if (trainNumber.includes("/")) {
    const parts = trainNumber.split("/");
    const formattedParts = parts.map((part) => {
      return part.replace(/[A-Za-z]$/, "");
    });

    if (formattedParts[0] === formattedParts[1]) {
      return formattedParts[0];
    } else {
      return formattedParts.join("/");
    }
  } else {
    return trainNumber.replace(/[A-Za-z]$/, "");
  }
};
const calculateTransfers = (journey) => {
  const raw = rawJourneyBuffer.get(journey.id);
  if (!raw || !raw.p || raw.p.length <= 1) return 0;
  return raw.p
    .slice(1)
    .reduce((acc, leg, i) => acc + (leg.r.tn !== raw.p[i].r.tn ? 1 : 0), 0);
};
const processJourney = (journey) => {
  const raw = rawJourneyBuffer.get(journey.id);
  if (!raw || !raw.p) return [];
  const segments = [];
  let currentTime = raw.idt;
  for (let i = 0; i < raw.p.length; i++) {
    const leg = raw.p[i];
    if (leg.wtb > 0 && i > 0 && leg.r.tn !== raw.p[i - 1].r.tn) {
      segments.push({
        type: "warning",
        train: "换乘",
        from: "",
        to: "",
        transferTime: leg.wtb,
        color: "#d29922",
      });
    }
    currentTime += leg.wtb;
    const departureTime = formatArrivalTime(currentTime);

    const finalArrivalTime = currentTime + leg.r.dur;
    const finalStation = leg.r.al;
    const totalKm = leg.r.km;

    segments.push({
      type: "success",
      train: formatTrainNumber(leg.r.tn),
      from: leg.r.bs,
      to: finalStation,
      details:
        journey.searchMode === "km"
          ? `${totalKm}公里`
          : `${departureTime} → ${formatArrivalTime(finalArrivalTime)}`,
      color: "#2ea043",
      isNonDaily: nonDailyTrains.includes(leg.r.tn),
    });
    currentTime = finalArrivalTime;
  }
  return segments;
};
const getTrainStops = (trainNumber, departureTime, arrivalTime) => {
  const requestId = Date.now() + Math.random();
  const promise = new Promise((resolve, reject) => {
    gtsPromiseMap.set(requestId, { resolve, reject });
    setTimeout(() => {
      if (gtsPromiseMap.has(requestId)) {
        gtsPromiseMap.delete(requestId);
        reject(new Error("请求超时"));
      }
    }, 10000);
  });
  w.postMessage({
    t: "gts",
    requestId,
    d: { n: trainNumber, dtr: departureTime, atr: arrivalTime },
  });
  return promise;
};
const handleExpandJourney = async (journey) => {
  if (journey.allStops || journey.stationsLoading) return;
  const rawJourney = rawJourneyBuffer.get(journey.id);
  if (!rawJourney || !rawJourney.p) {
    journey.stationsError = "内部数据错误";
    return;
  }
  journey.stationsLoading = true;
  journey.stationsError = null;
  try {
    const allStopsArrays = [];
    let currentTime = rawJourney.idt;
    for (let i = 0; i < rawJourney.p.length; i++) {
      const leg = rawJourney.p[i];
      currentTime += leg.wtb;
      const departureTime = leg.r.dtr;
      const arrivalTime = leg.r.dtr + leg.r.dur;
      const stops = await getTrainStops(leg.r.tn, departureTime, arrivalTime);
      allStopsArrays.push(stops);
      currentTime = arrivalTime;
    }

    if (allStopsArrays.length > 0) {
      const finalRouteStops = allStopsArrays.reduce(
        (accumulator, currentStops, index) => {
          if (index === 0) {
            return currentStops;
          } else {
            return accumulator.concat(currentStops.slice(1));
          }
        },
        []
      );
      journey.allStops = finalRouteStops;
    } else {
      journey.allStops = [];
    }
  } catch (e) {
    console.error(e);
    journey.stationsError = e.message;
  } finally {
    journey.stationsLoading = false;
  }
};

const initWorker = () => {
  if (w) return;
  w = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
  w.onmessage = (e) => {
    const { t, d, requestId } = e.data;
    switch (t) {
      case "pgr_start":
        progressVisible.value = true;
        break;
      case "pgr_upd":
        progressValue.value = d.ld;
        progressMax.value = d.tt;
        break;
      case "j_fnd": {
        if (!running.value) return;
        const dataFromWorker = d;
        const journeyId = Math.random().toString(36).substring(2, 9);
        rawJourneyBuffer.set(journeyId, dataFromWorker);
        const journeyForUI = {
          id: journeyId,
          tkm: dataFromWorker.tkm,
          tdur: dataFromWorker.tdur,
          stationsLoading: false,
          stationsError: null,
          allStops: null,
          searchMode: mode.value,
        };
        journeyForUI.segments = processJourney(journeyForUI);
        journeyResultBuffer.push(journeyForUI);
        break;
      }
      case "done":
        finishSearch();
        if (journeys.value.length === 0) statusMessage.value = "无方案";
        else statusMessage.value = `共 ${journeys.value.length} 条方案`;
        break;
      case "err":
        statusMessage.value = `错误: ${d}`;
        finishSearch();
        break;
      case "init_done":
        progressVisible.value = false;
        ready.value = true;
        statusMessage.value = "就绪";
        w.postMessage({ t: "get_stn" });
        break;
      case "stn":
        stationNames.value = d;
        break;
      case "ts":
        if (gtsPromiseMap.has(requestId)) {
          gtsPromiseMap.get(requestId).resolve(d);
          gtsPromiseMap.delete(requestId);
        }
        break;
      case "gts_err":
        if (gtsPromiseMap.has(requestId)) {
          gtsPromiseMap.get(requestId).reject(new Error(d));
          gtsPromiseMap.delete(requestId);
        }
        break;
    }
  };
  w.onerror = (err) => {
    statusMessage.value = `Worker 错误: ${err.message}`;
    finishSearch();
  };
  w.postMessage({ t: "init_only" });
};
const startSearch = () => {
  if (running.value || !ready.value) return;
  running.value = true;
  statusMessage.value = "正在搜索，请稍候...";
  journeys.value = [];
  rawJourneyBuffer.clear();
  journeyResultBuffer = [];
  displayCount.value = BATCH_SIZE;
  if (bufferUpdateInterval) clearInterval(bufferUpdateInterval);
  bufferUpdateInterval = setInterval(() => {
    if (journeyResultBuffer.length > 0) {
      journeys.value.push(...journeyResultBuffer);
      journeyResultBuffer = [];
      if (running.value) {
        statusMessage.value = `查询到 ${journeys.value.length} 条方案...`;
      }
    }
  }, 250);
  w.postMessage({
    o: origin.value.trim(),
    d: destination.value.trim(),
    esc_o: escOrigin.value,
    esc_d: escDestination.value,
    t:
      mode.value === "km"
        ? "start_k"
        : mode.value === "xfer"
        ? "start_mx"
        : "start",
    mtt: parseInt(mtt.value) || 0,
  });
};
const finishSearch = () => {
  if (!running.value) return;
  running.value = false;
  if (bufferUpdateInterval) clearInterval(bufferUpdateInterval);
  bufferUpdateInterval = null;
  if (journeyResultBuffer.length > 0) {
    journeys.value.push(...journeyResultBuffer);
    journeyResultBuffer = [];
  }
  if (journeys.value.length > 0) {
    statusMessage.value = `搜索完成，共找到 ${journeys.value.length} 条方案`;
  } else if (statusMessage.value.includes("搜索")) {
    statusMessage.value = "搜索已停止";
  }
};
const stopSearch = () => {
  if (running.value && w) {
    w.postMessage({ t: "stop" });
  }
};
const handlePrimaryButtonClick = () => {
  if (running.value) {
    stopSearch();
  } else {
    startSearch();
  }
};
const loadMore = () => {
  if (displayCount.value >= journeys.value.length) return;
  displayCount.value = Math.min(
    displayCount.value + BATCH_SIZE,
    journeys.value.length
  );
};
let observer = null;
onMounted(async () => {
  try {
    const [ndtRes, verRes] = await Promise.all([
      fetch("ndt.json"),
      fetch("version"),
    ]);
    nonDailyTrains = await ndtRes.json();
    const v = (await verRes.text()).trim();
    if (v.length === 8) version.value = v;
  } catch (e) {
    console.error(e);
  }
  initWorker();
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          loadMore();
          break;
        }
      }
    },
    { threshold: 0.5 }
  );
});
watch(scrollObserver, (newEl, oldEl) => {
  if (observer) {
    if (oldEl) {
      observer.unobserve(oldEl);
    }
    if (newEl) {
      observer.observe(newEl);
    }
  }
});
onBeforeUnmount(() => {
  if (w) w.terminate();
  if (observer) observer.disconnect();
  if (bufferUpdateInterval) clearInterval(bufferUpdateInterval);
  gtsPromiseMap.forEach(({ reject }) => reject(new Error("组件已卸载")));
  gtsPromiseMap.clear();
});
watch([mode, mtt, escOrigin, escDestination], () => {
  if (!running.value && journeys.value.length > 0) {
    journeys.value = [];
    rawJourneyBuffer.clear();
    displayCount.value = 0;
    statusMessage.value = "查询条件更改，重新搜索";
  }
});

watch(
  stationNames,
  (newNames) => {
    if (newNames && newNames.length > 0) {
      preprocessStations();
    }
  },
  { immediate: true }
);
</script>

<style>
</style>