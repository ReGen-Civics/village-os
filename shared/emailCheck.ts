/**
 * THE ENTRANCE'S INSTANT EMAIL CHECKS (the lead, 24 Nov 2026): the shape of the address, a suggestion
 * when the domain looks like a well-known one mistyped, and a refusal for throwaway inboxes. Whether
 * the domain receives mail at all is asked by the server (server/lib/entranceCode.ts, `domainTakesMail`),
 * since a browser cannot read DNS.
 *
 * Nothing here judges a person: these are facts about an address, and every refusal says what to fix.
 */

/** Domains a person often means when they mistype one. */
const COMMON_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "yahoo.es",
  "hotmail.es",
  "outlook.es",
];

/**
 * Throwaway inbox services: an address that stops existing within the hour cannot be followed up.
 * A short list of the widely used ones, kept by hand; a village adds none and loses nothing.
 */
export const DISPOSABLE_DOMAINS: ReadonlySet<string> = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "sharklasers.com",
  "10minutemail.com",
  "10minutemail.net",
  "temp-mail.org",
  "tempmail.com",
  "tempmailo.com",
  "throwawaymail.com",
  "yopmail.com",
  "yopmail.net",
  "getnada.com",
  "nada.email",
  "dispostable.com",
  "maildrop.cc",
  "trashmail.com",
  "trashmail.de",
  "fakeinbox.com",
  "mintemail.com",
  "mohmal.com",
  "emailondeck.com",
  "moakt.com",
  "tempr.email",
  "discard.email",
  "spamgourmet.com",
  "mailnesia.com",
  "mytemp.email",
  "burnermail.io",
  "tempinbox.com",
]);

/** The domain part, lowercased, or "" when there is none. */
export function domainOf(email: string): string {
  const at = email.lastIndexOf("@");
  return at < 0 ? "" : email.slice(at + 1).trim().toLowerCase();
}

export function isDisposable(email: string): boolean {
  const d = domainOf(email);
  if (!d) return false;
  if (DISPOSABLE_DOMAINS.has(d)) return true;
  // A subdomain of one (`x.mailinator.com`).
  return Array.from(DISPOSABLE_DOMAINS).some((k) => d.endsWith(`.${k}`));
}

/** Edit distance, small strings only. */
function distance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const here = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = here;
    }
  }
  return prev[b.length];
}

/**
 * The address the person probably meant, when its domain is one keystroke from a common one
 * (`hotmail.co`), or two with the same ending (`gmial.com`), or null. Never suggests for a domain that is itself common.
 */
export function suggestEmail(email: string): string | null {
  const d = domainOf(email);
  if (!d || COMMON_DOMAINS.includes(d)) return null;
  let best: { domain: string; d: number } | null = null;
  for (const c of COMMON_DOMAINS) {
    const n = distance(d, c);
    // Two keystrokes only within the same ending, so `yahoo.fr` is never steered to `yahoo.es`.
    const sameEnding = d.slice(d.lastIndexOf(".")) === c.slice(c.lastIndexOf("."));
    if ((n === 1 || (n === 2 && sameEnding)) && (!best || n < best.d)) best = { domain: c, d: n };
  }
  if (!best) return null;
  return `${email.slice(0, email.lastIndexOf("@"))}@${best.domain}`;
}
