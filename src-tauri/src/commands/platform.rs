//! Per-platform feature availability, exposed to the frontend so it can hide
//! UI for features that a given platform's build does not ship.
//!
//! These flags answer "does this platform's build support the feature at
//! all?" — not "is it usable right now?". Runtime availability (e.g. the AI
//! assistant needing macOS 26) stays with the existing commands such as
//! `ai_available`.

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct PlatformCapabilities {
    /// `std::env::consts::OS`: "macos" | "windows" | "linux".
    pub os: String,
    pub clip_capture: bool,
    pub ai_assistant: bool,
    pub icloud: bool,
    pub apple_notes: bool,
    pub note_lock: bool,
    pub image_copy: bool,
    pub dictation: bool,
    pub semantic_search: bool,
    pub hide_dock_icon: bool,
}

#[tauri::command]
pub fn get_platform_capabilities() -> PlatformCapabilities {
    #[cfg(target_os = "macos")]
    {
        PlatformCapabilities {
            os: std::env::consts::OS.to_string(),
            clip_capture: true,
            ai_assistant: true,
            icloud: true,
            apple_notes: true,
            note_lock: true,
            image_copy: true,
            dictation: true,
            semantic_search: true,
            hide_dock_icon: true,
        }
    }

    // Windows (and any other target): everything that the macOS build relies
    // on an Apple API for is off. Later stages turn note_lock, image_copy,
    // dictation, semantic_search and hide_dock_icon back on for Windows.
    #[cfg(not(target_os = "macos"))]
    {
        PlatformCapabilities {
            os: std::env::consts::OS.to_string(),
            clip_capture: false,
            ai_assistant: false,
            icloud: false,
            apple_notes: false,
            note_lock: false,
            image_copy: false,
            dictation: false,
            semantic_search: false,
            hide_dock_icon: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn os_matches_the_compile_target() {
        let caps = get_platform_capabilities();
        assert_eq!(caps.os, std::env::consts::OS);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_reports_every_feature_supported() {
        let caps = get_platform_capabilities();
        assert!(caps.clip_capture);
        assert!(caps.ai_assistant);
        assert!(caps.icloud);
        assert!(caps.apple_notes);
        assert!(caps.note_lock);
        assert!(caps.image_copy);
        assert!(caps.dictation);
        assert!(caps.semantic_search);
        assert!(caps.hide_dock_icon);
    }

    #[cfg(not(target_os = "macos"))]
    #[test]
    fn non_macos_reports_no_apple_features() {
        let caps = get_platform_capabilities();
        assert!(!caps.clip_capture);
        assert!(!caps.ai_assistant);
        assert!(!caps.icloud);
        assert!(!caps.apple_notes);
        assert!(!caps.note_lock);
        assert!(!caps.image_copy);
        assert!(!caps.dictation);
        assert!(!caps.semantic_search);
        assert!(!caps.hide_dock_icon);
    }

    #[test]
    fn serializes_with_snake_case_keys() {
        let value = serde_json::to_value(get_platform_capabilities()).unwrap();
        assert!(value.get("clip_capture").is_some());
        assert!(value.get("hide_dock_icon").is_some());
        assert!(value.get("os").is_some());
    }
}
