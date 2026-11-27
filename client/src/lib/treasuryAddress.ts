/**
 * WHERE THE TREASURY LIVES, and where its old addresses land (the lead, 27 Nov 2026: one Treasury place under
 * Govern). /treasury, /cash-payouts and /pricing were pages of their own; each is now a section of
 * /governance/treasury, and the old address redirects to its section.
 *
 * A hash the old address already carried wins, so a notice already sent to `/cash-payouts#pay-board` still lands on
 * "Pay by member". Kept apart from the page so the router (App.tsx, the main chunk) pays a few words for it, never the
 * page.
 */

export const TREASURY_PATH = "/governance/treasury";

/** The ids of the page's sections, each a stable anchor. `pay-board` is PayBoard's own. */
export const TREASURY_SECTIONS = {
  desks: "desks",
  budget: "cash-budget",
  endOfMoon: "end-of-moon",
  payBoard: "pay-board",
  cash: "cash",
  prices: "prices",
  mint: "mint",
} as const;

export type TreasurySection = (typeof TREASURY_SECTIONS)[keyof typeof TREASURY_SECTIONS];

const KNOWN: ReadonlySet<string> = new Set(Object.values(TREASURY_SECTIONS));

/** The address of one section. */
export const treasuryHref = (section: TreasurySection): string => `${TREASURY_PATH}#${section}`;

/**
 * Where an old address lands: its own hash when that names a section here, otherwise the section it stood for.
 * `hash` is `window.location.hash` as read on arrival, with or without its `#`.
 */
export function oldTreasuryAddress(section: TreasurySection, hash: string | null | undefined): string {
  let h = String(hash ?? "").replace(/^#/, "");
  try {
    h = decodeURIComponent(h);
  } catch {
    h = "";
  }
  return treasuryHref(KNOWN.has(h) ? (h as TreasurySection) : section);
}

/** Whether a hash names one of the page's sections, for landing on it. */
export function isTreasurySection(hash: string): hash is TreasurySection {
  return KNOWN.has(hash);
}
