import { describe, expect, it } from "vitest";
import { noteInfosToSearchResults, titleFromStikFilename } from "./commandPaletteNotes";
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
});
