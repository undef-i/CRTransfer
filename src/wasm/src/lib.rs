use flate2::read::GzDecoder;
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

#[derive(Deserialize)]
struct RawTrain {
    tn: String,
    s: Vec<RawStop>,
}

#[derive(Deserialize, Clone)]
#[allow(dead_code)]
struct RawStop {
    n: String,
    a: i32,
    d: i32,
}

#[derive(Deserialize)]
struct RawRdat {
    t: Vec<RawTrain>,
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

#[derive(Deserialize)]
struct PData {
    dat: HashMap<usize, Vec<R>>,
    scd: HashMap<usize, Vec<usize>>,
    s2i: HashMap<String, usize>,
    i2s: Vec<String>,
    locations: HashMap<String, SL>,
}

thread_local! {
    static DAT: RefCell<Option<HashMap<usize, Vec<R>>>> = RefCell::new(None);
    static SCD: RefCell<Option<HashMap<usize, Vec<usize>>>> = RefCell::new(None);
    static S2I: RefCell<Option<HashMap<String, usize>>> = RefCell::new(None);
    static I2S: RefCell<Option<Vec<String>>> = RefCell::new(None);
    static LOCATIONS: RefCell<Option<HashMap<String, SL>>> = RefCell::new(None);
    static RDAT_MAP: RefCell<Option<HashMap<String, RawTrain>>> = RefCell::new(None);
    static STOP: RefCell<bool> = RefCell::new(false);
}

#[derive(Debug, Clone)]
struct St {
    tdur: i32,
    aat: i32,
    sid: usize,
    idt: i32,
    x: i32,
    p: Option<Rc<St>>,
    r: Option<R>,
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

#[derive(Debug, Clone)]
struct StK {
    tkm: i32,
    sid: usize,
    p: Option<Rc<StK>>,
    r: Option<R>,
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

const PDATA_BIN: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/transit_data.bin"));

#[wasm_bindgen(js_name = init)]
pub fn init() -> Result<(), JsValue> {
    let mut dec = GzDecoder::new(PDATA_BIN);
    let mut bytes = Vec::new();
    dec.read_to_end(&mut bytes)
        .map_err(|e| JsValue::from_str(&format!("Decompression error: {}", e)))?;

    let d: PData = bincode::deserialize(&bytes)
        .map_err(|e| JsValue::from_str(&format!("Data load error: {}", e)))?;

    DAT.with(|dat| *dat.borrow_mut() = Some(d.dat));
    SCD.with(|scd| *scd.borrow_mut() = Some(d.scd));
    S2I.with(|s2i| *s2i.borrow_mut() = Some(d.s2i));
    I2S.with(|i2s| *i2s.borrow_mut() = Some(d.i2s));
    LOCATIONS.with(|locations| *locations.borrow_mut() = Some(d.locations));

    let rdat_raw = include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/../../data/rdat.json"));
    let rdat: RawRdat = serde_json::from_str(rdat_raw)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse rdat.json: {}", e)))?;

    let rdat_map: HashMap<String, RawTrain> =
        rdat.t.into_iter().map(|t| (t.tn.clone(), t)).collect();

    RDAT_MAP.with(|map| *map.borrow_mut() = Some(rdat_map));

    Ok(())
}

#[wasm_bindgen]
pub fn stop() {
    STOP.with(|s| {
        *s.borrow_mut() = true;
    });
}
fn is_stopped() -> bool {
    STOP.with(|s| *s.borrow())
}
fn rst_stop() {
    STOP.with(|s| {
        *s.borrow_mut() = false;
    });
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
    F: Fn(&StLike) -> (Option<Rc<StLike>>, Option<R>, i32),
{
    let mut segs: Vec<(Rc<StLike>, R)> = Vec::new();
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

    let (mut lc, mut mr) = seg_iter.next().unwrap();
    let (_, _, first_aat) = extractor(&lc);
    let mut fdt = first_aat - mr.dur;
    let mut wtb = if let Some(p_ctx) = extractor(&lc).0 {
        fdt - extractor(&p_ctx).2
    } else {
        0
    };

    for (c, r) in seg_iter {
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
            mr = r;
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
                r: r.clone(),
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

#[derive(Debug, Clone, Deserialize)]
pub struct RawScdat {
    pub g: Vec<RawStationGroup>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Stl {
    pub n: String,
    pub lat: f64,
    pub lon: f64,
    pub rn: Vec<String>,
}

#[derive(Deserialize, Debug, Clone)]
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
extern "C" {
    fn on_jny(j: &str);
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

#[wasm_bindgen]
pub async fn find(o: &str, d: &str, mtt: i32, esc_o: bool, esc_d: bool) -> Result<(), JsValue> {
    rst_stop();
    let rfs = DAT
        .with(|dat| dat.borrow().as_ref().cloned())
        .ok_or_else(|| JsValue::from_str("dat not initd"))?;
    let oid = g_sid(o).ok_or_else(|| JsValue::from_str(&format!("'{}' not found", o)))?;
    let did = g_sid(d).ok_or_else(|| JsValue::from_str(&format!("'{}' not found", d)))?;

    let osids = if esc_o { g_sgrp(oid) } else { vec![oid] };
    let dset: HashSet<usize> = if esc_d {
        g_sgrp(did).into_iter().collect()
    } else {
        [did].into_iter().collect()
    };

    let mut pq = BinaryHeap::with_capacity(50000);
    let mut v: HashMap<usize, Vec<(i32, i32, i32)>> = HashMap::with_capacity(5000);

    for &osid in &osids {
        if let Some(rs) = rfs.get(&osid) {
            for r in rs {
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
        if i % 10000 == 0 {
            sleep(0).await?;
        }

        if is_stopped() {
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

        let (arr, dep, x) = (c.aat, c.idt, c.x);
        if let Some(prof) = v.get(&c.sid) {
            if prof
                .iter()
                .any(|&(a, d, x_prof)| a <= arr && d >= dep && x_prof <= x)
            {
                continue;
            }
        }
        let prof = v.entry(c.sid).or_default();
        prof.retain(|&(a, d, x_prof)| !(arr <= a && dep >= d && x <= x_prof));
        prof.push((arr, dep, x));

        if let Some(next_rs) = rfs.get(&c.sid) {
            for next_r in next_rs {
                if is_stopped() {
                    break;
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

#[derive(Debug, Clone)]
struct StMx {
    tdur: i32,
    aat: i32,
    sid: usize,
    idt: i32,
    x: i32,
    p: Option<Rc<StMx>>,
    r: Option<R>,
}

fn mk_path_mx(st: &StMx) -> Vec<PS> {
    mk_p_base(st, |s| (s.p.clone(), s.r.clone(), s.aat))
}

#[wasm_bindgen(js_name = find_mx)]
pub async fn find_mx(o: &str, d: &str, mtt: i32, esc_o: bool, esc_d: bool) -> Result<(), JsValue> {
    rst_stop();
    let rfs = DAT
        .with(|dat| dat.borrow().as_ref().cloned())
        .ok_or_else(|| JsValue::from_str("dat not initd"))?;
    let oid = g_sid(o).ok_or_else(|| JsValue::from_str(&format!("'{}' not found", o)))?;
    let did = g_sid(d).ok_or_else(|| JsValue::from_str(&format!("'{}' not found", d)))?;

    let osids = if esc_o { g_sgrp(oid) } else { vec![oid] };
    let dset: HashSet<usize> = if esc_d {
        g_sgrp(did).into_iter().collect()
    } else {
        [did].into_iter().collect()
    };

    let mut q = VecDeque::with_capacity(50000);
    let mut visited: HashMap<(usize, u32), i32> = HashMap::with_capacity(10000);

    for &osid in &osids {
        if let Some(rs) = rfs.get(&osid) {
            for r in rs {
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
        if i % 10000 == 0 {
            sleep(0).await?;
        }
        if is_stopped() {
            break;
        }

        let c = Rc::new(c_val);

        if c.x > min_found_x {
            continue;
        }

        if let Some(r) = &c.r {
            if let Some(&prev_x) = visited.get(&(c.sid, r.leg_id)) {
                if prev_x <= c.x {
                    continue;
                }
            }
            visited.insert((c.sid, r.leg_id), c.x);
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

        if let Some(next_rs) = rfs.get(&c.sid) {
            for next_r in next_rs {
                if is_stopped() {
                    break;
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
pub async fn find_k(o: &str, d: &str, esc_o: bool, esc_d: bool) -> Result<(), JsValue> {
    rst_stop();
    let rfs = DAT
        .with(|dat| dat.borrow().as_ref().cloned())
        .ok_or("dat not initd")?;
    let oid = g_sid(o).ok_or_else(|| JsValue::from_str(&format!("'{}' not found", o)))?;
    let did = g_sid(d).ok_or_else(|| JsValue::from_str(&format!("'{}' not found", d)))?;

    let osids = if esc_o { g_sgrp(oid) } else { vec![oid] };
    let dset: HashSet<usize> = if esc_d {
        g_sgrp(did).into_iter().collect()
    } else {
        [did].into_iter().collect()
    };

    let mut pq = BinaryHeap::with_capacity(4000000);
    let mut v: HashMap<usize, i32> = HashMap::with_capacity(5000);

    for &osid in &osids {
        if let Some(rs) = rfs.get(&osid) {
            for r in rs {
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
        if i % 10000 == 0 {
            sleep(0).await?;
        }
        if is_stopped() {
            break;
        }

        if let Some(&min_km) = v.get(&c.sid) {
            if c.tkm >= min_km {
                continue;
            }
        }
        v.insert(c.sid, c.tkm);

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

        if let Some(next_rs) = rfs.get(&c.sid) {
            for next_r in next_rs {
                if is_stopped() {
                    break;
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
