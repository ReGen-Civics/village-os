/**
 * A ROLE'S COMMITMENT AS ONE PLAIN KIND (the lead, 24 Nov 2026, from the team call: "fractional /
 * part-time / contract made plain on role cards").
 *
 * Read only from the role's own data, in this order, so nothing is invented:
 *   1. `card.commitmentPct`, a role offered at one share: 100 is full time, less is part time;
 *   2. `card.commitmentMin`, a role that can be shared: below 100 it is full or part time;
 *   3. the words the role was written with (`timeCommitment`), when they say full, part or both;
 * and `card.track` (or the seat's own track) says whether it is a contract. Hours are not tracked and
 * pay is never part of it. A role whose data says none of this has no kind, and the card shows nothing.
 */
import { readTrack } from "./roleTracks";

export type CommitmentTime = "full" | "part" | "either";

export interface CommitmentKind {
  time: CommitmentTime | null;
  contract: boolean;
}

/** The time the role's own words say: both, part or full; null when they say none of these. */
export function timeFromWords(words: unknown): CommitmentTime | null {
  if (typeof words !== "string") return null;
  const w = words.toLowerCase();
  const full = /\bfull(?:[- ]time)?\b|\bwhole\b/.test(w);
  const part = /\bpart(?:[- ]time)?\b|\bfractional\b/.test(w);
  if (full && part) return "either";
  if (part) return "part";
  if (full) return "full";
  return null;
}

export function commitmentKind(seat: unknown): CommitmentKind | null {
  const s = seat && typeof seat === "object" ? (seat as Record<string, unknown>) : {};
  const card = s.card && typeof s.card === "object" ? (s.card as Record<string, unknown>) : {};
  const pct = card.commitmentPct;
  const min = card.commitmentMin;
  let time: CommitmentTime | null = null;
  if (typeof pct === "number" && Number.isInteger(pct) && pct >= 1 && pct <= 100) time = pct === 100 ? "full" : "part";
  else if (typeof min === "number" && Number.isInteger(min) && min >= 1 && min <= 100) time = min < 100 ? "either" : "full";
  else time = timeFromWords(s.timeCommitment);
  const contract = (readTrack(card.track) ?? readTrack(s.track)) === "contractor";
  return time || contract ? { time, contract } : null;
}
