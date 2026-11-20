/**
 * THE VILLAGE CONNECTOR: a remote MCP server on the member's own agent token
 * (End of Moon addendum v6, B4).
 *
 *   POST /api/agent/v1/mcp   Streamable HTTP, stateless, one JSON-RPC message
 *                            per request, answered as JSON
 *
 * This file is the protocol and the tool table, and nothing else. It makes no
 * database call and holds no permission of its own: every tool names the
 * holder's OWN route, and the HTTP wiring (server/routes/agentMcp.ts) runs
 * that route as the holder, so `authedUser`, the one capability gate and
 * `requireModule` answer exactly as they do on the web. A token only ever
 * narrows what its holder can do, the rule at the top of
 * server/lib/agentTokens.ts, and this surface must never grow a second
 * permission system.
 *
 * ── SCOPES ────────────────────────────────────────────────────────────────
 * `tools/list` shows only the tools the token's scopes open, and `tools/call`
 * refuses any other, so a token minted with `moon.read` alone lists no write
 * tool (check 31).
 *
 * ── WRITES: THE SAME TWO CALLS AS EVERY AGENT WRITE ──────────────────────
 * A write tool called without `confirmToken` writes nothing. It answers with
 * an echo of exactly what would be written, read fresh from the holder's own
 * route, and a confirm token bound to that echo, the holder and the tool
 * (`mintConfirmToken`). Called again with the same arguments and the token,
 * it reads the state again, rebuilds the echo, and writes only when the token
 * binds THAT echo. A token works once: the HTTP wiring spends it the moment
 * it verifies (`createConfirmSpendBook` in ./agentTokens), so the same token
 * sent again is refused even where the echo would still match, as it would
 * for an admin path or a moon write that leaves nothing versioned behind.
 *
 * ── SERA'S TOOLS WRITE AT ONCE, AND ARE UNDONE INSTEAD ───────────────────
 * The `sera.undoable` tools are the one exception to the two calls, and they
 * say so (`writesAtOnce`). Sera's agent acts for no single member who could
 * say yes, so each write lands at once, is recorded with what puts it back,
 * and can be undone for 30 days by the agent or a steward while nobody has
 * touched it (server/lib/seraAgent.ts). Check 31 covers the member's own
 * write tools; these are held instead by their undo.
 *
 * ── WHAT NO TOOL EVER DOES ───────────────────────────────────────────────
 * Send a recap or an invoice, take one back, issue, approve, return, mark
 * paid, or read or change a pay route. A person presses those in the app.
 * No tool in this table names a route that does any of them, and
 * server/lib/agentMcp.test.ts walks the table to hold that.
 *
 * ── REDACTION ─────────────────────────────────────────────────────────────
 * Every tool result passes through `redactToolResult`, which drops any key
 * matching the moon pack's forbidden list (`PACK_FORBIDDEN_KEY`) or naming a
 * pay route, a legal name or an address, at any depth. It runs for every
 * holder, a `cash.pay` holder included.
 */
import { isShippedAgentRead, leadApprovalSubject, leadApprovedBodyProblem, leadSeatTarget, readLeadApproval, stripContactData, withoutApproval, type AgentAdminPathsDoc, type LeadApprovalSubject, type LeadApprovedKind, type LeadSeatFacts, type SeatPowerFacts } from "../../shared/agentAdmin";
import { fullAccessBodyProblem, fullAccessDecision } from "../../shared/agentFullAccess";
import { MOON_ROUTES, PACK_FORBIDDEN_KEY } from "../../shared/moonRecap";
import { LIBRARY_API, LIBRARY_LIMITS, libraryItemUrl } from "../../shared/sessionLibrary";
import { ITEM_AIMS, cleanLine, cleanText } from "../../shared/sessions";
import { HANDOFF_LIMITS, HANDOFF_REFUSALS, HANDOFFS_URL } from "../../shared/roleTaskHandoff";
import { isDayKey } from "../../shared/memberTasks";
import { echoHash, type AgentScope } from "./agentTokens";
import { INBOX_TOOLS, TIER_B_TOOLS } from "./agentMcpTierB";
import { PROPOSAL_TOOLS } from "./agentMcpProposals";

/** The protocol revisions this server speaks, newest first. */
// 2025-03-26 is not offered: it predates the resource metadata a 401 points at, which is how a connector finds the sign-in.
export const MCP_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18"] as const;

/** The JSON-RPC error codes this server answers with. */
export const RPC = {
  parseError: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603,
} as const;

// ── Redaction ────────────────────────────────────────────────────────────────

/** Keys a connector result never carries, beside the moon pack's own list. */
export const CONNECTOR_REDACTED_KEY = /route|legal_?name|address|private_?detail/i;

/** True when a key is one no connector result may carry. */
export function isRedactedKey(key: string): boolean {
  return PACK_FORBIDDEN_KEY.test(key) || CONNECTOR_REDACTED_KEY.test(key);
}

/** The value with every redacted key removed, at any depth. Arrays keep their order. */
export function redactToolResult(value: unknown, depth = 0): unknown {
  if (depth > 40) return null;
  if (Array.isArray(value)) return value.map((v) => redactToolResult(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isRedactedKey(k)) continue;
      out[k] = redactToolResult(v, depth + 1);
    }
    return out;
  }
  return value;
}

// ── What a tool may ask of the server ────────────────────────────────────────

/** One call to the holder's own route, as the holder. */
export interface RouteAnswer {
  status: number;
  body: unknown;
}

export interface ToolContext {
  /** Runs `method path` as the holder and answers with the route's status and JSON. */
  dispatch: (method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", path: string, body?: unknown) => Promise<RouteAnswer>;
  /** A confirm token bound to this tool, this holder and this echo. */
  mintConfirm: (tool: string, echo: unknown) => { token: string; expiresAt: string };
  /** Whether `token` binds this tool, this holder and this echo, and why not. */
  verifyConfirm: (tool: string, token: unknown, echo: unknown) => { ok: true } | { ok: false; reason: string; sentence: string };
  /** The token's holder. `admin_request` refuses any path naming them. */
  holderId?: string;
  /** The village's agent paths list (shared/agentAdmin.ts). Only `admin_request` reads it. */
  adminPaths?: () => Promise<AgentAdminPathsDoc>;
  /** Whether the Anchor has recorded its approval of AI agents (shared/agentProposals.ts). Reads of applicant and member data wait on it. */
  applicantDataOpen?: () => Promise<boolean>;
  /** Sera's undoable actions (server/lib/seraAgent.ts). Only the `sera.undoable` tools use it. */
  sera?: {
    run: (tool: "link_sera_person" | "suggest_task" | "set_board_access" | "draft_agenda_item" | "suggest_moon_item", args: Record<string, unknown>) => Promise<{ ok: true; result: Record<string, unknown> } | { ok: false; error: string }>;
    undo: (actionId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  };
  /**
   * The village's lead-approved writes (shared/agentAdmin.ts, LEAD_APPROVED_WRITES): whether the opt-in is on,
   * the facts of the seat a seating or unseating reaches, and the record and notice a seating or unseating leaves.
   */
  leadApproved?: {
    on: () => Promise<boolean>;
    seat: (target: { roleId: string } | { seatingId: string }) => Promise<LeadSeatFacts | null>;
    /**
     * The record every approved write leaves, keyed on `writeKey`: one admin-only audit event saying who the AGENT
     * says approved it, stored BEFORE the write is dispatched, and it throws when it cannot be stored, so nothing is
     * written without it (audit, 15 Nov 2026).
     */
    recorded: (a: LeadApprovalRecordInput) => Promise<void>;
    /** After the route answered: the notice and the memory record for a write, or an event saying it was refused. Never throws. */
    settled: (a: LeadApprovalRecordInput, outcome: "written" | "refused") => Promise<void>;
  };
  /**
   * The full-access switch (the lead, 20 Nov 2026; shared/agentFullAccess.ts): whether THIS holder's agent has full
   * access now (a live seat in the role a person named), and the audit each full-access write leaves BEFORE it is
   * dispatched, which throws when it cannot be stored, so nothing is written without it.
   */
  fullAccess?: {
    on: () => Promise<boolean>;
    recorded: (a: { method: string; path: string; summary: string; approvedBy: string; approvalNote: string }) => Promise<void>;
  };
  /** Writes one `agent_actions` row. Only the admin and Sera tools record through it. */
  recordAction?: (a: { scope: string; tool: string; method: string | null; path: string | null; echoHash: string; state: "done" | "refused" | "asked" }) => Promise<void>;
}

/** One lead-approved write as its record names it (server/lib/agentLeadApproval.ts). */
export interface LeadApprovalRecordInput {
  kind: LeadApprovedKind;
  roleId: string | null;
  path: string;
  method: string;
  subject: LeadApprovalSubject;
  /** Who the agent SAYS approved it, and its words for that approval: the agent's claim, never verified. */
  approvedBy: string;
  approvalNote: string;
  summary?: string;
  writeKey: string;
}

/** What a tool answers: a result to show, or a refusal in words. */
export type ToolOutcome =
  | { ok: true; result: unknown }
  | { ok: false; error: string; detail?: unknown };

export interface ToolDef {
  name: string;
  /** The scope a token must carry to list or call this tool. */
  scope: AgentScope;
  /** Writes go through the two calls; reads answer at once. */
  kind: "read" | "write";
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** Every route this tool may call, as `METHOD /path` with `:param` holes. The table test reads these. */
  routes: readonly string[];
  /** For a tool that reads or writes by its arguments: whether THIS call writes. */
  writes?: (args: Record<string, unknown>) => boolean;
  /** A write that can change or remove what is there, for the client's own warning. */
  destructive?: boolean;
  /** A write that lands on the first call, held by its undo instead of a confirmToken (Sera's tools only). */
  writesAtOnce?: boolean;
  run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolOutcome>;
}

const NO_ARGS = { type: "object", properties: {}, additionalProperties: false } as const;

/** A route's refusal, in the route's own words when it gave any. */
function refusal(what: string, a: RouteAnswer): ToolOutcome {
  const b = (a.body && typeof a.body === "object" ? a.body : {}) as Record<string, unknown>;
  const words = typeof b.message === "string" ? b.message : typeof b.error === "string" ? b.error : `status ${a.status}`;
  return { ok: false, error: `${what}: ${words}`, detail: { status: a.status } };
}

/**
 * A role's power groups as the holder reads them, for `seat_power` (the lead, 20 Nov 2026): the route's own GET,
 * so its gate answers for the holder. A route that is not there, or refuses, reads as no such role.
 */
async function readSeatPower(ctx: ToolContext, path: string): Promise<SeatPowerFacts> {
  const a = await ctx.dispatch("GET", path);
  const b = (a.body && typeof a.body === "object" ? a.body : {}) as Record<string, any>;
  if (a.status !== 200 || !b.seat) return { found: false, isExample: false, linked: [], groups: [] };
  const groups = ((Array.isArray(b.groups) ? b.groups : []) as unknown[]).filter((g): g is Record<string, unknown> => !!g && typeof g === "object").map((g) => ({
    id: String(g.id ?? ""),
    capabilities: Array.isArray(g.capabilities) ? g.capabilities.map(String) : [],
    grantsAdmin: g.grantsAdmin === true,
    isExample: !!g.isExample,
  }));
  return { found: true, isExample: !!b.seat.isExample, linked: Array.isArray(b.roleIds) ? b.roleIds.map(String) : [], groups };
}

// ── The board, for mark_my_task ──────────────────────────────────────────────

/** The board actions an agent may press for its holder. Each is the board's own route. */
export const BOARD_ACTIONS = ["done", "remove", "undo"] as const;
export type BoardAction = (typeof BOARD_ACTIONS)[number];

interface BoardTask {
  id: string;
  title: string;
  status: string;
  version: number;
}

function boardTasks(body: unknown): BoardTask[] {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const all = [b.open, b.done, b.removed].flatMap((list) => (Array.isArray(list) ? list : []));
  return all
    .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
    .map((t) => ({ id: String(t.id ?? ""), title: String(t.title ?? ""), status: String(t.status ?? ""), version: Number(t.version ?? 0) }));
}

/** Which statuses each action presses from. The board's own route still decides. */
const PRESSES_FROM: Record<BoardAction, readonly string[]> = {
  done: ["open"],
  remove: ["open"],
  undo: ["done", "removed"],
};

// ── The tool table ───────────────────────────────────────────────────────────


/** `:name` holes in a MOON_ROUTES path, filled and encoded. */
const fill = (path: string, params: Record<string, string>) => path.replace(/:([A-Za-z]+)/g, (_m, k: string) => encodeURIComponent(params[k] ?? ""));

/**
 * A write through one of the member's own moon routes, in the two calls: the
 * first answers the echo and a token, the second writes only when the token
 * binds the same echo. The route's own checks (Draft only, the member's own
 * recap) still decide.
 */
async function twoCallWrite(
  tool: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
  method: "PUT" | "PATCH" | "POST",
  path: string,
  body: Record<string, unknown>,
): Promise<ToolOutcome> {
  const echo = { method, path, body };
  if (args.confirmToken === undefined) {
    const { token, expiresAt } = ctx.mintConfirm(tool, echo);
    return { ok: true, result: { confirmRequired: true, echo, confirmToken: token, expiresAt, message: `Nothing was written. Show this to the member, and after their yes call ${tool} again with the same arguments and this confirmToken.` } };
  }
  const check = ctx.verifyConfirm(tool, args.confirmToken, echo);
  if (!check.ok) return { ok: false, error: check.sentence, detail: { reason: check.reason } };
  const a = await ctx.dispatch(method, path, body);
  if (a.status >= 300) return a.status === 404 ? { ok: false, error: NOT_OPEN } : refusal("My moon did not take that", a);
  return { ok: true, result: { written: true, echo, answer: a.body } };
}

/** How many agenda items one withdraw_agenda_item call may name. */
export const WITHDRAW_MAX = 20;

/** What a moon tool says while its route is not on this server, or the moon review is off. */
const NOT_OPEN = "My moon is not open here yet: the moon review is off in this village, or this server does not carry that part of it.";

/** Sera's closed list (server/lib/seraAgent.ts holds what each does and how it is undone). */
type SeraToolName = "link_sera_person" | "suggest_task" | "set_board_access" | "draft_agenda_item" | "suggest_moon_item";
const SERA_TOOL_DEFS: ReadonlyArray<{ name: SeraToolName; title: string; description: string; inputSchema: Record<string, unknown> }> = [
  {
    name: "link_sera_person",
    title: "Link a member to their Sera person",
    description: "Links a member to their Sera owner id. Never replaces a link that exists, and never links one owner to two members or one member to two owners. Undoable for 30 days.",
    inputSchema: { type: "object", properties: { userId: { type: "string" }, seraOwnerId: { type: "string" } }, required: ["userId", "seraOwnerId"], additionalProperties: false },
  },
  {
    name: "suggest_task",
    title: "Suggest a task on a member's board",
    description: "Puts a task on a member's board as a suggestion they keep or remove. Nobody is notified. Undoable for 30 days while the member has not touched it.",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string" },
        title: { type: "string" },
        tier: { type: "string", enum: ["high", "priority", "not_yet"] },
        horizon: { type: "string", enum: ["today", "week", "later"] },
        dueOn: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["userId", "title"],
      additionalProperties: false,
    },
  },
  {
    name: "set_board_access",
    title: "Turn a member's task board on or off",
    description: "Turns a member's task board on or off. Undoable for 30 days while nobody has switched it since.",
    inputSchema: { type: "object", properties: { userId: { type: "string" }, on: { type: "boolean" } }, required: ["userId", "on"], additionalProperties: false },
  },
  {
    name: "draft_agenda_item",
    title: "Draft an agenda item",
    description: "Puts a draft in a circle's agenda library, or in none in particular. A person brings it to the room. Undoable for 30 days while nobody has edited it or brought it to a room.",
    inputSchema: {
      type: "object",
      properties: { title: { type: "string" }, circleId: { type: "string" }, aim: { type: "string" }, note: { type: "string" } },
      required: ["title"],
      additionalProperties: false,
    },
  },
  {
    name: "suggest_moon_item",
    title: "Suggest an item on a member's moon",
    description: "Adds a suggested item to a member's Draft recap for that moon, which the member keeps or drops. Undoable for 30 days while it is still a suggestion.",
    inputSchema: {
      type: "object",
      properties: { userId: { type: "string" }, cycleId: { type: "string" }, text: { type: "string" } },
      required: ["userId", "cycleId", "text"],
      additionalProperties: false,
    },
  },
];

export const MCP_TOOLS: readonly ToolDef[] = [
  {
    name: "get_my_moon",
    scope: "moon.read",
    kind: "read",
    title: "My moon",
    description:
      "The holder's recap for the current moon, when the moon review is open in this village, and the holder's task board with each task's status and when it was done. Read only.",
    inputSchema: NO_ARGS,
    routes: [`GET ${MOON_ROUTES.myMoon}`, "GET /api/member-tasks/me"],
    async run(_args, ctx) {
      const [moon, board] = await Promise.all([ctx.dispatch("GET", MOON_ROUTES.myMoon), ctx.dispatch("GET", "/api/member-tasks/me")]);
      if (moon.status >= 500) return refusal("My moon could not be read", moon);
      if (board.status >= 500) return refusal("The task board could not be read", board);
      const b = (board.body && typeof board.body === "object" ? board.body : {}) as Record<string, unknown>;
      return {
        ok: true,
        result: {
          // 404 is the moon review being off, or not open yet: there is no recap to read.
          moon: moon.status === 200 ? moon.body : null,
          moonNote: moon.status === 200 ? null : "There is no recap to read here yet: the moon review is not open in this village.",
          board: board.status === 200 ? { open: b.open ?? [], done: b.done ?? [], removed: b.removed ?? [] } : null,
          boardNote: board.status === 200 ? null : "The task board is off for this member.",
        },
      };
    },
  },
  {
    name: "get_my_seats",
    scope: "moon.read",
    kind: "read",
    title: "My roles",
    description: "The roles the holder holds, with each role's purpose and accountabilities, from their own role card. Read only.",
    inputSchema: NO_ARGS,
    routes: ["GET /api/people/me/role-card"],
    async run(_args, ctx) {
      const a = await ctx.dispatch("GET", "/api/people/me/role-card");
      return a.status === 200 ? { ok: true, result: a.body } : refusal("The role card could not be read", a);
    },
  },
  {
    name: "get_season",
    scope: "moon.read",
    kind: "read",
    title: "The season",
    description: "The village's running season and its goals. Read only.",
    inputSchema: NO_ARGS,
    routes: ["GET /api/season"],
    async run(_args, ctx) {
      const a = await ctx.dispatch("GET", "/api/season");
      return a.status === 200 ? { ok: true, result: a.body } : refusal("The season could not be read", a);
    },
  },
  {
    name: "mark_my_task",
    scope: "tasks.write",
    kind: "write",
    title: "Mark a task on my board",
    description:
      "Presses Done, Let go (remove, with a reason) or Undo on one of the holder's own board tasks, exactly as a tap on the board does, so Sera hears it the same way. Call it first without confirmToken: it writes nothing and answers with what it would do and a confirmToken. Show that to the member, and after their yes call it again with the same arguments and the confirmToken.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "The board task's id, from get_my_moon." },
        action: { type: "string", enum: [...BOARD_ACTIONS] },
        reason: { type: "string", description: "For remove: why the task goes. One of the board's own reasons." },
        note: { type: "string", description: "For remove: an optional note, with no email or phone number in it." },
        confirmToken: { type: "string", description: "From the first call. Leave it out to see what would be written." },
      },
      required: ["taskId", "action"],
      additionalProperties: false,
    },
    routes: ["GET /api/member-tasks/me", "POST /api/member-tasks/me/:id/done", "POST /api/member-tasks/me/:id/remove", "POST /api/member-tasks/me/:id/undo"],
    async run(args, ctx) {
      const taskId = typeof args.taskId === "string" ? args.taskId.slice(0, 64) : "";
      const action = String(args.action ?? "") as BoardAction;
      if (!taskId) return { ok: false, error: "Name the task: taskId, from get_my_moon." };
      if (!(BOARD_ACTIONS as readonly string[]).includes(action)) return { ok: false, error: `action is one of ${BOARD_ACTIONS.join(", ")}.` };
      const reason = action === "remove" && typeof args.reason === "string" ? args.reason.slice(0, 40) : null;
      const note = action === "remove" && typeof args.note === "string" ? args.note.slice(0, 500) : null;

      const board = await ctx.dispatch("GET", "/api/member-tasks/me");
      if (board.status !== 200) return refusal("The task board could not be read", board);
      const task = boardTasks(board.body).find((t) => t.id === taskId);
      if (!task) return { ok: false, error: "That task is not on the holder's board." };
      if (!PRESSES_FROM[action].includes(task.status)) {
        return { ok: false, error: `That task is ${task.status}, so ${action} does not apply to it.` };
      }
      const echo = { taskId: task.id, title: task.title, from: task.status, action, reason, note, version: task.version };

      if (args.confirmToken === undefined) {
        const { token, expiresAt } = ctx.mintConfirm("mark_my_task", echo);
        return {
          ok: true,
          result: {
            confirmRequired: true,
            echo,
            confirmToken: token,
            expiresAt,
            message: "Nothing was written. Show this to the member, and after their yes call mark_my_task again with the same arguments and this confirmToken.",
          },
        };
      }
      const check = ctx.verifyConfirm("mark_my_task", args.confirmToken, echo);
      if (!check.ok) return { ok: false, error: check.sentence, detail: { reason: check.reason } };

      const body: Record<string, unknown> = { version: task.version, context: { surface: "assistant" } };
      if (reason) body.reason = reason;
      if (note) body.note = note;
      const done = await ctx.dispatch("POST", `/api/member-tasks/me/${encodeURIComponent(task.id)}/${action}`, body);
      if (done.status >= 300) return refusal("The board did not take that", done);
      return { ok: true, result: { written: true, echo, board: done.body } };
    },
  },
  {
    name: "hand_task_to_role",
    scope: "tasks.write",
    kind: "write",
    title: "Hand a task to a role",
    description:
      "Hands a new task to one of the village's roles, exactly as the holder does from their profile: it waits on the role's holders (or, while nobody holds it, the circle's lead, then the stewards), who accept it, suggest a change or decline it, and the holder hears each answer. Nothing is accepted on its own. Call it first without confirmToken: it writes nothing and answers with the task, the role's name and a confirmToken. Show that to the member, and after their yes call it again with the same arguments and the confirmToken. Call it with no roleId (a title is not needed then) to see the roles a task can go to.",
    inputSchema: {
      type: "object",
      properties: {
        roleId: { type: "string", description: "The role's id. Call this tool without one to list the roles, or read them with get_roles." },
        title: { type: "string", description: `What the task is, in one line (up to ${HANDOFF_LIMITS.title} characters).` },
        note: { type: "string", description: `Anything the role should know (up to ${HANDOFF_LIMITS.note} characters). Optional, with no email or phone number in it.` },
        dueOn: { type: "string", description: "By when, as YYYY-MM-DD, from the village's today on. Optional." },
        confirmToken: { type: "string", description: "From the first call. Leave it out to see what would be sent." },
      },
      required: ["title"],
      additionalProperties: false,
    },
    routes: ["GET /api/member-tasks/redirect-targets", `POST ${HANDOFFS_URL}`],
    async run(args, ctx) {
      // A member whose own task list is off gets 403 list_off from both routes (memberTaskBridge `member`, roleTaskHandoffs `sender`).
      const listOff = (a: RouteAnswer) => a.status === 403 && (a.body as { error?: unknown } | null)?.error === "list_off";
      if (args.roleId !== undefined && args.roleId !== null && typeof args.roleId !== "string") return { ok: false, error: "roleId is a role's id." };
      const roleId = typeof args.roleId === "string" ? args.roleId.trim() : "";

      // The roles a task can go to, read live: the same list the profile's form offers. People are never read out.
      const targets = await ctx.dispatch("GET", "/api/member-tasks/redirect-targets");
      if (listOff(targets)) return { ok: false, error: `Tasks cannot be handed on from here. ${HANDOFF_REFUSALS.listOff}` };
      if (targets.status !== 200) return refusal("The roles could not be read", targets);
      const roles = (Array.isArray((targets.body as { roles?: unknown })?.roles) ? (targets.body as { roles: unknown[] }).roles : [])
        .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
        .map((r) => ({ id: String(r.id ?? ""), name: String(r.name ?? "") }))
        .filter((r) => r.id);
      if (!roleId) return { ok: false, error: "Name the role: roleId, one of the roles listed here.", detail: { roles } };
      const role = roles.find((r) => r.id === roleId);
      if (!role) return { ok: false, error: "That role is not one a task can go to now. Pick one listed here.", detail: { roles } };

      // The handoff route's own cleaning (parseHandoffWords), so the echo the member says yes to is what is sent.
      const title = cleanLine(args.title, HANDOFF_LIMITS.title + 1);
      if (!title) return { ok: false, error: "Say what the task is: a title." };
      if (title.length > HANDOFF_LIMITS.title) return { ok: false, error: `Keep the title to ${HANDOFF_LIMITS.title} characters.` };
      const note = cleanText(args.note, HANDOFF_LIMITS.note + 1);
      if (note && note.length > HANDOFF_LIMITS.note) return { ok: false, error: `Keep the note to ${HANDOFF_LIMITS.note} characters.` };
      // The shape and a real date here; "from the village's today on" stays with the route, which knows the village's day.
      if (args.dueOn !== undefined && args.dueOn !== null && args.dueOn !== "" && !isDayKey(args.dueOn)) {
        return { ok: false, error: "dueOn is a real day as YYYY-MM-DD." };
      }
      const dueOn = typeof args.dueOn === "string" && args.dueOn ? args.dueOn : null;

      const body = { roleId: role.id, title, note, dueOn };
      const echo = { method: "POST", path: HANDOFFS_URL, role: role.name, body };
      if (args.confirmToken === undefined) {
        const { token, expiresAt } = ctx.mintConfirm("hand_task_to_role", echo);
        return {
          ok: true,
          result: {
            confirmRequired: true,
            echo,
            confirmToken: token,
            expiresAt,
            message: "Nothing was sent. Show this to the member, and after their yes call hand_task_to_role again with the same arguments and this confirmToken.",
          },
        };
      }
      const check = ctx.verifyConfirm("hand_task_to_role", args.confirmToken, echo);
      if (!check.ok) return { ok: false, error: check.sentence, detail: { reason: check.reason } };
      // The route checks the role is live, the day is from today on, and its hourly limit, as it does for the form.
      const a = await ctx.dispatch("POST", HANDOFFS_URL, body);
      if (listOff(a)) return { ok: false, error: `The task was not handed on. ${HANDOFF_REFUSALS.listOff}` };
      if (a.status >= 300) return refusal("The task was not handed on", a);
      return { ok: true, result: { written: true, echo, id: (a.body as { id?: unknown } | null)?.id ?? null } };
    },
  },
  {
    name: "add_agenda_item",
    scope: "sessions.write",
    kind: "write",
    title: "Add an agenda item",
    description:
      "Adds an item to the agenda library, for one circle or for none in particular, exactly as the holder adding it on the sessions page does: it waits there until somebody brings it into a session. Call it first without confirmToken: it writes nothing and answers with what it would add and a confirmToken. Show that to the member, and after their yes call it again with the same arguments and the confirmToken.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: `What the item is, in one line (up to ${LIBRARY_LIMITS.title} characters).` },
        circleId: { type: "string", description: "The circle whose sessions it is for, from get_roles. Leave it out for no circle in particular." },
        aim: { type: "string", enum: [...ITEM_AIMS], description: "What the room does with it: report, explore or decide. Optional." },
        note: { type: "string", description: "Anything the room should read first. Optional, with no email or phone number in it." },
        confirmToken: { type: "string", description: "From the first call. Leave it out to see what would be added." },
      },
      required: ["title"],
      additionalProperties: false,
    },
    routes: [`POST ${LIBRARY_API}`],
    async run(args, ctx) {
      // The library route's own cleaning (cleanBrought), so the echo the member says yes to is what is stored.
      const title = cleanLine(args.title, LIBRARY_LIMITS.title + 1);
      if (!title) return { ok: false, error: "Give the item a title." };
      if (title.length > LIBRARY_LIMITS.title) return { ok: false, error: `Keep the title to ${LIBRARY_LIMITS.title} characters.` };
      const note = cleanText(args.note, LIBRARY_LIMITS.note + 1);
      if (note && note.length > LIBRARY_LIMITS.note) return { ok: false, error: `Keep the note to ${LIBRARY_LIMITS.note} characters.` };
      if (args.aim !== undefined && args.aim !== null && typeof args.aim !== "string") return { ok: false, error: `aim is one of ${ITEM_AIMS.join(", ")}.` };
      const aim = typeof args.aim === "string" && args.aim ? args.aim : null;
      if (aim && !(ITEM_AIMS as readonly string[]).includes(aim)) return { ok: false, error: `aim is one of ${ITEM_AIMS.join(", ")}.` };
      if (args.circleId !== undefined && args.circleId !== null && typeof args.circleId !== "string") return { ok: false, error: "circleId is a circle's id, from get_roles." };
      const circleId = typeof args.circleId === "string" && args.circleId.trim() ? args.circleId.trim() : null;
      if (circleId && circleId.length > 64) return { ok: false, error: "That is not a circle's id: take it from get_roles." };
      const body = { title, aim, note, circleId };
      const echo = { method: "POST", path: LIBRARY_API, body };
      if (args.confirmToken === undefined) {
        const { token, expiresAt } = ctx.mintConfirm("add_agenda_item", echo);
        return {
          ok: true,
          result: {
            confirmRequired: true,
            echo,
            confirmToken: token,
            expiresAt,
            message: "Nothing was added. Show this to the member, and after their yes call add_agenda_item again with the same arguments and this confirmToken.",
          },
        };
      }
      const check = ctx.verifyConfirm("add_agenda_item", args.confirmToken, echo);
      if (!check.ok) return { ok: false, error: check.sentence, detail: { reason: check.reason } };
      // The library's own route checks the circle and every limit again, as it does for a tap on the page.
      const a = await ctx.dispatch("POST", LIBRARY_API, body);
      if (a.status === 404) return { ok: false, error: "The agenda library is not open here: the sessions module is off in this village." };
      if (a.status >= 300) return refusal("The agenda library did not take that", a);
      return { ok: true, result: { written: true, echo, answer: a.body } };
    },
  },
  {
    // The lead, 20 Nov 2026: the sibling of add_agenda_item, through the member door, whose own check decides.
    name: "withdraw_agenda_item",
    scope: "sessions.write",
    kind: "write",
    destructive: true,
    title: "Withdraw agenda items",
    description:
      `Withdraws items from the agenda library, exactly as the holder pressing Withdraw on the sessions page does, so it withdraws only what the holder may withdraw. Name one id or several, up to ${WITHDRAW_MAX}, from GET /api/sessions (library.items). Call it first without confirmToken: it writes nothing and answers with the titles it would withdraw, and which it may not, and a confirmToken. Show that to the member, and after their yes call it again with the same ids and the confirmToken.`,
    inputSchema: {
      type: "object",
      properties: {
        itemIds: { type: "array", maxItems: WITHDRAW_MAX, items: { type: ["number", "string"] }, description: "The agenda items' ids, from library.items." },
        itemId: { type: ["number", "string"], description: "One item's id, when there is only one." },
        confirmToken: { type: "string", description: "From the first call. Leave it out to see what would be withdrawn." },
      },
      additionalProperties: false,
    },
    routes: ["GET /api/sessions", `DELETE ${LIBRARY_API}/:itemId`],
    async run(args, ctx) {
      const raw = [...(Array.isArray(args.itemIds) ? args.itemIds : []), ...(args.itemId !== undefined && args.itemId !== null ? [args.itemId] : [])];
      const ids = Array.from(new Set(raw.map((x) => (typeof x === "number" ? x : typeof x === "string" && /^\d{1,12}$/.test(x.trim()) ? Number(x.trim()) : NaN)))).filter((n) => Number.isSafeInteger(n) && n > 0);
      if (raw.length && ids.length !== new Set(raw.map(String)).size) return { ok: false, error: "Each id is an agenda item's number, from library.items." };
      if (!ids.length) return { ok: false, error: "Name the items: itemIds, from library.items on GET /api/sessions." };
      if (ids.length > WITHDRAW_MAX) return { ok: false, error: `Up to ${WITHDRAW_MAX} items at once.` };
      ids.sort((x, y) => x - y);
      // What the holder sees, read fresh at both calls, so the token covers exactly the titles the member said yes to.
      const list = await ctx.dispatch("GET", "/api/sessions");
      if (list.status === 404) return { ok: false, error: "The agenda library is not open here: the sessions module is off in this village." };
      if (list.status !== 200) return refusal("The agenda library could not be read", list);
      const cards = (((list.body as { library?: { items?: unknown[] } } | null)?.library?.items ?? []) as unknown[])
        .filter((c): c is Record<string, unknown> => !!c && typeof c === "object");
      const items = ids.map((id) => {
        const c = cards.find((x) => Number(x.id) === id);
        return { id, title: c ? String(c.title ?? "") : null, canWithdraw: !!c && c.canWithdraw === true };
      });
      const going = items.filter((i) => i.canWithdraw).map((i) => ({ id: i.id, title: i.title }));
      const refused = items.filter((i) => !i.canWithdraw).map((i) => ({ id: i.id, title: i.title, why: i.title === null ? "not one the holder can see" : "not one the holder may withdraw" }));
      if (!going.length) return { ok: false, error: "None of these is an item the holder may withdraw, so nothing would be withdrawn.", detail: { refused } };
      const echo = { method: "DELETE", withdraw: going };
      if (args.confirmToken === undefined) {
        const { token, expiresAt } = ctx.mintConfirm("withdraw_agenda_item", echo);
        return {
          ok: true,
          result: {
            confirmRequired: true,
            echo,
            refused,
            confirmToken: token,
            expiresAt,
            message: "Nothing was withdrawn. Show the member these titles, and after their yes call withdraw_agenda_item again with the same ids and this confirmToken.",
          },
        };
      }
      const check = ctx.verifyConfirm("withdraw_agenda_item", args.confirmToken, echo);
      if (!check.ok) return { ok: false, error: check.sentence, detail: { reason: check.reason } };
      // Each through the member door, one by one: the library's own check answers for each, as it does for a tap.
      const results: Array<{ id: number; title: string | null; withdrawn: boolean; error?: string }> = [];
      for (const g of going) {
        const a = await ctx.dispatch("DELETE", libraryItemUrl(g.id));
        if (a.status < 300) results.push({ id: g.id, title: g.title, withdrawn: true });
        else {
          const why = refusal("The agenda library did not take that", a);
          results.push({ id: g.id, title: g.title, withdrawn: false, error: why.ok ? "" : why.error });
        }
      }
      const n = results.filter((r) => r.withdrawn).length;
      if (!n) return { ok: false, error: "Nothing was withdrawn.", detail: { results } };
      return { ok: true, result: { written: true, echo, withdrawn: n, results } };
    },
  },
  {
    name: "import_moon_pack",
    scope: "moon.write",
    kind: "write",
    title: "Import a moon pack",
    description:
      "Imports a moon pack (the strict JSON shape the guide gives, never with amounts) into the member's Draft recap. The first call writes nothing and answers the preview: what would be added, merged and skipped, with a confirmToken. After the member's yes, call again with the same pack and the token.",
    inputSchema: {
      type: "object",
      properties: { cycleId: { type: "string" }, pack: { type: "object" }, confirmToken: { type: "string" } },
      required: ["cycleId", "pack"],
      additionalProperties: false,
    },
    routes: [`POST ${MOON_ROUTES.importPack}`],
    async run(args, ctx) {
      const cycle = typeof args.cycleId === "string" ? args.cycleId.slice(0, 32) : "";
      if (!cycle) return { ok: false, error: "Name the moon: cycleId." };
      const path = fill(MOON_ROUTES.importPack, { cycle });
      // The preview is read fresh on both calls, so a token binds exactly what would be written now.
      const preview = await ctx.dispatch("POST", path, { pack: args.pack });
      if (preview.status === 404) return { ok: false, error: NOT_OPEN };
      if (preview.status >= 300) return refusal("The pack was refused", preview);
      const p = (preview.body && typeof preview.body === "object" ? preview.body : {}) as Record<string, unknown>;
      const echo = { cycle, previewHash: p.previewHash ?? null, preview: p.preview ?? null };
      if (args.confirmToken === undefined) {
        const { token, expiresAt } = ctx.mintConfirm("import_moon_pack", echo);
        return { ok: true, result: { confirmRequired: true, echo, confirmToken: token, expiresAt, message: "Nothing was written. Show the member what would be added, merged and skipped, and after their yes call import_moon_pack again with the same pack and this confirmToken." } };
      }
      const check = ctx.verifyConfirm("import_moon_pack", args.confirmToken, echo);
      if (!check.ok) return { ok: false, error: check.sentence, detail: { reason: check.reason } };
      const done = await ctx.dispatch("POST", path, { pack: args.pack, confirm: true, previewHash: p.previewHash });
      if (done.status >= 300) return refusal("The import did not go through", done);
      return { ok: true, result: { written: true, answer: done.body } };
    },
  },
  {
    name: "update_moon_item",
    scope: "moon.write",
    kind: "write",
    title: "Change an item on my moon",
    description: "Changes one item on the member's Draft recap: its words, its state (kept or dropped), its status, its role or its proof. Two calls, like every write here.",
    inputSchema: {
      type: "object",
      properties: { itemId: { type: "string" }, fields: { type: "object", description: "The fields to change, as the My moon page sends them." }, confirmToken: { type: "string" } },
      required: ["itemId", "fields"],
      additionalProperties: false,
    },
    routes: [`PATCH ${MOON_ROUTES.editItem}`],
    async run(args, ctx) {
      const id = typeof args.itemId === "string" ? args.itemId.slice(0, 64) : "";
      const fields = args.fields && typeof args.fields === "object" && !Array.isArray(args.fields) ? (args.fields as Record<string, unknown>) : null;
      if (!id || !fields) return { ok: false, error: "Name the item (itemId) and what changes (fields)." };
      return twoCallWrite("update_moon_item", args, ctx, "PATCH", fill(MOON_ROUTES.editItem, { id }), fields);
    },
  },
  {
    name: "set_moon_goals",
    scope: "moon.write",
    kind: "write",
    title: "Set my goals for next moon",
    description: "Sets the member's goals for the next moon on their recap. Two calls, like every write here.",
    inputSchema: {
      type: "object",
      properties: {
        cycleId: { type: "string" },
        goals: { type: "array", items: { type: "object", properties: { text: { type: "string" }, carriedFromId: { type: "string" } }, required: ["text"] } },
        confirmToken: { type: "string" },
      },
      required: ["cycleId", "goals"],
      additionalProperties: false,
    },
    routes: [`PUT ${MOON_ROUTES.nextGoals}`],
    async run(args, ctx) {
      const cycle = typeof args.cycleId === "string" ? args.cycleId.slice(0, 32) : "";
      if (!cycle || !Array.isArray(args.goals)) return { ok: false, error: "Name the moon (cycleId) and the goals." };
      return twoCallWrite("set_moon_goals", args, ctx, "PUT", fill(MOON_ROUTES.nextGoals, { cycle }), { goals: args.goals });
    },
  },
  {
    name: "get_review_queue",
    scope: "moon.review",
    kind: "read",
    title: "The review queue",
    description: "For a member who reviews recaps: the moon's queue, always without amounts, pay routes, legal names or addresses, whoever asks. Read only.",
    inputSchema: { type: "object", properties: { cycleId: { type: "string" } }, additionalProperties: false },
    routes: [`GET ${MOON_ROUTES.queue}`],
    async run(args, ctx) {
      const cycle = typeof args.cycleId === "string" ? args.cycleId.slice(0, 32) : "";
      const a = await ctx.dispatch("GET", `${MOON_ROUTES.queue}${cycle ? `?cycle=${encodeURIComponent(cycle)}` : ""}`);
      if (a.status === 404) return { ok: false, error: NOT_OPEN };
      return a.status === 200 ? { ok: true, result: a.body } : refusal("The queue could not be read", a);
    },
  },
  {
    name: "get_seat_signals",
    scope: "moon.review",
    kind: "read",
    title: "Role signals",
    description: "For a member who reviews recaps: which empty roles members keep covering, ready to bring to the circle. Read only.",
    inputSchema: { type: "object", properties: { cycleId: { type: "string" } }, additionalProperties: false },
    routes: ["GET /api/moon-review/signals"],
    async run(args, ctx) {
      const cycle = typeof args.cycleId === "string" ? args.cycleId.slice(0, 32) : "";
      const a = await ctx.dispatch("GET", `/api/moon-review/signals${cycle ? `?cycle=${encodeURIComponent(cycle)}` : ""}`);
      if (a.status === 404) return { ok: false, error: NOT_OPEN };
      return a.status === 200 ? { ok: true, result: a.body } : refusal("The signals could not be read", a);
    },
  },
  {
    name: "admin_request",
    scope: "admin",
    kind: "write",
    title: "Call an admin path",
    description:
      "Calls one admin path the village has opened to agents, as the holder, with the holder's own admin checks. GET answers at once. A write answers first with what it would do and a confirmToken; call again with the same arguments and the token to make it. Some writes a person makes in the app, and the answer says so. Every write also carries summary, the first argument: one plain sentence a non-technical person can read in the permission box, naming the people and roles by name, with no ids and no jargon, such as: Remove the duplicate record of Ana on the Gardener role. She keeps the role. A client that connected before summary existed, whose tool list has no summary argument, puts the same sentence in body.summary; it is taken out before the route sees the body, and summary wins when both are there. The sentence is shown to the person with the platform's own line on what the call does, and kept in the audit. A role card, org draft, wording or seating write carries approvedBy and approvalNote in its body: who approved it and their approval in this chat, quoted; it is kept in the village's audit and its organisational memory. Erasure, powers, money, secrets and the agent accounts are never reachable here. Always open to read: GET /api/sessions (each circle's coming meeting, its rhythms by key under comingUp.rows[].rhythms, and the waiting agenda items under library.items) and GET /api/sessions/circles/{circleId}/summary. To put items on a meeting's agenda, use propose_changes with kind session_agenda.",
    inputSchema: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description:
            "Required for any write, optional for a read. One plain sentence a non-technical person understands, naming people and roles by name, with no ids and no jargon. Example: Remove the duplicate record of Ana on the Gardener role. She keeps the role.",
        },
        method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] },
        path: { type: "string", description: "The admin path, such as /api/admin/member-tasks/access. No query string." },
        body: { type: "object", description: "The JSON body for a write." },
        confirmToken: { type: "string", description: "From the first call of a write. Leave it out to see what would be written." },
      },
      required: ["method", "path"],
      additionalProperties: false,
    },
    // The routes this tool may reach are the village's list, not this table. "Always a person" is in shared/agentAdmin.ts.
    routes: [],
    destructive: true,
    writes: (args) => String(args.method ?? "").toUpperCase() !== "GET",
    async run(args, ctx) {
      if (!ctx.adminPaths || !ctx.recordAction) return { ok: false, error: "The admin tool is not open on this server." };
      const method = String(args.method ?? "").toUpperCase();
      const path = typeof args.path === "string" ? args.path : "";
      const rawBody = args.body && typeof args.body === "object" && !Array.isArray(args.body) ? (args.body as Record<string, unknown>) : undefined;
      // A client that connected before `summary` existed holds a cached schema that refuses the argument, so the
      // sentence may ride in body.summary instead. It is read and taken out of the body the same way at both calls,
      // so the echo the confirm token covers is stable, and it never reaches the route. The top-level one wins.
      const { summary: bodySummary, ...bodyRest } = rawBody ?? {};
      const body = rawBody ? bodyRest : undefined;
      const plain = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 400) : "");
      const summary = plain(args.summary) || plain(bodySummary);
      // The summary is the caller's words to the person, never the route's input. It rides in the echo so the
      // sentence the person read at the preview is the one the confirmToken covers.
      const echo = summary ? { summary, method, path, body: body ?? null } : { method, path, body: body ?? null };
      const hash = echoHash(echo);
      const record = (state: "done" | "refused" | "asked") =>
        ctx.recordAction!({ scope: "admin", tool: "admin_request", method: method.slice(0, 8) || null, path: path.slice(0, 500) || null, echoHash: hash, state });

      const leadOn = ctx.leadApproved ? await ctx.leadApproved.on() : false;
      // The full-access switch (the lead, 20 Nov 2026): read at every call, so it ends when the holder's seat does.
      const fullOn = ctx.fullAccess ? await ctx.fullAccess.on() : false;
      const decision = fullAccessDecision(method, path, await ctx.adminPaths(), ctx.holderId ?? null, {
        applicantDataOpen: ctx.applicantDataOpen ? await ctx.applicantDataOpen() : false,
        leadApprovedWrites: leadOn,
        fullAccess: fullOn,
      });
      if (!decision.ok) {
        await record("refused");
        return { ok: false, error: decision.words, detail: { code: decision.code } };
      }
      const full = decision.fullAccess === true;
      // A lead-approved write (the lead's ruling, 10 and 11 Nov 2026): the body is checked at both calls, and a
      // seat's facts are read fresh each time, so a seat that gained a veto between the two calls is refused.
      const lead = decision.leadApproved ?? null;
      let seatRoleId: string | null = null;
      if (lead) {
        const target = leadSeatTarget(lead, path);
        const seat = target && ctx.leadApproved ? await ctx.leadApproved.seat(target) : null;
        seatRoleId = seat?.roleId ?? (target && "roleId" in target ? target.roleId : null);
        // A role's power groups are read through the route's own GET, as the holder, at both calls.
        const seatPower = lead === "seat_power" ? await readSeatPower(ctx, path) : null;
        if (lead === "seat_power") seatRoleId = path.split("/")[4] ?? null;
        // Every write the switch made possible carries the approval; the role editor with the switch off is as before.
        const problem = leadApprovedBodyProblem(lead, path, body, { holderId: ctx.holderId ?? null, seat, seatPower, approvalRequired: leadOn || full || lead !== "role_edit" });
        if (problem) {
          await record("refused");
          return { ok: false, error: problem, detail: { code: "lead_approved_refused" } };
        }
      }
      // A full-access write carries the approval, and its body never names a power an agent may not hand out.
      if (full && decision.write) {
        const approval = readLeadApproval(body);
        const problem = approval.ok ? fullAccessBodyProblem(withoutApproval(body)) : approval.words;
        if (problem) {
          await record("refused");
          return { ok: false, error: problem, detail: { code: "full_access_refused" } };
        }
      }
      if (!decision.write) {
        const a = await ctx.dispatch("GET", path);
        await record(a.status < 300 ? "done" : "refused");
        // The shipped reads of powers, and every full-access read, come back without contact data.
        const answer = full || isShippedAgentRead("GET", path) ? stripContactData(a.body) : a.body;
        return a.status < 300 ? { ok: true, result: answer } : refusal("The admin path refused", a);
      }
      if (decision.confirm === "person") {
        await record("refused");
        return {
          ok: false,
          error: `A person makes this change in the app: ${decision.entry.label}. Tell them what you would change, and they press it there.`,
          detail: { code: "person_confirms", echo },
        };
      }
      if (summary.length < 8) {
        await record("refused");
        return { ok: false, error: "Say what this does in one plain sentence, naming the people and roles, in summary or, if your connector has no summary argument yet, in body.summary. The person sees it before they approve.", detail: { code: "summary_required" } };
      }
      // What the platform itself says the call does, where it has a line for it, so the person reads both.
      const platformSays = lead ? leadApprovalSubject(lead, path, body, seatRoleId).what : full ? "A change made with the operations role's full access" : null;
      if (args.confirmToken === undefined) {
        const { token, expiresAt } = ctx.mintConfirm("admin_request", echo);
        await record("asked");
        return {
          ok: true,
          result: {
            confirmRequired: true,
            summary,
            ...(platformSays ? { platformSays } : {}),
            echo,
            confirmToken: token,
            expiresAt,
            message: `${summary}${platformSays ? ` The platform describes it as: ${platformSays}.` : ""} Nothing was written. Call admin_request again with the same arguments and this confirmToken to make it.`,
          },
        };
      }
      const check = ctx.verifyConfirm("admin_request", args.confirmToken, echo);
      if (!check.ok) {
        await record("refused");
        return { ok: false, error: check.sentence, detail: { reason: check.reason } };
      }
      // RECORDED BEFORE IT IS WRITTEN (audit, 15 Nov 2026): keyed on the spent confirm token, so one write is one key
      // and a retried record is a no-op. A record that cannot be stored stops the write: nothing is dispatched.
      let approvalRecord: LeadApprovalRecordInput | null = null;
      if (lead && ctx.leadApproved) {
        const approval = readLeadApproval(body);
        if (approval.ok) {
          approvalRecord = {
            kind: lead,
            roleId: seatRoleId,
            path,
            method,
            subject: leadApprovalSubject(lead, path, body, seatRoleId),
            approvedBy: approval.approvedBy,
            approvalNote: approval.approvalNote,
            summary,
            writeKey: echoHash({ token: String(args.confirmToken) }).slice(0, 24),
          };
          try {
            await ctx.leadApproved.recorded(approvalRecord);
          } catch (err) {
            console.error("[agent-mcp] the approval record failed, so the write was not made", err);
            await record("refused");
            return { ok: false, error: "The record of this change could not be kept, so nothing was written. Try again in a moment.", detail: { code: "record_failed" } };
          }
        }
      }
      // A full-access write the lead-approved record did not already cover is audited with its note, before it is made.
      if (full && !approvalRecord) {
        const approval = readLeadApproval(body);
        try {
          if (!approval.ok || !ctx.fullAccess) throw new Error("no approval to record");
          await ctx.fullAccess.recorded({ method, path, summary, approvedBy: approval.approvedBy, approvalNote: approval.approvalNote });
        } catch (err) {
          console.error("[agent-mcp] the full-access record failed, so the write was not made", err);
          await record("refused");
          return { ok: false, error: "The record of this change could not be kept, so nothing was written. Try again in a moment.", detail: { code: "record_failed" } };
        }
      }
      // The approval is the connector's record, never the route's input: it is taken out before the route sees the body.
      const a = await ctx.dispatch(method as "POST" | "PUT" | "PATCH" | "DELETE", path, lead || full ? withoutApproval(body) : body ?? {});
      await record(a.status < 300 ? "done" : "refused");
      if (approvalRecord && ctx.leadApproved) await ctx.leadApproved.settled(approvalRecord, a.status < 300 ? "written" : "refused").catch(() => undefined);
      if (a.status >= 300) return refusal("The admin path refused", a);
      return { ok: true, result: { written: true, echo, answer: a.body } };
    },
  },
  ...TIER_B_TOOLS,
  ...INBOX_TOOLS,
  ...PROPOSAL_TOOLS,
  ...SERA_TOOL_DEFS.map((d): ToolDef => ({
    name: d.name,
    scope: "sera.undoable",
    kind: "write",
    title: d.title,
    description: d.description,
    inputSchema: d.inputSchema,
    routes: [],
    writesAtOnce: true,
    destructive: d.name === "set_board_access",
    async run(args, ctx) {
      if (!ctx.sera) return { ok: false, error: "Sera's tools are not open on this server." };
      const out = await ctx.sera.run(d.name, args);
      return out.ok ? { ok: true, result: out.result } : { ok: false, error: out.error };
    },
  })),
  {
    name: "undo_sera_action",
    scope: "sera.undoable",
    kind: "write",
    writesAtOnce: true,
    destructive: true,
    title: "Undo one of Sera's actions",
    description: "Puts back one action this agent took, within 30 days, while nobody has touched what it wrote since. Answers why when it cannot.",
    inputSchema: { type: "object", properties: { actionId: { type: "string" } }, required: ["actionId"], additionalProperties: false },
    routes: [],
    async run(args, ctx) {
      if (!ctx.sera) return { ok: false, error: "Sera's tools are not open on this server." };
      const id = typeof args.actionId === "string" ? args.actionId.slice(0, 64) : "";
      if (!id) return { ok: false, error: "Name the action: actionId." };
      const out = await ctx.sera.undo(id);
      return out.ok ? { ok: true, result: { written: true, undone: true, actionId: id } } : { ok: false, error: out.error };
    },
  },
];

/** The tools a token with these scopes may list and call. */
export function toolsFor(scopes: readonly AgentScope[]): ToolDef[] {
  return MCP_TOOLS.filter((t) => scopes.includes(t.scope));
}

/** Whether this JSON-RPC message calls a write tool, for the rate bucket. */
export function callsWriteTool(message: unknown): boolean {
  const m = (message && typeof message === "object" ? message : {}) as Record<string, any>;
  if (m.method !== "tools/call") return false;
  const name = String(m.params?.name ?? "");
  const tool = MCP_TOOLS.find((t) => t.name === name);
  if (!tool || tool.kind !== "write") return false;
  const args = (m.params?.arguments && typeof m.params.arguments === "object" ? m.params.arguments : {}) as Record<string, unknown>;
  return tool.writes ? tool.writes(args) : true;
}

// ── The protocol ─────────────────────────────────────────────────────────────

export interface McpServerInfo {
  /** The village's own name, from its brand setting. Never written in code. */
  name: string;
  version: string;
}

export interface McpCall {
  scopes: readonly AgentScope[];
  info: McpServerInfo;
  ctx: ToolContext;
  /** Told once per tools/call, after the tool ran, for the audit line. */
  onToolCall?: (tool: ToolDef, outcome: ToolOutcome, args: Record<string, unknown>) => Promise<void> | void;
}

/** One JSON-RPC answer, or null for a notification, which takes no answer. */
export type McpReply = { jsonrpc: "2.0"; id: string | number | null; result?: unknown; error?: { code: number; message: string; data?: unknown } } | null;

const rpcError = (id: string | number | null, code: number, message: string, data?: unknown): McpReply => ({
  jsonrpc: "2.0",
  id,
  error: data === undefined ? { code, message } : { code, message, data },
});

const INSTRUCTIONS =
  "This connector reads the member's own moon, roles and task board, and presses their own board for them. Every write asks first: call it without confirmToken, show the member what it would do, and call again with the token after their yes. It never sends money or recaps, approves, issues or pays anything, and it never shows an amount or a pay route.";

/** Answer one JSON-RPC message. Never throws: a tool's failure is a result with isError. */
export async function handleMcpMessage(message: unknown, call: McpCall): Promise<McpReply> {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return rpcError(null, RPC.invalidRequest, "Send one JSON-RPC 2.0 message per request.");
  }
  const m = message as Record<string, any>;
  const isNotification = !("id" in m);
  const id: string | number | null = typeof m.id === "string" || typeof m.id === "number" ? m.id : null;
  if (m.jsonrpc !== "2.0" || typeof m.method !== "string") {
    return isNotification ? null : rpcError(id, RPC.invalidRequest, "Send a JSON-RPC 2.0 request with a method.");
  }
  if (isNotification) return null;
  const params = (m.params && typeof m.params === "object" ? m.params : {}) as Record<string, any>;

  switch (m.method) {
    case "initialize": {
      const asked = String(params.protocolVersion ?? "");
      const protocolVersion = (MCP_PROTOCOL_VERSIONS as readonly string[]).includes(asked) ? asked : MCP_PROTOCOL_VERSIONS[0];
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: call.info.name, version: call.info.version },
          instructions: INSTRUCTIONS,
        },
      };
    }
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };
    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: toolsFor(call.scopes).map((t) => ({
            name: t.name,
            title: t.title,
            description: t.description,
            inputSchema: t.inputSchema,
            annotations: { readOnlyHint: t.kind === "read", destructiveHint: t.kind === "write" && !!t.destructive, idempotentHint: t.kind === "read", openWorldHint: false },
          })),
        },
      };
    case "tools/call": {
      const name = String(params.name ?? "");
      const tool = MCP_TOOLS.find((t) => t.name === name);
      if (!tool) return rpcError(id, RPC.invalidParams, `There is no tool called ${name.slice(0, 60)}.`);
      if (!call.scopes.includes(tool.scope)) {
        return rpcError(id, RPC.invalidParams, `This token was not given the ${tool.scope} scope, so ${tool.name} is closed to it.`);
      }
      const args = (params.arguments && typeof params.arguments === "object" && !Array.isArray(params.arguments) ? params.arguments : {}) as Record<string, unknown>;
      let outcome: ToolOutcome;
      try {
        outcome = await tool.run(args, call.ctx);
      } catch (e) {
        outcome = { ok: false, error: "The tool could not finish. Nothing more was written." };
        console.warn(`[agent-mcp] ${tool.name} threw`, (e as Error)?.message);
      }
      if (call.onToolCall) {
        try {
          await call.onToolCall(tool, outcome, args);
        } catch (e) {
          console.warn("[agent-mcp] could not record the call", (e as Error)?.message);
        }
      }
      const payload = redactToolResult(outcome.ok ? outcome.result : { error: outcome.error, ...(outcome.detail === undefined ? {} : { detail: outcome.detail }) });
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify(payload) }],
          structuredContent: payload && typeof payload === "object" && !Array.isArray(payload) ? payload : { value: payload },
          isError: !outcome.ok,
        },
      };
    }
    default:
      return rpcError(id, RPC.methodNotFound, `This server does not answer ${String(m.method).slice(0, 60)}.`);
  }
}
