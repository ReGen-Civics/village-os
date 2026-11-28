/**
 * EVERY CALLER OF holdUndo HAS AN UNDO BAR ON ITS PAGE.
 *
 * `holdUndo` waits ten seconds before it sends anything, and the only thing
 * that can stop it is the Undo bar (UndoBar.tsx). The bar was mounted in
 * Admin and nowhere else, so the member's list on the profile, which calls
 * `holdUndo` too, waited its ten seconds with nothing on screen.
 *
 * The callers are FOUND, never listed: every shipped file under client/src
 * that calls `holdUndo(`. Each must be named below with the file that draws
 * the bar for it, and that file must really draw one and really render the
 * caller. So a new caller fails here until somebody says where its bar is.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "../..");

function shipped(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "locales") shipped(p, out);
    } else if (/\.tsx?$/.test(e.name) && !/\.(test|spec)\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const rel = (p: string) => path.relative(SRC, p).replace(/\\/g, "/");
const read = (file: string) => fs.readFileSync(path.join(SRC, file), "utf8");
/** Comments out, so a sentence that mentions the bar is never read as a mount. */
const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");

/** Each caller, and the file that draws the Undo bar on the page it is used on. */
const BAR_FOR: Record<string, string> = {
  // The Submissions tab's two pieces. Admin draws one bar for the whole panel.
  "components/admin/SubmissionDesk.tsx": "pages/Admin.tsx",
  "components/admin/SubmissionHandling.tsx": "pages/Admin.tsx",
  // The member's list, on the profile. The card draws its own.
  "components/yourList/YourListCard.tsx": "components/yourList/YourListCard.tsx",
};

const callers = shipped(SRC)
  .map(rel)
  .filter((file) => file !== "components/admin/adminUndo.ts" && /\bholdUndo\(/.test(code(read(file))));

describe("the Undo bar is drawn wherever holdUndo is used", () => {
  it("finds the callers (a scan that found none would pass everything)", () => {
    expect(callers.length).toBeGreaterThanOrEqual(3);
    expect(callers).toContain("components/yourList/YourListCard.tsx");
  });

  it("every caller is named with the file that draws its bar, and nothing stale is named", () => {
    expect(callers.slice().sort()).toEqual(Object.keys(BAR_FOR).sort());
  });

  it.each(Object.entries(BAR_FOR))("%s has a bar, drawn by %s", (caller, mount) => {
    const source = code(read(mount));
    expect(/<UndoBar[\s/>]/.test(source), `${mount} renders <UndoBar />`).toBe(true);
    if (mount !== caller) {
      // The mount really renders the caller: it imports it and uses its tag.
      const name = path.basename(caller, ".tsx");
      expect(source.includes(`components/admin/${name}"`), `${mount} imports ${name}`).toBe(true);
      expect(new RegExp(`<${name}[\\s/>]`).test(source), `${mount} renders <${name}>`).toBe(true);
    }
  });
});
