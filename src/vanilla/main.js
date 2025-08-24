import './style.css'

let w = null;
let jc = 0;
let run = false;
let rdy = false;
let sns = [];
let cin = null;
let nd = [];
const ts = Date.now();

let jbuf = [];
let jix = 0;
const BSZ = 50;
let mdisp = BSZ;
let sact = false;

let disp = false;
const gtsp = new Map();

function us(m) {
    document.getElementById('st').innerHTML = `<p><strong>${m}</strong></p>`;
}

function ss(inp) {
    cin = inp;
    const q = inp.value.toLowerCase();
    if (!q || !sns) { hs(); return; }
    const ms = sns.filter(s => s.toLowerCase().includes(q)).slice(0, 8);
    if (ms.length === 0) { hs(); return; }
    document.getElementById('suggestions').innerHTML = ms.map(s => `<a href="#" onmousedown="sels('${s}'); return false;">${s}</a>`).join(' | ');
}

function hs(e) {
    if (e && (e.target.id === 'o' || e.target.id === 'd')) { return; }
    document.getElementById('suggestions').innerHTML = '&nbsp;';
}

function sels(s) {
    if (cin) { cin.value = s; }
    hs();
    cin = null;
}

async function lnd() {
    try {
        const rsp = await fetch('../ndt.json');
        nd = await rsp.json();
    } catch (e) {
        nd = [];
    }
}

function isnd(tn) { return nd.includes(tn); }

async function dj(j, i) {
    const rd = document.getElementById('rs');
    const xfrs = calx(j.p);
    const { pd, tstps } = await gjd(j);
    const rstns = j.allStations || [];
    const jdiv = document.createElement('div');

    const mode = document.querySelector('input[name="mode"]:checked').value;
    let summary;
    if (mode === 'km') {
        summary = `<p><strong>总里程：</strong> ${j.tkm}公里 | <strong>换乘：</strong> ${xfrs}次</p>`;
    } else {
        summary = `<p><strong>用时：</strong> ${fdur(j.tdur)} | <strong>换乘：</strong> ${xfrs}次</p>
                       <p>${j.p[0].r.bs} ${fat(j.idt)} → ${j.p[j.p.length - 1].r.al} ${fat(j.aat)}</p>`;
    }

    let si = '';
    let mc = '';
    if (document.getElementById('show_stations').checked) {
        si = `<p><strong>途径站点：</strong> ${rstns.join(' → ')}</p>`;
        mc = `<div id="map-${i}" class="map-container"></div>`;
    }

    jdiv.innerHTML = `
    <hr><h3>方案 ${i}</h3>
    ${summary}
    ${si}
    <h4>路径：</h4><ul>${pd}</ul>
    ${mc}`;
    rd.appendChild(jdiv);

    if (document.getElementById('show_stations').checked && tstps && tstps.length > 0) {
        imap(i, tstps);
    }
}

async function ud() {
    if (disp) return;
    disp = true;
    try {
        while (jix < jbuf.length) {
            if (jix >= mdisp) {
                break;
            }
            await dj(jbuf[jix], jix + 1);
            jix++;
        }
    } finally {
        disp = false;
    }
}

function isab() { return (window.innerHeight + window.scrollY) >= document.body.offsetHeight - 100; }

function onscr() {
    if (isab() && jix < jbuf.length) {
        if (jix >= mdisp) {
            mdisp += BSZ;
            ud();
        }
    }
}

function asl() {
    if (!sact) {
        window.addEventListener('scroll', onscr, { passive: true });
        sact = true;
    }
}

function rsl() {
    if (sact) {
        window.removeEventListener('scroll', onscr);
        sact = false;
    }
}

function fdur(m) {
    if (m === null) return "N/A";
    const d = Math.floor(m / 1440), rem = m % 1440, h = Math.floor(rem / 60), mins = rem % 60;
    let p = [];
    if (d > 0) p.push(d + "天"); if (h > 0) p.push(h + "小时"); if (mins > 0) p.push(mins + "分钟");
    return p.length > 0 ? p.join(" ") : "0分钟";
}

function formatTrainNumber(trainNumber) {
    if (!trainNumber) return trainNumber;
    
    if (trainNumber.includes('/')) {
        const parts = trainNumber.split('/');
        const formattedParts = parts.map(part => {
            return part.replace(/[A-Za-z]$/, '');
        });
        
        if (formattedParts[0] === formattedParts[1]) {
            return formattedParts[0];
        } else {
            return formattedParts.join('/');
        }
    } else {
        return trainNumber.replace(/[A-Za-z]$/, '');
    }
}

function fat(am) {
    if (am === null) return "N/A";
    const day = Math.floor(am / 1440), rem = am % 1440, h = Math.floor(rem / 60), m = rem % 60;
    return `第${day + 1}天 ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function calx(p) {
    if (!p || p.length <= 1) return 0;
    let x = 0;
    for (let i = 1; i < p.length; i++) { if (p[i].r.tn !== p[i - 1].r.tn) x++; }
    return x;
}

async function gjd(j) {
    let h = '', ct = j.idt;
    const all_sns = [];
    const tstps = [];
    const mode = document.querySelector('input[name="mode"]:checked').value;

    for (let i = 0; i < j.p.length; i++) {
        const ps = j.p[i], r = ps.r;
        if (ps.wtb > 0 && i > 0 && r.tn !== j.p[i - 1].r.tn) {
            h += `<li><strong>${r.bs} 换乘</strong> (${fdur(ps.wtb)})</li>`;
        }

        ct += ps.wtb;
        const bts = fat(ct), ss = r.bs;
        ct += r.dur;
        
        const fs = r.al;
        const seg_km = r.km;

        const fats = fat(ct);
        const is_nd = isnd(r.tn);
        const tstyle = is_nd ? ' style="color: red;"' : '';
        const formattedTrainNumber = formatTrainNumber(r.tn);

        const km_info = `<span style="font-size: smaller; color: #888;"> (${seg_km}公里)</span>`;
        const details = mode === 'km' ? `${ss} → ${fs}${km_info}` : `${ss} ${bts} → ${fs} ${fats}${km_info}`;

        if (document.getElementById('show_stations').checked) {
            try {
                const dtr = r.dtr;
                const atr = r.dtr + r.dur;
                const stops = await gts(r.tn, dtr, atr);
                const snames = stops.map(stop => stop.n);
                const usns = [];
                for (const sn of snames) {
                    if (!usns.includes(sn)) {
                        usns.push(sn);
                    }
                }
                all_sns.push(...usns);
                tstps.push(...stops);
                h += `<li><strong${tstyle}>${formattedTrainNumber}:</strong> ${details}</li>`;
            } catch (e) {
                h += `<li><strong${tstyle}>${formattedTrainNumber}:</strong> ${details}</li>`;
            }
        } else {
            h += `<li><strong${tstyle}>${formattedTrainNumber}:</strong> ${details}</li>`;
        }
    }
    j.allStations = [...new Set(all_sns)];
    return { pd: h, tstps };
}

function act() { if (run) stp_s(); else s_s(); }

function uab() {
    const btn = document.getElementById('ab');
    btn.textContent = run ? '停止' : '搜索';
    btn.disabled = (!rdy && !run);
}

function s_s() {
    if (run || !rdy) return;
    const o_val = document.getElementById('o').value.trim();
    const d_val = document.getElementById('d').value.trim();
    if (!o_val || !d_val) { us('输入起点和终点'); return; }

    rsl();
    jbuf = [];
    jix = 0;
    jc = 0;
    mdisp = BSZ;
    disp = false;

    run = true;
    uab();
    document.getElementById('rs').innerHTML = '';
    us('搜索');
    asl();

    const mode = document.querySelector('input[name="mode"]:checked').value;
    let msg = {
        o: o_val,
        d: d_val,
        esc_o: document.getElementById('esc_o').checked,
        esc_d: document.getElementById('esc_d').checked
    };

    if (mode === 'km') {
        msg.t = 'start_k';
    } else {
        msg.mtt = parseInt(document.getElementById('mtt').value);
        if (mode === 'xfer') {
            msg.t = 'start_mx';
        } else {
            msg.t = 'start';
        }
    }
    w.postMessage(msg);
}

function stp_s() {
    if (run && w) {
        w.postMessage({ t: 'stop' });
    }
    f_s();
}

function gts(n, dtr, atr) {
    if (w) {
        const rid = Date.now() + Math.random();
        const p = new Promise((res, rej) => {
            gtsp.set(rid, { res, rej });
            setTimeout(() => {
                if (gtsp.has(rid)) {
                    gtsp.delete(rid);
                    rej(new Error('gts request timeout'));
                }
            }, 10000);
        });
        w.postMessage({ t: 'gts', requestId: rid, d: { n, dtr, atr } });
        return p;
    }
    return Promise.reject(new Error('Worker not initialized'));
}

function f_s() {
    run = false;
    uab();
}

function iw() {
    if (w) return;
    us('加载');
    uab();
    w = new Worker(new URL('../worker.js', import.meta.url), { type: 'module' });
    w.onmessage = function (e) {
        const { t, d, requestId } = e.data;
        switch (t) {
            case 'pgr_start':
                document.getElementById('pbar_container').style.visibility = 'visible';
                break;
            case 'pgr_upd':
                const pbar = document.getElementById('pbar');
                pbar.value = d.ld;
                pbar.max = d.tt;
                break;
            case 'j_fnd':
                jc++;
                jbuf.push(d);
                us(`查询到 ${jc} 条方案`);
                if (!disp) ud();
                break;
            case 'done':
                f_s();
                if (jc === 0) {
                    us('无方案');
                } else {
                    if (!disp) ud();
                    us(`共 ${jc} 条方案`);
                }
                break;
            case 'err':
                us(d);
                f_s();
                break;
            case 'stat':
                us(d);
                break;
            case 'init_done':
                document.getElementById('pbar_container').style.visibility = 'hidden';
                rdy = true;
                us('就绪');
                uab();
                w.postMessage({ t: 'get_stn' });
                break;
            case 'stn':
                sns = d;
                break;
            case 'ts':
                if (requestId && gtsp.has(requestId)) {
                    const { res } = gtsp.get(requestId);
                    gtsp.delete(requestId);
                    res(d);
                }
                break;
        }
    };
    w.onerror = function (err) { us(err.message); f_s(); };
    w.postMessage({ t: 'init_only' });
}

document.getElementById('o').addEventListener('keypress', (e) => { if (e.key === 'Enter') act(); });
document.getElementById('d').addEventListener('keypress', (e) => { if (e.key === 'Enter') act(); });
document.getElementById('o').addEventListener('input', function () { ss(this); });
document.getElementById('d').addEventListener('input', function () { ss(this); });
document.getElementById('o').addEventListener('focus', function () { if (this.value) ss(this); });
document.getElementById('d').addEventListener('focus', function () { if (this.value) ss(this); });
document.body.addEventListener('click', hs, true);

document.querySelectorAll('input[name="mode"]').forEach(radio => {
    radio.addEventListener('change', function () {
        const mc = document.getElementById('mtt_container');
        if (this.value === 'km') {
            mc.style.display = 'none';
        } else {
            mc.style.display = 'inline';
        }
    });
});

async function ldu() {
    try {
        const rsp = await fetch('version');
        const v = (await rsp.text()).trim();
        if (v.length === 8) {
            document.getElementById('udt').textContent = v;
        }
    } catch { }
}

window.addEventListener('load', async () => {
    document.getElementById('ab').addEventListener('click', act);
    uab();
    await lnd();
    await ldu();
    iw();
});
us('启动');

function imap(mapId, stops) {
    const map = L.map(`map-${mapId}`).setView([35.8617, 104.1954], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);

    if (stops && stops.length > 0) {
        const mkrs = [];
        const lls = [];

        stops.forEach(stp => {
            if (stp.lat !== undefined && stp.lon !== undefined &&
                stp.lat !== 0 && stp.lon !== 0 &&
                !isNaN(stp.lat) && !isNaN(stp.lon)) {
                lls.push([stp.lat, stp.lon]);
                const cm = L.circleMarker([stp.lat, stp.lon], {
                    radius: 3, fillColor: "#000000", color: "#000000",
                    weight: 1, opacity: 1, fillOpacity: 1
                }).addTo(map);
                cm.bindPopup(stp.n);
                mkrs.push(cm);
            }
        });

        if (lls.length > 0) {
            const rline = L.polyline(lls, { color: '#000000', weight: 4 }).addTo(map);
            const grp = new L.featureGroup([...mkrs, rline]);
            map.fitBounds(grp.getBounds(), { padding: [50, 50] });
        }
    }
}