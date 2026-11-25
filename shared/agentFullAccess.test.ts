/**
 * THE CONNECTOR POWERS OF 20 NOVEMBER 2026 (the lead: "you should be able to do this, make it so and get it done";
 * "For my role only (ops) I should have the power for agents to just about everything for me").
 *
 *   off       with full access off, every decision is exactly what it was, over the whole ALWAYS_A_PERSON list
 *   floor     one explicit case per floor category, refused with full access on
 *   walk      every route the server registers, collected from the route files: each one a floor rule names is
 *             refused with full access on, and the walk is not hollow
 *   opens     an admin path on no list opens with full access, the agent confirming, a lead-approved route keeps
 *             its body check, and a non-admin path is not widened
 *   body      a write naming the veto, the break-glass, money or the admin panel is refused
 *   reads     the two new shipped reads pass without the person-saved list, and lose contact data
 *   seat      seat_power is additive only and refuses a group carrying the veto, the break-glass, money or admin
 *   note      an approval covers a selection only by the batch code or every change's code
 *   25 nov    reads open: any read under /api/ for the full-access seat once a person opens it, as a plain member
 *             outside /api/admin/, under the read floor, one case per category and failing closed on a floor word;
 *             any other agent, and the seat with reads closed, exactly as before; writes unchanged
 *   24 nov    the lead's ruling of 24 Nov 2026: for the full-access holder, variables, modules, settings and the email
 *             sends open; any other agent is refused as before; every kept floor item still refuses the holder
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  adminRequestDecision,
  ALWAYS_A_PERSON,
  DEFAULT_AGENT_ADMIN_PATHS,
  isFloorCapability,
  leadApprovedBodyProblem,
  leadApprovedEntry,
  LEAD_APPROVAL_WORDS,
  LIFTABLE_RULES,
  MONEY_MODULE_IDS,
  READ_FLOOR,
  READ_FLOOR_WORDS,
  readFloor,
  SHIPPED_AGENT_READS,
  stripContactData,
  type AgentAdminPathsDoc,
  type SeatPowerFacts,
} from "./agentAdmin";
import {
  approvalCovers,
  FULL_ACCESS_EMAIL_SENDS,
  FULL_ACCESS_FLOOR,
  FULL_ACCESS_KEPT,
  FULL_ACCESS_VARIABLE_CATEGORIES,
  FULL_ACCESS_WORDS,
  fullAccessEmailSend,
  isUnnamedSend,
  READS_OPEN_KEPT,
  recipientsProblem,
  fullAccessBodyProblem,
  fullAccessDecision,
  fullAccessFloor,
  namesCode,
  parseFullAccessDoc,
} from "./agentFullAccess";
import { BADGE_GRANTABLE, BREAK_GLASS_SEAT } from "./capabilities";
import { VARIABLES_BY_KEY } from "./gameVariables";
import { MONEY_MODULES } from "./regenImport";

const EMPTY: AgentAdminPathsDoc = { paths: [] };
const FULL = { fullAccess: true } as const;
const SELF = "u-ops";

// ── Every route the server registers, from the route files ───────────────────

/** `app.<method>("/api/...")` in server/index.ts and server/routes/*.ts, with each `:param` filled. */
function registeredRoutes(): Array<{ method: string; pattern: string; path: string }> {
  const root = process.cwd();
  const files = [path.join(root, "server/index.ts"), ...readdirSync(path.join(root, "server/routes")).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts")).map((f) => path.join(root, "server/routes", f))];
  const out = new Map<string, { method: string; pattern: string; path: string }>();
  const re = /app\.(get|post|put|patch|delete)\(\s*["'`](\/api\/[^"'`$]+)["'`]/g;
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(re)) {
      const method = m[1]!.toUpperCase();
      const pattern = m[2]!;
      if (pattern.startsWith("/api/agent/")) continue;
      // Each `:param` becomes a plain id that reads as nothing, so only the route's own words decide.
      const concrete = pattern.replace(/:[A-Za-z][A-Za-z0-9]*/g, "x1");
      out.set(`${method} ${pattern}`, { method, pattern, path: concrete });
    }
  }
  return Array.from(out.values());
}

/** What a floor rule says of a route, from the rule set itself: the rule's own test, its `only`, and its mode. */
function floorRuleFor(method: string, p: string, applicantDataOpen = false): string | null {
  for (const r of ALWAYS_A_PERSON) {
    const f = FULL_ACCESS_FLOOR.find((x) => x.key === r.key);
    if (!f || !r.test(method, p) || (f.only && !f.only.test(p))) continue;
    if (method === "GET" && r.mode === "writes") continue;
    if (method === "GET" && r.mode === "personal" && applicantDataOpen) continue;
    return r.key;
  }
  return null;
}

describe("with full access off, nothing changes (regression over the whole ALWAYS_A_PERSON list)", () => {
  const routes = registeredRoutes();
  // Every rule, by its own words, in every method, beside every route the server registers.
  const samples: Array<[string, string]> = [
    ["DELETE", "/api/admin/players/u-9"], ["POST", "/api/admin/players/u-9/anonymize"], ["PUT", "/api/admin/roles/r-1/capabilities"],
    ["PUT", "/api/moon-review/payers"], ["POST", "/api/admin/exits/e-1"], ["PUT", "/api/admin/settings"], ["POST", "/api/admin/org/drafts/d-1/publish"],
    ["GET", "/api/admin/applications/a-1/voice"], ["GET", "/api/admin/proposal-compare"], ["GET", "/api/admin/join-requests"], ["PUT", "/api/admin/integrations/stripe"],
    ["PUT", "/api/admin/users/u-9/role"], ["PUT", "/api/admin/agent-admin-paths"], ["PUT", "/api/admin/agent-accounts/full-access"],
    ...routes.map((r) => [r.method, r.path] as [string, string]),
  ];

  it("answers every route exactly as adminRequestDecision does, with the switch off or absent", () => {
    expect(samples.length).toBeGreaterThan(400);
    for (const doc of [EMPTY, { paths: samples.slice(0, 40).map(([m, p]) => ({ method: m as any, path: p, confirm: "agent" as const, label: "x" })) }]) {
      for (const [m, p] of samples) {
        for (const opts of [{}, { applicantDataOpen: true }, { leadApprovedWrites: true }]) {
          const base = adminRequestDecision(m, p, doc, "agent-1", opts);
          expect(fullAccessDecision(m, p, doc, "agent-1", { ...opts, fullAccess: false }), `${m} ${p}`).toEqual(base);
          expect(fullAccessDecision(m, p, doc, "agent-1", opts), `${m} ${p}`).toEqual(base);
        }
      }
    }
  });

  it("still refuses every ALWAYS_A_PERSON rule through the plain decision, rule by rule", () => {
    for (const r of ALWAYS_A_PERSON) {
      const hit = samples.find(([m, p]) => r.test(m, p) && m !== "GET");
      if (!hit) continue;
      expect(adminRequestDecision(hit[0], hit[1], { paths: [{ method: hit[0] as any, path: hit[1], confirm: "agent", label: "x" }] }, "agent-1").ok, `${r.key}: ${hit.join(" ")}`).toBe(false);
    }
  });

  it("lifts the same rules it always did, and only those", () => {
    expect(LIFTABLE_RULES).toEqual(["powers", "tier_c", "settings"]);
  });
});

describe("the floor: a person's act even with full access on, one case per category", () => {
  const CASES: Array<[string, string, string]> = [
    ["secrets", "PUT", "/api/admin/integrations/stripe"],
    ["secrets", "GET", "/api/admin/secrets"],
    ["erasure", "POST", "/api/admin/players/u-9/anonymize"],
    ["erasure", "DELETE", "/api/admin/players/u-9"],
    ["money", "POST", "/api/admin/tokens/seed/mint"],
    ["money", "PUT", "/api/moon-review/payers"],
    ["money", "POST", "/api/admin/payouts/p-1"],
    ["money", "POST", "/api/admin/treasury/stock"],
    ["money", "POST", "/api/admin/ledger/transfer"],
    ["money", "POST", "/api/admin/cycles/c-1/settle"],
    ["agents", "PUT", "/api/admin/players/u-9/agent"],
    ["agents", "PUT", "/api/admin/agent-admin-paths"],
    ["agents", "PUT", "/api/admin/agent-accounts/full-access"],
    ["agents", "POST", "/api/admin/proposals/accept"],
    ["agents", "POST", "/api/admin/proposals/accept-as-holder"],
    ["accounts", "PUT", "/api/admin/users/u-9/role"],
    ["accounts", "POST", "/api/admin/users/u-9/send-password-link"],
    ["powers", "POST", "/api/admin/break-glass"],
    ["powers", "PUT", "/api/admin/stewards/veto"],
    ["powers", "PUT", "/api/admin/roles/r-1/admin-access"],
    ["settings", "PUT", "/api/admin/email-config"],
    ["settings", "POST", "/api/admin/comms/settings/webhook"],
    ["settings", "PUT", "/api/admin/comms/settings/webhook"],
    ["settings", "POST", "/api/admin/comms/settings/key-rights"],
    ["settings", "POST", "/api/admin/comms/settings/domain"],
    ["settings", "POST", "/api/admin/comms/people/c-1/restore"],
    ["settings", "POST", "/api/admin/comms/people/c-1/suppress"],
    ["tier_c", "POST", "/api/admin/letter-drafts/d-1/send"],
    ["members", "POST", "/api/admin/invites"],
    ["personal", "PUT", "/api/admin/applications/a-1"],
    ["personal", "GET", "/api/admin/applications"],
    ["voice", "GET", "/api/admin/applications/a-1/voice"],
    ["compare", "GET", "/api/admin/proposal-compare"],
  ];

  for (const [key, m, p] of CASES) {
    it(`${key}: ${m} ${p}`, () => {
      const d = fullAccessDecision(m, p, EMPTY, SELF, FULL);
      expect(d).toMatchObject({ ok: false, code: "always_a_person" });
      // The category's own rule names it, and the floor refuses it (an earlier rule may answer first, as it always has).
      const rule = ALWAYS_A_PERSON.find((r) => r.key === key)!;
      expect(rule.test(m, p), `${key} names ${p}`).toBe(true);
      expect(fullAccessFloor(m, p, SELF)).not.toBeNull();
      expect(FULL_ACCESS_FLOOR.map((f) => f.key)).toContain(key);
    });
  }

  it("refuses an agent acting on its own account", () => {
    expect(fullAccessDecision("PUT", `/api/admin/member-tasks/access/${SELF}`, EMPTY, SELF, FULL)).toMatchObject({ ok: false, code: "always_a_person" });
  });

  it("keeps money, sign-in and connector variables, and every agents. key, a person's", () => {
    for (const k of ["gratitude.pool_per_cycle", "redemption.fee_pct", "exit.keep_pct.credit", "auth.session_days", "agents.lead_approved_writes", "no.such_key"]) {
      expect(fullAccessDecision("PUT", `/api/admin/variables/${k}`, EMPTY, SELF, FULL), k).toMatchObject({ ok: false, code: "always_a_person" });
    }
    expect(fullAccessDecision("PUT", "/api/admin/variables/sessions.default_minutes", EMPTY, SELF, FULL)).toMatchObject({ ok: true, confirm: "agent", fullAccess: true });
    // A veto variable is the veto.
    expect(fullAccessDecision("PUT", "/api/admin/variables/governance.veto_hours", EMPTY, SELF, FULL)).toMatchObject({ ok: false });
  });

  it("keeps the admin areas that move value under another name, and the signing key, a person's", () => {
    for (const [m, p] of [
      ["POST", "/api/admin/library/adjust"], ["POST", "/api/admin/stays/adjust"], ["PUT", "/api/admin/stays/accommodations/a-1/prices"],
      ["POST", "/api/admin/products"], ["POST", "/api/admin/quest-claims/c-1/consent"], ["POST", "/api/admin/resources/rules"],
      ["POST", "/api/admin/mechanics/proposals/p-1/apply"], ["POST", "/api/admin/identity/signing-key/rotate"],
    ] as const) expect(fullAccessDecision(m, p, EMPTY, SELF, FULL), `${m} ${p}`).toMatchObject({ ok: false, code: "always_a_person" });
  });

  it("keeps a money module's lifecycle a person's", () => {
    for (const id of MONEY_MODULE_IDS) expect(fullAccessDecision("PUT", `/api/admin/modules/${id}/lifecycle`, EMPTY, SELF, FULL), id).toMatchObject({ ok: false });
    expect(fullAccessDecision("PUT", "/api/admin/modules/sessions/lifecycle", EMPTY, SELF, FULL)).toMatchObject({ ok: true });
  });

  it("reads applicant data only with the Anchor's approval, as before, and never writes it", () => {
    expect(fullAccessDecision("GET", "/api/admin/applications", EMPTY, SELF, FULL)).toMatchObject({ ok: false });
    expect(fullAccessDecision("GET", "/api/admin/applications", EMPTY, SELF, { ...FULL, applicantDataOpen: true })).toMatchObject({ ok: true });
    expect(fullAccessDecision("POST", "/api/admin/applications/a-1/scores", EMPTY, SELF, { ...FULL, applicantDataOpen: true })).toMatchObject({ ok: false });
    expect(fullAccessDecision("GET", "/api/admin/applications/a-1/voice", EMPTY, SELF, { ...FULL, applicantDataOpen: true })).toMatchObject({ ok: false });
  });
});

describe("the walk: every route the server registers that a floor rule names is refused with full access on", () => {
  const routes = registeredRoutes();

  it("finds the server's routes, so the walk is not hollow", () => {
    expect(routes.length).toBeGreaterThan(600);
    expect(routes.some((r) => r.pattern === "/api/admin/proposals/accept-as-holder")).toBe(true);
    expect(routes.some((r) => r.pattern === "/api/admin/agent-accounts/full-access" && r.method === "PUT")).toBe(true);
  });

  it("refuses each one, with the Anchor's approval off and on", () => {
    let floored = 0;
    const seen = new Set<string>();
    for (const r of routes) {
      for (const open of [false, true]) {
        const key = floorRuleFor(r.method, r.path, open);
        if (!key) continue;
        floored++;
        seen.add(key);
        const d = fullAccessDecision(r.method, r.path, EMPTY, SELF, { fullAccess: true, applicantDataOpen: open, leadApprovedWrites: true });
        expect(d, `${r.method} ${r.pattern} (${key})`).toMatchObject({ ok: false, code: "always_a_person" });
      }
    }
    expect(floored).toBeGreaterThan(150);
    // Every floor rule has at least one real route behind it, or this walk would prove less than it says.
    for (const k of ["erasure", "money", "members", "secrets", "agents", "personal", "powers", "settings"]) expect(seen, k).toContain(k);
  });

  it("opens a registered admin write no floor rule names, with the agent confirming and full access marked", () => {
    const open = routes.filter((r) => r.path.startsWith("/api/admin/") && r.method !== "GET" && !floorRuleFor(r.method, r.path) && !fullAccessFloor(r.method, r.path, SELF));
    expect(open.length).toBeGreaterThan(50);
    for (const r of open) {
      const d = fullAccessDecision(r.method, r.path, EMPTY, SELF, FULL);
      expect(d, `${r.method} ${r.pattern}`).toMatchObject({ ok: true, write: true, confirm: "agent", fullAccess: true });
    }
  });
});

describe("what full access opens, and how", () => {
  it("opens an unlisted admin path, a person-confirmed listed one, and keeps a lead-approved route's body check", () => {
    expect(fullAccessDecision("PUT", "/api/admin/faqs/steward", EMPTY, SELF, FULL)).toMatchObject({ ok: true, confirm: "agent", fullAccess: true });
    const listed: AgentAdminPathsDoc = { paths: [{ method: "PUT", path: "/api/admin/events/:id", confirm: "person", label: "Change a gathering" }] };
    expect(fullAccessDecision("PUT", "/api/admin/events/e-1", listed, SELF, FULL)).toMatchObject({ ok: true, confirm: "agent", entry: { label: "Change a gathering" } });
    expect(fullAccessDecision("POST", "/api/admin/org/roles/r-1/holders", EMPTY, SELF, FULL)).toMatchObject({ ok: true, leadApproved: "seat", fullAccess: true });
    expect(fullAccessDecision("PUT", "/api/admin/org-roles/r-1/power-groups", EMPTY, SELF, FULL)).toMatchObject({ ok: true, leadApproved: "seat_power" });
  });

  it("does not widen a path outside /api/admin/", () => {
    expect(fullAccessDecision("POST", "/api/sessions/1/task-emails", EMPTY, SELF, FULL)).toMatchObject({ ok: false, code: "not_allowed" });
    expect(fullAccessDecision("POST", "/api/wallet/send", EMPTY, SELF, FULL)).toMatchObject({ ok: false });
    expect(fullAccessDecision("GET", "/api/sessions", EMPTY, SELF, FULL)).toMatchObject({ ok: true, fullAccess: true });
  });

  it("still refuses a bad path", () => {
    expect(fullAccessDecision("GET", "/api/admin/x?y=1", EMPTY, SELF, FULL)).toMatchObject({ ok: false, code: "bad_path" });
    expect(fullAccessDecision("PUT", "/api/admin/../agent-admin-paths", EMPTY, SELF, FULL)).toMatchObject({ ok: false, code: "bad_path" });
  });

  it("reads a broken setting as off", () => {
    expect(parseFullAccessDoc(null).roleId).toBeNull();
    expect(parseFullAccessDoc({ roleId: "../x" }).roleId).toBeNull();
    expect(parseFullAccessDoc({ roleId: "r-ops", setBy: "u-1" })).toMatchObject({ roleId: "r-ops", setBy: "u-1" });
  });
});

describe("the body half of the floor", () => {
  it("refuses a body naming the veto, the break-glass, money, an unbadgeable power or the admin panel", () => {
    for (const body of [
      { capabilities: ["org.seat", BREAK_GLASS_SEAT] },
      { capabilities: ["cash.pay"] },
      { capabilities: ["exchange.manage"] },
      { capabilities: ["token.mint"] },
      { capabilities: ["power.assign"] },
      { nested: { list: [{ capability: "redemption.confirm" }] } },
      { grantsAdmin: true },
      { adminOverride: "yes" },
    ]) expect(fullAccessBodyProblem(body), JSON.stringify(body)).toBe(FULL_ACCESS_WORDS.body);
  });

  it("lets ordinary words and ordinary powers through", () => {
    expect(fullAccessBodyProblem({ capabilities: ["org.seat", "story.tell", "event.manage"], name: "Gardeners" })).toBeNull();
    expect(fullAccessBodyProblem({ value: "org.ccos_terms", grantsAdmin: false, text: "We talk about the veto at the circle." })).toBeNull();
  });

  it("names the platform's own lists: the break-glass seat, money modules, and every unbadgeable key", () => {
    expect(isFloorCapability(BREAK_GLASS_SEAT)).toBe(true);
    expect([...MONEY_MODULE_IDS]).toEqual([...MONEY_MODULES]);
    for (const [cap, grantable] of Object.entries(BADGE_GRANTABLE)) if (!grantable) expect(isFloorCapability(cap), cap).toBe(true);
    for (const cap of ["cash.pay", "role.pay", "token.mint", "exchange.buy", "exchange.swap", "exchange.manage", "redemption.confirm", "pot.steward", "quest.approve", "steward.veto"]) expect(isFloorCapability(cap), cap).toBe(true);
    for (const cap of ["org.seat", "story.tell", "event.manage", "map.edit", "dial.set", "library.keep"]) expect(isFloorCapability(cap), cap).toBe(false);
  });
});

describe("the two new shipped reads", () => {
  it("pass without the person-saved list, and stay reads", () => {
    for (const p of ["/api/admin/org-roles/r-ops/power-groups", "/api/admin/capabilities/holding"]) {
      expect(adminRequestDecision("GET", p, EMPTY, "agent-1"), p).toMatchObject({ ok: true, write: false });
      expect(adminRequestDecision("PUT", p, EMPTY, "agent-1"), p).toMatchObject({ ok: false });
    }
    expect(SHIPPED_AGENT_READS.every((e) => e.method === "GET")).toBe(true);
  });

  it("lose contact data at any depth", () => {
    const out = stripContactData({ seat: { id: "r-1", name: "Ops" }, holders: [{ name: "Ana", email: "ana@example.test", phone: "1", contactDetail: "x" }], leftEmptyByRemoval: { "u-1": ["org.seat"] }, roles: [{ id: "g", capabilities: ["map.contact"] }] });
    expect(out).toEqual({ seat: { id: "r-1", name: "Ops" }, holders: [{ name: "Ana" }], roles: [{ id: "g", capabilities: ["map.contact"] }] });
  });
});

describe("seat_power: additive only, and never the veto, the break-glass, money or admin", () => {
  const approval = { approvedBy: "The lead", approvalNote: "Yes, give Ops the Gatherings group." };
  const p = "/api/admin/org-roles/r-ops/power-groups";
  const facts = (over: Partial<SeatPowerFacts> = {}): SeatPowerFacts => ({
    found: true,
    isExample: false,
    linked: ["g-intake"],
    groups: [
      { id: "g-intake", capabilities: ["intake.moderate"], grantsAdmin: false, isExample: false },
      { id: "g-events", capabilities: ["event.manage"], grantsAdmin: false, isExample: false },
      { id: "g-steward", capabilities: ["steward.veto"], grantsAdmin: false, isExample: false },
      { id: "g-cash", capabilities: ["cash.pay"], grantsAdmin: false, isExample: false },
      { id: "g-mint", capabilities: ["token.mint"], grantsAdmin: false, isExample: false },
      { id: "g-admin", capabilities: [], grantsAdmin: true, isExample: false },
      { id: "g-assign", capabilities: ["power.assign"], grantsAdmin: false, isExample: false },
      ...(over.groups ?? []),
    ],
    ...over,
  });

  it("is a lead-approved write that lifts only the powers rule, on the list, with the switch on", () => {
    expect(leadApprovedEntry("PUT", p)).toMatchObject({ kind: "seat_power", lifts: ["powers"] });
    const listed: AgentAdminPathsDoc = { paths: [{ method: "PUT", path: "/api/admin/org-roles/:id/power-groups", confirm: "agent", label: "Add power groups" }] };
    expect(adminRequestDecision("PUT", p, listed, "agent-1", { leadApprovedWrites: true })).toMatchObject({ ok: true, leadApproved: "seat_power" });
    expect(adminRequestDecision("PUT", p, listed, "agent-1", { leadApprovedWrites: false })).toMatchObject({ ok: false, code: "always_a_person" });
    expect(adminRequestDecision("PUT", p, EMPTY, "agent-1", { leadApprovedWrites: true })).toMatchObject({ ok: false, code: "not_allowed" });
  });

  it("adds a plain group with the approval", () => {
    expect(leadApprovedBodyProblem("seat_power", p, { roleIds: ["g-intake", "g-events"], ...approval }, { seatPower: facts() })).toBeNull();
  });

  it("requires approvedBy and approvalNote", () => {
    expect(leadApprovedBodyProblem("seat_power", p, { roleIds: ["g-intake", "g-events"] }, { seatPower: facts(), approvalRequired: false })).toBe(LEAD_APPROVAL_WORDS.approval);
    expect(leadApprovedBodyProblem("seat_power", p, { roleIds: ["g-intake", "g-events"], approvedBy: "The lead" }, { seatPower: facts() })).toBe(LEAD_APPROVAL_WORDS.approval);
  });

  it("refuses removing a group: that stays a person's act", () => {
    expect(leadApprovedBodyProblem("seat_power", p, { roleIds: ["g-events"], ...approval }, { seatPower: facts() })).toBe(LEAD_APPROVAL_WORDS.powerRemoved);
    expect(leadApprovedBodyProblem("seat_power", p, { roleIds: [], ...approval }, { seatPower: facts() })).toBe(LEAD_APPROVAL_WORDS.powerRemoved);
  });

  it("refuses a group carrying the veto, the break-glass, money, an unbadgeable power or the admin panel", () => {
    for (const g of ["g-steward", "g-cash", "g-mint", "g-admin", "g-assign"]) {
      expect(leadApprovedBodyProblem("seat_power", p, { roleIds: ["g-intake", g], ...approval }, { seatPower: facts() }), g).toBe(LEAD_APPROVAL_WORDS.powerFloor);
    }
  });

  it("refuses an unknown group, an example, a missing role, and anything but roleIds", () => {
    expect(leadApprovedBodyProblem("seat_power", p, { roleIds: ["g-intake", "g-none"], ...approval }, { seatPower: facts() })).toContain("no power group");
    expect(leadApprovedBodyProblem("seat_power", p, { roleIds: ["g-intake", "g-ex"], ...approval }, { seatPower: facts({ groups: [{ id: "g-ex", capabilities: [], grantsAdmin: false, isExample: true }] }) })).toBe(LEAD_APPROVAL_WORDS.example);
    expect(leadApprovedBodyProblem("seat_power", p, { roleIds: ["g-intake"], ...approval }, { seatPower: facts({ isExample: true }) })).toBe(LEAD_APPROVAL_WORDS.example);
    expect(leadApprovedBodyProblem("seat_power", p, { roleIds: ["g-intake"], ...approval }, { seatPower: { found: false, isExample: false, linked: [], groups: [] } })).toBe(LEAD_APPROVAL_WORDS.missingSeat);
    expect(leadApprovedBodyProblem("seat_power", p, { roleIds: ["g-intake"], capabilities: ["x"], ...approval }, { seatPower: facts() })).toContain("capabilities");
  });
});

describe("an approval note covers a selection by its codes", () => {
  const items = [{ code: "B-66.1", batchCode: "B-66" }, { code: "B-66.2", batchCode: "B-66" }];

  it("by the batch code, or by every change's code", () => {
    expect(approvalCovers("Yes, accept B-66.", items)).toBe(true);
    expect(approvalCovers("Accept b-66 please", items)).toBe(true);
    expect(approvalCovers("Accept B-66.1 and B-66.2", items)).toBe(true);
  });

  it("not by part of the codes, a longer code, or a change code standing for its batch", () => {
    expect(approvalCovers("Accept B-66.1", items)).toBe(false);
    expect(approvalCovers("Accept B-660", items)).toBe(false);
    expect(approvalCovers("Yes", items)).toBe(false);
    expect(approvalCovers("B-66", [{ code: "B-66.1", batchCode: "B-66" }, { code: "B-67.1", batchCode: "B-67" }])).toBe(false);
    expect(namesCode("B-66.12 only", "B-66.1")).toBe(false);
    expect(namesCode("see B-66.1.", "B-66.1")).toBe(true);
  });
});

// ── The lead's ruling of 24 Nov 2026: settings and email, for the full-access role only ─────────────

describe("24 Nov 2026: the full-access role's agent changes settings and sends email", () => {
  const routes = registeredRoutes();
  const NOT_FULL = [{}, { fullAccess: false }, { leadApprovedWrites: true }, { applicantDataOpen: true }] as const;

  /** The writes the ruling opens, each a registered route. */
  const OPENED: Array<[string, string]> = [
    ["PUT", "/api/admin/variables/comms.daily_cap"],
    ["PUT", "/api/admin/variables/comms.letters_per_day"],
    ["PUT", "/api/admin/variables/sessions.default_minutes"],
    ["PUT", "/api/admin/modules/comms/lifecycle"],
    ["PUT", "/api/admin/modules/sessions/config"],
    ["PUT", "/api/admin/settings"],
    ["PUT", "/api/admin/comms/settings"],
    ["PUT", "/api/admin/comms/settings/sender"],
    ["POST", "/api/admin/comms/letters"],
    ["PUT", "/api/admin/comms/letters/l-1"],
    ["POST", "/api/admin/comms/letters/l-1/preview"],
    ["PUT", "/api/admin/comms/journeys/welcome/steps/s-1"],
    ["PUT", "/api/admin/comms/words/welcome"],
    ...FULL_ACCESS_EMAIL_SENDS.map((e) => ["POST", e.path.replace(/:[A-Za-z]+/g, "x1")] as [string, string]),
  ];

  it("opens each one for the full-access holder, with the agent confirming", () => {
    for (const [m, p] of OPENED) {
      expect(fullAccessDecision(m, p, EMPTY, SELF, FULL), `${m} ${p}`).toMatchObject({ ok: true, write: true, confirm: "agent", fullAccess: true });
    }
  });

  it("still refuses each one for any other agent", () => {
    for (const [m, p] of OPENED) {
      for (const opts of NOT_FULL) expect(fullAccessDecision(m, p, EMPTY, SELF, opts).ok, `${m} ${p} ${JSON.stringify(opts)}`).toBe(false);
    }
  });

  it("names every email send the agent may make, each a route the server registers, POST only", () => {
    for (const e of FULL_ACCESS_EMAIL_SENDS) {
      expect(routes.some((r) => r.method === "POST" && r.pattern === e.path), e.path).toBe(true);
      expect(fullAccessEmailSend("POST", e.path.replace(/:[A-Za-z]+/g, "x1")), e.path).toMatchObject({ kind: e.kind });
      expect(fullAccessEmailSend("PUT", e.path.replace(/:[A-Za-z]+/g, "x1")), e.path).toBeNull();
    }
    expect(fullAccessEmailSend("POST", "/api/admin/comms/letters/l-9/send")).toEqual({ kind: "letter", label: expect.any(String), params: { id: "l-9" } });
    expect(fullAccessEmailSend("POST", "/api/admin/comms/journeys/welcome/state")).toMatchObject({ kind: "journey", params: { key: "welcome" } });
    expect(fullAccessEmailSend("POST", "/api/admin/comms/letters/l-9/preview")).toBeNull();
  });

  it("keeps a send whose recipients the platform cannot name a person's, on every registered route", () => {
    for (const [m, p] of [["POST", "/api/admin/comms/run"], ["POST", "/api/admin/member-tasks/bridge/send"], ["POST", "/api/admin/comms/x1/x1/test"]] as const) {
      expect(isUnnamedSend(m, p), p).toBe(true);
      expect(fullAccessDecision(m, p, EMPTY, SELF, FULL), p).toMatchObject({ ok: false, code: "always_a_person" });
    }
    // Every registered write shaped like a send is either named, or refused.
    let shaped = 0;
    for (const r of routes) {
      if (r.method === "GET" || !/\/send(\/|$)|\/comms\/(.+\/)?(test|retry|run)$/i.test(r.path)) continue;
      shaped++;
      const d = fullAccessDecision(r.method, r.path, EMPTY, SELF, FULL);
      if (fullAccessEmailSend(r.method, r.path)) expect(d, r.pattern).toMatchObject({ ok: true });
      else expect(d, r.pattern).toMatchObject({ ok: false });
    }
    expect(shaped).toBeGreaterThan(10);
  });

  it("keeps every floor item for the full-access holder, unchanged", () => {
    const KEPT: Array<[string, string, string]> = [
      ["secrets", "PUT", "/api/admin/integrations/resend_api_key"],
      ["secrets", "GET", "/api/admin/integrations"],
      ["secrets", "PUT", "/api/admin/email-config"],
      ["secrets", "PUT", "/api/admin/comms/settings/webhook"],
      ["secrets", "POST", "/api/admin/comms/settings/key-rights"],
      ["money", "POST", "/api/admin/tokens/seed/mint"],
      ["money", "PUT", "/api/moon-review/payers"],
      ["money", "PUT", "/api/admin/variables/gratitude.pool_per_cycle"],
      ["money", "POST", "/api/admin/stays/adjust"],
      ["erasure", "POST", "/api/admin/players/u-9/anonymize"],
      ["erasure", "DELETE", "/api/admin/players/u-9"],
      ["members", "POST", "/api/admin/invites"],
      ["members", "POST", "/api/admin/exits/e-1"],
      ["accounts", "PUT", "/api/admin/users/u-9/role"],
      ["accounts", "POST", "/api/admin/users/u-9/send-password-link"],
      ["accounts", "PUT", "/api/admin/variables/auth.session_days"],
      ["agents", "PUT", "/api/admin/agent-accounts/full-access"],
      ["agents", "PUT", "/api/admin/agent-admin-paths"],
      ["agents", "PUT", "/api/admin/players/u-9/agent"],
      ["agents", "PUT", "/api/admin/variables/agents.lead_approved_writes"],
      ["powers", "POST", "/api/admin/break-glass"],
      ["powers", "PUT", "/api/admin/stewards/veto"],
      ["personal", "PUT", "/api/admin/applications/a-1"],
      ["personal", "GET", "/api/admin/applications"],
      ["tier_c", "POST", "/api/admin/letter-drafts/d-1/send"],
      ["tier_c", "POST", "/api/admin/applications/a-1/first-reply"],
      ["voice", "GET", "/api/admin/applications/a-1/voice"],
      ["compare", "GET", "/api/admin/proposal-compare"],
      ["consent", "POST", "/api/admin/comms/people/c-1/restore"],
    ];
    for (const [what, m, p] of KEPT) {
      for (const leadApprovedWrites of [false, true]) {
        expect(fullAccessDecision(m, p, EMPTY, SELF, { fullAccess: true, leadApprovedWrites }), `${what}: ${m} ${p}`).toMatchObject({ ok: false, code: "always_a_person" });
      }
    }
    // The applicant data read opens only with the Anchor's approval, exactly as before; writing it never does.
    expect(fullAccessDecision("PUT", "/api/admin/applications/a-1", EMPTY, SELF, { ...FULL, applicantDataOpen: true })).toMatchObject({ ok: false });
  });

  it("opens email variables and keeps money, sign-in and connector categories", () => {
    expect(FULL_ACCESS_VARIABLE_CATEGORIES).not.toContain("Email and reminders");
    for (const c of ["Gratitude", "Ledger", "Payments", "Connector", "Accounts & sessions", "Abuse guards"]) expect(FULL_ACCESS_VARIABLE_CATEGORIES).toContain(c);
    expect(VARIABLES_BY_KEY["comms.daily_cap"]?.category).toBe("Email and reminders");
  });

  it("reads a recipients answer as enough for an informed yes only with a line, a count and somebody to send to", () => {
    const r = { to: "the 12 people in this letter's audience", count: 12, names: ["Ana"] };
    expect(recipientsProblem("letter", r)).toBeNull();
    expect(recipientsProblem("letter", null)).toBe(FULL_ACCESS_WORDS.noRecipients);
    expect(recipientsProblem("letter", { ...r, count: 0 })).toBe(FULL_ACCESS_WORDS.noRecipients);
    expect(recipientsProblem("waitlist", { ...r, count: 0 })).toBe(FULL_ACCESS_WORDS.noRecipients);
    expect(recipientsProblem("letter", { ...r, to: " " })).toBe(FULL_ACCESS_WORDS.noRecipients);
    expect(recipientsProblem("letter", { ...r, count: 1.5 })).toBe(FULL_ACCESS_WORDS.noRecipients);
    // Turning a journey off reaches nobody new, and says so.
    expect(recipientsProblem("journey", { to: "nobody new", count: 0, names: [] })).toBeNull();
  });

  it("gives the agent a short list of what the floor still keeps, naming every kept category", () => {
    const all = FULL_ACCESS_KEPT.join(" ").toLowerCase();
    for (const w of ["secrets", "money", "erasing", "letting a member in", "sign-in", "agent accounts", "tokens", "full-access switch", "veto", "break-glass", "applicant", "no ai selects, ranks or judges", "voice", "yes or no to letters"]) {
      expect(all, w).toContain(w);
    }
    expect(FULL_ACCESS_KEPT.length).toBeLessThanOrEqual(12);
  });
});

// ── The lead's ruling of 25 Nov 2026: reads open, for the full-access seat only ─────────────────────

describe("25 Nov 2026: reads open for the full-access seat", () => {
  const routes = registeredRoutes();
  const OPEN = { fullAccess: true, readsOpen: true } as const;
  const READS: Array<[string, string]> = [["GET", "/api/org/drafts"], ["GET", "/api/org/role-card/r-1"], ["HEAD", "/api/org/role-card/r-1"], ["GET", "/api/events"], ["GET", "/api/admin/events"], ["GET", "/api/admin/roles/r-1"]];

  it("opens any read under /api/ to the seat's agent, as a plain member outside /api/admin/", () => {
    for (const [m, p] of READS) {
      const d = fullAccessDecision(m, p, EMPTY, SELF, OPEN);
      expect(d, `${m} ${p}`).toMatchObject({ ok: true, write: false, fullAccess: true, readOpen: true });
      expect((d as any).asMember === true, `${m} ${p}`).toBe(!p.startsWith("/api/admin/"));
    }
  });

  it("keeps a listed or shipped read as it was, and never as a plain member", () => {
    const d = fullAccessDecision("GET", "/api/admin/member-tasks/access", DEFAULT_AGENT_ADMIN_PATHS, SELF, OPEN);
    expect(d).toMatchObject({ ok: true, readOpen: true });
    expect((d as any).asMember).toBeUndefined();
    expect((fullAccessDecision("GET", "/api/sessions", EMPTY, SELF, OPEN) as any).asMember).toBeUndefined();
  });

  it("leaves the seat with reads closed exactly as before, and every other agent too, reads open or not", () => {
    for (const [m, p] of [...READS, ...routes.map((r) => [r.method, r.path] as [string, string])]) {
      expect(fullAccessDecision(m, p, EMPTY, SELF, FULL), `${m} ${p}`).toEqual(fullAccessDecision(m, p, EMPTY, SELF, { fullAccess: true, readsOpen: false }));
      for (const opts of [{}, { readsOpen: true }, { fullAccess: false, readsOpen: true }]) {
        expect(fullAccessDecision(m, p, EMPTY, "agent-1", opts), `${m} ${p}`).toEqual(adminRequestDecision(m, p, EMPTY, "agent-1", {}));
      }
    }
    expect(fullAccessDecision("GET", "/api/org/drafts", EMPTY, SELF, FULL)).toMatchObject({ ok: false, code: "not_allowed" });
  });

  it("changes no write: every write decides exactly as it did with reads closed", () => {
    for (const r of routes.filter((x) => x.method !== "GET")) {
      expect(fullAccessDecision(r.method, r.path, EMPTY, SELF, OPEN), `${r.method} ${r.pattern}`).toEqual(fullAccessDecision(r.method, r.path, EMPTY, SELF, FULL));
    }
  });

  it("does not open the connector's own paths, or a bad path", () => {
    expect(fullAccessDecision("GET", "/api/agent/v1/mcp", EMPTY, SELF, OPEN)).toMatchObject({ ok: false });
    expect(fullAccessDecision("GET", "/api/org/drafts?x=1", EMPTY, SELF, OPEN)).toMatchObject({ ok: false, code: "bad_path" });
    expect(fullAccessDecision("GET", "/api/org/../admin/secrets", EMPTY, SELF, OPEN)).toMatchObject({ ok: false });
    expect(fullAccessDecision("GET", "/health", EMPTY, SELF, OPEN)).toMatchObject({ ok: false });
  });

  // One case per category, each a read the seat's agent is refused with reads open.
  const FLOOR: Array<[string, string]> = [
    ["secrets", "/api/admin/integrations"], ["secrets", "/api/admin/secrets/resend_api_key"], ["secrets", "/api/admin/email-config"], ["secrets", "/api/admin/comms/settings/webhook"],
    ["applicants", "/api/admin/applications"], ["applicants", "/api/admin/join-requests"], ["applicants", "/api/org/applicants/a-1"], ["applicants", "/api/admin/score-cards/s-1"],
    ["money", "/api/admin/payouts"], ["money", "/api/moon-review/payers"], ["money", "/api/admin/invoices/i-1"], ["money", "/api/admin/payments"], ["money", "/api/admin/ledger/rows"], ["money", "/api/admin/treasury"], ["money", "/api/org/role-pay/r-1"], ["money", "/api/wallet"],
    ["contact", "/api/admin/comms/people"], ["contact", "/api/members/contacts"], ["contact", "/api/admin/players/u-1/phone"], ["contact", "/api/org/legal-names"],
    ["signin", "/api/auth/me"], ["signin", "/api/admin/users/u-1/sessions"], ["signin", "/api/oauth/clients"], ["signin", "/api/me/tokens"],
    ["agent_paths", "/api/admin/agent-admin-paths"], ["agent_paths", "/api/admin/agent-accounts/full-access"], ["agent_paths", "/api/admin/agent-actions"],
    ["voice", "/api/admin/applications/a-1/voice"], ["voice", "/api/voice/notes"],
    ["erasure", "/api/admin/erasures"], ["erasure", "/api/admin/players/u-1/anonymize"],
  ];

  for (const [key, p] of FLOOR) {
    it(`refuses a ${key} read: ${p}`, () => {
      expect(fullAccessDecision("GET", p, EMPTY, SELF, OPEN), p).toMatchObject({ ok: false, code: "always_a_person" });
      expect(fullAccessDecision("HEAD", p, EMPTY, SELF, OPEN), p).toMatchObject({ ok: false });
      expect(readFloor(p) ?? fullAccessFloor("GET", p, SELF), p).not.toBeNull();
    });
  }

  it("has a deny-list category for every floor the lead named, and each has a case above", () => {
    expect(READ_FLOOR.map((r) => r.key)).toEqual(["secrets", "applicants", "money", "contact", "signin", "agent_paths", "voice", "erasure"]);
    for (const r of READ_FLOOR) expect(FLOOR.some(([k, p]) => k === r.key && r.test(p)), r.key).toBe(true);
    expect(READS_OPEN_KEPT).toEqual(READ_FLOOR.map((r) => r.words));
  });

  it("fails closed: an unknown path naming a floor word is refused", () => {
    for (const w of ["pay", "secret", "token", "applicant", "application", "invoice", "ledger", "treasury", "payout", "voice", "erasure", "contact", "email-address"]) {
      const p = `/api/brand-new-thing/${w}-summary`;
      expect(readFloor(p), p).not.toBeNull();
      expect(fullAccessDecision("GET", p, EMPTY, SELF, OPEN), p).toMatchObject({ ok: false, code: "always_a_person" });
    }
    expect(READ_FLOOR_WORDS.test("/api/new/Payout-Report")).toBe(true);
  });

  it("opens applicant data only with the Anchor's approval of AI agents, and never voice", () => {
    expect(fullAccessDecision("GET", "/api/admin/applications", EMPTY, SELF, { ...OPEN, applicantDataOpen: true })).toMatchObject({ ok: true, readOpen: true });
    expect(fullAccessDecision("GET", "/api/org/applicant-notes", EMPTY, SELF, { ...OPEN, applicantDataOpen: true })).toMatchObject({ ok: true });
    expect(fullAccessDecision("GET", "/api/admin/applications/a-1/voice", EMPTY, SELF, { ...OPEN, applicantDataOpen: true })).toMatchObject({ ok: false });
  });

  it("walks every registered read: each is refused or opened, and every one naming a floor word is refused", () => {
    let opened = 0;
    let floored = 0;
    for (const r of routes.filter((x) => x.method === "GET" && !x.path.startsWith("/api/agent/"))) {
      const d = fullAccessDecision("GET", r.path, EMPTY, SELF, OPEN);
      if (READ_FLOOR_WORDS.test(r.path) || READ_FLOOR.some((f) => f.test(r.path))) {
        floored++;
        expect(d, r.pattern).toMatchObject({ ok: false });
      } else if (d.ok) {
        opened++;
        expect(d, r.pattern).toMatchObject({ readOpen: true, write: false });
      }
    }
    expect(opened).toBeGreaterThan(100);
    expect(floored).toBeGreaterThan(50);
  });

  it("strips legal names and postal lines from every full-access answer, beside contact keys", () => {
    expect(stripContactData({ name: "Fern", legalName: "Fern A. Oak", legal_name: "x", postalAddress: "1 Road", members: [{ name: "Ivy", email: "ivy@example.test" }] })).toEqual({ name: "Fern", members: [{ name: "Ivy" }] });
  });

  it("reads the switch as closed unless it is exactly true, and keeps it across a missing role", () => {
    expect(parseFullAccessDoc({ roleId: "r-ops", readsOpen: "yes" }).readsOpen).toBe(false);
    expect(parseFullAccessDoc({ roleId: "r-ops", readsOpen: true, readsSetBy: "u-1" })).toMatchObject({ roleId: "r-ops", readsOpen: true, readsSetBy: "u-1" });
    expect(parseFullAccessDoc({ readsOpen: true })).toMatchObject({ roleId: null, readsOpen: true });
    expect(parseFullAccessDoc(null).readsOpen).toBe(false);
  });
});
