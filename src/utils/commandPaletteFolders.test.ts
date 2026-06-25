import { describe, expect, it } from "vitest";
import {
  canMoveNoteToFolder,
  ensureInboxFolderStats,
  folderNamesFromStats,
} from "./commandPaletteFolders";
import type { FolderStats, SearchResult } from "@/types";

describe("commandPaletteFolders", () => {
  it("places Inbox directly below the all-folders item even when the folder is missing", () => {
    const stats: FolderStats[] = [
      { name: "test", note_count: 29 },
      { name: "工作笔记", note_count: 0 },
    ];

    expect(ensureInboxFolderStats(stats)).toEqual([
      { name: "Inbox", note_count: 0 },
      { name: "test", note_count: 29 },
      { name: "工作笔记", note_count: 0 },
    ]);
  });

  it("moves an existing Inbox entry to the top without duplicating it", () => {
    const stats: FolderStats[] = [
      { name: "test", note_count: 29 },
      { name: "Inbox", note_count: 6 },
      { name: "工作笔记", note_count: 0 },
    ];

    expect(ensureInboxFolderStats(stats)).toEqual([
      { name: "Inbox", note_count: 6 },
      { name: "test", note_count: 29 },
      { name: "工作笔记", note_count: 0 },
    ]);
    expect(folderNamesFromStats(stats)).toEqual(["Inbox", "test", "工作笔记"]);
  });

  it("only allows dropping a note onto a different concrete folder", () => {
    const note: SearchResult = {
      path: "/tmp/Stik/test/note.md",
      filename: "note.md",
      folder: "test",
      title: "Note",
      snippet: "",
      created: "20260623-120000",
    };

    expect(canMoveNoteToFolder(note, "Inbox")).toBe(true);
    expect(canMoveNoteToFolder(note, "test")).toBe(false);
    expect(canMoveNoteToFolder(note, null)).toBe(false);
  });
});
