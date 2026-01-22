use brotli::Decompressor;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::cmp::Ordering;
use std::collections::{BinaryHeap, HashMap, HashSet, VecDeque};
use std::io::prelude::*;
use std::rc::Rc;
use wasm_bindgen::prelude::*;

use js_sys::Promise;
use wasm_bindgen_futures::JsFuture;
use web_sys::{window, WorkerGlobalScope};

#[derive(Serialize, Deserialize, Clone)]
#[allow(dead_code)]
struct RawStop {
    n: String,
    a: i32,
    d: i32,
    km: i32,
}

#[derive(Serialize, Deserialize, Clone)]
#[allow(dead_code)]
struct RawTrain {
    tn: String,
    s: Vec<RawStop>,
}

#[derive(Deserialize)]
struct RawRdat {
    t: Vec<RawTrain>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RawScStation {
    pub n: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RawScGroup {
    pub s: Vec<RawScStation>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RawScdat {
    pub g: Vec<RawScGroup>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RawRtsStation {
    pub n: String,
    pub d: i32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RawRtsLine {
    pub i: i32,
    pub n: String,
    pub s: Vec<RawRtsStation>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RawRtsRouteNode {
    pub n: String,
    pub l: i32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RawRtsRoute {
    pub c: String,
    pub s: Vec<RawRtsRouteNode>,
    pub e: String,
}

#[derive(Deserialize, Serialize, Clone)]
pub struct RawRts {
    pub l: Vec<RawRtsLine>,
    pub r: Vec<RawRtsRoute>,
}

#[derive(Debug, Clone, Serialize)]
pub struct StD {
    pub n: String,
    pub lat: f64,
    pub lon: f64,
    pub rn: Vec<String>,
    pub st: bool,
    pub a: i32,
    pub d: i32,
    pub ln: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct R {
    pub tn: String,
    #[serde(serialize_with = "ser_sid")]
    pub bs: usize,
    #[serde(serialize_with = "ser_sid")]
    pub al: usize,
    pub dtr: i32,
    pub dur: i32,
    pub km: i32,
    pub leg_id: u32,
    pub next_leg_id: Option<u32>,
}

fn ser_sid<S>(sid: &usize, ser: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    let sname = g_sname(*sid).unwrap_or_else(|| format!("S_{}", sid));
    ser.serialize_str(&sname)
}

#[derive(Debug, Clone, Serialize)]
pub struct PS {
    pub wtb: i32,
    pub r: R,
}

#[derive(Debug, Clone, Serialize)]
pub struct Jny {
    pub tdur: i32,
    pub aat: i32,
    pub idt: i32,
    pub x: i32,
    pub tkm: i32,
    pub p: Vec<PS>,
}

thread_local! {
    static DAT: RefCell<Option<Rc<Vec<Vec<Rc<R>>>>>> = RefCell::new(None);
    static SCD: RefCell<Option<HashMap<usize, Vec<usize>>>> = RefCell::new(None);
    static S2I: RefCell<Option<HashMap<String, usize>>> = RefCell::new(None);
    static I2S: RefCell<Option<Vec<String>>> = RefCell::new(None);
    static LOCATIONS: RefCell<Option<HashMap<String, SL>>> = RefCell::new(None);
    static RDAT_MAP: RefCell<Option<HashMap<String, RawTrain>>> = RefCell::new(None);

    static RAW_RDAT: RefCell<Option<Vec<RawTrain>>> = RefCell::new(None);
    static RAW_SCDAT: RefCell<Option<RawScdat>> = RefCell::new(None);
    static RAW_RTS: RefCell<Option<RawRts>> = RefCell::new(None);

    static RTS_ROUTE_MAP: RefCell<Option<HashMap<String, RawRtsRoute>>> = RefCell::new(None);
    static RTS_LINE_MAP: RefCell<Option<HashMap<i32, RawRtsLine>>> = RefCell::new(None);

    static REQ_ID: RefCell<u32> = RefCell::new(0);
    static MLID: RefCell<u32> = RefCell::new(0);
    static MSID: RefCell<usize> = RefCell::new(0);
}

#[derive(Debug, Clone)]
struct St {
    tdur: i32,
    aat: i32,
    sid: usize,
    idt: i32,
    x: i32,
    p: Option<Rc<St>>,
    r: Option<Rc<R>>,
}
impl PartialEq for St {
    fn eq(&self, o: &Self) -> bool {
        self.tdur == o.tdur
    }
}
impl Eq for St {}
impl PartialOrd for St {
    fn partial_cmp(&self, o: &Self) -> Option<Ordering> {
        Some(self.cmp(o))
    }
}
impl Ord for St {
    fn cmp(&self, o: &Self) -> Ordering {
        o.tdur.cmp(&self.tdur).then_with(|| self.idt.cmp(&o.idt))
    }
}
impl Drop for St {
    fn drop(&mut self) {
        let mut curr = self.p.take();
        while let Some(node) = curr {
            if let Ok(mut inner) = Rc::try_unwrap(node) {
                curr = inner.p.take();
            } else {
                break;
            }
        }
    }
}

#[derive(Debug, Clone)]
struct StK {
    tkm: i32,
    sid: usize,
    p: Option<Rc<StK>>,
    r: Option<Rc<R>>,
}
impl PartialEq for StK {
    fn eq(&self, o: &Self) -> bool {
        self.tkm == o.tkm
    }
}
impl Eq for StK {}
impl PartialOrd for StK {
    fn partial_cmp(&self, o: &Self) -> Option<Ordering> {
        Some(self.cmp(o))
    }
}
impl Ord for StK {
    fn cmp(&self, o: &Self) -> Ordering {
        o.tkm.cmp(&self.tkm)
    }
}
impl Drop for StK {
    fn drop(&mut self) {
        let mut curr = self.p.take();
        while let Some(node) = curr {
            if let Ok(mut inner) = Rc::try_unwrap(node) {
                curr = inner.p.take();
            } else {
                break;
            }
        }
    }
}
#[derive(Debug, Clone)]
struct StMx {
    tdur: i32,
    aat: i32,
    sid: usize,
    idt: i32,
    x: i32,
    p: Option<Rc<StMx>>,
    r: Option<Rc<R>>,
}
impl Drop for StMx {
    fn drop(&mut self) {
        let mut curr = self.p.take();
        while let Some(node) = curr {
            if let Ok(mut inner) = Rc::try_unwrap(node) {
                curr = inner.p.take();
            } else {
                break;
            }
        }
    }
}

const RDAT_JSON_BR: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/rdat.json.br"));
const SCDAT_JSON_BR: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/scdat.json.br"));
const SL_JSON_BR: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/sl.json.br"));
const RTS_JSON_BR: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/rts.json.br"));

#[wasm_bindgen(js_name = init)]
pub fn init() -> Result<(), JsValue> {
    let decompress = |bytes: &[u8]| -> Result<String, JsValue> {
        let mut decompressed = Vec::new();
        let mut decompressor = Decompressor::new(bytes, 4096);
        decompressor
            .read_to_end(&mut decompressed)
            .map_err(|e| JsValue::from_str(&format!("Brotli decompression error: {}", e)))?;
        String::from_utf8(decompressed)
            .map_err(|e| JsValue::from_str(&format!("UTF-8 conversion error: {}", e)))
    };

    let mut rdat_json = decompress(RDAT_JSON_BR)?;
    let mut scdat_json = decompress(SCDAT_JSON_BR)?;
    let mut sl_json = decompress(SL_JSON_BR)?;
    let mut rts_json = decompress(RTS_JSON_BR)?;

    let rdat_root: RawRdat = unsafe { simd_json::from_str(&mut rdat_json) }
        .map_err(|e| JsValue::from_str(&format!("Failed to parse rdat.json: {}", e)))?;
    let scdat_root: RawScdat = unsafe { simd_json::from_str(&mut scdat_json) }
        .map_err(|e| JsValue::from_str(&format!("Failed to parse scdat.json: {}", e)))?;
    let rts_root: RawRts = unsafe { simd_json::from_str(&mut rts_json) }
        .map_err(|e| JsValue::from_str(&format!("Failed to parse rts.json: {}", e)))?;
    let locations: HashMap<String, SL> = unsafe { simd_json::from_str(&mut sl_json) }
        .map_err(|e| JsValue::from_str(&format!("Failed to parse sl.json: {}", e)))?;

    let mut rts_route_map = HashMap::new();
    for r in &rts_root.r {
        rts_route_map.insert(r.c.clone(), r.clone());
    }

    let mut rts_line_map = HashMap::new();
    for l in &rts_root.l {
        rts_line_map.insert(l.i, l.clone());
    }

    RAW_RDAT.with(|cell| *cell.borrow_mut() = Some(rdat_root.t.clone()));
    RAW_SCDAT.with(|cell| *cell.borrow_mut() = Some(scdat_root.clone()));
    RAW_RTS.with(|cell| *cell.borrow_mut() = Some(rts_root));
    RTS_ROUTE_MAP.with(|cell| *cell.borrow_mut() = Some(rts_route_map));
    RTS_LINE_MAP.with(|cell| *cell.borrow_mut() = Some(rts_line_map));

    let mut s2i: HashMap<String, usize> = HashMap::new();
    let mut i2s: Vec<String> = Vec::new();
    let get_sid = |name: &str, s2i: &mut HashMap<String, usize>, i2s: &mut Vec<String>| -> usize {
        *s2i.entry(name.to_string()).or_insert_with(|| {
            let id = i2s.len();
            i2s.push(name.to_string());
            id
        })
    };

    let mut temp_dat: HashMap<usize, Vec<Rc<R>>> = HashMap::with_capacity(500000);
    let mut global_leg_id_counter: u32 = 0;

    for train in &rdat_root.t {
        for i in 0..(train.s.len().saturating_sub(1)) {
            let b = &train.s[i];
            let a = &train.s[i + 1];
            let current_leg_id = global_leg_id_counter;
            let next_leg_id = if i + 1 < train.s.len() - 1 {
                Some(global_leg_id_counter + 1)
            } else {
                None
            };
            global_leg_id_counter += 1;

            if b.d != -1 && a.a != -1 && a.a > b.d && a.km > b.km {
                let b_sid = get_sid(&b.n, &mut s2i, &mut i2s);
                let a_sid = get_sid(&a.n, &mut s2i, &mut i2s);
                temp_dat.entry(b_sid).or_default().push(Rc::new(R {
                    tn: train.tn.clone(),
                    bs: b_sid,
                    al: a_sid,
                    dtr: b.d,
                    dur: a.a - b.d,
                    km: a.km - b.km,
                    leg_id: current_leg_id,
                    next_leg_id,
                }));
            }
        }
    }

    let max_sid = i2s.len();
    let mut dat: Vec<Vec<Rc<R>>> = vec![Vec::new(); max_sid];
    for (sid, routes) in temp_dat {
        dat[sid] = routes;
    }

    let mut scd: HashMap<usize, Vec<usize>> = HashMap::with_capacity(5000);
    for group in &scdat_root.g {
        let sids: Vec<usize> = group
            .s
            .iter()
            .map(|s| get_sid(&s.n, &mut s2i, &mut i2s))
            .collect();
        if sids.len() > 1 {
            for &id in &sids {
                scd.insert(id, sids.clone());
            }
        }
    }

    let rdat_map: HashMap<String, RawTrain> =
        rdat_root.t.into_iter().map(|t| (t.tn.clone(), t)).collect();

    DAT.with(|cell| *cell.borrow_mut() = Some(Rc::new(dat)));
    SCD.with(|cell| *cell.borrow_mut() = Some(scd));
    S2I.with(|cell| *cell.borrow_mut() = Some(s2i));
    I2S.with(|cell| *cell.borrow_mut() = Some(i2s));
    LOCATIONS.with(|cell| *cell.borrow_mut() = Some(locations));
    RDAT_MAP.with(|cell| *cell.borrow_mut() = Some(rdat_map));
    MLID.with(|cell| *cell.borrow_mut() = global_leg_id_counter);
    MSID.with(|cell| *cell.borrow_mut() = max_sid);

    Ok(())
}

#[wasm_bindgen(js_name = qry_rdat)]
pub fn query_raw_rdat() -> Result<String, JsValue> {
    RAW_RDAT.with(|cell| {
        if let Some(rdat) = cell.borrow().as_ref() {
            serde_json::to_string(rdat)
                .map_err(|e| JsValue::from_str(&format!("Failed to serialize rdat: {}", e)))
        } else {
            Err(JsValue::from_str("rdat not initialized"))
        }
    })
}

#[wasm_bindgen(js_name = qry_scdat)]
pub fn query_raw_scdat() -> Result<String, JsValue> {
    RAW_SCDAT.with(|cell| {
        if let Some(scdat) = cell.borrow().as_ref() {
            serde_json::to_string(scdat)
                .map_err(|e| JsValue::from_str(&format!("Failed to serialize scdat: {}", e)))
        } else {
            Err(JsValue::from_str("scdat not initialized"))
        }
    })
}

#[wasm_bindgen(js_name = qrr)]
pub fn qrr() -> Result<String, JsValue> {
    RAW_RTS.with(|cell| {
        if let Some(rts) = cell.borrow().as_ref() {
            serde_json::to_string(rts)
                .map_err(|e| JsValue::from_str(&format!("Failed to serialize rts: {}", e)))
        } else {
            Err(JsValue::from_str("rts not initialized"))
        }
    })
}

#[wasm_bindgen]
pub fn stop() {
    REQ_ID.with(|s| {
        *s.borrow_mut() += 1;
    });
}
fn check_req_id(id: u32) -> bool {
    REQ_ID.with(|s| *s.borrow() == id)
}
fn build_tf_table(tf: &str) -> [bool; 256] {
    let mut table = [false; 256];
    if tf.is_empty() {
        for i in 0..256 {
            table[i] = true;
        }
        return table;
    }
    for b in tf.bytes() {
        if b == b'N' {
            for dig in b'0'..=b'9' {
                table[dig as usize] = true;
            }
        } else {
            table[b as usize] = true;
        }
    }
    table
}
fn g_sid(s: &str) -> Option<usize> {
    S2I.with(|d| d.borrow().as_ref()?.get(s).copied())
}
fn g_sname(id: usize) -> Option<String> {
    I2S.with(|d| d.borrow().as_ref()?.get(id).cloned())
}
fn g_sgrp(id: usize) -> Vec<usize> {
    SCD.with(|d| {
        d.borrow()
            .as_ref()
            .and_then(|scd| scd.get(&id).cloned())
            .unwrap_or_else(|| vec![id])
    })
}
fn g_location(name: &str) -> Option<SL> {
    LOCATIONS.with(|d| d.borrow().as_ref()?.get(name).cloned())
}
fn cwait(arr: i32, dep: i32) -> i32 {
    if arr <= dep {
        dep - arr
    } else {
        1440 - arr + dep
    }
}
fn mk_p_base<StLike, F>(st: &StLike, extractor: F) -> Vec<PS>
where
    StLike: Clone,
    F: Fn(&StLike) -> (Option<Rc<StLike>>, Option<Rc<R>>, i32),
{
    let mut segs: Vec<(Rc<StLike>, Rc<R>)> = Vec::new();
    let mut cur = Some(Rc::new(st.clone()));
    while let Some(c) = cur {
        let (p, r_opt, _) = extractor(&c);
        if let Some(r) = r_opt {
            segs.push((Rc::clone(&c), r));
        }
        cur = p;
    }
    segs.reverse();
    if segs.is_empty() {
        return Vec::new();
    }
    let mut p: Vec<PS> = Vec::new();
    let mut seg_iter = segs.into_iter();
    let (mut lc, first_r) = seg_iter.next().unwrap();
    let mut mr = first_r.as_ref().clone();
    let (_, _, first_aat) = extractor(&lc);
    let mut fdt = first_aat - mr.dur;
    let mut wtb = if let Some(p_ctx) = extractor(&lc).0 {
        fdt - extractor(&p_ctx).2
    } else {
        0
    };
    for (c, r_rc) in seg_iter {
        let r = &*r_rc;
        if mr.next_leg_id == Some(r.leg_id) {
            mr.al = r.al;
            mr.km += r.km;
            mr.next_leg_id = r.next_leg_id;
            lc = c;
        } else {
            let final_aat = extractor(&lc).2;
            mr.dur = final_aat - fdt;
            p.push(PS { wtb, r: mr });
            let (_, _, cur_aat) = extractor(&c);
            fdt = cur_aat - r.dur;
            wtb = if let Some(p_ctx) = extractor(&c).0 {
                fdt - extractor(&p_ctx).2
            } else {
                0
            };
            mr = r.clone();
            lc = c;
        }
    }
    let final_aat = extractor(&lc).2;
    mr.dur = final_aat - fdt;
    p.push(PS { wtb, r: mr });
    p
}
fn mk_path(st: &St) -> Vec<PS> {
    mk_p_base(st, |s| (s.p.clone(), s.r.clone(), s.aat))
}
fn mk_path_k(st: &StK) -> Vec<PS> {
    let mut segs = Vec::new();
    let mut cur = Some(Rc::new(st.clone()));
    while let Some(c) = cur {
        if let Some(ref r) = c.r {
            segs.push(PS {
                wtb: 0,
                r: r.as_ref().clone(),
            });
        }
        cur = c.p.clone();
    }
    segs.reverse();
    segs
}

#[wasm_bindgen]
pub fn g_stns() -> Result<Vec<String>, JsValue> {
    I2S.with(|d| {
        d.borrow()
            .as_ref()
            .cloned()
            .ok_or_else(|| JsValue::from_str("data not loaded"))
    })
}

#[derive(Debug, Clone, Deserialize)]
pub struct RawStation {
    pub n: String,
    pub lat: f64,
    pub lon: f64,
}
#[derive(Debug, Clone, Deserialize)]
pub struct RawStationGroup {
    pub s: Vec<RawStation>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Stl {
    pub n: String,
    pub lat: f64,
    pub lon: f64,
    pub rn: Vec<String>,
}
#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct SL {
    pub lat: Option<f64>,
    pub lon: Option<f64>,
    pub rn: Option<Vec<String>>,
}

#[wasm_bindgen]
pub fn gts(tn: &str, dtr: i32, atr: i32) -> Result<JsValue, JsValue> {
    let result = RDAT_MAP.with(|map_cell| {
        let map_opt = map_cell.borrow();
        let rdat_map = map_opt.as_ref().ok_or("Error: RDAT_MAP not initialized")?;
        let rt = rdat_map
            .get(tn)
            .ok_or_else(|| format!("Train '{}' not found", tn))?;
        let start_idx =
            rt.s.iter()
                .position(|s| s.d == dtr)
                .ok_or_else(|| format!("Start point with dtr '{}' not found", dtr))?;
        let search_slice = rt.s.get(start_idx..).unwrap_or(&[]);
        let relative_end_idx = search_slice.iter().position(|s| s.a == atr);
        if let Some(rel_idx) = relative_end_idx {
            let end_idx = start_idx + rel_idx;
            let seg = &rt.s[start_idx..=end_idx];
            let stops: Vec<Stl> = seg
                .iter()
                .map(|s| {
                    let loc = g_location(&s.n).unwrap_or(SL {
                        lat: None,
                        lon: None,
                        rn: None,
                    });
                    Stl {
                        n: s.n.clone(),
                        lat: loc.lat.unwrap_or(0.0),
                        lon: loc.lon.unwrap_or(0.0),
                        rn: loc.rn.unwrap_or_default(),
                    }
                })
                .collect();
            serde_json::to_string(&stops).map_err(|e| format!("Serialization error: {}", e))
        } else {
            Err(format!(
                "End point with atr '{}' not found after start point with dtr '{}'",
                atr, dtr
            ))
        }
    });
    match result {
        Ok(json_string) => Ok(JsValue::from_str(&json_string)),
        Err(e) => Err(JsValue::from_str(&e.to_string())),
    }
}

#[wasm_bindgen]
pub fn gfd(tn: &str) -> Result<JsValue, JsValue> {
    let rdat_map_opt = RDAT_MAP.with(|c| c.borrow().clone());
    let rdat_map = rdat_map_opt.ok_or("rdat!init")?;
    let train_sched = match rdat_map.get(tn) {
        Some(s) => s,
        None => return Err(JsValue::from_str("tn!fnd")),
    };

    let mut stops_map: HashMap<String, (i32, i32)> = HashMap::new();
    for s in &train_sched.s {
        stops_map.insert(s.n.clone(), (s.a, s.d));
    }

    let route_opt = RTS_ROUTE_MAP.with(|c| c.borrow().clone());
    let rts_routes = route_opt.ok_or("rts!init")?;

    let route = match rts_routes.get(tn) {
        Some(r) => r,
        None => return Err(JsValue::from_str("no_route_data")),
    };

    let line_map_opt = RTS_LINE_MAP.with(|c| c.borrow().clone());
    let lines = line_map_opt.ok_or("ln!init")?;

    let mut full_path: Vec<StD> = Vec::new();
    let mut last_station_name = String::new();

    for i in 0..route.s.len() {
        let node = &route.s[i];
        let from_station = &node.n;
        let line_id = node.l;

        let to_station = if i < route.s.len() - 1 {
            &route.s[i + 1].n
        } else {
            &route.e
        };

        let line = match lines.get(&line_id) {
            Some(l) => l,
            None => continue,
        };

        let idx_a = line.s.iter().position(|s| s.n == *from_station);
        let idx_b = line.s.iter().position(|s| s.n == *to_station);

        if let (Some(start), Some(end)) = (idx_a, idx_b) {
            let segment: Vec<&RawRtsStation> = if start <= end {
                line.s[start..=end].iter().collect()
            } else {
                line.s[end..=start].iter().rev().collect()
            };

            for raw_st in segment {
                if raw_st.n == last_station_name {
                    if let Some(last) = full_path.last_mut() {
                        if !last.rn.contains(&line.n) {
                            last.ln = format!("{}/{}", last.ln, line.n);
                            last.rn.push(line.n.clone());
                        }
                    }
                    continue;
                }

                let is_stop = stops_map.contains_key(&raw_st.n);
                let (arr, dep) = stops_map.get(&raw_st.n).unwrap_or(&(-1, -1));

                let loc = g_location(&raw_st.n).unwrap_or(SL {
                    lat: None,
                    lon: None,
                    rn: None,
                });

                full_path.push(StD {
                    n: raw_st.n.clone(),
                    lat: loc.lat.unwrap_or(0.0),
                    lon: loc.lon.unwrap_or(0.0),
                    rn: vec![line.n.clone()],
                    st: is_stop,
                    a: *arr,
                    d: *dep,
                    ln: line.n.clone(),
                });
                last_station_name = raw_st.n.clone();
            }
        }
    }

    serde_json::to_string(&full_path)
        .map_err(|e| JsValue::from_str(&e.to_string()))
        .map(JsValue::from)
}
#[wasm_bindgen]
extern "C" {
    fn on_jny(j: &str);
}

fn g_perf() -> Option<web_sys::Performance> {
    let g = js_sys::global();
    if let Ok(wscope) = g.dyn_into::<WorkerGlobalScope>() {
        wscope.performance()
    } else if let Some(win) = window() {
        win.performance()
    } else {
        None
    }
}

async fn sleep(ms: i32) -> Result<(), JsValue> {
    let p = Promise::new(&mut |resolve, _| {
        let g = js_sys::global();
        if let Ok(wscope) = g.dyn_into::<WorkerGlobalScope>() {
            wscope
                .set_timeout_with_callback_and_timeout_and_arguments_0(&resolve, ms)
                .unwrap();
        } else if let Some(win) = window() {
            win.set_timeout_with_callback_and_timeout_and_arguments_0(&resolve, ms)
                .unwrap();
        }
    });
    JsFuture::from(p).await?;
    Ok(())
}

#[derive(Clone)]
struct PStore {
    b: Vec<Vec<(i32, i32)>>,
}
impl PStore {
    fn new() -> Self {
        Self { b: Vec::new() }
    }
    fn add(&mut self, a: i32, d: i32, x: i32) -> bool {
        let xi = x as usize;
        if xi >= self.b.len() {
            self.b.resize(xi + 1, Vec::new());
        }
        for i in 0..=xi {
            if i < self.b.len() {
                for &(pa, pd) in &self.b[i] {
                    if pa <= a && pd >= d {
                        return false;
                    }
                }
            }
        }
        for i in xi..self.b.len() {
            self.b[i].retain(|&(pa, pd)| !(pa >= a && pd <= d));
        }
        self.b[xi].push((a, d));
        true
    }
}

#[wasm_bindgen]
pub async fn find(
    o: &str,
    d: &str,
    mtt: i32,
    esc_o: bool,
    esc_d: bool,
    tf: &str,
) -> Result<(), JsValue> {
    let my_id = REQ_ID.with(|r| {
        let mut m = r.borrow_mut();
        *m += 1;
        *m
    });
    let rfs_rc = DAT
        .with(|dat| dat.borrow().clone())
        .ok_or_else(|| JsValue::from_str("dat not initd"))?;
    let rfs = rfs_rc.as_ref();
    let oid = g_sid(o).ok_or_else(|| JsValue::from_str(&format!("'{}' not found", o)))?;
    let did = g_sid(d).ok_or_else(|| JsValue::from_str(&format!("'{}' not found", d)))?;
    let osids = if esc_o { g_sgrp(oid) } else { vec![oid] };
    let dset: HashSet<usize> = if esc_d {
        g_sgrp(did).into_iter().collect()
    } else {
        [did].into_iter().collect()
    };
    let tf_table = build_tf_table(tf);
    let perf = g_perf().ok_or_else(|| JsValue::from_str("Perf !found"))?;
    let mut ly_time = perf.now();
    let mut pq = BinaryHeap::with_capacity(50000);
    let mut v: Vec<Option<PStore>> = Vec::new();
    for &osid in &osids {
        if osid < rfs.len() {
            let rs = &rfs[osid];
            for r in rs {
                if r.tn.is_empty() || !tf_table[r.tn.as_bytes()[0] as usize] {
                    continue;
                }
                if let Some(aat) = r.dtr.checked_add(r.dur) {
                    pq.push(St {
                        tdur: r.dur,
                        aat,
                        sid: r.al,
                        idt: r.dtr,
                        x: 0,
                        p: None,
                        r: Some(r.clone()),
                    });
                }
            }
        }
    }
    let mut i = 0;
    while let Some(c) = pq.pop() {
        i += 1;
        if i & 2047 == 0 {
            let now = perf.now();
            if now - ly_time > 15.0 {
                sleep(0).await?;
                ly_time = perf.now();
            }
        }
        if !check_req_id(my_id) {
            break;
        }
        if dset.contains(&c.sid) {
            let p = mk_path(&c);
            let jny = Jny {
                tdur: c.tdur,
                aat: c.aat,
                idt: c.idt,
                x: c.x,
                tkm: 0,
                p,
            };
            if let Ok(j) = serde_json::to_string(&jny) {
                on_jny(&j);
            }
            continue;
        }
        if c.sid >= v.len() {
            v.resize(c.sid + 1, None);
        }
        let s = v[c.sid].get_or_insert_with(PStore::new);
        if !s.add(c.aat, c.idt, c.x) {
            continue;
        }
        if c.sid < rfs.len() {
            let next_rs = &rfs[c.sid];
            for next_r in next_rs {
                if !check_req_id(my_id) {
                    break;
                }
                if next_r.tn.is_empty() || !tf_table[next_r.tn.as_bytes()[0] as usize] {
                    continue;
                }
                let is_cont = if let Some(ref prev_r) = c.r {
                    prev_r.next_leg_id == Some(next_r.leg_id)
                } else {
                    false
                };
                let mut wait = cwait(c.aat % 1440, next_r.dtr % 1440);
                if !is_cont {
                    while wait < mtt {
                        wait = wait.saturating_add(1440);
                    }
                }
                if wait == i32::MAX {
                    continue;
                };
                let next_aat = match c
                    .aat
                    .checked_add(wait)
                    .and_then(|val| val.checked_add(next_r.dur))
                {
                    Some(val) => val,
                    None => continue,
                };
                let new_tdur = match next_aat.checked_sub(c.idt) {
                    Some(val) => val,
                    None => continue,
                };
                let new_x = if is_cont { c.x } else { c.x + 1 };
                pq.push(St {
                    tdur: new_tdur,
                    aat: next_aat,
                    sid: next_r.al,
                    idt: c.idt,
                    x: new_x,
                    p: Some(Rc::new(c.clone())),
                    r: Some(next_r.clone()),
                });
            }
        }
    }
    Ok(())
}
fn mk_path_mx(st: &StMx) -> Vec<PS> {
    mk_p_base(st, |s| (s.p.clone(), s.r.clone(), s.aat))
}
#[wasm_bindgen(js_name = find_mx)]
pub async fn find_mx(
    o: &str,
    d: &str,
    mtt: i32,
    esc_o: bool,
    esc_d: bool,
    tf: &str,
) -> Result<(), JsValue> {
    let my_id = REQ_ID.with(|r| {
        let mut m = r.borrow_mut();
        *m += 1;
        *m
    });
    let rfs_rc = DAT
        .with(|dat| dat.borrow().clone())
        .ok_or_else(|| JsValue::from_str("dat not initd"))?;
    let rfs = rfs_rc.as_ref();
    let oid = g_sid(o).ok_or_else(|| JsValue::from_str(&format!("'{}' not found", o)))?;
    let did = g_sid(d).ok_or_else(|| JsValue::from_str(&format!("'{}' not found", d)))?;
    let osids = if esc_o { g_sgrp(oid) } else { vec![oid] };
    let dset: HashSet<usize> = if esc_d {
        g_sgrp(did).into_iter().collect()
    } else {
        [did].into_iter().collect()
    };
    let tf_table = build_tf_table(tf);
    let perf = g_perf().ok_or_else(|| JsValue::from_str("Perf !found"))?;
    let mut ly_time = perf.now();
    let mut q = VecDeque::with_capacity(50000);
    let max_leg_id = MLID.with(|cell| *cell.borrow());
    let mut visited: Vec<i32> = vec![i32::MAX; max_leg_id as usize + 1];
    for &osid in &osids {
        if osid < rfs.len() {
            let rs = &rfs[osid];
            for r in rs {
                if r.tn.is_empty() || !tf_table[r.tn.as_bytes()[0] as usize] {
                    continue;
                }
                if let Some(aat) = r.dtr.checked_add(r.dur) {
                    q.push_back(StMx {
                        tdur: r.dur,
                        aat,
                        sid: r.al,
                        idt: r.dtr,
                        x: 0,
                        p: None,
                        r: Some(r.clone()),
                    });
                }
            }
        }
    }
    let mut min_found_x = i32::MAX;
    let mut i = 0;
    while let Some(c_val) = q.pop_front() {
        i += 1;
        if i & 2047 == 0 {
            let now = perf.now();
            if now - ly_time > 15.0 {
                sleep(0).await?;
                ly_time = perf.now();
            }
        }
        if !check_req_id(my_id) {
            break;
        }
        let c = Rc::new(c_val);
        if c.x > min_found_x {
            continue;
        }
        if let Some(r) = &c.r {
            let leg = r.leg_id as usize;
            if visited[leg] <= c.x {
                continue;
            }
            visited[leg] = c.x;
        }
        if dset.contains(&c.sid) {
            min_found_x = c.x;
            let p = mk_path_mx(&c);
            let jny = Jny {
                tdur: c.tdur,
                aat: c.aat,
                idt: c.idt,
                x: c.x,
                tkm: 0,
                p,
            };
            if let Ok(j) = serde_json::to_string(&jny) {
                on_jny(&j);
            }
            continue;
        }
        if c.sid < rfs.len() {
            let next_rs = &rfs[c.sid];
            for next_r in next_rs {
                if !check_req_id(my_id) {
                    break;
                }
                if next_r.tn.is_empty() || !tf_table[next_r.tn.as_bytes()[0] as usize] {
                    continue;
                }
                let is_cont = if let Some(ref prev_r) = c.r {
                    prev_r.next_leg_id == Some(next_r.leg_id)
                } else {
                    false
                };
                let new_x = if is_cont { c.x } else { c.x + 1 };
                if new_x > min_found_x {
                    continue;
                }
                let mut wait = cwait(c.aat % 1440, next_r.dtr % 1440);
                if !is_cont {
                    while wait < mtt {
                        wait = wait.saturating_add(1440);
                    }
                }
                if wait == i32::MAX {
                    continue;
                };
                let next_aat = match c
                    .aat
                    .checked_add(wait)
                    .and_then(|val| val.checked_add(next_r.dur))
                {
                    Some(val) => val,
                    None => continue,
                };
                let new_tdur = match next_aat.checked_sub(c.idt) {
                    Some(val) => val,
                    None => continue,
                };
                let new_state = StMx {
                    tdur: new_tdur,
                    aat: next_aat,
                    sid: next_r.al,
                    idt: c.idt,
                    x: new_x,
                    p: Some(Rc::clone(&c)),
                    r: Some(next_r.clone()),
                };
                if is_cont {
                    q.push_front(new_state);
                } else {
                    q.push_back(new_state);
                }
            }
        }
    }
    Ok(())
}
#[wasm_bindgen(js_name = find_k)]
pub async fn find_k(o: &str, d: &str, esc_o: bool, esc_d: bool, tf: &str) -> Result<(), JsValue> {
    let my_id = REQ_ID.with(|r| {
        let mut m = r.borrow_mut();
        *m += 1;
        *m
    });
    let rfs_rc = DAT
        .with(|dat| dat.borrow().clone())
        .ok_or("dat not initd")?;
    let rfs = rfs_rc.as_ref();
    let oid = g_sid(o).ok_or_else(|| JsValue::from_str(&format!("'{}' not found", o)))?;
    let did = g_sid(d).ok_or_else(|| JsValue::from_str(&format!("'{}' not found", d)))?;
    let osids = if esc_o { g_sgrp(oid) } else { vec![oid] };
    let dset: HashSet<usize> = if esc_d {
        g_sgrp(did).into_iter().collect()
    } else {
        [did].into_iter().collect()
    };
    let tf_table = build_tf_table(tf);
    let perf = g_perf().ok_or_else(|| JsValue::from_str("Perf !found"))?;
    let mut ly_time = perf.now();
    let mut pq = BinaryHeap::with_capacity(4000000);
    let max_sid = MSID.with(|cell| *cell.borrow());
    let mut v: Vec<i32> = vec![i32::MAX; max_sid];
    for &osid in &osids {
        if osid < rfs.len() {
            let rs = &rfs[osid];
            for r in rs {
                if r.tn.is_empty() || !tf_table[r.tn.as_bytes()[0] as usize] {
                    continue;
                }
                pq.push(StK {
                    tkm: r.km,
                    sid: r.al,
                    p: None,
                    r: Some(r.clone()),
                });
            }
        }
    }
    let mut i = 0;
    while let Some(c) = pq.pop() {
        i += 1;
        if i & 2047 == 0 {
            let now = perf.now();
            if now - ly_time > 15.0 {
                sleep(0).await?;
                ly_time = perf.now();
            }
        }
        if !check_req_id(my_id) {
            break;
        }
        if v[c.sid] <= c.tkm {
            continue;
        }
        v[c.sid] = c.tkm;
        if dset.contains(&c.sid) {
            let p = mk_path_k(&c);
            let jny = Jny {
                tdur: 0,
                aat: 0,
                idt: 0,
                x: p.len() as i32 - 1,
                tkm: c.tkm,
                p,
            };
            if let Ok(j) = serde_json::to_string(&jny) {
                on_jny(&j);
            }
            continue;
        }
        if c.sid < rfs.len() {
            let next_rs = &rfs[c.sid];
            for next_r in next_rs {
                if !check_req_id(my_id) {
                    break;
                }
                if next_r.tn.is_empty() || !tf_table[next_r.tn.as_bytes()[0] as usize] {
                    continue;
                }
                let new_tkm = c.tkm + next_r.km;
                pq.push(StK {
                    tkm: new_tkm,
                    sid: next_r.al,
                    p: Some(Rc::new(c.clone())),
                    r: Some(next_r.clone()),
                });
            }
        }
    }
    Ok(())
}
