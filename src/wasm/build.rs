use brotli::CompressorWriter;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::fs;
use std::io::prelude::*;
use std::path::Path;
use std::time::SystemTime;

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
#[allow(dead_code)]
struct RawRdat {
    t: Vec<RawTrain>,
}

#[derive(Deserialize)]
struct RawScGroup {
    s: Vec<RawScStation>,
}

#[derive(Deserialize)]
struct RawScStation {
    n: String,
}

#[derive(Deserialize)]
struct RawScdat {
    g: Vec<RawScGroup>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct SL {
    lat: Option<f64>,
    lon: Option<f64>,
    rn: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct R {
    tn: String,
    bs: usize,
    al: usize,
    dtr: i32,
    dur: i32,
    km: i32,
    leg_id: u32,
    next_leg_id: Option<u32>,
}

#[derive(Serialize)]
struct PData {
    dat: HashMap<usize, Vec<R>>,
    scd: HashMap<usize, Vec<usize>>,
    s2i: HashMap<String, usize>,
    i2s: Vec<String>,
    locations: HashMap<String, SL>,
    rdat_map: HashMap<String, RawTrain>,
}

fn main() {
    let out_dir = env::var("OUT_DIR").unwrap();
    let dest_path = Path::new(&out_dir).join("transit_data.bin");

    let source_files = [
        "../../data/rdat.json",
        "../../data/scdat.json",
        "../../data/sl.json",
    ];

    for file in &source_files {
        println!("cargo:rerun-if-changed={}", file);
    }
    println!("cargo:rerun-if-changed=build.rs");

    if dest_path.exists() {
        let out_meta = fs::metadata(&dest_path).expect("Failed to get metadata of output file");
        let out_mtime = out_meta.modified().unwrap_or(SystemTime::UNIX_EPOCH);

        let mut source_is_newer = false;
        for file in &source_files {
            let src_meta =
                fs::metadata(file).expect(&format!("Failed to get metadata of {}", file));
            let src_mtime = src_meta.modified().unwrap_or(SystemTime::UNIX_EPOCH);
            if src_mtime > out_mtime {
                source_is_newer = true;
                break;
            }
        }

        if !source_is_newer {
            println!("cargo:warning=Using cached transit_data.bin, skipping data processing.");
            return;
        }
    }

    println!("cargo:warning=Source data changed, generating new transit_data.bin...");

    let mut s2i: HashMap<String, usize> = HashMap::new();
    let mut i2s: Vec<String> = Vec::new();

    let get_sid = |name: &str, s2i: &mut HashMap<String, usize>, i2s: &mut Vec<String>| -> usize {
        s2i.entry(name.to_string())
            .or_insert_with(|| {
                let id = i2s.len();
                i2s.push(name.to_string());
                id
            })
            .clone()
    };

    let mut rdat_bytes = fs::read(source_files[0]).expect("Failed to read rdat.json");
    let rdat_root: RawRdat =
        simd_json::from_slice(&mut rdat_bytes).expect("Failed to parse rdat.json");

    let mut scdat_bytes = fs::read(source_files[1]).expect("Failed to read scdat.json");
    let scdat_root: RawScdat =
        simd_json::from_slice(&mut scdat_bytes).expect("Failed to parse scdat.json");

    let mut sl_bytes = fs::read(source_files[2]).expect("Failed to read sl.json");
    let locations: HashMap<String, SL> =
        simd_json::from_slice(&mut sl_bytes).expect("Failed to parse sl.json");

    let mut dat: HashMap<usize, Vec<R>> = HashMap::with_capacity(500000);
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
                dat.entry(b_sid).or_default().push(R {
                    tn: train.tn.clone(),
                    bs: b_sid,
                    al: a_sid,
                    dtr: b.d,
                    dur: a.a - b.d,
                    km: a.km - b.km,
                    leg_id: current_leg_id,
                    next_leg_id,
                });
            }
        }
    }

    let mut scd: HashMap<usize, Vec<usize>> = HashMap::with_capacity(5000);
    for group in scdat_root.g {
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

    let p_data = PData {
        dat,
        scd,
        s2i,
        i2s,
        locations,
        rdat_map,
    };

    let encoded: Vec<u8> = bincode::serialize(&p_data).expect("Failed to serialize data");

    let compressed_data = {
        let mut writer = CompressorWriter::new(Vec::new(), 4096, 11, 22);
        writer
            .write_all(&encoded)
            .expect("Failed to write to Brotli encoder");
        writer.into_inner()
    };

    fs::write(&dest_path, compressed_data).expect("Failed to write compressed binary data file");
}
