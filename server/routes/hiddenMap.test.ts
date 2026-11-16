/**
 * HIDDEN MAP ROUTES (S1): every door, against a real scratch schema.
 *
 * The first block needs no database: a stranger is refused at every door.
 * The second runs the whole loop the module exists for, as four invented
 * members: a planter whose map opens, a newcomer whose map is closed, a keeper
 * who vouches before anybody is open, and a second signer for exports.
 *
 * What is proved here, each by name:
 *   - a member whose map is closed cannot read another member's pin by the
 *     list, the detail, the photo or the queue
 *   - no answer anywhere carries an owner, an id of a member, or a name
 *   - a vouch is never self, and the keeper's bootstrap vouch counts
 *   - the map opens at the dial and stays open when a vouch is withdrawn
 *   - a photo carrying GPS is stored with no metadata and served only where
 *     its pin may be read
 *   - an export takes two different people and downloads once
 *   - erasure deletes photos and leaves the pins unattributed
 *
 * Every person and place here is invented.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type mysql from "mysql2/promise";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "../db/testDb";
import { buildGeotaggedJpeg } from "../lib/exifFixture";
import { exportMemberHiddenMap, forgetMemberHiddenMap, storePhoto } from "../lib/hiddenMap";
import { loadModuleSettings, setModuleConfig, setModuleLifecycle } from "../lib/modules";
import { loadVariables, setVariable } from "../lib/variables";
import { villageId } from "../lib/economy";
import * as repo from "../repos/hiddenMap";
import { claimsRepo as claimsRepoFactory, questsRepo as questsRepoFactory } from "../repos/quests";
import { openVisitClaim, plantingClaimNote, visitClaimNote } from "../lib/hiddenMapQuest";
import { register } from "./hiddenMap";

type Handler = (req: any, res: any) => Promise<unknown> | unknown;

const ROUTES = [
  "GET /api/hidden-map/me",
  "GET /api/hidden-map/pins",
  "POST /api/hidden-map/pins",
  "GET /api/hidden-map/pins/:id",
  "POST /api/hidden-map/pins/:id/photos",
  "POST /api/hidden-map/pins/:id/visits",
  "POST /api/hidden-map/pins/:id/vouch",
  "DELETE /api/hidden-map/pins/:id/vouch",
  "POST /api/hidden-map/pins/:id/hide",
  "GET /api/hidden-map/photos/:id",
  "GET /api/hidden-map/vouch-queue",
  "GET /api/hidden-map/exports",
  "POST /api/hidden-map/exports",
  "POST /api/hidden-map/exports/:id/approve",
  "POST /api/hidden-map/exports/:id/decline",
  "POST /api/hidden-map/exports/:id/withdraw",
  "GET /api/hidden-map/exports/:id/download",
  "GET /api/hidden-map/access-log",
];

function collect() {
  const handlers = new Map<string, Handler>();
  const mounts: string[] = [];
  const record = (method: string) => (p: string, handler: Handler) => handlers.set(`${method} ${p}`, handler);
  return {
    app: { get: record("GET"), post: record("POST"), put: record("PUT"), patch: record("PATCH"), delete: record("DELETE"), use: (p: string) => mounts.push(p) } as any,
    handlers,
    mounts,
  };
}

function makeRes() {
  const out: { status: number; body: any; headers: Record<string, string>; bytes: Buffer | null } = { status: 200, body: undefined, headers: {}, bytes: null };
  const res: any = {
    status(code: number) { out.status = code; return res; },
    json(body: unknown) { out.body = body; return res; },
    send(body: unknown) { out.body = body; return res; },
    setHeader(k: string, v: string) { out.headers[k.toLowerCase()] = v; },
    end(b?: Buffer) { out.bytes = b ?? null; return res; },
  };
  return { res, out };
}

const call = async (handlers: Map<string, Handler>, key: string, req: any = {}) => {
  const handler = handlers.get(key);
  if (!handler) throw new Error(`no handler registered for ${key}`);
  const { res, out } = makeRes();
  await handler({ params: {}, body: {}, query: {}, headers: {}, ...req }, res);
  return out;
};

function deps(
  pool: any,
  who: () => string | null,
  seats: { keep: Set<string>; export: Set<string> },
  photoDir: string,
  extra: {
    admission?: (id: string) => Promise<Date | null | undefined>;
    notify?: (n: any) => Promise<any>;
    opened?: (id: string) => Promise<void>;
    visitClaims?: any;
  } = {},
) {
  return {
    ...extra,
    authedUser: async () => (who() ? { id: who() } : null),
    capabilityCtx: async (user: any) => ({
      stageIndex: -1,
      stageIndexOf: () => 0,
      // An admin flag set on purpose: the keeper and the second signer are seats, and the routes must ignore it.
      isAdmin: user?.id === "m-admin",
      roleCapabilities: [
        ...(seats.keep.has(user?.id) ? ["hiddenmap.keep"] : []),
        ...(seats.export.has(user?.id) ? ["hiddenmap.export"] : []),
      ],
    }),
    // The gate as the routes meet it: a seat in the keeper's role passes, anybody else is refused.
    guardCapability: async (_req: any, res: any, cap: string) => {
      const id = who();
      const held = cap === "hiddenmap.keep" ? seats.keep : seats.export;
      if (id && held.has(id)) return true;
      res.status(403).json({ error: "not_yours" });
      return false;
    },
    getPool: () => pool,
    overLimit: async () => false,
    members: {
      all: async () => [{ id: "m-plant", name: "Rowan Example" }, { id: "m-keep", name: "Ash Example" }],
      count: async () => 2,
      byId: async (id: string) => ({ id, name: `${id} Example` }),
    },
    firstName: (n: string) => String(n).split(" ")[0],
    photoDir,
  } as any;
}

describe("every door refuses a stranger", () => {
  const c = collect();
  register(c.app, deps(null, () => null, { keep: new Set(), export: new Set() }, os.tmpdir()));

  it("registers exactly the documented doors, behind the module", () => {
    expect([...c.handlers.keys()].sort()).toEqual([...ROUTES].sort());
    expect(c.mounts).toEqual(["/api/hidden-map"]);
  });

  for (const route of ROUTES) {
    it(`${route} answers 401 with nobody signed in`, async () => {
      const out = await call(c.handlers, route, { params: { id: "x" } });
      expect(out.status).toBe(401);
    });
  }
});

const configured = testDbConfigured();

describe.skipIf(!configured)("the hidden map against a real schema", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  let whoami: string | null = null;
  let handlers: Map<string, Handler>;
  let photoDir: string;
  const as = (id: string | null) => { whoami = id; };
  const seats = { keep: new Set(["m-keep"]), export: new Set(["m-second"]) };
  let n = 0;
  const pinBody = (over: Record<string, unknown> = {}) => ({
    clientId: `device-${++n}-abcdef`,
    layer: "planting",
    kind: "Garden",
    lat: 40.123456 + n / 1000,
    lng: -105.654321,
    precision: "exact",
    title: `Bed ${n}`,
    whatWentIn: "Squash and beans",
    ...over,
  });
  const logPin = async (who: string, over: Record<string, unknown> = {}) => {
    as(who);
    const out = await call(handlers, "POST /api/hidden-map/pins", { body: pinBody(over) });
    expect(out.status).toBe(201);
    return out.body.pin.id as string;
  };

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 });
    await loadModuleSettings(pool);
    await loadVariables(pool);
    photoDir = fs.mkdtempSync(path.join(os.tmpdir(), "hidden-map-test-"));
    const c = collect();
    register(c.app, deps(pool, () => whoami, seats, photoDir));
    handlers = c.handlers;
  }, 180_000);

  afterAll(async () => {
    await pool?.end();
    await db?.drop();
    if (photoDir) fs.rmSync(photoDir, { recursive: true, force: true });
  });

  it("can never stand at public", async () => {
    const wide = await setModuleLifecycle("hidden-map", "public", null, { sharedPasswordPosture: () => false });
    expect(wide.ok).toBe(false);
    expect(wide.ok === false && wide.status).toBe(409);
    const ok = await setModuleLifecycle("hidden-map", "members", null, { sharedPasswordPosture: () => false });
    expect(ok.ok).toBe(true);
  });

  let first = "";
  it("logs a pin once per device id, and answers the owner with mine and no owner field", async () => {
    as("m-plant");
    const body = pinBody();
    const a = await call(handlers, "POST /api/hidden-map/pins", { body });
    expect(a.status).toBe(201);
    expect(a.body.pin.mine).toBe(true);
    expect(a.body.pin.stage).toBe("seed");
    expect(a.body.pin.native).toBe(false);
    expect(JSON.stringify(a.body)).not.toContain("m-plant");
    first = a.body.pin.id;
    const again = await call(handlers, "POST /api/hidden-map/pins", { body });
    expect(again.status).toBe(200);
    expect(again.body.pin.id).toBe(first);
    as("m-new");
    const stolen = await call(handlers, "POST /api/hidden-map/pins", { body });
    expect(stolen.status).toBe(409);
  });

  it("refuses NaN coordinates and a kind the layer does not have", async () => {
    as("m-plant");
    expect((await call(handlers, "POST /api/hidden-map/pins", { body: pinBody({ lat: "NaN" }) })).status).toBe(400);
    expect((await call(handlers, "POST /api/hidden-map/pins", { body: pinBody({ kind: "Moon" }) })).status).toBe(400);
  });

  it("shows a member whose map is closed nothing of somebody else's pin, by any door", async () => {
    as("m-new");
    const list = await call(handlers, "GET /api/hidden-map/pins");
    expect(list.status).toBe(200);
    expect(list.body.pins.map((p: any) => p.id)).not.toContain(first);
    expect((await call(handlers, "GET /api/hidden-map/pins/:id", { params: { id: first } })).status).toBe(404);
    const queue = await call(handlers, "GET /api/hidden-map/vouch-queue");
    expect(queue.body.pins).toEqual([]);
    expect((await call(handlers, "POST /api/hidden-map/pins/:id/vouch", { params: { id: first }, body: { seen: "in-person" } })).status).toBe(404);
  });

  it("an administrator is not a keeper: the queue is for the seat", async () => {
    as("m-admin");
    const queue = await call(handlers, "GET /api/hidden-map/vouch-queue");
    expect(queue.body.pins).toEqual([]);
  });

  it("refuses a self-vouch", async () => {
    as("m-plant");
    const out = await call(handlers, "POST /api/hidden-map/pins/:id/vouch", { params: { id: first }, body: { seen: "in-person" } });
    expect(out.status).toBe(409);
  });

  it("lets a keeper whose map is closed see the queue with no owner, vouch, and still not see the map", async () => {
    as("m-keep");
    const queue = await call(handlers, "GET /api/hidden-map/vouch-queue");
    const queued = queue.body.pins.find((p: any) => p.id === first);
    expect(queued).toBeTruthy();
    expect(queued.mine).toBe(false);
    expect(JSON.stringify(queue.body)).not.toContain("m-plant");
    const v = await call(handlers, "POST /api/hidden-map/pins/:id/vouch", { params: { id: first }, body: { seen: "in-person" } });
    expect(v.status).toBe(200);
    expect(v.body.vouches).toBe(1);
    const after = await call(handlers, "GET /api/hidden-map/vouch-queue");
    expect(after.body.pins.map((p: any) => p.id)).not.toContain(first);
    const map = await call(handlers, "GET /api/hidden-map/pins");
    expect(map.body.pins.map((p: any) => p.id)).not.toContain(first);
  });

  it("opens the planter's map at the seventh vouched planting, and only then", async () => {
    const ids = [first];
    for (let i = 0; i < 6; i++) ids.push(await logPin("m-plant"));
    // A stop does not count toward opening.
    const stop = await logPin("m-plant", { layer: "stop", kind: "Overnight" });
    as("m-keep");
    // Only plantings wait in the queue, and a keeper whose map is closed cannot reach a stop at all.
    const queue = await call(handlers, "GET /api/hidden-map/vouch-queue");
    expect(queue.body.pins.map((p: any) => p.id)).not.toContain(stop);
    expect((await call(handlers, "POST /api/hidden-map/pins/:id/vouch", { params: { id: stop }, body: { seen: "in-person" } })).status).toBe(404);
    for (const id of ids.slice(1, 6)) await call(handlers, "POST /api/hidden-map/pins/:id/vouch", { params: { id }, body: { seen: "in-person" } });
    as("m-plant");
    let me = await call(handlers, "GET /api/hidden-map/me");
    expect(me.body).toMatchObject({ open: false, vouchedCount: 6, needed: 7 });
    expect(typeof me.body.allPins).toBe("number");
    expect(JSON.stringify(me.body)).not.toMatch(/40\.1/);
    as("m-keep");
    await call(handlers, "POST /api/hidden-map/pins/:id/vouch", { params: { id: ids[6] }, body: { seen: "in-person" } });
    as("m-plant");
    me = await call(handlers, "GET /api/hidden-map/me");
    expect(me.body).toMatchObject({ open: true, vouchedCount: 7, needed: 7, vouchesPerPin: 1, openedBefore: 0 });
    expect(me.body.openedAt).toBeTruthy();
    expect(me.body.planters).toBeGreaterThanOrEqual(1);
  });

  it("an open member sees every pin, and none carries an owner", async () => {
    const theirs = await logPin("m-new", { title: "Newcomer bed" });
    as("m-plant");
    const map = await call(handlers, "GET /api/hidden-map/pins");
    const seen = map.body.pins.find((p: any) => p.id === theirs);
    expect(seen).toMatchObject({ mine: false, title: "Newcomer bed" });
    expect(JSON.stringify(map.body)).not.toMatch(/m-new|m-plant|m-keep|ownerUserId|owner_user_id/);
  });

  it("stays open when a vouch is withdrawn", async () => {
    as("m-keep");
    const w = await call(handlers, "DELETE /api/hidden-map/pins/:id/vouch", { params: { id: first } });
    expect(w.status).toBe(200);
    as("m-plant");
    const me = await call(handlers, "GET /api/hidden-map/me");
    expect(me.body.open).toBe(true);
    expect(me.body.vouchedCount).toBe(6);
  });

  it("stores a geotagged photo with no metadata, and serves it only where its pin may be read", async () => {
    const plain = await sharp({ create: { width: 640, height: 480, channels: 3, background: { r: 40, g: 120, b: 60 } } }).jpeg().toBuffer();
    const geo = buildGeotaggedJpeg(plain);
    expect(geo.includes(Buffer.from("Exif"))).toBe(true);
    const stored = await storePhoto(geo, photoDir);
    const onDisk = fs.readFileSync(path.join(photoDir, stored.filename));
    expect(onDisk.includes(Buffer.from("Exif"))).toBe(false);
    expect((await sharp(onDisk).metadata()).exif).toBeUndefined();
    await repo.insertPhoto(pool as any, villageId(), { id: "hmf-test1", pinId: first, visitId: null, uploader: "m-plant", ...stored }, new Date());

    as("m-new");
    expect((await call(handlers, "GET /api/hidden-map/photos/:id", { params: { id: "hmf-test1" } })).status).toBe(404);
    as("m-plant");
    const mine = await call(handlers, "GET /api/hidden-map/photos/:id", { params: { id: "hmf-test1" } });
    expect(mine.status).toBe(200);
    expect(mine.headers["cache-control"]).toBe("private, no-store");
    expect(mine.bytes?.includes(Buffer.from("Exif"))).toBe(false);
  });

  it("records who read the shared map with no coordinates, and gives the keeper names with no pins", async () => {
    const rows = await repo.readAccessLog(pool as any, villageId());
    expect(rows.some((r) => r.userId === "m-plant" && r.action === "map.read")).toBe(true);
    expect(JSON.stringify(rows)).not.toContain("40.12");
    as("m-keep");
    const log = await call(handlers, "GET /api/hidden-map/access-log");
    expect(log.body.all).toBe(true);
    expect(log.body.rows.some((r: any) => r.who === "Rowan")).toBe(true);
    expect(JSON.stringify(log.body)).not.toMatch(/hmp-|pinId/);
    as("m-new");
    const own = await call(handlers, "GET /api/hidden-map/access-log");
    expect(own.body.all).toBe(false);
    expect(own.body.rows.every((r: any) => r.who === "you")).toBe(true);
  });

  it("an export takes two different people and downloads once", async () => {
    // Open the second signer cheaply: the dial is a dial.
    await setVariable(pool as any, "hiddenmap.unlock_pins", "0");
    as("m-plant");
    const ask = await call(handlers, "POST /api/hidden-map/exports", { body: { precision: "km" } });
    expect(ask.status).toBe(201);
    const id = ask.body.id;
    expect((await call(handlers, "POST /api/hidden-map/exports/:id/approve", { params: { id } })).status).toBe(403);
    seats.export.add("m-plant");
    expect((await call(handlers, "POST /api/hidden-map/exports/:id/approve", { params: { id } })).status).toBe(409);
    seats.export.delete("m-plant");
    expect((await call(handlers, "GET /api/hidden-map/exports/:id/download", { params: { id } })).status).toBe(409);
    as("m-second");
    expect((await call(handlers, "POST /api/hidden-map/exports/:id/approve", { params: { id } })).status).toBe(200);
    expect((await call(handlers, "POST /api/hidden-map/exports/:id/approve", { params: { id } })).status).toBe(409);
    expect((await call(handlers, "GET /api/hidden-map/exports/:id/download", { params: { id } })).status).toBe(404);
    as("m-plant");
    const file = await call(handlers, "GET /api/hidden-map/exports/:id/download", { params: { id } });
    expect(file.status).toBe(200);
    const geo = JSON.parse(file.body);
    expect(geo.type).toBe("FeatureCollection");
    expect(geo.features.length).toBeGreaterThan(0);
    expect(geo.features.every((f: any) => f.properties.precision !== "exact")).toBe(true);
    expect(file.body).not.toMatch(/m-plant|m-new|hmf-/);
    expect((await call(handlers, "GET /api/hidden-map/exports/:id/download", { params: { id } })).status).toBe(409);
    await setVariable(pool as any, "hiddenmap.unlock_pins", "7");
  });

  it("refuses a vouch that does not say how it was seen", async () => {
    const id = await logPin("m-new", { title: "Seen how?" });
    as("m-plant");
    const out = await call(handlers, "POST /api/hidden-map/pins/:id/vouch", { params: { id } });
    expect(out.status).toBe(400);
    expect(out.body.error).toMatch(/in-person, call, photos/);
  });

  it("with an admission hook: nothing counts before admission, the unadmitted neither open nor vouch, and the opening is told once", async () => {
    // A second register over the same schema, with the hook and the bell, for members this test owns.
    const admittedAt = new Map<string, Date | null>([["m-deck", null], ["m-sworn", new Date(Date.now() + 1000)]]);
    const told: any[] = [];
    const stamped: string[] = [];
    const c = collect();
    register(c.app, deps(pool, () => whoami, seats, photoDir, {
      admission: async (id) => (admittedAt.has(id) ? admittedAt.get(id)! : undefined),
      notify: async (n) => { told.push(n); return { ok: true }; },
      opened: async (id) => { stamped.push(id); },
    }));
    const h = c.handlers;
    const plant = async (who: string) => {
      as(who);
      return (await call(h, "POST /api/hidden-map/pins", { body: pinBody() })).body.pin.id as string;
    };
    await setVariable(pool as any, "hiddenmap.unlock_pins", "1");
    // Not yet admitted: a vouched planting does not open the map, a zero dial does not either, and they cannot vouch.
    const deckPin = await plant("m-deck");
    as("m-keep");
    expect((await call(h, "POST /api/hidden-map/pins/:id/vouch", { params: { id: deckPin }, body: { seen: "call" } })).status).toBe(200);
    as("m-deck");
    expect((await call(h, "GET /api/hidden-map/me")).body.open).toBe(false);
    await setVariable(pool as any, "hiddenmap.unlock_pins", "0");
    expect((await call(h, "GET /api/hidden-map/me")).body.open).toBe(false);
    await setVariable(pool as any, "hiddenmap.unlock_pins", "1");
    const someone = await plant("m-new");
    as("m-deck");
    expect((await call(h, "POST /api/hidden-map/pins/:id/vouch", { params: { id: someone }, body: { seen: "in-person" } })).status).toBe(404);
    // Admitted a moment from now: a pin logged before admission does not count; one logged after does.
    const early = await plant("m-sworn");
    as("m-keep");
    await call(h, "POST /api/hidden-map/pins/:id/vouch", { params: { id: early }, body: { seen: "in-person" } });
    as("m-sworn");
    expect((await call(h, "GET /api/hidden-map/me")).body.open).toBe(false);
    admittedAt.set("m-sworn", new Date(Date.now() - 60_000));
    expect((await call(h, "GET /api/hidden-map/me")).body.open).toBe(true);
    await call(h, "GET /api/hidden-map/me");
    const notices = told.filter((n) => n.userId === "m-sworn");
    expect(notices).toHaveLength(1);
    // The opening hook runs once, for the member who opened, and never for one who did not.
    expect(stamped).toEqual(["m-sworn"]);
    expect(notices[0]).toMatchObject({ type: "hidden_map_opened", link: "/hidden-map", dedupeKey: "hidden-map-opened:m-sworn" });
    expect(JSON.stringify(notices[0])).not.toMatch(/\d+\.\d{3,}/);
    await setVariable(pool as any, "hiddenmap.unlock_pins", "7");
  });

  it("a keeper hides a pin and it leaves every view but its owner's", async () => {
    const id = await logPin("m-new", { title: "To hide" });
    as("m-plant");
    expect((await call(handlers, "POST /api/hidden-map/pins/:id/hide", { params: { id } })).status).toBe(403);
    as("m-keep");
    expect((await call(handlers, "POST /api/hidden-map/pins/:id/hide", { params: { id } })).status).toBe(200);
    as("m-plant");
    const map = await call(handlers, "GET /api/hidden-map/pins");
    expect(map.body.pins.map((p: any) => p.id)).not.toContain(id);
    as("m-new");
    const own = await call(handlers, "GET /api/hidden-map/pins");
    expect(own.body.pins.find((p: any) => p.id === id)?.hidden).toBe(true);
  });

  it("a visit to somebody else's pin opens a submitted claim on the village's quest, naming a day and never a place", async () => {
    const quests = questsRepoFactory(pool as any);
    const claims = claimsRepoFactory(pool as any);
    await quests.add({ id: "q-return-visit", title: "Return visit", status: "Open", gratitude: "10" } as any);
    const deps = { getPool: () => pool as any, stageOf: async () => "member", roleIdsFor: () => [], claimsRepo: claims, questsRepo: quests };
    const at = new Date("2026-11-15T12:00:00Z");
    const id = await openVisitClaim(deps, { questId: "q-return-visit", user: { id: "m-visitor", name: "Sky Example" }, at });
    expect(id).toBeTruthy();
    const claim = await claims.byId(id!);
    expect(claim?.status).toBe("submitted");
    expect(claim?.note).toBe(visitClaimNote(at));
    expect(claim?.note).not.toMatch(/\d+\.\d{3,}/);
    // An open claim on the same quest blocks a second until it is decided.
    expect(await openVisitClaim(deps, { questId: "q-return-visit", user: { id: "m-visitor", name: "Sky Example" }, at })).toBeNull();
    // A quest that does not exist opens nothing.
    expect(await openVisitClaim(deps, { questId: "q-nope", user: { id: "m-visitor" }, at })).toBeNull();
  });

  it("a planting's claim carries its own words, a day and never a place", () => {
    const at = new Date("2026-11-15T12:00:00Z");
    expect(plantingClaimNote(at)).toBe("A planting, vouched on 2026-11-15.");
    expect(plantingClaimNote(at)).not.toMatch(/\d+\.\d{3,}/);
  });

  it("pays every vouched planting: each owed claim opens once the one before it is decided (P1-r-1)", async () => {
    const quests = questsRepoFactory(pool as any);
    const claims = claimsRepoFactory(pool as any);
    await quests.add({ id: "q-plant", title: "Plant one", status: "Open", gratitude: "100" } as any);
    expect(await setModuleConfig("hidden-map", { plantingQuestId: "q-plant" }, null)).toEqual({ ok: true });
    const c = collect();
    register(c.app, deps(pool, () => whoami, seats, photoDir, {
      visitClaims: { stageOf: async () => "member", roleIdsFor: () => [], claimsRepo: claims, questsRepo: quests },
    }));
    const h = c.handlers;
    const three: string[] = [];
    for (let i = 0; i < 3; i++) {
      as("m-owed");
      three.push((await call(h, "POST /api/hidden-map/pins", { body: pinBody() })).body.pin.id);
    }
    as("m-keep");
    for (const id of three) await call(h, "POST /api/hidden-map/pins/:id/vouch", { params: { id }, body: { seen: "in-person" } });

    const open = async () => (await claims.forUser("m-owed")).filter((x: any) => x.questId === "q-plant");
    // One open claim at a time, the quest board's rule: the first planting's.
    let mine = await open();
    expect(mine).toHaveLength(1);
    expect(mine[0]!.status).toBe("submitted");
    // Pins logged in the same second may come in either order; what holds is one pin per claim.
    const claimed = async () => (await Promise.all(three.map((id) => repo.plantingClaimOf(pool as any, villageId(), id)))).filter(Boolean);
    expect(await claimed()).toEqual([mine[0]!.id]);

    // Each decision frees the next, on the planter's next look at the map, until all three are owed nothing.
    for (let i = 1; i <= 2; i++) {
      const decided = mine.find((x: any) => x.status === "submitted")!;
      await claims.declineOnce(decided.id, new Date().toISOString());
      as("m-owed");
      await call(h, "GET /api/hidden-map/me");
      mine = await open();
      expect(mine).toHaveLength(i + 1);
      expect(new Set(await claimed()).size).toBe(i + 1);
    }
    // Nothing more is owed, so another look opens nothing.
    await call(h, "GET /api/hidden-map/me");
    expect(await open()).toHaveLength(3);
    expect(await setModuleConfig("hidden-map", {}, null)).toEqual({ ok: true });
  });

  it("exports a member's own pins to them, and erasure deletes their photos and leaves the pins unattributed", async () => {
    const mine = await exportMemberHiddenMap(pool as any, villageId(), "m-plant");
    expect(mine.pins.length).toBeGreaterThanOrEqual(8);
    expect(mine.pins.every((p) => p.mine)).toBe(true);
    expect(mine.photos).toBe(1);
    const files = fs.readdirSync(photoDir).length;
    await forgetMemberHiddenMap(pool as any, villageId(), "m-plant", photoDir);
    expect(fs.readdirSync(photoDir).length).toBe(files - 2);
    expect((await exportMemberHiddenMap(pool as any, villageId(), "m-plant")).pins).toEqual([]);
    const still = await repo.getPin(pool as any, villageId(), "m-keep", first);
    expect(still).not.toBeNull();
    expect(still?.ownerUserId).toBeNull();
    expect(still?.photoIds).toEqual([]);
  });
});
