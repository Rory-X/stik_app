import type { NoteInfo, SearchResult } from "@/types";
import {
  extractNoteTitle,
  normalizeNoteSnippet,
} from "@/utils/notePresentation";

/** Derive a human-readable title from a Stik filename like `20260310-114522-my-note-a1b2.md`. */
export function titleFromStikFilename(filename: string): string {
  const stem = filename.replace(/\.md$/i, "");
  const parts = stem.split("-");
  if (parts.length > 3) {
    return parts.slice(2, -1).join(" ");
  }
  return stem;
}

export function noteInfosToSearchResults(notes: NoteInfo[]): SearchResult[] {
  return notes.map((note) => ({
    path: note.path,
    filename: note.filename,
    folder: note.folder,
    title: note.locked
      ? titleFromStikFilename(note.filename)
      : extractNoteTitle(note.content),
    snippet: normalizeNoteSnippet(note.content),
    created: note.created,
    locked: note.locked,
  }));
}
