/**
 * "PUT IT TO THE VILLAGE" FOR AN ORG CHART DRAFT, over real HTTP against a real
 * database: the `org.decide` doors, the `org_draft` ballot, and its closer.
 *
 * The gate in this harness is the REAL `capabilityDecision` from
 * shared/capabilities.ts, fed a context this file controls: a member in
 * `holders` carries `org.decide` through a role, `villageHeld` is the
 * `capability_holding` list, and an admin is an admin. `liveHoldersOf` answers
 * the same set, which is what `liveHoldersOfCapability` would count from those
 * role rows. So what is under test is the doors' reading of the gate's answer,
 * and never a stub that agrees with them by construction.
 *
 * Order matters for one thing only: the launch vote is recorded in the last
 * block, because a Game cannot be un-started (server/lib/gameStart.ts).
 */
import http from "node:http";
import express from "express";
import type mysql from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "../db/testDb";
import { capabilityDecision, type Capability, type CapabilityCtx } from "../../shared/capabilities";
import type { SubjectCloser } from "../lib/applyDue";
import { ballotById, castVote } from "../lib/ballots";
import { readGameStart } from "../lib/gameStart";
import { recordLaunchCarried } from "../lib/launch";
import { addChange, createDraft, getDraft, previewDraft, setDraftVision, withdrawDraft } from "../lib/orgDrafts";
import {
  decideStanding,
  ORG_DRAFT,
  putToVillageRefusal,
  withdrawDraftBallot,
} from "../lib/orgDraftDecide";
import { arrangeViewer, register } from "./orgDraftDecide";
import { register as registerOrg } from "./org";

const configured = testDbConfigured();

let db: TestDb;
let pool: mysql.Pool;
let server: http.Server;
let base = "";

const USERS: Record<string, { id: string; name: string; role: string }> = {
  "holder-1": { id: "holder-1", name: "Holder One", role: "member" },
  "member-1": { id: "member-1", name: "Member One", role: "member" },
  "admin-1": { id: "admin-1", name: "Admin One", role: "admin" },
};
let holders = new Set<string>();
let villageHeld: string[] = [];
/** Members below every stage, so a stage-opened power (`terms.read`) is not theirs. */
let belowStages = new Set<string>();
let governance = true;
let reloads = 0;
let notices: Array<{ userId: string; type: string; title: string; dedupeKey: string }> = [];
const closers: Record<string, SubjectCloser> = {};

const SEASON = {
  current: { id: "s1" },
  seasons: [{ id: "s1", startsOn: "2026-01-01", endsOn: "2030-01-01" }],
  timezone: "UTC",
};

const userOf = async (req: any) => USERS[String(req.headers["x-user"] ?? "")] ?? null;
const ctxOf = async (user: any): Promise<CapabilityCtx> => ({
  stageIndex: belowStages.has(String(user.id)) ? -1 : 0,
  stageIndexOf: () => 0,
  roleCapabilities: holders.has(String(user.id)) ? ["org.decide"] : [],
  isAdmin: user.role === "admin",
  villageHeld,
});
async function guard(req: any, res: any, cap: Capability, refusal?: { status: number; body: Record<string, unknown> }) {
  const user = await userOf(req);
  if (!user) {
    res.status(401).json({ error: "auth_required" });
    return false;
  }
  const ctx = await ctxOf(user);
  const d = capabilityDecision(cap, { ...ctx, adminOverride: req.headers["x-capability-override"] === "1" });
  if (d.allowed) return true;
  if (d.villageHolds && ctx.isAdmin) {
    res.status(409).json({ requiresOverride: true });
    return false;
  }
  res.status(refusal?.status ?? 401).json(refusal?.body ?? { error: "auth_required" });
  return false;
}

async function call(method: string, route: string, user: string, body?: unknown) {
  const r = await fetch(base + route, { // module-review-ok: the test client dialling its own server on localhost
    method,
    headers: { "Content-Type": "application/json", "x-user": user },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, json: (await r.json().catch(() => null)) as any };
}

let seq = 0;
/**
 * A draft that carries everything the ballot must never show: a free-text
 * title and rationale, and a seating that names a person. Its circle and seat
 * names are the only words the village is allowed to read.
 */
async function makeDraft(opts: { blocked?: boolean } = {}): Promise<{ id: string; circle: string; seat: string }> {
  seq += 1;
  const circle = `Kitchen Circle ${seq}`;
  const seat = `Head Cook ${seq}`;
  const made = await createDraft(pool, {
    title: `Secret Plan Wombat ${seq}`,
    rationale: "Because Maybelline Thistlewood said so in the meeting",
    createdBy: "admin-1",
    sourceKind: "human",
    openCap: null,
  });
  if (!made.ok) throw new Error(made.error);
  const add = async (op: any, orgRoleId: string, payload: any) => {
    const r = await addChange(pool, made.id, { op, orgRoleId, payload });
    if (!r.ok) throw new Error(r.error);
  };
  await add("create_circle", `circle:kitchen-${seq}`, { name: circle });
  await add("create_seat", `head-cook-${seq}`, { name: seat, circleId: opts.blocked ? "no-such-circle" : `kitchen-${seq}` });
  await add("seat_holder", `head-cook-${seq}`, { userId: "member-1", displayName: "Zephyrine Quillfeather" });
  return { id: made.id, circle, seat };
}

describe.skipIf(!configured)("org.decide: who adopts a reorganisation", () => {
  beforeAll(async () => {
    /*
     * The harness default on purpose: a `game-start` row reading `bal-fixture`,
     * the same village every e2e suite boots. That row is not a launch vote,
     * and reading it as one turned the admin door off everywhere (PR #495's
     * first CI run). The launch vote is recorded by the last block.
     */
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 });
    const app = express();
    app.use(express.json());
    const shared = {
      authedUser: userOf,
      isAdmin: async (req: any) => (await userOf(req))?.role === "admin",
      guardCapability: guard,
      capabilityCtx: ctxOf,
      getPool: () => pool,
      notify: async (n: any) => {
        notices.push(n);
        return {} as any;
      },
      seasonState: () => SEASON,
      circlesRepo: { load: async () => { reloads += 1; }, all: () => [] },
      liveHoldersOf: async () => Array.from(holders),
    };
    register(app, {
      ...(shared as any),
      overLimit: async () => false,
      ballotSetup: async () => ({
        method: "majority",
        dials: { unityPct: 50, quorumPct: 0 },
        snapshot: { mode: "equal", token: null },
        tokenProblem: null,
        electorate: Object.keys(USERS).map((userId) => ({ userId, weight: 1 })),
        durationDays: 7,
      }),
      notifyRoll: async () => 0,
      governanceOn: () => governance,
      closers,
    });
    registerOrg(app, {
      ...(shared as any),
      members: { all: async () => [] },
      firstName: (n: string) => n,
      lapseContext: () => ({}),
      currentPatternId: () => null,
      notifyAdmins: async () => {},
      submissionsRepo: { all: () => [] },
    });
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

  beforeEach(() => {
    holders = new Set();
    villageHeld = [];
    belowStages = new Set();
    governance = true;
    reloads = 0;
    notices = [];
  });

  describe("the predicate (Rye, 2026-09-14 and 2026-09-23)", () => {
    it("nobody holds it: any member may put it to the village, and nobody publishes", () => {
      const s = decideStanding({ villageHeld: [] }, []);
      expect([s.rule.who, s.rule.because]).toEqual(["any-member", "nobody-holds-it"]);
      expect(putToVillageRefusal(s, "member-1")).toBeNull();
    });

    it("a role holds it: only its holder may put it to the village", () => {
      const s = decideStanding({ villageHeld: [] }, ["holder-1"]);
      expect([s.rule.who, s.rule.because]).toEqual(["live-holders", "a-role-holds-it"]);
      expect(putToVillageRefusal(s, "holder-1")).toBeNull();
      expect(putToVillageRefusal(s, "member-1")?.status).toBe(403);
    });

    it("the village holds it: any member may, holders or not", () => {
      const s = decideStanding({ villageHeld: ["org.decide"] }, ["holder-1"]);
      expect([s.rule.who, s.rule.because, s.villageHolds]).toEqual(["any-member", "village-holds-it", true]);
      expect(putToVillageRefusal(s, "member-1")).toBeNull();
    });
  });

  describe("the decide read", () => {
    it("says a ballot is needed when nobody holds the power", async () => {
      const d = await makeDraft();
      const r = await call("GET", `/api/org/drafts/${d.id}/decide`, "member-1");
      expect(r.status).toBe(200);
      expect(r.json).toMatchObject({
        status: "open", blocked: 0, holderCount: 0, ballotNeeded: true,
        youMayPublish: false, youMayPutToVillage: true, adminMayPublish: false, ballot: null, launched: false,
      });
      expect((await call("GET", `/api/org/drafts/${d.id}/decide`, "admin-1")).json.adminMayPublish).toBe(true);
      expect((await call("GET", `/api/org/drafts/${d.id}/decide`, "")).status).toBe(401);
    });

    it("says a holder may publish and a member may not put it up", async () => {
      holders = new Set(["holder-1"]);
      const d = await makeDraft();
      const h = await call("GET", `/api/org/drafts/${d.id}/decide`, "holder-1");
      expect(h.json).toMatchObject({ holderCount: 1, ballotNeeded: false, youHoldThePower: true, youMayPublish: true, youMayPutToVillage: true });
      const m = await call("GET", `/api/org/drafts/${d.id}/decide`, "member-1");
      expect(m.json).toMatchObject({ youMayPublish: false, youMayPutToVillage: false, whoMayPutToVillage: "live-holders" });
      // The read names how many hold it, never who.
      expect(JSON.stringify(m.json)).not.toContain("holder-1");
    });
  });

  describe("the draft page's read (GET /api/org/drafts/:id/view)", () => {
    /** A live role to edit, and an open draft that edits its purpose, its list, and its terms. */
    async function roleAndEdit(by = "admin-1", withTerms = true) {
      seq += 1;
      const roleId = `land-steward-${seq}`;
      await pool.query( // module-review-ok: the test seeds a live role for a draft to edit, the one fixture no draft route makes
        "INSERT INTO org_roles (id, name, aim, domain, accountabilities, seats) VALUES (?,?,?,?,?,1)",
        [roleId, `Land Steward ${seq}`, "Steward the land so the project grows within what the watershed can carry.", "The land plan.", JSON.stringify(["Keeps the land plan current.", "Signs off every construction contract.", "Holds the permits."])],
      );
      const made = await createDraft(pool, { title: `Edit Land Steward ${seq}`, rationale: null, createdBy: by, sourceKind: "human", openCap: null });
      if (!made.ok) throw new Error(made.error);
      const r = await addChange(pool, made.id, {
        op: "update_seat",
        orgRoleId: roleId,
        payload: {
          aim: "Steward the land so the village grows within what the watershed can carry.",
          accountabilities: ["Keeps the land plan current.", "Brings large contracts to the finance role.", "Holds the permits."],
          ...(withTerms ? { termsOffer: { pay: { kind: "stipend", note: "Seventeen hundred a moon" } } } : {}),
        },
      });
      if (!r.ok) throw new Error(r.error);
      return { roleId, draftId: made.id, changeId: r.id };
    }

    it("shows each changed field before and after, in words and in lines, and folds the rest", async () => {
      holders = new Set(["holder-1"]);
      const { draftId, changeId, roleId } = await roleAndEdit();
      const r = await call("GET", `/api/org/drafts/${draftId}/view`, "holder-1");
      expect(r.status).toBe(200);
      expect(r.json.changeIds).toEqual([changeId]);
      const [c] = r.json.changes;
      expect(c).toMatchObject({ kind: "edit", targetId: roleId, holders: null });
      expect(c.target).toMatch(/^Land Steward /);
      const aim = c.fields.find((f: any) => f.field === "aim");
      expect(aim.shape).toBe("text");
      expect(aim.runs.filter((x: any) => x.op !== "same")).toEqual([
        { op: "del", text: "project" },
        { op: "add", text: "village" },
      ]);
      const acc = c.fields.find((f: any) => f.field === "accountabilities");
      expect(acc.shape).toBe("list");
      expect(acc.runs).toEqual([
        { op: "same", text: "Keeps the land plan current." },
        { op: "del", text: "Signs off every construction contract." },
        { op: "add", text: "Brings large contracts to the finance role." },
        { op: "same", text: "Holds the permits." },
      ]);
      expect(c.unchanged).toContain("domain");
      expect(c.unchanged).not.toContain("aim");
    });

    it("tells a reader who may not read terms only that they change, and a reader who may, how", async () => {
      holders = new Set(["holder-1"]);
      belowStages = new Set(["holder-1"]);
      const { draftId } = await roleAndEdit();
      const r = await call("GET", `/api/org/drafts/${draftId}/view`, "holder-1");
      const terms = r.json.changes[0].fields.find((f: any) => f.field === "termsOffer");
      expect(terms).toMatchObject({ shape: "terms", hidden: true, before: null, after: null, runs: [] });
      expect(JSON.stringify(r.json)).not.toContain("Seventeen hundred");
      belowStages = new Set();
      const full = await call("GET", `/api/org/drafts/${draftId}/view`, "holder-1");
      expect(full.json.changes[0].fields.find((f: any) => f.field === "termsOffer").hidden).toBe(false);
      expect(JSON.stringify(full.json)).toContain("Seventeen hundred");
    });

    it("is read by whoever decides drafts and by its author, and is no draft at all to anybody else", async () => {
      holders = new Set(["holder-1"]);
      const mine = await roleAndEdit("member-1");
      expect((await call("GET", `/api/org/drafts/${mine.draftId}/view`, "member-1")).status).toBe(200);
      const theirs = await roleAndEdit("admin-1");
      const other = await call("GET", `/api/org/drafts/${theirs.draftId}/view`, "member-1");
      expect(other.status).toBe(404);
      expect(other.json.error).toBe("no_such_draft");
      expect((await call("GET", `/api/org/drafts/${theirs.draftId}/view`, "admin-1")).status).toBe(200);
      expect((await call("GET", `/api/org/drafts/${theirs.draftId}/view`, "")).status).toBe(401);
      expect((await call("GET", "/api/org/drafts/no-such-draft/view", "admin-1")).status).toBe(404);
    });

    it("names another open draft on the same role, and shows a new role as new", async () => {
      const a = await roleAndEdit();
      const b = await createDraft(pool, { title: "A second edit", rationale: null, createdBy: "admin-1", sourceKind: "human", openCap: null });
      if (!b.ok) throw new Error(b.error);
      await addChange(pool, b.id, { op: "update_seat", orgRoleId: a.roleId, payload: { domain: "The land plan and the permits." } });
      const r = await call("GET", `/api/org/drafts/${a.draftId}/view`, "admin-1");
      expect(r.json.otherOpenDrafts).toEqual([{ id: b.id, title: "A second edit" }]);
      const d = await makeDraft();
      const n = await call("GET", `/api/org/drafts/${d.id}/view`, "admin-1");
      const seat = n.json.changes.find((c: any) => c.op === "create_seat");
      expect(seat.kind).toBe("new");
      expect(seat.fields.find((f: any) => f.field === "name")).toMatchObject({ before: null, after: d.seat, runs: [{ op: "add", text: d.seat }] });
      expect(n.json.changes.find((c: any) => c.op === "seat_holder").kind).toBe("other");
    });

    it("shows the three versions when the live card moved on a field after the draft was written (0436)", async () => {
      const { draftId, roleId } = await roleAndEdit();
      await pool.query("UPDATE org_roles SET aim = ? WHERE id = ?", ["Steward the land so the project grows gently within what the watershed can carry.", roleId]); // module-review-ok: the test edits the live card behind the draft's back, the case this read exists to show
      const r = await call("GET", `/api/org/drafts/${draftId}/view`, "admin-1");
      const [c] = r.json.changes;
      expect(c.baseKnown).toBe(true);
      const aim = c.fields.find((f: any) => f.field === "aim");
      expect(aim).toMatchObject({ moved: true, base: "Steward the land so the project grows within what the watershed can carry." });
      expect(aim.before).toContain("grows gently");
      expect(aim.movedRuns.filter((x: any) => x.op !== "same")).toEqual([{ op: "add", text: "gently " }]);
      expect(c.fields.find((f: any) => f.field === "accountabilities")).toMatchObject({ moved: false, movedRuns: [] });
    });

    it("a change written before 0436 says it has no base, and nothing reads as moved", async () => {
      const { draftId, changeId, roleId } = await roleAndEdit();
      await pool.query("UPDATE org_draft_changes SET base_json = NULL WHERE id = ?", [changeId]); // module-review-ok: the test makes a change as the release before 0436 wrote it
      await pool.query("UPDATE org_roles SET aim = 'Moved on.' WHERE id = ?", [roleId]); // module-review-ok: the live card moves, which an unknown base cannot see
      const [c] = (await call("GET", `/api/org/drafts/${draftId}/view`, "admin-1")).json.changes;
      expect(c.baseKnown).toBe(false);
      expect(c.fields.every((f: any) => f.moved === false && f.base === null)).toBe(true);
    });

    it("never captures a base for a change about who holds a role", async () => {
      const d = await makeDraft();
      const draft = await getDraft(pool, d.id);
      expect(draft?.changes.find((c) => c.op === "seat_holder")?.baseJson).toBeNull();
      const edit = await roleAndEdit();
      const base = (await getDraft(pool, edit.draftId))?.changes[0].baseJson;
      expect(base).toMatchObject({ id: edit.roleId });
      expect(base).not.toHaveProperty("terms_offer_by");
    });

    it("edits a draft's words as a new revision with a note, and never the live card (0437)", async () => {
      holders = new Set(["holder-1"]);
      const { draftId, changeId, roleId } = await roleAndEdit();
      const words = { aim: "Steward the land so the village grows within what the watershed and the soil can carry." };
      const r = await call("POST", `/api/org/drafts/${draftId}/revise`, "holder-1", { changeId, words, note: "Named the soil too" });
      expect(r.status).toBe(200);
      expect(r.json.revision).toBe(2);
      expect(r.json.changeId).not.toBe(changeId);
      const [[live]] = await pool.query<any[]>("SELECT aim FROM org_roles WHERE id = ?", [roleId]); // module-review-ok: the test reads the live card the edit must not touch
      expect(live.aim).toBe("Steward the land so the project grows within what the watershed can carry.");
      const v = (await call("GET", `/api/org/drafts/${draftId}/view`, "holder-1")).json;
      expect(v.changeIds).toEqual([r.json.changeId]);
      expect(v.changes[0].fields.find((f: any) => f.field === "aim").after).toBe(words.aim);
      expect(v.mayEdit).toBe(true);
      expect(v.revisions).toHaveLength(1);
      expect(v.revisions[0]).toMatchObject({ number: 2, note: "Named the soil too", changeId: r.json.changeId });
      expect(v.revisions[0].fields.map((f: any) => f.field)).toEqual(["aim"]);
      expect(v.revisions[0].fields[0].runs.filter((x: any) => x.op === "add").map((x: any) => x.text).join("")).toContain("and the soil");
      // The base it was written against stays with the change through the edit.
      expect(v.changes[0].baseKnown).toBe(true);
    });

    it("a publisher who read the draft before an edit is refused, so nobody publishes words they did not read", async () => {
      holders = new Set(["holder-1"]);
      const { draftId, changeId } = await roleAndEdit("admin-1", false);
      await call("POST", `/api/org/drafts/${draftId}/revise`, "holder-1", { changeId, words: { domain: "The land plan and the permits." } });
      const p = await call("POST", `/api/org/drafts/${draftId}/publish-by-power`, "holder-1", { expectedChanges: [changeId] });
      expect(p.status).not.toBe(200);
      expect(JSON.stringify(p.json)).toContain("changed since you opened it");
      expect((await getDraft(pool, draftId))?.status).toBe("open");
      // The ids the page now shows publish it.
      const now = (await call("GET", `/api/org/drafts/${draftId}/view`, "holder-1")).json.changeIds;
      expect((await call("POST", `/api/org/drafts/${draftId}/publish-by-power`, "holder-1", { expectedChanges: now })).status).toBe(200);
    });

    it("holds an edit to the role editor's rules, and to the draft's readers", async () => {
      holders = new Set(["holder-1"]);
      const { draftId, changeId } = await roleAndEdit();
      const pay = await call("POST", `/api/org/drafts/${draftId}/revise`, "holder-1", { changeId, words: { aim: "Pay me at IBAN GB33BUKB20201555555555 every moon." } });
      expect(pay.status).toBe(400);
      expect(pay.json.field).toBe("words.aim");
      expect((await call("POST", `/api/org/drafts/${draftId}/revise`, "holder-1", { changeId, words: { nope: "x" } })).status).toBe(400);
      expect((await call("POST", `/api/org/drafts/${draftId}/revise`, "holder-1", { changeId, words: { aim: "x" }, note: "n".repeat(281) })).json.field).toBe("note");
      expect((await call("POST", `/api/org/drafts/${draftId}/revise`, "member-1", { changeId, words: { aim: "Mine now." } })).status).toBe(404);
      expect((await call("POST", `/api/org/drafts/${draftId}/revise`, "holder-1", { changeId: "dch-elsewhere", words: { aim: "x" } })).status).toBe(404);
      // Sending back what the draft already proposes changes nothing.
      const same = await call("POST", `/api/org/drafts/${draftId}/revise`, "holder-1", { changeId, words: { aim: "Steward the land so the village grows within what the watershed can carry." } });
      expect(same.status).toBe(409);
    });

    it("a word put back to what the live card says is no longer a change", async () => {
      holders = new Set(["holder-1"]);
      const { draftId, changeId } = await roleAndEdit();
      const r = await call("POST", `/api/org/drafts/${draftId}/revise`, "holder-1", { changeId, words: { aim: "Steward the land so the project grows within what the watershed can carry." } });
      expect(r.status).toBe(200);
      const v = (await call("GET", `/api/org/drafts/${draftId}/view`, "holder-1")).json;
      expect(v.changes[0].fields.map((f: any) => f.field)).not.toContain("aim");
      expect(v.changes[0].unchanged).toContain("aim");
    });

    it("an erased member's id leaves the revisions they made, and the words stay", async () => {
      holders = new Set(["holder-1"]);
      const { draftId, changeId } = await roleAndEdit();
      await call("POST", `/api/org/drafts/${draftId}/revise`, "holder-1", { changeId, words: { domain: "Kept words." }, note: "Kept note" });
      const { forgetMemberInDrafts } = await import("../lib/orgDrafts");
      await forgetMemberInDrafts(pool, "holder-1", "anon-1");
      const [rows] = await pool.query<any[]>("SELECT revised_by, note FROM org_draft_revisions WHERE draft_id = ?", [draftId]); // module-review-ok: the test reads what the erasure left
      expect(rows).toEqual([{ revised_by: "anon-1", note: "Kept note" }]);
    });

    it("carries only the allowlisted keys, at every level", async () => {
      const { draftId, changeId } = await roleAndEdit();
      expect((await call("POST", `/api/org/drafts/${draftId}/revise`, "admin-1", { changeId, words: { domain: "Revised." }, note: "A note" })).status).toBe(200);
      const r = await call("GET", `/api/org/drafts/${draftId}/view`, "admin-1");
      const { DRAFT_VIEW_KEYS, DRAFT_CHANGE_KEYS, DRAFT_FIELD_KEYS, DRAFT_SOURCE_KEYS, DRAFT_PROPOSER_KEYS, DRAFT_REVISION_KEYS } = await import("../../shared/orgDraftView");
      const within = (o: object, keys: readonly string[]) => expect(Object.keys(o).filter((k) => !keys.includes(k))).toEqual([]);
      within(r.json, DRAFT_VIEW_KEYS);
      within(r.json.source, DRAFT_SOURCE_KEYS);
      if (r.json.proposer) within(r.json.proposer, DRAFT_PROPOSER_KEYS);
      for (const c of r.json.changes) {
        within(c, DRAFT_CHANGE_KEYS);
        for (const f of c.fields) within(f, DRAFT_FIELD_KEYS);
      }
      expect(r.json.revisions).toHaveLength(1);
      for (const v of r.json.revisions) {
        within(v, DRAFT_REVISION_KEYS);
        if (v.by) within(v.by, DRAFT_PROPOSER_KEYS);
        for (const f of v.fields) within(f, DRAFT_FIELD_KEYS);
      }
      // The draft row's own machinery never reaches the page.
      expect(JSON.stringify(r.json)).not.toMatch(/beforeJson|before_json|threadId|cites|sourceProposalId/);
    });
  });

  describe("publish by power", () => {
    it("refuses a member who holds nothing, and says it goes to the village", async () => {
      const d = await makeDraft();
      const r = await call("POST", `/api/org/drafts/${d.id}/publish-by-power`, "member-1");
      expect(r.status).toBe(403);
      expect(r.json).toMatchObject({ error: "not_a_holder", ballotNeeded: true });
      expect((await getDraft(pool, d.id))?.status).toBe("open");
    });

    it("refuses an admin who holds nothing, though the gate lets an admin through", async () => {
      const d = await makeDraft();
      const r = await call("POST", `/api/org/drafts/${d.id}/publish-by-power`, "admin-1");
      expect(r.status).toBe(403);
      expect((await getDraft(pool, d.id))?.status).toBe("open");
    });

    it("lets a holder publish live, and runs every step after the commit", async () => {
      holders = new Set(["holder-1"]);
      const d = await makeDraft();
      const r = await call("POST", `/api/org/drafts/${d.id}/publish-by-power`, "holder-1");
      expect(r.status, JSON.stringify(r.json)).toBe(200);
      expect(r.json).toMatchObject({ success: true, applied: 3, reloaded: true });
      expect((await getDraft(pool, d.id))?.status).toBe("published");
      expect(reloads).toBe(1);
      expect(notices.filter((n) => n.type === "role_appointed" && n.userId === "member-1")).toHaveLength(1);
    });

    it("refuses a draft with a blocked line, and leaves it open", async () => {
      holders = new Set(["holder-1"]);
      const d = await makeDraft({ blocked: true });
      const r = await call("POST", `/api/org/drafts/${d.id}/publish-by-power`, "holder-1");
      expect(r.status).toBe(409);
      expect(String(r.json.error)).toContain("cannot be applied");
      expect((await getDraft(pool, d.id))?.status).toBe("open");
      expect(reloads).toBe(0);
    });

    it("lets the village's seated holder through on a village-held key, and refuses the admin with the hatch", async () => {
      holders = new Set(["holder-1"]);
      villageHeld = ["org.decide"];
      const d = await makeDraft();
      expect((await call("POST", `/api/org/drafts/${d.id}/publish-by-power`, "admin-1")).status).toBe(409);
      expect((await call("POST", `/api/org/drafts/${d.id}/publish-by-power`, "holder-1")).status).toBe(200);
    });
  });

  describe("put to the village", () => {
    it("opens an org_draft ballot that names circles and seats, and no person and no free text", async () => {
      const d = await makeDraft();
      /*
       * THE CONTROL. The fixture really does carry every forbidden word: the
       * draft's own title and rationale, and the preview's sentence for the
       * seating. So an empty search below is about the composer, and not about
       * a fixture that never held the words.
       */
      const draft = await getDraft(pool, d.id);
      expect(draft?.title).toContain("Secret Plan Wombat");
      expect(draft?.rationale).toContain("Maybelline");
      expect((await previewDraft(pool, d.id)).lines.map((l) => l.reads).join(" ")).toContain("Zephyrine Quillfeather");

      const r = await call("POST", `/api/org/drafts/${d.id}/put-to-village`, "member-1");
      expect(r.status).toBe(200);
      const ballot = await ballotById(pool, r.json.ballot.id);
      expect(ballot).toMatchObject({ subjectType: ORG_DRAFT, subjectRef: d.id, status: "open", openedBy: "member-1" });
      const text = `${ballot!.title}\n${ballot!.docMarkdown}`;
      for (const word of ["Zephyrine", "Quillfeather", "Secret Plan", "Wombat", "Maybelline", "Thistlewood", "member-1", "admin-1", "Member One", "Admin One"]) {
        expect(text, word).not.toContain(word);
      }
      expect(ballot!.docMarkdown).toContain(`Create the circle "${d.circle}"`);
      expect(ballot!.docMarkdown).toContain(`Create the role "${d.seat}" in "${d.circle}"`);
      expect(ballot!.docMarkdown).toContain(`Seat somebody in "${d.seat}"`);
      // Shown as written inside a <pre>, so no Markdown marks.
      expect(ballot!.docMarkdown).not.toMatch(/^#|\*\*/m);
    });

    it("freezes the draft while the vote is open: no second vote, no edit, no direct publish", async () => {
      const d = await makeDraft();
      expect((await call("POST", `/api/org/drafts/${d.id}/put-to-village`, "member-1")).status).toBe(200);
      const again = await call("POST", `/api/org/drafts/${d.id}/put-to-village`, "member-1");
      expect([again.status, again.json.error]).toEqual([409, "ballot_open"]);
      expect((await addChange(pool, d.id, { op: "rest_seat", orgRoleId: `head-cook-${seq}`, payload: {} })).ok).toBe(false);
      expect((await setDraftVision(pool, d.id, null)).ok).toBe(false);
      holders = new Set(["holder-1"]);
      expect((await call("POST", `/api/org/drafts/${d.id}/publish-by-power`, "holder-1")).status).toBe(409);
      expect((await call("POST", `/api/admin/org/drafts/${d.id}/publish`, "admin-1")).status).toBe(409);
      expect((await getDraft(pool, d.id))?.status).toBe("open");
      const read = await call("GET", `/api/org/drafts/${d.id}/decide`, "holder-1");
      expect(read.json.ballot?.status).toBe("open");
      expect(read.json.youMayPublish).toBe(false);
    });

    it("is for the holder alone when a role holds the power", async () => {
      holders = new Set(["holder-1"]);
      const d = await makeDraft();
      const m = await call("POST", `/api/org/drafts/${d.id}/put-to-village`, "member-1");
      expect([m.status, m.json.error]).toEqual([403, "not_a_holder"]);
      expect((await call("POST", `/api/org/drafts/${d.id}/put-to-village`, "holder-1")).status).toBe(200);
    });

    it("refuses while voting is off, and refuses a draft that could carry nothing", async () => {
      governance = false;
      const d = await makeDraft();
      expect((await call("POST", `/api/org/drafts/${d.id}/put-to-village`, "member-1")).status).toBe(409);
      governance = true;
      const blocked = await makeDraft({ blocked: true });
      const r = await call("POST", `/api/org/drafts/${blocked.id}/put-to-village`, "member-1");
      expect([r.status, r.json.error]).toEqual([409, "draft_blocked"]);
    });
  });

  describe("the closer", () => {
    const open = async () => {
      const d = await makeDraft();
      const r = await call("POST", `/api/org/drafts/${d.id}/put-to-village`, "member-1");
      expect(r.status).toBe(200);
      return { draft: d, ballot: (await ballotById(pool, r.json.ballot.id))! };
    };

    it("is registered for org_draft", () => {
      expect(typeof closers[ORG_DRAFT]?.execute).toBe("function");
    });

    it("publishes a carried draft exactly once, and a retry does nothing", async () => {
      const { draft, ballot } = await open();
      notices = [];
      const closer = closers[ORG_DRAFT];
      const settled = await closer.settle(ballot, "passed", "", "admin-1");
      expect(settled.held).toBeNull();
      expect((await getDraft(pool, draft.id))?.status).toBe("open");

      const first = await closer.execute!(ballot, "admin-1");
      expect(first.held).toBeNull();
      expect(first).toMatchObject({ held: null, applied: [`org_draft:${draft.id}`] });
      const after = await getDraft(pool, draft.id);
      expect(after?.status).toBe("published");
      const [[row]] = await pool.query<any[]>("SELECT published_by FROM org_drafts WHERE id = ?", [draft.id]); // module-review-ok: reading back the scratch schema this suite provisioned
      expect(row.published_by).toBe(ballot.id);
      expect(reloads).toBe(1);
      expect(notices.filter((n) => n.type === "role_appointed" && n.userId === "member-1")).toHaveLength(1);
      expect(notices.some((n) => n.userId === "member-1" && n.dedupeKey === `bal:${ballot.id}:org-draft-published`)).toBe(true);

      const second = await closer.execute!(ballot, "admin-1");
      expect(second).toMatchObject({ held: null, applied: [] });
      expect(reloads).toBe(1);
      expect(notices.filter((n) => n.type === "role_appointed")).toHaveLength(1);
    });

    it("leaves a draft the village did not carry open and unpublished", async () => {
      const { draft, ballot } = await open();
      notices = [];
      const out = await closers[ORG_DRAFT].settle(ballot, "failed", "It did not carry.", "admin-1");
      expect(out.proposerTold).toBe("member-1");
      expect((await getDraft(pool, draft.id))?.status).toBe("open");
      expect(reloads).toBe(0);
      expect(notices.map((n) => n.dedupeKey)).toEqual([`bal:${ballot.id}:org-draft-not-carried`]);
    });

    it("holds, and never throws, when the draft went away under the vote", async () => {
      const { draft, ballot } = await open();
      expect((await withdrawDraftBallot(pool, draft.id, "admin-1", true)).ok).toBe(true);
      expect((await withdrawDraft(pool, draft.id)).ok).toBe(true);
      const out = await closers[ORG_DRAFT].execute!(ballot, "admin-1");
      expect(out.held).toContain("withdrawn");
      expect((await getDraft(pool, draft.id))?.status).toBe("withdrawn");
    });
  });

  describe("withdrawing a draft withdraws its vote", () => {
    it("calls the open vote off", async () => {
      const d = await makeDraft();
      const opened = await call("POST", `/api/org/drafts/${d.id}/put-to-village`, "member-1");
      const w = await withdrawDraftBallot(pool, d.id, "admin-1", false);
      expect(w).toMatchObject({ ok: true, ballotId: opened.json.ballot.id });
      expect((await ballotById(pool, opened.json.ballot.id))?.status).toBe("withdrawn");
      expect((await withdrawDraft(pool, d.id)).ok).toBe(true);
      // And the draft is free of the vote: a fresh one could open on another draft.
      expect((await withdrawDraftBallot(pool, d.id, "admin-1", false))).toMatchObject({ ok: true, ballotId: null });
    });

    it("keeps a vote people have answered unless the withdrawer may discard votes", async () => {
      const d = await makeDraft();
      const opened = await call("POST", `/api/org/drafts/${d.id}/put-to-village`, "member-1");
      expect((await castVote(pool, opened.json.ballot.id, "holder-1", "yes")).ok).toBe(true);
      const refused = await withdrawDraftBallot(pool, d.id, "member-1", false);
      expect(refused.ok).toBe(false);
      expect((await ballotById(pool, opened.json.ballot.id))?.status).toBe("open");
      expect((await withdrawDraftBallot(pool, d.id, "admin-1", true)).ok).toBe(true);
    });
  });

  describe("the arrangement door (0286): who may arrange the circles, and the one act that publishes it", () => {
    const placeOf = async (id: string) => {
      const [[row]] = await pool.query<any[]>("SELECT parent_circle_id, sort_order, layer FROM circles WHERE id = ?", [id]); // module-review-ok: the suite seeds and reads back rows in the scratch schema it provisioned
      return { parent: row.parent_circle_id ?? null, order: Number(row.sort_order), layer: row.layer ?? null };
    };
    const draftCount = async () => {
      const [[row]] = await pool.query<any[]>("SELECT COUNT(*) AS n FROM org_drafts"); // module-review-ok: the suite seeds and reads back rows in the scratch schema it provisioned
      return Number(row.n);
    };

    beforeEach(async () => {
      await pool.query("DELETE FROM circles WHERE id IN ('arr-gcc', 'arr-lead', 'arr-demo')"); // module-review-ok: resetting the rows this block seeds
      await pool.query( // module-review-ok: the suite seeds and reads back rows in the scratch schema it provisioned
        `INSERT INTO circles (id, name, parent_circle_id, is_example, status, sort_order) VALUES
           ('arr-gcc', 'Coordinating Circle', NULL, 0, 'active', 1),
           ('arr-lead', 'Leadership Circle', NULL, 0, 'active', 4),
           ('arr-demo', 'Demo Circle', NULL, 1, 'active', 5)`,
      );
    });

    it("refuses a member who holds nothing, and makes no draft", async () => {
      const before = await draftCount();
      const r = await call("POST", "/api/org/arrangements", "member-1", { moves: [{ circleId: "arr-lead", parentCircleId: "arr-gcc" }] });
      expect(r.status).toBe(403);
      expect(await draftCount()).toBe(before);
      expect((await placeOf("arr-lead")).parent).toBeNull();
    });

    it("publishes a holder's arrangement in one act: the circle moves, and takes its place and its layer", async () => {
      holders.add("holder-1");
      const r = await call("POST", "/api/org/arrangements", "holder-1", {
        moves: [{ circleId: "arr-lead", parentCircleId: "arr-gcc", order: 0, layer: "lead" }],
      });
      expect(r.status, JSON.stringify(r.json)).toBe(200);
      expect(await placeOf("arr-lead")).toEqual({ parent: "arr-gcc", order: 0, layer: "lead" });
      expect((await getDraft(pool, r.json.draftId))?.status).toBe("published");
      expect(reloads, "the circles cache is told the table changed").toBeGreaterThan(0);
    });

    it("refuses an arrangement that does not fit the village, in words, and leaves no open draft", async () => {
      holders.add("holder-1");
      const r = await call("POST", "/api/org/arrangements", "holder-1", { moves: [{ circleId: "arr-demo", parentCircleId: "arr-gcc" }] });
      expect(r.status).toBe(409);
      expect(String(r.json.message)).toContain("standing example");
      expect(r.json.blockedLines).toHaveLength(1);
      const [[open]] = await pool.query<any[]>("SELECT COUNT(*) AS n FROM org_drafts WHERE status = 'open' AND title = 'Circles arranged on the map'"); // module-review-ok: the suite seeds and reads back rows in the scratch schema it provisioned
      expect(Number(open.n), "a refused arrangement is withdrawn, never left open").toBe(0);
      expect((await placeOf("arr-demo")).parent).toBeNull();
    });

    it("refuses a malformed arrangement before any draft is made", async () => {
      holders.add("holder-1");
      const before = await draftCount();
      const r = await call("POST", "/api/org/arrangements", "holder-1", { moves: [{ circleId: "arr-lead", parentCircleId: null, layer: "chief" }] });
      expect(r.status).toBe(400);
      expect(String(r.json.message)).toContain("governance layer");
      expect(await draftCount()).toBe(before);
    });

    it("tells the map who may arrange, and through which door", async () => {
      holders.add("holder-1");
      const live = async () => Array.from(holders);
      expect(await arrangeViewer(pool, { id: "holder-1" }, false, live)).toEqual({ mayArrange: true, arrangeDoor: "power" });
      // Before a launch vote the admin panel keeps its own door.
      expect(await arrangeViewer(pool, { id: "admin-1" }, true, live)).toEqual({ mayArrange: true, arrangeDoor: "admin" });
      expect(await arrangeViewer(pool, { id: "member-1" }, false, live)).toEqual({ mayArrange: false, arrangeDoor: null });
      expect(await arrangeViewer(pool, null, false, live)).toEqual({ mayArrange: false, arrangeDoor: null });
    });
  });

  describe("the admin panel's door, before and after a launch vote", () => {
    it("publishes for an admin before launch, as it always did, in a village whose Game the fixture started", async () => {
      // The control: this village reads as started, with a ballot id, on the game-start row.
      const start = await readGameStart(pool);
      expect([start.started, start.ballotId]).toEqual([true, "bal-fixture"]);
      const d = await makeDraft();
      const r = await call("POST", `/api/admin/org/drafts/${d.id}/publish`, "admin-1");
      expect(r.status).toBe(200);
      expect(r.json).toMatchObject({ success: true, applied: 3, reloaded: true });
    });

    it("refuses an admin without org.decide once a launch vote has carried", async () => {
      expect((await recordLaunchCarried(pool, { ballotId: "bal-launch-test", closedBy: "admin-1" })).alreadyRecorded).toBe(false);
      const d = await makeDraft();
      const r = await call("POST", `/api/admin/org/drafts/${d.id}/publish`, "admin-1");
      expect(r.status).toBe(403);
      expect(r.json).toMatchObject({ error: "not_a_holder", ballotNeeded: true });
      expect((await getDraft(pool, d.id))?.status).toBe("open");
      expect((await call("GET", `/api/org/drafts/${d.id}/decide`, "admin-1")).json).toMatchObject({ launched: true, adminMayPublish: false });

      holders = new Set(["admin-1"]);
      expect((await call("POST", `/api/admin/org/drafts/${d.id}/publish`, "admin-1")).status).toBe(200);
      expect((await getDraft(pool, d.id))?.status).toBe("published");
    });
  });
});
