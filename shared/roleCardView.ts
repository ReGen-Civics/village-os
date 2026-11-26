/**
 * ONE VIEW MODEL FOR THE FULL CARD (role journey PR-C): /roles, the circle
 * page, the map, the draft board and the profile all read a seat's parameters
 * through this function, so they cannot say different things.
 *
 * The input is a seat as `/api/org` or `/api/map` sent it (server/lib/
 * roleCardProjection.ts builds `card`). Nothing is invented: a parameter the
 * role has not written is left out of `rows`, and the gate says which are
 * missing.
 *
 * Hours read "Roughly ..." everywhere (Rye, 9 Nov): they are an estimate.
 */
import {
  BEING_WRITTEN,
  TRACK_WORDS,
  readTrack,
  WHERE_WORDS,
  beingWrittenLine,
  interviewLines,
  interviewTotalWords,
  type CardPart,
  type InterviewStepView,
  type RoleTrack,
  type WhereWorked,
} from "./roleParams";
import { publicPayWords, type PublicPay } from "./rolePublicPay";
import { HELD_BY_LABEL, HELD_BY_WORDS, readHeldBy } from "./agentHolders";
import type { CardBooking } from "./cardBooking";
import type { Widened } from "./wordTableTypes";

/**
 * A conversation's booking as the card reads it back, so a bad answer books nothing. The server built it
 * (shared/cardBooking.ts `cardBookingOf`); here only its shape and an https address are checked, so the
 * card's first view does not carry the full link parser.
 */
export function readCardBooking(v: unknown): CardBooking | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (o.kind === "note") return { kind: "note" };
  if ((o.kind === "link" || o.kind === "whatsapp") && typeof o.url === "string" && /^https:\/\/[^\s/@]+(?:\/\S*)?$/i.test(o.url) && o.url.length <= 300) return { kind: o.kind, url: o.url };
  return null;
}

export interface CardRow {
  id: "heldBy" | "commitment" | "track" | "goals" | "where" | "nationality" | "languages" | "review" | "interviews" | "criteria" | "budget";
  label: string;
  lines: string[];
  /** How to book each line, beside it: only the interviews row has these, one per line (null where a line books nothing). */
  bookings?: Array<CardBooking | null>;
}

export interface RoleCardView {
  rows: CardRow[];
  /** The pay group in words, for a listed open role; null otherwise. */
  pay: { headline: string; lines: string[] } | null;
  /** True while the village holds Apply back for a card that is not complete. */
  beingWritten: boolean;
  /** The sentence that says so, with what is still to write. */
  beingWrittenLine: string | null;
  /** Whether Apply may show. */
  applyAllowed: boolean;
  /** Coming soon (shared/roleListing.ts): a badge, and the interviews note beside Apply. */
  comingSoon: boolean;
  /** A future venture (shared/roleListing.ts): its badge, and the pitch prompts beside Apply. */
  futureVenture: boolean;
}

/** The nationality line in its lines: one per line break or "|", so a preferred and a possible read as two lines. */
export function nationalityLines(v: unknown): string[] {
  if (typeof v !== "string") return [];
  return v.split(/\r?\n|\s*\|\s*/).map((l) => l.trim()).filter(Boolean);
}

/**
 * Every word the card's parameter rows print, in one table (lane ES-A, 26 Nov 2026). The client passes its
 * translated copy (client/src/components/power/cardViewWords.ts) as `roleCardView`'s `words`; anything that
 * passes none reads this English. The track, where and who-can-hold words are the shared tables' own.
 */
export const CARD_VIEW_WORDS = {
  labels: {
    heldBy: HELD_BY_LABEL,
    commitment: "Commitment",
    track: "Track",
    goals: "Village goals it serves",
    where: "Where",
    nationality: "Nationality",
    languages: "Languages",
    review: "Review",
    interviews: "How it is filled",
    criteria: "Selection criteria",
    budget: "Budget line",
  } satisfies Record<CardRow["id"], string>,
  heldBy: HELD_BY_WORDS,
  track: TRACK_WORDS,
  where: WHERE_WORDS,
  commitmentPct: (pct: number): string => `${pct}%`,
  firstReviewOn: (words: string): string => `First review ${words}`,
  firstReviewAfter: (days: number): string => `First review after ${days} ${days === 1 ? "day" : "days"}`,
  firstConversation: (words: string): string => `First conversation: ${words}`,
  consentedBy: (circle: string): string => `Paid roles are consented by ${circle}`,
  conversationsInAll: (total: string): string => `${total} of conversations in all`,
};

/** The card's row words with every literal widened, so a translated copy fits the same slot. */
export type CardViewWords = Widened<typeof CARD_VIEW_WORDS>;

const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : []);

export function roleCardView(seat: unknown, locale = "en-GB", w: CardViewWords = CARD_VIEW_WORDS): RoleCardView {
  const L = w.labels;
  const s = seat && typeof seat === "object" ? (seat as Record<string, any>) : {};
  const card: Record<string, any> = s.card && typeof s.card === "object" ? s.card : {};
  const rows: CardRow[] = [];

  // Who may hold it (0374), only when the card says: nothing is invented.
  const heldBy = readHeldBy(card.heldBy);
  if (heldBy) rows.push({ id: "heldBy", label: L.heldBy, lines: [w.heldBy[heldBy]] });

  // Commitment replaced "Roughly N hours a week" (joining lane PR 3). A role card written before it keeps its text, unshown.
  const commitment = Number.isInteger(card.commitmentPct) ? (card.commitmentPct as number) : null;
  if (commitment !== null) rows.push({ id: "commitment", label: L.commitment, lines: [w.commitmentPct(commitment)] });

  const track = card.track as RoleTrack | null | undefined;
  // Read through the one list, so a track stored in older words ("paid", "local") still shows (guide v2).
  const readT = readTrack(track);
  if (readT) rows.push({ id: "track", label: L.track, lines: [w.track[readT]] });

  const goals = list(card.villageGoals);
  if (goals.length) rows.push({ id: "goals", label: L.goals, lines: goals });

  const where = card.whereWorked as WhereWorked | null | undefined;
  // The card's own words for where (sections.where, the lead, 19 Nov 2026) stand in for the listing's label.
  const whereText = typeof card.whereText === "string" ? card.whereText.trim() : "";
  if (whereText) rows.push({ id: "where", label: L.where, lines: [whereText] });
  else if (where && w.where[where]) rows.push({ id: "where", label: L.where, lines: [w.where[where]] });

  // The village's one nationality line (`org.role_card_nationality`, the lead, 24 Nov 2026), sent on open roles only.
  const nationality = nationalityLines(card.nationality);
  if (nationality.length) rows.push({ id: "nationality", label: L.nationality, lines: nationality });

  const languages = list(card.languages);
  if (languages.length) rows.push({ id: "languages", label: L.languages, lines: [languages.join(", ")] });

  // The village's words for the first review (`org.role_card_first_review`, the lead, 19 Nov 2026) win over a card's days.
  const days = Number(card.reviewAfterDays);
  const firstReview = typeof card.firstReview === "string" ? card.firstReview.trim() : "";
  if (firstReview) rows.push({ id: "review", label: L.review, lines: [w.firstReviewOn(firstReview)] });
  else if (Number.isInteger(days) && days > 0) rows.push({ id: "review", label: L.review, lines: [w.firstReviewAfter(days)] });

  const steps: InterviewStepView[] = Array.isArray(card.conversations) ? card.conversations : [];
  const first = typeof card.firstConversation === "string" && card.firstConversation.trim() ? w.firstConversation(card.firstConversation.trim()) : null;
  const consent = typeof card.consentCircle === "string" && card.consentCircle.trim() ? w.consentedBy(card.consentCircle.trim()) : null;
  if (steps.length || first || consent) {
    const lines = interviewLines(steps);
    const total = interviewTotalWords(steps);
    const head = first ? [first] : [];
    const tail = consent ? [consent] : [];
    const totalLine = total ? [w.conversationsInAll(total)] : [];
    // Each conversation with how to book it (the lead, 19 Nov 2026; shared/cardBooking.ts), read again so a bad row books nothing.
    const stepBookings = steps.map((st) => readCardBooking((st as { booking?: unknown }).booking));
    const bookings = stepBookings.some(Boolean) ? [...head.map(() => null), ...stepBookings, ...totalLine.map(() => null), ...tail.map(() => null)] : undefined;
    rows.push({ id: "interviews", label: L.interviews, lines: [...head, ...lines, ...totalLine, ...tail], ...(bookings ? { bookings } : {}) });
  }

  const criteria = list(card.selectionCriteria);
  if (criteria.length) rows.push({ id: "criteria", label: L.criteria, lines: criteria });

  if (typeof card.budgetLine === "string" && card.budgetLine.trim()) rows.push({ id: "budget", label: L.budget, lines: [card.budgetLine.trim()] });

  const pay = card.publicPay && typeof card.publicPay === "object" ? publicPayWords(card.publicPay as PublicPay, locale) : null;
  // A coming-soon role is applied for early on its short card, so the village's "complete card" hold does not apply.
  const held = card.gated === true && card.complete !== true && s.comingSoon !== true && s.futureVenture !== true;
  return {
    rows,
    pay,
    beingWritten: held,
    beingWrittenLine: held ? beingWrittenLine({ missing: (Array.isArray(card.missing) ? card.missing : []) as CardPart[] }) : null,
    applyAllowed: !held,
    comingSoon: s.comingSoon === true && s.futureVenture !== true,
    futureVenture: s.futureVenture === true,
  };
}

export { BEING_WRITTEN };
