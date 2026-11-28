/**
 * NO SERVER GATE READS THE LAUNCH LABEL.
 *
 * `launchLabel` folds several facts into one display name and loses
 * information doing it: a village can be issuing AND have a vote open, and the
 * label says only one of those. A gate that decided by the label would refuse
 * or allow on a summary. So the label, the answer type that carries it and the
 * client's `launchDoors` convenience may be imported by exactly one server
 * file, the route that serves them. Every other server file reads a fact by
 * its own reader.
 *
 * This is a scan of import statements, which is the honest size of the claim:
 * it sees a file importing a display binding from `shared/launchFacts`. It
 * does not see a gate that fetches its own village's route and reads `label`
 * out of the JSON, and nothing here pretends to.
 *
 * A scan that finds nothing proves nothing until it is shown to find
 * something, so the detector runs against a planted violation first.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

/** The display-only bindings. A type that carries the label counts: a gate has no use for it. */
const DISPLAY_ONLY = ["launchLabel", "LAUNCH_LABELS", "LaunchLabel", "LaunchFactsAnswer", "launchDoors", "LaunchDoors"];

/** The one server file that serves the label. */
const MAY_IMPORT = new Set(["server/routes/launchFacts.ts"]);

/** Every display-only binding a source file pulls from `shared/launchFacts`, by any import form. */
function displayImports(source: string): string[] {
  const found = new Set<string>();
  const from = String.raw`["'][^"']*shared/launchFacts(?:\.ts|\.js)?["']`;
  // import { a, type B as C } from "...shared/launchFacts", across lines.
  for (const m of source.matchAll(new RegExp(String.raw`import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*${from}`, "g"))) {
    for (const part of m[1].split(",")) {
      const name = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
      if (DISPLAY_ONLY.includes(name)) found.add(name);
    }
  }
  // A namespace import, a require or a dynamic import can reach everything, so each counts as all of it.
  const whole = [
    new RegExp(String.raw`import\s+\*\s+as\s+\w+\s+from\s*${from}`),
    new RegExp(String.raw`require\(\s*${from}\s*\)`),
    new RegExp(String.raw`import\(\s*${from}\s*\)`),
    new RegExp(String.raw`export\s+\*\s+from\s*${from}`),
  ];
  if (whole.some((re) => re.test(source))) found.add("*");
  return [...found].sort();
}

function serverFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") serverFiles(full, out);
    } else if (/\.(ts|tsx|mts)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe("the launch label is display only", () => {
  it("the detector finds a planted import, in each form a file could write", () => {
    expect(displayImports(`import { launchLabel } from "../../shared/launchFacts";`)).toEqual(["launchLabel"]);
    expect(displayImports(`import {\n  type LaunchFacts,\n  type LaunchLabel as L,\n} from "../../shared/launchFacts";`)).toEqual(["LaunchLabel"]);
    expect(displayImports(`import * as lf from "../../shared/launchFacts";`)).toEqual(["*"]);
    expect(displayImports(`const lf = require("../shared/launchFacts");`)).toEqual(["*"]);
    expect(displayImports(`const lf = await import("../../shared/launchFacts.js");`)).toEqual(["*"]);
  });

  it("the detector leaves the facts alone: a gate may import the type it reads", () => {
    expect(displayImports(`import type { LaunchFacts, LaunchVoteRecord } from "../../shared/launchFacts";`)).toEqual([]);
    expect(displayImports(`import { launchLabel } from "../../shared/somethingElse";`)).toEqual([]);
  });

  it("only the route that serves the label imports it, anywhere under server/", () => {
    const offenders: string[] = [];
    let sawTheRoute = false;
    for (const file of serverFiles(path.join(ROOT, "server"))) {
      const rel = path.relative(ROOT, file).split(path.sep).join("/");
      const names = displayImports(fs.readFileSync(file, "utf8"));
      if (names.length === 0) continue;
      if (MAY_IMPORT.has(rel)) {
        sawTheRoute = true;
        continue;
      }
      offenders.push(`${rel} imports ${names.join(", ")}`);
    }
    // If the route stopped importing the label the scan would pass on an empty set, so that is asserted too.
    expect(sawTheRoute, "server/routes/launchFacts.ts should import launchLabel").toBe(true);
    expect(
      offenders,
      "A server file imports the launch label or another display-only binding from shared/launchFacts. " +
        "A gate reads the FACT by its own reader (readGameStart, launchBallotCarried, launchedAtOf); the label is for a status line.",
    ).toEqual([]);
  });
});
