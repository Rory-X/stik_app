use crate::commands::{settings, stats};
use crate::windows::{show_command_palette, show_postit_with_folder, show_settings};
use tauri::image::Image;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::App;

pub fn setup_tray(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let current_settings = settings::get_settings().unwrap_or_default();
    let locale = current_settings.locale.as_deref();
    let streak_days = stats::calculate_and_persist_capture_streak().unwrap_or_else(|e| {
        eprintln!("Failed to compute capture streak: {}", e);
        0
    });
    let streak_label = stats::format_capture_streak_label_for_locale(streak_days, locale);

    let quit = MenuItem::with_id(
        app,
        "quit",
        tray_label(locale, "Quit Stik", "退出 Stik"),
        true,
        None::<&str>,
    )?;
    let new_note = MenuItem::with_id(
        app,
        "new_note",
        tray_label(locale, "New Note", "新建笔记"),
        true,
        None::<&str>,
    )?;
    let open_stik = MenuItem::with_id(
        app,
        "open_stik",
        tray_label(locale, "Open Stik", "打开 Stik"),
        true,
        None::<&str>,
    )?;
    let open_settings = MenuItem::with_id(
        app,
        "open_settings",
        tray_label(locale, "Settings", "设置"),
        true,
        None::<&str>,
    )?;
    let capture_streak =
        MenuItem::with_id(app, "capture_streak", &streak_label, false, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &new_note,
            &open_stik,
            &open_settings,
            &capture_streak,
            &quit,
        ],
    )?;

    let tray_icon = Image::from_bytes(include_bytes!("../icons/tray-icon.png"))?;

    let _tray = TrayIconBuilder::with_id("main-tray")
        .icon(tray_icon)
        .icon_as_template(true)
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "quit" => {
                app.exit(0);
            }
            "new_note" => {
                let settings = settings::get_settings().unwrap_or_default();
                show_postit_with_folder(app, &settings.default_folder);
            }
            "open_stik" => {
                show_command_palette(app);
            }
            "open_settings" => {
                show_settings(app);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}

fn tray_label<'a>(locale: Option<&str>, en: &'a str, zh_cn: &'a str) -> &'a str {
    if locale == Some("zh-CN") {
        zh_cn
    } else {
        en
    }
}
