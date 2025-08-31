use brotli::CompressorWriter;
use std::env;
use std::fs;
use std::io::prelude::*;
use std::path::Path;

fn main() {
    let out_dir = env::var("OUT_DIR").unwrap();

    let source_files = [
        ("../../data/rdat.json", "rdat.json.br"),
        ("../../data/scdat.json", "scdat.json.br"),
        ("../../data/sl.json", "sl.json.br"),
    ];

    println!("cargo:rerun-if-changed=build.rs");
    for (src_path, _) in &source_files {
        println!("cargo:rerun-if-changed={}", src_path);
    }

    println!("cargo:warning=Compressing raw data files for embedding...");

    for (src_path_str, dest_filename) in &source_files {
        let dest_path = Path::new(&out_dir).join(dest_filename);

        let source_bytes =
            fs::read(src_path_str).expect(&format!("Failed to read source file: {}", src_path_str));

        let compressed_data = {
            let mut writer = CompressorWriter::new(Vec::new(), 1024, 4, 22);
            writer.write_all(&source_bytes).expect(&format!(
                "Failed to write to Brotli encoder for {}",
                src_path_str
            ));
            writer.into_inner()
        };

        fs::write(&dest_path, compressed_data).expect(&format!(
            "Failed to write compressed file to {}",
            dest_path.display()
        ));
    }

    println!("cargo:warning=Finished compressing raw data files.");
}
