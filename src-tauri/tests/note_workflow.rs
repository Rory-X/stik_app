//! Real local storage workflow, without a GUI, account, Keychain, or mocked I/O.
#![cfg(debug_assertions)]

use stik_lib::{
    cursor_positions, index::NoteIndex, notes, paths, pinned_notes, session_drafts, settings,
    storage, trash,
};

#[test]
fn isolated_capture_read_search_update_and_trash() {
    let directory = std::env::temp_dir().join(format!("stik-workflow-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&directory).unwrap();
    let directory = directory.canonicalize().unwrap();
    // This integration-test executable has one test and its own process environment.
    std::env::set_var("STIK_DEV_ROOT", &directory);
    eprintln!("Smoke data (retained on failure): {}", directory.display());

    let config = settings::get_settings().unwrap();
    assert!(!config.icloud.enabled && !config.git_sharing.enabled && !config.analytics_enabled);
    assert!(!config.ai_features_enabled && !config.auto_update_enabled);
    assert!(config.shortcut_mappings.is_empty());
    assert!(config.system_shortcuts.values().all(String::is_empty));
    assert_eq!(paths::config_dir().unwrap(), directory.join("config"));
    assert_eq!(
        storage::configured_stik_root().unwrap(),
        directory.join("notes")
    );

    let original = "Agent QA capture\nA café rendezvous with a unique marker.";
    let saved = notes::save_note_inner("QA/Nested".into(), original.into()).unwrap();
    assert!(std::path::Path::new(&saved.path).starts_with(directory.join("notes/QA/Nested")));
    assert_eq!(
        notes::get_note_content_inner(&saved.path).unwrap(),
        original
    );

    let index = NoteIndex::new();
    index.build().unwrap();
    let matches = index.search("CAFÉ", Some("QA/Nested")).unwrap();
    assert_eq!(matches.len(), 1);
    assert_eq!(matches[0].0.path, saved.path);
    assert!(index.search("CAFÉ", Some("Elsewhere")).unwrap().is_empty());

    storage::write_file(&saved.path, "Updated capture: second marker").unwrap();
    index.add(&saved.path, "QA/Nested");
    assert!(index.search("rendezvous", None).unwrap().is_empty());
    assert_eq!(index.search("second marker", None).unwrap().len(), 1);
    cursor_positions::save_cursor_position(saved.path.clone(), 7, 7).unwrap();
    assert_eq!(
        cursor_positions::get_cursor_position(saved.path.clone())
            .unwrap()
            .unwrap()
            .head,
        7
    );
    assert!(directory.join("config/cursor_positions.json").is_file());

    let root = storage::stik_root().unwrap();
    let trashed = trash::trash_managed_note(&root, std::path::Path::new(&saved.path)).unwrap();
    assert!(!std::path::Path::new(&saved.path).exists());
    assert_eq!(
        trash::list_trashed_notes().unwrap(),
        std::slice::from_ref(&trashed)
    );
    let restored = trash::restore_trashed_note_at(&root, &trashed.id).unwrap();
    assert_eq!(
        std::fs::read_to_string(restored).unwrap(),
        "Updated capture: second marker"
    );
    assert!(notes::save_note_inner("../escape".into(), "Forbidden".into()).is_err());
    assert!(notes::get_note_content_inner(
        directory.join("config/settings.json").to_str().unwrap()
    )
    .is_err());

    // Independent capture windows must not overwrite one another's recovery state.
    let barrier = std::sync::Arc::new(std::sync::Barrier::new(8));
    let workers: Vec<_> = (0..8)
        .map(|number| {
            let barrier = barrier.clone();
            let saved =
                notes::save_note_inner("Pins".into(), format!("Pin fixture {number}")).unwrap();
            std::thread::spawn(move || {
                barrier.wait();
                assert!(pinned_notes::toggle_note_pinned(saved.path.clone()).unwrap());
                session_drafts::upsert_session_draft(session_drafts::SessionDraftSnapshot {
                    id: format!("new:{number}"),
                    kind: session_drafts::SessionDraftKind::New,
                    content: format!("Unsaved capture {number}"),
                    folder: "Pins".into(),
                    original_path: None,
                    base_modified_at: None,
                    cursor: None,
                    geometry: None,
                    updated_at: chrono::Utc::now().to_rfc3339(),
                })
                .unwrap();
                saved.path
            })
        })
        .collect();
    let pinned_paths: Vec<_> = workers
        .into_iter()
        .map(|worker| worker.join().unwrap())
        .collect();
    assert_eq!(pinned_notes::load_pinned_lookup().unwrap().len(), 8);
    assert_eq!(session_drafts::list_session_drafts().unwrap().len(), 8);
    assert!(directory.join("config/pinned_notes.json").is_file());
    assert!(directory.join("config/session_drafts.json").is_file());
    assert!(pinned_notes::toggle_note_pinned(
        directory
            .join("config/settings.json")
            .to_string_lossy()
            .into_owned()
    )
    .is_err());
    assert!(!pinned_notes::toggle_note_pinned(pinned_paths[0].clone()).unwrap());
    session_drafts::delete_session_draft("new:0".into()).unwrap();
    assert_eq!(pinned_notes::load_pinned_lookup().unwrap().len(), 7);
    assert_eq!(session_drafts::list_session_drafts().unwrap().len(), 7);

    std::fs::remove_dir_all(&directory).unwrap();
}
