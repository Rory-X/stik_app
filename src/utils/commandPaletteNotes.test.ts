import { describe, expect, it } from "vitest";
import {
  createdNoteOpenPayload,
  noteInfosToSearchResults,
  sortPinnedFirst,
  titleFromStikFilename,
} from "./commandPaletteNotes";
import type { NoteInfo } from "@/types";

describe("commandPaletteNotes", () => {
  it("keeps every note when preparing the folder note list", () => {
    const notes: NoteInfo[] = Array.from({ length: 20 }, (_, index) => ({
      path: `/tmp/Stik/Inbox/${index}.md`,
      filename: `20260623-1200${index}-note-${index}-abcd.md`,
      folder: "Inbox",
      content: `# Note ${index}`,
      created: `20260623-1200${index}`,
    }));

    const results = noteInfosToSearchResults(notes);

    expect(results).toHaveLength(20);
    expect(results[0].title).toBe("Note 0");
    expect(results[19].title).toBe("Note 19");
  });

  it("derives locked note titles from filenames without reading content", () => {
    expect(titleFromStikFilename("20260623-120000-secret-note-abcd.md")).toBe(
      "secret note",
    );
  });

  it("keeps pin metadata when preparing notes", () => {
    const notes: NoteInfo[] = [
      {
        path: "/tmp/Stik/Inbox/pinned.md",
        filename: "20260623-120000-pinned-abcd.md",
        folder: "Inbox",
        content: "# Pinned",
        created: "20260623-120000",
        pinned: true,
        pinned_at: "2026-06-23T12:10:00Z",
      },
    ];

    expect(noteInfosToSearchResults(notes)[0]).toMatchObject({
      pinned: true,
      pinned_at: "2026-06-23T12:10:00Z",
    });
  });

  it("sorts pinned notes before regular notes", () => {
    const sorted = sortPinnedFirst([
      {
        path: "/tmp/Stik/Inbox/newer.md",
        filename: "newer.md",
        folder: "Inbox",
        title: "Newer",
        snippet: "",
        created: "20260623-130000",
      },
      {
        path: "/tmp/Stik/Inbox/pinned.md",
        filename: "pinned.md",
        folder: "Inbox",
        title: "Pinned",
        snippet: "",
        created: "20260623-120000",
        pinned: true,
        pinned_at: "2026-06-23T12:10:00Z",
      },
    ]);

    expect(sorted.map((note) => note.title)).toEqual(["Pinned", "Newer"]);
  });

  it("opens the note path returned by save_note instead of relying on list ordering", () => {
    expect(
      createdNoteOpenPayload(
        {
          path: "/tmp/Stik/Inbox/20260625-120000-fourth-note-a1b2.md",
          filename: "20260625-120000-fourth-note-a1b2.md",
          folder: "Inbox",
        },
        "# Fourth note\n\n",
      ),
    ).toEqual({
      path: "/tmp/Stik/Inbox/20260625-120000-fourth-note-a1b2.md",
      folder: "Inbox",
      content: "# Fourth note\n\n",
    });
  });
});
