/**
 * ROLE PREREQUISITES: what a role asks for before anyone may apply to hold it.
 *
 * Kept as one game variable, `roles.prerequisites`, so every member sees it,
 * anyone may propose a change, and it moves by a holder of `dial.set` or a
 * village vote like every other dial (Rye, 2026-09-25 and 2026-11-06). Blank,
 * the platform default, asks nothing of anybody.
 *
 * THE GRAMMAR, one entry per role, joined by `;`:
 *
 *   <roleId> = <item>[, <item>]
 *   item:      product:<productId>   a paid purchase of that product
 *              quest:<questId>       a consented claim on that quest
 *
 * A purchase counts while it is `paid`; a reversed one does not. A quest counts
 * once it is consented. The member door (server/routes/seatApplications.ts)
 * asks `missingFor` and refuses with each missing item in plain words.
 *
 * Pure: no pool, no clock.
 */

export const PREREQUISITES_KEY = "roles.prerequisites";

export const PREREQUISITE_KINDS = ["product", "quest"] as const;
export type PrerequisiteKind = (typeof PREREQUISITE_KINDS)[number];

export interface Prerequisite {
  kind: PrerequisiteKind;
  id: string;
}

export type PrerequisiteMap = ReadonlyMap<string, readonly Prerequisite[]>;

const ID = /^[A-Za-z0-9._-]{1,64}$/;

/** At most this many items on one role: a role that asks for more is a quest chain. */
export const ITEMS_PER_ROLE_MAX = 5;

/** Read the dial. A malformed value is refused whole, with the reason, so a typo never silently opens a role. */
export function parsePrerequisites(raw: unknown): { ok: true; map: PrerequisiteMap } | { ok: false; error: string } {
  const text = typeof raw === "string" ? raw.trim() : "";
  const map = new Map<string, Prerequisite[]>();
  if (!text) return { ok: true, map };
  for (const entry of text.split(";").map((e) => e.trim()).filter(Boolean)) {
    const eq = entry.indexOf("=");
    if (eq < 0) return { ok: false, error: `Each role needs an equals sign, as in "steward-role = product:prod-1". This part has none: "${entry}".` };
    const roleId = entry.slice(0, eq).trim();
    if (!ID.test(roleId)) return { ok: false, error: `"${roleId}" is not a role id. Ids use letters, numbers, dots, dashes and underscores.` };
    if (map.has(roleId)) return { ok: false, error: `The role "${roleId}" is listed twice. Put all its items in one entry.` };
    const items: Prerequisite[] = [];
    for (const part of entry.slice(eq + 1).split(",").map((p) => p.trim()).filter(Boolean)) {
      const colon = part.indexOf(":");
      const kind = colon < 0 ? "" : part.slice(0, colon).trim();
      const id = colon < 0 ? "" : part.slice(colon + 1).trim();
      if (!(PREREQUISITE_KINDS as readonly string[]).includes(kind)) {
        return { ok: false, error: `"${part}" should start with product: or quest:.` };
      }
      if (!ID.test(id)) return { ok: false, error: `"${id}" is not an id. Ids use letters, numbers, dots, dashes and underscores.` };
      if (!items.some((i) => i.kind === kind && i.id === id)) items.push({ kind: kind as PrerequisiteKind, id });
    }
    if (items.length === 0) return { ok: false, error: `The role "${roleId}" asks for nothing. Name a product or a quest, or leave the role out.` };
    if (items.length > ITEMS_PER_ROLE_MAX) return { ok: false, error: `The role "${roleId}" asks for ${items.length} things. Keep it to ${ITEMS_PER_ROLE_MAX}.` };
    map.set(roleId, items);
  }
  return { ok: true, map };
}

/** The refusal sentence for a malformed value, or null. `validateVariable` asks it. */
export function prerequisitesProblem(raw: string): string | null {
  const parsed = parsePrerequisites(raw);
  return parsed.ok ? null : parsed.error;
}

/** Write the dial back from a map, in the grammar above. The admin editor saves through this. */
export function printPrerequisites(map: PrerequisiteMap): string {
  return Array.from(map.entries())
    .filter(([, items]) => items.length > 0)
    .map(([roleId, items]) => `${roleId} = ${items.map((i) => `${i.kind}:${i.id}`).join(", ")}`)
    .join("; ");
}

/** What a member has: the products they paid for and the quests consented to them. */
export interface PrerequisiteHoldings {
  paidProducts: ReadonlySet<string>;
  consentedQuests: ReadonlySet<string>;
}

export function has(item: Prerequisite, holdings: PrerequisiteHoldings): boolean {
  return item.kind === "product" ? holdings.paidProducts.has(item.id) : holdings.consentedQuests.has(item.id);
}

/** Each item the roles ask for that this member does not have yet, role by role. */
export function missingFor(roleIds: readonly string[], map: PrerequisiteMap, holdings: PrerequisiteHoldings): Array<{ roleId: string; items: Prerequisite[] }> {
  const out: Array<{ roleId: string; items: Prerequisite[] }> = [];
  for (const roleId of roleIds) {
    const missing = (map.get(roleId) ?? []).filter((i) => !has(i, holdings));
    if (missing.length) out.push({ roleId, items: missing });
  }
  return out;
}

/** An item in a member's words, with where to get it. Names come from the village's own products and quests. */
export function itemWords(item: Prerequisite, name: string | null): { label: string; href: string } {
  // Products are sold on the Contribute page (client/src/pages/Contribute.tsx), one list for every product.
  if (item.kind === "product") return { label: name ? `Pay for ${name}` : "Pay for the product this role asks for", href: "/contribute" };
  return { label: name ? `Complete the quest ${name}` : "Complete the quest this role asks for", href: `/quests/${encodeURIComponent(item.id)}` };
}

/** The member door's refusal, naming every missing item in plain words. */
export function missingSentence(rows: ReadonlyArray<{ roleName: string; labels: readonly string[] }>): string {
  return rows
    .map((r) => `${r.roleName} asks for ${r.labels.length === 1 ? "one thing" : `${r.labels.length} things`} before you apply: ${r.labels.join("; ")}.`)
    .join(" ");
}
