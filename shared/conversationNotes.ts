/**
 * THE NOTES OF ONE CONVERSATION (the lead, 27 Nov 2026: "this section is where the conversation notes are held and a
 * link is sent to me and other interviewers (never the applicant) for the notes we have about our sessions where we can
 * have whatever notes we want, or upload the whole transcript and more for the conversation").
 *
 * Each conversation of an application (`application_interviews`) keeps its own private notes: written notes, and files
 * (a transcript, a recording, a document). The rules are here; the table is `application_conversation_notes`
 * (server/repos/applicationConversationNotes.ts) and the work is server/lib/applicantOnboarding.ts.
 *
 * ── NEVER THE APPLICANT ─────────────────────────────────────────────────────
 *
 * The applicant reads none of it on any route. A person who stepped out of the application reads none of it.
 *
 * ── NOTES ONLY, NO AI ───────────────────────────────────────────────────────
 *
 * Nothing here scores, ranks or judges. The table has no score, level or rank column, and no model reads it: the
 * table, this module and its doors are on the refusal list (server/lib/applicationReview.refusal.test.ts).
 *
 * ── WHO READS ───────────────────────────────────────────────────────────────
 *
 * The people who hold the role that holds this conversation, the role that makes the final call, and the holders of
 * the power to place people in roles. Named by role, never by person, so when people change the notes follow the role.
 */

/** What one note is: words, or one file. */
export const CONVERSATION_NOTE_KINDS = ["text", "transcript", "recording", "file"] as const;
export type ConversationNoteKind = (typeof CONVERSATION_NOTE_KINDS)[number];

export function isConversationNoteKind(v: unknown): v is ConversationNoteKind {
  return typeof v === "string" && (CONVERSATION_NOTE_KINDS as readonly string[]).includes(v);
}

/** The longest written note: a full page of notes from a long conversation. */
export const CONVERSATION_NOTE_MAX = 20000;
/** The largest file: an hour's recording, compressed, fits. */
export const CONVERSATION_FILE_MAX_BYTES = 60 * 1024 * 1024;
/** How many notes and files one person adds in an hour, across every application. */
export const CONVERSATION_NOTES_PER_HOUR = 60;

/** The file types each kind takes, by extension. Read from the stored name, never trusted for safety alone. */
export const CONVERSATION_FILE_TYPES: Record<Exclude<ConversationNoteKind, "text">, readonly string[]> = {
  transcript: [".txt", ".md", ".pdf", ".docx", ".vtt", ".srt"],
  recording: [".mp3", ".m4a", ".wav", ".webm", ".ogg", ".mp4"],
  file: [".pdf", ".docx", ".txt", ".jpg", ".jpeg", ".png", ".webp"],
};

/** Whether a file name fits the kind it is sent as. */
export function fileFitsKind(kind: ConversationNoteKind, originalName: string): boolean {
  if (kind === "text") return false;
  const dot = originalName.lastIndexOf(".");
  const ext = dot >= 0 ? originalName.slice(dot).toLowerCase() : "";
  return CONVERSATION_FILE_TYPES[kind].includes(ext);
}

/** The extension a stored file keeps: the sent name's, when the kind accepts it. Never a path. */
export function storedExtension(kind: ConversationNoteKind, originalName: string): string | null {
  if (!fileFitsKind(kind, originalName)) return null;
  return originalName.slice(originalName.lastIndexOf(".")).toLowerCase();
}

/** A written note as the form sent it: trimmed, inside the limit, or null when there is nothing to keep. */
export function readNoteBody(raw: unknown): { ok: true; body: string } | { ok: false; error: "empty" | "too_long" } {
  const body = typeof raw === "string" ? raw.replace(/\r\n/g, "\n").trim() : "";
  if (!body) return { ok: false, error: "empty" };
  if (body.length > CONVERSATION_NOTE_MAX) return { ok: false, error: "too_long" };
  return { ok: true, body };
}

// ── Who reads ───────────────────────────────────────────────────────────────

export interface NoteReader {
  isApplicant: boolean;
  recused: boolean;
  /** Holds the power to place people in roles. */
  holdsPower: boolean;
  /** Holds the role the village names for the final call. */
  isFinalCall: boolean;
  /** Holds the role that holds this conversation. */
  holdsConversationRole: boolean;
}

/** Whether a reader may read, and add to, one conversation's notes. Never the applicant, never anyone who stepped out. */
export function mayReadConversationNotes(r: NoteReader): boolean {
  if (r.isApplicant || r.recused) return false;
  return r.holdsPower || r.isFinalCall || r.holdsConversationRole;
}

/**
 * VOICE REFLECTIONS BETWEEN CONVERSATIONS (the lead, 27 Nov 2026: "so that the visionary at the end can listen to these
 * before her call (and community can listen to mine before their call...)"). A later conversation's holder hears an
 * earlier conversation's RECORDINGS before their own call, and nothing else of it: its written notes and files stay
 * with its own readers. An earlier holder never hears a later one this way (they read it only by the power or the
 * final call, `mayReadConversationNotes`). Never the applicant, never anyone who stepped out. Record and play only:
 * nothing here transcribes, summarises or judges.
 */
export function mayHearReflection(r: { isApplicant: boolean; recused: boolean; holdsLaterConversationRole: boolean }, kind: ConversationNoteKind): boolean {
  if (r.isApplicant || r.recused) return false;
  return kind === "recording" && r.holdsLaterConversationRole;
}

/** Only the person who wrote a note or added a file takes it off. */
export function mayRemoveNote(authorUserId: string, viewerId: string): boolean {
  return authorUserId === viewerId;
}

// ── What the team's page is served ──────────────────────────────────────────

export interface ServedNote {
  id: number;
  kind: ConversationNoteKind;
  /** The note's words, for a written note. */
  body: string | null;
  /** The file's name as it was sent, for a file. */
  fileName: string | null;
  /** Where the file is read, for a file: a door that checks the reader again. */
  fileHref: string | null;
  /** The writer's first name, or "A member". */
  author: string;
  on: string;
  mine: boolean;
}

export interface ConversationNotesView {
  interviewId: number;
  /** "Conversation with <role>", or "Final conversation with <role>". */
  label: string;
  roleId: string;
  final: boolean;
  state: string;
  notes: ServedNote[];
}

export const NOTES_WORDS = {
  heading: "Conversation notes",
  intro: "Private to the people who hold this conversation, the role that makes the final call, and the people who place roles. Never shown to the applicant. No AI reads them.",
  conversation: (role: string, final: boolean) => (final ? `Final conversation with ${role}` : `Conversation with ${role}`),
  none: "No notes yet.",
  write: "Write a note",
  save: "Save the note",
  saved: "Saved. The other interviewers have a notice.",
  addFile: "Add a file",
  kinds: { text: "Note", transcript: "Transcript", recording: "Recording", file: "File" } as Record<ConversationNoteKind, string>,
  open: "Open",
  remove: "Take it off",
  removed: "Taken off.",
  empty: "Write a few words first.",
  tooLong: `Keep a note under ${CONVERSATION_NOTE_MAX} characters, or add it as a transcript file.`,
  tooBig: `That file is over ${Math.round(CONVERSATION_FILE_MAX_BYTES / (1024 * 1024))} MB. Send a shorter one.`,
  wrongType: "That file type does not fit. A transcript is text, PDF or Word; a recording is audio; a file is a PDF, Word or a picture.",
  notAllowed: "These notes are for the people who hold this conversation.",
  notYours: "Only the person who added it takes it off.",
  notFound: "That conversation is not here.",
  decided: "This application has been decided. Its notes stay for the people who decided it.",
} as const;

/** The bell notice to the other interviewers. It carries no applicant name, contact or note words. */
export const NOTES_NOTICES = {
  title: (roles: readonly string[]) => `New conversation notes on an application for ${roles.join(", ") || "a role"}`,
  body: "Open the application to read them. They are never shown to the applicant.",
} as const;
