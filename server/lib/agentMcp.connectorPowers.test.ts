/**
 * THE CONNECTOR POWERS OF 20 NOVEMBER 2026, through the tool table, against a fake holder's routes.
 *
 *   withdraw   withdraw_agenda_item lists the titles first and withdraws on the confirm, through the member door;
 *              an item the holder may not withdraw is refused, and a refusal from the door is passed on
 *   reads      the two shipped reads pass without the list and come back without contact data
 *   seat       seat_power reads the role's groups through its own GET, as the holder, and refuses a removal
 *   full       admin_request with full access: an unlisted admin write in two calls, carrying the approval,
 *              audited BEFORE it is dispatched and never without it; the floor refused; off is as before
 *   accept     accept_proposals refuses without full access, lists every change first, and needs a note that
 *              names the batch code or every change's code before it sends anything
 */
import { describe, expect, it } from "vitest";
import { handleMcpMessage, MCP_TOOLS, toolsFor, WITHDRAW_MAX, type RouteAnswer, type ToolContext } from "./agentMcp";
import { CONFIRM_REASON_SENTENCE, createConfirmSpendBook, mintConfirmToken, verifyConfirmToken, type AgentScope } from "./agentTokens";
import { DEFAULT_AGENT_ADMIN_PATHS, type AgentAdminPathsDoc } from "../../shared/agentAdmin";
import { ACCEPT_AS_HOLDER_PATH } from "./agentMcpProposals";

const SECRET = "test-secret-for-connector-powers"; // module-review-ok: a throwaway confirm-token key; every route here is a stand-in
const info = { name: "Example Village", version: "1.3.0" };
const rpc = (name: string, args: Record<string, unknown>) => ({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } });
const ask = (name: string, args: Record<string, unknown>, scopes: AgentScope[], ctx: ToolContext) => handleMcpMessage(rpc(name, args), { scopes, info, ctx }) as Promise<any>;
const out = (r: any) => r.result.structuredContent;

type Route = (method: string, path: string, body?: any) => RouteAnswer | undefined;

/** A holder whose routes are `route`, with real confirm tokens spent once, and the connector's ports recorded. */
function holder(route: Route, opts: { full?: boolean; recordFails?: boolean; doc?: AgentAdminPathsDoc; lead?: boolean } = {}) {
  const calls: Array<{ method: string; path: string; body?: any }> = [];
  const audits: Array<Record<string, unknown>> = [];
  const order: string[] = [];
  const spend = createConfirmSpendBook();
  const ctx: ToolContext = {
    dispatch: async (method, path, body) => {
      calls.push({ method, path, body });
      order.push(`dispatch ${method} ${path}`);
      return route(method, path, body) ?? { status: 404, body: { error: "Not found" } };
    },
    mintConfirm: (tool, echo) => mintConfirmToken(SECRET, { action: `mcp:${tool}`, userId: "u-ops", echo }),
    verifyConfirm: (tool, token, echo) => {
      const c = verifyConfirmToken(SECRET, token, { action: `mcp:${tool}`, userId: "u-ops", echo });
      if (!c.ok) return { ok: false, reason: c.reason, sentence: CONFIRM_REASON_SENTENCE[c.reason] };
      return spend.spend(String(token)) ? { ok: true } : { ok: false, reason: "spent", sentence: CONFIRM_REASON_SENTENCE.spent };
    },
    holderId: "u-ops",
    adminPaths: async () => opts.doc ?? DEFAULT_AGENT_ADMIN_PATHS,
    applicantDataOpen: async () => false,
    recordAction: async () => undefined,
    leadApproved: {
      on: async () => opts.lead === true,
      seat: async () => null,
      recorded: async () => undefined,
      settled: async () => undefined,
    },
    fullAccess: {
      on: async () => opts.full === true,
      recorded: async (a) => {
        order.push("audit");
        if (opts.recordFails) throw new Error("the events table is down");
        audits.push(a);
      },
    },
  };
  return { ctx, calls, audits, order };
}

// ── withdraw_agenda_item ─────────────────────────────────────────────────────

describe("withdraw_agenda_item (sessions.write)", () => {
  const items = [
    { id: 11, title: "Budget for the lead roles", canWithdraw: true },
    { id: 12, title: "Someone else's item", canWithdraw: false },
    { id: 13, title: "Rename the garden circle", canWithdraw: true },
  ];
  const library = (deleteAnswer: (id: string) => RouteAnswer = () => ({ status: 200, body: { ok: true } })) =>
    holder((method, path) => {
      if (method === "GET" && path === "/api/sessions") return { status: 200, body: { library: { items, myCircleIds: [] } } };
      const m = /^\/api\/sessions\/library\/(\d+)$/.exec(path);
      if (method === "DELETE" && m) return deleteAnswer(m[1]!);
      return undefined;
    });

  it("is opened by sessions.write only", () => {
    expect(toolsFor(["sessions.write"]).map((t) => t.name)).toContain("withdraw_agenda_item");
    for (const s of ["moon.read", "tasks.write", "admin", "sera.undoable"] as AgentScope[]) expect(toolsFor([s]).map((t) => t.name)).not.toContain("withdraw_agenda_item");
    expect(MCP_TOOLS.find((t) => t.name === "withdraw_agenda_item")?.routes).toEqual(["GET /api/sessions", "DELETE /api/sessions/library/:itemId"]);
  });

  it("lists the titles first and withdraws nothing, then withdraws exactly those through the member door on the confirm", async () => {
    const l = library();
    const first = out(await ask("withdraw_agenda_item", { itemIds: [13, "11"] }, ["sessions.write"], l.ctx));
    expect(first.confirmRequired).toBe(true);
    expect(first.echo.withdraw).toEqual([{ id: 11, title: "Budget for the lead roles" }, { id: 13, title: "Rename the garden circle" }]);
    expect(l.calls.some((c) => c.method === "DELETE")).toBe(false);
    const second = await ask("withdraw_agenda_item", { itemIds: [11, 13], confirmToken: first.confirmToken }, ["sessions.write"], l.ctx);
    expect(second.result.isError).toBe(false);
    expect(out(second).withdrawn).toBe(2);
    expect(l.calls.filter((c) => c.method === "DELETE").map((c) => c.path)).toEqual(["/api/sessions/library/11", "/api/sessions/library/13"]);
    // The token works once.
    const again = await ask("withdraw_agenda_item", { itemIds: [11, 13], confirmToken: first.confirmToken }, ["sessions.write"], l.ctx);
    expect(again.result.isError).toBe(true);
  });

  it("refuses an item the holder may not withdraw, and calls no door for it", async () => {
    const l = library();
    const only = await ask("withdraw_agenda_item", { itemId: 12 }, ["sessions.write"], l.ctx);
    expect(only.result.isError).toBe(true);
    expect(out(only).detail.refused).toEqual([{ id: 12, title: "Someone else's item", why: "not one the holder may withdraw" }]);
    const mixed = out(await ask("withdraw_agenda_item", { itemIds: [11, 12, 99] }, ["sessions.write"], l.ctx));
    expect(mixed.echo.withdraw.map((i: any) => i.id)).toEqual([11]);
    expect(mixed.refused.map((i: any) => i.id)).toEqual([12, 99]);
    expect(l.calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("passes the door's own refusal on, per item, when the item changed between the calls", async () => {
    const l = library((id) => (id === "13" ? { status: 403, body: { error: "You can only withdraw an item you brought." } } : { status: 200, body: { ok: true } }));
    const first = out(await ask("withdraw_agenda_item", { itemIds: [11, 13] }, ["sessions.write"], l.ctx));
    const second = out(await ask("withdraw_agenda_item", { itemIds: [11, 13], confirmToken: first.confirmToken }, ["sessions.write"], l.ctx));
    expect(second.results).toEqual([
      { id: 11, title: "Budget for the lead roles", withdrawn: true },
      { id: 13, title: "Rename the garden circle", withdrawn: false, error: "The agenda library did not take that: You can only withdraw an item you brought." },
    ]);
  });

  it("takes up to the limit, and refuses a malformed id", async () => {
    const l = library();
    const many = await ask("withdraw_agenda_item", { itemIds: Array.from({ length: WITHDRAW_MAX + 1 }, (_, i) => i + 1) }, ["sessions.write"], l.ctx);
    expect(out(many).error).toContain(`Up to ${WITHDRAW_MAX}`);
    expect(out(await ask("withdraw_agenda_item", { itemIds: ["eleven"] }, ["sessions.write"], l.ctx)).error).toContain("number");
    expect(out(await ask("withdraw_agenda_item", {}, ["sessions.write"], l.ctx)).error).toContain("Name the items");
  });
});

// ── The shipped reads, and seat_power ────────────────────────────────────────

const GROUPS = {
  seat: { id: "r-ops", name: "Operations Lead", isExample: false },
  roleIds: ["g-intake"],
  holders: [{ name: "Ana", email: "ana@example.test" }],
  groups: [
    { id: "g-intake", name: "Intake", capabilities: ["intake.moderate"], grantsAdmin: false, isExample: false, linked: true },
    { id: "g-events", name: "Gatherings", capabilities: ["event.manage"], grantsAdmin: false, isExample: false, linked: false },
    { id: "g-veto", name: "Stewards", capabilities: ["steward.veto"], grantsAdmin: false, isExample: false, linked: false },
  ],
};

describe("the two shipped reads, and seat_power", () => {
  const routes: Route = (method, path) => {
    if (method === "GET" && path === "/api/admin/org-roles/r-ops/power-groups") return { status: 200, body: GROUPS };
    if (method === "GET" && path === "/api/admin/capabilities/holding") return { status: 200, body: { powers: [], leftEmptyByRemoval: { "u-ana": ["org.seat"] }, roles: [{ id: "g-intake", name: "Intake", holderCount: 1 }] } };
    if (method === "PUT" && path === "/api/admin/org-roles/r-ops/power-groups") return { status: 200, body: { ok: true } };
    return undefined;
  };

  it("reads both without the person-saved list, without contact data", async () => {
    const h = holder(routes, { doc: { paths: [] } });
    const groups = out(await ask("admin_request", { method: "GET", path: "/api/admin/org-roles/r-ops/power-groups" }, ["admin"], h.ctx));
    expect(groups.holders).toEqual([{ name: "Ana" }]);
    expect(groups.groups).toHaveLength(3);
    const holding = out(await ask("admin_request", { method: "GET", path: "/api/admin/capabilities/holding" }, ["admin"], h.ctx));
    expect(holding.leftEmptyByRemoval).toBeUndefined();
    expect(holding.roles).toEqual([{ id: "g-intake", name: "Intake", holderCount: 1 }]);
  });

  const listed: AgentAdminPathsDoc = { paths: [{ method: "PUT", path: "/api/admin/org-roles/:id/power-groups", confirm: "agent", label: "Add power groups to a role" }] };
  const approval = { approvedBy: "The lead", approvalNote: "Yes, give Operations the Gatherings group." };
  const summary = "Give the Operations Lead role the Gatherings power group.";

  it("adds a group in two calls, reading the role's groups as the holder each time", async () => {
    const h = holder(routes, { doc: listed, lead: true });
    const args = { summary, method: "PUT", path: "/api/admin/org-roles/r-ops/power-groups", body: { roleIds: ["g-intake", "g-events"], ...approval } };
    const first = out(await ask("admin_request", args, ["admin"], h.ctx));
    expect(first.confirmRequired).toBe(true);
    expect(first.platformSays).toBe("Gave a role more power groups");
    const second = await ask("admin_request", { ...args, confirmToken: first.confirmToken }, ["admin"], h.ctx);
    expect(second.result.isError).toBe(false);
    expect(h.calls.filter((c) => c.method === "GET").length).toBe(2);
    expect(h.calls.find((c) => c.method === "PUT")?.body).toEqual({ roleIds: ["g-intake", "g-events"] });
  });

  it("refuses a removal and a veto group, sending nothing", async () => {
    const h = holder(routes, { doc: listed, lead: true });
    const drop = out(await ask("admin_request", { summary, method: "PUT", path: "/api/admin/org-roles/r-ops/power-groups", body: { roleIds: ["g-events"], ...approval } }, ["admin"], h.ctx));
    expect(drop.error).toContain("Taking one away is a person's act");
    const veto = out(await ask("admin_request", { summary, method: "PUT", path: "/api/admin/org-roles/r-ops/power-groups", body: { roleIds: ["g-intake", "g-veto"], ...approval } }, ["admin"], h.ctx));
    expect(veto.error).toContain("veto");
    expect(h.calls.some((c) => c.method === "PUT")).toBe(false);
  });
});

// ── admin_request with full access ───────────────────────────────────────────

describe("admin_request with full access", () => {
  const routes: Route = (method, path) => {
    if (method === "PUT" && path === "/api/admin/faqs/steward") return { status: 200, body: { ok: true } };
    if (method === "GET" && path === "/api/admin/events") return { status: 200, body: { events: [{ title: "Potluck", hostEmail: "host@example.test" }] } };
    return undefined;
  };
  const approval = { approvedBy: "The lead", approvalNote: "Yes, replace the steward FAQs with these." };
  const args = { summary: "Replace the steward pathway's questions and answers.", method: "PUT", path: "/api/admin/faqs/steward", body: { faqs: [{ q: "Who decides?", a: "The circle." }], ...approval } };

  it("is exactly as before with the switch off: an unlisted path is refused and nothing is sent", async () => {
    const h = holder(routes, { full: false });
    const r = out(await ask("admin_request", args, ["admin"], h.ctx));
    expect(r.detail.code).toBe("not_allowed");
    expect(h.calls).toEqual([]);
  });

  it("writes an unlisted admin path in two calls, auditing the approval before it dispatches", async () => {
    const h = holder(routes, { full: true });
    const first = out(await ask("admin_request", args, ["admin"], h.ctx));
    expect(first.confirmRequired).toBe(true);
    expect(h.calls).toEqual([]);
    const second = await ask("admin_request", { ...args, confirmToken: first.confirmToken }, ["admin"], h.ctx);
    expect(second.result.isError).toBe(false);
    expect(h.order).toEqual(["audit", "dispatch PUT /api/admin/faqs/steward"]);
    expect(h.audits).toEqual([{ method: "PUT", path: "/api/admin/faqs/steward", summary: args.summary, approvedBy: "The lead", approvalNote: approval.approvalNote }]);
    // The approval is the record, never the route's input.
    expect(h.calls[0]!.body).toEqual({ faqs: [{ q: "Who decides?", a: "The circle." }] });
  });

  it("refuses a write with no approval, and one whose record cannot be kept, sending nothing", async () => {
    const h = holder(routes, { full: true });
    const bare = out(await ask("admin_request", { ...args, body: { faqs: [] } }, ["admin"], h.ctx));
    expect(bare.detail.code).toBe("full_access_refused");
    expect(bare.error).toContain("approvedBy");
    const failing = holder(routes, { full: true, recordFails: true });
    const first = out(await ask("admin_request", args, ["admin"], failing.ctx));
    const second = out(await ask("admin_request", { ...args, confirmToken: first.confirmToken }, ["admin"], failing.ctx));
    expect(second.detail.code).toBe("record_failed");
    expect(h.calls).toEqual([]);
    expect(failing.calls).toEqual([]);
  });

  it("refuses the floor and a body naming a floor power, with the switch on", async () => {
    const h = holder(routes, { full: true });
    for (const [method, path] of [["PUT", "/api/admin/integrations/stripe"], ["POST", "/api/admin/tokens/seed/mint"], ["PUT", "/api/admin/agent-accounts/full-access"], ["POST", "/api/admin/players/u-9/anonymize"], ["POST", "/api/admin/comms/letters/l-1/send"], ["POST", ACCEPT_AS_HOLDER_PATH]]) {
      const r = out(await ask("admin_request", { ...args, method, path }, ["admin"], h.ctx));
      expect(r.detail?.code, `${method} ${path}`).toBe("always_a_person");
    }
    const grant = out(await ask("admin_request", { ...args, method: "PUT", path: "/api/admin/roles/g-1/capabilities", body: { capabilities: ["steward.veto"], ...approval } }, ["admin"], h.ctx));
    expect(grant.detail.code).toBe("full_access_refused");
    expect(h.calls).toEqual([]);
  });

  it("reads an admin path without contact data", async () => {
    const h = holder(routes, { full: true });
    const r = out(await ask("admin_request", { method: "GET", path: "/api/admin/events" }, ["admin"], h.ctx));
    expect(r).toEqual({ events: [{ title: "Potluck" }] });
  });

  it("never reads applications or scores, full access or not", async () => {
    const h = holder(routes, { full: true });
    for (const path of ["/api/admin/applications", "/api/admin/applications/a-1/scores", "/api/admin/score-cards/s-1"]) {
      const r = out(await ask("admin_request", { method: "GET", path }, ["admin"], h.ctx));
      expect(r.detail?.code, path).toBe("always_a_person");
    }
    expect(h.calls).toEqual([]);
  });
});

// ── accept_proposals ─────────────────────────────────────────────────────────

describe("accept_proposals (full access only)", () => {
  const queue = {
    waiting: 3,
    batches: [
      { batchId: "b-66", code: "B-66", items: [
        { id: "c-1", code: "B-66.1", kind: "page_content", summary: "Reword the homepage headline.", state: "waiting", stuck: false },
        { id: "c-2", code: "B-66.2", kind: "faq_add", summary: "Add an FAQ on starting.", state: "waiting", stuck: false },
        { id: "c-0", code: "B-66.3", kind: "faq_add", summary: "An accepted one.", state: "accepted", stuck: false },
      ] },
      { batchId: "b-67", code: "B-67", items: [{ id: "c-3", code: "B-67.1", kind: "variable", summary: "Promise a reply in ten days.", state: "waiting", stuck: false }] },
    ],
  };
  const routes: Route = (method, path, body) => {
    if (method === "GET" && path.startsWith("/api/admin/proposals/queue")) return { status: 200, body: queue };
    if (method === "POST" && path === ACCEPT_AS_HOLDER_PATH) return { status: 200, body: { action: body.action, results: body.ids.map((id: string) => ({ id, ok: id !== "c-2", ...(id === "c-2" ? { error: "The FAQ route refused." } : {}) })) } };
    return undefined;
  };

  it("refuses without full access, and reads nothing", async () => {
    const h = holder(routes, { full: false });
    const r = out(await ask("accept_proposals", { batchId: "B-66", action: "accept" }, ["admin"], h.ctx));
    expect(r.error).toContain("Full access is not on");
    expect(h.calls).toEqual([]);
  });

  it("lists every waiting change of the batch with its code and summary, and sends nothing", async () => {
    const h = holder(routes, { full: true });
    const first = out(await ask("accept_proposals", { batchId: "B-66", action: "accept" }, ["admin"], h.ctx));
    expect(first.confirmRequired).toBe(true);
    expect(first.echo.items.map((i: any) => [i.code, i.summary])).toEqual([["B-66.1", "Reword the homepage headline."], ["B-66.2", "Add an FAQ on starting."]]);
    expect(h.calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("refuses the second call without a note naming the batch or every change, then accepts and reports per change", async () => {
    const h = holder(routes, { full: true });
    const first = out(await ask("accept_proposals", { batchId: "B-66", action: "accept" }, ["admin"], h.ctx));
    const base = { batchId: "B-66", action: "accept", confirmToken: first.confirmToken, approvedBy: "The lead" };
    expect(out(await ask("accept_proposals", { ...base }, ["admin"], h.ctx)).detail.code).toBe("approval_required");
    expect(out(await ask("accept_proposals", { ...base, approvalNote: "Yes, accept B-66.1" }, ["admin"], h.ctx)).detail.code).toBe("approval_not_covering");
    expect(out(await ask("accept_proposals", { ...base, approvalNote: "Yes accept them all" }, ["admin"], h.ctx)).detail.code).toBe("approval_not_covering");
    expect(h.calls.some((c) => c.method === "POST")).toBe(false);
    const done = out(await ask("accept_proposals", { ...base, approvalNote: "Yes, accept B-66." }, ["admin"], h.ctx));
    expect(h.calls.filter((c) => c.method === "POST")).toEqual([{ method: "POST", path: ACCEPT_AS_HOLDER_PATH, body: { action: "accept", ids: ["c-1", "c-2"], approvedBy: "The lead", approvalNote: "Yes, accept B-66." } }]);
    expect(done.results).toEqual([
      { id: "c-1", code: "B-66.1", summary: "Reword the homepage headline.", landed: true },
      { id: "c-2", code: "B-66.2", summary: "Add an FAQ on starting.", landed: false, error: "The FAQ route refused." },
    ]);
    expect(done).toMatchObject({ landed: 1, failed: 1, action: "accept" });
  });

  it("discards named changes across batches once every code is in the note", async () => {
    const h = holder(routes, { full: true });
    const first = out(await ask("accept_proposals", { itemIds: ["B-66.2", "B-67.1"], action: "discard" }, ["admin"], h.ctx));
    expect(first.echo.items.map((i: any) => i.code)).toEqual(["B-66.2", "B-67.1"]);
    const base = { itemIds: ["B-66.2", "B-67.1"], action: "discard", confirmToken: first.confirmToken, approvedBy: "The lead" };
    expect(out(await ask("accept_proposals", { ...base, approvalNote: "Put aside B-66" }, ["admin"], h.ctx)).detail.code).toBe("approval_not_covering");
    const done = out(await ask("accept_proposals", { ...base, approvalNote: "Put aside B-66.2 and B-67.1, both are stale." }, ["admin"], h.ctx));
    expect(done.action).toBe("discard");
    expect(h.calls.find((c) => c.method === "POST")?.body.ids).toEqual(["c-2", "c-3"]);
  });
});
