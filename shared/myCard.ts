/**
 * TODAY'S CARD, FOR YOURSELF (profile overhaul, Direction D; the lead, 24 Nov 2026: "at the top it can have
 * the 'pull a card' feature that we made for sessions but for themselves if they have their human design and
 * gene keys on").
 *
 * The session card read for one person: the day's sky, read in the browser exactly as a session pull reads it
 * (shared/geneKeysSky.ts `skyAt`), and the member's own chart, read on the server. Nothing is stored and no
 * engine is asked: it is the session card's plain reading (shared/sessionCard.ts), so pulling again on the same
 * day gives the same card. A lens, never a forecast.
 */
import type { CardSky } from "./sessionCard";

export const MY_CARD_API = "/api/me/today-card";

/** Pulls one member may make in an hour. */
export const MY_CARD_PER_HOUR = 30;

export interface MyCard {
  sky: CardSky;
  /** How the day leans, in a line. */
  day: string;
  /** What today's sky switches on in this member's own lines, then how they decide. */
  line: string;
  /** The sky in a line for each system, for the fold under the card. */
  skyLines: { "human-design": string; western: string };
}

export const MY_CARD_REFUSALS = {
  badSky: "The sky did not read. Try again.",
  noLines: "Find your lines first, and the card reads them.",
} as const;
