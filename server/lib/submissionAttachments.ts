/**
 * A FORM'S ATTACHMENT, KEPT OFF THE PUBLIC VOLUME (audit, 15 Nov 2026).
 *
 * `POST /api/work-with-us/attachment` takes one image or PDF from anybody, with
 * no account, and on some forks that file is a CV or an ID scan. It used to be
 * written to the uploads volume, which `/api/uploads/:filename` serves to
 * anybody holding the name, inline. So the file now lives in its own folder
 * OUTSIDE the uploads volume, the way an open proposal's files do
 * (server/lib/proposalFiles.ts, `DATA_DIR/private-proposal-files`):
 *
 *   - written to `DATA_DIR/private-submission-attachments`, under the same
 *     stamped `proposal-<ms>-<rand>.<ext>` name the door always minted, so the
 *     submission row that names it is unchanged;
 *   - served only through `GET /api/admin/submission-attachments/:filename`, to
 *     an admin, `private, no-store`, `nosniff`, a sandboxing CSP, and as an
 *     ATTACHMENT for a PDF, so it is saved and never run in the village's origin;
 *   - and refused by the public uploads route by its prefix, including a file
 *     the door wrote to the volume before this change, which the admin door
 *     still reads from there so nothing already sent is lost;
 *   - deleted with the submission's own retention (the daily sweep and the
 *     erasure), from both places, and an upload nobody ever sent with a form is
 *     deleted once it is two days old.
 */
import fs from "node:fs";
import path from "node:path";
import { isProposalAttachment } from "./uploadsSweep";

/** The folder, beside the uploads volume and never inside it. */
export const SUBMISSION_ATTACHMENT_DIRNAME = "private-submission-attachments";

/** How long an upload nobody sent with a form is kept. */
export const UNSENT_ATTACHMENT_GRACE_MS = 2 * 24 * 60 * 60 * 1000;

/** The one name this door reads or deletes: basenamed, and one the attachment door minted. Else null. */
export function attachmentName(raw: unknown): string | null {
  const name = path.basename(String(raw ?? "").trim());
  return name && isProposalAttachment(name) ? name : null;
}

/** Where the bytes are: the private folder, or, for a file sent before it existed, the uploads volume. Null when neither. */
export function attachmentPath(privateDir: string, legacyUploadsDir: string, raw: unknown): string | null {
  const name = attachmentName(raw);
  if (!name) return null;
  for (const dir of [privateDir, legacyUploadsDir]) {
    const p = path.join(dir, name);
    try {
      if (fs.statSync(p).isFile()) return p;
    } catch {
      /* not in this one */
    }
  }
  return null;
}

/** Delete one attachment from both places. A file already gone passes; any other failure throws. */
export function removeAttachment(privateDir: string, legacyUploadsDir: string, raw: unknown): void {
  const name = attachmentName(raw);
  if (!name) return;
  for (const dir of [privateDir, legacyUploadsDir]) {
    try {
      fs.unlinkSync(path.join(dir, name));
    } catch (e: any) {
      if (e?.code !== "ENOENT") throw e;
    }
  }
}

/** The headers a kept attachment is answered with, and its type. A PDF goes as a download, an image as an image. */
export function attachmentHeaders(name: string): Record<string, string> {
  const ext = path.extname(name).toLowerCase();
  const types: Record<string, string> = { ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };
  const type = types[ext] ?? "application/octet-stream";
  return {
    "Content-Type": type,
    "Content-Disposition": `${type.startsWith("image/") ? "inline" : "attachment"}; filename="${name}"`,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow",
  };
}

/**
 * The unsent uploads: files in the private folder older than the grace that no
 * submission names. Deleted; their count is returned. Never throws.
 */
export function sweepUnsentAttachments(privateDir: string, referenced: ReadonlySet<string>, now: number = Date.now()): number {
  let names: string[];
  try {
    names = fs.readdirSync(privateDir);
  } catch {
    return 0;
  }
  let gone = 0;
  for (const name of names) {
    if (!isProposalAttachment(name) || referenced.has(name)) continue;
    const p = path.join(privateDir, name);
    try {
      const st = fs.statSync(p);
      if (!st.isFile() || now - st.mtimeMs < UNSENT_ATTACHMENT_GRACE_MS) continue;
      fs.unlinkSync(p);
      gone += 1;
    } catch {
      /* raced, or unreadable: the next sweep asks again */
    }
  }
  return gone;
}
