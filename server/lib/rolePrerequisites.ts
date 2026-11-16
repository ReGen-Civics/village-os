/**
 * ROLE PREREQUISITES, ASKED AT THE MEMBER DOOR (server/routes/seatApplications.ts)
 * and read for a member by `GET /api/governance/role-prerequisites`
 * (server/routes/rolePrerequisites.ts). The rules are shared/rolePrerequisites.ts.
 *
 * The dial is checked at every write door, so a stored value parses. Should
 * one ever not (a value written before the grammar existed), a role it seems
 * to name is refused rather than opened: a prerequisite fails closed.
 */
import type { Pool } from "mysql2/promise";
import {
  PREREQUISITES_KEY,
  itemWords,
  missingFor,
  missingSentence,
  parsePrerequisites,
  type Prerequisite,
  type PrerequisiteMap,
} from "../../shared/rolePrerequisites";
import { holdingsOf, itemNames } from "../repos/rolePrerequisites";
import { stringVar } from "./variables";

export interface PrerequisiteView {
  roleId: string;
  items: Array<{ kind: Prerequisite["kind"]; id: string; label: string; href: string; done: boolean }>;
}

function idsOf(map: PrerequisiteMap, roleIds: readonly string[]) {
  const items = roleIds.flatMap((r) => [...(map.get(r) ?? [])]);
  return {
    products: Array.from(new Set(items.filter((i) => i.kind === "product").map((i) => i.id))),
    quests: Array.from(new Set(items.filter((i) => i.kind === "quest").map((i) => i.id))),
  };
}

/** Every role that asks for something, with what this member already has. */
export async function prerequisitesFor(pool: Pool, userId: string, onlyRoles?: readonly string[]): Promise<PrerequisiteView[]> {
  const parsed = parsePrerequisites(stringVar(PREREQUISITES_KEY));
  if (!parsed.ok) return [];
  const roleIds = (onlyRoles ?? Array.from(parsed.map.keys())).filter((r) => parsed.map.has(r));
  if (roleIds.length === 0) return [];
  const ids = idsOf(parsed.map, roleIds);
  const [holdings, names] = await Promise.all([holdingsOf(pool, userId, ids.products, ids.quests), itemNames(pool, ids.products, ids.quests)]);
  return roleIds.map((roleId) => ({
    roleId,
    items: (parsed.map.get(roleId) ?? []).map((i) => {
      const words = itemWords(i, (i.kind === "product" ? names.products : names.quests).get(i.id) ?? null);
      const done = i.kind === "product" ? holdings.paidProducts.has(i.id) : holdings.consentedQuests.has(i.id);
      return { kind: i.kind, id: i.id, label: words.label, href: words.href, done };
    }),
  }));
}

/**
 * The member door's refusal body, or null when every role this application
 * names has what it asks for.
 */
export async function prerequisiteRefusal(
  pool: Pool,
  userId: string,
  roleIds: readonly string[],
  roleName: (id: string) => string,
): Promise<Record<string, unknown> | null> {
  const raw = stringVar(PREREQUISITES_KEY);
  if (!raw.trim()) return null;
  const parsed = parsePrerequisites(raw);
  if (!parsed.ok) {
    const named = roleIds.filter((r) => raw.includes(r));
    if (named.length === 0) return null;
    return {
      error: `${named.map(roleName).join(", ")} asks for something before you apply, and the village's list of what each role asks for cannot be read. Ask whoever keeps the village's dials to fix it.`,
      code: "prerequisites_unreadable",
    };
  }
  const ids = idsOf(parsed.map, roleIds);
  if (ids.products.length === 0 && ids.quests.length === 0) return null;
  const holdings = await holdingsOf(pool, userId, ids.products, ids.quests);
  const missing = missingFor(roleIds, parsed.map, holdings);
  if (missing.length === 0) return null;
  const names = await itemNames(pool, ids.products, ids.quests);
  const rows = missing.map((m) => ({
    roleId: m.roleId,
    roleName: roleName(m.roleId),
    items: m.items.map((i) => ({ kind: i.kind, id: i.id, ...itemWords(i, (i.kind === "product" ? names.products : names.quests).get(i.id) ?? null) })),
  }));
  return {
    error: missingSentence(rows.map((r) => ({ roleName: r.roleName, labels: r.items.map((i) => i.label) }))),
    code: "prerequisites_missing",
    missing: rows,
  };
}
