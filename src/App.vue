<template>
  <div>
    <h1>换乘查询 <span id="udt" style="font-size: 14px;">{{ version }}</span></h1>
    <p>鉴于铁路运行图调整及不可抗力因素，对信息之准确性不作任何保证。途径站点位置信息有部分错漏，仅供辅助参考。<span style="color: red;">红色</span>的车次为非每日开行车次，请自行判断方案可行性。</p>
    <div>
      起点：<input type="text" id="o" :value="origin" @input="handleInput" @focus="showSuggestions" @click.stop autocomplete="off"><label><input type="checkbox" id="esc_o" v-model="escOrigin" checked>同城站</label><br>
      终点：<input type="text" id="d" :value="destination" @input="handleInput" @focus="showSuggestions" @click.stop autocomplete="off"><label><input type="checkbox" id="esc_d" v-model="escDestination" checked>同城站</label>
      <br>
      <div id="suggestions" v-html="suggestions" @click.stop></div>
      <label><input type="radio" name="mode" value="time" v-model="mode" @change="handleModeChange" checked> 最短时间</label>
      <label><input type="radio" name="mode" value="xfer" v-model="mode" @change="handleModeChange"> 最少换乘</label>
      <label><input type="radio" name="mode" value="km" v-model="mode" @change="handleModeChange"> 最短里程</label>
      <br>
      <span id="mtt_container" :style="{ display: mode === 'km' ? 'none' : 'inline' }">
        <label>换乘时间：</label>
        <input type="number" id="mtt" v-model="mtt"> 分钟
        <br>
      </span>
      <label><input type="checkbox" id="show_stations" v-model="showStations"> 显示途径站点</label>
      <br>
      <div id="pbar_container" :style="{ visibility: progressVisible ? 'visible' : 'hidden' }">
        <progress id="pbar" :value="progressValue" :max="progressMax" style="width: 100%; vertical-align: middle;"></progress>
      </div>
      <button id="ab" @click="toggleSearch" :disabled="(!ready && !running)">{{ running ? '停止' : '搜索' }}</button>
    </div>
    <div id="st"><p><strong>{{ statusMessage }}</strong></p></div>
    <div id="rs" ref="resultsContainer"></div>

    <hr>
    <p>
      © 2025 noxylva. Licensed under <a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank">AGPLv3</a> |
      <a href="https://github.com/undef-i/CRTransfer" target="_blank">GitHub</a>
    </p>
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

let w = null;
let journeyBuffer = [];
let journeyCount = 0;
let displayedJourneys = 0;
const BATCH_SIZE = 50;
let maxDisplay = BATCH_SIZE;
let isRendering = false;

let run = false;
let rdy = false;
let stationNames = [];
let nonDailyTrains = [];
let currentInputTarget = null;
const gtsPromiseMap = new Map();

export default {
  name: 'App',
  setup() {
    const origin = ref('');
    const destination = ref('');
    const escOrigin = ref(true);
    const escDestination = ref(true);
    const mode = ref('time');
    const mtt = ref(0);
    const showStations = ref(false);
    const progressVisible = ref(false);
    const progressValue = ref(0);
    const progressMax = ref(0);
    const running = ref(false);
    const ready = ref(false);
    const statusMessage = ref('启动');
    const suggestions = ref('&nbsp;');
    const version = ref('');
    const resultsContainer = ref(null);

    const formatDuration = (m) => {
      if (m === null) return "N/A";
      const d = Math.floor(m / 1440), rem = m % 1440, h = Math.floor(rem / 60), mins = rem % 60;
      let p = [];
      if (d > 0) p.push(`${d}天`);
      if (h > 0) p.push(`${h}小时`);
      if (mins > 0) p.push(`${mins}分钟`);
      return p.length > 0 ? p.join(" ") : "0分钟";
    };

    const formatArrivalTime = (am) => {
      if (am === null) return "N/A";
      const day = Math.floor(am / 1440), rem = am % 1440, h = Math.floor(rem / 60), m = rem % 60;
      return `第${day + 1}天 ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };
    
    const showSuggestions = (event) => {
      currentInputTarget = event.target;
      const query = event.target.value.toLowerCase();
      if (!query || !stationNames) {
        hideSuggestions();
        return;
      }
      const matched = stationNames.filter(s => s.toLowerCase().includes(query)).slice(0, 8);
      if (matched.length === 0) {
        hideSuggestions();
        return;
      }
      suggestions.value = matched.map(s => `<a href="#" onmousedown="selectSuggestion('${s.replace(/'/g, "\\'")}')">${s}</a>`).join(' | ');
    };
    
    const hideSuggestions = () => {
      suggestions.value = '&nbsp;';
    };

    window.selectSuggestion = (s) => {
      if (currentInputTarget) {
        if (currentInputTarget.id === 'o') origin.value = s;
        if (currentInputTarget.id === 'd') destination.value = s;
      }
      hideSuggestions();
    };
    
    const handleInput = (event) => {
        if (event.target.id === 'o') origin.value = event.target.value;
        if (event.target.id === 'd') destination.value = event.target.value;
        showSuggestions(event);
    };


    const getTrainStops = (trainNumber, fromStation, toStation) => {
      if (w) {
        const requestId = Date.now() + Math.random();
        const promise = new Promise((resolve, reject) => {
          gtsPromiseMap.set(requestId, { resolve, reject });
          setTimeout(() => {
            if (gtsPromiseMap.has(requestId)) {
              gtsPromiseMap.delete(requestId);
              reject(new Error('Request for train stops timed out'));
            }
          }, 10000);
        });
        w.postMessage({ t: 'gts', requestId, d: { n: trainNumber, f: fromStation, t: toStation } });
        return promise;
      }
      return Promise.reject(new Error('Worker not initialized'));
    };
    
    const displayJourney = async (journey, index) => {
      const isKmMode = mode.value === 'km';
      const transfers = journey.p.length > 1 ? journey.p.slice(1).reduce((acc, leg, i) => acc + (leg.r.tn !== journey.p[i].r.tn ? 1 : 0), 0) : 0;
      
      let pathHtml = '';
      let allStopsForMap = [];
      let allStationNames = new Set();
      let currentTime = journey.idt;

      for (let i = 0; i < journey.p.length; i++) {
        const leg = journey.p[i];
        if (leg.wtb > 0 && i > 0 && leg.r.tn !== journey.p[i-1].r.tn) {
          pathHtml += `<li><strong>${leg.r.bs} 换乘</strong> (${formatDuration(leg.wtb)})</li>`;
        }
        currentTime += leg.wtb;
        const departureTime = formatArrivalTime(currentTime).slice(-5);
        
        let k = i;
        let finalArrivalTime = currentTime + leg.r.dur;
        let finalStation = leg.r.al;
        let totalKm = leg.r.km;
        while(k + 1 < journey.p.length && journey.p[k+1].r.tn === leg.r.tn) {
            k++;
            const nextLeg = journey.p[k];
            finalArrivalTime += nextLeg.wtb + nextLeg.r.dur;
            finalStation = nextLeg.r.al;
            totalKm += nextLeg.r.km;
        }

        const details = isKmMode 
          ? `${leg.r.bs} → ${finalStation} <span style="font-size: smaller; color: #888;">(${totalKm}公里)</span>`
          : `${leg.r.bs} ${departureTime} → ${finalStation} ${formatArrivalTime(finalArrivalTime).slice(-5)} <span style="font-size: smaller; color: #888;">(${totalKm}公里)</span>`;

        const tstyle = nonDailyTrains.includes(leg.r.tn) ? ' style="color: red;"' : '';
        pathHtml += `<li><strong${tstyle}>${leg.r.tn}:</strong> ${details}</li>`;
        
        if (showStations.value) {
            try {
                const stops = await getTrainStops(leg.r.tn, leg.r.bs, finalStation);
                stops.forEach(s => allStationNames.add(s.n));
                allStopsForMap.push(...stops);
            } catch (e) {
                console.error(`Could not fetch stops for ${leg.r.tn}:`, e);
            }
        }
        currentTime = finalArrivalTime;
        i = k;
      }
      
      let summaryHtml = isKmMode
        ? `<p><strong>总里程：</strong> ${journey.tkm}公里 | <strong>换乘：</strong> ${transfers}次</p>`
        : `<p><strong>用时：</strong> ${formatDuration(journey.tdur)} | <strong>换乘：</strong> ${transfers}次</p>
           <p>${journey.p[0].r.bs} ${formatArrivalTime(journey.idt)} → ${journey.p[journey.p.length - 1].r.al} ${formatArrivalTime(journey.aat)}</p>`;

      const journeyDiv = document.createElement('div');
      journeyDiv.innerHTML = `<hr><h3>方案 ${index}</h3>${summaryHtml}`;
      
      if (showStations.value) {
          journeyDiv.innerHTML += `<p><strong>途径站点：</strong> ${[...allStationNames].join(' → ')}</p>`;
      }
      journeyDiv.innerHTML += `<h4>路径：</h4><ul>${pathHtml}</ul>`;

      if (showStations.value) {
        const mapContainer = document.createElement('div');
        mapContainer.id = `map-${index}`;
        mapContainer.className = 'map-container';
        journeyDiv.appendChild(mapContainer);
      }
      
      resultsContainer.value.appendChild(journeyDiv);
      
      if (showStations.value && allStopsForMap.length > 0) {
        renderMap(index, allStopsForMap);
      }
    };
    
    const renderBufferedJourneys = async () => {
        if(isRendering) return;
        isRendering = true;
        try {
            while (displayedJourneys < journeyBuffer.length && displayedJourneys < maxDisplay) {
                await displayJourney(journeyBuffer[displayedJourneys], displayedJourneys + 1);
                displayedJourneys++;
            }
        } finally {
            isRendering = false;
        }
    };

    const toggleSearch = () => {
      if (run) stopSearch();
      else startSearch();
    };

    const startSearch = () => {
      if (run || !rdy) return;
      if (!origin.value.trim() || !destination.value.trim()) {
        statusMessage.value = '输入起点和终点';
        return;
      }
      
      run = true;
      running.value = true;
      statusMessage.value = '搜索...';
      resultsContainer.value.innerHTML = '';
      journeyBuffer = [];
      journeyCount = 0;
      displayedJourneys = 0;
      maxDisplay = BATCH_SIZE;

      const msg = {
        o: origin.value.trim(),
        d: destination.value.trim(),
        esc_o: escOrigin.value,
        esc_d: escDestination.value,
        t: mode.value === 'km' ? 'start_k' : (mode.value === 'xfer' ? 'start_mx' : 'start'),
        mtt: parseInt(mtt.value) || 0,
      };
      w.postMessage(msg);
    };

    const stopSearch = () => {
      if (run && w) {
        w.postMessage({ t: 'stop' });
      }
      finishSearch();
    };
    
    const finishSearch = () => {
        run = false;
        running.value = false;
    };

    const initWorker = () => {
      if (w) return;
      statusMessage.value = '加载';
      w = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
      w.onmessage = (e) => {
        const { t, d, requestId } = e.data;
        switch (t) {
          case 'pgr_start':
            progressVisible.value = true;
            break;
          case 'pgr_upd':
            progressValue.value = d.ld;
            progressMax.value = d.tt;
            break;
          case 'j_fnd':
            journeyCount++;
            journeyBuffer.push(d);
            statusMessage.value = `查询到 ${journeyCount} 条方案`;
            renderBufferedJourneys();
            break;
          case 'done':
            finishSearch();
            if (journeyCount === 0) statusMessage.value = '无方案';
            else statusMessage.value = `共 ${journeyCount} 条方案`;
            break;
          case 'err':
            statusMessage.value = `错误: ${d}`;
            finishSearch();
            break;
          case 'init_done':
            progressVisible.value = false;
            rdy = true;
            ready.value = true;
            statusMessage.value = '就绪';
            w.postMessage({ t: 'get_stn' });
            break;
          case 'stn':
            stationNames = d;
            break;
          case 'ts': 
            if (requestId && gtsPromiseMap.has(requestId)) {
                gtsPromiseMap.get(requestId).resolve(d);
                gtsPromiseMap.delete(requestId);
            }
            break;
        }
      };
      w.onerror = (err) => {
        statusMessage.value = `Worker 错误: ${err.message}`;
        finishSearch();
      };
      w.postMessage({ t: 'init_only' });
    };
    
    const renderMap = (mapId, stops) => {
        const validStops = stops.filter(s => s.lat != null && s.lon != null && s.lat !== 0 && s.lon !== 0);
        if (validStops.length === 0) return;

        const map = L.map(`map-${mapId}`).setView([35.8617, 104.1954], 4);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        const latLngs = validStops.map(s => [s.lat, s.lon]);
        const polyline = L.polyline(latLngs, { color: 'black', weight: 3 }).addTo(map);
        map.fitBounds(polyline.getBounds(), { padding: [50, 50] });

        validStops.forEach(s => {
            L.circleMarker([s.lat, s.lon], { radius: 3, color: 'black' }).addTo(map).bindPopup(s.n);
        });
    };
    
    const onScroll = () => {
        if (isRendering || displayedJourneys >= journeyBuffer.length) return;
        if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 200) {
            maxDisplay += BATCH_SIZE;
            renderBufferedJourneys();
        }
    };

    onMounted(async () => {
      try {
        const rsp = await fetch('ndt.json');
        nonDailyTrains = await rsp.json();
      } catch (e) { /* ignore */ }
      try {
        const rsp = await fetch('version');
        const v = (await rsp.text()).trim();
        if (v.length === 8) version.value = v;
      } catch (e) { /* ignore */ }
      
      initWorker();
      
      document.body.addEventListener('click', hideSuggestions);
      window.addEventListener('scroll', onScroll, { passive: true });
      document.getElementById('o').addEventListener('keypress', (e) => { if (e.key === 'Enter') startSearch(); });
      document.getElementById('d').addEventListener('keypress', (e) => { if (e.key === 'Enter') startSearch(); });
    });
    
    onBeforeUnmount(() => {
        document.body.removeEventListener('click', hideSuggestions);
        window.removeEventListener('scroll', onScroll);
    });

    return {
      origin, destination, escOrigin, escDestination, mode, mtt, showStations,
      progressVisible, progressValue, progressMax, running, ready, statusMessage,
      suggestions, version, resultsContainer,
      toggleSearch, showSuggestions, handleInput
    };
  }
};
</script>

<style>
/* Basic styles to ensure map visibility */
.map-container {
  width: 100%;
  height: 350px;
  margin: 15px 0;
  border: 1px solid #ccc;
}
#suggestions a {
    margin: 0 5px;
}
</style>