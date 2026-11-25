/**
 * GET /api/admin/search-index: what THIS person can find in Admin search.
 *
 * The entries are data in shared/adminSearch.ts (controls, and steward pages
 * outside /admin), plus every dial by its label. Nothing here acts: the
 * response is words and addresses. The tabs themselves are not in it, because
 * the client already holds them for the menu (adminAreas.ts) and filters them
 * by module the same way the menu does.
 *
 * WHO SEES WHAT. One gate, asked here and nowhere else. Admin is the door
 * (`isAdmin`, which also satisfies the default-deny under /api/admin). An
 * entry that names a capability is kept only when `mayStillSee` says this
 * person holds it, which reads shared/capabilities.ts: an admin is refused a
 * key the village holds, exactly as the route behind the control would refuse
 * them. An entry that names a module is kept only while that module is not off.
 * So the search never offers a control whose page would refuse the person.
 */
import type { Express } from "express";
import type { AppDeps } from "../lib/appDeps";
import type { Capability } from "../../shared/capabilities";
import { CONTROL_ENTRIES, OUTSIDE_ENTRIES, dialEntry, type AdminSearchEntry } from "../../shared/adminSearch";

export interface AdminSearchDeps extends Pick<AppDeps, "isAdmin" | "mayStillSee"> {
  /** Every dial's key, label, description and category (`allVariables()`). Values are never read. */
  dials(): Array<{ key: string; label: string; description?: string; category?: string }>;
  /** A module's effective lifecycle (`effectiveLifecycle`). */
  lifecycle(id: string): string;
}

/** Keep the entries this person may use. Each capability is asked once. */
export async function visibleEntries(
  entries: readonly AdminSearchEntry[],
  may: (cap: Capability) => Promise<boolean>,
  lifecycle: (id: string) => string,
): Promise<AdminSearchEntry[]> {
  const asked = new Map<Capability, boolean>();
  const out: AdminSearchEntry[] = [];
  for (const e of entries) {
    if (e.module && lifecycle(e.module) === "off") continue;
    if (e.capability) {
      if (!asked.has(e.capability)) asked.set(e.capability, await may(e.capability));
      if (!asked.get(e.capability)) continue;
    }
    out.push(e);
  }
  return out;
}

export function register(app: Express, deps: AdminSearchDeps): void {
  app.get("/api/admin/search-index", async (req, res) => {
    if (!(await deps.isAdmin(req))) return res.status(401).json({ error: "Sign in as an admin to search Admin." });
    const entries = await visibleEntries(
      [...CONTROL_ENTRIES, ...OUTSIDE_ENTRIES, ...deps.dials().map(dialEntry)],
      (cap) => deps.mayStillSee(req, cap),
      deps.lifecycle,
    );
    res.set("Cache-Control", "private, no-store");
    res.json({ entries });
  });
}
