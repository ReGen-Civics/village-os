#!/usr/bin/env node
/**
 * THE NATURE PAINTINGS' SMALL COPIES AND FINGERPRINTS (live QA, 21 Nov 2026).
 *
 *   node scripts/nature-art-sizes.mjs
 *
 * For every painting in server/assets/nature (720x960) it writes a half-size copy to
 * server/assets/nature/sm (360x480), for the thumbnails and strips that show a painting a few
 * centimetres wide, and it writes shared/natureArtFiles.ts: a fingerprint of every file.
 *
 * The fingerprint goes into each painting's URL (natureArtUrl), so a repainted file has a new
 * address the moment it ships and nobody has to remember to bump a number. The files can then be
 * cached for a year. shared/natureArtFiles.test.ts fails when a painting changes and this script
 * was not run, and names this command.
 *
 * Run it after adding or replacing any painting, and commit both folders and the table.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const DIR = path.join("server", "assets", "nature");
const SM = path.join(DIR, "sm");
const OUT = path.join("shared", "natureArtFiles.ts");
const SMALL = { width: 360, height: 480 };

export const fingerprint = (buf) => crypto.createHash("sha256").update(buf).digest("hex").slice(0, 10);

const slugs = fs.readdirSync(DIR).filter((f) => f.endsWith(".webp")).map((f) => f.slice(0, -5)).sort();
fs.mkdirSync(SM, { recursive: true });
for (const f of fs.readdirSync(SM)) if (!slugs.includes(f.replace(/\.webp$/, ""))) fs.rmSync(path.join(SM, f));

const rows = [];
for (const slug of slugs) {
  const full = fs.readFileSync(path.join(DIR, `${slug}.webp`));
  const small = await sharp(full).resize(SMALL.width, SMALL.height, { fit: "cover" }).webp({ quality: 78, effort: 6 }).toBuffer();
  fs.writeFileSync(path.join(SM, `${slug}.webp`), small);
  rows.push(`  "${slug}": { full: "${fingerprint(full)}", sm: "${fingerprint(small)}" },`);
}

fs.writeFileSync(
  OUT,
  [
    "/**",
    " * WRITTEN BY scripts/nature-art-sizes.mjs: do not edit by hand. A fingerprint of every nature painting and its",
    " * half-size copy, so a painting's URL changes when its file does (natureArtUrl). natureArtFiles.test.ts holds it",
    " * to the files.",
    " */",
    "export const NATURE_ART_FILES: Readonly<Record<string, { full: string; sm: string }>> = {",
    ...rows,
    "};",
    "",
  ].join("\n"),
);
console.log(`[nature-art] ${slugs.length} paintings: small copies in ${SM}, fingerprints in ${OUT}`);
