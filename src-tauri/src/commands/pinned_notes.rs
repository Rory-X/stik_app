use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use super::folders::get_stik_folder;
use super::versioning;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PinnedNote {
    pub path: String,
    pub pinned_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PinnedNotesStore {
    pub notes: Vec<PinnedNote>,
}

fn get_pinned_notes_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    let stik_config = home.join(".stik");
    fs::create_dir_all(&stik_config).map_err(|e| e.to_string())?;
    Ok(stik_config.join("pinned_notes.json"))
}

fn load_pinned_notes() -> Result<PinnedNotesStore, String> {
    let path = get_pinned_notes_path()?;
    match versioning::load_versioned::<PinnedNotesStore>(&path)? {
        Some(store) => Ok(store),
        None => Ok(PinnedNotesStore::default()),
    }
}

fn save_pinned_notes(store: &PinnedNotesStore) -> Result<(), String> {
    let path = get_pinned_notes_path()?;
    versioning::save_versioned(&path, store)
}

fn canonical_or_original(path: &Path) -> PathBuf {
    path.canonicalize().unwrap_or_else(|_| path.to_path_buf())
}

fn ensure_stik_note_path(path: &str) -> Result<(), String> {
    let stik_folder = get_stik_folder()?;
    let note_path = PathBuf::from(path);
    let canonical_stik = canonical_or_original(&stik_folder);
    let canonical_note = canonical_or_original(&note_path);

    if !canonical_note.starts_with(&canonical_stik) {
        return Err("Invalid path: note must be within Stik folder".to_string());
    }
    if !super::storage::path_exists(path) {
        return Err("Note file does not exist".to_string());
    }

    Ok(())
}

pub fn load_pinned_lookup() -> Result<HashMap<String, String>, String> {
    let store = load_pinned_notes()?;
    Ok(store
        .notes
        .into_iter()
        .map(|note| (note.path, note.pinned_at))
        .collect())
}

pub fn is_note_pinned(path: &str) -> bool {
    load_pinned_notes()
        .map(|store| store.notes.iter().any(|note| note.path == path))
        .unwrap_or(false)
}

pub fn pin_order(path: &str) -> Option<String> {
    load_pinned_lookup()
        .ok()
        .and_then(|lookup| lookup.get(path).cloned())
}

pub fn remove_pinned_note(path: &str) -> Result<(), String> {
    let mut store = load_pinned_notes()?;
    let initial_len = store.notes.len();
    store.notes.retain(|note| note.path != path);
    if store.notes.len() != initial_len {
        save_pinned_notes(&store)?;
    }
    Ok(())
}

pub fn move_pinned_note(old_path: &str, new_path: &str) -> Result<(), String> {
    let mut store = load_pinned_notes()?;
    let mut changed = false;
    for note in &mut store.notes {
        if note.path == old_path {
            note.path = new_path.to_string();
            changed = true;
        }
    }
    if changed {
        save_pinned_notes(&store)?;
    }
    Ok(())
}

#[tauri::command]
pub fn toggle_note_pinned(path: String) -> Result<bool, String> {
    ensure_stik_note_path(&path)?;

    let mut store = load_pinned_notes()?;
    if let Some(index) = store.notes.iter().position(|note| note.path == path) {
        store.notes.remove(index);
        save_pinned_notes(&store)?;
        Ok(false)
    } else {
        store.notes.push(PinnedNote {
            path,
            pinned_at: chrono::Utc::now().to_rfc3339(),
        });
        save_pinned_notes(&store)?;
        Ok(true)
    }
}
