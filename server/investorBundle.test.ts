/**
 * NO INVESTOR WORDS IN THE SCRIPT (the lead, 27 Nov 2026: "Yes I want to hide the generic text right now and going
 * forward it should be screened to show investment details").
 *
 * The investor page's spec with its default words (server/lib/investorJourney.ts) and its labels
 * (server/lib/investorPageWords.ts) reach a browser only through GET /api/investor/page, for the readers the team let
 * in. Everything the build writes for the browser is served to anyone who asks, so a single import of either file
 * from client code would put the whole page back in front of every reader. This reads the BUILT output for the
 * page's words.
 *
 * WHICH WORDS. Every default text the investor spec carries, and every label in the word table, that is the
 * investor page's own: a line another public page also says (a step shared with the other journeys, "Common
 * Questions") is not evidence and is left out, and so is anything under 20 characters. The interest form's own words
 * (components/investor/InvestorInterest.tsx) are not the investor page's and are not read here.
 *
 * WHERE. Every chunk in `dist/public/assets`, and the long English the build moves out of the chunks into
 * `dist/i18n/parts/en` (client/src/i18n/copySplit.ts), which the server hands to anyone who asks for it
 * (server/routes/i18n.ts). Both are what a reader downloads.
 *
 * IT READS THE BUILT ARTIFACT. `pnpm build` runs before the tests in CI. By hand, build first, or this fails on the
 * missing directory, which is the right answer (server/trackerPrivacy.test.ts reads the same way).
 */
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { INVESTOR_JOURNEY } from "./lib/investorJourney";
import { INVESTOR_WORDS_EN } from "./lib/investorPageWords";
import { PAGE_SPECS } from "../shared/pageContent";
import type { PageSpec } from "../shared/pageContent/types";

const ASSETS = path.resolve(process.cwd(), "dist/public/assets");
const PARTS = path.resolve(process.cwd(), "dist/i18n/parts/en");
const MIN = 20;
/** The interest form's own words: drawn for every reader, so the read must find them (the control). */
const FORM_WORDS = "Tell us about yourself and how you invest.";

/** Every default string a spec carries: fields, and every list row's cells. */
function defaultsOf(spec: PageSpec): string[] {
  const out: string[] = [];
  for (const section of spec.sections) {
    for (const f of section.fields) if (typeof f.default === "string") out.push(f.default);
    for (const list of section.lists ?? []) {
      for (const row of list.default ?? []) for (const v of Object.values(row)) if (typeof v === "string") out.push(v);
    }
  }
  return out;
}

/** The pieces of a default between its placeholders, quotes and markup, long enough to be the page's own. */
function phrasesOf(words: string): string[] {
  return words
    .split(/\{[^}]*\}|\*\*|[\n"'\u2018\u2019\u201c\u201d]/)
    .map((p) => p.trim())
    .filter((p) => p.length >= MIN);
}

const PUBLIC_WORDS = PAGE_SPECS.flatMap(defaultsOf).join("\n");
const PHRASES = Array.from(new Set([...defaultsOf(INVESTOR_JOURNEY), ...Object.values(INVESTOR_WORDS_EN)].flatMap(phrasesOf))).filter(
  (p) => !PUBLIC_WORDS.includes(p) && !/^(Something went wrong|Please try again)/.test(p),
);

function filesIn(dir: string, ext: RegExp): string {
  expect(fs.existsSync(dir), `${dir} is missing: run pnpm build first`).toBe(true);
  return fs
    .readdirSync(dir)
    .filter((f) => ext.test(f))
    .map((f) => fs.readFileSync(path.join(dir, f), "utf8"))
    .join("\n");
}

/** What a reader can download: the chunks, and the moved English, read both as stored (JSON) and unescaped. */
function downloadable(): string {
  const parts = filesIn(PARTS, /\.json$/);
  const unescaped = parts.split('\\"').join('"').split("\\n").join("\n");
  return [filesIn(ASSETS, /\.(js|html)$/), parts, unescaped].join("\n");
}

describe("the investor page's words in what the build serves", () => {
  it("reads enough of the page to mean something", () => {
    // A guard that looked for nothing would pass. The spec alone holds dozens of the page's own lines.
    expect(PHRASES.length).toBeGreaterThan(40);
    expect(PHRASES).toContain("Capital Contributor Journey");
    expect(PHRASES).toContain("Request the full investor pack with financials and development timeline.");
  });

  it("ships none of them to any reader", () => {
    const all = downloadable();
    expect(all.length).toBeGreaterThan(100_000);
    // CONTROL: the interest form's words are drawn for everyone, so the read reaches where the page's would be.
    expect(all.includes(FORM_WORDS), "the interest form's words were not found: the read is not reaching the page").toBe(true);
    // CONTROL: a public journey page's default words ship exactly the way the investor page's used to, and are found.
    const steward = PAGE_SPECS.find((s) => s.id === "journey-steward")!;
    const shipped = defaultsOf(steward).flatMap(phrasesOf).filter((p) => all.includes(p));
    expect(shipped.length, "no public journey default was found: the read cannot see page words").toBeGreaterThan(10);
    expect(PHRASES.filter((p) => all.includes(p))).toEqual([]);
  });
});
