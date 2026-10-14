import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type {
  NoteInfo,
  SearchResult,
  SemanticResult,
  FolderStats,
  StikSettings,
  TrashedNote,
} from "@/types";
import { createdNoteOpenPayload, noteInfosToSearchResults, sortPinnedFirst } from "@/utils/commandPaletteNotes";
import { canMoveNoteToFolder, ensureInboxFolderStats, folderNamesFromStats } from "@/utils/commandPaletteFolders";
import { usePlatformCapabilities } from "@/hooks/usePlatformCapabilities";
import { translateBackendError } from "@/i18n/errors";
import ConfirmDialog from "./ConfirmDialog";
import LockPrompt from "./LockPrompt";
import FolderSidebar from "./command-palette/FolderSidebar";
import NoteList from "./command-palette/NoteList";
import MovePicker from "./command-palette/MovePicker";
import { useTranslation } from "@/hooks/useTranslation";
import ActionToast from "./ActionToast";
import { createLatestRequestGate } from "@/utils/latestRequest";
import { errorMessage } from "@/utils/appError";
import LiveRegion from "./ui/LiveRegion";

const TOP_FOLDER_ID = "__stik_top__";

export default function CommandPalette() {
  const { t } = useTranslation();
  const capabilities = usePlatformCapabilities();
  // Search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [semanticResults, setSemanticResults] = useState<SemanticResult[]>([]);
  const [selectedNoteIndex, setSelectedNoteIndex] = useState(0);
  const [recentNotes, setRecentNotes] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Folder state
  const [folderStats, setFolderStats] = useState<FolderStats[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folderColors, setFolderColors] = useState<Record<string, string>>({});
  const [selectedFolderIndex, setSelectedFolderIndex] = useState(0);
  const [totalNoteCount, setTotalNoteCount] = useState(0);
  const [pinnedNoteCount, setPinnedNoteCount] = useState(0);

  // Pane focus: "left" = folder sidebar, "right" = note list
  const [focusPane, setFocusPane] = useState<"left" | "right">("right");

  // Folder management
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState("coral");
  const [isRenamingFolder, setIsRenamingFolder] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renamingFolderName, setRenamingFolderName] = useState<string | null>(
    null,
  );

  // New note creation
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState("");

  // Overlays
  const [confirmDelete, setConfirmDelete] = useState<{
    type: "note" | "folder";
    note?: SearchResult;
    folderName?: string;
  } | null>(null);
  const [showMoveModal, setShowMoveModal] = useState<SearchResult | null>(null);
  const [draggedNote, setDraggedNote] = useState<SearchResult | null>(null);
  const [lockPromptNote, setLockPromptNote] = useState<SearchResult | null>(
    null,
  );
  const [toast, setToast] = useState<string | null>(null);
  const [lastTrashed, setLastTrashed] = useState<TrashedNote | null>(null);

  // Sidebar position (persisted in settings)
  const [sidebarPosition, setSidebarPosition] = useState<"left" | "right">(
    "left",
  );
  const settingsRef = useRef<StikSettings | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const searchRequestGate = useRef(createLatestRequestGate());
  const recentRequestGate = useRef(createLatestRequestGate());
  const announcedSearchStatus = isSearching
    ? t("palette.searching")
    : query.trim()
      ? t("palette.resultsFound", {
          count: results.length + semanticResults.length,
        })
      : "";

  const visibleFolderStats = useMemo(() => ensureInboxFolderStats(folderStats), [folderStats]);
  const visibleFolders = useMemo(() => folderNamesFromStats(folderStats), [folderStats]);
  const selectedFolderLabel = selectedFolder === TOP_FOLDER_ID ? t("command.top") : selectedFolder || "";

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Load folder stats with accurate note counts from the NoteIndex
  const loadFolderStats = useCallback(async () => {
    try {
      const [stats, allNotes] = await Promise.all([
        invoke<FolderStats[]>("get_folder_stats"),
        invoke<NoteInfo[]>("list_notes", { folder: null }),
      ]);

      setFolderStats(stats);
      setTotalNoteCount(allNotes.length);
      setPinnedNoteCount(allNotes.filter((note) => note.pinned).length);
    } catch (error) {
      console.error("Failed to load folder stats:", error);
      setToast(errorMessage(error, t("common.unknownError")));
    }
  }, [t]);

  useEffect(() => {
    loadFolderStats();
    invoke<StikSettings>("get_settings")
      .then((s) => {
        settingsRef.current = s;
        setFolderColors(s.folder_colors ?? {});
        if (s.sidebar_position === "right") setSidebarPosition("right");
      })
      .catch((error) => setToast(errorMessage(error, t("common.unknownError"))));

    const unlistenSettings = listen<StikSettings>(
      "settings-changed",
      (event) => {
        settingsRef.current = event.payload;
        setFolderColors(event.payload.folder_colors ?? {});
      },
    );

    return () => {
      unlistenSettings.then((fn) => fn());
    };
  }, [loadFolderStats, t]);

  // Load recent notes when folder filter changes
  useEffect(() => {
    const gate = recentRequestGate.current;
    const token = gate.begin();

    void invoke<NoteInfo[]>("list_notes", { folder: selectedFolder === TOP_FOLDER_ID ? null : selectedFolder })
      .then((notes) => {
        if (!gate.isLatest(token)) return;
        const visible = selectedFolder === TOP_FOLDER_ID ? notes.filter((note) => note.pinned) : notes;
        setRecentNotes(sortPinnedFirst(noteInfosToSearchResults(visible)));
      })
      .catch((error) => {
        if (gate.isLatest(token)) {
          console.error("Failed to load recent notes:", error);
        }
      });

    return () => {
      if (gate.isLatest(token)) gate.invalidate();
    };
  }, [selectedFolder]);

  // Search: text + semantic in parallel (debounced)
  useEffect(() => {
    const gate = searchRequestGate.current;
    const token = gate.begin();

    if (!query.trim()) {
      setResults(recentNotes);
      setSemanticResults([]);
      setSelectedNoteIndex(0);
      setIsSearching(false);
      return () => {
        if (gate.isLatest(token)) gate.invalidate();
      };
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const trimmed = query.trim();

      const [textResult, semanticResult] = await Promise.allSettled([
        invoke<SearchResult[]>("search_notes", {
          query: trimmed,
          folder: selectedFolder === TOP_FOLDER_ID ? null : selectedFolder,
        }),
        capabilities.semantic_search && selectedFolder !== TOP_FOLDER_ID ? invoke<SemanticResult[]>("semantic_search", {
          query: trimmed,
          folder: selectedFolder === TOP_FOLDER_ID ? null : selectedFolder,
        }) : Promise.resolve([] as SemanticResult[]),
      ]);

      if (!gate.isLatest(token)) return;

      const textResults =
        textResult.status === "fulfilled" ? textResult.value : [];
      const visibleTextResults = selectedFolder === TOP_FOLDER_ID ? textResults.filter((note) => note.pinned) : textResults;
      setResults(sortPinnedFirst(visibleTextResults));

      if (semanticResult.status === "fulfilled") {
        const textPaths = new Set(visibleTextResults.map((r) => r.path));
        setSemanticResults(
          semanticResult.value.filter((r) => !textPaths.has(r.path)),
        );
      } else {
        setSemanticResults([]);
      }

      setSelectedNoteIndex(0);
      setIsSearching(false);
    }, 200);

    return () => {
      clearTimeout(timer);
      if (gate.isLatest(token)) gate.invalidate();
    };
  }, [query, recentNotes, selectedFolder, capabilities.semantic_search]);

  // Keep selectedFolderIndex in sync with selectedFolder
  useEffect(() => {
    if (selectedFolder === null) {
      setSelectedFolderIndex(0);
    } else if (selectedFolder === TOP_FOLDER_ID) {
      setSelectedFolderIndex(1);
    } else {
      const idx = visibleFolderStats.findIndex(
        (f) => f.name === selectedFolder,
      );
      setSelectedFolderIndex(idx >= 0 ? idx + 2 : 0);
    }
  }, [selectedFolder, visibleFolderStats]);

  // Scroll selected note into view
  useEffect(() => {
    if (resultsRef.current) {
      const items = resultsRef.current.querySelectorAll<HTMLElement>("button");
      if (items[selectedNoteIndex]) {
        items[selectedNoteIndex].scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedNoteIndex]);

  const closePalette = useCallback(async () => {
    try {
      await getCurrentWindow().close();
    } catch {
      await invoke("hide_window");
    }
  }, []);

  const openNote = useCallback(
    async (result: SearchResult) => {
      try {
        const content = result.locked
          ? await invoke<string>("read_locked_note", { path: result.path })
          : await invoke<string>("get_note_content", { path: result.path });
        await invoke("open_note_for_viewing", {
          content,
          folder: result.folder,
          path: result.path,
        });
        closePalette();
      } catch (error) {
        console.error("Failed to open note:", error);
        setToast(errorMessage(error, t("note.failedToLoad")));
      }
    },
    [closePalette, t],
  );

  const handleSelectResult = useCallback(
    async (result: SearchResult) => {
      if (result.locked) {
        // No unlock method on this platform yet: refuse instead of failing in
        // the backend or letting the ciphertext open in the editor.
        if (!capabilities.note_lock) {
          setToast(t("command.toast.lockedUnsupported"));
          return;
        }
        const authed = await invoke<boolean>("is_authenticated").catch(
          () => false,
        );
        if (authed) {
          await openNote(result);
        } else {
          setLockPromptNote(result);
        }
        return;
      }
      await openNote(result);
    },
    [openNote, capabilities.note_lock, t],
  );

  const refreshAfterChange = useCallback(async () => {
    const gate = searchRequestGate.current;
    const token = gate.begin();
    try {
      await loadFolderStats();
      const notes = await invoke<NoteInfo[]>("list_notes", {
        folder: selectedFolder === TOP_FOLDER_ID ? null : selectedFolder,
      });
      if (!gate.isLatest(token)) return;
      const visible = selectedFolder === TOP_FOLDER_ID ? notes.filter((note) => note.pinned) : notes;
      const recent = sortPinnedFirst(noteInfosToSearchResults(visible));
      setRecentNotes(recent);

      if (query.trim()) {
        const searchResults = await invoke<SearchResult[]>("search_notes", {
          query: query.trim(),
          folder: selectedFolder === TOP_FOLDER_ID ? null : selectedFolder,
        });
        if (!gate.isLatest(token)) return;
        const visibleResults = selectedFolder === TOP_FOLDER_ID ? searchResults.filter((note) => note.pinned) : searchResults;
        const sortedResults = sortPinnedFirst(visibleResults);
        setResults(sortedResults);
        if (selectedFolder === TOP_FOLDER_ID) setSemanticResults([]);
        setSemanticResults([]);
        setSelectedNoteIndex((i) => Math.max(0, Math.min(i, sortedResults.length - 1)));
      } else {
        setResults(recent);
        setSemanticResults([]);
        setSelectedNoteIndex((i) => Math.max(0, Math.min(i, recent.length - 1)));
      }
    } catch (error) {
      if (gate.isLatest(token)) {
        console.error("Failed to refresh search results:", error);
      }
    } finally {
      if (gate.isLatest(token)) setIsSearching(false);
    }
  }, [loadFolderStats, query, selectedFolder]);

  // Refresh note list when files change externally (local watcher or iCloud sync)
  useEffect(() => {
    const unlistenFiles = listen("files-changed", () => {
      refreshAfterChange();
    });
    const unlistenICloud = listen("icloud-files-changed", () => {
      refreshAfterChange();
    });
    return () => {
      unlistenFiles.then((fn) => fn());
      unlistenICloud.then((fn) => fn());
    };
  }, [refreshAfterChange]);

  // Delete note
  const handleDeleteNote = useCallback(
    async (note: SearchResult) => {
      try {
        const trashed = await invoke<TrashedNote>("delete_note", {
          path: note.path,
        });
        setLastTrashed(trashed);
        setToast(t("trash.noteMoved"));
        setConfirmDelete(null);
        await refreshAfterChange();
      } catch (error) {
        console.error("Failed to delete note:", error);
        setToast(errorMessage(error, t("common.unknownError")));
      }
    },
    [refreshAfterChange, t],
  );

  const undoDelete = useCallback(
    async (entry: TrashedNote) => {
      try {
        await invoke<string>("restore_trashed_note", { id: entry.id });
        setLastTrashed(null);
        setToast(t("trash.noteRestored"));
        await emit("files-changed", []);
        await refreshAfterChange();
      } catch (error) {
        console.error("Failed to restore note:", error);
        setLastTrashed(null);
        setToast(t("trash.restoreFailed", {
          error: errorMessage(error, t("common.unknownError")),
        }));
      }
    },
    [refreshAfterChange, t],
  );

  // Delete folder
  const handleDeleteFolder = useCallback(
    async (folderName: string) => {
      try {
        await invoke("delete_folder", { name: folderName });
        setConfirmDelete(null);
        if (selectedFolder === folderName) {
          setSelectedFolder(null);
        }
        // Re-fetch settings (folder deletion may affect them) and notify other windows
        const fresh = await invoke<StikSettings>("get_settings");
        settingsRef.current = fresh;
        await emit("settings-changed", fresh);
        await refreshAfterChange();
      } catch (error) {
        console.error("Failed to delete folder:", error);
        setToast(errorMessage(error, t("common.unknownError")));
      }
    },
    [selectedFolder, refreshAfterChange, t],
  );

  // Move note
  const handleMoveNote = useCallback(
    async (note: SearchResult, targetFolder: string) => {
      if (!canMoveNoteToFolder(note, targetFolder)) {
        setShowMoveModal(null);
        return;
      }
      try {
        await invoke("move_note", { path: note.path, targetFolder });
        setShowMoveModal(null);
        setDraggedNote(null);
        await refreshAfterChange();
        setToast(t("command.toast.noteMoved", { folder: targetFolder }));
      } catch (error) {
        console.error("Failed to move note:", error);
        setToast(errorMessage(error, t("common.unknownError")));
      }
    },
    [refreshAfterChange, t],
  );

  const handleDropNoteOnFolder = useCallback(
    (targetFolder: string) => {
      if (!draggedNote || !canMoveNoteToFolder(draggedNote, targetFolder)) {
        setDraggedNote(null);
        return;
      }

      handleMoveNote(draggedNote, targetFolder);
    },
    [draggedNote, handleMoveNote],
  );

  // Save settings helper — keeps settingsRef in sync and notifies other windows
  const saveAndEmitSettings = useCallback(
    async (patch: Partial<StikSettings>) => {
      const current =
        settingsRef.current ?? (await invoke<StikSettings>("get_settings"));
      const updated = { ...current, ...patch };
      settingsRef.current = updated;
      await invoke("save_settings", { settings: updated });
      await emit("settings-changed", updated);
    },
    [],
  );

  // Create folder
  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) {
      setIsCreatingFolder(false);
      setNewFolderName("");
      return;
    }
    try {
      await invoke("create_folder", { name: newFolderName.trim() });
      if (newFolderColor !== "coral") {
        const updatedColors = {
          ...folderColors,
          [newFolderName.trim()]: newFolderColor,
        };
        setFolderColors(updatedColors);
        await saveAndEmitSettings({ folder_colors: updatedColors });
      }
      setIsCreatingFolder(false);
      setNewFolderName("");
      setNewFolderColor("coral");
      await refreshAfterChange();
      setSelectedFolder(newFolderName.trim());
    } catch (error) {
      console.error("Failed to create folder:", error);
      setToast(errorMessage(error, t("common.unknownError")));
    }
  }, [
    newFolderName,
    newFolderColor,
    folderColors,
    refreshAfterChange,
    saveAndEmitSettings,
    t,
  ]);

  // Rename folder
  const handleRenameFolder = useCallback(async () => {
    if (
      !renameValue.trim() ||
      !renamingFolderName ||
      renameValue === renamingFolderName
    ) {
      setIsRenamingFolder(false);
      setRenameValue("");
      setRenamingFolderName(null);
      return;
    }
    try {
      await invoke("rename_folder", {
        oldName: renamingFolderName,
        newName: renameValue.trim(),
      });
      setIsRenamingFolder(false);
      setRenameValue("");
      const oldName = renamingFolderName;
      setRenamingFolderName(null);
      await refreshAfterChange();
      if (selectedFolder === oldName) {
        setSelectedFolder(renameValue.trim());
      }
    } catch (error) {
      console.error("Failed to rename folder:", error);
      setToast(errorMessage(error, t("common.unknownError")));
    }
  }, [renameValue, renamingFolderName, selectedFolder, refreshAfterChange, t]);

  // Set folder color (during rename)
  const handleSetFolderColor = useCallback(
    async (colorKey: string) => {
      if (!renamingFolderName) return;
      const updatedColors = { ...folderColors, [renamingFolderName]: colorKey };
      setFolderColors(updatedColors);
      try {
        await saveAndEmitSettings({ folder_colors: updatedColors });
      } catch (error) {
        console.error("Failed to save folder color:", error);
        setToast(errorMessage(error, t("common.unknownError")));
      }
    },
    [renamingFolderName, folderColors, saveAndEmitSettings, t],
  );

  // Create new note in selected folder
  const handleCreateNote = useCallback(async () => {
    const title = newNoteTitle.trim();
    if (!title) {
      setIsCreatingNote(false);
      setNewNoteTitle("");
      return;
    }

    // Default to first available folder if "All" is selected
    const targetFolder = selectedFolder && selectedFolder !== TOP_FOLDER_ID ? selectedFolder : visibleFolders[0];
    if (!targetFolder) {
      setToast(t("palette.createFolderFirst"));
      return;
    }

    try {
      const content = `# ${title}\n\n`;
      const saved = await invoke<{ path: string; folder: string; filename: string }>("save_note", { folder: targetFolder, content });
      setIsCreatingNote(false);
      setNewNoteTitle("");
      await refreshAfterChange();

      const payload = createdNoteOpenPayload(saved, content);
      if (!payload) return;
      await invoke("open_note_for_viewing", { ...payload });
      await closePalette();
    } catch (error) {
      console.error("Failed to create note:", error);
      setToast(errorMessage(error, t("postit.saveFailed")));
    }
  }, [newNoteTitle, selectedFolder, visibleFolders, refreshAfterChange, closePalette, t]);

  // Select folder from sidebar
  const handleSelectFolder = useCallback((folder: string | null) => {
    setSelectedFolder(folder);
    setFocusPane("right");
    setSelectedNoteIndex(0);
  }, []);

  const handleTogglePinned = useCallback(
    async (note: SearchResult | SemanticResult) => {
      try {
        const pinned = await invoke<boolean>("toggle_note_pinned", {
          path: note.path,
        });
        setToast(
          pinned
            ? t("command.toast.notePinned")
            : t("command.toast.noteUnpinned"),
        );
        await refreshAfterChange();
      } catch (error) {
        console.error("Failed to toggle note pin:", error);
        setToast(translateBackendError(error, t));
      }
    },
    [refreshAfterChange, t],
  );

  // Keyboard handler
  useEffect(() => {
    // Skip keyboard when overlays are active (they handle their own keys)
    if (confirmDelete || showMoveModal || lockPromptNote) return;
    // Skip when inline editing (create/rename handle their own keys via stopPropagation)
    if (isCreatingFolder || isRenamingFolder || isCreatingNote) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Tab: toggle pane focus
      if (e.key === "Tab" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setFocusPane((p) => (p === "left" ? "right" : "left"));
        return;
      }

      // Escape: close palette
      if (e.key === "Escape") {
        e.preventDefault();
        closePalette();
        return;
      }

      // Any printable character: focus search input + right pane
      if (
        e.key.length === 1 &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        document.activeElement !== inputRef.current
      ) {
        inputRef.current?.focus();
        setFocusPane("right");
        return; // Let the key propagate to the input
      }

      if (focusPane === "right") {
        const totalItems = results.length + semanticResults.length;

        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedNoteIndex((i) => Math.min(i + 1, totalItems - 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedNoteIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter" && totalItems > 0) {
          e.preventDefault();
          const item =
            selectedNoteIndex < results.length
              ? results[selectedNoteIndex]
              : semanticResults[selectedNoteIndex - results.length];
          if (item) handleSelectResult(item);
        } else if (
          e.key === "Backspace" &&
          !query.trim() &&
          results.length > 0
        ) {
          e.preventDefault();
          if (selectedNoteIndex < results.length) {
            const note = results[selectedNoteIndex];
            setConfirmDelete({ type: "note", note });
          }
        } else if (
          e.key === "m" &&
          (e.metaKey || e.ctrlKey) &&
          totalItems > 0
        ) {
          e.preventDefault();
          const note =
            selectedNoteIndex < results.length
              ? results[selectedNoteIndex]
              : semanticResults[selectedNoteIndex - results.length];
          setShowMoveModal(note);
        } else if (e.key === "n" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          setIsCreatingNote(true);
          setNewNoteTitle("");
        } else if (
          e.key === "l" &&
          (e.metaKey || e.ctrlKey) &&
          capabilities.note_lock &&
          totalItems > 0
        ) {
          e.preventDefault();
          const note =
            selectedNoteIndex < results.length
              ? results[selectedNoteIndex]
              : null;
          if (note) {
            const toggleLock = async () => {
              try {
                if (note.locked) {
                  const authed = await invoke<boolean>(
                    "is_authenticated",
                  ).catch(() => false);
                  if (!authed) {
                    const ok = await invoke<boolean>("authenticate");
                    if (!ok) return;
                  }
                  await invoke("unlock_note", { path: note.path });
                  setToast(t("palette.noteUnlocked"));
                } else {
                  await invoke("lock_note", { path: note.path });
                  setToast(t("palette.noteLocked"));
                }
                await refreshAfterChange();
              } catch (err) {
                setToast(errorMessage(err, t("common.unknownError")));
              }
            };
            toggleLock();
          }
        } else if (
          e.key.toLowerCase() === "p" &&
          (e.metaKey || e.ctrlKey) &&
          !e.altKey &&
          !e.shiftKey &&
          totalItems > 0
        ) {
          e.preventDefault();
          const note =
            selectedNoteIndex < results.length
              ? results[selectedNoteIndex]
              : semanticResults[selectedNoteIndex - results.length];
          if (note) {
            handleTogglePinned(note);
          }
        }
      } else {
        // Left pane (folder sidebar)
        const totalFolderItems = visibleFolderStats.length + 2; // All + Top

        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedFolderIndex((i) => Math.min(i + 1, totalFolderItems - 1));
          // Apply folder selection
          const newIdx = Math.min(
            selectedFolderIndex + 1,
            totalFolderItems - 1,
          );
          if (newIdx === 0) {
            setSelectedFolder(null);
          } else if (newIdx === 1) {
            setSelectedFolder(TOP_FOLDER_ID);
          } else {
            setSelectedFolder(visibleFolderStats[newIdx - 2]?.name ?? null);
          }
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedFolderIndex((i) => Math.max(i - 1, 0));
          const newIdx = Math.max(selectedFolderIndex - 1, 0);
          if (newIdx === 0) {
            setSelectedFolder(null);
          } else if (newIdx === 1) {
            setSelectedFolder(TOP_FOLDER_ID);
          } else {
            setSelectedFolder(visibleFolderStats[newIdx - 2]?.name ?? null);
          }
        } else if (e.key === "Enter") {
          e.preventDefault();
          // Switch to right pane to browse notes in selected folder
          setFocusPane("right");
          setSelectedNoteIndex(0);
        } else if (
          e.key === "Backspace" &&
          selectedFolder &&
          selectedFolder !== TOP_FOLDER_ID
        ) {
          e.preventDefault();
          setConfirmDelete({ type: "folder", folderName: selectedFolder });
        } else if (e.key === "n" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          setIsCreatingFolder(true);
          setNewFolderName("");
        } else if (
          e.key === "r" &&
          (e.metaKey || e.ctrlKey) &&
          selectedFolder &&
          selectedFolder !== TOP_FOLDER_ID
        ) {
          e.preventDefault();
          setIsRenamingFolder(true);
          setRenameValue(selectedFolder);
          setRenamingFolderName(selectedFolder);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    focusPane,
    results,
    semanticResults,
    selectedNoteIndex,
    selectedFolderIndex,
    selectedFolder,
    query,
    visibleFolderStats,
    confirmDelete,
    showMoveModal,
    lockPromptNote,
    isCreatingFolder,
    isRenamingFolder,
    isCreatingNote,
    handleSelectResult,
    handleTogglePinned,
    refreshAfterChange,
    closePalette,
    t,
    capabilities.note_lock,
  ]);

  const toggleSidebarPosition = useCallback(async () => {
    const next = sidebarPosition === "left" ? "right" : "left";
    setSidebarPosition(next);
    try {
      await saveAndEmitSettings({ sidebar_position: next });
    } catch (err) {
      console.error("Failed to save sidebar position:", err);
      setToast(errorMessage(err, t("common.unknownError")));
    }
  }, [sidebarPosition, saveAndEmitSettings, t]);

  const startDrag = useCallback(async (e: React.MouseEvent) => {
    if (
      (e.target as HTMLElement).closest("input") ||
      (e.target as HTMLElement).closest("button")
    ) {
      return;
    }
    try {
      await getCurrentWindow().startDragging();
    } catch (err) {
      console.error("Failed to start drag:", err);
    }
  }, []);

  return (
    <div className="w-full h-full bg-bg rounded-[14px] flex flex-col overflow-hidden">
      <LiveRegion message={announcedSearchStatus} />
      {/* Search bar */}
      <div
        onMouseDown={startDrag}
        className="px-4 py-3 border-b border-line drag-handle"
      >
        <div className="flex items-center gap-3">
          <svg
            className="w-5 h-5 text-coral shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setFocusPane("right");
            }}
            placeholder={
              selectedFolder
                ? t("palette.searchInFolder", { folder: selectedFolderLabel })
                : t("palette.searchAll")
            }
            aria-label={t("palette.searchLabel")}
            className="flex-1 bg-transparent text-[15px] text-ink placeholder:text-stone outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:rounded-md"
          />
          {isSearching && (
            <span className="text-stone text-sm animate-pulse" aria-hidden="true">...</span>
          )}
        </div>
      </div>

      {/* Two-pane layout */}
      <div
        className={`flex-1 flex overflow-hidden min-h-0 ${sidebarPosition === "right" ? "flex-row-reverse" : ""}`}
      >
        <FolderSidebar
          folderStats={visibleFolderStats}
          totalNoteCount={totalNoteCount}
          pinnedNoteCount={pinnedNoteCount}
          selectedFolder={selectedFolder}
          folderColors={folderColors}
          focused={focusPane === "left"}
          topFolderId={TOP_FOLDER_ID}
          isCreating={isCreatingFolder}
          newFolderName={newFolderName}
          newFolderColor={newFolderColor}
          isRenaming={isRenamingFolder}
          renameValue={renameValue}
          renamingFolder={renamingFolderName}
          onSelectFolder={handleSelectFolder}
          onSetNewFolderName={(name) => {
            if (!isCreatingFolder) setIsCreatingFolder(true);
            setNewFolderName(name);
          }}
          onSetNewFolderColor={(color) => {
            if (isRenamingFolder) {
              handleSetFolderColor(color);
            } else {
              setNewFolderColor(color);
            }
          }}
          onCreateFolder={handleCreateFolder}
          onCancelCreate={() => {
            setIsCreatingFolder(false);
            setNewFolderName("");
            setNewFolderColor("coral");
          }}
          onSetRenameValue={setRenameValue}
          onRenameFolder={handleRenameFolder}
          onCancelRename={() => {
            setIsRenamingFolder(false);
            setRenameValue("");
            setRenamingFolderName(null);
          }}
          position={sidebarPosition}
          draggedNoteFolder={draggedNote?.folder ?? null}
          onDropNoteOnFolder={handleDropNoteOnFolder}
        />

        <NoteList
          results={results}
          semanticResults={semanticResults}
          selectedIndex={selectedNoteIndex}
          query={query}
          isSearching={isSearching}
          folderColors={folderColors}
          focused={focusPane === "right"}
          resultsRef={resultsRef}
          onSelectResult={handleSelectResult}
          onSetSelectedIndex={setSelectedNoteIndex}
          isCreatingNote={isCreatingNote}
          newNoteTitle={newNoteTitle}
          onSetNewNoteTitle={setNewNoteTitle}
          onCreateNote={handleCreateNote}
          onCancelCreateNote={() => {
            setIsCreatingNote(false);
            setNewNoteTitle("");
          }}
          selectedFolder={selectedFolder === TOP_FOLDER_ID ? null : selectedFolder}
          folders={visibleFolders}
          onDragStartNote={setDraggedNote}
          onDragEndNote={() => setDraggedNote(null)}
        />
      </div>

      {/* Footer */}
      <div
        onMouseDown={startDrag}
        className="flex items-center justify-between px-4 py-2 border-t border-line text-[10px] text-stone drag-handle"
      >
        <div className="flex items-center gap-3">
          <span>
            <kbd className="px-1.5 py-0.5 bg-line rounded text-[9px]">tab</kbd>{" "}
            {t("palette.switchPane")}
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-line rounded text-[9px]">↑↓</kbd>{" "}

            {t("palette.navigate")}
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-line rounded text-[9px]">↵</kbd>{" "}

            {t("palette.open")}
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-line rounded text-[9px]">⌫</kbd>{" "}

            {t("palette.delete")}
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-line rounded text-[9px]">⌘M</kbd>{" "}

            {t("palette.move")}
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-line rounded text-[9px]">⌘N</kbd>{" "}

            {t("palette.new")}
          </span>
          {capabilities.note_lock && (
          <span>
            <kbd className="px-1.5 py-0.5 bg-line rounded text-[9px]">⌘L</kbd>{" "}

            {t("palette.lock")}
          </span>
          )}
          <span><kbd className="px-1.5 py-0.5 bg-line rounded text-[9px]">⌘P</kbd> {t("command.footer.pin")}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebarPosition}
            className="flex items-center gap-1 hover:text-coral transition-colors"
            title={`Move sidebar to ${sidebarPosition === "left" ? "right" : "left"}`}
          >
            <svg
              className={`w-3 h-3 ${sidebarPosition === "right" ? "scale-x-[-1]" : ""}`}
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M0 2a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H2a2 2 0 01-2-2V2zm5.5 0H2a.5.5 0 00-.5.5v11a.5.5 0 00.5.5h3.5V2zM7 2v12h7a.5.5 0 00.5-.5v-11A.5.5 0 0014 2H7z" />
            </svg>
          </button>
          <span>
            <kbd className="px-1.5 py-0.5 bg-line rounded text-[9px]">esc</kbd>{" "}

            {t("palette.close")}
          </span>
        </div>
      </div>

      {/* Overlays */}
      {confirmDelete && (
        <ConfirmDialog
          title={
            confirmDelete.type === "folder"
              ? t("palette.deleteFolder", { name: confirmDelete.folderName ?? "" })
              : t("palette.deleteNote")
          }
          description={
            confirmDelete.type === "folder"
              ? t("palette.deleteFolderWarning")
              : confirmDelete.note
                ? t("palette.fromFolder", { folder: confirmDelete.note.folder })
                : undefined
          }
          onConfirm={() => {
            if (confirmDelete.type === "folder" && confirmDelete.folderName) {
              handleDeleteFolder(confirmDelete.folderName);
            } else if (confirmDelete.note) {
              handleDeleteNote(confirmDelete.note);
            }
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {showMoveModal && (
        <MovePicker
          note={showMoveModal}
          folders={visibleFolders}
          folderColors={folderColors}
          onMove={(targetFolder) => handleMoveNote(showMoveModal, targetFolder)}
          onCancel={() => setShowMoveModal(null)}
        />
      )}

      {lockPromptNote && (
        <LockPrompt
          onAuthenticated={() => {
            const note = lockPromptNote;
            setLockPromptNote(null);
            openNote(note);
          }}
          onCancel={() => setLockPromptNote(null)}
        />
      )}

      {toast && (
        <ActionToast
          message={toast}
          actionLabel={
            lastTrashed && toast === t("trash.noteMoved")
              ? t("trash.undo")
              : undefined
          }
          onAction={lastTrashed ? () => undoDelete(lastTrashed) : undefined}
          onDone={() => {
            setToast(null);
            setLastTrashed(null);
          }}
        />
      )}
    </div>
  );
}
