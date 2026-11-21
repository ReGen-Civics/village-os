import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NATURE_ART } from "./natureArt";
import { NATURE_ART_FILES } from "./natureArtFiles";

const DIR = path.join(__dirname, "..", "server", "assets", "nature");
const print = (file: string) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 10);
const FIX = "a painting changed and its fingerprint did not: run `node scripts/nature-art-sizes.mjs` and commit what it writes";

describe("the nature paintings' fingerprints and small copies", () => {
  it("has a full painting and a half-size copy for every painting, each matching its fingerprint", () => {
    expect(Object.keys(NATURE_ART_FILES).sort()).toEqual(NATURE_ART.map((a) => a.slug).sort());
    for (const a of NATURE_ART) {
      const want = NATURE_ART_FILES[a.slug]!;
      expect(print(path.join(DIR, `${a.slug}.webp`)), `${a.slug}: ${FIX}`).toBe(want.full);
      expect(print(path.join(DIR, "sm", `${a.slug}.webp`)), `${a.slug} (small): ${FIX}`).toBe(want.sm);
    }
  });

  it("keeps each small copy a fraction of the full painting", () => {
    for (const a of NATURE_ART) expect(fs.statSync(path.join(DIR, "sm", `${a.slug}.webp`)).size).toBeLessThan(40 * 1024);
  });
});
