/**
 * EACH INTERVIEWER'S OWN BOOKING LINK (team call, role application pipeline).
 *
 * An applicant books each conversation with the person who holds that step's
 * interviewing role, through that person's own booking page. A member saves
 * their link once, on their profile, and it is kept in their prefs under
 * `bookingUrl`. Read back only through `memberBookingUrl`, which applies the
 * same rule as a role's link (`parseBookingUrl`: https with a host, no
 * credentials), so whatever sits in prefs never reaches a page unchecked.
 *
 * WHICH LINK A STEP OFFERS, in order:
 *   1. the links of the people holding the step's role now (those who stepped
 *      out of this application left out). One person: their link. Several:
 *      each one's, by first name, and the applicant picks;
 *   2. else the role's own link (`org_roles.booking_url`);
 *   3. else nothing, and the applicant reads "We'll write to you with times".
 *
 * The step is named "Role (First, First)" (`roleWithHolders`, shared/roleHolderLabel.ts),
 * and each person's link is listed under it by first name. Only a first name and a link
 * leave here. Never an email address.
 *
 * Pure: no clock, no database.
 */
import { BOOKING_URL_MAX, parseBookingUrl } from "./roleBooking";
import { roleWithHolders } from "./roleHolderLabel";

/** The key in a member's prefs that holds their booking link. */
export const MEMBER_BOOKING_PREF = "bookingUrl";

/** A member's saved booking link, or null. */
export function memberBookingUrl(prefs: unknown): string | null {
  if (!prefs || typeof prefs !== "object") return null;
  return parseBookingUrl((prefs as Record<string, unknown>)[MEMBER_BOOKING_PREF]);
}

export type BookingLinkInput = { ok: true; value: string | null } | { ok: false; problem: string };

/** A link a member saves. Empty or null clears it. */
export function parseMemberBookingInput(raw: unknown): BookingLinkInput {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, problem: "Send the link as text." };
  const text = raw.trim();
  if (!text) return { ok: true, value: null };
  if (text.length > BOOKING_URL_MAX) return { ok: false, problem: `Keep the link under ${BOOKING_URL_MAX} characters.` };
  const url = parseBookingUrl(text);
  if (!url) return { ok: false, problem: "Use a web address that starts with https://." };
  return { ok: true, value: url };
}

/** One way to book a step: whose link it is (a first name, only when there are several) and where it goes. */
export interface BookingLink {
  who: string | null;
  url: string;
}

export interface StepHolder {
  firstName: string | null;
  /** The holder's saved link, as stored. Checked here. */
  bookingUrl: unknown;
}

/**
 * The links a step offers, in the order above. Several holders with links are
 * listed by first name, sorted, so the page reads the same each time.
 */
export function stepBookingLinks(holders: readonly StepHolder[], roleBookingUrl: unknown): BookingLink[] {
  const own = holders
    .map((h) => ({ who: h.firstName?.trim() || null, url: parseBookingUrl(h.bookingUrl) }))
    .filter((h): h is { who: string | null; url: string } => !!h.url);
  const seen = new Set<string>();
  const unique = own.filter((h) => (seen.has(h.url) ? false : (seen.add(h.url), true)));
  if (unique.length === 1) return [{ who: null, url: unique[0].url }];
  if (unique.length > 1) return [...unique].sort((a, b) => (a.who ?? "").localeCompare(b.who ?? "")).map((h) => ({ who: h.who, url: h.url }));
  const role = parseBookingUrl(roleBookingUrl);
  return role ? [{ who: null, url: role }] : [];
}

/** How one step is booked: who it is with, as "Role (First, First)", and the ways in. */
export interface StepBooking {
  /** The role with the first names of the people holding it now (`roleWithHolders`), sorted. */
  label: string;
  links: BookingLink[];
}

/** The step's label and links: every holder is named in the label, whether or not they keep a link. */
export function stepBookingFor(roleName: string, holders: readonly StepHolder[], roleBookingUrl: unknown): StepBooking {
  const names = holders.map((h) => h.firstName?.trim() || "").filter(Boolean).sort((a, b) => a.localeCompare(b));
  return { label: roleWithHolders(roleName, names), links: stepBookingLinks(holders, roleBookingUrl) };
}

/**
 * The links as one piece of a letter's sentence: the link itself when there is
 * one, else one line per person ("Name: link") under the sentence.
 */
export function bookingLinksText(links: readonly BookingLink[]): string | null {
  if (!links.length) return null;
  if (links.length === 1) return links[0].url;
  return `\n${links.map((l) => `${l.who ?? "-"}: ${l.url}`).join("\n")}`;
}
