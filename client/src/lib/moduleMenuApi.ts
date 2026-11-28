/**
 * SAVING A MODULE ENTRY'S NAME AND PLACE, by the paths the menu already goes (shared/menuDoc.ts):
 *
 *   1. the content route, `PUT /api/admin/content/app-menu`, for whoever holds `story.tell` (the menu's power, the same
 *      one Admin, Menu saves under), held to the menu's rules by the route's own validator;
 *   2. when the route refuses this person, a `page_content` proposal on app-menu (`POST /api/admin/proposals`), the
 *      same proposal the connector files for any menu change. A person who may decide accepts it at /admin/proposals,
 *      through that same route and validator.
 *
 * No new governance path: the village's highest vote reaches the menu wherever it reaches `story.tell`.
 */
import { authToken, refreshGameConfig } from "@/lib/gameApi";
import { MENU_SECTION, menuDocOf, type MenuDoc } from "@shared/menuDoc";
import { choicesChangeNothing, withChoices, type MenuChoice } from "@shared/moduleMenu";

const headers = (): Record<string, string> => ({ Authorization: `Bearer ${authToken() ?? ""}`, "Content-Type": "application/json" });

const said = (d: unknown, fallback: string): string => {
  const r = (d && typeof d === "object" ? d : {}) as Record<string, unknown>;
  for (const v of [r.message, r.error]) {
    const s = v == null ? "" : String(v).trim();
    if (s && s !== "auth_required") return s;
  }
  return fallback;
};

/** The village's menu document as it stands, or the empty one. */
export async function loadMenuDoc(): Promise<MenuDoc> {
  const res = await fetch(`/api/content/${MENU_SECTION}`, { cache: "no-cache" }).catch(() => null);
  return menuDocOf(res?.ok ? await res.json().catch(() => null) : null);
}

export type MenuSaveOutcome =
  | { ok: true; how: "nothing" | "saved" | "proposed"; message?: string }
  | { ok: false; message: string };

/** Save these choices into the menu document: directly where this person may, else as a proposal. */
export async function saveMenuChoices(choices: readonly MenuChoice[], summary: string): Promise<MenuSaveOutcome> {
  const doc = await loadMenuDoc();
  if (choicesChangeNothing(doc, choices)) return { ok: true, how: "nothing" };
  const next = withChoices(doc, choices);
  const put = await fetch(`/api/admin/content/${MENU_SECTION}`, { method: "PUT", headers: headers(), body: JSON.stringify(next) }).catch(() => null);
  if (put?.ok) {
    void refreshGameConfig(); // the menu reads the new names and places with no reload
    return { ok: true, how: "saved" };
  }
  const refusedBody = await put?.json().catch(() => null);
  // A rule the menu holds (400) is the same answer by any path: say it, and file nothing.
  if (!put || put.status === 400) return { ok: false, message: said(refusedBody, "The menu did not save. Try again in a moment.") };
  const body: Record<string, unknown> = { labels: next.labels, places: next.places ?? {} };
  const filed = await fetch("/api/admin/proposals", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ batch: summary.slice(0, 80), items: [{ kind: "page_content", target: { section: MENU_SECTION }, body, summary }] }),
  }).catch(() => null);
  if (filed?.ok) return { ok: true, how: "proposed" };
  return { ok: false, message: said(refusedBody, "The menu did not save.") };
}
