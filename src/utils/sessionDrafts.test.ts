import { describe, expect, it } from "vitest";
import {
  createSessionDraftId,
  resolveSessionDraftTarget,
  shouldPersistSessionDraft,
} from "./sessionDrafts";

describe("session drafts", () => {
  it("does not persist empty new-note drafts", () => {
    expect(
      shouldPersistSessionDraft({ kind: "new", content: "   \n\t" }),
    ).toBe(false);
  });

  it("does not persist transient slash capture drafts", () => {
    expect(shouldPersistSessionDraft({ kind: "new", content: "/in" })).toBe(
      false,
    );
  });

  it("persists empty edit drafts because clearing a note is an edit", () => {
    expect(shouldPersistSessionDraft({ kind: "edit", content: "" })).toBe(
      true,
    );
  });

  it("builds stable edit draft ids from original paths", () => {
    const path = "/Users/jiahaoqian/Documents/Stik/Inbox/hello world.md";

    expect(createSessionDraftId({ kind: "edit", originalPath: path })).toBe(
      createSessionDraftId({ kind: "edit", originalPath: path }),
    );
    expect(createSessionDraftId({ kind: "edit", originalPath: path })).toMatch(
      /^edit:/,
    );
  });

  it("builds distinct new draft ids when a seed changes", () => {
    expect(createSessionDraftId({ kind: "new", seed: "a" })).not.toBe(
      createSessionDraftId({ kind: "new", seed: "b" }),
    );
  });

  it("uses the restored draft identity for recovered draft windows", () => {
    expect(
      resolveSessionDraftTarget({
        isSticked: false,
        isViewing: false,
        newDraftId: "new:local",
        recoveredId: "edit:restored",
        recoveredKind: "edit",
        originalPath: "/tmp/original.md",
      }),
    ).toEqual({
      id: "edit:restored",
      kind: "edit",
      originalPath: "/tmp/original.md",
    });
  });

  it("tracks viewing windows as edit drafts bound to the original path", () => {
    const target = resolveSessionDraftTarget({
      isSticked: true,
      isViewing: true,
      newDraftId: "new:local",
      originalPath: "/tmp/note.md",
    });

    expect(target).toMatchObject({
      kind: "edit",
      originalPath: "/tmp/note.md",
    });
    expect(target?.id).toMatch(/^edit:/);
  });

  it("tracks capture windows as new note drafts", () => {
    expect(
      resolveSessionDraftTarget({
        isSticked: false,
        isViewing: false,
        newDraftId: "new:local",
      }),
    ).toEqual({ id: "new:local", kind: "new", originalPath: null });
  });

  it("does not create session drafts for pinned sticked notes", () => {
    expect(
      resolveSessionDraftTarget({
        isSticked: true,
        isViewing: false,
        newDraftId: "new:local",
      }),
    ).toBeNull();
  });
});
