import { isMarkdownEffectivelyEmpty } from "./normalizeMarkdownForCopy";
import { isCaptureSlashQuery } from "./slashQuery";

export type SessionDraftKind = "new" | "edit";

export interface SessionDraftIdentityInput {
  kind: SessionDraftKind;
  originalPath?: string | null;
  seed?: string;
}

export interface SessionDraftPersistInput {
  kind: SessionDraftKind;
  content: string;
}

export interface SessionDraftTargetInput {
  isSticked: boolean;
  isViewing?: boolean;
  originalPath?: string | null;
  newDraftId: string;
  recoveredId?: string | null;
  recoveredKind?: SessionDraftKind | null;
}

export interface SessionDraftTarget {
  id: string;
  kind: SessionDraftKind;
  originalPath: string | null;
}

export function shouldPersistSessionDraft({
  kind,
  content,
}: SessionDraftPersistInput): boolean {
  if (kind === "edit") return true;
  if (isMarkdownEffectivelyEmpty(content)) return false;
  return !isCaptureSlashQuery(content);
}

export function createSessionDraftId({
  kind,
  originalPath,
  seed,
}: SessionDraftIdentityInput): string {
  if (kind === "edit") {
    return `edit:${hashString(originalPath ?? "")}`;
  }

  return `new:${hashString(seed ?? crypto.randomUUID())}`;
}

export function resolveSessionDraftTarget({
  isSticked,
  isViewing,
  originalPath,
  newDraftId,
  recoveredId,
  recoveredKind,
}: SessionDraftTargetInput): SessionDraftTarget | null {
  if (recoveredId && recoveredKind) {
    return {
      id: recoveredId,
      kind: recoveredKind,
      originalPath: originalPath ?? null,
    };
  }

  if (isViewing && originalPath) {
    return {
      id: createSessionDraftId({ kind: "edit", originalPath }),
      kind: "edit",
      originalPath,
    };
  }

  if (!isSticked) {
    return {
      id: newDraftId,
      kind: "new",
      originalPath: null,
    };
  }

  return null;
}

function hashString(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}
