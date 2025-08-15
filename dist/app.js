// Railway Transfer Search Application
// Extracted from original HTML to maintain separation of concerns

class RailwaySearch {
    constructor() {
        this.worker = null;
        this.jobCount = 0;
        this.isRunning = false;
        this.isReady = false;
        this.stationNames = [];
        this.currentInput = null;
        this.nonDailyTrains = [];
        
        this.jobBuffer = [];
        this.jobIndex = 0;
        this.batchSize = 50;
        this.maxDisplay = this.batchSize;
        this.scrollActive = false;
        
        this.isDisplaying = false;
        this.getStopsPromises = new Map();
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadNonDailyTrains();
        this.initWorker();
    }

    bindEvents() {
        const oInput = document.getElementById('o');
        const dInput = document.getElementById('d');
        const searchBtn = document.getElementById('ab');

        oInput.addEventListener('keypress', (e) => e.key === 'Enter' && this.handleAction());
        dInput.addEventListener('keypress', (e) => e.key === 'Enter' && this.handleAction());
        oInput.addEventListener('input', () => this.showSuggestions(oInput));
        dInput.addEventListener('input', () => this.showSuggestions(dInput));
        oInput.addEventListener('focus', () => oInput.value && this.showSuggestions(oInput));
        dInput.addEventListener('focus', () => dInput.value && this.showSuggestions(dInput));
        
        document.getElementById('ab').addEventListener('click', () => this.handleAction());
        document.body.addEventListener('click', () => this.hideSuggestions(), true);

        document.querySelectorAll('input[name="mode"]').forEach(radio => {
            radio.addEventListener('change', () => this.toggleTransferTimeVisibility());
        });

        window.addEventListener('scroll', () => this.handleScroll(), { passive: true });
    }

    async loadNonDailyTrains() {
        try {
            const response = await fetch('ndt.json');
            this.nonDailyTrains = await response.json();
        } catch (e) {
            this.nonDailyTrains = [];
        }
    }

    isNonDaily(trainNumber) {
        return this.nonDailyTrains.includes(trainNumber);
    }

    updateStatus(message) {
        const statusEl = document.getElementById('st');
        statusEl.textContent = message;
        statusEl.style.display = 'block';
        
        if (message.includes('加载') || message.includes('搜索')) {
            statusEl.className = 'status loading';
        } else if (message.includes('就绪') || message.includes('查询到')) {
            statusEl.className = 'status success';
        } else if (message.includes('无方案') || message.includes('错误')) {
            statusEl.className = 'status error';
        } else {
            statusEl.className = 'status';
        }
    }

    updateSearchButton() {
        const btn = document.getElementById('ab');
        btn.textContent = this.isRunning ? '停止' : '搜索';
        btn.disabled = (!this.isReady && !this.isRunning);
    }

    showSuggestions(input) {
        this.currentInput = input;
        const query = input.value.toLowerCase();
        const suggestionsDiv = document.getElementById('suggestions');
        
        if (!query || !this.stationNames.length) {
            this.hideSuggestions();
            return;
        }

        const matches = this.stationNames.filter(name => 
            name.toLowerCase().includes(query)
        ).slice(0, 8);

        if (matches.length === 0) {
            this.hideSuggestions();
            return;
        }

        suggestionsDiv.innerHTML = matches.map(name => 
            `<a href="#" onmousedown="app.selectSuggestion('${name}'); return false;">${name}</a>`
        ).join(' | ');
    }

    hideSuggestions() {
        document.getElementById('suggestions').innerHTML = '&nbsp;';
        this.currentInput = null;
    }

    selectSuggestion(name) {
        if (this.currentInput) {
            this.currentInput.value = name;
        }
        this.hideSuggestions();
    }

    toggleTransferTimeVisibility() {
        const container = document.getElementById('mtt_container');
        const mode = document.querySelector('input[name="mode"]:checked').value;
        container.style.display = mode === 'km' ? 'none' : 'block';
    }

    formatDuration(minutes) {
        if (minutes === null) return "N/A";
        
        const days = Math.floor(minutes / 1440);
        const remaining = minutes % 1440;
        const hours = Math.floor(remaining / 60);
        const mins = remaining % 60;
        
        const parts = [];
        if (days > 0) parts.push(`${days}天`);
        if (hours > 0) parts.push(`${hours}小时`);
        if (mins > 0) parts.push(`${mins}分钟`);
        
        return parts.length > 0 ? parts.join(" ") : "0分钟";
    }

    formatArrivalTime(minutes) {
        if (minutes === null) return "N/A";
        
        const day = Math.floor(minutes / 1440);
        const remaining = minutes % 1440;
        const hours = Math.floor(remaining / 60);
        const mins = remaining % 60;
        
        return `第${day + 1}天 ${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }

    calculateTransfers(path) {
        if (!path || path.length <= 1) return 0;
        
        let transfers = 0;
        for (let i = 1; i < path.length; i++) {
            if (path[i].r.tn !== path[i - 1].r.tn) transfers++;
        }
        return transfers;
    }

    async generatePathDetails(journey) {
        let html = '';
        let currentTime = journey.idt;
        const allStations = [];
        const stopsData = [];
        const mode = document.querySelector('input[name="mode"]:checked').value;

        for (let i = 0; i < journey.p.length; i++) {
            const segment = journey.p[i];
            const route = segment.r;

            if (segment.wtb > 0 && i > 0 && route.tn !== journey.p[i - 1].r.tn) {
                html += `<li><strong>${route.bs} 换乘</strong> (${this.formatDuration(segment.wtb)})</li>`;
            }

            currentTime += segment.wtb;
            const startTime = this.formatArrivalTime(currentTime).slice(-5);
            const startStation = route.bs;
            currentTime += route.dur;
            
            let endTime = currentTime;
            let endStation = route.al;
            let segmentKm = route.km;

            let k = i + 1;
            while (k < journey.p.length && journey.p[k].r.tn === route.tn) {
                const nextSegment = journey.p[k];
                endTime += nextSegment.wtb + nextSegment.r.dur;
                endStation = nextSegment.r.al;
                segmentKm += nextSegment.r.km;
                k++;
            }

            const arrivalTime = this.formatArrivalTime(endTime).slice(-5);
            const isNonDaily = this.isNonDaily(route.tn);
            const trainStyle = isNonDaily ? ' style="color: var(--error-color);"' : '';

            const kmInfo = `<span style="font-size: smaller; color: #888;"> (${segmentKm}公里)</span>`;
            const details = mode === 'km' 
                ? `${startStation} → ${endStation}${kmInfo}`
                : `${startStation} ${startTime} → ${endStation} ${arrivalTime}${kmInfo}`;

            if (document.getElementById('show_stations').checked) {
                try {
                    const stops = await this.getTrainStops(route.tn, startStation, endStation);
                    const stationNames = [...new Set(stops.map(stop => stop.n))];
                    allStations.push(...stationNames);
                    stopsData.push(...stops);
                    html += `<li><strong${trainStyle}>${route.tn}:</strong> ${details}</li>`;
                } catch (e) {
                    html += `<li><strong${trainStyle}>${route.tn}:</strong> ${details}</li>`;
                }
            } else {
                html += `<li><strong${trainStyle}>${route.tn}:</strong> ${details}</li>`;
            }

            if (k > i + 1) {
                currentTime = endTime;
                i = k - 1;
            }
        }

        journey.allStations = [...new Set(allStations)];
        return { html, stops: stopsData };
    }

    async displayJourney(journey, index) {
        const resultsDiv = document.getElementById('rs');
        const transfers = this.calculateTransfers(journey.p);
        const { html: pathHtml, stops } = await this.generatePathDetails(journey);
        const stations = journey.allStations || [];

        const mode = document.querySelector('input[name="mode"]:checked').value;
        let summary;
        if (mode === 'km') {
            summary = `<p><strong>总里程：</strong> ${journey.tkm}公里 | <strong>换乘：</strong> ${transfers}次</p>`;
        } else {
            summary = `
                <p><strong>用时：</strong> ${this.formatDuration(journey.tdur)} | <strong>换乘：</strong> ${transfers}次</p>
                <p>${journey.p[0].r.bs} ${this.formatArrivalTime(journey.idt)} → ${journey.p[journey.p.length - 1].r.al} ${this.formatArrivalTime(journey.aat)}</p>
            `;
        }

        let stationList = '';
        let mapHtml = '';
        if (document.getElementById('show_stations').checked) {
            stationList = `<p class="station-list"><strong>途径站点：</strong> ${stations.join(' → ')}</p>`;
            mapHtml = `<div id="map-${index}" class="map-container"></div>`;
        }

        const journeyDiv = document.createElement('div');
        journeyDiv.className = 'result-item';
        journeyDiv.innerHTML = `
            <div class="result-header">
                <h3 class="result-title">方案 ${index}</h3>
                <div class="result-summary">${summary}</div>
                ${stationList}
            </div>
            <h4>路径详情：</h4>
            <ul class="path-list">${pathHtml}</ul>
            ${mapHtml}
        `;

        resultsDiv.appendChild(journeyDiv);

        if (document.getElementById('show_stations').checked && stops && stops.length > 0) {
            this.initMap(index, stops);
        }
    }

    async updateDisplay() {
        if (this.isDisplaying) return;
        this.isDisplaying = true;

        try {
            while (this.jobIndex < this.jobBuffer.length) {
                if (this.jobIndex >= this.maxDisplay) break;
                await this.displayJourney(this.jobBuffer[this.jobIndex], this.jobIndex + 1);
                this.jobIndex++;
            }
        } finally {
            this.isDisplaying = false;
        }
    }

    isAtBottom() {
        return (window.innerHeight + window.scrollY) >= document.body.offsetHeight - 100;
    }

    handleScroll() {
        if (this.isAtBottom() && this.jobIndex < this.jobBuffer.length) {
            if (this.jobIndex >= this.maxDisplay) {
                this.maxDisplay += this.batchSize;
                this.updateDisplay();
            }
        }
    }

    activateScrollListener() {
        if (!this.scrollActive) {
            window.addEventListener('scroll', () => this.handleScroll(), { passive: true });
            this.scrollActive = true;
        }
    }

    deactivateScrollListener() {
        if (this.scrollActive) {
            window.removeEventListener('scroll', () => this.handleScroll());
            this.scrollActive = false;
        }
    }

    handleAction() {
        this.isRunning ? this.stopSearch() : this.startSearch();
    }

    async startSearch() {
        if (this.isRunning || !this.isReady) return;

        const origin = document.getElementById('o').value.trim();
        const destination = document.getElementById('d').value.trim();

        if (!origin || !destination) {
            this.updateStatus('请输入起点和终点');
            return;
        }

        this.deactivateScrollListener();
        this.jobBuffer = [];
        this.jobIndex = 0;
        this.jobCount = 0;
        this.maxDisplay = this.batchSize;
        this.isDisplaying = false;

        this.isRunning = true;
        this.updateSearchButton();
        document.getElementById('rs').innerHTML = '';
        this.updateStatus('搜索中...');
        this.activateScrollListener();

        const mode = document.querySelector('input[name="mode"]:checked').value;
        const message = {
            o: origin,
            d: destination,
            esc_o: document.getElementById('esc_o').checked,
            esc_d: document.getElementById('esc_d').checked
        };

        if (mode === 'km') {
            message.t = 'start_k';
        } else {
            message.mtt = parseInt(document.getElementById('mtt').value);
            message.t = mode === 'xfer' ? 'start_mx' : 'start';
        }

        this.worker.postMessage(message);
    }

    stopSearch() {
        if (this.isRunning && this.worker) {
            this.worker.postMessage({ t: 'stop' });
        }
        this.finishSearch();
    }

    getTrainStops(trainNumber, fromStation, toStation) {
        if (!this.worker) {
            return Promise.reject(new Error('Worker not initialized'));
        }

        const requestId = Date.now() + Math.random();
        const promise = new Promise((resolve, reject) => {
            this.getStopsPromises.set(requestId, { resolve, reject });
            
            setTimeout(() => {
                if (this.getStopsPromises.has(requestId)) {
                    this.getStopsPromises.delete(requestId);
                    reject(new Error('获取站点信息超时'));
                }
            }, 10000);
        });

        this.worker.postMessage({
            t: 'gts',
            requestId,
            d: { n: trainNumber, f: fromStation, t: toStation }
        });

        return promise;
    }

    finishSearch() {
        this.isRunning = false;
        this.updateSearchButton();
    }

    initWorker() {
        if (this.worker) return;

        const timestamp = Date.now();
        this.updateStatus('加载中...');
        this.updateSearchButton();

        this.worker = new Worker(`worker.js?v=${timestamp}`);
        this.worker.onmessage = (e) => this.handleWorkerMessage(e);
        this.worker.onerror = (err) => {
            this.updateStatus(`错误: ${err.message}`);
            this.finishSearch();
        };

        this.worker.postMessage({ t: 'init_only' });
    }

    handleWorkerMessage(e) {
        const { t, d, requestId } = e.data;

        switch (t) {
            case 'j_fnd':
                this.jobCount++;
                this.jobBuffer.push(d);
                this.updateStatus(`查询到 ${this.jobCount} 条方案`);
                if (!this.isDisplaying) this.updateDisplay();
                break;

            case 'done':
                this.finishSearch();
                if (this.jobCount === 0) {
                    this.updateStatus('无可用方案');
                } else {
                    if (!this.isDisplaying) this.updateDisplay();
                    this.updateStatus(`共 ${this.jobCount} 条方案`);
                }
                break;

            case 'err':
                this.updateStatus(d);
                this.finishSearch();
                break;

            case 'stat':
                this.updateStatus(d);
                break;

            case 'init_done':
                this.isReady = true;
                this.updateStatus('就绪');
                this.updateSearchButton();
                this.worker.postMessage({ t: 'get_stn' });
                break;

            case 'stn':
                this.stationNames = d;
                break;

            case 'ts':
                if (requestId && this.getStopsPromises.has(requestId)) {
                    const { resolve } = this.getStopsPromises.get(requestId);
                    this.getStopsPromises.delete(requestId);
                    resolve(d);
                }
                break;
        }
    }

    initMap(mapId, stops) {
        const map = L.map(`map-${mapId}`).setView([35.8617, 104.1954], 4);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(map);

        if (stops && stops.length > 0) {
            const markers = [];
            const coordinates = [];

            stops.forEach(stop => {
                if (stop.lat !== undefined && stop.lon !== undefined &&
                    stop.lat !== 0 && stop.lon !== 0 &&
                    !isNaN(stop.lat) && !isNaN(stop.lon)) {
                    
                    coordinates.push([stop.lat, stop.lon]);
                    const marker = L.circleMarker([stop.lat, stop.lon], {
                        radius: 3,
                        fillColor: "#000000",
                        color: "#000000",
                        weight: 1,
                        opacity: 1,
                        fillOpacity: 1
                    }).addTo(map);
                    marker.bindPopup(stop.n);
                    markers.push(marker);
                }
            });

            if (coordinates.length > 0) {
                const routeLine = L.polyline(coordinates, {
                    color: '#000000',
                    weight: 4
                }).addTo(map);

                const group = new L.featureGroup([...markers, routeLine]);
                map.fitBounds(group.getBounds(), { padding: [50, 50] });
            }
        }
    }
}

// Initialize application
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new RailwaySearch();
});