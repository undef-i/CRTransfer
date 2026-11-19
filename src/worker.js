import { createEngine } from "./engine.js";

let engine = null;
let sl = null;
let rdatMap = null;
let routeMap = null;
let lineMap = null;
let initPromise = null;
let dataResolve = null;
const dataReady = new Promise((resolve) => {
  dataResolve = resolve;
});

function init() {
  if (!initPromise) {
    initPromise = (async () => {
      self.postMessage({ t: "pgr_start" });
      const { rdat, scdat, sl: slData, rts } = await dataReady;
      sl = slData;
      engine = createEngine(rdat, scdat);
      rdatMap = new Map();
      for (const t of rdat.t) rdatMap.set(t.tn, t);
      routeMap = new Map();
      for (const r of rts.r) routeMap.set(r.c, r);
      lineMap = new Map();
      for (const l of rts.l) lineMap.set(l.i, l);
      return true;
    })();
  }
  return initPromise;
}

function gts(tn, dtr, atr) {
  const rt = rdatMap.get(tn);
  if (!rt) throw new Error(`Train '${tn}' not found`);
  const startIdx = rt.s.findIndex((s) => s.d === dtr);
  if (startIdx === -1)
    throw new Error(`Start point with dtr '${dtr}' not found`);
  const relIdx = rt.s.slice(startIdx).findIndex((s) => s.a === atr);
  if (relIdx === -1)
    throw new Error(
      `End point with atr '${atr}' not found after start point with dtr '${dtr}'`
    );
  return rt.s.slice(startIdx, startIdx + relIdx + 1).map((s) => {
    const loc = sl[s.n] || {};
    return {
      n: s.n,
      lat: loc.lat ?? 0,
      lon: loc.lon ?? 0,
      rn: loc.rn ?? [],
    };
  });
}

function gfd(tn) {
  const train = rdatMap.get(tn);
  if (!train) throw new Error("tn!fnd");
  const stopsMap = new Map();
  for (const s of train.s) stopsMap.set(s.n, s);
  const route = routeMap.get(tn);
  if (!route) throw new Error("no_route_data");
  const fullPath = [];
  let lastName = "";
  for (let i = 0; i < route.s.length; i++) {
    const node = route.s[i];
    const line = lineMap.get(node.l);
    if (!line) continue;
    const to = i < route.s.length - 1 ? route.s[i + 1].n : route.e;
    const idxA = line.s.findIndex((s) => s.n === node.n);
    const idxB = line.s.findIndex((s) => s.n === to);
    if (idxA === -1 || idxB === -1) continue;
    const seg =
      idxA <= idxB
        ? line.s.slice(idxA, idxB + 1)
        : line.s.slice(idxB, idxA + 1).reverse();
    for (const st of seg) {
      if (st.n === lastName) {
        const last = fullPath[fullPath.length - 1];
        if (last && !last.rn.includes(line.n)) {
          last.ln = `${last.ln}/${line.n}`;
          last.rn.push(line.n);
        }
        continue;
      }
      const sched = stopsMap.get(st.n);
      const loc = sl[st.n] || {};
      fullPath.push({
        n: st.n,
        lat: loc.lat ?? 0,
        lon: loc.lon ?? 0,
        rn: [line.n],
        st: !!sched,
        a: sched ? sched.a : -1,
        d: sched ? sched.d : -1,
        ln: line.n,
      });
      lastName = st.n;
    }
  }
  return fullPath;
}

self.onmessage = async (e) => {
  const { t, o, d, mtt, esc_o, esc_d, tf, requestId } = e.data;
  if (t === "data") {
    dataResolve(d);
    return;
  }
  try {
    if (t === "stop") {
      if (engine) engine.stop();
      return;
    }
    await init();
    if (t === "init_only") {
      self.postMessage({ t: "init_done" });
    } else if (t === "get_stn") {
      self.postMessage({ t: "stn", d: engine.i2s });
    } else if (t === "get_types") {
      self.postMessage({ t: "types", d: engine.types() });
    } else if (t === "start" || t === "start_mx" || t === "start_k") {
      const cb = (j) => self.postMessage({ t: "j_fnd", d: j });
      if (t === "start") await engine.find(o, d, mtt, esc_o, esc_d, tf || "", cb);
      else if (t === "start_mx")
        await engine.findMx(o, d, mtt, esc_o, esc_d, tf || "", cb);
      else await engine.findK(o, d, esc_o, esc_d, tf || "", cb);
      self.postMessage({ t: "done" });
    } else if (t === "gts") {
      try {
        self.postMessage({ t: "ts", d: gts(d.n, d.dtr, d.atr), requestId });
      } catch (err) {
        self.postMessage({
          t: "gts_err",
          d: String((err && err.message) || err),
          requestId,
        });
      }
    } else if (t === "gfd") {
      try {
        self.postMessage({ t: "qr", d: gfd(d.n), requestId });
      } catch (err) {
        self.postMessage({
          t: "qry_err",
          d: String((err && err.message) || err),
          requestId,
        });
      }
    }
  } catch (err) {
    console.error("worker err:", err);
    self.postMessage({ t: "err", d: String((err && err.message) || err) });
  }
};
