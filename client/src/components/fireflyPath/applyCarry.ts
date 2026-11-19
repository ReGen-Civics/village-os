/**
 * WHAT A SECOND APPLICATION CARRIES OVER (Rye, 15 Nov 2026, from the Spanish phone QA,
 * P1-1: "a second application carries over what the person wrote in the first").
 *
 * One application is for one role, so somebody taking two roles fills the form twice. When
 * an application is sent, the applicant's own words about themselves are kept on this
 * device, and the next role's application, when it has no draft of its own, starts from
 * them with a line saying where they came from.
 *
 * What carries: name, email, about you (where they are based, languages, their story, what
 * they know about themselves, links to their work), the value items, the "how you know us"
 * ticks, and the voice transcript as text.
 * What never carries, by rule: the recording itself, the answers that belong to one role
 * (why this role, the aim, the commitment, the price ask, the terms, their notes on the role
 * card, the practical step), references and the background-check consent (other people's
 * data, and a consent is given per application), files, and the agreements.
 *
 * Kept as long as a draft (DRAFT_DAYS), one per link, the same place the drafts live.
 * Pure apart from readCarry and writeCarry, which go through lib/safeStorage.
 */
import type { ProposalLink } from "@shared/proposalAttachments";
import type { ProposalGoal } from "@shared/proposalGoals";
import type { DraftMarks, DraftableGoal } from "@shared/seraDrafts";
import { VOICE_TRANSCRIPT_MAX } from "@shared/voiceNotes";
import { readStoredJson, writeStoredJson } from "@/lib/safeStorage";
import { DRAFT_VERSION, fromDraft, type ApplyDraft } from "./applyDraft";

export const CARRY_VERSION = 1;

/** The key the carried words live under: one per personal link, or the public form's. */
export function carryKey(link: string): string {
  return `apply-carried-draft:v${CARRY_VERSION}:${link ? `link:${link.slice(0, 100)}` : "public"}`;
}

export interface ApplyCarry {
  savedAt: string;
  name: string;
  email: string;
  about: { based: string; languages: string; story: string };
  selfKnowledge: string;
  links: ProposalLink[];
  knowUs: string[];
  /** The value items, without the role each was written for: the next role takes them as its own. */
  items: Array<Pick<ProposalGoal, "title" | "doneWhen" | "serves"> & { seraDraft?: true }>;
  /** The story Sera drafted and nobody has kept yet: it stays marked until they keep or edit it. */
  storyMark: string;
  transcript: string;
}

export type CarryFields = Omit<ApplyCarry, "savedAt" | "items" | "storyMark"> & { items: DraftableGoal[]; marks: DraftMarks };

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.slice(0, max) : "");

/** What is kept when an application is sent: exactly the fields above, copied one by one. */
export function toCarry(f: CarryFields, now: Date): ApplyCarry {
  return {
    savedAt: now.toISOString(),
    name: f.name.trim(),
    email: f.email.trim(),
    about: { based: f.about.based, languages: f.about.languages, story: f.about.story },
    selfKnowledge: f.selfKnowledge,
    links: f.links.filter((l) => l.url.trim()).map((l) => ({ label: l.label, url: l.url })),
    knowUs: [...f.knowUs],
    items: f.items
      .filter((g) => g.title.trim() || g.doneWhen.trim())
      .map((g) => ({ title: g.title, doneWhen: g.doneWhen, serves: g.serves, ...(g.seraDraft === true ? { seraDraft: true as const } : {}) })),
    storyMark: f.marks.story && f.marks.story === f.about.story ? f.marks.story : "",
    transcript: f.transcript.trim().slice(0, VOICE_TRANSCRIPT_MAX),
  };
}

/** Whether anything is worth carrying: an application with no words of theirs leaves nothing behind. */
export function carriesAnything(c: ApplyCarry): boolean {
  return Boolean(c.name || c.email || c.about.based || c.about.languages || c.about.story || c.selfKnowledge || c.links.length || c.items.length || c.transcript);
}

/**
 * The carried words read back as the next role's starting draft, or null when there are
 * none, they are unreadable, or older than DRAFT_DAYS. The role's own answers come back
 * blank and the person starts on the first step. Never throws.
 */
export function carryAsDraft(raw: unknown, roleId: string, now: Date, lastStep: number): { draft: ApplyDraft; transcript: string } | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, any>;
  const items = Array.isArray(o.items) ? o.items.filter((g: unknown) => g && typeof g === "object").map((g: any) => ({ ...g, roleId, moves: "", date: "" })) : [];
  // Read whole, as fromDraft reads it: a carried story is never cut.
  const story = typeof o.about?.story === "string" ? o.about.story : "";
  // fromDraft does the reading, the limits and the age: one set of rules for both.
  const draft = fromDraft(
    {
      v: DRAFT_VERSION,
      savedAt: o.savedAt,
      step: 0,
      reached: 0,
      knowUs: o.knowUs,
      why: "",
      name: o.name,
      email: o.email,
      about: o.about,
      selfKnowledge: o.selfKnowledge,
      links: o.links,
      aim: "",
      items,
      marks: story && o.storyMark === story ? { story } : {},
      terms: { answers: {}, commitmentPct: null, payAsk: null },
      rampUp: false,
      practical: { timeZone: "", windows: [], earliestStart: "" },
      pieceSuggestions: [],
    },
    now,
    lastStep,
  );
  if (!draft) return null;
  const transcript = str(o.transcript, VOICE_TRANSCRIPT_MAX);
  const carried = toCarry({ ...draft, marks: draft.marks, transcript }, now);
  return carriesAnything(carried) ? { draft, transcript } : null;
}

/** Keep the words of an application just sent, for the next one. Nothing is kept when there are none. */
export function writeCarry(link: string, f: CarryFields, now = new Date()): void {
  const c = toCarry(f, now);
  if (carriesAnything(c)) writeStoredJson("local", carryKey(link), c);
}

/** The carried words for this link, as the next role's draft, or null. */
export function readCarry(link: string, roleId: string, lastStep: number, now = new Date()): { draft: ApplyDraft; transcript: string } | null {
  const read = readStoredJson("local", carryKey(link));
  return carryAsDraft(read.status === "value" ? read.value : null, roleId, now, lastStep);
}

