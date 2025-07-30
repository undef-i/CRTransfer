use flate2::write::GzEncoder;
use flate2::Compression;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::fs;
use std::io::prelude::*;
use std::path::Path;

#[derive(Deserialize)]
struct RawTrain {
    tn: String,
    s: Vec<RawStop>,
}
#[derive(Deserialize)]
struct RawStop {
    n: String,
    a: i32,
    d: i32,
}
#[derive(Deserialize)]
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
struct R {
    tn: String,
    bs: usize,
    al: usize,
    dtr: i32,
    dur: i32,
}

#[derive(Serialize)]
struct PData {
    dat: HashMap<usize, Vec<R>>,
    scd: HashMap<usize, Vec<usize>>,
    s2i: HashMap<String, usize>,
    i2s: Vec<String>,
}

fn main() {
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=../../data/rdat.json");
    println!("cargo:rerun-if-changed=../../data/scdat.json");

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

    let rdat_str = fs::read_to_string("../../data/rdat.json").expect("Failed to read rdat.json");
    let rdat_root: RawRdat = serde_json::from_str(&rdat_str).expect("Failed to parse rdat.json");
    let mut dat: HashMap<usize, Vec<R>> = HashMap::new();

    for train in rdat_root.t {
        for i in 0..(train.s.len().saturating_sub(1)) {
            let b = &train.s[i];
            let a = &train.s[i + 1];
            if b.d != -1 && a.a != -1 && a.a > b.d {
                let b_sid = get_sid(&b.n, &mut s2i, &mut i2s);
                let a_sid = get_sid(&a.n, &mut s2i, &mut i2s);
                dat.entry(b_sid).or_default().push(R {
                    tn: train.tn.clone(),
                    bs: b_sid,
                    al: a_sid,
                    dtr: b.d,
                    dur: a.a - b.d,
                });
            }
        }
    }

    let scdat_str = fs::read_to_string("../../data/scdat.json").expect("Failed to read scdat.json");
    let scdat_root: RawScdat =
        serde_json::from_str(&scdat_str).expect("Failed to parse scdat.json");
    let mut scd: HashMap<usize, Vec<usize>> = HashMap::new();

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

    let p_data = PData { dat, scd, s2i, i2s };
    let encoded: Vec<u8> = bincode::serialize(&p_data).expect("Failed to serialize data");

    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder
        .write_all(&encoded)
        .expect("Failed to write to gzip encoder");
    let compressed_data = encoder.finish().expect("Failed to finish gzip encoding");

    let out_dir = env::var("OUT_DIR").unwrap();
    let dest_path = Path::new(&out_dir).join("transit_data.bin");
    fs::write(&dest_path, compressed_data).expect("Failed to write compressed binary data file");
}
