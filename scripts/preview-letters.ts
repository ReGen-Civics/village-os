/**
 * RENDER THE VILLAGE'S LETTERS TO STATIC HTML, for looking at them in a
 * browser or a screenshot tool. Sends nothing and reads no database: the
 * village, its modules and its settings are sample values passed in here.
 *
 *   npx tsx scripts/preview-letters.ts <out-dir> [seed] [character]
 *
 * Writes one .html and one .txt per letter. The sample village is a made-up
 * one (shared/comms/letterSamples.ts), so no real village's name appears.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderSampleLetters } from "../shared/comms/letterSamples";

const out = process.argv[2];
if (!out) {
  console.error("usage: npx tsx scripts/preview-letters.ts <out-dir> [seed] [character]");
  process.exit(2);
}
const seed = process.argv[3] ?? null;
const character = process.argv[4] ?? null;
mkdirSync(out, { recursive: true });
for (const l of renderSampleLetters({ seed, character })) {
  writeFileSync(join(out, `${l.id}.html`), l.html);
  writeFileSync(join(out, `${l.id}.txt`), l.text);
  console.log(`${l.id}: ${l.subject}`);
}
