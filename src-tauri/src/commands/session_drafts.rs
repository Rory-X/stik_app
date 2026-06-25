use super::versioning;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SessionDraftKind {
    New,
    Edit,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SessionDraftCursor {
    pub head: usize,
    pub anchor: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SessionDraftGeometry {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SessionDraftSnapshot {
    pub id: String,
    pub kind: SessionDraftKind,
    pub content: String,
    pub folder: String,
    pub original_path: Option<String>,
    pub base_modified_at: Option<String>,
    pub cursor: Option<SessionDraftCursor>,
    pub geometry: Option<SessionDraftGeometry>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SessionDraftStore {
    pub drafts: Vec<SessionDraftSnapshot>,
}

fn get_session_drafts_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    let stik_config = home.join(".stik");
    fs::create_dir_all(&stik_config).map_err(|e| e.to_string())?;
    Ok(stik_config.join("session_drafts.json"))
}

fn load_session_draft_store() -> Result<SessionDraftStore, String> {
    let path = get_session_drafts_path()?;
    match versioning::load_versioned::<SessionDraftStore>(&path)? {
        Some(store) => Ok(store),
        None => Ok(SessionDraftStore::default()),
    }
}

fn save_session_draft_store(store: &SessionDraftStore) -> Result<(), String> {
    let path = get_session_drafts_path()?;
    versioning::save_versioned(&path, store)
}

pub fn list_session_drafts_inner() -> Result<Vec<SessionDraftSnapshot>, String> {
    let mut drafts = load_session_draft_store()?.drafts;
    drafts.sort_by(|a, b| a.updated_at.cmp(&b.updated_at));
    Ok(drafts)
}

#[tauri::command]
pub fn list_session_drafts() -> Result<Vec<SessionDraftSnapshot>, String> {
    list_session_drafts_inner()
}

#[tauri::command]
pub fn get_session_draft(id: String) -> Result<SessionDraftSnapshot, String> {
    load_session_draft_store()?
        .drafts
        .into_iter()
        .find(|draft| draft.id == id)
        .ok_or_else(|| format!("Session draft not found: {id}"))
}

#[tauri::command]
pub fn upsert_session_draft(draft: SessionDraftSnapshot) -> Result<SessionDraftSnapshot, String> {
    let mut store = load_session_draft_store()?;

    if let Some(existing) = store.drafts.iter_mut().find(|item| item.id == draft.id) {
        *existing = draft.clone();
    } else {
        store.drafts.push(draft.clone());
    }

    save_session_draft_store(&store)?;
    Ok(draft)
}

#[tauri::command]
pub fn delete_session_draft(id: String) -> Result<bool, String> {
    let mut store = load_session_draft_store()?;
    let before = store.drafts.len();
    store.drafts.retain(|draft| draft.id != id);
    if store.drafts.len() != before {
        save_session_draft_store(&store)?;
    }
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::{SessionDraftKind, SessionDraftSnapshot};

    #[test]
    fn serializes_snapshot_with_camel_case_fields() {
        let snapshot = SessionDraftSnapshot {
            id: "edit:abc".to_string(),
            kind: SessionDraftKind::Edit,
            content: "hello".to_string(),
            folder: "Inbox".to_string(),
            original_path: Some("/tmp/a.md".to_string()),
            base_modified_at: Some("2026-06-25T00:00:00Z".to_string()),
            cursor: None,
            geometry: None,
            updated_at: "2026-06-25T00:00:01Z".to_string(),
        };

        let value = serde_json::to_value(snapshot).unwrap();
        assert_eq!(value["originalPath"], "/tmp/a.md");
        assert_eq!(value["baseModifiedAt"], "2026-06-25T00:00:00Z");
        assert_eq!(value["updatedAt"], "2026-06-25T00:00:01Z");
        assert_eq!(value["kind"], "edit");
    }
}
