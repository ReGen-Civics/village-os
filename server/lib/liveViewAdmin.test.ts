/**
 * THE ADMIN LIVE VIEW'S REFUSED LIST STAYS TRUE (server/lib/liveViewAdmin.ts; the coordinator's ruling).
 *
 * A pattern alone hides what was meant, and a list alone goes stale. So this scans every GET path the server
 * registers for the words an export uses, and fails when one is neither on the refused list nor waived with a written
 * reason. It also fails when a listed path no longer exists, so the list cannot rot quietly the other way.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EXPORT_WORDS, LIVE_VIEW_ADMIN_REFUSED, LIVE_VIEW_ADMIN_WAIVED, refusedForAdminView } from "./liveViewAdmin";

const SERVER = path.join(__dirname, "..");

function serverFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" ? [] : serverFiles(p);
    return e.name.endsWith(".ts") && !e.name.includes(".test.") ? [p] : [];
  });
}

/** Every path registered with `.get(` in the server, as written. */
function getPaths(): Set<string> {
  const out = new Set<string>();
  for (const f of serverFiles(SERVER)) {
    const src = fs.readFileSync(f, "utf8");
    for (const m of src.matchAll(/\.get\(\s*\[?\s*[`"]([^`"]+)[`"]/g)) if (m[1].startsWith("/api/")) out.add(m[1]);
  }
  return out;
}

describe("the admin live view's refused list", () => {
  const paths = getPaths();

  it("names every GET path whose words look like an export, or waives it with a reason", () => {
    const unlisted = [...paths].filter((p) => EXPORT_WORDS.test(p) && !(p in LIVE_VIEW_ADMIN_REFUSED) && !(p in LIVE_VIEW_ADMIN_WAIVED));
    expect(unlisted).toEqual([]);
  });

  it("lists only paths the server still registers", () => {
    expect(Object.keys(LIVE_VIEW_ADMIN_REFUSED).filter((p) => !paths.has(p))).toEqual([]);
    expect(Object.keys(LIVE_VIEW_ADMIN_WAIVED).filter((p) => !paths.has(p))).toEqual([]);
  });

  it("gives every refusal and every waiver a reason in words", () => {
    for (const [p, why] of [...Object.entries(LIVE_VIEW_ADMIN_REFUSED), ...Object.entries(LIVE_VIEW_ADMIN_WAIVED)]) {
      expect([p, why.trim().length > 5]).toEqual([p, true]);
    }
  });

  it("matches a request path to its listed pattern, and nothing else", () => {
    expect(refusedForAdminView("/api/admin/submission-attachments/a-file.pdf")).toBe("/api/admin/submission-attachments/:filename");
    expect(refusedForAdminView("/api/admin/member-tasks/u-1/export")).toBe("/api/admin/member-tasks/:userId/export");
    expect(refusedForAdminView("/api/admin/export/database?x=1")).toBe("/api/admin/export/database");
    expect(refusedForAdminView("/api/admin/agent-accounts")).toBe("/api/admin/agent-accounts");
    expect(refusedForAdminView("/api/admin/agent-accounts/full-access")).toBe("/api/admin/agent-accounts/full-access");
    expect(refusedForAdminView("/api/admin/players")).toBeNull();
    expect(refusedForAdminView("/api/powers/hands")).toBeNull();
    expect(refusedForAdminView("/api/admin/member-tasks/u-1")).toBeNull();
  });
});
