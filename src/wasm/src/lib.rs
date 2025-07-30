use wasm_bindgen::prelude::*;
use std::collections::{HashMap, BinaryHeap, HashSet};
use std::cmp::Ordering;
use std::rc::Rc;
use std::cell::RefCell;
use std::io::prelude::*;
use serde::{Deserialize, Serialize};
use flate2::read::GzDecoder;

use wasm_bindgen_futures::JsFuture;
use js_sys::Promise;
use web_sys::{window, WorkerGlobalScope};


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct R {
    pub tn: String,
    #[serde(serialize_with = "ser_sid")]
    pub bs: usize,
    #[serde(serialize_with = "ser_sid")]
    pub al: usize,
    pub dtr: i32,
    pub dur: i32,
}

fn ser_sid<S>(sid: &usize, ser: S) -> Result<S::Ok, S::Error> where S: serde::Serializer {
    let s_name = get_sname(*sid).unwrap_or_else(|| format!("S_{}", sid));
    ser.serialize_str(&s_name)
}

#[derive(Debug, Clone, Serialize)]
pub struct PS { pub wtb: i32, pub r: R, }

#[derive(Debug, Clone, Serialize)]
pub struct Jny { pub tdur: i32, pub aat: i32, pub idt: i32, pub x: i32, pub p: Vec<PS>, }

#[derive(Deserialize)]
struct PData {
    dat: HashMap<usize, Vec<R>>,
    scd: HashMap<usize, Vec<usize>>,
    s2i: HashMap<String, usize>,
    i2s: Vec<String>,
}


thread_local! {
    static DAT: RefCell<Option<HashMap<usize, Vec<R>>>> = RefCell::new(None);
    static SCD: RefCell<Option<HashMap<usize, Vec<usize>>>> = RefCell::new(None);
    static S2I: RefCell<Option<HashMap<String, usize>>> = RefCell::new(None);
    static I2S: RefCell<Option<Vec<String>>> = RefCell::new(None);
    static STOP: RefCell<bool> = RefCell::new(false);
}


#[derive(Debug, Clone)]
struct St { tdur: i32, aat: i32, sid: usize, idt: i32, x: i32, p: Option<Rc<St>>, r: Option<R>, }
impl PartialEq for St { fn eq(&self, o: &Self) -> bool { self.tdur == o.tdur } }
impl Eq for St {}
impl PartialOrd for St { fn partial_cmp(&self, o: &Self) -> Option<Ordering> { Some(self.cmp(o)) } }
impl Ord for St { fn cmp(&self, o: &Self) -> Ordering { o.tdur.cmp(&self.tdur).then_with(|| self.idt.cmp(&o.idt)) } }


const PDATA_BIN: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/transit_data.bin"));

#[wasm_bindgen(js_name = init)]
pub fn init() -> Result<(), JsValue> {
    let mut decoder = GzDecoder::new(PDATA_BIN);
    let mut decompressed_bytes = Vec::new();
    decoder.read_to_end(&mut decompressed_bytes)
        .map_err(|e| JsValue::from_str(&format!("Decompression error: {}", e)))?;

    let data: PData = bincode::deserialize(&decompressed_bytes)
        .map_err(|e| JsValue::from_str(&format!("Data load error: {}", e)))?;
    
    DAT.with(|d| *d.borrow_mut() = Some(data.dat));
    SCD.with(|d| *d.borrow_mut() = Some(data.scd));
    S2I.with(|d| *d.borrow_mut() = Some(data.s2i));
    I2S.with(|d| *d.borrow_mut() = Some(data.i2s));
    Ok(())
}


#[wasm_bindgen]
pub fn stop_s() { STOP.with(|s| { *s.borrow_mut() = true; }); }
fn is_stop() -> bool { STOP.with(|s| *s.borrow()) }
fn rst_stop() { STOP.with(|s| { *s.borrow_mut() = false; }); }

fn get_sid(s: &str) -> Option<usize> { S2I.with(|d| d.borrow().as_ref()?.get(s).copied()) }
fn get_sname(id: usize) -> Option<String> { I2S.with(|d| d.borrow().as_ref()?.get(id).cloned()) }
fn get_sgrp(id: usize) -> Vec<usize> { SCD.with(|d| d.borrow().as_ref().and_then(|scd| scd.get(&id).cloned()).unwrap_or_else(|| vec![id])) }
fn calc_wait(arr_rem: i32, dep_rem: i32) -> i32 { if arr_rem <= dep_rem { dep_rem - arr_rem } else { 1440 - arr_rem + dep_rem } }


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

#[wasm_bindgen]
pub fn get_stn() -> Result<Vec<String>, JsValue> {
    I2S.with(|d| d.borrow().as_ref().cloned().ok_or_else(|| JsValue::from_str("data not loaded")))
}


#[wasm_bindgen]
extern "C" { fn on_jny(j_json: &str); }


async fn sleep(ms: i32) -> Result<(), JsValue> {
    let promise = Promise::new(&mut |resolve, _| {
        let global = js_sys::global();
        if let Ok(worker_scope) = global.dyn_into::<WorkerGlobalScope>() {
            worker_scope.set_timeout_with_callback_and_timeout_and_arguments_0(&resolve, ms).unwrap();
        } else if let Some(window) = window() {
            window.set_timeout_with_callback_and_timeout_and_arguments_0(&resolve, ms).unwrap();
        }
    });
    JsFuture::from(promise).await?;
    Ok(())
}


#[wasm_bindgen]
pub async fn find(o: &str, d: &str, mtt: i32, esc_o: bool, esc_d: bool) -> Result<(), JsValue> {
    rst_stop();
    let rfs = DAT.with(|dat| dat.borrow().as_ref().cloned()).ok_or_else(|| JsValue::from_str("dat not initd"))?;
    let o_id = get_sid(o).ok_or_else(|| JsValue::from_str(&format!("'{}' not found", o)))?;
    let d_id = get_sid(d).ok_or_else(|| JsValue::from_str(&format!("'{}' not found", d)))?;
    
    let o_sids = if esc_o { get_sgrp(o_id) } else { vec![o_id] };
    let d_set: HashSet<usize> = if esc_d { get_sgrp(d_id).into_iter().collect() } else { [d_id].into_iter().collect() };
    
    let mut pq = BinaryHeap::with_capacity(50000);
    let mut v: HashMap<usize, Vec<(i32, i32, i32)>> = HashMap::with_capacity(5000);
    
    for &o_sid in &o_sids {
        if let Some(rides) = rfs.get(&o_sid) {
            for r in rides {
                if let Some(aat) = r.dtr.checked_add(r.dur) {
                    pq.push(St { tdur: r.dur, aat, sid: r.al, idt: r.dtr, x: 0, p: None, r: Some(r.clone()) });
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

        if is_stop() { break; }

        if d_set.contains(&c.sid) {
            let p = rec_path(&c);
            let jny = Jny { tdur: c.tdur, aat: c.aat, idt: c.idt, x: c.x, p };
            if let Ok(j_json) = serde_json::to_string(&jny) { on_jny(&j_json); }
            continue;
        }

        let (c_arr, c_dep, c_x) = (c.aat, c.idt, c.x);
        if let Some(prof) = v.get(&c.sid) {
            if prof.iter().any(|&(a, d, x)| a <= c_arr && d >= c_dep && x <= c_x) { continue; }
        }
        let prof = v.entry(c.sid).or_default();
        prof.retain(|&(a, d, x)| !(c_arr <= a && c_dep >= d && c_x <= x));
        prof.push((c_arr, c_dep, c_x));
        
        if let Some(next_rs) = rfs.get(&c.sid) {
            for next_r in next_rs {
                if is_stop() { break; }
                let is_cont = if let Some(ref prev_r) = c.r { prev_r.tn == next_r.tn } else { false };
                let mut wait = calc_wait(c.aat % 1440, next_r.dtr % 1440);

                if !is_cont {
                    while wait < mtt { wait = wait.saturating_add(1440); }
                }
                if wait == i32::MAX { continue; };
                
                let next_aat = match c.aat.checked_add(wait).and_then(|x| x.checked_add(next_r.dur)) { Some(val) => val, None => continue };
                let new_tdur = match next_aat.checked_sub(c.idt) { Some(val) => val, None => continue };
                let new_x = if is_cont { c.x } else { c.x + 1 };
                pq.push(St { tdur: new_tdur, aat: next_aat, sid: next_r.al, idt: c.idt, x: new_x, p: Some(Rc::new(c.clone())), r: Some(next_r.clone()) });
            }
        }
    }
    Ok(())
}