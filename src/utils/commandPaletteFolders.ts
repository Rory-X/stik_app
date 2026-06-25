import type { FolderStats, SearchResult } from "@/types";

export const INBOX_FOLDER_NAME = "Inbox";

export function ensureInboxFolderStats(
  folderStats: FolderStats[],
): FolderStats[] {
  const inbox = folderStats.find((folder) => folder.name === INBOX_FOLDER_NAME);
  const otherFolders = folderStats.filter(
    (folder) => folder.name !== INBOX_FOLDER_NAME,
  );

  return [
    inbox ?? { name: INBOX_FOLDER_NAME, note_count: 0 },
    ...otherFolders,
  ];
}

export function folderNamesFromStats(folderStats: FolderStats[]): string[] {
  return ensureInboxFolderStats(folderStats).map((folder) => folder.name);
}

export function canMoveNoteToFolder(
  note: Pick<SearchResult, "folder"> | null,
  targetFolder: string | null,
): boolean {
  return Boolean(note && targetFolder && note.folder !== targetFolder);
}
