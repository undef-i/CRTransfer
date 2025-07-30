let wm;
let init_done = false;

async function init_w() {
    if (init_done) return true;
    try {
        if (!wm) {
            const wimp = await import('./pkg/transit.js');
            await wimp.default();
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
    const { t, o, d, mtt, esc_o, esc_d } = e.data;

    try {
        if (t === 'stop') {
            if (wm) wm.stop_s();
            return;
        }

        if (!init_done && !(await init_w())) {
            return;
        }

        if (t === 'start') {
            self.postMessage({ t: 'stat', d: '...' });
            await wm.find(o, d, mtt, esc_o, esc_d); 
            self.postMessage({ t: 'done' });
        } else if (t === 'init_only') {
            self.postMessage({ t: 'init_done' });
        } else if (t === 'get_stn') {
            const stns = wm.get_stn();
            self.postMessage({ t: 'stn', d: stns });
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
