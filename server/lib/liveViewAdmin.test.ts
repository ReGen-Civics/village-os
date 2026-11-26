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
import { EXPORT_WORDS, KEY_READS, LIVE_VIEW_ADMIN_REFUSED, LIVE_VIEW_ADMIN_WAIVED, normalizePath, refusedForAdminView } from "./liveViewAdmin";

const SERVER = path.join(__dirname, "..");

function serverFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" ? [] : serverFiles(p);
    return e.name.endsWith(".ts") && !e.name.includes(".test.") ? [p] : [];
  });
}

/** Comments out, so a word in a comment is not a call. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");

/** Every GET handler under /api/ with its body, up to the next registration in the same file. */
function getHandlers(): Array<{ path: string; body: string }> {
  const out: Array<{ path: string; body: string }> = [];
  for (const f of serverFiles(SERVER)) {
    const src = code(fs.readFileSync(f, "utf8"));
    const starts = [...src.matchAll(/app\.(get|post|put|patch|delete|use|all)\(/g)].map((m) => m.index ?? 0);
    for (const m of src.matchAll(/app\.get\(\s*\[?\s*[`"]([^`"]+)[`"]/g)) {
      if (!m[1].startsWith("/api/")) continue;
      const at = m.index ?? 0;
      const next = starts.find((x) => x > at) ?? src.length;
      out.push({ path: m[1], body: src.slice(at, next) });
    }
  }
  return out;
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

  it("names every GET handler that reads key state, by what it calls, or waives it with a reason", () => {
    const unlisted = getHandlers().filter((h) => KEY_READS.test(h.body) && !(h.path in LIVE_VIEW_ADMIN_REFUSED) && !(h.path in LIVE_VIEW_ADMIN_WAIVED)).map((h) => h.path);
    expect(unlisted).toEqual([]);
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

  it("cannot be stepped round the way the router matches: case, a trailing slash, a sub-path, a percent-encoded letter", () => {
    expect(refusedForAdminView("/API/ADMIN/EXPORT/DATABASE")).toBe("/api/admin/export/database");
    expect(refusedForAdminView("/api/admin/Integrations")).toBe("/api/admin/integrations");
    expect(refusedForAdminView("/api/admin/integrations/")).toBe("/api/admin/integrations");
    expect(refusedForAdminView("/api/admin/integrations/resend")).toBe("/api/admin/integrations");
    expect(refusedForAdminView("/%61pi/admin/export/database")).toBe("/api/admin/export/database");
    expect(refusedForAdminView("/api//admin/export/database")).toBe("/api/admin/export/database");
    expect(refusedForAdminView("/api/admin/comms/settings/domain")).toBe("/api/admin/comms/settings/domain");
    expect(refusedForAdminView("/api/admin/comms/settings/anything-else")).toBe("/api/admin/comms/settings");
    // A segment boundary, never a bare prefix: a sibling path that only starts the same stays open.
    expect(refusedForAdminView("/api/admin/integrations-help")).toBeNull();
    expect(refusedForAdminView("/api/admin/exports-guide")).toBeNull();
    expect(normalizePath("/API/Agent/%7Ex/")).toBe("/api/agent/~x");
    expect(normalizePath("/api/%E0%A4%A")).toBe("/api/%e0%a4%a");
  });
});
