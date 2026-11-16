/**
 * Protocols: a village's named checklists, and the runs members walk through.
 *
 * ONE FILE IS THE CONTRACT. The routes (server/routes/protocols.ts), the store
 * (server/repos/protocols.ts), the Admin editor and the member page all read
 * their shapes, limits and rules from here, so the phone that ticks a step
 * offline and the server that records it later apply the SAME rule. A run
 * ticked with no signal is checked twice: on the device as it happens, and on
 * the server when it arrives. Both checks are the functions below.
 *
 * THE MODEL.
 *   - A protocol is a named, ordered list of steps. Each step has its words,
 *     whether it is required, and who may tick it: any member, or the holder
 *     of one named role on the org chart.
 *   - Every save makes a new VERSION. A run is pinned to the version it was
 *     started on, so editing a list never rewrites a run already walked.
 *   - A run is a list of tick events, never a set of booleans. Each event is
 *     one member ticking or unticking one step at one moment, under an id the
 *     device made. Two phones can tick the same run offline and the record is
 *     the union of both; the latest event per step says where it stands.
 *   - A run with a required step not done cannot be completed.
 *
 * COPY RULES. Platform code carries no village's brand, so nothing here names
 * what a village uses its protocols for. No em-dashes.
 */

// ── Limits ───────────────────────────────────────────────────────────────────

export const PROTOCOL_ID_MAX = 64;
export const PROTOCOL_TITLE_MAX = 120;
export const PROTOCOL_SUMMARY_MAX = 600;
export const STEP_ID_MAX = 64;
export const STEP_TEXT_MAX = 280;
export const STEP_DETAIL_MAX = 600;
export const STEPS_MAX = 80;
export const PROTOCOLS_PER_IMPORT_MAX = 40;
/** A run or tick id, made on the device. */
export const CLIENT_ID_MAX = 64;
/** A tick stamped further ahead of the server's clock than this is clamped to now. */
export const CLOCK_SKEW_MS = 5 * 60 * 1000;

/** The import file's format tag. A file without it is still read; a different one is refused. */
export const PROTOCOLS_IMPORT_FORMAT = "village-protocols/1";

const SLUG = /^[a-z0-9][a-z0-9_-]*$/;
const CLIENT_ID = /^[A-Za-z0-9_-]{8,64}$/;

export function isProtocolSlug(v: unknown): v is string {
  return typeof v === "string" && v.length <= PROTOCOL_ID_MAX && SLUG.test(v);
}

export function isClientId(v: unknown): v is string {
  return typeof v === "string" && CLIENT_ID.test(v);
}

/** A stable slug from free words: "Ready to go!" becomes "ready-to-go". */
export function slugify(words: string, max = PROTOCOL_ID_MAX): string {
  const s = words
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
  return s || "item";
}

// ── Shapes ───────────────────────────────────────────────────────────────────

/** Who may tick a step. A role is named by its org-chart id; the title is kept for display. */
export type StepWho = { kind: "member" } | { kind: "role"; roleId: string; roleTitle: string };

export interface ProtocolStep {
  /** Stable inside its protocol across versions, so history lines up. */
  id: string;
  text: string;
  /** Optional longer words: how, where, what to look for. */
  detail: string;
  required: boolean;
  who: StepWho;
}

/** What Admin saves. */
export interface ProtocolDraft {
  id: string;
  title: string;
  summary: string;
  steps: ProtocolStep[];
}

export type ProtocolStatus = "active" | "archived";

/** One protocol as a member reads it: its current version. */
export interface ProtocolView extends ProtocolDraft {
  version: number;
  status: ProtocolStatus;
  updatedAt: string;
}

export interface TickEvent {
  clientId: string;
  stepId: string;
  done: boolean;
  /** Member id of who ticked. */
  by: string;
  /** Display name at the time it was recorded, for the history line. */
  byName: string;
  /** When it happened on the device, ISO. */
  at: string;
}

export type RunStatus = "open" | "complete" | "set-aside";

export interface RunView {
  id: string;
  protocolId: string;
  version: number;
  /** The version's words and steps, so a run always renders as it was walked. */
  title: string;
  steps: ProtocolStep[];
  startedBy: string;
  startedByName: string;
  startedAt: string;
  status: RunStatus;
  endedAt: string | null;
  endedBy: string | null;
  endedByName: string | null;
  ticks: TickEvent[];
}

/** The signed-in member, as far as tick rules need. */
export interface Ticker {
  id: string;
  /** Org-chart role ids this member holds live right now. */
  roleIds: readonly string[];
}

// ── Validation ───────────────────────────────────────────────────────────────

export type Checked<T> = { ok: true; value: T } | { ok: false; problems: string[] };

function text(v: unknown): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
}

function longText(v: unknown): string {
  return typeof v === "string" ? v.replace(/\r\n?/g, "\n").trim() : "";
}

/**
 * Check a draft from Admin or an import. `roleTitles` maps the village's
 * role ids to their titles, so a step naming a role that does not exist is
 * refused by name rather than saved pointing at nothing.
 */
export function checkProtocolDraft(input: unknown, roleTitles: ReadonlyMap<string, string>): Checked<ProtocolDraft> {
  const problems: string[] = [];
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const title = text(raw.title);
  const id = typeof raw.id === "string" && raw.id ? raw.id : slugify(title);
  if (!title) problems.push("Give the protocol a name.");
  if (title.length > PROTOCOL_TITLE_MAX) problems.push(`Keep the name to ${PROTOCOL_TITLE_MAX} characters.`);
  if (!isProtocolSlug(id)) problems.push("The protocol id may use lowercase letters, numbers, dashes and underscores.");
  const summary = longText(raw.summary);
  if (summary.length > PROTOCOL_SUMMARY_MAX) problems.push(`Keep the description to ${PROTOCOL_SUMMARY_MAX} characters.`);

  const rawSteps = Array.isArray(raw.steps) ? raw.steps : [];
  if (rawSteps.length === 0) problems.push("Add at least one step.");
  if (rawSteps.length > STEPS_MAX) problems.push(`A protocol holds at most ${STEPS_MAX} steps.`);

  const steps: ProtocolStep[] = [];
  const seen = new Set<string>();
  rawSteps.slice(0, STEPS_MAX).forEach((s, i) => {
    const n = i + 1;
    const r = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
    const stepText = text(r.text);
    if (!stepText) problems.push(`Step ${n} needs its words.`);
    if (stepText.length > STEP_TEXT_MAX) problems.push(`Step ${n}: keep it to ${STEP_TEXT_MAX} characters.`);
    const detail = longText(r.detail);
    if (detail.length > STEP_DETAIL_MAX) problems.push(`Step ${n}: keep the detail to ${STEP_DETAIL_MAX} characters.`);
    let stepId = typeof r.id === "string" && r.id ? r.id : slugify(stepText, STEP_ID_MAX);
    if (!isProtocolSlug(stepId) || stepId.length > STEP_ID_MAX) {
      problems.push(`Step ${n}: its id may use lowercase letters, numbers, dashes and underscores.`);
    }
    if (seen.has(stepId)) {
      if (typeof r.id === "string" && r.id) problems.push(`Step ${n}: the id "${stepId}" is used twice.`);
      else {
        let k = 2;
        while (seen.has(`${stepId}-${k}`)) k++;
        stepId = `${stepId}-${k}`;
      }
    }
    seen.add(stepId);
    let who: StepWho = { kind: "member" };
    const w = r.who as Record<string, unknown> | string | undefined;
    if (w && typeof w === "object" && w.kind === "role") {
      const roleId = typeof w.roleId === "string" ? w.roleId : "";
      const known = roleTitles.get(roleId);
      if (!known) problems.push(`Step ${n}: pick a role that is on the org chart.`);
      who = { kind: "role", roleId, roleTitle: known ?? text(w.roleTitle) };
    } else if (w !== undefined && w !== "member" && !(w && typeof w === "object" && w.kind === "member")) {
      problems.push(`Step ${n}: who may tick it must be any member or one role.`);
    }
    steps.push({ id: stepId, text: stepText, detail, required: r.required !== false, who });
  });

  if (problems.length) return { ok: false, problems };
  return { ok: true, value: { id, title, summary, steps } };
}

// ── Import ───────────────────────────────────────────────────────────────────

export interface ImportRole {
  id: string;
  title: string;
}

export interface ImportResult {
  drafts: ProtocolDraft[];
  /** Problems by protocol, in words a founder can act on. Empty means every one is ready to save. */
  problems: string[];
  /** Role names the file uses that the org chart does not hold yet. */
  missingRoles: string[];
}

/**
 * Read an import file. The shape, which `docs/modules/protocols.md` documents:
 *
 *   { "format": "village-protocols/1",
 *     "protocols": [
 *       { "id": "opening-up", "title": "Opening up", "summary": "...",
 *         "steps": [
 *           { "id": "lights", "text": "Lights on", "detail": "...", "required": true },
 *           { "text": "Doors unlocked", "role": "Keyholder" } ] } ] }
 *
 * A step's `role` is a role's title or id on this village's org chart, matched
 * without case. `"who": "<role>"` says the same, and `"who": "anyone"` (or
 * "any", "member") is any member. A step naming no role may be ticked by any
 * member. `required` defaults to true. Ids are made from the words when left
 * out. Fields the reader does not know (a `source`, an `_about`) are ignored,
 * and `format` may be left out.
 */
const ANYONE = new Set(["", "anyone", "any", "member", "any member", "everyone"]);

export function readProtocolImport(input: unknown, roles: readonly ImportRole[]): ImportResult {
  const out: ImportResult = { drafts: [], problems: [], missingRoles: [] };
  let doc = input;
  if (typeof doc === "string") {
    try {
      doc = JSON.parse(doc);
    } catch {
      out.problems.push("That file is not JSON.");
      return out;
    }
  }
  const top = (doc && typeof doc === "object" ? doc : {}) as Record<string, unknown>;
  if (top.format !== undefined && top.format !== PROTOCOLS_IMPORT_FORMAT) {
    out.problems.push(`This file says it is "${String(top.format)}"; this village reads "${PROTOCOLS_IMPORT_FORMAT}".`);
    return out;
  }
  const list = Array.isArray(top.protocols) ? top.protocols : Array.isArray(doc) ? (doc as unknown[]) : null;
  if (!list || list.length === 0) {
    out.problems.push("The file holds no protocols.");
    return out;
  }
  if (list.length > PROTOCOLS_PER_IMPORT_MAX) {
    out.problems.push(`One file holds at most ${PROTOCOLS_PER_IMPORT_MAX} protocols.`);
    return out;
  }
  const byId = new Map(roles.map((r) => [r.id, r]));
  const byTitle = new Map(roles.map((r) => [r.title.trim().toLowerCase(), r]));
  const titles = new Map(roles.map((r) => [r.id, r.title]));
  const missing = new Set<string>();
  const ids = new Set<string>();

  list.forEach((p, i) => {
    const r = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
    const steps = (Array.isArray(r.steps) ? r.steps : []).map((s) => {
      const st = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
      // `role`, or `who` naming a role. "anyone", "any", "member" or nothing
      // means any member may tick it.
      const whoWord = typeof st.who === "string" ? text(st.who) : "";
      const roleName = text(st.role) || (ANYONE.has(whoWord.toLowerCase()) ? "" : whoWord);
      let who: unknown = "member";
      if (roleName) {
        const hit = byId.get(roleName) ?? byTitle.get(roleName.toLowerCase());
        if (hit) who = { kind: "role", roleId: hit.id, roleTitle: hit.title };
        else {
          missing.add(roleName);
          who = { kind: "role", roleId: "", roleTitle: roleName };
        }
      }
      return { id: st.id, text: st.text, detail: st.detail, required: st.required, who };
    });
    const checked = checkProtocolDraft({ id: r.id, title: r.title, summary: r.summary, steps }, titles);
    const label = text(r.title) || `Protocol ${i + 1}`;
    if (!checked.ok) {
      // A role the chart does not hold is said once, below, by its name.
      const problems = checked.problems.filter((m) => !roleOfStepMissing(m, steps));
      for (const m of problems) out.problems.push(`${label}: ${m}`);
      return;
    }
    if (ids.has(checked.value.id)) {
      out.problems.push(`${label}: the id "${checked.value.id}" is used twice in this file.`);
      return;
    }
    ids.add(checked.value.id);
    out.drafts.push(checked.value);
  });
  out.missingRoles = Array.from(missing);
  if (out.missingRoles.length) {
    out.problems.push(
      `Add ${out.missingRoles.length === 1 ? "this role" : "these roles"} to the org chart first, or edit the file: ${out.missingRoles.join(", ")}.`,
    );
  }
  return out;
}

function roleOfStepMissing(message: string, steps: { who: unknown }[]): boolean {
  if (!/pick a role that is on the org chart/.test(message)) return false;
  const m = /^Step (\d+):/.exec(message);
  if (!m) return false;
  const w = steps[Number(m[1]) - 1]?.who as StepWho | undefined;
  return !!w && w.kind === "role" && !w.roleId;
}

// ── Running ──────────────────────────────────────────────────────────────────

export interface StepState {
  done: boolean;
  by: string | null;
  byName: string | null;
  at: string | null;
}

/** Later wins; on the same instant the larger id wins, so every device agrees. */
function later(a: TickEvent, b: TickEvent): boolean {
  if (a.at !== b.at) return a.at > b.at;
  return a.clientId > b.clientId;
}

/** Where each step stands, from the events. A step nobody touched is not done. */
export function stepStates(steps: readonly ProtocolStep[], ticks: readonly TickEvent[]): Map<string, StepState> {
  const latest = new Map<string, TickEvent>();
  for (const t of ticks) {
    const cur = latest.get(t.stepId);
    if (!cur || later(t, cur)) latest.set(t.stepId, t);
  }
  const out = new Map<string, StepState>();
  for (const s of steps) {
    const t = latest.get(s.id);
    out.set(s.id, t ? { done: t.done, by: t.by, byName: t.byName, at: t.at } : { done: false, by: null, byName: null, at: null });
  }
  return out;
}

/** May this member tick or untick this step? The same rule on the phone and on the server. */
export function mayTick(step: ProtocolStep, who: Ticker): boolean {
  if (step.who.kind === "member") return true;
  return who.roleIds.includes(step.who.roleId);
}

/** The required steps still open, in order. Empty means the run may be completed. */
export function openRequiredSteps(steps: readonly ProtocolStep[], ticks: readonly TickEvent[]): ProtocolStep[] {
  const states = stepStates(steps, ticks);
  return steps.filter((s) => s.required && !states.get(s.id)?.done);
}

export function progress(steps: readonly ProtocolStep[], ticks: readonly TickEvent[]): { done: number; total: number } {
  const states = stepStates(steps, ticks);
  let done = 0;
  for (const s of steps) if (states.get(s.id)?.done) done++;
  return { done, total: steps.length };
}

/** The sentence a refused completion carries. */
export function completionRefusal(open: readonly ProtocolStep[]): string {
  if (open.length === 0) return "";
  const first = open[0]!;
  const waits = first.who.kind === "role" ? ` (${first.who.roleTitle})` : "";
  return open.length === 1
    ? `One required step is still open: ${first.text}${waits}.`
    : `${open.length} required steps are still open, starting with: ${first.text}${waits}.`;
}

/**
 * A device's clock can be wrong. A tick stamped in the future is recorded at
 * the server's now; one in the past keeps its own time, which is when the
 * member says it happened.
 */
export function clampToNow(at: string, nowMs: number): string {
  const t = Date.parse(at);
  if (!Number.isFinite(t) || t > nowMs + CLOCK_SKEW_MS) return new Date(nowMs).toISOString();
  return new Date(t).toISOString();
}
