/**
 * PROPOSED CHANGES: the server half (shared/proposedChanges.ts is the pure half).
 *
 * For each kind, three things, each reaching only what the target's own editor
 * reaches:
 *
 *   check   at proposal time and again in the dry run before accepting: the
 *           never rules, and the SAME validators the target route runs
 *           (`parseRoleWords`, `readParameter`, `readPayGroup`,
 *           `characterTagsFrom` and `readSections` for a role card, as
 *           `saveRoleEdit` does; `pageContentProblem`; `validateVariable`;
 *           `readVillageDoc`). A broken proposal is refused with its field.
 *   live    what is live now, in the proposal's own shape, so the page shows
 *           it beside the proposed text.
 *   apply   the change, through the target's own route, run by `run`: the
 *           loopback as the person accepting (server/routes/proposedChanges.ts).
 *           Nothing here writes a setting itself. A route that keeps a list or
 *           a document whole (FAQs, a season's goals, a module's settings, a
 *           page) is read through the platform's own record and written back
 *           whole, the way the app's own editor saves it.
 *
 * The `setting` kind is every other admin write route: checked against the
 * never rules and against the routes this server actually registered, and run
 * through that route as it stands. Its own validator runs when it is accepted,
 * and the dry run says so.
 */
import type { Pool } from "mysql2/promise";
import {
  fieldLabel,
  keptGoalIds,
  mergeOnto,
  neverProposed,
  proposalNever,
  REVIEW_WORDS,
  routeOf,
  settingBodyToApply,
  variableNever,
  type ProposalInput,
  type ProposalKind,
} from "../../shared/proposedChanges";
import { validateVariable, VARIABLES_BY_KEY } from "../../shared/gameVariables";
import { MODULES_BY_ID } from "../../shared/modules";
import { isLifecycle } from "../../shared/moduleSwitch";
import { pageContentProblem, pageSpecForSection } from "../../shared/pageContent";
import { readVillageDoc } from "../../shared/onboardingPath";
import { parseRoleWords } from "../../shared/roleProposals";
import { PARAMETER_KEYS, readParameter, readPayGroup, type ParameterKey } from "../../shared/roleParameters";
import { readSections } from "../../shared/roleCardSections";
import { isListed } from "../../shared/roleListing";
import { allVariables } from "./variables";
import { moduleConfig, storedLifecycle } from "./modules";
import { characterTagsFrom, listOrgRoles, type OrgRole } from "./orgChart";
import { ROLE_WORD_FIELDS } from "./roleProposals";
import { editorState, labelOf } from "./roleEdit";
import { listArchetypeRows } from "../repos/archetypes";
import { villageCircles } from "../repos/roleProposals";
import { villageId } from "./economy";
import { readConfigDocument } from "../repos/appConfigDocs";
import { VILLAGE_DOC_KEY } from "./onboarding";
import { neverPutBack } from "../../shared/proposalPutBack";
import { agendaItemBody, readProposedAgenda } from "../../shared/sessionAgendaProposal";
import { circleWords } from "../../shared/sessionTasks";
import { circleRhythmRows } from "../repos/sessionRhythm";

export const FAQ_PATHWAYS_FOR_PROPOSALS = ["investor", "steward", "resident", "prosperity"] as const;

export interface KindDeps {
  pool: Pool;
  /** Every content section as stored (contentRepo). */
  content: () => Record<string, unknown>;
  /** Every FAQ list, by pathway (faqsRepo). */
  faqs: () => Record<string, Array<{ id: string; question: string; answer: string }>>;
  /** The seasons as the village reads them, goals included. */
  seasons: () => Array<{ id: string; name?: string; goals?: Array<{ id?: string; text: string; done?: boolean }> }>;
  /** Whether this server registered a route for `method path`. */
  routeExists: (method: string, path: string) => boolean;
}

/** A call through a route as the person, answering its status and JSON. */
export type Run = (method: "GET" | "PUT" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown) => Promise<{ status: number; body: unknown }>;

export type Checked = { ok: true; label: string; method: string; path: string } | { ok: false; error: string; field?: string; code?: string };

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const bad = (error: string, field?: string, code?: string): Checked => ({ ok: false, error, ...(field ? { field } : {}), ...(code ? { code } : {}) });
const pick = (from: Record<string, unknown> | null | undefined, keys: string[]) => Object.fromEntries(keys.map((k) => [k, from?.[k] ?? null]));
const ROLE_CARD_KEYS = ["words", "parameters", "pay", "archetypes", "sections", "circleId"];

async function roleOf(pool: Pool, id: string): Promise<{ role: OrgRole | null; roles: OrgRole[] }> {
  const roles = await listOrgRoles(pool);
  return { role: roles.find((r) => r.id === id) ?? null, roles };
}

/** Whether this proposal may be filed, and what it reaches, in words. */
export async function checkProposal(deps: KindDeps, p: ProposalInput): Promise<Checked> {
  const never = proposalNever(p);
  if (never) return bad(never.words, undefined, `never_${never.key}`);
  const route = routeOf(p.kind, p.target);
  const ok = (label: string): Checked => ({ ok: true, label: label.slice(0, 200), method: route.method, path: route.path });
  const t = p.target;
  const b = p.body;
  switch (p.kind) {
    case "role_card": {
      const id = String(t.roleId ?? "");
      const { role, roles } = await roleOf(deps.pool, id);
      if (!role) return bad("There is no role by that id.", "target.roleId");
      if (role.isExample) return bad("A standing example is never changed.", "target.roleId");
      const extra = Object.keys(b).filter((k) => !ROLE_CARD_KEYS.includes(k));
      if (extra.length) return bad(`A role card change carries words, parameters, pay, archetypes, sections or circleId. Not: ${extra.slice(0, 6).join(", ")}.`, extra[0]);
      if (!Object.keys(b).length) return bad("Say what to change on the card.");
      if (b.words !== undefined) {
        const read = parseRoleWords(b.words, "words", ROLE_WORD_FIELDS, role as unknown as Record<string, unknown>);
        if (!read.ok) return bad(read.error, read.field);
      }
      if (b.parameters !== undefined) {
        const params = obj(b.parameters);
        if (!params) return bad("A role's details arrive as a set of fields.", "parameters");
        const roleIds = new Set(roles.filter((r) => !r.isExample).map((r) => r.id));
        for (const [k, v] of Object.entries(params)) {
          if (!(PARAMETER_KEYS as readonly string[]).includes(k)) return bad("That is not a detail a role card holds.", `parameters.${k}`);
          const r = readParameter(k as ParameterKey, v, (rid) => roleIds.has(rid));
          if (!r.ok) return bad(r.problem, `parameters.${k}`);
        }
      }
      // The circle the role moves to (Rye, 16 Nov 2026): a circle this village has.
      if (b.circleId !== undefined) {
        const to = typeof b.circleId === "string" ? b.circleId.trim() : "";
        if (!to || !(await villageCircles(deps.pool)).some((c) => c.id === to)) return bad("There is no circle by that id.", "circleId");
      }
      if (b.pay !== undefined) {
        const r = readPayGroup(b.pay);
        if (!r.ok) return bad(r.problem, "pay");
      }
      if (b.archetypes !== undefined) {
        const cast = (await listArchetypeRows(deps.pool, villageId())).map((a) => a.key);
        const r = characterTagsFrom(b.archetypes, cast);
        if (!r.ok) return bad(r.error, "archetypes");
      }
      if (b.sections !== undefined) {
        const live = (await editorState(deps.pool, role)).sections;
        const r = readSections(mergeOnto(live, b.sections));
        if (!r.ok) return bad(r.problem, r.field);
      }
      return ok(`${role.name} card`);
    }
    case "page_content": {
      const section = String(t.section ?? "");
      const live = deps.content()[section];
      const spec = pageSpecForSection(section);
      if (!spec && live === undefined) return bad("There is no page section by that name.", "target.section");
      const problem = pageContentProblem(section, mergeOnto(live ?? {}, b));
      if (problem) return bad(problem, "body");
      return ok(spec ? `${spec.label} page` : `${section} words`);
    }
    case "faq_add":
    case "faq_edit":
    case "faq_remove": {
      const pathway = String(t.pathway ?? "");
      if (!(FAQ_PATHWAYS_FOR_PROPOSALS as readonly string[]).includes(pathway)) return bad(`pathway is one of ${FAQ_PATHWAYS_FOR_PROPOSALS.join(", ")}.`, "target.pathway");
      const list = deps.faqs()[pathway] ?? [];
      const item = p.kind === "faq_add" ? null : list.find((f) => f.id === String(t.id ?? ""));
      if (p.kind !== "faq_add" && !item) return bad("There is no FAQ by that id on this pathway.", "target.id");
      if (p.kind !== "faq_remove") {
        if (typeof b.question !== "string" || !b.question.trim()) return bad("An FAQ needs its question.", "question");
        if (b.answer !== undefined && typeof b.answer !== "string") return bad("The answer is text.", "answer");
      }
      const label = `${pathway.charAt(0).toUpperCase()}${pathway.slice(1)} FAQ`;
      return ok(item ? `${label}: ${item.question}` : label);
    }
    case "variable": {
      const key = String(t.key ?? "");
      const def = VARIABLES_BY_KEY[key];
      if (!def) return bad("There is no village variable by that key.", "target.key");
      const nv = variableNever(def);
      if (nv) return bad(nv.words, undefined, `never_${nv.key}`);
      if (b.value === undefined || b.value === null || typeof b.value === "object") return bad("A variable's proposal carries value.", "value");
      const err = validateVariable(def, String(b.value));
      if (err) return bad(err, "value");
      return ok(def.label);
    }
    case "module_lifecycle":
    case "module_config": {
      const def = MODULES_BY_ID[String(t.id ?? "")];
      if (!def) return bad("There is no module by that id.", "target.id");
      if (p.kind === "module_lifecycle") {
        if (def.core) return bad("This module is always on.", "target.id");
        if (!isLifecycle(b.lifecycle)) return bad("lifecycle is off, preview, members or public.", "lifecycle");
        return ok(`${def.name} module`);
      }
      return ok(`${def.name} settings`);
    }
    case "role_listing": {
      const ids = Array.isArray(b.ids) ? b.ids.filter((x): x is string => typeof x === "string" && !!x.trim()) : [];
      if (!ids.length) return bad("Name at least one role to list. Listing none would empty every list.", "ids");
      const known = new Set((await listOrgRoles(deps.pool)).filter((r) => !r.isExample).map((r) => r.id));
      const unknown = ids.filter((id) => !known.has(id));
      if (unknown.length) return bad(`Those roles are not here: ${unknown.slice(0, 5).join(", ")}`, "ids");
      return ok("Which roles are listed");
    }
    case "season_goals": {
      const season = deps.seasons().find((s) => s.id === String(t.seasonId ?? ""));
      if (!season) return bad("There is no season by that id.", "target.seasonId");
      if (!Array.isArray(b.goals)) return bad("A season's goals arrive as a list.", "goals");
      if (b.goals.length > 20) return bad("A season holds twenty goals at most.", "goals");
      for (let i = 0; i < b.goals.length; i++) {
        const g = obj(b.goals[i]);
        const text = typeof g?.text === "string" ? g.text.trim() : "";
        if (!text) return bad(`Goal ${i + 1} needs its words.`, `goals.${i}.text`);
        if (text.length > 200) return bad(`Goal ${i + 1} is longer than 200 characters.`, `goals.${i}.text`);
        if (g && g.id !== undefined && typeof g.id !== "string") return bad(`Goal ${i + 1}'s id is the id of a goal held now, as text.`, `goals.${i}.id`);
      }
      return ok(`${season.name ?? "Season"} goals`);
    }
    case "onboarding_path": {
      const live = (await readConfigDocument(deps.pool, VILLAGE_DOC_KEY)) ?? {};
      const r = readVillageDoc(mergeOnto(live, obj(b.doc) ?? {}));
      if (!obj(b.doc)) return bad("The onboarding path arrives as {doc}.", "doc");
      if (!r.ok) return bad(r.error, "doc");
      return ok("Onboarding path");
    }
    case "session_agenda": {
      const read = readProposedAgenda(t, b);
      if (!read.ok) return bad(read.error, read.field);
      const where = await agendaMeeting(deps.pool, read.value.circleId, read.value.rhythmKey);
      if (!where.ok) return bad(where.error, where.field);
      const n = read.value.items.length;
      return ok(`${n === 1 ? "1 agenda item" : `${n} agenda items`} for ${where.label}`);
    }
    case "setting": {
      if (!deps.routeExists(route.method, route.path)) return bad(REVIEW_WORDS.noRoute, "target.path");
      if (typeof t.readPath === "string") {
        const readNever = neverProposed("GET", t.readPath, {});
        if (readNever) return bad(readNever.words, "target.readPath", `never_${readNever.key}`);
        if (!deps.routeExists("GET", t.readPath)) return bad(REVIEW_WORDS.noRoute, "target.readPath");
      }
      return ok(route.path);
    }
  }
}

/**
 * Where a proposed agenda lands, in words: "the Anchor circle's Thursday steward sync" for one of its meetings, or
 * "the Anchor circle's open agenda" for its open items, which wait for whichever meeting the circle holds next and
 * need no rhythm. A circle that is not a live one, or a rhythm it does not keep, is refused with its field.
 */
async function agendaMeeting(pool: Pool, circleId: string, rhythmKey: string | null): Promise<{ ok: true; label: string } | { ok: false; error: string; field: string }> {
  const circle = (await villageCircles(pool)).find((c) => c.id === circleId && c.live);
  if (!circle) return { ok: false, error: "That circle is not one of the village's live circles.", field: "target.circleId" };
  const whose = `the ${circleWords(circle.name)}'s`;
  // No meeting named: the circle's open agenda items, which need no rhythm at all (the lead, 17 Nov 2026).
  if (!rhythmKey) return { ok: true, label: `${whose} open agenda` };
  const rhythm = (await circleRhythmRows(pool, circleId)).find((r) => String(r.rhythm_key) === rhythmKey);
  if (!rhythm) return { ok: false, error: "That circle keeps no meeting rhythm with that key. Read its rhythms with GET /api/sessions.", field: "target.rhythmKey" };
  return { ok: true, label: `${whose} ${String(rhythm.name ?? "") || "meeting"}` };
}

/** Plain labels for fields a kind knows by name. Every other field reads from its key (`fieldLabel`). */
export function labelsFor(kind: ProposalKind, target: Record<string, unknown>, body: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  if (kind === "role_card") {
    for (const k of Object.keys(obj(body.words) ?? {})) out[`words.${k}`] = labelOf(k);
    for (const k of Object.keys(obj(body.parameters) ?? {})) out[`parameters.${k}`] = labelOf(k);
    if ("pay" in body) out.pay = "Pay on offer";
    if ("archetypes" in body) out.archetypes = "Characters it suits";
    if ("circleId" in body) out.circleId = "Circle";
  }
  if (kind === "page_content") {
    const spec = pageSpecForSection(String(target.section ?? ""));
    for (const s of spec?.sections ?? []) {
      out[s.id] = s.label;
      for (const f of s.fields) out[`${s.id}.${f.key}`] = f.label;
      for (const l of s.lists ?? []) out[`${s.id}.${l.key}`] = l.label;
    }
  }
  if (kind === "variable") out.value = VARIABLES_BY_KEY[String(target.key ?? "")]?.label ?? fieldLabel("value");
  return out;
}

/** Where a change lands: the page a visitor or member reads it on, and its address, for "See it live". */
export interface Where {
  label: string;
  href: string | null;
}

const SETTING_PAGES: ReadonlyArray<[RegExp, (m: RegExpMatchArray) => Where]> = [
  [/^\/api\/admin\/investor-summary$/, () => ({ label: "Investor page", href: "/investor" })],
  [/^\/api\/admin\/events(?:\/[^/]+)?$/, () => ({ label: "Calendar", href: "/events" })],
  [/^\/api\/admin\/brand(?:\/.*)?$/, () => ({ label: "Home page", href: "/" })],
  [/^\/api\/admin\/visit-config$/, () => ({ label: "Visit page", href: "/visit" })],
  [/^\/api\/admin\/work-with-us-config$/, () => ({ label: "Work with us page", href: "/work-with-us" })],
  [/^\/api\/admin\/seasons$/, () => ({ label: "Season", href: "/admin?tab=season" })],
  [/^\/api\/admin\/land$/, () => ({ label: "Map", href: "/map" })],
  [/^\/api\/org\/role-edit\/([^/]+)$/, (m) => ({ label: "Roles page", href: `/roles?seat=${m[1]}` })],
  [/^\/api\/org\/circles\/([^/]+)$/, (m) => ({ label: "Circles page", href: `/circles/${m[1]}` })],
];

/** Where this change lands, read off its kind and target; Admin when nothing nearer is known. */
export function whereOf(kind: ProposalKind, target: Record<string, unknown>): Where {
  const t = (k: string) => String(target[k] ?? "");
  switch (kind) {
    case "page_content": {
      const spec = pageSpecForSection(t("section"));
      return spec ? { label: `${spec.label} page`, href: spec.path } : { label: t("section"), href: null };
    }
    case "faq_add":
    case "faq_edit":
    case "faq_remove": {
      const p = t("pathway");
      return { label: `${p.charAt(0).toUpperCase()}${p.slice(1)} page`, href: `/${encodeURIComponent(p)}` };
    }
    case "role_card":
      return { label: "Roles page", href: `/roles?seat=${encodeURIComponent(t("roleId"))}` };
    case "role_listing":
      return { label: "Roles page", href: "/roles" };
    case "variable":
      return { label: "Admin, Variables", href: "/admin?tab=variables" };
    case "module_lifecycle":
    case "module_config": {
      const def = MODULES_BY_ID[t("id")];
      return { label: def ? def.name : t("id"), href: def ? `/modules/${encodeURIComponent(def.id)}` : "/admin?tab=modules" };
    }
    case "season_goals":
      return { label: "Season", href: "/admin?tab=season" };
    case "onboarding_path":
      return { label: "Onboarding path", href: "/profile" };
    case "session_agenda":
      return { label: "Sessions, agenda items", href: "/sessions" };
    case "setting": {
      const path = t("path");
      for (const [re, at] of SETTING_PAGES) {
        const m = path.match(re);
        if (m) return at(m);
      }
      return { label: "Admin", href: "/admin" };
    }
  }
}

/** What is live now, in the proposal's shape. Null when there is nothing yet (a new FAQ) or it cannot be read. */
export async function liveOf(deps: KindDeps, run: Run, kind: ProposalKind, target: Record<string, unknown>, body: Record<string, unknown>): Promise<unknown> {
  try {
    switch (kind) {
      case "role_card": {
        const { role } = await roleOf(deps.pool, String(target.roleId ?? ""));
        if (!role) return null;
        const s = await editorState(deps.pool, role);
        const out: Record<string, unknown> = {};
        if (obj(body.words)) out.words = pick(s.words as Record<string, unknown>, Object.keys(obj(body.words)!));
        if (obj(body.parameters)) out.parameters = pick(s.parameters as Record<string, unknown>, Object.keys(obj(body.parameters)!));
        if ("pay" in body) out.pay = s.pay;
        if ("archetypes" in body) out.archetypes = s.archetypes;
        if ("circleId" in body) out.circleId = role.circleId ?? null;
        if (obj(body.sections)) out.sections = pick(s.sections as unknown as Record<string, unknown>, Object.keys(obj(body.sections)!));
        return out;
      }
      case "page_content":
        return deps.content()[String(target.section ?? "")] ?? null;
      case "faq_add":
        return null;
      case "faq_edit":
      case "faq_remove": {
        const item = (deps.faqs()[String(target.pathway ?? "")] ?? []).find((f) => f.id === String(target.id ?? ""));
        return item ? { question: item.question, answer: item.answer } : null;
      }
      case "variable": {
        const v = allVariables().find((x) => x.key === String(target.key ?? ""));
        return v ? { value: v.value } : null;
      }
      case "module_lifecycle":
        return { lifecycle: MODULES_BY_ID[String(target.id ?? "")]?.core ? "public" : storedLifecycle(String(target.id ?? "")) };
      case "module_config": {
        const id = String(target.id ?? "");
        return moduleConfig(id) ?? MODULES_BY_ID[id]?.defaultConfig ?? null;
      }
      case "role_listing":
        return { ids: (await listOrgRoles(deps.pool)).filter((r) => !r.isExample && isListed(r)).map((r) => r.id) };
      case "season_goals": {
        const season = deps.seasons().find((s) => s.id === String(target.seasonId ?? ""));
        if (!season) return null;
        // Row for row beside the proposal: each proposed goal reads against the held goal it keeps (by id, else by words), so a reworded or moved goal shows what it replaces and a new one shows nothing yet.
        const held = season.goals ?? [];
        const proposed = Array.isArray(body.goals) ? (body.goals as Array<Record<string, unknown>>).map((g) => obj(g) ?? {}) : [];
        if (!proposed.length) return { goals: held.map((g) => ({ text: g.text, done: !!g.done })) };
        return {
          goals: keptGoalIds(held, proposed).map((id) => {
            const h = id ? held.find((x) => x.id === id) : undefined;
            return h ? { text: h.text, done: !!h.done } : null;
          }),
        };
      }
      case "onboarding_path":
        return { doc: (await readConfigDocument(deps.pool, VILLAGE_DOC_KEY)) ?? null };
      case "session_agenda":
        // New items: nothing is live in their place.
        return null;
      case "setting": {
        const readPath = String(target.readPath ?? target.path ?? "");
        const a = await run("GET", readPath);
        return a.status === 200 ? a.body : null;
      }
    }
  } catch {
    return null;
  }
}

/**
 * What to keep as "live before", read just before a change is applied, so it can be proposed back (0400). The same
 * read the page shows (`liveOf`). A kind that is never put back reads nothing (`keep: false`); a read that fails or
 * throws keeps null, and never stops the accept.
 */
export async function readBefore(deps: KindDeps, run: Run, kind: ProposalKind, target: Record<string, unknown>, body: Record<string, unknown>): Promise<{ keep: false } | { keep: true; value: unknown }> {
  if (neverPutBack(kind, target)) return { keep: false };
  try {
    const value = await liveOf(deps, run, kind, target, body);
    return { keep: true, value: value === undefined ? null : value };
  } catch {
    return { keep: true, value: null };
  }
}

const routeError = (a: { status: number; body: unknown }): string => {
  const b = obj(a.body);
  const words = b?.message ?? b?.error ?? b?.reason;
  if (typeof words === "string" && words.trim()) return words.trim().slice(0, 600);
  if (a.status === 401 || a.status === 403) return "The route said no: this needs a power you do not hold here.";
  return `The route answered ${a.status}.`;
};
const fieldOf = (a: { body: unknown }): string | undefined => {
  const f = obj(a.body)?.fields;
  return Array.isArray(f) && typeof f[0] === "string" ? f[0] : undefined;
};

export type Applied = { ok: true } | { ok: false; error: string; field?: string; status?: number };

/** Run one accepted change through its target's own route, as the person (`run`). */
export async function applyProposal(deps: KindDeps, run: Run, kind: ProposalKind, target: Record<string, unknown>, body: Record<string, unknown>): Promise<Applied> {
  const route = routeOf(kind, target);
  const through = async (method: Parameters<Run>[0], path: string, payload?: unknown): Promise<Applied> => {
    const a = await run(method, path, payload);
    if (a.status >= 200 && a.status < 300) return { ok: true };
    return { ok: false, error: routeError(a), field: fieldOf(a), status: a.status };
  };
  switch (kind) {
    case "role_card": {
      // The founding sections save whole; a proposal names the ones it changes, merged onto the card as it stands.
      let payload: Record<string, unknown> = body;
      if (obj(body.sections)) {
        const read = await run("GET", route.path);
        if (read.status !== 200) return { ok: false, error: routeError(read), status: read.status };
        const live = obj(obj(read.body)?.state)?.sections ?? {};
        payload = { ...body, sections: mergeOnto(live, body.sections) };
      }
      return through("POST", route.path, payload);
    }
    case "page_content":
      return through("PUT", route.path, mergeOnto(deps.content()[String(target.section ?? "")] ?? {}, body));
    case "faq_add":
      return through("POST", route.path, { question: body.question, answer: body.answer ?? "" });
    case "faq_edit": {
      const pathway = String(target.pathway ?? "");
      const list = deps.faqs()[pathway] ?? [];
      if (!list.some((f) => f.id === String(target.id ?? ""))) return { ok: false, error: "That FAQ is not there any more." };
      const next = list.map((f) => (f.id === String(target.id) ? { id: f.id, question: String(body.question ?? f.question), answer: String(body.answer ?? f.answer) } : f));
      return through("PUT", route.path, next);
    }
    case "faq_remove":
      return through("DELETE", route.path);
    case "variable":
      return through("PUT", route.path, { value: String(body.value ?? "") });
    case "module_lifecycle":
      return through("PUT", route.path, { lifecycle: body.lifecycle });
    case "module_config": {
      const id = String(target.id ?? "");
      return through("PUT", route.path, { config: mergeOnto(moduleConfig(id) ?? MODULES_BY_ID[id]?.defaultConfig ?? {}, body) });
    }
    case "role_listing":
      return through("POST", route.path, { ids: body.ids });
    case "season_goals": {
      const read = await run("GET", "/api/admin/seasons");
      if (read.status !== 200) return { ok: false, error: routeError(read), status: read.status };
      const doc = { ...(obj(read.body) ?? {}) };
      for (const k of ["currentId", "needsNextSeason", "suggestion"]) delete doc[k];
      const seasons = Array.isArray(doc.seasons) ? (doc.seasons as Array<Record<string, unknown>>) : [];
      const at = seasons.findIndex((s) => s.id === String(target.seasonId ?? ""));
      if (at < 0) return { ok: false, error: "This season's goals live on the season list. Save the season's dates in Admin, Season first." };
      const held = Array.isArray(seasons[at].goals) ? (seasons[at].goals as Array<Record<string, unknown>>) : [];
      // A goal that names a held goal's id, or else matches one word for word, keeps that id, so whatever links to it stays linked (`keptGoalIds`).
      const proposed = body.goals as Array<Record<string, unknown>>;
      const ids = keptGoalIds(held, proposed);
      const goals = proposed.map((g, i) => ({ ...(ids[i] ? { id: ids[i] } : {}), text: String(g.text ?? "").trim(), done: !!g.done }));
      doc.seasons = seasons.map((s, i) => (i === at ? { ...s, goals } : s));
      return through("PUT", "/api/admin/seasons", doc);
    }
    case "onboarding_path": {
      const live = (await readConfigDocument(deps.pool, VILLAGE_DOC_KEY)) ?? {};
      return through("PUT", route.path, { doc: mergeOnto(live, obj(body.doc) ?? {}) });
    }
    case "session_agenda": {
      // Read again as the person accepted it (their edits included); each item through the member's own door, as them.
      const read = readProposedAgenda(target, body);
      if (!read.ok) return { ok: false, error: read.error, field: read.field };
      for (let i = 0; i < read.value.items.length; i++) {
        const done = await through("POST", route.path, agendaItemBody(read.value, read.value.items[i]));
        if (!done.ok) {
          const landed = i === 0 ? "None of the items was added." : i === 1 ? "Item 1 was added; the rest were not." : `Items 1 to ${i} were added; the rest were not.`;
          return { ...done, error: `Item ${i + 1}: ${done.error} ${landed}`, field: done.field ?? `items.${i}` };
        }
      }
      return { ok: true };
    }
    case "setting": {
      // A new gathering with no status goes on the calendar, for a proposal filed before the filing rule (`settingBodyToApply`).
      const payload = settingBodyToApply(route.method, route.path, body);
      return through(route.method, route.path, route.method === "DELETE" && !Object.keys(payload).length ? undefined : payload);
    }
  }
}

/** Whether Express registered a route for `method path`, read off the app's own router (Express 5), sub-routers included. */
export function routeExistsIn(app: unknown): (method: string, path: string) => boolean {
  const walk = (stack: any[], method: string, path: string): boolean => {
    for (const layer of stack ?? []) {
      try {
        if (layer.route) {
          if (layer.route.methods?.[method.toLowerCase()] && layer.match(path)) return true;
        } else if (layer.handle?.stack && layer.match(path)) {
          const prefix = typeof layer.path === "string" ? layer.path : "";
          const rest = path.slice(prefix.length) || "/";
          if (walk(layer.handle.stack, method, rest)) return true;
        }
      } catch {
        /* a layer that cannot match this path is not this route */
      }
    }
    return false;
  };
  return (method, path) => {
    const a = app as { router?: { stack?: any[] }; _router?: { stack?: any[] } };
    return walk(a.router?.stack ?? a._router?.stack ?? [], method, path);
  };
}
