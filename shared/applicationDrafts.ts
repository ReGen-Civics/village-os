/**
 * SAVE AND FINISH LATER (the lead, 24 Nov 2026, from an applicant reviewer's feedback).
 *
 * "Remember my answers" keeps typed answers in one browser and never files, so somebody who
 * stopped half way on a phone could not pick up on a laptop, and lost their files either way.
 * "Save and finish later" keeps the whole unsent application on the server: every answer, the
 * step they stopped on, and the files they attached, kept the way a sent application keeps its
 * files (server/lib/proposalFiles.ts). It hands back a private resume link, shows it on screen
 * with a copy button, and emails it to the address the applicant typed through the one mail door.
 *
 * WHAT A DRAFT IS NOT. An unsent draft is never shown to the team and never counted as an
 * application: only the draft routes read `application_drafts` (migration 0423). Sending the
 * application removes the draft. A draft nobody saved for DRAFT_KEEP_DAYS is deleted with its
 * files by a scheduled job.
 *
 * THE TOKEN. 32 random bytes, base64url: the only key to a draft, and one draft per token. The
 * server keeps only its SHA-256. It travels in the link's fragment (`#resume=`), which a browser
 * never sends to a server, so it is in no request line, no Referer and no log; the page hands it
 * over in a POST body.
 *
 *   POST /api/application-drafts          save (create, or update by token); rate limited
 *   POST /api/application-drafts/open     read one back by token; rate limited
 *   POST /api/application-drafts/file     one kept file's bytes, by token and file id; rate limited
 *   POST /api/application-drafts/discard  remove it (after the application is sent)
 *
 * Pure: no pool, no clock, no Node builtins.
 */

/** Days a draft is kept after its last save. */
export const DRAFT_KEEP_DAYS = 30;
export const DRAFT_KEEP_MS = DRAFT_KEEP_DAYS * 24 * 60 * 60 * 1000;

export const DRAFT_LIMITS = {
  /** Saves one connection may make in the window. Generous: a save is one press of a button. */
  savesPerWindow: 40,
  /** Resume lookups and file reads one connection may make in the window. */
  opensPerWindow: 30,
  fileReadsPerWindow: 120,
  windowMs: 60 * 60 * 1000,
  /** Resume emails one address may receive in a day. */
  emailsPerDay: 3,
  dayMs: 24 * 60 * 60 * 1000,
  /** The answers as JSON, at most this many bytes. */
  bodyBytes: 400_000,
} as const;

/** A resume token: 32 bytes as base64url, exactly 43 characters. */
export const DRAFT_TOKEN = /^[A-Za-z0-9_-]{43}$/;
export const isDraftToken = (v: unknown): v is string => typeof v === "string" && DRAFT_TOKEN.test(v);

/** A draft's own id, which names its file folder. */
export const DRAFT_ID = /^ad-[0-9a-f]{20}$/;
/** A kept file's id inside a draft. */
export const DRAFT_FILE_ID = /^df-[0-9a-f]{16}$/;

const FRAGMENT = "resume=";

/** The resume link's path and fragment: the application, its personal link when it had one, and the token. */
export function resumePath(token: string, link?: string | null): string {
  const base = link ? `/propose-a-role/${encodeURIComponent(link)}` : "/propose-a-role";
  return `${base}#${FRAGMENT}${token}`;
}

/** One kept file, as the page reads it: never a path. */
export interface DraftFileRef {
  id: string;
  name: string;
  size: number;
}

/** What a save answers. `emailed`: what happened to the resume email on this save. */
export interface DraftSaved {
  token: string;
  savedAt: string;
  files: DraftFileRef[];
  emailed: "sent" | "already" | "none" | "failed" | "limited";
  emailedTo: string | null;
}

/** What opening a draft answers. `draft` is the page's own answers object, read back by the page. */
export interface DraftOpened {
  roleId: string;
  link: string | null;
  step: number;
  savedAt: string;
  draft: Record<string, unknown>;
  files: DraftFileRef[];
}

/** The words the routes answer with. The page shows its own translated line for each `error` code. */
export const DRAFT_ERRORS = {
  gone: "gone",
  invalid: "invalid",
  tooBig: "too_big",
  tooMany: "too_many_asks",
  closed: "closed",
  uploadGone: "upload_gone",
  files: "files",
} as const;
export type DraftError = (typeof DRAFT_ERRORS)[keyof typeof DRAFT_ERRORS];
