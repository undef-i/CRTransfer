let wm;
let in1 = false, in2 = false, in3 = false;
let rdat = null, scdat = null;

async function init_w() {
    try {
        const wimp = await import('./pkg/transit.js');
        await wimp.default();
        wm = wimp;
        in1 = true;
        console.log('w init');
        return true;
    } catch (err) {
        console.error('w init fail:', err);
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

async function unz(res) {
    const strm = res.body.pipeThrough(new DecompressionStream('gzip'));
    return new Response(strm).json();
}

async function ld_jsn(fn) {
    try {
        const gzres = await fetch(fn + '.gz');
        if (gzres.ok) {
            console.log(`load gz ${fn}.gz`);
            return await unz(gzres);
        }
    } catch (err) {
        console.log(`gz ${fn}.gz fail, try raw`);
    }
    console.log(`load ${fn}`);
    const res = await fetch(fn);
    return await res.json();
}

async function init_d() {
    if (in2 && in3) return;
    try {
        if (!in2) {
            rdat = await ld_jsn('rdat.json');
            console.log('init w rdat...');
            wm.init_d(JSON.stringify(rdat));
            in2 = true;
            console.log('rdat init ok');
        }
        if (!in3) {
            scdat = await ld_jsn('scdat.json');
            console.log('init w sc-dat...');
            wm.init_scd(JSON.stringify(scdat));
            in3 = true;
            console.log('sc-dat init ok');
        }
    } catch (err) {
        console.error('d init fail:', err);
        throw new Error('d init fail: ' + err.message);
    }
}

self.onmessage = async function (e) {
    const { t, o, d, mtt, esc_o, esc_d } = e.data;

    if (t === 'stop') {
        if (wm && in1) wm.stop_s();
        self.close();
        return;
    }

    if (t === 'start') {
        const run_s = async () => {
            try {
                if (!in1 && !(await init_w())) {
                    self.postMessage({ t: 'err', d: 'w init fail' });
                    return;
                }
                await init_d();
                self.postMessage({ t: 'stat', d: '...' });
                wm.find(o, d, mtt, esc_o, esc_d);
                self.postMessage({ t: 'done' });
            } catch (err) {
                console.error('srch err in w:', err);
                self.postMessage({ t: 'err', d: err.toString() || err.message || 'unk err' });
            }
        };
        setTimeout(run_s, 0);
    } else if (t === 'init_d_only') {
        try {
            if (!in1 && !(await init_w())) {
                self.postMessage({ t: 'err', d: 'w init fail' });
                return;
            }
            await init_d();
            self.postMessage({ t: 'd_init' });
        } catch (err) {
            console.error('d init err in w:', err);
            self.postMessage({ t: 'err', d: err.message || 'unk err' });
        }
    } else if (t === 'get_stn') {
        try {
            const stn = wm.get_stn();
            self.postMessage({ t: 'stn', d: stn });
        } catch (err) {
            console.error('get stn err:', err);
            self.postMessage({ t: 'err', d: err.message || 'unk err' });
        }
    }
};

self.onerror = function (err) {
    console.error('w err:', err);
    self.postMessage({ t: 'err', d: 'w err: ' + err.message });
};