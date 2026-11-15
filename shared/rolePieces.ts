/**
 * THE ROLE CARD, PIECE BY PIECE (Rye, 14 Nov 2026: "more icons and ways to break up the massive
 * text"; approved mockup https://claude.ai/artifact/NaavCsufyAEHKowgEdKFAX, A).
 *
 * The founding card shows one piece of the role at a time. These helpers only SPLIT the words the
 * role editor wrote; they never rewrite, reorder or drop one, so an edit in Admin shows up as
 * written and a line that does not fit a shape is drawn whole.
 *
 *   splitLine   "Our story: Amora's voice across every channel" -> a titled tile
 *               { title: "Our story", body: "Amora's voice..." }; a line with no short lead before
 *               a colon stays one body. The same split turns "Weekly: the cash view" into a rhythm
 *               row whose label is "Weekly".
 *   splitDomain the domain's one long sentence -> its lead and its parts, at the semicolons the
 *               editor wrote ("...: storytelling, brand; social media; ...").
 *
 * Pure: no React, no clock, no locale beyond the punctuation a writer types.
 */

export interface SplitLine {
  /** The short lead before the colon, when there is one. */
  title: string | null;
  body: string;
}

/** A lead is short: up to 48 characters and no sentence end inside it, so "Note: ..." style prose is not cut mid-thought. */
const LEAD = /^([^:.!?]{2,48}):\s+(\S[\s\S]*)$/;

export function splitLine(line: string): SplitLine {
  const text = line.trim();
  const m = LEAD.exec(text);
  if (!m) return { title: null, body: text };
  return { title: m[1].trim(), body: m[2].trim() };
}

export interface SplitDomain {
  lead: string;
  parts: string[];
}

/**
 * The domain's lead and its parts. Only a domain written as a list (a colon, then parts between
 * semicolons) is split; anything else is its own lead with no parts.
 */
export function splitDomain(domain: string): SplitDomain {
  const text = domain.trim();
  const colon = text.indexOf(": ");
  if (colon < 0 || !text.includes(";")) return { lead: text, parts: [] };
  const lead = text.slice(0, colon).trim();
  const parts = text
    .slice(colon + 2)
    .split(/;\s+/)
    .map((p) => p.trim().replace(/^and\s+/i, "").replace(/[.;]$/, "").trim())
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1));
  return parts.length > 1 ? { lead, parts } : { lead: text, parts: [] };
}

/**
 * THE DOMAINS A ROLE HOLDS, short (Rye, 14 Nov 2026: "Domains they hold ... right now they're just doing
 * the work of those domains"). The domain's parts, a long one cut at its first comma outside brackets,
 * so "the financial model and its change log, including viability ..." reads "The financial model and
 * its change log" while "building, renovation and repair" stays whole (live test, 14 Nov: a bare
 * "Building" said nothing). A part about growing a circle is left out: growing a circle is not part of
 * the work the founding team is asked to do now, and the team view never implies it.
 */
/** A domain part up to this long is shown whole; a longer one is cut at its first comma outside brackets. */
export const DOMAIN_CHIP_CHARS = 48;

export function domainsHeld(domain: string, max = 4): string[] {
  const cut = (p: string): string => {
    let depth = 0;
    for (let i = 0; i < p.length; i++) {
      const c = p[i];
      if (c === "(") depth++;
      else if (c === ")") depth = Math.max(0, depth - 1);
      else if (c === "," && depth === 0 && p.length > DOMAIN_CHIP_CHARS) return p.slice(0, i).trim();
    }
    return p.trim();
  };
  return splitDomain(domain)
    .parts.filter((p) => !/\bcircles?\b/i.test(p))
    .map(cut)
    .filter(Boolean)
    .slice(0, max);
}
