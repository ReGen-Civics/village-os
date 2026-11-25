/**
 * CONFLICTS BETWEEN WAITING CHANGES (the lead, 17 Nov 2026, with 21 changes waiting: "see if any of them conflict,
 * so that if I'm accepting later ones they're not conflicting with earlier ones (and that my list is always oldest
 * to newest to make sure this can never happen)").
 *
 * Pure: no database, no Express, no React. The server serves `staleAgainst` beside each waiting change and runs it
 * again at accept; the review page (/admin/proposals) runs `waitingConflicts` over what it shows, edits included.
 *
 *   footprintOf      what one change writes: a document (the route's path, or the list it edits), and either the
 *                    whole document or a set of dotted fields in it.
 *   overlaps         two footprints write the same thing: the same document, and either side writes it whole or a
 *                    field of one is a field of the other or sits inside it.
 *   waitingConflicts every pair of waiting changes that overlap, named on both, each side told which was proposed
 *                    later.
 *   staleAgainst     the accepted changes, accepted AFTER this one was proposed, that wrote what it writes: it was
 *                    drafted against an older live value and would overwrite a newer one.
 *   oldestFirst      the order the waiting list reads in: proposed time, then the batch's own order, then id.
 *
 * THE RULES, by kind:
 *   page_content, module_config   the body is merged onto what is live, object by object (`mergeOnto`), so each
 *                                 leaf is a field. A list is one leaf: the merge replaces a list whole.
 *   role_card                     words.<key>, parameters.<key>, pay, archetypes and circleId are fields; the
 *                                 founding sections merge deep, so their leaves are fields.
 *   variable, season_goals (one season), onboarding_path, module_lifecycle, role_listing
 *                                 always the whole target.
 *   faq_edit, faq_remove          the FAQ by its id on its pathway's list. faq_add writes a new entry and
 *                                 overlaps nothing.
 *   setting                       a PUT saves the whole document, so it overlaps anything on the same path. A
 *                                 gathering's PUT, a PATCH and a POST write only the keys they name, at the top
 *                                 level. A new gathering overlaps nothing. A DELETE takes the whole thing.
 *
 * A flag informs. Nothing here blocks an accept or rejects a change: the person decides.
 */
import { faceOf, type RouteRef } from "./proposalReview";
import type { ProposalKind } from "./proposedChanges";

export interface Footprint {
  /** What is written: a route's path, or the list a change edits one entry of. */
  doc: string;
  /** The whole document is written. */
  whole: boolean;
  /** The dotted fields written, when not whole. */
  fields: string[];
}

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

/** Leaves as the deep merge reads them: plain objects are walked, a list or a value is one leaf. */
function mergeLeaves(value: unknown, prefix: string, out: string[]): string[] {
  const o = obj(value);
  if (!o || !Object.keys(o).length) {
    if (prefix) out.push(prefix);
    return out;
  }
  for (const [k, v] of Object.entries(o)) mergeLeaves(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
}

/** The route that writes one translated field of the village's own words (server/routes/contentTranslations.ts). */
export const CONTENT_TRANSLATIONS_ROUTE = "/api/admin/content-translations";

const whole = (doc: string): Footprint => ({ doc, whole: true, fields: [] });
const fields = (doc: string, list: string[]): Footprint => ({ doc, whole: false, fields: Array.from(new Set(list)) });

/** What one change writes, or null when it writes only something new (a new FAQ, a new gathering). */
export function footprintOf(kind: ProposalKind, target: Record<string, unknown>, route: RouteRef, body: Record<string, unknown>): Footprint | null {
  const path = String(route.path ?? "");
  const b = obj(body) ?? {};
  switch (kind) {
    case "page_content":
    case "module_config":
      return fields(path, mergeLeaves(b, "", []));
    case "role_card": {
      const out: string[] = [];
      for (const [k, v] of Object.entries(b)) {
        if (k === "words" || k === "parameters") {
          const o = obj(v);
          if (o && Object.keys(o).length) for (const f of Object.keys(o)) out.push(`${k}.${f}`);
          else out.push(k);
        } else if (k === "sections") mergeLeaves(v, "sections", out);
        else out.push(k);
      }
      return fields(path, out);
    }
    case "seat_terms": {
      // One role's wordings: each wording is one field of that role's terms on offer.
      const words = obj(b.words) ?? {};
      const doc = `seat-terms:${String(target.roleId ?? "")}`;
      return fields(doc, Object.keys(words).length ? Object.keys(words).map((k) => `words.${k}`) : ["words"]);
    }
    case "faq_add":
    // Agenda items are each made new, so they never write over anything.
    case "session_agenda":
      return null;
    case "faq_edit":
    case "faq_remove":
      return fields(`/api/admin/faqs/${encodeURIComponent(String(target.pathway ?? ""))}`, [`faq.${String(target.id ?? "")}`]);
    case "season_goals":
      // The season list is one document; a season's goals are one field of it.
      return fields(path, [`seasons.${String(target.seasonId ?? "")}`]);
    case "variable":
    case "module_lifecycle":
    case "onboarding_path":
    case "role_listing":
      return whole(path);
    case "setting": {
      const method = String(route.method ?? "").toUpperCase();
      // One translated field per write (PUT /api/admin/content-translations): its document is the page or card in one
      // language, and the field is the only thing it writes, so two translations of different fields never overlap.
      if (path === CONTENT_TRANSLATIONS_ROUTE && (method === "PUT" || method === "DELETE")) {
        const doc = `content-translations:${String(b.kind ?? "")}:${String(b.ref ?? "")}:${String(b.locale ?? "")}`;
        return fields(doc, [String(b.field ?? "")]);
      }
      const calendar = faceOf(kind, route) === "calendar_event";
      if (method === "DELETE") return whole(path);
      if (method === "PUT" && !calendar) return whole(path);
      if (method === "POST" && calendar) return null;
      return fields(path, Object.keys(b));
    }
  }
}

const inside = (a: string, b: string) => a === b || a.startsWith(`${b}.`) || b.startsWith(`${a}.`);

/** Whether two changes write the same thing. */
export function overlaps(a: Footprint | null, b: Footprint | null): boolean {
  if (!a || !b || a.doc !== b.doc) return false;
  if (a.whole || b.whole) return true;
  return a.fields.some((x) => b.fields.some((y) => inside(x, y)));
}

// ── The order ───────────────────────────────────────────────────────────────

export interface Ordered {
  id: string;
  at: string;
  position?: number;
}

/** Oldest first: proposed time, then the batch's own order, then id, so the list never reorders between loads. */
export function oldestFirst(a: Ordered, b: Ordered): number {
  return a.at.localeCompare(b.at) || (a.position ?? 0) - (b.position ?? 0) || a.id.localeCompare(b.id);
}

// ── Waiting against waiting ─────────────────────────────────────────────────

export interface ConflictInput extends Ordered {
  kind: ProposalKind;
  target: Record<string, unknown>;
  route: RouteRef;
  /** What would be accepted: the person's edits when there are any. */
  body: Record<string, unknown>;
  summary: string;
}

export interface ConflictWith {
  id: string;
  summary: string;
  at: string;
  /** The other change was proposed after this one. */
  later: boolean;
}

/** For each waiting change, the other waiting changes that write what it writes, oldest first. */
export function waitingConflicts(changes: readonly ConflictInput[]): Record<string, ConflictWith[]> {
  const list = [...changes].sort(oldestFirst);
  const prints = list.map((c) => footprintOf(c.kind, c.target, c.route, c.body));
  const out: Record<string, ConflictWith[]> = {};
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (!overlaps(prints[i], prints[j])) continue;
      const a = list[i];
      const b = list[j];
      (out[a.id] ??= []).push({ id: b.id, summary: b.summary, at: b.at, later: true });
      (out[b.id] ??= []).push({ id: a.id, summary: a.summary, at: a.at, later: false });
    }
  }
  return out;
}

// ── Waiting against what was accepted since ─────────────────────────────────

export interface AcceptedRecord {
  id: string;
  kind: ProposalKind;
  target: Record<string, unknown>;
  route: RouteRef;
  /** What went live: the accepted body (the person's edits included). */
  body: Record<string, unknown>;
  summary: string;
  /** When it was accepted. */
  decidedAt: string;
}

export interface StaleBy {
  id: string;
  summary: string;
  acceptedAt: string;
}

/**
 * The accepted changes that make this one stale: accepted after it was proposed, writing what it writes. Oldest
 * accept first. Empty when nothing has moved under it.
 */
export function staleAgainst(change: Pick<ConflictInput, "id" | "at" | "kind" | "target" | "route" | "body">, accepted: readonly AcceptedRecord[]): StaleBy[] {
  const mine = footprintOf(change.kind, change.target, change.route, change.body);
  if (!mine) return [];
  return accepted
    .filter((a) => a.id !== change.id && a.decidedAt > change.at && overlaps(mine, footprintOf(a.kind, a.target, a.route, a.body)))
    .sort((x, y) => x.decidedAt.localeCompare(y.decidedAt) || x.id.localeCompare(y.id))
    .map((a) => ({ id: a.id, summary: a.summary, acceptedAt: a.decidedAt }));
}

/** How many conflicts wait: pairs of waiting changes that collide, and waiting changes drafted before a later accept. */
export function conflictCounts(conflicts: Record<string, ConflictWith[]>, stale: Record<string, readonly StaleBy[] | undefined>): { pairs: number; stale: number } {
  let pairs = 0;
  for (const list of Object.values(conflicts)) pairs += list.filter((c) => c.later).length;
  const staleN = Object.values(stale).filter((s) => !!s && s.length > 0).length;
  return { pairs, stale: staleN };
}

// ── Deciding them (the lead, 25 Nov 2026: conflicts block, stale changes are seen first) ─────────────────────

/**
 * The version of "what is live now" a person saw before accepting a stale change: the accepts it is stale against.
 * The server reads them again at accept and refuses an accept that carries any other version, so a person never
 * accepts over an accept they were not shown. Empty when nothing moved under the change.
 */
export function staleVersionOf(stale: readonly Pick<StaleBy, "id">[]): string {
  return stale.map((s) => s.id).sort().join(",");
}

/**
 * Waiting changes that collide, gathered into one card each: every change linked to another by a shared write lands
 * in the same group, oldest first, groups in the order of their oldest change. A change that collides with nothing
 * is in no group. Accepting one option names the changes it collides with directly, and only those are set aside.
 */
export function conflictGroups(changes: readonly ConflictInput[]): string[][] {
  const links = waitingConflicts(changes);
  const order = [...changes].sort(oldestFirst).map((c) => c.id);
  const seen = new Set<string>();
  const groups: string[][] = [];
  for (const start of order) {
    if (seen.has(start) || !links[start]?.length) continue;
    const group = new Set<string>([start]);
    const queue = [start];
    while (queue.length) {
      const id = queue.shift()!;
      for (const o of links[id] ?? []) if (!group.has(o.id)) (group.add(o.id), queue.push(o.id));
    }
    group.forEach((id) => seen.add(id));
    groups.push(order.filter((id) => group.has(id)));
  }
  return groups;
}
