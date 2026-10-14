use crate::commands::{notes, session_drafts, settings, sticked_notes};
use crate::state::{AppState, ImagePreviewContent, LastSavedNote};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use sticked_notes::StickedNote;
use tauri::{
    AppHandle, Emitter, LogicalPosition, Manager, PhysicalPosition, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};

const SETTINGS_WINDOW_WIDTH: f64 = 860.0;
const SETTINGS_WINDOW_HEIGHT: f64 = 720.0;
const SETTINGS_WINDOW_MIN_WIDTH: f64 = 760.0;
const SETTINGS_WINDOW_MIN_HEIGHT: f64 = 560.0;

/// Minimum overlap (in physical pixels) between window and monitor for the position to be usable.
const MIN_OVERLAP: f64 = 80.0;
const CAPTURE_CURSOR_OFFSET: f64 = 18.0;
const CAPTURE_MONITOR_MARGIN: f64 = 16.0;
static CAPTURE_WINDOW_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Clone, Copy, Debug, PartialEq)]
struct DesktopRect {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

/// Check if a window at (x, y) with the given size overlaps sufficiently with any connected
/// monitor. All coordinates are in **physical pixels** (same space as `outerPosition()`).
/// Uses rectangle intersection — handles negative coordinates from left/top monitors.
fn is_window_visible_on_any_monitor(app: &AppHandle, x: f64, y: f64, w: f64, h: f64) -> bool {
    for monitor in app.available_monitors().unwrap_or_default() {
        let pos = monitor.position();
        let size = monitor.size();

        // All values in physical pixels — no scale conversion needed.
        let mx = pos.x as f64;
        let my = pos.y as f64;
        let mw = size.width as f64;
        let mh = size.height as f64;

        // Rectangle intersection: overlap width/height between window and monitor
        let overlap_w = (x + w).min(mx + mw) - x.max(mx);
        let overlap_h = (y + h).min(my + mh) - y.max(my);

        if overlap_w >= MIN_OVERLAP && overlap_h >= MIN_OVERLAP {
            return true;
        }
    }

    false
}

fn is_capture_window_label(label: &str) -> bool {
    label == "postit" || label.starts_with("capture-")
}

fn remember_last_note(state: &AppState, path: &str, folder: &str) {
    if path.trim().is_empty() {
        return;
    }

    let mut last = state
        .last_saved_note
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    *last = Some(LastSavedNote {
        path: path.to_string(),
        folder: folder.to_string(),
    });
}

fn rect_contains_point(rect: &DesktopRect, x: f64, y: f64) -> bool {
    x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height
}

fn clamp_window_axis(desired: f64, start: f64, extent: f64, window_extent: f64) -> f64 {
    let min = start + CAPTURE_MONITOR_MARGIN;
    let max = start + extent - window_extent - CAPTURE_MONITOR_MARGIN;

    if max < min {
        return start + ((extent - window_extent) / 2.0).max(0.0);
    }

    desired.clamp(min, max)
}

fn capture_position_near_cursor(
    cursor: (f64, f64),
    window_size: (f64, f64),
    monitors: &[DesktopRect],
) -> Option<(f64, f64)> {
    let monitor = monitors
        .iter()
        .find(|monitor| rect_contains_point(monitor, cursor.0, cursor.1))
        .or_else(|| monitors.first())?;

    let desired_x = cursor.0 + CAPTURE_CURSOR_OFFSET;
    let desired_y = cursor.1 + CAPTURE_CURSOR_OFFSET;
    let x = clamp_window_axis(desired_x, monitor.x, monitor.width, window_size.0);
    let y = clamp_window_axis(desired_y, monitor.y, monitor.height, window_size.1);

    Some((x.round(), y.round()))
}

#[cfg(not(target_os = "macos"))]
fn monitor_rects(app: &AppHandle) -> Vec<DesktopRect> {
    app.available_monitors()
        .unwrap_or_default()
        .into_iter()
        .map(|monitor| {
            let pos = monitor.position();
            let size = monitor.size();
            DesktopRect {
                x: pos.x as f64,
                y: pos.y as f64,
                width: size.width as f64,
                height: size.height as f64,
            }
        })
        .collect()
}

#[cfg(target_os = "macos")]
fn monitor_rects_logical(app: &AppHandle) -> Vec<DesktopRect> {
    app.available_monitors()
        .unwrap_or_default()
        .into_iter()
        .map(|monitor| {
            let scale = monitor.scale_factor();
            let pos = monitor.position();
            let size = monitor.size();
            DesktopRect {
                x: pos.x as f64 / scale,
                y: pos.y as f64 / scale,
                width: size.width as f64 / scale,
                height: size.height as f64 / scale,
            }
        })
        .collect()
}

#[cfg(target_os = "macos")]
fn macos_cursor_position_logical() -> Option<(f64, f64)> {
    use objc2::MainThreadMarker;
    use objc2_app_kit::{NSEvent, NSScreen};

    let point = NSEvent::mouseLocation();
    let mtm = MainThreadMarker::new()?;
    let main_screen = NSScreen::mainScreen(mtm)?;
    let main_frame = main_screen.frame();
    Some((point.x, main_frame.size.height - point.y))
}

#[cfg(target_os = "macos")]
fn position_capture_window_near_cursor(
    app: &AppHandle,
    window: &WebviewWindow,
    logical_width: f64,
    logical_height: f64,
) -> bool {
    let Some(cursor) = macos_cursor_position_logical() else {
        return false;
    };

    let monitors = monitor_rects_logical(app);
    let Some((x, y)) =
        capture_position_near_cursor(cursor, (logical_width, logical_height), &monitors)
    else {
        return false;
    };

    window
        .set_position(tauri::Position::Logical(LogicalPosition::new(x, y)))
        .is_ok()
}

#[cfg(not(target_os = "macos"))]
fn position_capture_window_near_cursor(
    app: &AppHandle,
    window: &WebviewWindow,
    logical_width: f64,
    logical_height: f64,
) -> bool {
    let Ok(cursor) = app.cursor_position() else {
        return false;
    };

    let scale = window.scale_factor().unwrap_or(1.0);
    let window_size = (logical_width * scale, logical_height * scale);
    let monitors = monitor_rects(app);
    let Some((x, y)) = capture_position_near_cursor((cursor.x, cursor.y), window_size, &monitors)
    else {
        return false;
    };

    window
        .set_position(tauri::Position::Physical(PhysicalPosition::new(
            x as i32, y as i32,
        )))
        .is_ok()
}

fn next_capture_window_label() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let counter = CAPTURE_WINDOW_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("capture-{millis}-{counter}")
}

pub fn attach_capture_window_blur_event(window: &WebviewWindow) {
    let w = window.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::Focused(focused) = event {
            if !focused {
                // Don't hide when Apple Notes picker took focus.
                if w.app_handle()
                    .get_webview_window("apple-notes-picker")
                    .is_some()
                {
                    return;
                }
                let _ = w.emit("postit-blur", ());
            }
        }
    });
}

fn show_capture_window_with_folder(
    app: &AppHandle,
    folder: &str,
    start_dictation: bool,
) -> Result<(), String> {
    let saved_settings = settings::load_settings_from_file().ok();
    let (width, height) = saved_settings
        .as_ref()
        .and_then(|s| s.capture_window_size)
        .unwrap_or((400.0, 280.0));
    let label = next_capture_window_label();
    let mut url = format!(
        "index.html?window=capture&folder={}",
        encode_query_component(folder)
    );
    if start_dictation {
        url.push_str("&startDictation=1");
    }

    let window = WebviewWindowBuilder::new(app, &label, WebviewUrl::App(url.into()))
        .title("Stik")
        .inner_size(width, height)
        .min_inner_size(320.0, 200.0)
        .max_inner_size(800.0, 600.0)
        .resizable(true)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .build();

    match window {
        Ok(win) => {
            let positioned_near_cursor =
                position_capture_window_near_cursor(app, &win, width, height);
            if !positioned_near_cursor {
                let _ = win.center();
            }
            attach_capture_window_blur_event(&win);
            let _ = win.show();
            let _ = win.set_focus();
            Ok(())
        }
        Err(e) => Err(format!("Failed to create capture window: {}", e)),
    }
}

pub fn show_postit_with_folder(app: &AppHandle, folder: &str) {
    if let Err(err) = show_capture_window_with_folder(app, folder, false) {
        eprintln!("{err}");
    }
}

pub fn show_voice_note_with_folder(app: &AppHandle, folder: &str) {
    if let Err(err) = show_capture_window_with_folder(app, folder, true) {
        eprintln!("{err}");
    }
}

pub fn show_command_palette(app: &AppHandle) {
    {
        let state = app.state::<AppState>();
        let mut postit_visible = state
            .postit_was_visible
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        *postit_visible = app.webview_windows().iter().any(|(label, window)| {
            is_capture_window_label(label) && window.is_visible().unwrap_or(false)
        });
    }

    for (label, window) in app.webview_windows() {
        if label.starts_with("sticked-") {
            let _ = window.set_always_on_top(false);
        }
    }

    if let Some(window) = app.get_webview_window("command-palette") {
        let _ = window.show();
        let _ = window.set_focus();
        return;
    }

    let window = WebviewWindowBuilder::new(
        app,
        "command-palette",
        WebviewUrl::App("index.html?window=command-palette".into()),
    )
    .title("Command Palette")
    .inner_size(700.0, 480.0)
    .resizable(false)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .center()
    .build();

    if let Ok(win) = window {
        let app_handle = app.clone();
        win.on_window_event(move |event| match event {
            tauri::WindowEvent::Focused(focused) => {
                if !focused {
                    for (label, window) in app_handle.webview_windows() {
                        if label.starts_with("sticked-") {
                            let _ = window.set_always_on_top(true);
                        }
                    }
                }
            }
            tauri::WindowEvent::Destroyed => {
                for (label, window) in app_handle.webview_windows() {
                    if label.starts_with("sticked-") {
                        let _ = window.set_always_on_top(true);
                    }
                }

                let state = app_handle.state::<AppState>();
                let postit_visible = *state
                    .postit_was_visible
                    .lock()
                    .unwrap_or_else(|e| e.into_inner());

                if postit_visible {
                    let has_viewing_windows = app_handle
                        .webview_windows()
                        .iter()
                        .any(|(label, _)| label.starts_with("sticked-view-"));
                    if !has_viewing_windows {
                        if let Some((_, capture)) =
                            app_handle
                                .webview_windows()
                                .into_iter()
                                .find(|(label, window)| {
                                    is_capture_window_label(label)
                                        && window.is_visible().unwrap_or(false)
                                })
                        {
                            let _ = capture.show();
                            let _ = capture.set_focus();
                        }
                    }
                }
            }
            _ => {}
        });
    }
}

pub fn show_settings(app: &AppHandle) {
    {
        let state = app.state::<AppState>();
        let mut prev_window = state
            .previous_focused_window
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        *prev_window = None;

        for (label, window) in app.webview_windows() {
            if label.starts_with("sticked-") || is_capture_window_label(&label) {
                if window.is_focused().unwrap_or(false) {
                    *prev_window = Some(label.clone());
                    break;
                }
            }
        }

        let mut postit_visible = state
            .postit_was_visible
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        *postit_visible = app.webview_windows().iter().any(|(label, window)| {
            is_capture_window_label(label) && window.is_visible().unwrap_or(false)
        });
    }

    for (label, window) in app.webview_windows() {
        if label.starts_with("sticked-") {
            let _ = window.set_always_on_top(false);
        }
    }

    if let Some(window) = app.get_webview_window("settings") {
        let _ = window.show();
        let _ = window.set_focus();
        return;
    }

    let window = WebviewWindowBuilder::new(
        app,
        "settings",
        WebviewUrl::App("index.html?window=settings".into()),
    )
    .title("Settings")
    .inner_size(SETTINGS_WINDOW_WIDTH, SETTINGS_WINDOW_HEIGHT)
    .min_inner_size(SETTINGS_WINDOW_MIN_WIDTH, SETTINGS_WINDOW_MIN_HEIGHT)
    .resizable(true)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .center()
    .build();

    if let Ok(win) = window {
        let app_handle = app.clone();
        win.on_window_event(move |event| {
            if let tauri::WindowEvent::Destroyed = event {
                for (label, window) in app_handle.webview_windows() {
                    if label.starts_with("sticked-") {
                        let _ = window.set_always_on_top(true);
                    }
                }

                let state = app_handle.state::<AppState>();
                let prev_window = state
                    .previous_focused_window
                    .lock()
                    .unwrap_or_else(|e| e.into_inner());
                let postit_visible = *state
                    .postit_was_visible
                    .lock()
                    .unwrap_or_else(|e| e.into_inner());

                if let Some(label) = prev_window.as_ref() {
                    if let Some(window) = app_handle.get_webview_window(label) {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                } else if postit_visible {
                    if let Some((_, capture)) =
                        app_handle
                            .webview_windows()
                            .into_iter()
                            .find(|(label, window)| {
                                is_capture_window_label(label)
                                    && window.is_visible().unwrap_or(false)
                            })
                    {
                        let _ = capture.show();
                        let _ = capture.set_focus();
                    }
                }
            }
        });
    }
}

#[tauri::command]
pub fn hide_window(window: tauri::Window) {
    if window.label().starts_with("capture-") {
        let _ = window.close();
    } else {
        let _ = window.hide();
    }
}

#[tauri::command]
pub fn hide_postit(app: AppHandle) {
    if let Some(window) = app.get_webview_window("postit") {
        let _ = window.hide();
    }
}

#[tauri::command]
pub fn create_sticked_window(app: AppHandle, note: StickedNote) -> Result<bool, String> {
    let window_label = format!("sticked-{}", note.id);

    if app.get_webview_window(&window_label).is_some() {
        return Ok(true);
    }

    let saved_position = note.position;
    let (width, height) = note.size.unwrap_or((400.0, 280.0));
    let url = format!("index.html?window=sticked&id={}", note.id);

    // Build hidden — position after creation using PhysicalPosition to avoid
    // the logical/physical mismatch in WebviewWindowBuilder::position().
    let window = WebviewWindowBuilder::new(&app, &window_label, WebviewUrl::App(url.into()))
        .title("Sticked Note")
        .inner_size(width, height)
        .min_inner_size(320.0, 200.0)
        .max_inner_size(800.0, 600.0)
        .resizable(true)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .build();

    match window {
        Ok(win) => {
            if let Some((x, y)) = saved_position {
                let _ = win.set_position(tauri::Position::Physical(PhysicalPosition::new(
                    x as i32, y as i32,
                )));
            } else {
                let _ = win.center();
            }
            let _ = win.show();
            Ok(true)
        }
        Err(e) => Err(format!("Failed to create sticked window: {}", e)),
    }
}

pub fn create_sticked_window_centered(app: AppHandle, note: StickedNote) -> Result<bool, String> {
    let window_label = format!("sticked-{}", note.id);

    if app.get_webview_window(&window_label).is_some() {
        return Ok(true);
    }

    let (width, height) = note.size.unwrap_or((400.0, 280.0));
    let url = format!("index.html?window=sticked&id={}", note.id);

    let window = WebviewWindowBuilder::new(&app, &window_label, WebviewUrl::App(url.into()))
        .title("Sticked Note")
        .inner_size(width, height)
        .min_inner_size(320.0, 200.0)
        .max_inner_size(800.0, 600.0)
        .center()
        .resizable(true)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .build();

    if let Err(e) = window {
        return Err(format!("Failed to create sticked window: {}", e));
    }

    Ok(true)
}

#[tauri::command]
pub fn close_sticked_window(app: AppHandle, id: String) -> Result<bool, String> {
    let window_label = format!("sticked-{}", id);

    if let Some(window) = app.get_webview_window(&window_label) {
        let _ = window.close();
    }

    // Clean up viewing note cache to prevent memory leak
    if id.starts_with("view-") {
        let state = app.state::<AppState>();
        let mut viewing_notes = state
            .viewing_notes
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        viewing_notes.remove(&id);
    }

    Ok(true)
}

#[tauri::command]
pub async fn pin_capture_note(
    app: AppHandle,
    content: String,
    folder: String,
) -> Result<StickedNote, String> {
    // Read saved viewing position so the pinned note opens where the last
    // sticked/viewing window was, not always centered.
    let saved = settings::load_settings_from_file().ok();
    let saved_pos = saved.as_ref().and_then(|s| s.viewing_window_position);
    let saved_size = saved.as_ref().and_then(|s| s.viewing_window_size);

    let mut note = sticked_notes::create_sticked_note(content, folder, None)?;

    // Use saved viewing position if it's on a connected monitor, otherwise center.
    let use_saved = saved_pos.is_some_and(|(x, y)| {
        let (w, h) = saved_size.unwrap_or((400.0, 280.0));
        is_window_visible_on_any_monitor(&app, x, y, w, h)
    });

    if let (true, Some((x, y))) = (use_saved, saved_pos) {
        note.position = Some((x, y));
        if let Some((w, h)) = saved_size {
            note.size = Some((w, h));
        }
        create_sticked_window(app.clone(), note.clone())?;
    } else {
        create_sticked_window_centered(app.clone(), note.clone())?;
    }

    // Persist the actual window position/size so it restores correctly
    let window_label = format!("sticked-{}", note.id);
    if let Some(win) = app.get_webview_window(&window_label) {
        if let (Ok(pos), Ok(size)) = (win.outer_position(), win.outer_size()) {
            let _ = sticked_notes::update_sticked_note(
                note.id.clone(),
                None,
                None,
                Some((pos.x as f64, pos.y as f64)),
                Some((size.width as f64, size.height as f64)),
            );

            // Keep the global viewing geometry in sync.
            let scale = win.scale_factor().unwrap_or(1.0);
            let lw = size.width as f64 / scale;
            let lh = size.height as f64 / scale;
            let _ = settings::save_viewing_window_geometry(lw, lh, pos.x as f64, pos.y as f64);
        }
    }

    if let Some(window) = app.get_webview_window("postit") {
        let _ = window.hide();
    }

    Ok(note)
}

#[tauri::command]
pub async fn open_note_for_viewing(
    app: AppHandle,
    content: String,
    folder: String,
    path: String,
) -> Result<bool, String> {
    {
        let state = app.state::<AppState>();
        remember_last_note(&state, &path, &folder);
    }

    let id = format!("view-{}", path.replace(['/', '\\', '.', ' '], "-"));
    let window_label = format!("sticked-{}", id);

    if app.get_webview_window(&window_label).is_some() {
        return Ok(true);
    }

    {
        let state = app.state::<AppState>();
        let mut viewing_notes = state
            .viewing_notes
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        viewing_notes.insert(
            id.clone(),
            crate::state::ViewingNoteContent {
                id: id.clone(),
                content,
                folder,
                path: path.clone(),
            },
        );
    }

    let url = format!("index.html?window=sticked&id={}&viewing=true", id);

    let saved_settings = settings::load_settings_from_file().ok();
    let (width, height) = saved_settings
        .as_ref()
        .and_then(|s| s.viewing_window_size)
        .unwrap_or((450.0, 320.0));
    let saved_position = saved_settings
        .as_ref()
        .and_then(|s| s.viewing_window_position);

    // Build hidden — we position after creation using PhysicalPosition to avoid
    // the logical/physical mismatch in WebviewWindowBuilder::position().
    let builder = WebviewWindowBuilder::new(&app, &window_label, WebviewUrl::App(url.into()))
        .title("View Note")
        .inner_size(width, height)
        .min_inner_size(320.0, 200.0)
        .max_inner_size(800.0, 600.0)
        .resizable(true)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false);

    let window = builder.build();

    match window {
        Ok(win) => {
            // Restore saved position in physical pixels, or center as fallback.
            let positioned = saved_position
                .is_some_and(|(x, y)| is_window_visible_on_any_monitor(&app, x, y, width, height));
            if let (true, Some((x, y))) = (positioned, saved_position) {
                let _ = win.set_position(tauri::Position::Physical(PhysicalPosition::new(
                    x as i32, y as i32,
                )));
            } else {
                let _ = win.center();
            }

            let _ = win.show();
            let _ = win.set_focus();
            Ok(true)
        }
        Err(e) => Err(format!("Failed to create viewing window: {}", e)),
    }
}

#[tauri::command]
pub fn get_viewing_note_content(app: AppHandle, id: String) -> Result<serde_json::Value, String> {
    let state = app.state::<AppState>();
    let viewing_notes = state
        .viewing_notes
        .lock()
        .unwrap_or_else(|e| e.into_inner());

    if let Some(note) = viewing_notes.get(&id) {
        Ok(serde_json::json!({
            "id": note.id,
            "content": note.content,
            "folder": note.folder,
            "path": note.path
        }))
    } else {
        Err("Viewing note content not found".to_string())
    }
}

#[tauri::command]
pub fn transfer_to_capture(
    app: AppHandle,
    content: String,
    folder: String,
) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("postit") {
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.emit(
            "transfer-content",
            serde_json::json!({
                "content": content,
                "folder": folder
            }),
        );
        Ok(true)
    } else {
        Err("Postit window not found".to_string())
    }
}

#[tauri::command]
pub fn open_command_palette(app: AppHandle) -> Result<bool, String> {
    show_command_palette(&app);
    Ok(true)
}

#[tauri::command]
pub fn open_search(app: AppHandle) -> Result<bool, String> {
    show_command_palette(&app);
    Ok(true)
}

#[tauri::command]
pub fn open_manager(app: AppHandle) -> Result<bool, String> {
    show_command_palette(&app);
    Ok(true)
}

#[tauri::command]
pub fn open_settings(app: AppHandle) -> Result<bool, String> {
    show_settings(&app);
    Ok(true)
}

#[tauri::command]
pub fn preview_image(app: AppHandle, src: String, alt: String) -> Result<bool, String> {
    if src.trim().is_empty() {
        return Err("Image source is empty".to_string());
    }

    let payload = ImagePreviewContent { src, alt };
    {
        let state = app.state::<AppState>();
        let mut image_preview = state
            .image_preview
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        *image_preview = Some(payload.clone());
    }

    if let Some(window) = app.get_webview_window("image-preview") {
        let _ = window.emit("image-preview-updated", &payload);
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(true);
    }

    let title = settings::load_settings_from_file()
        .ok()
        .and_then(|s| s.locale)
        .filter(|locale| locale == "zh-CN")
        .map(|_| "图片预览")
        .unwrap_or("Image Preview");

    let window = WebviewWindowBuilder::new(
        &app,
        "image-preview",
        WebviewUrl::App("index.html?window=image-preview".into()),
    )
    .title(title)
    .inner_size(860.0, 640.0)
    .min_inner_size(360.0, 260.0)
    .resizable(true)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .center()
    .build();

    match window {
        Ok(win) => {
            let _ = win.show();
            let _ = win.set_focus();
            Ok(true)
        }
        Err(e) => Err(format!("Failed to create image preview window: {}", e)),
    }
}

#[tauri::command]
pub fn get_image_preview_content(app: AppHandle) -> Result<ImagePreviewContent, String> {
    let state = app.state::<AppState>();
    let image_preview = state
        .image_preview
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    image_preview
        .clone()
        .ok_or_else(|| "No image preview available".to_string())
}

#[tauri::command]
pub async fn reopen_last_note(app: AppHandle) -> Result<bool, String> {
    let (path, folder) = {
        let state = app.state::<AppState>();
        let last = state
            .last_saved_note
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        match last.as_ref() {
            Some(note) => (note.path.clone(), note.folder.clone()),
            None => return Err("No note saved yet".to_string()),
        }
    };

    let content = notes::get_note_content_inner(&path)?;
    open_note_for_viewing(app, content, folder, path).await
}

pub fn show_apple_notes_picker(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("apple-notes-picker") {
        let _ = window.show();
        let _ = window.set_focus();
        return;
    }

    let window = WebviewWindowBuilder::new(
        app,
        "apple-notes-picker",
        WebviewUrl::App("index.html?window=apple-notes-picker".into()),
    )
    .title("Import from Apple Notes")
    .inner_size(550.0, 500.0)
    .resizable(false)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .center()
    .build();

    if let Ok(win) = window {
        let app_handle = app.clone();
        win.on_window_event(move |event| {
            if let tauri::WindowEvent::Focused(focused) = event {
                if !focused {
                    if let Some(w) = app_handle.get_webview_window("apple-notes-picker") {
                        let _ = w.close();
                    }
                }
            }
        });
    }
}

#[tauri::command]
pub fn show_apple_notes_picker_cmd(app: AppHandle) -> Result<bool, String> {
    show_apple_notes_picker(&app);
    Ok(true)
}

pub fn restore_sticked_notes(app: &AppHandle) {
    if let Ok(notes) = sticked_notes::list_sticked_notes() {
        for note in notes {
            let _ = create_sticked_window(app.clone(), note);
        }
    }
}

pub fn restore_session_draft_windows(app: &AppHandle) {
    let Ok(drafts) = session_drafts::list_session_drafts_inner() else {
        return;
    };

    for draft in drafts {
        if draft.content.trim().is_empty()
            && matches!(draft.kind, session_drafts::SessionDraftKind::New)
        {
            continue;
        }

        let label = format!("draft-{}", safe_window_label(&draft.id));
        if app.get_webview_window(&label).is_some() {
            continue;
        }

        let (width, height) = draft
            .geometry
            .as_ref()
            .map(|geometry| (geometry.width, geometry.height))
            .unwrap_or((450.0, 320.0));
        let url = format!(
            "index.html?window=session-draft&id={}",
            encode_query_component(&draft.id)
        );

        let window = WebviewWindowBuilder::new(app, &label, WebviewUrl::App(url.into()))
            .title("Recovered Draft")
            .inner_size(width, height)
            .min_inner_size(320.0, 200.0)
            .max_inner_size(900.0, 700.0)
            .resizable(true)
            .decorations(false)
            .transparent(true)
            .always_on_top(true)
            .skip_taskbar(true)
            .visible(false)
            .build();

        if let Ok(win) = window {
            if let Some(geometry) = draft.geometry {
                let visible = is_window_visible_on_any_monitor(
                    app,
                    geometry.x,
                    geometry.y,
                    geometry.width,
                    geometry.height,
                );
                if visible {
                    let _ = win.set_position(tauri::Position::Physical(PhysicalPosition::new(
                        geometry.x as i32,
                        geometry.y as i32,
                    )));
                } else {
                    let _ = win.center();
                }
            } else {
                let _ = win.center();
            }
            let _ = win.show();
        }
    }
}

fn safe_window_label(value: &str) -> String {
    value
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '-' })
        .collect()
}

fn encode_query_component(value: &str) -> String {
    let mut encoded = String::with_capacity(value.len());
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(byte as char)
            }
            _ => encoded.push_str(&format!("%{byte:02X}")),
        }
    }
    encoded
}

#[cfg(test)]
mod tests {
    use super::{
        capture_position_near_cursor, remember_last_note, DesktopRect, SETTINGS_WINDOW_MIN_WIDTH,
        SETTINGS_WINDOW_WIDTH,
    };
    use crate::state::AppState;

    #[test]
    fn remember_last_note_updates_state_for_shortcuts() {
        let state = AppState::new();
        remember_last_note(&state, "/tmp/stik/foo.md", "Inbox");

        let last = state
            .last_saved_note
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        let note = last.as_ref().expect("last note should be set");
        assert_eq!(note.path, "/tmp/stik/foo.md");
        assert_eq!(note.folder, "Inbox");
    }

    #[test]
    fn settings_window_min_width_is_large_enough_for_full_menu_bar() {
        assert!(SETTINGS_WINDOW_MIN_WIDTH >= 760.0);
        assert!(SETTINGS_WINDOW_WIDTH > SETTINGS_WINDOW_MIN_WIDTH);
    }

    #[test]
    fn capture_position_opens_near_cursor_with_offset() {
        let monitors = [DesktopRect {
            x: 0.0,
            y: 0.0,
            width: 1440.0,
            height: 900.0,
        }];

        let pos = capture_position_near_cursor((320.0, 240.0), (400.0, 280.0), &monitors);

        assert_eq!(pos, Some((338.0, 258.0)));
    }

    #[test]
    fn capture_position_clamps_to_monitor_edges() {
        let monitors = [DesktopRect {
            x: 0.0,
            y: 0.0,
            width: 1440.0,
            height: 900.0,
        }];

        let pos = capture_position_near_cursor((1390.0, 860.0), (400.0, 280.0), &monitors);

        assert_eq!(pos, Some((1024.0, 604.0)));
    }

    #[test]
    fn capture_position_supports_negative_coordinate_monitors() {
        let monitors = [
            DesktopRect {
                x: -1280.0,
                y: 0.0,
                width: 1280.0,
                height: 800.0,
            },
            DesktopRect {
                x: 0.0,
                y: 0.0,
                width: 1440.0,
                height: 900.0,
            },
        ];

        let pos = capture_position_near_cursor((-1200.0, 120.0), (400.0, 280.0), &monitors);

        assert_eq!(pos, Some((-1182.0, 138.0)));
    }
}
