let wm;
let init_done = false;

async function init_w() {
    if (init_done) return true;
    try {
        if (!wm) {
            self.postMessage({ t: 'pgr_start' });

            const resp = await fetch('./pkg/transit_bg.wasm');
            if (!resp.ok) throw new Error(`WASM fetch failed: ${resp.statusText}`);

            const tot = +resp.headers.get('Content-Length');
            const rdr = resp.body.getReader();

            let ld = 0;
            const cks = [];

            while (true) {
                const { done, value } = await rdr.read();
                if (done) break;
                cks.push(value);
                ld += value.length;
                if (tot) {
                    self.postMessage({ t: 'pgr_upd', d: { ld, tt: tot } });
                }
            }

            const wbuf = new Uint8Array(ld);
            let pos = 0;
            for (const ck of cks) {
                wbuf.set(ck, pos);
                pos += ck.length;
            }

            const wimp = await import('./pkg/transit.js');
            await wimp.default(wbuf.buffer);
            wm = wimp;
            console.log('w module loaded');
        }
        wm.init();
        init_done = true;
        console.log('w data initialized');
        return true;
    } catch (err) {
        console.error('w init fail:', err);
        self.postMessage({ t: 'err', d: 'w init fail: ' + err.toString() });
        return false;
    }
}


self.on_jny = function (jstr) {
    try {
        self.postMessage({ t: 'j_fnd', d: JSON.parse(jstr) });
    } catch (err) {
        console.error('j parse err:', err);
    }
};

self.onmessage = async function (e) {
    const { t, o, d, mtt, esc_o, esc_d, requestId } = e.data;

    try {
        if (t === 'stop') {
            if (wm) wm.stop();
            return;
        }

        if (!init_done && !(await init_w())) {
            return;
        }

        if (t === 'start') {
            self.postMessage({ t: 'stat', d: '...' });
            await wm.find(o, d, mtt, esc_o, esc_d);
            self.postMessage({ t: 'done' });
        }
        else if (t === 'start_mx') {
            self.postMessage({ t: 'stat', d: '...' });
            await wm.find_mx(o, d, mtt, esc_o, esc_d);
            self.postMessage({ t: 'done' });
        }
        else if (t === 'start_k') {
            self.postMessage({ t: 'stat', d: '...' });
            await wm.find_k(o, d, esc_o, esc_d);
            self.postMessage({ t: 'done' });
        }
        else if (t === 'init_only') {
            self.postMessage({ t: 'init_done' });
        } else if (t === 'get_stn') {
            const stns = wm.g_stns();
            self.postMessage({ t: 'stn', d: stns });
        } else if (t === 'gts') {
            try {
                const stopsJson = wm.gts(d.n, d.f, d.t);
                const stops = JSON.parse(stopsJson);
                self.postMessage({ t: 'ts', d: stops, requestId: requestId });
            } catch (err) {
                console.error('gts err:', err);
                self.postMessage({ t: 'err', d: err.toString() || 'gts unk err', requestId: requestId });
            }
        }
    } catch (err) {
        console.error('err in worker:', err);
        self.postMessage({ t: 'err', d: err.toString() || 'unk err' });
    }
};

self.onerror = function (err) {
    console.error('w err:', err);
    self.postMessage({ t: 'err', d: 'w err: ' + err.message });
};