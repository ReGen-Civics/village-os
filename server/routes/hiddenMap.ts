/**
 * Hidden map routes: `/api/hidden-map/**`, behind `requireModule("hidden-map")`.
 *
 *   GET    /api/hidden-map/me                    who I am to the map: open or not, "4 of 7", the village's words
 *   GET    /api/hidden-map/pins                  the map as I may see it
 *   POST   /api/hidden-map/pins                  log a pin (idempotent by the device's clientId)
 *   GET    /api/hidden-map/pins/:id              one pin and its visits, if I may see it
 *   POST   /api/hidden-map/pins/:id/photos       add photos to my own pin (stripped, proved, stored apart)
 *   POST   /api/hidden-map/pins/:id/visits       a return visit with photos and the stage seen
 *   POST   /api/hidden-map/pins/:id/vouch        vouch a pin as real
 *   DELETE /api/hidden-map/pins/:id/vouch        withdraw my vouch
 *   POST   /api/hidden-map/pins/:id/hide         hide a pin (hiddenmap.keep)
 *   GET    /api/hidden-map/photos/:id            a photo, if I may see its pin
 *   GET    /api/hidden-map/vouch-queue           pins waiting for a vouch I may give
 *   GET    /api/hidden-map/exports               the export asks
 *   POST   /api/hidden-map/exports               ask for an export (open members)
 *   POST   /api/hidden-map/exports/:id/approve   the second person (open, holds hiddenmap.export, never the asker)
 *   POST   /api/hidden-map/exports/:id/decline
 *   POST   /api/hidden-map/exports/:id/withdraw  the asker takes it back
 *   GET    /api/hidden-map/exports/:id/download  the asker, once, after approval
 *   GET    /api/hidden-map/access-log            keepers read all; a member reads their own
 *
 * EVERY DOOR NEEDS A SIGNED-IN MEMBER, at every lifecycle. The module can never
 * stand at `public` (`widest: "members"` in its registry entry), and even in
 * preview a visitor reads nothing.
 *
 * THE KEEPER AND THE SECOND SIGNER ARE SEATS. Both powers are read through the
 * one gate with the admin short-circuit set aside, the way module.switch counts
 * live holders: being an administrator is not a reason to see pins awaiting a
 * vouch or to approve somebody's export.
 *
 * NO NAME, ID OR ROLE TRAVELS BESIDE A PIN. Answers carry `mine` and counts.
 */
import type { Express } from "express";
import fs from "node:fs";
import multer from "multer";
import crypto from "node:crypto";
import { hasCapability, type Capability } from "../../shared/capabilities";
import {
  MAX_NOTES, MAX_PHOTOS_PER_PIN, MAX_PHOTOS_PER_UPLOAD, MODULE_ID, PRECISIONS, exportGeoJson, isClientId, isPrecision,
  isStage, isVouchWay, mayVisit, mayVouch, parsePinInput, visiblePin, visitMayPay, type PinView, type Precision, type Stage,
} from "../../shared/hiddenMap";
import type { AppDeps } from "../lib/appDeps";
import { villageId } from "../lib/economy";
import { configOf, photoPath, readMap, readPin, readQueue, storePhoto, whoAmI, type Admission, type Dials } from "../lib/hiddenMap";
import { openVisitClaim, plantingClaimNote, type VisitClaimDeps } from "../lib/hiddenMapQuest";
import { moduleConfig, requireModule } from "../lib/modules";
import { LocationDataSurvived } from "../lib/placePhotos";
import { boolVar, numberVar, stringVar } from "../lib/variables";
import * as repo from "../repos/hiddenMap";

type Deps = Pick<AppDeps, "authedUser" | "capabilityCtx" | "guardCapability" | "getPool" | "overLimit" | "members" | "firstName"> & {
  /** Where this module's photos live. Never the public uploads directory. */
  photoDir: string;
  /** What a return visit needs to open a claim on the village's quest. Absent: visits pay nothing. */
  visitClaims?: Omit<VisitClaimDeps, "getPool">;
  /** When a member was admitted, where a module records it (a rite, an oath). Absent: nobody waits. */
  admission?: Admission;
  /** The bell: the member hears once when their map opens. Absent: nobody is told. */
  notify?: AppDeps["notify"];
  /**
   * Called once, the moment a member's map opens (a rite to stamp, say). Wired in
   * server/index.ts by whichever module cares; this one never names another.
   */
  opened?: (userId: string) => Promise<void>;
};

const HOUR_MS = 60 * 60 * 1000;
const PINS_PER_HOUR = 60;
const PHOTOS_PER_HOUR = 120;
const VOUCHES_PER_HOUR = 120;
const EXPORT_ASKS_PER_DAY = 3;

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/heic", "image/heif"]);

export function dials(): Dials {
  return {
    unlockPins: Math.max(0, Math.floor(numberVar("hiddenmap.unlock_pins"))),
    vouchesPerPin: Math.max(1, Math.floor(numberVar("hiddenmap.vouches_per_pin"))),
    teaser: boolVar("hiddenmap.teaser"),
  };
}

const defaultPrecision = (): Precision => {
  const v = stringVar("hiddenmap.default_precision");
  return isPrecision(v) ? v : "region";
};

/** The files multer read, always as an array: a tampered body can never pass a string or an object here. */
function uploadedFiles(req: any): Array<{ buffer: Buffer }> {
  const f = req?.files;
  return Array.isArray(f) ? f.filter((x) => x && Buffer.isBuffer(x.buffer)) : [];
}

const newId = (prefix: string) => `${prefix}-${crypto.randomBytes(8).toString("hex")}`;

export function register(app: Express, deps: Deps): void {
  const { authedUser, capabilityCtx, guardCapability, getPool, overLimit, members, firstName, photoDir, visitClaims, admission, notify, opened } = deps;
  const vid = () => villageId();
  const config = () => configOf(moduleConfig(MODULE_ID));

  /** A seat's power through the one gate, without the admin short-circuit. */
  const seated = async (user: any, cap: Capability): Promise<boolean> => {
    const ctx = await capabilityCtx(user);
    return hasCapability(cap, { ...ctx, isAdmin: false });
  };

  /**
   * Open the claims a member's vouched plantings are owed on the village's
   * planting quest, oldest first, stopping at the first the quest board refuses
   * (they already hold an open claim on it, or its gate says no). Each one
   * waiting opens on the next try after the one before it is decided, so every
   * vouched planting is paid once and none is dropped (QA pass 1, P1-r-1).
   */
  const openOwedPlantingClaims = async (ownerId: string) => {
    const questId = config().plantingQuestId;
    if (!visitClaims || !questId) return;
    try {
      const owed = await repo.owedPlantings(getPool(), vid(), ownerId, dials().vouchesPerPin);
      if (!owed.length) return;
      const ownerUser: any = (await members.byId(ownerId)) ?? { id: ownerId, name: "" };
      for (const pinId of owed) {
        const now = new Date();
        const claimId = await openVisitClaim(
          { ...visitClaims, getPool },
          { questId, user: { id: ownerId, name: ownerUser.name ?? "" }, at: now, note: plantingClaimNote(now) },
        );
        if (!claimId) break;
        await repo.setPlantingClaim(getPool(), vid(), pinId, claimId);
      }
    } catch (e) {
      console.error("[hidden-map] a vouched planting could not open its quest claim", e);
    }
  };

  /**
   * The moment a member's map opens: the `opened` hook (a rite to stamp), then
   * the notice. Once, because only the read that records the opening calls it,
   * and the notice carries its own dedupe key besides. Never a place.
   */
  const announceOpening = async (userId: string) => {
    if (opened) await opened(userId).catch((e: unknown) => console.error("[hidden-map] the opening hook failed", e));
    if (notify) {
      await notify({
        userId,
        type: "hidden_map_opened",
        title: "Your map is open",
        body: "Enough of your places are vouched for. Every place the members have logged is yours to explore.",
        link: "/hidden-map",
        dedupeKey: `hidden-map-opened:${userId}`,
      }).catch((e: unknown) => console.error("[hidden-map] the opening notice did not go", e));
    }
  };

  /**
   * After a vouch, the planter's map may have just opened. Record it and say so
   * now, at the moment, instead of on the planter's next look (QA pass 3, P3-11).
   */
  const settleOpeningOf = async (ownerId: string) => {
    try {
      const who = await whoAmI(getPool(), vid(), ownerId, false, dials(), new Date(), admission);
      if (who.justOpened) await announceOpening(ownerId);
    } catch (e) {
      console.error("[hidden-map] could not settle a planter's opening", e);
    }
  };

  const me = async (req: any) => {
    const user = await authedUser(req);
    if (!user) return null;
    const keeper = await seated(user, "hiddenmap.keep");
    const who = await whoAmI(getPool(), vid(), String(user.id), keeper, dials(), new Date(), admission);
    if (who.justOpened) await announceOpening(String(user.id));
    // A planter's owed claims open as each earlier one is decided.
    await openOwedPlantingClaims(String(user.id));
    return { user, who };
  };

  const upload = () =>
    multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: Math.max(1, numberVar("hiddenmap.photo_max_mb")) * 1024 * 1024, files: MAX_PHOTOS_PER_UPLOAD },
      fileFilter: (_req, file, cb) => {
        if (PHOTO_TYPES.has(String(file.mimetype).toLowerCase())) cb(null, true);
        else cb(new Error("Send a JPG, PNG, WebP, AVIF or HEIC picture."));
      },
    }).array("photos", MAX_PHOTOS_PER_UPLOAD);

  /** Strip, prove and store each file, then write its row. Stops at the first refusal. */
  const savePhotos = async (files: any[], pinId: string, visitId: string | null, uploader: string) => {
    const saved: string[] = [];
    for (const f of files) {
      const stored = await storePhoto(f.buffer, photoDir);
      const id = newId("hmf");
      await repo.insertPhoto(getPool(), vid(), { id, pinId, visitId, uploader, ...stored }, new Date());
      saved.push(id);
    }
    return saved;
  };

  const photoFailure = (res: any, e: unknown) => {
    if (e instanceof LocationDataSurvived) {
      console.error("[hidden-map] refused a photo whose metadata survived the strip");
      return res.status(500).json({ error: "That picture kept hidden details through the re-encode, so it was not stored." });
    }
    return res.status(400).json({ error: "That file could not be read as a picture." });
  };

  app.use("/api/hidden-map", requireModule(MODULE_ID));

  app.get("/api/hidden-map/me", async (req, res) => {
    const m = await me(req);
    if (!m) return res.status(401).json({ error: "auth_required" });
    const c = config();
    res.setHeader("Cache-Control", "private, no-store");
    res.json({
      open: m.who.opening.open,
      vouchedCount: m.who.opening.vouchedCount,
      needed: m.who.opening.needed,
      ownPins: m.who.ownPins,
      keeper: m.who.viewer.keeper,
      mayApproveExports: m.who.opening.open && (await seated(m.user, "hiddenmap.export")),
      title: c.title,
      kindPrompts: c.kindPrompts,
      plantingPays: Boolean(c.plantingQuestId),
      vouchWays: c.vouchWays,
      vouchRule: c.vouchRule,
      // The one thing a closed map learns about everybody else's pins: how many there are.
      allPins: await repo.countAllPins(getPool(), vid()),
      vouchesPerPin: dials().vouchesPerPin,
      // The member's own admission, so their meter counts what the server counts (QA P3-w-1).
      admitted: m.who.viewer.admitted !== false,
      countsFrom: m.who.countsFrom ? m.who.countsFrom.toISOString() : null,
      // Counts and a time, never a place: the opening moment and the closed map's one number.
      planters: await repo.countPlanters(getPool(), vid()),
      ...(await repo.openingOf(getPool(), vid(), String(m.user.id))),
      labels: c.labels,
      kinds: c.kinds,
      openLayers: c.openLayers,
      basemap: stringVar("hiddenmap.basemap"),
      maxZoom: Math.floor(numberVar("hiddenmap.basemap_max_zoom")),
      defaultPrecision: defaultPrecision(),
      teaser: boolVar("hiddenmap.teaser"),
      precisions: PRECISIONS,
    });
  });

  app.get("/api/hidden-map/pins", async (req, res) => {
    const m = await me(req);
    if (!m) return res.status(401).json({ error: "auth_required" });
    const pins = await readMap(getPool(), vid(), m.who.viewer, config(), dials());
    if (m.who.viewer.open || dials().teaser) await repo.logAccess(getPool(), vid(), String(m.user.id), "map.read");
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ pins, open: m.who.opening.open });
  });

  app.post("/api/hidden-map/pins", async (req, res) => {
    const user = await authedUser(req);
    if (!user) return res.status(401).json({ error: "auth_required" });
    const uid = String(user.id);
    const parsed = parsePinInput(req.body, config(), defaultPrecision());
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const pool = getPool();
    const existing = await repo.pinIdByClient(pool, vid(), parsed.pin.clientId);
    if (existing) {
      if (existing.ownerUserId !== uid) return res.status(409).json({ error: "That id is already used. Try again." });
      const again = await repo.getPin(pool, vid(), uid, existing.id);
      return res.status(200).json({ pin: again && visiblePin({ userId: uid, open: false, keeper: false }, again, { openLayers: [], teaser: false }) });
    }
    if (await overLimit(`hidden-map-pin:${uid}`, PINS_PER_HOUR, HOUR_MS)) {
      return res.status(429).json({ error: "That is a lot of pins for one hour. The rest can wait a little." });
    }
    const id = newId("hmp");
    await repo.insertPin(pool, vid(), id, uid, parsed.pin, new Date());
    const row = await repo.pinIdByClient(pool, vid(), parsed.pin.clientId);
    const pin = row ? await repo.getPin(pool, vid(), uid, row.id) : null;
    if (!pin) return res.status(500).json({ error: "The pin was not saved. Try again." });
    res.status(201).json({ pin: visiblePin({ userId: uid, open: false, keeper: false }, pin, { openLayers: [], teaser: false }) });
  });

  app.get("/api/hidden-map/pins/:id", async (req, res) => {
    const m = await me(req);
    if (!m) return res.status(401).json({ error: "auth_required" });
    const id = String(req.params?.id ?? "");
    const found = await readPin(getPool(), vid(), m.who.viewer, id, config(), dials());
    if (!found) return res.status(404).json({ error: "No such pin." });
    if (!found.view.mine) await repo.logAccess(getPool(), vid(), String(m.user.id), "pin.read", { pinId: id });
    const visits = await repo.visitsFor(getPool(), vid(), id, String(m.user.id));
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ pin: found.view, visits, mayVisit: mayVisit(m.who.viewer, found.record) });
  });

  app.post("/api/hidden-map/pins/:id/photos", async (req, res) => {
    const user = await authedUser(req);
    if (!user) return res.status(401).json({ error: "auth_required" });
    const uid = String(user.id);
    const id = String(req.params?.id ?? "");
    const pin = await repo.getPin(getPool(), vid(), uid, id);
    if (!pin || pin.ownerUserId !== uid) return res.status(404).json({ error: "No such pin of yours." });
    if (await overLimit(`hidden-map-photo:${uid}`, PHOTOS_PER_HOUR, HOUR_MS)) {
      return res.status(429).json({ error: "That is a lot of photos for one hour. Try again a little later." });
    }
    const held = await repo.countPhotos(getPool(), vid(), id);
    if (held >= MAX_PHOTOS_PER_PIN) return res.status(409).json({ error: `A pin holds ${MAX_PHOTOS_PER_PIN} photos at most.` });
    upload()(req, res, async (err: any) => {
      if (err) {
        const tooBig = err?.code === "LIMIT_FILE_SIZE";
        return res.status(400).json({ error: tooBig ? `That picture is over ${numberVar("hiddenmap.photo_max_mb")} MB.` : err.message || "Upload failed" });
      }
      const files = uploadedFiles(req);
      if (!files.length) return res.status(400).json({ error: "Add a photo." });
      if (held + files.length > MAX_PHOTOS_PER_PIN) return res.status(409).json({ error: `A pin holds ${MAX_PHOTOS_PER_PIN} photos at most.` });
      try {
        const photoIds = await savePhotos(files, id, null, uid);
        res.status(201).json({ photoIds });
      } catch (e) {
        photoFailure(res, e);
      }
    });
  });

  app.post("/api/hidden-map/pins/:id/visits", async (req, res) => {
    const m = await me(req);
    if (!m) return res.status(401).json({ error: "auth_required" });
    const uid = String(m.user.id);
    const id = String(req.params?.id ?? "");
    const pin = await repo.getPin(getPool(), vid(), uid, id);
    if (!pin || !mayVisit(m.who.viewer, pin)) return res.status(404).json({ error: "No such pin." });
    if (await overLimit(`hidden-map-photo:${uid}`, PHOTOS_PER_HOUR, HOUR_MS)) {
      return res.status(429).json({ error: "That is a lot of photos for one hour. Try again a little later." });
    }
    upload()(req, res, async (err: any) => {
      if (err) return res.status(400).json({ error: err?.code === "LIMIT_FILE_SIZE" ? "That picture is too large." : err.message || "Upload failed" });
      const body = req.body ?? {};
      if (!isClientId(body.clientId)) return res.status(400).json({ error: "A visit needs the id the device made for it." });
      const prior = await repo.visitIdByClient(getPool(), vid(), body.clientId);
      if (prior) {
        if (prior.visitor !== uid) return res.status(409).json({ error: "That id is already used. Try again." });
        return res.status(200).json({ visitId: prior.id });
      }
      const stageSeen: Stage | null = body.stageSeen ? (isStage(body.stageSeen) ? body.stageSeen : null) : null;
      if (body.stageSeen && !stageSeen) return res.status(400).json({ error: "The stage is seed, sprout, sapling, tree or lost." });
      const files = uploadedFiles(req);
      if (!files.length) return res.status(400).json({ error: "A return visit needs a photo." });
      const held = await repo.countPhotos(getPool(), vid(), id);
      if (held + files.length > MAX_PHOTOS_PER_PIN) return res.status(409).json({ error: `A pin holds ${MAX_PHOTOS_PER_PIN} photos at most.` });
      const visitId = newId("hmv");
      const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, MAX_NOTES) : null;
      const now = new Date();
      let photoIds: string[];
      try {
        // Photos first: a visit with no photo that survived the strip is no visit.
        photoIds = await savePhotos(files, id, visitId, uid);
      } catch (e) {
        return photoFailure(res, e);
      }
      await repo.insertVisit(getPool(), vid(), { id: visitId, clientId: body.clientId, pinId: id, visitor: uid, stageSeen, note }, now);
      if (pin.layer === "planting") {
        const latest = await repo.latestStageSeen(getPool(), vid(), id);
        if (latest) await repo.setStage(getPool(), vid(), id, latest, now);
      }
      // A visit by an open member to somebody else's pin opens a claim on the
      // village's return-visit quest, once per window. The visit stands either way.
      let claimed = false;
      const questId = config().returnVisitQuestId;
      if (visitClaims && questId) {
        const lastPaidAt = await repo.lastPaidVisitAt(getPool(), vid(), uid, id);
        const windowDays = Math.max(0, Math.floor(numberVar("hiddenmap.visit_pay_days")));
        if (visitMayPay({ viewer: m.who.viewer, pin, questId, lastPaidAt, now, windowDays })) {
          try {
            const claimId = await openVisitClaim({ ...visitClaims, getPool }, { questId, user: m.user, at: now });
            if (claimId) {
              await repo.setVisitClaim(getPool(), vid(), visitId, claimId);
              claimed = true;
            }
          } catch (e) {
            console.error("[hidden-map] a visit could not open its quest claim", e);
          }
        }
      }
      res.status(201).json({ visitId, photoIds, claimed });
    });
  });

  app.post("/api/hidden-map/pins/:id/vouch", async (req, res) => {
    const m = await me(req);
    if (!m) return res.status(401).json({ error: "auth_required" });
    const uid = String(m.user.id);
    const id = String(req.params?.id ?? "");
    const found = await readPin(getPool(), vid(), m.who.viewer, id, config(), dials());
    if (!found) return res.status(404).json({ error: "No such pin." });
    const may = mayVouch(m.who.viewer, found.record);
    if (!may.ok) return res.status(may.status).json({ error: may.error });
    // How the voucher saw it, said with every vouch and kept beside it with no name.
    const seen = req.body?.seen;
    const ways = config().vouchWays;
    if (!isVouchWay(seen) || !ways.includes(seen)) {
      return res.status(400).json({ error: `Say how you saw it: ${ways.join(", ")}.` });
    }
    if (await overLimit(`hidden-map-vouch:${uid}`, VOUCHES_PER_HOUR, HOUR_MS)) {
      return res.status(429).json({ error: "That is a lot of vouches for one hour." });
    }
    const now = new Date();
    await repo.upsertVouch(getPool(), vid(), id, uid, m.who.viewer.open ? "open" : "keeper", now, seen);
    await repo.logAccess(getPool(), vid(), uid, "vouch", { pinId: id });
    if (found.record.ownerUserId && found.record.layer === "planting") await settleOpeningOf(found.record.ownerUserId);
    const after = await repo.getPin(getPool(), vid(), uid, id);
    // A planting that has just reached its vouches is owed a claim for its owner
    // on the village's planting quest, once per pin. Paid by the ordinary
    // consent route and the village's quest.completed rule, like any quest.
    if (after?.ownerUserId && after.layer === "planting") await openOwedPlantingClaims(after.ownerUserId);
    res.json({ vouches: after?.vouches ?? found.record.vouches, vouchedByMe: true });
  });

  app.delete("/api/hidden-map/pins/:id/vouch", async (req, res) => {
    const user = await authedUser(req);
    if (!user) return res.status(401).json({ error: "auth_required" });
    const uid = String(user.id);
    const id = String(req.params?.id ?? "");
    const withdrawn = await repo.withdrawVouch(getPool(), vid(), id, uid, new Date());
    if (!withdrawn) return res.status(404).json({ error: "You have no vouch on that pin." });
    await repo.logAccess(getPool(), vid(), uid, "vouch.withdraw", { pinId: id });
    res.json({ withdrawn: true });
  });

  app.post("/api/hidden-map/pins/:id/hide", async (req, res) => {
    const user = await authedUser(req);
    if (!user) return res.status(401).json({ error: "auth_required" });
    // An act, so it asks the one gate: with the power handed to the village, the gate opens the vote path (0.4).
    if (!(await guardCapability(req, res, "hiddenmap.keep"))) return;
    const id = String(req.params?.id ?? "");
    const hidden = await repo.hidePin(getPool(), vid(), id, String(user.id), new Date());
    if (!hidden) return res.status(404).json({ error: "No such pin, or it is already hidden." });
    await repo.logAccess(getPool(), vid(), String(user.id), "pin.hide", { pinId: id });
    res.json({ hidden: true });
  });

  app.get("/api/hidden-map/photos/:id", async (req, res) => {
    const m = await me(req);
    if (!m) return res.status(401).json({ error: "auth_required" });
    const photo = await repo.photoById(getPool(), vid(), String(req.params?.id ?? ""));
    if (!photo) return res.status(404).json({ error: "No such photo." });
    // The same rule as the pin: a photo is never readable where its pin is not.
    const found = await readPin(getPool(), vid(), m.who.viewer, photo.pinId, config(), dials());
    if (!found) return res.status(404).json({ error: "No such photo." });
    const file = photoPath(photoDir, req.query?.size === "thumb" ? photo.thumbFilename : photo.filename);
    if (!file || !fs.existsSync(file)) return res.status(404).json({ error: "No such photo." });
    res.setHeader("Content-Type", "image/webp");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(await fs.promises.readFile(file));
  });

  app.get("/api/hidden-map/vouch-queue", async (req, res) => {
    const m = await me(req);
    if (!m) return res.status(401).json({ error: "auth_required" });
    if (!m.who.viewer.open && !m.who.viewer.keeper) return res.json({ pins: [], mayVouch: false });
    const pins = await readQueue(getPool(), vid(), m.who.viewer, config(), dials());
    await repo.logAccess(getPool(), vid(), String(m.user.id), "queue.read");
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ pins, mayVouch: true });
  });

  // ── Exports: two people, once ─────────────────────────────────────────

  const exportHours = () => Math.max(1, Math.floor(numberVar("hiddenmap.export_hours")));

  app.get("/api/hidden-map/exports", async (req, res) => {
    const m = await me(req);
    if (!m) return res.status(401).json({ error: "auth_required" });
    if (!m.who.viewer.open) return res.status(403).json({ error: "This opens with your map." });
    await repo.expireExports(getPool(), vid(), new Date());
    const rows = await repo.listExports(getPool(), vid());
    const uid = String(m.user.id);
    res.json({
      exports: rows.map((r) => ({
        id: r.id,
        mine: r.requestedBy === uid,
        precision: r.precision,
        status: r.status,
        decidedByMe: r.decidedBy === uid,
        expiresAt: r.expiresAt.toISOString(),
        createdAt: r.createdAt,
      })),
    });
  });

  app.post("/api/hidden-map/exports", async (req, res) => {
    const m = await me(req);
    if (!m) return res.status(401).json({ error: "auth_required" });
    if (!m.who.viewer.open) return res.status(403).json({ error: "This opens with your map." });
    const precision = req.body?.precision;
    if (!isPrecision(precision)) return res.status(400).json({ error: `Choose how exactly: ${PRECISIONS.join(", ")}.` });
    const uid = String(m.user.id);
    if (await overLimit(`hidden-map-export:${uid}`, EXPORT_ASKS_PER_DAY, 24 * HOUR_MS)) {
      return res.status(429).json({ error: "Three asks for a copy a day is the most." });
    }
    const id = newId("hmx");
    const now = new Date();
    await repo.insertExport(getPool(), vid(), { id, requestedBy: uid, precision, expiresAt: new Date(now.getTime() + exportHours() * HOUR_MS) }, now);
    await repo.logAccess(getPool(), vid(), uid, "export.ask", { exportId: id });
    res.status(201).json({ id, status: "pending" });
  });

  const decide = (to: "approved" | "declined") => async (req: any, res: any) => {
    const m = await me(req);
    if (!m) return res.status(401).json({ error: "auth_required" });
    const uid = String(m.user.id);
    if (!m.who.viewer.open || !(await seated(m.user, "hiddenmap.export"))) {
      return res.status(403).json({ error: "Approving a copy is for an open member who holds the power to approve one." });
    }
    const id = String(req.params?.id ?? "");
    await repo.expireExports(getPool(), vid(), new Date());
    const row = await repo.getExport(getPool(), vid(), id);
    if (!row) return res.status(404).json({ error: "No such request." });
    if (row.requestedBy === uid) return res.status(409).json({ error: "A copy takes two people. You asked for this one." });
    const now = new Date();
    const moved = await repo.moveExport(getPool(), vid(), id, "pending", to, uid, now, to === "approved" ? new Date(now.getTime() + exportHours() * HOUR_MS) : undefined);
    if (!moved) return res.status(409).json({ error: "Somebody already answered this one, or it expired." });
    if (to === "approved") await repo.logAccess(getPool(), vid(), uid, "export.approve", { exportId: id });
    res.json({ id, status: to });
  };
  app.post("/api/hidden-map/exports/:id/approve", decide("approved"));
  app.post("/api/hidden-map/exports/:id/decline", decide("declined"));

  app.post("/api/hidden-map/exports/:id/withdraw", async (req, res) => {
    const user = await authedUser(req);
    if (!user) return res.status(401).json({ error: "auth_required" });
    const id = String(req.params?.id ?? "");
    const row = await repo.getExport(getPool(), vid(), id);
    if (!row || row.requestedBy !== String(user.id)) return res.status(404).json({ error: "No such request of yours." });
    const moved =
      (await repo.moveExport(getPool(), vid(), id, "pending", "withdrawn", null, new Date())) ||
      (await repo.moveExport(getPool(), vid(), id, "approved", "withdrawn", null, new Date()));
    res.json({ id, status: moved ? "withdrawn" : row.status });
  });

  app.get("/api/hidden-map/exports/:id/download", async (req, res) => {
    const m = await me(req);
    if (!m) return res.status(401).json({ error: "auth_required" });
    const uid = String(m.user.id);
    const id = String(req.params?.id ?? "");
    await repo.expireExports(getPool(), vid(), new Date());
    const row = await repo.getExport(getPool(), vid(), id);
    if (!row || row.requestedBy !== uid) return res.status(404).json({ error: "No such request of yours." });
    if (!m.who.viewer.open) return res.status(403).json({ error: "This opens with your map." });
    // Once: the move from approved to downloaded is the lock.
    const moved = await repo.moveExport(getPool(), vid(), id, "approved", "downloaded", null, new Date());
    if (!moved) return res.status(409).json({ error: row.status === "pending" ? "This copy is waiting for a second person." : "This copy is no longer available." });
    const pins = (await readMap(getPool(), vid(), m.who.viewer, config(), { ...dials(), teaser: false })).filter(
      (p): p is PinView => !("dot" in p),
    );
    await repo.logAccess(getPool(), vid(), uid, "export.download", { exportId: id });
    res.setHeader("Content-Type", "application/geo+json");
    res.setHeader("Content-Disposition", `attachment; filename="map-export-${id}.geojson"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(JSON.stringify(exportGeoJson(pins, row.precision)));
  });

  app.get("/api/hidden-map/access-log", async (req, res) => {
    const user = await authedUser(req);
    if (!user) return res.status(401).json({ error: "auth_required" });
    const uid = String(user.id);
    const keeper = await seated(user, "hiddenmap.keep");
    const rows = await repo.readAccessLog(getPool(), vid(), keeper ? {} : { userId: uid });
    if (keeper) await repo.logAccess(getPool(), vid(), uid, "log.read");
    res.setHeader("Cache-Control", "private, no-store");
    // A keeper reads WHO acted and WHEN, by first name, and never WHERE: no
    // pin or export id, so the log cannot put a person beside a place. A
    // member reading their own rows sees the pins they touched.
    if (!keeper) {
      return res.json({ rows: rows.map((r) => ({ who: "you", action: r.action, pinId: r.pinId, exportId: r.exportId, at: r.at })), all: false });
    }
    const people = rows.some((r) => r.userId && r.userId !== uid) ? await members.all() : [];
    const nameOf = new Map(people.map((u: any) => [String(u.id), firstName(u.name ?? "Member")]));
    const who = (id: string | null) => (!id ? "A former member" : id === uid ? "You" : nameOf.get(id) ?? "A member");
    res.json({ rows: rows.map((r) => ({ who: who(r.userId), action: r.action, at: r.at })), all: true });
  });
}

/** The retention job: trims the access log and expires stale exports. */
export async function sweepHiddenMap(pool: any, now: Date = new Date()): Promise<string> {
  const days = Math.max(7, Math.floor(numberVar("hiddenmap.access_log_days")));
  const purged = await repo.purgeAccessLog(pool, villageId(), new Date(now.getTime() - days * 24 * HOUR_MS));
  const expired = await repo.expireExports(pool, villageId(), now);
  return `access rows trimmed: ${purged}; exports expired: ${expired}`;
}
