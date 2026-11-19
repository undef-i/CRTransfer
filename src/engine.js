const I32MAX = 2147483647;

function makePool(initCap, keys) {
  let cap = initCap;
  const a = {};
  for (const k of keys) a[k] = new Int32Array(cap);
  return {
    a,
    n: 0,
    push() {
      if (this.n === cap) {
        cap <<= 1;
        for (const k of keys) {
          const na = new Int32Array(cap);
          na.set(a[k]);
          a[k] = na;
        }
      }
      return this.n++;
    },
  };
}

function makeHeap(initCap = 16384) {
  return {
    idx: new Int32Array(initCap),
    k1: new Int32Array(initCap),
    n: 0,
  };
}

function heapPush(h, si, k1) {
  if (h.n === h.idx.length) {
    const cap = h.idx.length * 2;
    const nidx = new Int32Array(cap);
    nidx.set(h.idx);
    h.idx = nidx;
    const nk1 = new Int32Array(cap);
    nk1.set(h.k1);
    h.k1 = nk1;
  }
  const idx = h.idx;
  const hk1 = h.k1;
  let i = h.n++;
  while (i > 0) {
    const p = (i - 1) >> 1;
    const pk1 = hk1[p];
    if (k1 >= pk1) break;
    idx[i] = idx[p];
    hk1[i] = pk1;
    i = p;
  }
  idx[i] = si;
  hk1[i] = k1;
}

function heapPop(h) {
  const idx = h.idx;
  const hk1 = h.k1;
  const top = idx[0];
  const n = --h.n;
  if (n > 0) {
    const si = idx[n];
    const k1 = hk1[n];
    let i = 0;
    const half = n >> 1;
    while (i < half) {
      let c = (i << 1) + 1;
      const r = c + 1;
      let ck1 = hk1[c];
      if (r < n && hk1[r] < ck1) {
        c = r;
        ck1 = hk1[r];
      }
      if (k1 <= ck1) break;
      idx[i] = idx[c];
      hk1[i] = ck1;
      i = c;
    }
    idx[i] = si;
    hk1[i] = k1;
  }
  return top;
}

function pstoreAdd(b, a, d, x) {
  const maxI = x - 1 < b.length ? x - 1 : b.length - 1;
  for (let i = 0; i <= maxI; i++) {
    const bk = b[i];
    if (!bk || bk.n === 0) continue;
    const n = bk.n;
    const ba = bk.a;
    const bd = bk.d;
    if (ba[0] > a || bd[n - 1] < d) continue;
    if (ba[n - 1] <= a || bd[0] >= d) return false;
    if (n === 2) continue;
    let lo = 1;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (ba[mid] <= a) lo = mid + 1;
      else hi = mid;
    }
    if (bd[lo - 1] >= d) return false;
  }
  for (let i = x + 1; i < b.length; i++) {
    const bk = b[i];
    if (!bk || bk.n === 0) continue;
    const n = bk.n;
    const ba = bk.a;
    const bd = bk.d;
    if (ba[0] >= a && bd[n - 1] <= d) {
      bk.n = 0;
      continue;
    }
    if (ba[n - 1] < a || bd[0] > d) continue;
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (ba[mid] < a) lo = mid + 1;
      else hi = mid;
    }
    let end = lo;
    while (end < n && bd[end] <= d) end++;
    if (end > lo) {
      ba.copyWithin(lo, end, n);
      bd.copyWithin(lo, end, n);
      bk.n = n - (end - lo);
    }
  }
  let bk = b[x];
  if (!bk) {
    while (b.length < x) b.push(null);
    bk = b[x] = { a: new Int32Array(8), d: new Int32Array(8), n: 0 };
    bk.a[0] = a;
    bk.d[0] = d;
    bk.n = 1;
    return true;
  }
  const n = bk.n;
  let ba = bk.a;
  let bd = bk.d;
  if (n === 0) {
    ba[0] = a;
    bd[0] = d;
    bk.n = 1;
    return true;
  }
  if (a > ba[n - 1]) {
    if (bd[n - 1] >= d) return false;
    if (n === ba.length) {
      const na = new Int32Array(n * 2);
      na.set(ba);
      ba = bk.a = na;
      const nd = new Int32Array(n * 2);
      nd.set(bd);
      bd = bk.d = nd;
    }
    ba[n] = a;
    bd[n] = d;
    bk.n = n + 1;
    return true;
  }
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ba[mid] < a) lo = mid + 1;
    else hi = mid;
  }
  if (lo < n && ba[lo] === a) {
    if (bd[lo] >= d) return false;
  } else if (lo > 0 && bd[lo - 1] >= d) {
    return false;
  }
  let end = lo;
  while (end < n && bd[end] <= d) end++;
  const del = end - lo;
  if (del === 1) {
    ba[lo] = a;
    bd[lo] = d;
  } else if (del > 1) {
    ba[lo] = a;
    bd[lo] = d;
    ba.copyWithin(lo + 1, end, n);
    bd.copyWithin(lo + 1, end, n);
    bk.n = n - del + 1;
  } else {
    if (n === ba.length) {
      const na = new Int32Array(n * 2);
      na.set(ba);
      ba = bk.a = na;
      const nd = new Int32Array(n * 2);
      nd.set(bd);
      bd = bk.d = nd;
    }
    ba.copyWithin(lo + 1, lo, n);
    bd.copyWithin(lo + 1, lo, n);
    ba[lo] = a;
    bd[lo] = d;
    bk.n = n + 1;
  }
  return true;
}

function pstoreIsDominated(b, a, d, x) {
  const maxI = x < b.length ? x : b.length - 1;
  for (let i = 0; i <= maxI; i++) {
    const bk = b[i];
    if (!bk || bk.n === 0) continue;
    const n = bk.n;
    const ba = bk.a;
    const bd = bk.d;
    if (ba[0] > a || bd[n - 1] < d) continue;
    if (ba[n - 1] <= a || bd[0] >= d) return true;
    if (n === 2) continue;
    let lo = 1;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (ba[mid] <= a) lo = mid + 1;
      else hi = mid;
    }
    if (bd[lo - 1] >= d) return true;
  }
  return false;
}

function bucketMinA(bk, d) {
  if (!bk || bk.n === 0) return I32MAX;
  const n = bk.n;
  const bd = bk.d;
  if (bd[n - 1] < d) return I32MAX;
  if (bd[0] >= d) return bk.a[0];
  let lo = 1;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (bd[mid] < d) lo = mid + 1;
    else hi = mid;
  }
  return bk.a[lo];
}

export function createEngine(rdat, scdat) {
  const s2i = new Map();
  const i2s = [];
  const getSid = (n) => {
    let id = s2i.get(n);
    if (id === undefined) {
      id = i2s.length;
      s2i.set(n, id);
      i2s.push(n);
    }
    return id;
  };

  const L_tn = [];
  const L_bs = [];
  const L_al = [];
  const L_dtr = [];
  const L_dur = [];
  const L_km = [];
  const L_id = [];
  const L_next = [];
  let pairCounter = 0;

  for (const train of rdat.t) {
    const s = train.s;
    for (let i = 0; i + 1 < s.length; i++) {
      const b = s[i];
      const a = s[i + 1];
      const curId = pairCounter;
      const nextId = i + 1 < s.length - 1 ? pairCounter + 1 : -1;
      pairCounter++;
      if (b.d !== -1 && a.a !== -1 && a.a > b.d && a.km > b.km) {
        const bs = getSid(b.n);
        const al = getSid(a.n);
        L_tn.push(train.tn);
        L_bs.push(bs);
        L_al.push(al);
        L_dtr.push(b.d);
        L_dur.push(a.a - b.d);
        L_km.push(a.km - b.km);
        L_id.push(curId);
        L_next.push(nextId);
      }
    }
  }

  const grp = new Map();
  for (const g of scdat.g) {
    const sids = g.s.map((st) => getSid(st.n));
    if (sids.length > 1) {
      for (const id of sids) grp.set(id, sids);
    }
  }

  const maxSid = i2s.length;
  const totalPairs = pairCounter;
  const legCount = L_tn.length;

  const csrOff = new Int32Array(maxSid + 1);
  for (let i = 0; i < legCount; i++) csrOff[L_bs[i] + 1]++;
  for (let i = 0; i < maxSid; i++) csrOff[i + 1] += csrOff[i];
  const csrLegs = new Int32Array(legCount);
  {
    const cur = Int32Array.from(csrOff.subarray(0, maxSid));
    for (let li = 0; li < legCount; li++) csrLegs[cur[L_bs[li]]++] = li;
    for (let st = 0; st < maxSid; st++) {
      const from = csrOff[st];
      const to = csrOff[st + 1];
      if (to - from > 1) {
        const seg = Array.from(csrLegs.subarray(from, to));
        seg.sort((m, n) => (L_dtr[m] % 1440) - (L_dtr[n] % 1440));
        csrLegs.set(seg, from);
      }
    }
  }

  const legTn = new Array(legCount);
  const legBs = new Int32Array(legCount);
  const legAl = new Int32Array(legCount);
  const legDtr = new Int32Array(legCount);
  const legDur = new Int32Array(legCount);
  const legKm = new Int32Array(legCount);
  const legId = new Int32Array(legCount);
  const legNext = new Int32Array(legCount);
  const legDtrMod = new Int32Array(legCount);
  const legFirst = new Uint8Array(legCount);
  for (let k = 0; k < legCount; k++) {
    const src = csrLegs[k];
    legTn[k] = L_tn[src];
    legBs[k] = L_bs[src];
    legAl[k] = L_al[src];
    legDtr[k] = L_dtr[src];
    legDur[k] = L_dur[src];
    legKm[k] = L_km[src];
    legId[k] = L_id[src];
    legNext[k] = L_next[src];
    legDtrMod[k] = L_dtr[src] % 1440;
    const c = L_tn[src].charCodeAt(0);
    legFirst[k] = c < 256 ? c : 0xff;
  }

  const hMap = new Map();
  for (let li = 0; li < legCount; li++) {
    const key = (legBs[li] * maxSid + legAl[li]) * 256 + legFirst[li];
    const cur = hMap.get(key);
    if (cur === undefined || legDur[li] < cur) hMap.set(key, legDur[li]);
  }
  const hOff = new Int32Array(maxSid + 1);
  for (const [key] of hMap) {
    const al = (((key / 256) | 0) % maxSid);
    hOff[al + 1]++;
  }
  for (let st = 0; st < maxSid; st++) hOff[st + 1] += hOff[st];
  const hPs = new Int32Array(hOff[maxSid]);
  const hPack = new Int32Array(hOff[maxSid]);
  {
    const cur = Int32Array.from(hOff.subarray(0, maxSid));
    for (const [key, dur] of hMap) {
      const first = key % 256;
      const tmp = (key - first) / 256;
      const al = tmp % maxSid;
      const bs = (tmp - al) / maxSid;
      const pos = cur[al]++;
      hPs[pos] = bs;
      hPack[pos] = (dur << 8) | first;
    }
  }
  const legNextLi = new Int32Array(legCount).fill(-1);
  {
    const idxById = new Int32Array(totalPairs).fill(-1);
    for (let li = 0; li < legCount; li++) idxById[legId[li]] = li;
    for (let li = 0; li < legCount; li++) {
      const nx = legNext[li];
      if (nx >= 0) {
        const t = idxById[nx];
        if (t !== -1) legNextLi[li] = t;
      }
    }
  }
  const legArrMod = new Int32Array(legCount);
  const legContStep = new Int32Array(legCount);
  const edgePack = new Int32Array(legCount * 4);
  for (let li = 0; li < legCount; li++) {
    legArrMod[li] = (legDtr[li] + legDur[li]) % 1440;
    const nl = legNextLi[li];
    if (nl !== -1) {
      legContStep[li] =
        (legArrMod[li] <= legDtrMod[nl]
          ? legDtrMod[nl] - legArrMod[li]
          : 1440 - legArrMod[li] + legDtrMod[nl]) + legDur[nl];
    }
    edgePack[li * 4] = (legFirst[li] << 11) | legDtrMod[li];
    edgePack[li * 4 + 1] = legAl[li];
    edgePack[li * 4 + 2] = legDur[li];
    edgePack[li * 4 + 3] = nl;
  }

  function buildTfTable(tf) {
    const table = new Uint8Array(256);
    if (!tf) {
      table.fill(1);
      return table;
    }
    for (let i = 0; i < tf.length; i++) {
      const ch = tf[i];
      if (ch === "@") {
        for (let dig = 48; dig <= 57; dig++) table[dig] = 1;
      } else {
        table[ch.charCodeAt(0)] = 1;
      }
    }
    return table;
  }
  function buildLegOk(tf) {
    const ok = new Uint8Array(legCount);
    if (!tf) {
      ok.fill(1);
      return ok;
    }
    const table = buildTfTable(tf);
    for (let li = 0; li < legCount; li++) ok[li] = table[legFirst[li]];
    return ok;
  }

  const grpOf = (sid) => grp.get(sid) || [sid];

  function legOut(li) {
    return {
      tn: legTn[li],
      bs: i2s[legBs[li]],
      al: i2s[legAl[li]],
      dtr: legDtr[li],
      dur: legDur[li],
      km: legKm[li],
      leg_id: legId[li],
      next_leg_id: legNext[li] < 0 ? null : legNext[li],
    };
  }

  function mkPath(P, idx) {
    const A = P.a;
    const segs = [];
    let cur = idx;
    while (cur !== -1) {
      if (A.leg[cur] !== -1) segs.push(cur);
      cur = A.par[cur];
    }
    segs.reverse();
    if (!segs.length) return [];
    const out = [];
    let lc = segs[0];
    let mr = legOut(A.leg[lc]);
    let fdt = A.aat[lc] - mr.dur;
    let wtb = A.par[lc] !== -1 ? fdt - A.aat[A.par[lc]] : 0;
    for (let k = 1; k < segs.length; k++) {
      const c = segs[k];
      const li = A.leg[c];
      if (mr.next_leg_id !== null && mr.next_leg_id === legId[li]) {
        mr.al = i2s[legAl[li]];
        mr.km += legKm[li];
        mr.next_leg_id = legNext[li] < 0 ? null : legNext[li];
        lc = c;
      } else {
        mr.dur = A.aat[lc] - fdt;
        out.push({ wtb, r: mr });
        fdt = A.aat[c] - legDur[li];
        wtb = A.par[c] !== -1 ? fdt - A.aat[A.par[c]] : 0;
        mr = legOut(li);
        lc = c;
      }
    }
    mr.dur = A.aat[lc] - fdt;
    out.push({ wtb, r: mr });
    return out;
  }

  const engine = {
    i2s,
    legCount,
    totalPairs,
    maxSid,
    _req: 0,
    stop() {
      this._req++;
    },
    types() {
      const set = new Set();
      for (const t of rdat.t) {
        if (!t.tn) continue;
        const c = t.tn[0];
        set.add(c >= "0" && c <= "9" ? "@" : c);
      }
      return [...set].sort((a, b) => a.charCodeAt(0) - b.charCodeAt(0));
    },
  };

  function resolve(o, d, escO, escD) {
    const oid = s2i.get(o);
    if (oid === undefined) throw new Error(`'${o}' not found`);
    const did = s2i.get(d);
    if (did === undefined) throw new Error(`'${d}' not found`);
    const isDest = new Uint8Array(maxSid);
    for (const id of escD ? grpOf(did) : [did]) isDest[id] = 1;
    return {
      osids: escO ? grpOf(oid) : [oid],
      isDest,
    };
  }

  engine.findMx = async function (o, d, mtt, escO, escD, tf, onJny) {
    const myReq = ++engine._req;
    const { osids, isDest } = resolve(o, d, escO, escD);
    const legOk = buildLegOk(tf);
    const tfTable = buildTfTable(tf);
    const mttDays = ((mtt / 1440) | 0) * 1440;
    const mttRem = mtt - mttDays;
    const P = makePool(8192, ["aat", "sid", "idt", "x", "par", "leg"]);
    const A = P.a;
    let cap = 16384;
    let mask = cap - 1;
    let dq = new Int32Array(cap);
    let head = 0;
    let tail = 0;
    let len = 0;
    const dqGrow = () => {
      const nd = new Int32Array(cap << 1);
      if (head < tail) {
        nd.set(dq.subarray(head, tail), 0);
      } else {
        const firstLen = cap - head;
        nd.set(dq.subarray(head, cap), 0);
        nd.set(dq.subarray(0, tail), firstLen);
      }
      dq = nd;
      head = 0;
      tail = len;
      cap <<= 1;
      mask = cap - 1;
    };
    const pushBack = (val) => {
      if (len === cap) dqGrow();
      dq[tail] = val;
      tail = (tail + 1) & mask;
      len++;
    };
    const visited = new Int32Array(legCount).fill(I32MAX);
    const expanded = new Uint8Array(maxSid);
    for (const osid of osids) expanded[osid] = 1;
    for (const osid of osids) {
      for (let li = csrOff[osid]; li < csrOff[osid + 1]; li++) {
        if (!legOk[li]) continue;
        const si = P.push();
        A.aat[si] = legDtr[li] + legDur[li];
        A.sid[si] = legAl[li];
        A.idt[si] = legDtr[li];
        A.x[si] = 0;
        A.par[si] = -1;
        A.leg[si] = li;
        pushBack(si);
      }
    }
    let minX = I32MAX;
    let i = 0;
    let lastYield = performance.now();
    while (len) {
      const c = dq[head];
      head = (head + 1) & mask;
      len--;
      i++;
      if ((i & 2047) === 0) {
        const now = performance.now();
        if (now - lastYield > 15) {
          await new Promise((r) => setTimeout(r, 0));
          lastYield = performance.now();
        }
      }
      if (engine._req !== myReq) break;
      if (A.x[c] > minX) continue;
      const cli = A.leg[c];
      if (visited[cli] <= A.x[c]) continue;
      visited[cli] = A.x[c];
      if (isDest[A.sid[c]]) {
        minX = A.x[c];
        onJny({
          tdur: A.aat[c] - A.idt[c],
          aat: A.aat[c],
          idt: A.idt[c],
          x: A.x[c],
          tkm: 0,
          p: mkPath(P, c),
        });
        continue;
      }
      const sid = A.sid[c];
      const aat = A.aat[c];
      const idt = A.idt[c];
      const x = A.x[c];
      const contLi = legNextLi[cli];
      if (contLi !== -1 && legOk[contLi] && visited[contLi] > x) {
        const si = P.push();
        A.aat[si] = aat + legContStep[cli];
        A.sid[si] = legAl[contLi];
        A.idt[si] = idt;
        A.x[si] = x;
        A.par[si] = c;
        A.leg[si] = contLi;
        if (len === cap) dqGrow();
        head = (head - 1) & mask;
        dq[head] = si;
        len++;
      }
      if (x < minX && !expanded[sid]) {
        expanded[sid] = 1;
        const newX = x + 1;
        const aatMod = legArrMod[cli];
        const minDep = aatMod + mttRem;
        const thr = minDep < 1440 ? minDep : minDep - 1440;
        const base = aat - aatMod + mttDays + (minDep < 1440 ? 0 : 1440);
        for (
          let e = csrOff[sid] << 2, eEnd = csrOff[sid + 1] << 2;
          e < eEnd;
          e += 4
        ) {
          const pk = edgePack[e];
          if (!tfTable[pk >>> 11]) continue;
          const li = e >> 2;
          if (li === contLi || visited[li] <= newX) continue;
          const dtrMod = pk & 2047;
          let dep = base + dtrMod;
          if (dtrMod < thr) dep += 1440;
          const si = P.push();
          A.aat[si] = dep + edgePack[e + 2];
          A.sid[si] = edgePack[e + 1];
          A.idt[si] = idt;
          A.x[si] = newX;
          A.par[si] = c;
          A.leg[si] = li;
          pushBack(si);
        }
      }
    }
  };

  engine.findK = async function (o, d, escO, escD, tf, onJny) {
    const myReq = ++engine._req;
    const { osids, isDest } = resolve(o, d, escO, escD);
    const legOk = buildLegOk(tf);
    const P = makePool(8192, ["tkm", "sid", "par", "leg"]);
    const A = P.a;
    const heap = makeHeap();
    const dist = new Int32Array(maxSid).fill(I32MAX);
    let remDest = 0;
    for (let s = 0; s < maxSid; s++) if (isDest[s]) remDest++;
    for (const osid of osids) {
      for (let li = csrOff[osid]; li < csrOff[osid + 1]; li++) {
        if (!legOk[li]) continue;
        const ns = legAl[li];
        if (legKm[li] >= dist[ns]) continue;
        dist[ns] = legKm[li];
        const si = P.push();
        A.tkm[si] = legKm[li];
        A.sid[si] = ns;
        A.par[si] = -1;
        A.leg[si] = li;
        heapPush(heap, si, A.tkm[si]);
      }
    }
    const v = new Int32Array(maxSid).fill(I32MAX);
    let i = 0;
    let lastYield = performance.now();
    while (heap.n) {
      const c = heapPop(heap);
      i++;
      if ((i & 2047) === 0) {
        const now = performance.now();
        if (now - lastYield > 15) {
          await new Promise((r) => setTimeout(r, 0));
          lastYield = performance.now();
        }
      }
      if (engine._req !== myReq) break;
      if (v[A.sid[c]] <= A.tkm[c]) continue;
      v[A.sid[c]] = A.tkm[c];
      if (isDest[A.sid[c]]) {
        const segs = [];
        let cur = c;
        while (cur !== -1) {
          if (A.leg[cur] !== -1) segs.push(cur);
          cur = A.par[cur];
        }
        segs.reverse();
        const p = segs.map((cc) => ({ wtb: 0, r: legOut(A.leg[cc]) }));
        onJny({ tdur: 0, aat: 0, idt: 0, x: p.length - 1, tkm: A.tkm[c], p });
        if (--remDest === 0) break;
        continue;
      }
      const sid = A.sid[c];
      const tkm = A.tkm[c];
      for (let li = csrOff[sid]; li < csrOff[sid + 1]; li++) {
        if (!legOk[li]) continue;
        const ntkm = tkm + legKm[li];
        const ns = legAl[li];
        if (ntkm >= dist[ns]) continue;
        dist[ns] = ntkm;
        const si = P.push();
        A.tkm[si] = ntkm;
        A.sid[si] = ns;
        A.par[si] = c;
        A.leg[si] = li;
        heapPush(heap, si, ntkm);
      }
    }
  };

  engine.find = async function (o, d, mtt, escO, escD, tf, onJny) {
    const myReq = ++engine._req;
    const { osids, isDest } = resolve(o, d, escO, escD);
    const tfTable = buildTfTable(tf);
    const mttDays = ((mtt / 1440) | 0) * 1440;
    const mttRem = mtt - mttDays;
    const h = new Int32Array(maxSid).fill(I32MAX);
    {
      const heap = makeHeap(4096);
      for (let s = 0; s < maxSid; s++) {
        if (!isDest[s]) continue;
        h[s] = 0;
        heapPush(heap, s, 0);
      }
      while (heap.n) {
        const dk = heap.k1[0];
        const s = heapPop(heap);
        if (dk > h[s]) continue;
        const dc = h[s];
        for (let k = hOff[s]; k < hOff[s + 1]; k++) {
          const pk = hPack[k];
          if (!tfTable[pk & 255]) continue;
          const ps = hPs[k];
          const nd = dc + (pk >> 8);
          if (nd < h[ps]) {
            h[ps] = nd;
            heapPush(heap, ps, nd);
          }
        }
      }
    }
    const destStore = [];
    let pCap = 8192;
    let pAat = new Int32Array(pCap);
    let pSid = new Int32Array(pCap);
    let pIdt = new Int32Array(pCap);
    let pX = new Int32Array(pCap);
    let pPar = new Int32Array(pCap);
    let pLeg = new Int32Array(pCap);
    let pn = 0;
    const P = { a: { aat: pAat, par: pPar, leg: pLeg } };
    let qCap = 8192;
    let qHead = new Int32Array(qCap).fill(-1);
    let qNext = new Int32Array(pCap);
    let qn = 0;
    let curF = -1;
    function pPush() {
      if (pn === pCap) {
        pCap <<= 1;
        const grow = (arr) => {
          const na = new Int32Array(pCap);
          na.set(arr);
          return na;
        };
        pAat = grow(pAat);
        pSid = grow(pSid);
        pIdt = grow(pIdt);
        pX = grow(pX);
        pPar = grow(pPar);
        pLeg = grow(pLeg);
        P.a.aat = pAat;
        P.a.par = pPar;
        P.a.leg = pLeg;
        const nq = new Int32Array(pCap);
        nq.set(qNext);
        qNext = nq;
      }
      return pn++;
    }
    function qPush(si, f) {
      if (f >= qCap) {
        let nc = qCap;
        while (f >= nc) nc <<= 1;
        const nh = new Int32Array(nc).fill(-1);
        nh.set(qHead);
        qHead = nh;
        qCap = nc;
      }
      qNext[si] = qHead[f];
      qHead[f] = si;
      qn++;
      if (curF === -1 || f < curF) curF = f;
    }
    let popF = -1;
    let destBuf = [];
    let bufF = -1;
    let destDirty = false;
    let headPhase = true;
    function flushDest() {
      if (destBuf.length > 1) {
        destBuf.sort((m, n) => pIdt[n] - pIdt[m] || pX[m] - pX[n]);
      }
      for (const c of destBuf) {
        if (pstoreAdd(destStore, pAat[c], pIdt[c], pX[c])) {
          destDirty = true;
          onJny({
            tdur: pAat[c] - pIdt[c],
            aat: pAat[c],
            idt: pIdt[c],
            x: pX[c],
            tkm: 0,
            p: mkPath(P, c),
          });
        }
      }
      destBuf.length = 0;
      bufF = -1;
      if (destStore.length) headPhase = false;
    }
    const v = new Array(maxSid).fill(null);
    const legV = new Array(legCount).fill(null);
    const headV = new Array(legCount).fill(null);
    const cntByX = new Int32Array(1024);
    let minActiveX = 0;
    const distinctIdts = [];
    {
      const seen = new Set();
      for (const osid of osids) {
        for (let li = csrOff[osid]; li < csrOff[osid + 1]; li++) {
          if (!tfTable[legFirst[li]]) continue;
          if (h[legAl[li]] === I32MAX) continue;
          if (!seen.has(legDtr[li])) {
            seen.add(legDtr[li]);
            distinctIdts.push(legDtr[li]);
          }
        }
      }
    }
    let stopF = -1;
    let stopValid = false;
    const evicted = [];
    function tombstone(old) {
      if (pSid[old] >= 0) {
        cntByX[pX[old]]--;
        pSid[old] = -1;
      }
    }
    function legAdmit(li, nextAat, idt, newX, si) {
      if (headPhase) {
        const hv = headV[li];
        if (!hv) {
          headV[li] = [newX, nextAat, idt, si];
          return true;
        }
        if (hv[0] <= newX && hv[1] <= nextAat && hv[2] >= idt) return false;
        if (newX <= hv[0] && nextAat <= hv[1] && idt >= hv[2]) {
          tombstone(hv[3]);
          hv[0] = newX;
          hv[1] = nextAat;
          hv[2] = idt;
          hv[3] = si;
        }
        return true;
      }
      let st = legV[li];
      if (!st) {
        const hv = headV[li];
        if (hv) {
          headV[li] = null;
          st = legV[li] = new Array(hv[0] + 2);
          st[0] = hv[0] + 1;
          for (let i = 1; i <= hv[0]; i++) st[i] = 0;
          st[hv[0] + 1] = 1;
          st.push(hv[1], hv[2], hv[3]);
        } else {
          st = legV[li] = new Array(newX + 2);
          st[0] = newX + 1;
          for (let i = 1; i <= newX; i++) st[i] = 0;
          st[newX + 1] = 1;
          st.push(nextAat, idt, si);
          return true;
        }
      }
      evicted.length = 0;
      let ok = true;
      body: {
        let B = st[0];
        while (B <= newX) {
          st.splice(1 + B, 0, 0);
          B++;
        }
        st[0] = B;
        let off = 1 + B;
        for (let i = 0; i < newX; i++) {
          const cnt = st[1 + i];
          if (cnt > 0) {
            const ba0 = st[off];
            const bdN = st[off + (cnt - 1) * 3 + 1];
            if (!(ba0 > nextAat || bdN < idt)) {
              const baN = st[off + (cnt - 1) * 3];
              const bd0 = st[off + 1];
              if (baN <= nextAat || bd0 >= idt) { ok = false; break body; }
              if (cnt !== 2) {
                let lo = 1;
                let hi = cnt - 1;
                while (lo < hi) {
                  const mid = (lo + hi) >> 1;
                  if (st[off + mid * 3] <= nextAat) lo = mid + 1;
                  else hi = mid;
                }
                if (st[off + (lo - 1) * 3 + 1] >= idt) { ok = false; break body; }
              }
            }
          }
          off += cnt * 3;
        }
        const offX = off;
        const cntX = st[1 + newX];
        let off2 = offX + cntX * 3;
        for (let i = newX + 1; i < B; i++) {
          const cnt = st[1 + i];
          if (cnt === 0) continue;
          const ba0 = st[off2];
          const bdN = st[off2 + (cnt - 1) * 3 + 1];
          if (ba0 >= nextAat && bdN <= idt) {
            for (let k = 0; k < cnt; k++) evicted.push(st[off2 + k * 3 + 2]);
            st.splice(off2, cnt * 3);
            st[1 + i] = 0;
            continue;
          }
          const baN = st[off2 + (cnt - 1) * 3];
          const bd0 = st[off2 + 1];
          if (baN < nextAat || bd0 > idt) {
            off2 += cnt * 3;
            continue;
          }
          let lo = 0;
          let hi = cnt;
          while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (st[off2 + mid * 3] < nextAat) lo = mid + 1;
            else hi = mid;
          }
          let end = lo;
          while (end < cnt && st[off2 + end * 3 + 1] <= idt) end++;
          if (end > lo) {
            for (let k = lo; k < end; k++) evicted.push(st[off2 + k * 3 + 2]);
            st.splice(off2 + lo * 3, (end - lo) * 3);
            st[1 + i] = cnt - (end - lo);
            off2 += (cnt - (end - lo)) * 3;
          } else {
            off2 += cnt * 3;
          }
        }
        const n = cntX;
        if (n === 0) {
          st.splice(offX, 0, nextAat, idt, si);
          st[1 + newX] = 1;
          break body;
        }
        if (nextAat > st[offX + (n - 1) * 3]) {
          if (st[offX + (n - 1) * 3 + 1] >= idt) { ok = false; break body; }
          st.splice(offX + n * 3, 0, nextAat, idt, si);
          st[1 + newX] = n + 1;
          break body;
        }
        let lo = 0;
        let hi = n;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (st[offX + mid * 3] < nextAat) lo = mid + 1;
          else hi = mid;
        }
        if (lo < n && st[offX + lo * 3] === nextAat) {
          if (st[offX + lo * 3 + 1] >= idt) { ok = false; break body; }
        } else if (lo > 0 && st[offX + (lo - 1) * 3 + 1] >= idt) {
          ok = false; break body;
        }
        let end = lo;
        while (end < n && st[offX + end * 3 + 1] <= idt) end++;
        for (let k = lo; k < end; k++) evicted.push(st[offX + k * 3 + 2]);
        st.splice(offX + lo * 3, (end - lo) * 3, nextAat, idt, si);
        st[1 + newX] = n - (end - lo) + 1;
        break body;
      }
      for (const old of evicted) tombstone(old);
      return ok;
    }
    let curLim0 = I32MAX;
    let curLim1 = I32MAX;
    let curLim2 = I32MAX;
    function scanSeg(pFrom, pTo, extra, base, contLi, idt, newX, par) {
      for (let p = pFrom; p < pTo; p++) {
        const e = p << 2;
        const pk = edgePack[e];
        if (!tfTable[pk >>> 11]) continue;
        if (p === contLi) continue;
        const ns = edgePack[e + 1];
        if (h[ns] === I32MAX) continue;
        const nextAat = base + extra + (pk & 2047) + edgePack[e + 2];
        const nl = edgePack[e + 3];
        const hasCont =
          nl !== -1 && tfTable[legFirst[nl]] && h[legAl[nl]] !== I32MAX;
        if (destStore.length) {
          if (!hasCont && !isDest[ns]) {
            if (nextAat + mtt + h[ns] >= curLim2) continue;
          } else if (nextAat + h[ns] >= curLim1) continue;
        }
        if (!hasCont) {
          const st = v[ns];
          if (st && pstoreIsDominated(st, nextAat, idt, newX)) continue;
        }
        const si = pPush();
        if (!legAdmit(p, nextAat, idt, newX, si)) continue;
        pAat[si] = nextAat;
        pSid[si] = ns;
        pIdt[si] = idt;
        pX[si] = newX;
        pPar[si] = par;
        pLeg[si] = p;
        cntByX[newX]++;
        qPush(si, nextAat - idt + h[ns]);
      }
    }
    for (const osid of osids) {
      for (let li = csrOff[osid]; li < csrOff[osid + 1]; li++) {
        if (!tfTable[legFirst[li]]) continue;
        if (h[legAl[li]] === I32MAX) continue;
        const si = pPush();
        if (!legAdmit(li, legDtr[li] + legDur[li], legDtr[li], 0, si))
          continue;
        pAat[si] = legDtr[li] + legDur[li];
        pSid[si] = legAl[li];
        pIdt[si] = legDtr[li];
        pX[si] = 0;
        pPar[si] = -1;
        pLeg[si] = li;
        cntByX[0]++;
        qPush(si, legDur[li] + h[legAl[li]]);
      }
    }
    let i = 0;
    let lastYield = performance.now();
    while (qn) {
      let c = qHead[curF];
      while (c === -1) {
        curF++;
        c = qHead[curF];
      }
      popF = curF;
      qHead[curF] = qNext[c];
      qn--;
      if (destBuf.length && popF > bufF) flushDest();
      if (pSid[c] < 0) continue;
      const sid = pSid[c];
      pSid[c] = -2;
      cntByX[pX[c]]--;
      i++;
      if ((i & 2047) === 0) {
        const now = performance.now();
        if (now - lastYield > 15) {
          await new Promise((r) => setTimeout(r, 0));
          lastYield = performance.now();
        }
      }
      if (engine._req !== myReq) break;
      const aat = pAat[c];
      const idt = pIdt[c];
      const x = pX[c];
      if (isDest[sid]) {
        if (!destBuf.length) bufF = popF;
        destBuf.push(c);
      } else {
        curLim0 = I32MAX;
        curLim1 = I32MAX;
        curLim2 = I32MAX;
        if (destStore.length) {
          let m = I32MAX;
          const lim = x < destStore.length ? x : destStore.length - 1;
          for (let bi = 0; bi <= lim; bi++) {
            const q = bucketMinA(destStore[bi], idt);
            if (q < m) m = q;
          }
          curLim0 = m;
          const q1 = bucketMinA(destStore[x + 1], idt);
          if (q1 < m) m = q1;
          curLim1 = m;
          const q2 = bucketMinA(destStore[x + 2], idt);
          if (q2 < m) m = q2;
          curLim2 = m;
        }
        if (aat + h[sid] < curLim0) {
          const prevLeg = pLeg[c];
          const contLi = legNextLi[prevLeg];
          if (contLi !== -1 && tfTable[legFirst[contLi]]) {
            const ns = legAl[contLi];
            if (h[ns] !== I32MAX) {
              const na = aat + legContStep[prevLeg];
              const nl = legNextLi[contLi];
              const hasCont =
                nl !== -1 &&
                tfTable[legFirst[nl]] &&
                h[legAl[nl]] !== I32MAX;
              let skip = false;
              if (destStore.length) {
                if (!hasCont && !isDest[ns]) {
                  if (na + mtt + h[ns] >= curLim1) skip = true;
                } else if (na + h[ns] >= curLim0) skip = true;
              }
              if (!skip && !hasCont) {
                const st = v[ns];
                if (st && pstoreIsDominated(st, na, idt, x)) skip = true;
              }
              if (!skip) {
                const si = pPush();
                if (legAdmit(contLi, na, idt, x, si)) {
                  pAat[si] = na;
                  pSid[si] = ns;
                  pIdt[si] = idt;
                  pX[si] = x;
                  pPar[si] = c;
                  pLeg[si] = contLi;
                  cntByX[x]++;
                  qPush(si, na - idt + h[ns]);
                }
              }
            }
          }
          if (aat + mtt + h[sid] < curLim1) {
            let store = v[sid];
            if (!store) store = v[sid] = [];
            if (pstoreAdd(store, aat, idt, x)) {
              const aatMod = legArrMod[prevLeg];
              const minDep = aatMod + mttRem;
              const thr = minDep < 1440 ? minDep : minDep - 1440;
              const base =
                aat - aatMod + mttDays + (minDep < 1440 ? 0 : 1440);
              const p0 = csrOff[sid];
              const p1 = csrOff[sid + 1];
              let pA = p0;
              {
                let lo = p0;
                let hi = p1;
                while (lo < hi) {
                  const mid = (lo + hi) >> 1;
                  if ((edgePack[mid << 2] & 2047) < thr) lo = mid + 1;
                  else hi = mid;
                }
                pA = lo;
              }
              let pBEnd = pA;
              let pAEnd = p1;
              if (curLim1 < I32MAX) {
                const maxWait = curLim1 - h[sid] - (aat + mtt);
                if (maxWait < 1440) {
                  const capD = thr + maxWait;
                  if (capD <= 1440) {
                    let lo = pA;
                    let hi = p1;
                    while (lo < hi) {
                      const mid = (lo + hi) >> 1;
                      if ((edgePack[mid << 2] & 2047) < capD) lo = mid + 1;
                      else hi = mid;
                    }
                    pAEnd = lo;
                    pBEnd = p0;
                  } else {
                    let lo = p0;
                    let hi = pA;
                    while (lo < hi) {
                      const mid = (lo + hi) >> 1;
                      if ((edgePack[mid << 2] & 2047) < capD - 1440)
                        lo = mid + 1;
                      else hi = mid;
                    }
                    pBEnd = lo;
                  }
                }
              }
              scanSeg(p0, pBEnd, 1440, base, contLi, idt, x + 1, c);
              scanSeg(pA, pAEnd, 0, base, contLi, idt, x + 1, c);
            }
          }
        }
      }
      let minChanged = false;
      while (minActiveX < cntByX.length && cntByX[minActiveX] === 0) {
        minActiveX++;
        minChanged = true;
      }
      if (destDirty || minChanged) {
        destDirty = false;
        stopValid = false;
        if (destStore.length && distinctIdts.length) {
          const lim =
            minActiveX < destStore.length
              ? minActiveX
              : destStore.length - 1;
          let worst = -1;
          let okStop = true;
          for (const D of distinctIdts) {
            let minA = I32MAX;
            for (let bi = 0; bi <= lim; bi++) {
              const mA = bucketMinA(destStore[bi], D);
              if (mA < minA) minA = mA;
            }
            if (minA === I32MAX) {
              okStop = false;
              break;
            }
            const need = minA - D;
            if (need > worst) worst = need;
          }
          if (okStop) {
            stopF = worst;
            stopValid = true;
          }
        }
      }
      if (stopValid && popF >= stopF) break;
    }
    if (destBuf.length) flushDest();
  };

  return engine;
}
