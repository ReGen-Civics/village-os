/**
 * THE CONVERSATION NOTES' FILES ON DISK (0442; the contract is shared/conversationNotes.ts).
 *
 * WHERE. `<data>/private-conversation-notes/`, beside the proposals' private files and OUTSIDE the uploads volume,
 * because `/api/uploads/:filename` answers anybody. Nothing serves this folder but the notes' own file door
 * (server/routes/applicantOnboarding.ts), which asks who the reader is every time.
 *
 * NAMES are made here (`convnote-<stamp><ext>`), never from anything the sender typed, and every read goes through
 * `noteFilePath`, which refuses anything but a name this module could have made.
 *
 * The folder is set once, when the doors are registered. With none set (a suite with no folder), writes refuse and
 * removals do nothing.
 */
import fs from "node:fs";
import path from "node:path";
import { stampedName, writeToVolume } from "./uploads";

let folder: string | null = null;

/** The private folder the notes' files live in. Called by the route registration. */
export function setNoteFilesDir(dir: string | null): void {
  folder = dir;
}

export function noteFilesDir(): string | null {
  return folder;
}

/** A name this module makes: a prefix, the stamp, and one short extension. Anything else is never a path. */
const NAME = /^convnote-\d+-[A-Za-z0-9]+\.[a-z0-9]{1,5}$/;

/** Where a stored note file is, or null for a name this module could not have made. */
export function noteFilePath(fileName: string): string | null {
  if (!folder || !NAME.test(fileName)) return null;
  return path.join(folder, fileName);
}

/** Write a note's file (bytes already through the strip) and answer its stored name. Refuses with no folder set. */
export function writeNoteFile(bytes: Buffer, ext: string): string {
  if (!folder) throw new Error("No private folder is set for conversation notes.");
  const name = stampedName("convnote", ext);
  writeToVolume(folder, name, bytes);
  return name;
}

/** Remove note files whose rows are gone. A name that is not ours, or a file already gone, is passed over. */
export async function removeNoteFiles(names: readonly string[]): Promise<void> {
  for (const n of names) {
    const p = noteFilePath(n);
    if (!p) continue;
    try {
      await fs.promises.unlink(p);
    } catch {
      /* already gone */
    }
  }
}
