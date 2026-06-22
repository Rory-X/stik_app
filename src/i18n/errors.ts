import type { MessageKey } from "./types";

type Translator = (
  key: MessageKey,
  replacements?: Record<string, string | number>,
) => string;

const EXACT_ERROR_KEYS: Record<string, MessageKey> = {
  "Folder does not exist": "errors.folderDoesNotExist",
  "Name cannot be empty": "errors.nameCannotBeEmpty",
  "A folder with that name already exists": "errors.folderAlreadyExists",
  "Remote URL is required for Git sharing": "errors.gitRemoteRequired",
  "Branch cannot be empty": "errors.gitBranchEmpty",
  "Pick a folder to link before enabling Git sharing": "errors.gitFolderRequired",
  "Remote URL is empty": "errors.gitRemoteEmpty",
  "Invalid SSH remote URL": "errors.gitInvalidSshRemote",
  "Unsupported remote URL format": "errors.gitUnsupportedRemote",
  "AI features are disabled in settings": "errors.aiDisabled",
  "DarwinKit sidecar not available": "errors.darwinkitUnavailable",
  "DarwinKit sidecar not running": "errors.darwinkitNotRunning",
  "DarwinKit not available": "errors.darwinkitUnavailable",
  "Failed to embed query": "errors.embedQueryFailed",
  "Not authenticated": "errors.notAuthenticated",
  "Note is already locked": "errors.noteAlreadyLocked",
  "Not a valid locked note": "errors.invalidLockedNote",
  "Note file does not exist": "errors.noteFileMissing",
  "Invalid filename": "errors.invalidFilename",
  "Image path must be absolute": "errors.imagePathAbsolute",
  "Dropped image file does not exist": "errors.droppedImageMissing",
  "Dropped file is not a supported image": "errors.unsupportedDroppedImage",
  "Dictation failed": "errors.dictationFailed",
  "Cannot determine home directory": "errors.homeDirectoryMissing",
  "Could not find home directory": "errors.homeDirectoryMissing",
  "Could not find Documents directory": "errors.documentsDirectoryMissing",
  "Invalid name: must not contain '..', '/', '\\', or null bytes":
    "errors.invalidFolderName",
  "Invalid name: hidden folders are not supported": "errors.hiddenFolderName",
  "Theme file must have a name": "errors.themeNameMissing",
  "No note saved yet": "errors.noNoteSavedYet",
  "Invalid path: note must be within Stik folder":
    "errors.invalidNotePathInStik",
  "Invalid path: only markdown files can be edited outside Stik folder":
    "errors.invalidExternalMarkdownPath",
  "Failed to open browser for remote URL": "errors.openBrowserFailed",
  "Invalid response from LLM": "errors.invalidLlmResponse",
  "Remote URL is required": "errors.gitRemoteRequired",
  "Operation not permitted (os error 1)": "errors.operationNotPermitted",
};

const PREFIX_ERROR_KEYS: Array<[prefix: string, key: MessageKey]> = [
  ["Failed to delete note: ", "errors.deleteNoteFailed"],
  ["Failed to move note: ", "errors.moveNoteFailed"],
  ["Failed to delete folder: ", "errors.deleteFolderFailed"],
  ["Failed to rename folder: ", "errors.renameFolderFailed"],
  ["Failed to prepare git repository: ", "errors.gitPrepareFailed"],
  ["Failed to sync repository: ", "errors.gitSyncFailed"],
  ["Failed to open browser: ", "errors.openBrowserFailed"],
  ["Rephrase failed: ", "errors.aiRephraseFailed"],
  ["Summarize failed: ", "errors.aiSummarizeFailed"],
  ["Organize failed: ", "errors.aiOrganizeFailed"],
  ["Generate failed: ", "errors.aiGenerateFailed"],
  ["Failed to write image: ", "errors.writeImageFailed"],
  ["Failed to copy dropped image: ", "errors.copyDroppedImageFailed"],
  ["Failed to create .assets dir: ", "errors.createAssetsDirFailed"],
  ["Invalid base64: ", "errors.invalidBase64"],
  ["Encryption failed: ", "errors.encryptionFailed"],
  ["Decryption failed", "errors.decryptionFailed"],
  ["Failed to open Apple Notes database: ", "errors.appleNotesOpenFailed"],
  ["Failed to set read-only pragma: ", "errors.appleNotesReadOnlyFailed"],
  ["Failed to set busy timeout: ", "errors.appleNotesBusyTimeoutFailed"],
  ["Failed to prepare notes query: ", "errors.appleNotesQueryPrepareFailed"],
  ["Failed to query notes: ", "errors.appleNotesQueryFailed"],
  ["Failed to read note data: ", "errors.appleNotesReadDataFailed"],
  ["Failed to decompress note data: ", "errors.appleNotesDecompressFailed"],
  ["Failed to decode protobuf: ", "errors.appleNotesDecodeFailed"],
  ["Failed to open System Settings: ", "errors.openSystemSettingsFailed"],
  ["Failed to create iCloud Stik folder: ", "errors.icloudCreateFolderFailed"],
  ["Failed to get iCloud status: ", "errors.icloudStatusFailed"],
  ["Failed to enable iCloud: ", "errors.icloudEnableFailed"],
  ["Failed to disable iCloud: ", "errors.icloudDisableFailed"],
  ["Migration failed: ", "errors.migrationFailed"],
  ["Failed to read file: ", "errors.readFileFailed"],
  ["Invalid TOML theme file: ", "errors.invalidTomlTheme"],
  ["Invalid JSON theme file: ", "errors.invalidJsonTheme"],
  ["Failed to serialize theme: ", "errors.themeSerializeFailed"],
  ["Failed to write file: ", "errors.writeFileFailed"],
  ["Clipboard unavailable: ", "errors.clipboardUnavailable"],
  ["Failed to write rich text to clipboard: ", "errors.writeRichTextFailed"],
  ["Invalid image payload: ", "errors.invalidImagePayload"],
  ["Failed to access webview: ", "errors.webviewAccessFailed"],
  ["Invalid PNG image: ", "errors.invalidPngImage"],
  ["Failed to write image to clipboard: ", "errors.writeClipboardImageFailed"],
  ["No text on clipboard: ", "errors.noClipboardText"],
  ["Failed to create bitmap snapshot", "errors.bitmapSnapshotFailed"],
  ["Failed to encode snapshot as PNG", "errors.snapshotEncodeFailed"],
  ["Invalid color format for ", "errors.invalidColorFormat"],
  ["Missing nonce line", "errors.missingNonceLine"],
  ["Invalid nonce: ", "errors.invalidNonce"],
  ["Invalid nonce length", "errors.invalidNonceLength"],
  ["Invalid ciphertext: ", "errors.invalidCiphertext"],
  ["Decrypted content is not valid UTF-8: ", "errors.invalidDecryptedUtf8"],
  ["Failed to write key file: ", "errors.writeKeyFileFailed"],
  ["Failed to set key file permissions: ", "errors.keyFilePermissionsFailed"],
  ["Failed to read key file: ", "errors.readKeyFileFailed"],
  ["Failed to inspect repository status: ", "errors.gitStatusFailed"],
  ["Failed to start git sync worker: ", "errors.gitWorkerStartFailed"],
  ["Failed to load settings: ", "errors.settingsLoadFailed"],
  ["Failed to commit note changes: ", "errors.gitCommitFailed"],
  ["Failed to pull from origin/", "errors.gitPullFailed"],
  ["Failed to push to origin/", "errors.gitPushFailed"],
  ["Failed to finalize conflict resolution: ", "errors.gitConflictFinalizeFailed"],
  ["Failed to list conflicted files: ", "errors.gitConflictedFilesFailed"],
  ["Invalid conflicted file path: ", "errors.gitInvalidConflictPath"],
  ["Git command failed to launch: ", "errors.gitLaunchFailed"],
  ["Failed to capture stdin", "errors.darwinkitStdinFailed"],
  ["Failed to capture stdout", "errors.darwinkitStdoutFailed"],
  ["Failed to serialize request: ", "errors.darwinkitSerializeFailed"],
  ["DarwinKit call failed: ", "errors.darwinkitCallFailed"],
  ["Semantic search failed: ", "errors.semanticSearchFailed"],
  ["Folder suggestion failed: ", "errors.folderSuggestionFailed"],
  ["Failed to delete note: ", "errors.deleteNoteFailed"],
  ["Failed to create sticked window: ", "errors.createStickedWindowFailed"],
  ["Failed to create viewing window: ", "errors.createViewingWindowFailed"],
  ["Failed to show macOS notification", "errors.notificationFailed"],
];

export function translateBackendError(error: unknown, t: Translator): string {
  const message = String(error);
  const exactKey = EXACT_ERROR_KEYS[message];
  if (exactKey) return t(exactKey);

  for (const [prefix, key] of PREFIX_ERROR_KEYS) {
    if (message.startsWith(prefix)) {
      return t(key, { error: message.slice(prefix.length) });
    }
  }

  return message;
}
