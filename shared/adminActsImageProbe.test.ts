/**
 * THE IMAGE BUILD'S PROBE READS PROSE AS IMPORTS, AND THE REGISTRY IS PROSE.
 *
 * The Dockerfile ends with a probe that reads the built server (`dist/index.js`) for
 * every module it imports at run time and fails the image when one does not resolve.
 * It finds imports with three patterns, and a pattern cannot tell code from a string:
 * the search words `"profile import", "profile file"` read to it as `import ", "`,
 * a module named `, ` that no image holds. That shipped red on #1895 (28 Nov 2026).
 *
 * WHY NO OTHER CHECK SAW IT. The image is built by `selfhost-smoke`, which runs only
 * when a pull request touches the compose path. A pull request that adds words to the
 * registry never does, so the probe first read these words when a merge brought a
 * compose file with it. This test reads them on every run.
 *
 * THE PATTERNS ARE THE PROBE'S OWN, read out of the Dockerfile, so this test cannot
 * drift from the check that decides. If the probe's line changes shape, the reader
 * below fails by name and says so.
 *
 * WHAT IT SCANS. Every act, printed the three ways a bundler may print a table of
 * strings: one array on a line with spaces, compact, and one string to a line.
 *
 * THE RULE FOR A WORD LIST: no entry may END in the word import or export after a
 * space, because the closing quote and the next entry's opening quote then read as a
 * module name. Put the word first ("import a profile") or use it alone ("import").
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ADMIN_ACTS } from "./adminActs";

const DOCKERFILE = path.resolve(__dirname, "..", "Dockerfile");

/** The probe's three patterns, exactly as the image build runs them. */
function probePatterns(): RegExp[] {
  const line = fs
    .readFileSync(DOCKERFILE, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("RUN node -e") && l.includes("runtime imports"));
  if (!line) throw new Error("The Dockerfile's runtime-import probe was not found. Update this reader to its new shape.");
  const list = /for\(const re of \[(.+?)\]\)\{let m;/.exec(line);
  if (!list) throw new Error("The probe's list of patterns was not found on its line. Update this reader to its new shape.");
  // The Dockerfile is this repository's own file, and these are regular expression literals.
  const patterns = new Function(`return [${list[1]}];`)() as unknown[];
  if (patterns.length < 3 || !patterns.every((p) => p instanceof RegExp)) throw new Error("The probe's patterns did not read as regular expressions.");
  return patterns as RegExp[];
}

/** Every capture the probe would make in a text, with a little of what surrounds it. */
function captures(text: string, patterns: readonly RegExp[]): string[] {
  const found: string[] = [];
  for (const source of patterns) {
    const re = new RegExp(source.source, source.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      found.push(`${JSON.stringify(m[1])} in ...${text.slice(Math.max(0, m.index - 60), m.index + Math.min(m[0].length, 80)).replace(/\s+/g, " ")}...`);
    }
  }
  return found;
}

/** A table of strings the way a bundler prints it on one line: `key: "value", list: ["a", "b"]`. */
function printed(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(printed).join(", ")}]`;
  if (value && typeof value === "object") {
    return `{ ${Object.entries(value as Record<string, unknown>).map(([k, v]) => `${k}: ${printed(v)}`).join(", ")} }`;
  }
  return JSON.stringify(value);
}

describe("the registry's words never read as an import to the image build's probe", () => {
  const patterns = probePatterns();

  it("reads the probe's own three patterns out of the Dockerfile", () => {
    expect(patterns).toHaveLength(3);
    // The patterns still do their job: a real import is seen by each of the three.
    expect(captures('import x from "express";', patterns)).toHaveLength(1);
    expect(captures(';import "dotenv/config"', patterns)).toHaveLength(1);
    expect(captures('await import("sharp")', patterns)).toHaveLength(1);
  });

  it("sees the shape that shipped red, so this test would have caught it", () => {
    const shipped = { synonyms: ["import", "profile import", "profile file"] };
    expect(captures(printed(shipped), patterns).length).toBeGreaterThan(0);
    expect(captures(JSON.stringify(shipped), patterns).length).toBeGreaterThan(0);
    expect(captures(JSON.stringify(shipped, null, 2), patterns).length).toBeGreaterThan(0);
  });

  it("finds nothing in any act, however the table is printed", () => {
    const found = [
      ...ADMIN_ACTS.flatMap((a) => captures(printed(a), patterns).map((c) => `${a.id}: ${c}`)),
      ...captures(JSON.stringify(ADMIN_ACTS), patterns),
      ...captures(JSON.stringify(ADMIN_ACTS, null, 2), patterns),
    ];
    expect(found, `These words read as an import to the image build's probe. Reword them (see this file's header):\n${found.join("\n")}`).toEqual([]);
  });
});
