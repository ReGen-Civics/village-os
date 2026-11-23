/**
 * THE FOUNDING SECTIONS AND THE FOUNDING TEAM over real HTTP against a real
 * database (phase A, lane A3).
 *
 *   1. the editor saves the founding sections beside the draft, through the
 *      editor's own gate, and a member without the power is refused (control:
 *      the holder's same save succeeds);
 *   2. an amount on the pay is refused in words and nothing is written;
 *   3. anyone reads a LISTED role's sections, with the village's pay shape and
 *      who last edited it; an unlisted role answers 404 to a visitor (control:
 *      the editor reads it);
 *   4. the founding team features only the listed roles the setting names, in
 *      its order, and nothing while the setting is off.
 */
import http from "node:http";
import express from "express";
import type mysql from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "../db/testDb";
import { capabilityDecision, type Capability, type CapabilityCtx } from "../../shared/capabilities";
import type { SubjectCloser } from "../lib/applyDue";
import { addChange, createDraft, publishDraft } from "../lib/orgDrafts";
import { seatHolder } from "../lib/orgChart";
import { insertApplication } from "../repos/seatApplications";
import { register } from "./orgDraftDecide";
import { loadVariables } from "../lib/variables";

const configured = testDbConfigured();

let db: TestDb;
let pool: mysql.Pool;
let server: http.Server;
let base = "";

const USERS: Record<string, { id: string; name: string; role: string }> = {
  "holder-1": { id: "holder-1", name: "Holder One", role: "member" },
  "member-1": { id: "member-1", name: "Member One", role: "member" },
  "admin-1": { id: "admin-1", name: "Admin One", role: "admin" },
  // Signed in below the member stage, so without `terms.read`: the setting hides pay from them.
  "guest-1": { id: "guest-1", name: "Guest One", role: "member" },
};
let holders = new Set<string>();
const closers: Record<string, SubjectCloser> = {};
const SEASON = { current: { id: "s1" }, seasons: [{ id: "s1", startsOn: "2026-01-01", endsOn: "2030-01-01" }], timezone: "UTC" };

const userOf = async (req: any) => USERS[String(req.headers["x-user"] ?? "")] ?? null;
const ctxOf = async (user: any): Promise<CapabilityCtx> => ({
  stageIndex: user.id === "guest-1" ? -1 : 0,
  stageIndexOf: () => 0,
  roleCapabilities: holders.has(String(user.id)) ? ["org.decide"] : [],
  isAdmin: user.role === "admin",
  villageHeld: [],
});
async function guard(req: any, res: any, cap: Capability, refusal?: { status: number; body: Record<string, unknown> }) {
  const user = await userOf(req);
  if (!user) {
    res.status(401).json({ error: "auth_required" });
    return false;
  }
  const d = capabilityDecision(cap, await ctxOf(user));
  if (d.allowed) return true;
  res.status(refusal?.status ?? 401).json(refusal?.body ?? { error: "auth_required" });
  return false;
}

async function call(method: string, route: string, user: string | null, body?: unknown) {
  const r = await fetch(base + route, { // module-review-ok: the test client dialling its own server on localhost
    method,
    headers: { "Content-Type": "application/json", ...(user ? { "x-user": user } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const type = r.headers.get("content-type") ?? "";
  return { status: r.status, json: type.includes("json") ? ((await r.json().catch(() => null)) as any) : null, text: type.includes("json") ? "" : await r.text() };
}

let seq = 0;
/** A circle and a role in it, through the same drafts a village's chart is made with. */
async function seedRole(extra: Record<string, unknown> = {}): Promise<{ id: string; circle: string }> {
  seq += 1;
  const circle = `rt-circle-${seq}`;
  const id = `rt-role-${seq}`;
  const made = await createDraft(pool, { title: `Seed ${seq}`, createdBy: "admin-1", sourceKind: "human", openCap: null });
  if (!made.ok) throw new Error(made.error);
  const add = async (op: any, orgRoleId: string, payload: any) => {
    const r = await addChange(pool, made.id, { op, orgRoleId, payload });
    if (!r.ok) throw new Error(r.error);
  };
  await add("create_circle", `circle:${circle}`, { name: `Reading Circle ${seq}` });
  await add("create_seat", id, { name: `Reader ${seq}`, circleId: circle, aim: "Old aim", domain: "Old domain", ...extra });
  const pub = await publishDraft(pool, made.id, "admin-1", null);
  if (!pub.ok) throw new Error(pub.error);
  return { id, circle };
}

const row = async (id: string) => {
  const [rows]: any = await pool.query("SELECT aim, domain, recruiting, terms_offer, terms_offer_by FROM org_roles WHERE id = ?", [id]); // module-review-ok: a test reading the table it asserts on
  return rows[0];
};


async function setVar(key: string, value: string | null) {
  if (value === null) await pool.query("DELETE FROM game_variables WHERE config_key = ?", [key]); // module-review-ok: a test setting the village's dial
  else await pool.query("INSERT INTO game_variables (config_key, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)", [key, value]); // module-review-ok: a test setting the village's dial
  await loadVariables(pool);
}

const SECTIONS = {
  idealBackground: ["Ideally studied finance"],
  qualities: ["Owns the whole domain", "In it for the long run"],
  aiSupport: "An AI companion keeps the books moving.",
  aiCompanion: "Heron",
  paid: true,
  payShape: [],
  payNote: "",
};

describe.skipIf(!configured)("the founding sections and the founding team", () => {
  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 6 });
    const app = express();
    app.use(express.json());
    register(app, {
      authedUser: userOf,
      isAdmin: async (req: any) => (await userOf(req))?.role === "admin",
      guardCapability: guard,
      capabilityCtx: ctxOf,
      getPool: () => pool,
      notify: async () => ({}) as any,
      seasonState: () => SEASON,
      circlesRepo: { load: async () => {}, all: () => [] },
      liveHoldersOf: async () => Array.from(holders),
      overLimit: async () => false,
      ballotSetup: async () => ({}) as any,
      notifyRoll: async () => 0,
      governanceOn: () => true,
      closers,
    } as any);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("the test server did not report a port");
    base = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    await pool?.end();
    await db?.drop();
  });

  beforeEach(async () => {
    holders = new Set();
    for (const k of ["org.founding_team", "org.founding_team_roles", "org.pay_shape", "org.pay_shape_at_risk", "org.pay_shape_note", "org.show_pay_ranges", "org.pay_split_amounts"]) await setVar(k, null);
  });

  it("the editor saves the sections beside the draft; a member without the power is refused (control: the holder's same save)", async () => {
    const { id } = await seedRole();
    const refused = await call("POST", `/api/org/role-edit/${id}`, "member-1", { sections: SECTIONS });
    expect(refused.status).toBe(403);
    expect((await call("GET", `/api/org/role-card/${id}`, null)).json.sections).toBeNull();
    holders = new Set(["holder-1"]);
    const saved = await call("POST", `/api/org/role-edit/${id}`, "holder-1", { sections: SECTIONS });
    expect(saved.status).toBe(200);
    expect(saved.json.changed).toEqual(["Who we hope for, and how pay works"]);
    expect(saved.json.state.sections.qualities).toEqual(SECTIONS.qualities);
    // The same set again changes nothing, and says so.
    expect((await call("POST", `/api/org/role-edit/${id}`, "holder-1", { sections: SECTIONS })).status).toBe(400);
    const read = await call("GET", `/api/org/role-card/${id}`, null);
    expect(read.status).toBe(200);
    expect(read.json.sections.aiCompanion).toBe("Heron");
    expect(read.json.lastEdited.on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // A visitor is told the day, never a name, while people are not public to strangers.
    await setVar("org.public_people", "false");
    expect((await call("GET", `/api/org/role-card/${id}`, null)).json.lastEdited.by).toBeNull();
    await setVar("org.public_people", null);
  });

  it("saves dated deliverables and onboarding steps, refuses a bad date, and sends the words every card shares (the lead, 19 Nov 2026)", async () => {
    const { id } = await seedRole();
    holders = new Set(["holder-1"]);
    const rows = [{ title: "Budget agreed", start: "2027-01-05", end: "2027-01-31", workstream: "Budget" }];
    const bad = await call("POST", `/api/org/role-edit/${id}`, "holder-1", { sections: { deliverables: [{ title: "x", start: "2027-02-30", end: "2027-03-01" }] } });
    expect(bad.status).toBe(400);
    const saved = await call("POST", `/api/org/role-edit/${id}`, "holder-1", { sections: { deliverables: rows, onboarding: ["Meet the circle"] } });
    expect(saved.status).toBe(200);
    await setVar("org.role_card_rhythm", "Weekly: Monday team meeting\nEach moon: new moon recap");
    await setVar("org.role_card_onboarding", "Village step");
    const read = await call("GET", `/api/org/role-card/${id}`, null);
    expect(read.json.sections.deliverables).toEqual(rows);
    expect(read.json.sections.onboarding).toEqual(["Meet the circle"]);
    expect(read.json.shared).toEqual({ lines: [], rhythm: ["Weekly: Monday team meeting", "Each moon: new moon recap"], onboarding: ["Village step"] });
    // A later part leaves the deliverables as they were.
    expect((await call("POST", `/api/org/role-edit/${id}`, "holder-1", { sections: { qualities: ["Calm"] } })).status).toBe(200);
    expect((await call("GET", `/api/org/role-card/${id}`, null)).json.sections.deliverables).toEqual(rows);
    await setVar("org.role_card_rhythm", null);
    await setVar("org.role_card_onboarding", null);
  });

  it("saves the last day to apply, refuses a day that is not real, and a blank clears it (the lead, 23 Nov 2026)", async () => {
    const { id } = await seedRole();
    holders = new Set(["holder-1"]);
    const bad = await call("POST", `/api/org/role-edit/${id}`, "holder-1", { sections: { applyBy: "2026-11-31" } });
    expect(bad.status).toBe(400);
    expect((await call("POST", `/api/org/role-edit/${id}`, "holder-1", { sections: { applyBy: "2026-11-30" } })).status).toBe(200);
    expect((await call("GET", `/api/org/role-card/${id}`, null)).json.sections.applyBy).toBe("2026-11-30");
    expect((await call("POST", `/api/org/role-edit/${id}`, "holder-1", { sections: { applyBy: "" } })).status).toBe(200);
    // The date was the card's only section, so the card reads as having none.
    expect((await call("GET", `/api/org/role-card/${id}`, null)).json.sections?.applyBy).toBeUndefined();
  });

  it("a part of the sections changes that part alone, and the pay sections stay as they were (Rye, 15 Nov 2026)", async () => {
    const { id } = await seedRole();
    holders = new Set(["holder-1"]);
    const full = { ...SECTIONS, paySplitNote: "To be decided in onboarding.", payCeiling: { amount: 9000, currency: "USD", per: "month" } };
    expect((await call("POST", `/api/org/role-edit/${id}`, "holder-1", { sections: full })).status).toBe(200);
    const part = await call("POST", `/api/org/role-edit/${id}`, "holder-1", { sections: { idealBackground: ["Ideally, you studied finance or law"] } });
    expect(part.status).toBe(200);
    expect(part.json.state.sections).toMatchObject({
      idealBackground: ["Ideally, you studied finance or law"],
      qualities: SECTIONS.qualities,
      aiCompanion: "Heron",
      paid: true,
      paySplitNote: "To be decided in onboarding.",
      payCeiling: { amount: 9000, currency: "USD", per: "month" },
    });
  });

  it("refuses an amount on the pay in words, and writes nothing", async () => {
    const { id } = await seedRole();
    holders = new Set(["holder-1"]);
    const r = await call("POST", `/api/org/role-edit/${id}`, "holder-1", { sections: { ...SECTIONS, payNote: "6,750 to 9,000 USD a month" } });
    expect(r.status).toBe(400);
    expect(r.json.fields).toEqual(["sections.payNote"]);
    expect((await call("GET", `/api/org/role-card/${id}`, null)).json.sections).toBeNull();
  });

  it("serves the village's pay shape with every card, and keeps an unlisted role from a visitor (control: the editor reads it)", async () => {
    await setVar("org.pay_shape", "Cash 40, Equity 55, Credits 5");
    await setVar("org.pay_shape_note", "Indicative only. Terms are subject to legal review.");
    const open = await seedRole();
    const hidden = await seedRole({ listed: false });
    const r = await call("GET", `/api/org/role-card/${open.id}`, null);
    expect(r.json.villagePay.shape).toEqual([
      { label: "Cash", pct: 40 },
      { label: "Equity", pct: 55 },
      { label: "Credits", pct: 5 },
    ]);
    expect(r.json.villagePay.note).toBe("Indicative only. Terms are subject to legal review.");
    expect(r.json.showPayRanges).toBe(false);
    expect((await call("GET", `/api/org/role-card/${hidden.id}`, null)).status).toBe(404);
    expect((await call("GET", `/api/org/role-card/${hidden.id}`, "member-1")).status).toBe(404);
    holders = new Set(["holder-1"]);
    expect((await call("GET", `/api/org/role-card/${hidden.id}`, "holder-1")).status).toBe(200);
  });

  it("features only the listed roles the setting names, in its order, and nothing while off", async () => {
    const a = await seedRole();
    const b = await seedRole();
    const hidden = await seedRole({ listed: false });
    await setVar("org.founding_team_roles", `${b.id}, ${hidden.id}, nobody, ${a.id}`);
    expect((await call("GET", "/api/org/founding-team", null)).json).toMatchObject({ on: false, roleIds: [] });
    await setVar("org.founding_team", "true");
    const on = await call("GET", "/api/org/founding-team", null);
    expect(on.json.on).toBe(true);
    expect(on.json.roleIds).toEqual([b.id, a.id]);
    // The names travel with the ids, for the steward page's band, and only the featured roles' names.
    expect(on.json.names).toEqual({ [b.id]: `Reader ${b.id.split("-").pop()}`, [a.id]: `Reader ${a.id.split("-").pop()}` });
    await setVar("org.founding_team", null);
    expect((await call("GET", "/api/org/founding-team", null)).json.names).toEqual({});
  });

  it("shows anyone the current team: the founding circle's filled roles, unlisted ones too, holders by first name only while names are public", async () => {
    const lead = await seedRole();
    // Two more roles in the lead's circle: one filled and unlisted, one filled by an agent alone.
    const made = await createDraft(pool, { title: "Team", createdBy: "admin-1", sourceKind: "human", openCap: null });
    if (!made.ok) throw new Error(made.error);
    const ops = `${lead.id}-ops`;
    const bot = `${lead.id}-bot`;
    for (const [id, name, extra] of [[ops, "Operations Steward", { listed: false }], [bot, "Secretary", {}]] as const) {
      const r = await addChange(pool, made.id, { op: "create_seat", orgRoleId: id, payload: { name, circleId: lead.circle, aim: "a", domain: "d", ...extra } });
      if (!r.ok) throw new Error(r.error);
    }
    const pub = await publishDraft(pool, made.id, "admin-1", null);
    if (!pub.ok) throw new Error(pub.error);
    await seatHolder(pool, ops, { displayName: "Ana Lima" });
    await seatHolder(pool, bot, { displayName: "AI Secretary", isAgent: true } as any);
    await setVar("org.founding_team_roles", lead.id);
    await setVar("org.founding_team", "true");
    await setVar("org.public_people", "true");
    expect((await call("GET", "/api/org/founding-team", null)).json.team).toEqual([{ id: ops, name: "Operations Steward", holders: ["Ana"] }]);
    // How full each role is (Rye, 14 Nov 2026): the open lead holds nothing yet; the filled role is covered by a holder with no stated share.
    const fill = (await call("GET", "/api/org/founding-team", null)).json.fill;
    expect(fill[lead.id]).toEqual({ heldPct: 0, targetPct: 100, openPct: 100, covered: false });
    // One named holder: covered or open only, never their share (security sweep L3).
    expect(fill[ops]).toEqual({ coarse: true, targetPct: 100, covered: true });
    // A holder seated through a seat application whose terms state a commitment holds that share (Rye, 14 Nov 2026).
    await insertApplication(pool, {
      id: `${lead.id}-app`,
      candidateUserId: "u-shared",
      proposedBy: "u-shared",
      seatIds: [lead.id],
      note: null,
      deliverables: null,
      settings: { clocks: { commitmentPct: 50 } } as any,
      settingsHash: "h",
      termEndsAt: new Date("2027-01-01T00:00:00Z"),
      termSeasonId: null,
      termFollowsSeason: false,
      startsAt: null,
      status: "adopted",
    });
    await seatHolder(pool, lead.id, { displayName: "Ines Shared", applicationId: `${lead.id}-app` });
    const shared = (await call("GET", "/api/org/founding-team", null)).json.fill;
    // Ines alone holds it and names are public, so her 50% never goes out: only "open" (security sweep L3).
    expect(shared[lead.id]).toEqual({ coarse: true, targetPct: 100, covered: false });
    expect(JSON.stringify(shared[lead.id])).not.toContain("50");
    // A second holder: the arithmetic is the role's again, exact.
    await seatHolder(pool, lead.id, { displayName: "Jo Second" });
    expect((await call("GET", "/api/org/founding-team", null)).json.fill[lead.id]).toEqual({ heldPct: 150, targetPct: 100, openPct: 0, covered: true });
    // CONTROL: a village that keeps its people for members still shows the role, with no name.
    await setVar("org.public_people", "false");
    expect((await call("GET", "/api/org/founding-team", null)).json.team).toEqual([{ id: ops, name: "Operations Steward", holders: [] }]);
    // CONTROL: with no names shown, one holder's share is nobody's in particular, and stays exact.
    expect((await call("GET", "/api/org/founding-team", null)).json.fill[ops]).toEqual({ heldPct: 100, targetPct: 100, openPct: 0, covered: true });
    for (const k of ["org.public_people", "org.founding_team", "org.founding_team_roles"]) await setVar(k, null);
  });

  // THE PAY CEILING FOLLOWS org.show_pay_ranges (privacy finding, 15 Nov 2026): off, the key is ABSENT for a
  // visitor and for a signed-in reader without `terms.read`; on, everyone reads it; an admin, a holder of
  // `terms.read` and the editor read it either way.
  const CEILING = { amount: 13000, currency: "USD", per: "month" };
  async function rolePricedAt13000(): Promise<string> {
    const { id } = await seedRole();
    holders = new Set(["holder-1"]);
    expect((await call("POST", `/api/org/role-edit/${id}`, "holder-1", { sections: { ...SECTIONS, payCeiling: CEILING } })).status).toBe(200);
    holders = new Set();
    return id;
  }

  it("GET /api/org/role-card/:id: off, no ceiling key for a visitor or a reader without terms.read; on, present; an admin, a terms.read member and the editor read it", async () => {
    const id = await rolePricedAt13000();
    const card = async (who: string | null) => (await call("GET", `/api/org/role-card/${id}`, who)).json;
    for (const who of [null, "guest-1"]) {
      const r = await card(who);
      expect(r.sections.aiCompanion).toBe("Heron");
      expect("payCeiling" in r.sections).toBe(false);
      expect(JSON.stringify(r)).not.toContain("13000");
    }
    expect((await card("admin-1")).sections.payCeiling).toEqual(CEILING);
    expect((await card("member-1")).sections.payCeiling).toEqual(CEILING);
    holders = new Set(["holder-1"]);
    expect((await card("holder-1")).sections.payCeiling).toEqual(CEILING);
    holders = new Set();
    await setVar("org.show_pay_ranges", "true");
    expect((await card(null)).sections.payCeiling).toEqual(CEILING);
    expect((await card("guest-1")).sections.payCeiling).toEqual(CEILING);
  });

  it("GET /api/org/founding-team: off, no ceiling key for a visitor or a reader without terms.read; on, present; an admin reads it", async () => {
    const id = await rolePricedAt13000();
    await setVar("org.founding_team_roles", id);
    await setVar("org.founding_team", "true");
    const team = async (who: string | null) => (await call("GET", "/api/org/founding-team", who)).json;
    for (const who of [null, "guest-1"]) {
      const r = await team(who);
      expect(r.sections[id].qualities).toEqual(SECTIONS.qualities);
      expect("payCeiling" in r.sections[id]).toBe(false);
      expect(JSON.stringify(r)).not.toContain("13000");
    }
    expect((await team("admin-1")).sections[id].payCeiling).toEqual(CEILING);
    expect((await team("member-1")).sections[id].payCeiling).toEqual(CEILING);
    await setVar("org.show_pay_ranges", "true");
    expect((await team(null)).sections[id].payCeiling).toEqual(CEILING);
    for (const k of ["org.founding_team", "org.founding_team_roles"]) await setVar(k, null);
  });

  it("a card whose only section is its ceiling reads as no sections to a visitor while pay is hidden", async () => {
    const { id } = await seedRole();
    holders = new Set(["holder-1"]);
    expect((await call("POST", `/api/org/role-edit/${id}`, "holder-1", { sections: { payCeiling: CEILING } })).status).toBe(200);
    holders = new Set();
    expect((await call("GET", `/api/org/role-card/${id}`, null)).json.sections).toBeNull();
    expect((await call("GET", `/api/org/role-card/${id}`, "admin-1")).json.sections.payCeiling).toEqual(CEILING);
  });

  // A CARD'S OWN CHOICE (founding team, 16 Nov 2026): "show" opens the ceiling to everyone with the village switch
  // off, "hide" closes it to all but admins and the card's editors with the switch on, and back to "village" follows it.
  async function chooseVisibility(id: string, payVisibility: string) {
    holders = new Set(["holder-1"]);
    const r = await call("POST", `/api/org/role-edit/${id}`, "holder-1", { sections: { payVisibility } });
    holders = new Set();
    return r;
  }

  it("GET /api/org/role-card/:id: show reaches a visitor while the switch is off; hide keeps it from a visitor, a guest and a terms.read member while it is on", async () => {
    const id = await rolePricedAt13000();
    const card = async (who: string | null) => (await call("GET", `/api/org/role-card/${id}`, who)).json;
    expect((await chooseVisibility(id, "show")).status).toBe(200);
    for (const who of [null, "guest-1"]) {
      const r = await card(who);
      expect(r.sections.payCeiling).toEqual(CEILING);
      // Who-sees is the editors' business: a reader never receives the choice itself.
      expect("payVisibility" in r.sections).toBe(false);
    }
    expect((await chooseVisibility(id, "hide")).status).toBe(200);
    await setVar("org.show_pay_ranges", "true");
    for (const who of [null, "guest-1", "member-1"]) {
      const r = await card(who);
      expect("payCeiling" in r.sections).toBe(false);
      expect(JSON.stringify(r)).not.toContain("13000");
    }
    expect((await card("admin-1")).sections.payCeiling).toEqual(CEILING);
    expect((await card("admin-1")).sections.payVisibility).toBe("hide");
    holders = new Set(["holder-1"]);
    expect((await card("holder-1")).sections.payCeiling).toEqual(CEILING);
    holders = new Set();
    // Back to the village: the switch decides again, and nothing is stored for the choice.
    expect((await chooseVisibility(id, "village")).status).toBe(200);
    expect((await card(null)).sections.payCeiling).toEqual(CEILING);
    expect("payVisibility" in (await card("admin-1")).sections).toBe(false);
  });

  it("GET /api/org/founding-team follows each card's own choice, and a choice outside the list is refused", async () => {
    const id = await rolePricedAt13000();
    await setVar("org.founding_team_roles", id);
    await setVar("org.founding_team", "true");
    const team = async (who: string | null) => (await call("GET", "/api/org/founding-team", who)).json;
    expect((await chooseVisibility(id, "show")).status).toBe(200);
    expect((await team(null)).sections[id].payCeiling).toEqual(CEILING);
    expect((await chooseVisibility(id, "hide")).status).toBe(200);
    await setVar("org.show_pay_ranges", "true");
    expect("payCeiling" in (await team(null)).sections[id]).toBe(false);
    expect("payCeiling" in (await team("member-1")).sections[id]).toBe(false);
    expect((await team("admin-1")).sections[id].payCeiling).toEqual(CEILING);
    expect((await chooseVisibility(id, "everyone")).status).toBe(400);
    for (const k of ["org.founding_team", "org.founding_team_roles"]) await setVar(k, null);
  });

  it("the village's split switch reaches every reader in villagePay, and a card's own wording is kept on its sections", async () => {
    const id = await rolePricedAt13000();
    expect((await call("GET", `/api/org/role-card/${id}`, null)).json.villagePay.splitAmounts).toBeUndefined();
    await setVar("org.pay_split_amounts", "true");
    expect((await call("GET", `/api/org/role-card/${id}`, null)).json.villagePay.splitAmounts).toBe(true);
    holders = new Set(["holder-1"]);
    expect((await call("POST", `/api/org/role-edit/${id}`, "holder-1", { sections: { payWording: "total" } })).status).toBe(200);
    holders = new Set();
    expect((await call("GET", `/api/org/role-card/${id}`, "admin-1")).json.sections.payWording).toBe("total");
  });
});
