/**
 * HOW EACH CONVERSATION IS BOOKED, AS THE PUBLIC CARD SAYS IT (the lead, Anchor
 * session of 19 Nov 2026: "each conversation shows its booking link again").
 *
 * The card's "How you're chosen" lists the conversations in order. Each one
 * now carries how to book it, read from the INTERVIEWING ROLE's own booking
 * setting (`org_roles.booking_url`), which a person who edits that role wrote
 * as a public link. A member's own link (prefs.bookingUrl, #1411) stays on the
 * applicant's status page and letters: it is a person's, and a public card
 * names roles.
 *
 * Three shapes:
 *   link      an https booking page            "Book a time"
 *   whatsapp  a wa.me link the role holds       "Message on WhatsApp"
 *   note      the word "whatsapp" alone         "We'll message you on WhatsApp", no number
 *
 * A wa.me link carries a phone number, so it is drawn only because the role's
 * own settings hold it as a public link. Nothing else here ever carries one.
 *
 * Pure: no pool, no clock, no Node builtins.
 */
import { parseBookingUrl } from "./roleBooking";

/** What a role's booking setting may hold besides a link: WhatsApp, with no number on the page. */
export const WHATSAPP_NOTE = "whatsapp";

export type CardBooking = { kind: "link"; url: string } | { kind: "whatsapp"; url: string } | { kind: "note" };

export const CARD_BOOKING_WORDS = {
  link: "Book a time",
  whatsapp: "Message on WhatsApp",
  note: "We'll message you on WhatsApp",
} as const satisfies Record<CardBooking["kind"], string>;

const WA_HOSTS = new Set(["wa.me", "api.whatsapp.com", "whatsapp.com", "www.whatsapp.com", "chat.whatsapp.com"]);

/** A role's booking setting read for the public card, or null when it holds nothing usable. */
export function cardBookingOf(raw: unknown): CardBooking | null {
  if (typeof raw !== "string") return null;
  if (raw.trim().toLowerCase() === WHATSAPP_NOTE) return { kind: "note" };
  const url = parseBookingUrl(raw);
  if (!url) return null;
  return WA_HOSTS.has(new URL(url).hostname.toLowerCase()) ? { kind: "whatsapp", url } : { kind: "link", url };
}
