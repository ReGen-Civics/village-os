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
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  adminRequestDecision,
  ALWAYS_A_PERSON,
  isFloorCapability,
  leadApprovedBodyProblem,
  leadApprovedEntry,
  LEAD_APPROVAL_WORDS,
  LIFTABLE_RULES,
  MONEY_MODULE_IDS,
  SHIPPED_AGENT_READS,
  stripContactData,
  type AgentAdminPathsDoc,
  type SeatPowerFacts,
} from "./agentAdmin";
import {
  approvalCovers,
  FULL_ACCESS_FLOOR,
  FULL_ACCESS_WORDS,
  fullAccessBodyProblem,
  fullAccessDecision,
  fullAccessFloor,
  namesCode,
  parseFullAccessDoc,
} from "./agentFullAccess";
import { BADGE_GRANTABLE, BREAK_GLASS_SEAT } from "./capabilities";
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
    ["settings", "POST", "/api/admin/comms/letters/l-1/send"],
    ["settings", "PUT", "/api/admin/email-config"],
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

  it("keeps money, email, sign-in and connector variables, and every agents. key, a person's", () => {
    for (const k of ["gratitude.pool_per_cycle", "redemption.fee_pct", "exit.keep_pct.credit", "comms.daily_cap", "auth.session_days", "agents.lead_approved_writes", "no.such_key"]) {
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
