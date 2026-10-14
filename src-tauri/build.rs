fn main() {
    // Build scripts run on the *host*, so `cfg!(target_os = "macos")` would
    // describe the host and not the compilation target. Only Apple Notes
    // needs the generated protobuf types, and compiling them requires a
    // protoc binary — skip it entirely for non-macOS targets.
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        prost_build::compile_protos(&["proto/apple_notes.proto"], &["proto/"]).unwrap();
    }
    tauri_build::build();
}
