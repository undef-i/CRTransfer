use wasm_bindgen::prelude::*;
use std::collections::{HashMap, BinaryHeap, HashSet};
use std::cmp::Ordering;
use std::rc::Rc;
use std::cell::RefCell;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
pub struct R {
    #[serde(rename = "tn")]
    pub tn: String,
    #[serde(serialize_with = "ser_sid")]
    pub bs: usize,
    #[serde(serialize_with = "ser_sid")]
    pub al: usize,
    #[serde(rename = "dtr")]
    pub dtr: i32,
    #[serde(rename = "dur")]
    pub dur: i32,
}

fn ser_sid<S>(sid: &usize, ser: S) -> Result<S::Ok, S::Error> where S: serde::Serializer {
    let s_name = get_sname(*sid).unwrap_or_else(|| format!("S_{}", sid));
    ser.serialize_str(&s_name)
}

#[derive(Debug, Clone, Serialize)]
pub struct PS {
    #[serde(rename = "wtb")]
    pub wtb: i32,
    #[serde(rename = "r")]
    pub r: R,
}

#[derive(Debug, Clone, Serialize)]
pub struct Jny {
    #[serde(rename = "tdur")]
    pub tdur: i32,
    #[serde(rename = "aat")]
    pub aat: i32,
    #[serde(rename = "idt")]
    pub idt: i32,
    #[serde(rename = "x")]
    pub x: i32,
    #[serde(rename = "p")]
    pub p: Vec<PS>,
}

thread_local! {
    static DAT: RefCell<Option<HashMap<usize, Vec<R>>>> = RefCell::new(None);
    static SCD: RefCell<Option<HashMap<usize, Vec<usize>>>> = RefCell::new(None);
    static S2I: RefCell<Option<HashMap<String, usize>>> = RefCell::new(None);
    static I2S: RefCell<Option<Vec<String>>> = RefCell::new(None);
    static STOP: RefCell<bool> = RefCell::new(false);
}

#[derive(Debug, Clone)]
struct St {
    tdur: i32, aat: i32, sid: usize, idt: i32,
    p: Option<Rc<St>>, r: Option<R>,
}

impl PartialEq for St { fn eq(&self, o: &Self) -> bool { self.tdur == o.tdur } }
impl Eq for St {}
impl PartialOrd for St { fn partial_cmp(&self, o: &Self) -> Option<Ordering> { Some(self.cmp(o)) } }
impl Ord for St { fn cmp(&self, o: &Self) -> Ordering { o.tdur.cmp(&self.tdur).then_with(|| o.aat.cmp(&self.aat)) } }

#[wasm_bindgen]
pub fn stop_s() { STOP.with(|s| { *s.borrow_mut() = true; }); }
fn is_stop() -> bool { STOP.with(|s| *s.borrow()) }
fn rst_stop() { STOP.with(|s| { *s.borrow_mut() = false; }); }

fn rec_path(st: &St) -> Vec<PS> {
    let mut segs = Vec::new();
    let mut cur = Some(Rc::new(st.clone()));
    while let Some(c) = cur {
        if let Some(ref r) = c.r {
            let wtb = if let Some(ref p) = c.p { (c.aat - r.dur) - p.aat } else { 0 };
            segs.push(PS { wtb, r: r.clone() });
        }
        cur = c.p.clone();
    }
    segs.reverse();
    segs
}

#[wasm_bindgen(js_name = init_d)]
pub fn init_d(json: &str) -> Result<(), JsValue> {
    let dat = pre_dat(json).map_err(|e| JsValue::from_str(&e))?;
    DAT.with(|d| { *d.borrow_mut() = Some(dat); });
    Ok(())
}

#[wasm_bindgen(js_name = init_scd)]
pub fn init_scd(json: &str) -> Result<(), JsValue> {
    let scd = pre_scd(json).map_err(|e| JsValue::from_str(&e))?;
    SCD.with(|d| { *d.borrow_mut() = Some(scd); });
    Ok(())
}

fn get_sid(s: &str) -> Option<usize> { S2I.with(|d| d.borrow().as_ref()?.get(s).copied()) }
fn get_sname(id: usize) -> Option<String> { I2S.with(|d| d.borrow().as_ref()?.get(id).cloned()) }
fn get_oc_sid(s: &str) -> usize {
    S2I.with(|n2i| {
        I2S.with(|i2n| {
            let mut n2i_map = n2i.borrow_mut();
            let mut i2n_vec = i2n.borrow_mut();
            if n2i_map.is_none() { *n2i_map = Some(HashMap::new()); }
            if i2n_vec.is_none() { *i2n_vec = Some(Vec::new()); }
            let n2i_ref = n2i_map.as_mut().unwrap();
            let i2n_ref = i2n_vec.as_mut().unwrap();
            if let Some(&id) = n2i_ref.get(s) { id }
            else { let id = i2n_ref.len(); n2i_ref.insert(s.to_string(), id); i2n_ref.push(s.to_string()); id }
        })
    })
}

fn pre_scd(s: &str) -> Result<HashMap<usize, Vec<usize>>, String> {
    #[derive(Deserialize)] struct G { s: Vec<S> }
    #[derive(Deserialize)] struct S { n: String }
    #[derive(Deserialize)] struct Root { g: Vec<G> }

    let root: Root = serde_json::from_str(s).map_err(|e| format!("json err: {}", e))?;
    

    let mut s2g: HashMap<usize, Vec<usize>> = HashMap::new();
    for grp in root.g {
        let sids: Vec<usize> = grp.s.iter().map(|s| get_oc_sid(&s.n)).collect();
        if sids.len() > 1 {
            for &id in &sids { s2g.insert(id, sids.clone()); }
        }
    }
    Ok(s2g)
}

fn get_sgrp(id: usize) -> Vec<usize> {
    SCD.with(|d| {
        if let Some(ref scd) = *d.borrow() {
            if let Some(grp) = scd.get(&id) { return grp.clone(); }
        }
        vec![id]
    })
}

fn pre_dat(s: &str) -> Result<HashMap<usize, Vec<R>>, String> {
    #[derive(Deserialize)] struct T { tn: String, s: Vec<S> }
    #[derive(Deserialize)] struct S { n: String, a: i32, d: i32 }
    #[derive(Deserialize)] struct Root { t: Vec<T> }

    let root: Root = serde_json::from_str(s).map_err(|e| format!("json err: {}", e))?;

    let mut rfs: HashMap<usize, Vec<R>> = HashMap::with_capacity(1000);

    for train in root.t {
        if train.s.len() < 2 { continue; }
        
        let mut abs_stops = Vec::new();
        if let Some(first) = train.s.first() {
            let mut dep = first.d;
            if dep < first.a { dep += 1440; }
            let sid = get_oc_sid(&first.n);
            abs_stops.push((sid, first.a, dep));

            for i in 1..train.s.len() {
                let prev_abs = &abs_stops[i - 1];
                let prev_tpl = &train.s[i - 1];
                let curr_tpl = &train.s[i];
                let mut leg_dur = curr_tpl.a - prev_tpl.d;
                if leg_dur < 0 { leg_dur += 1440; }
                let curr_arr = prev_abs.2 + leg_dur;
                let mut wait_dur = curr_tpl.d - curr_tpl.a;
                if wait_dur < 0 { wait_dur += 1440; }
                let curr_dep = curr_arr + wait_dur;
                let sid = get_oc_sid(&curr_tpl.n);
                abs_stops.push((sid, curr_arr, curr_dep));
            }
        }

        for i in 0..(abs_stops.len() - 1) {
            let b_stop = &abs_stops[i];
            let a_stop = &abs_stops[i + 1];
            let dtr = train.s[i].d;
            let dur = a_stop.1 - b_stop.2;
            if dur >= 0 {
                rfs.entry(b_stop.0).or_insert_with(Vec::new).push(R {
                    tn: train.tn.clone(), bs: b_stop.0, al: a_stop.0, dtr, dur,
                });
            }
        }
    }
    Ok(rfs)
}

#[wasm_bindgen]
extern "C" { fn on_jny(j_json: &str); }

fn calc_wait(arr_rem: i32, dep_rem: i32) -> i32 {
    if arr_rem <= dep_rem { dep_rem - arr_rem } else { 1440 - arr_rem + dep_rem }
}

#[wasm_bindgen]
pub fn get_stn() -> Result<Vec<String>, JsValue> {
    I2S.with(|d| {
        d.borrow().as_ref()
            .ok_or_else(|| JsValue::from_str("stn not loaded"))
            .map(|stn| stn.clone())
    })
}

#[wasm_bindgen]
pub fn find(o: &str, d: &str, mtt: i32, esc_o: bool, esc_d: bool) -> Result<(), JsValue> {
    rst_stop();
    let rfs = DAT.with(|dat| dat.borrow().as_ref().cloned()).ok_or_else(|| JsValue::from_str("dat not initd"))?;
    let o_id = get_sid(o).ok_or_else(|| JsValue::from_str(&format!("'{}' not found", o)))?;
    let d_id = get_sid(d).ok_or_else(|| JsValue::from_str(&format!("'{}' not found", d)))?;
    
    let o_sids = if esc_o { get_sgrp(o_id) } else { vec![o_id] };
    let d_set = if esc_d { get_sgrp(d_id).into_iter().collect::<HashSet<usize>>() } else { [d_id].into_iter().collect::<HashSet<usize>>() };
    
    let mut pq = BinaryHeap::with_capacity(50000);
    let mut v: HashMap<usize, Vec<(i32, i32)>> = HashMap::with_capacity(5000);
    
    for &o_sid in &o_sids {
        if let Some(rides) = rfs.get(&o_sid) {
            for r in rides {
                if let Some(aat) = r.dtr.checked_add(r.dur) {
                    pq.push(St { tdur: r.dur, aat, sid: r.al, idt: r.dtr, p: None, r: Some(r.clone()) });
                }
            }
        }
    }
    
    while let Some(c) = pq.pop() {
        if is_stop() { break; }
        let c_arr = c.aat; let c_dep = c.idt;
        if let Some(prof) = v.get(&c.sid) {
            if prof.iter().any(|&(a, d)| a <= c_arr && d >= c_dep) { continue; }
        }
        let prof = v.entry(c.sid).or_default();
        prof.retain(|&(a, d)| !(c_arr <= a && c_dep >= d));
        prof.push((c_arr, c_dep));
        if d_set.contains(&c.sid) {
            let p = rec_path(&c);
            let jny = Jny { tdur: c.tdur, aat: c.aat, idt: c.idt, x: (p.len() as i32 - 1).max(0), p, };
            if let Ok(j_json) = serde_json::to_string(&jny) { on_jny(&j_json); }
            continue;
        }
        if let Some(next_rs) = rfs.get(&c.sid) {
            for next_r in next_rs {
                if is_stop() { return Ok(()); }
                let is_cont = if let Some(ref prev_r) = c.r { prev_r.tn == next_r.tn } else { false };
                let wait = {
                    let arr_rem = c.aat % 1440;
                    let dep_rem = next_r.dtr;
                    let base_wait = calc_wait(arr_rem, dep_rem);

                    if is_cont {
                        if base_wait < 0 { continue; } else { base_wait }
                    } else {
                        let mut calc_w = base_wait;
                        while calc_w < mtt {
                            if let Some(new_w) = calc_w.checked_add(1440) {
                                calc_w = new_w;
                            } else {
                                calc_w = i32::MAX;
                                break;
                            }
                        }
                        if calc_w >= i32::MAX { continue; } else { calc_w }
                    }
                };
                let next_aat = match c.aat.checked_add(wait).and_then(|x| x.checked_add(next_r.dur)) { Some(val) => val, None => continue };
                let new_tdur = match next_aat.checked_sub(c.idt) { Some(val) => val, None => continue };
                pq.push(St { tdur: new_tdur, aat: next_aat, sid: next_r.al, idt: c.idt, p: Some(Rc::new(c.clone())), r: Some(next_r.clone()) });
            }
        }
    }
    Ok(())
}

#[wasm_bindgen(start)]
pub fn main() {}