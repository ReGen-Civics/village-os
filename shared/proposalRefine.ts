/**
 * THE APPLICANT REFINES THEIR PROPOSAL (the lead, 27 Nov 2026: "we move to references and them refining their
 * proposal while they're doing their next conversation with community role ... once they have their proposal solid
 * and they passed this step they move to their final conversation ... to deliver their proposal there").
 *
 * WHEN. Only while the application stands at References and proposal (shared/applicantOnboarding.ts `trackStates`).
 * EDITS FREEZE once the final conversation opens to book, or is booked, held or skipped (the coordinator's ruling,
 * agreed by the lead: the final role reads one fixed version). After that, a change goes only through the
 * counter-offer loop (shared/counterOffer.ts).
 *
 * WHAT. The proposal's own words: why them and why now, and their aim in the role. Every earlier version is kept, so
 * the final conversation reads what changed. Nothing here is scored or read by an AI.
 */
import { OPEN_AIM_MAX, OPEN_WHY_MAX } from "./openProposals";
import type { TrackStage } from "./applicantOnboarding";

export interface ProposalVersion {
  /** When this version was replaced, ISO. */
  at: string;
  why: string;
  aim: string;
}

/** The most earlier versions kept: plenty for a few weeks of refining, bounded so the row stays small. */
export const PROPOSAL_VERSIONS_MAX = 20;

/** A final conversation that has opened, been booked, held or skipped freezes the proposal. */
export function finalFreezes(finals: ReadonlyArray<{ state: string; booked: boolean }>): boolean {
  return finals.some((i) => i.booked || i.state === "open" || i.state === "scored" || i.state === "skipped");
}

/** Whether the applicant may refine their proposal now. */
export function mayRefine(f: { stage: TrackStage; decided: boolean; finalFrozen: boolean }): boolean {
  return !f.decided && !f.finalFrozen && f.stage === "references";
}

const clean = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(/\r\n/g, "\n").trim() : "").slice(0, max + 1);

/** The refined words as the form sent them: both required, within the form's own limits. */
export function readRefined(raw: unknown): { ok: true; why: string; aim: string } | { ok: false; error: "empty" | "too_long" | "unchanged" } {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const why = clean(o.why, OPEN_WHY_MAX);
  const aim = clean(o.aim, OPEN_AIM_MAX);
  if (!why || !aim) return { ok: false, error: "empty" };
  if (why.length > OPEN_WHY_MAX || aim.length > OPEN_AIM_MAX) return { ok: false, error: "too_long" };
  return { ok: true, why, aim };
}

/** The earlier versions as stored, oldest first, dropping anything unreadable. */
export function readVersions(raw: unknown): ProposalVersion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
    .map((v) => ({ at: String(v.at ?? ""), why: String(v.why ?? ""), aim: String(v.aim ?? "") }))
    .filter((v) => v.at && (v.why || v.aim))
    .slice(-PROPOSAL_VERSIONS_MAX);
}

/** What the applicant's page is served about refining. */
export interface RefineView {
  /** The form is open now. */
  open: boolean;
  /** The final conversation froze the proposal: changes go through the counter-offer now. */
  frozen: boolean;
  why: string;
  aim: string;
  /** How many earlier versions are kept. */
  versions: number;
}

export const REFINE_ERRORS = {
  empty: "Write both: why you, and your aim.",
  too_long: "That is longer than the form allows.",
  unchanged: "Nothing changed.",
  closed: "Your proposal is fixed now that your final conversation has opened. A change goes through our answer to your proposal.",
  not_found: "That proposal is not here.",
} as const;
