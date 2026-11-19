/**
 * NOTHING AN APPLICANT WRITES OR SAYS IS CUT (the ops request of 19 Nov 2026). A static check over the application's
 * own files: a `.slice(0, …)` whose receiver is one of an applicant's answers, or words they spoke, fails here.
 *
 * Scoped narrowly on purpose. Ids, keys, dates, a draft's storage key and the review's short previews (which show
 * "…" and keep the answer itself whole) still slice; only a receiver named for user content is caught, so a new
 * `why.slice(0, OPEN_WHY_MAX)` or `transcript.slice(0, …)` cannot come back unnoticed. A genuine exception takes an
 * inline `cut-ok: <reason>` on the same line.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
/** The apply and propose flows, the voice components, and the boxes they draw. */
const DIRS = ["components/fireflyPath", "components/voice", "components/openProposal"];
const FILES = [
  "pages/ProposeARole.tsx",
  "components/form/GrowingField.tsx",
  "components/form/MicInput.tsx",
  "components/form/LimitSigns.tsx",
  "components/journal/GrowingTextarea.tsx",
  "components/roleCard/ShapeTheRole.tsx",
  "components/governance/PriceAsk.tsx",
  "components/governance/TermsEight.tsx",
];

/** Receivers that hold what an applicant wrote or said. */
const USER_CONTENT = /\b(why|aim|story|based|languages|selfKnowledge|transcript|words|text|note|notes|title|doneWhen|how|contact|url|next|draft|heard|said|chunk|answer|value|caught)\b[\w.?!()[\]"']*$/;

function sources(): string[] {
  const out = FILES.map((f) => path.join(ROOT, f));
  for (const d of DIRS) {
    for (const f of fs.readdirSync(path.join(ROOT, d))) {
      if (/\.(ts|tsx)$/.test(f) && !/\.test\.(ts|tsx)$/.test(f)) out.push(path.join(ROOT, d, f));
    }
  }
  return out;
}

/** Every `.slice(0,` applied to a receiver named for user content, as "file:line: text". */
export function cutsIn(file: string, text: string): string[] {
  const found: string[] = [];
  text.split("\n").forEach((line, i) => {
    if (/cut-ok:/.test(line)) return;
    const code = line.replace(/\/\/.*$/, "");
    let at = code.indexOf(".slice(0,");
    while (at >= 0) {
      const before = code.slice(Math.max(0, at - 60), at);
      if (USER_CONTENT.test(before)) found.push(`${path.relative(ROOT, file)}:${i + 1}: ${line.trim()}`);
      at = code.indexOf(".slice(0,", at + 1);
    }
  });
  return found;
}

describe("the application never cuts an applicant's words", () => {
  it("no .slice(0, …) on an answer, a transcript or spoken words in the apply and voice files", () => {
    const files = sources();
    expect(files.length).toBeGreaterThan(20);
    const cuts = files.flatMap((f) => cutsIn(f, fs.readFileSync(f, "utf8")));
    expect(cuts).toEqual([]);
  });

  it("CONTROL: the check catches the cuts it exists for, and lets ids and previews through", () => {
    expect(cutsIn("x.ts", "setWhy(next.slice(0, OPEN_WHY_MAX));")).toHaveLength(1);
    expect(cutsIn("x.ts", "transcript: transcript.slice(0, VOICE_TRANSCRIPT_MAX),")).toHaveLength(1);
    expect(cutsIn("x.ts", "if (blob) setClipWords(blob, text.slice(0, VOICE_CLIP_WORDS_MAX));")).toHaveLength(1);
    expect(cutsIn("x.ts", "return { text: text.replace(c, words).slice(0, max), placed: true };")).toHaveLength(1);
    expect(cutsIn("x.ts", "const roleId = str(x.roleId, 128); const k = link.slice(0, 100);")).toHaveLength(0);
    expect(cutsIn("x.ts", "now.toISOString().slice(0, 10)")).toHaveLength(0);
    expect(cutsIn("x.ts", "setWhy(next.slice(0, 9)); // cut-ok: a test of the waiver")).toHaveLength(0);
  });
});
