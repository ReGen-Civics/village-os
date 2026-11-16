/**
 * The hidden map's decisions on the server: who a viewer is, what the map
 * shows them, how a photo is stored, and what leaves with a member.
 *
 * The rules are shared/hiddenMap.ts and every statement is
 * server/repos/hiddenMap.ts. The routes are server/routes/hiddenMap.ts.
 *
 * ── PHOTOS NEVER TOUCH THE PUBLIC UPLOADS DIRECTORY ──────────────────────
 *
 * `/api/uploads/:filename` is ungated: the filename is its only lock. A photo
 * of a planting that the village keeps secret cannot live behind a lock that
 * is a string anybody holding the link can type. So these files go to their
 * own directory beside it (`DATA_DIR/hidden-map`), named by 32 random hex
 * characters, and only `GET /api/hidden-map/photos/:id` reads them, after
 * asking the same visibility rule as the pin.
 *
 * Every byte is re-encoded by `stripAndEncode`, which re-reads its own output
 * and throws if any metadata survived, and is written through
 * `writeToVolume`, the one write helper `scripts/check-upload-strip.mjs`
 * expects.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Pool } from "mysql2/promise";
import {
  numberDots, opening, readConfig, visiblePin, type HiddenMapConfig, type Opening, type PinDot, type PinRecord, type PinView,
  type Viewer,
} from "../../shared/hiddenMap";
import { stripAndEncode } from "./placePhotos";
import { writeToVolume } from "./uploads";
import * as repo from "../repos/hiddenMap";

/** The longest edge a stored photo keeps. Enough to see a seedling; small enough for a weak signal. */
export const PHOTO_EDGE = 1600;
export const THUMB_EDGE = 360;

export interface Dials {
  unlockPins: number;
  vouchesPerPin: number;
  teaser: boolean;
}

export interface WhoAmI {
  viewer: Viewer;
  opening: Opening;
  ownPins: number;
  /** True only on the read that recorded the opening: the moment to tell the member. */
  justOpened: boolean;
}

/**
 * When a member was admitted, where the village marks admission (a rite, an
 * oath): pins count toward opening only from then, and a member not yet
 * admitted neither opens the map nor vouches. `undefined` means the village
 * marks no admission, and everything counts as before. Supplied by whichever
 * module records admission; this module records none of its own.
 */
export type Admission = (userId: string) => Promise<Date | null | undefined>;

/**
 * Who this member is to the map. Records the opening the first time the count
 * reaches the dial, and from then on reads only the record, so nothing that
 * happens later can close it.
 */
export async function whoAmI(
  pool: Pool,
  villageId: string,
  userId: string,
  keeper: boolean,
  dials: Dials,
  now: Date = new Date(),
  admission?: Admission,
): Promise<WhoAmI> {
  const since = admission ? await admission(userId) : undefined;
  const admitted = since !== null;
  const [opened, vouched, ownPins] = await Promise.all([
    repo.hasOpened(pool, villageId, userId),
    admitted ? repo.countVouchedPlantings(pool, villageId, userId, dials.vouchesPerPin, since ?? null) : Promise.resolve(0),
    repo.countOwnPins(pool, villageId, userId),
  ]);
  // A member not yet admitted never opens the map, a dial of zero included. An opening already recorded stands.
  const o = admitted ? opening(vouched, dials.unlockPins, opened) : { open: opened, vouchedCount: 0, needed: Math.max(0, Math.floor(dials.unlockPins)) };
  const justOpened = o.open && !opened;
  if (justOpened) await repo.recordOpening(pool, villageId, userId, vouched, o.needed, now);
  return { viewer: { userId, open: o.open, keeper, admitted }, opening: o, ownPins, justOpened };
}

/** The map as this viewer may read it. The SQL scope is the first wall; `visiblePin` is the second. */
export async function readMap(pool: Pool, villageId: string, viewer: Viewer, config: HiddenMapConfig, dials: Dials): Promise<Array<PinView | PinDot>> {
  const scoped = viewer.open || dials.teaser
    ? await repo.listPins(pool, villageId, viewer.userId)
    : await repo.listPins(pool, villageId, viewer.userId, { ownerOnly: viewer.userId, alsoLayers: config.openLayers });
  const out: Array<PinView | PinDot> = [];
  for (const pin of scoped) {
    const v = visiblePin(viewer, pin, { openLayers: config.openLayers, teaser: dials.teaser });
    if (v) out.push(v);
  }
  return numberDots(out);
}

/** Pins awaiting a vouch that this viewer may vouch for: never their own. */
export async function readQueue(pool: Pool, villageId: string, viewer: Viewer, config: HiddenMapConfig, dials: Dials): Promise<PinView[]> {
  if (!viewer.open && !viewer.keeper) return [];
  const pins = await repo.listPins(pool, villageId, viewer.userId, { awaitingBelow: Math.max(1, dials.vouchesPerPin) });
  const out: PinView[] = [];
  for (const pin of pins) {
    if (pin.ownerUserId === viewer.userId || pin.layer !== "planting") continue;
    const v = visiblePin(viewer, pin, { openLayers: config.openLayers, teaser: false, queue: true, vouchesPerPin: dials.vouchesPerPin });
    if (v && !("dot" in v)) out.push(v);
  }
  return out;
}

/** One pin, or null when this viewer may not read it in full. A dot is never a pin's detail. */
export async function readPin(
  pool: Pool,
  villageId: string,
  viewer: Viewer,
  id: string,
  config: HiddenMapConfig,
  dials: Dials,
): Promise<{ record: PinRecord; view: PinView } | null> {
  const record = await repo.getPin(pool, villageId, viewer.userId, id);
  if (!record) return null;
  let view = visiblePin(viewer, record, { openLayers: config.openLayers, teaser: false });
  // A keeper whose map is closed may open a pin from the queue to vouch it.
  if (!view && viewer.keeper) {
    view = visiblePin(viewer, record, { openLayers: config.openLayers, teaser: false, queue: true, vouchesPerPin: dials.vouchesPerPin });
  }
  if (!view || "dot" in view) return null;
  return { record, view };
}

export const configOf = (raw: unknown): HiddenMapConfig => readConfig(raw);

// ── Photos ────────────────────────────────────────────────────────────────

const FILE_RE = /^hm-[0-9a-f]{32}(\.thumb)?\.webp$/;

/** Where this module's photos live: beside the uploads directory, never inside it. */
export function hiddenMapDir(uploadsDir: string): string {
  return path.join(path.dirname(uploadsDir), "hidden-map");
}

/** A random file stem nobody can guess. */
export function photoStem(): string {
  return `hm-${crypto.randomBytes(16).toString("hex")}`;
}

/** A stored file's path, or null for any name this module did not make. */
export function photoPath(dir: string, filename: string): string | null {
  if (!FILE_RE.test(filename)) return null;
  return path.join(dir, filename);
}

/**
 * Re-encode a photo with no metadata, prove it, and write the full size and a
 * thumbnail. If the thumbnail fails, the full size is removed again, so a half
 * pair never reaches a row.
 */
export async function storePhoto(input: Buffer, dir: string): Promise<{ filename: string; thumbFilename: string; width: number; height: number; bytes: number }> {
  const stem = photoStem();
  const filename = `${stem}.webp`;
  const thumbFilename = `${stem}.thumb.webp`;
  const full = await stripAndEncode(input, PHOTO_EDGE, 80);
  writeToVolume(dir, filename, full.bytes);
  try {
    const thumb = await stripAndEncode(input, THUMB_EDGE, 72);
    writeToVolume(dir, thumbFilename, thumb.bytes);
  } catch (e) {
    try { fs.unlinkSync(path.join(dir, filename)); } catch { /* never written */ }
    throw e;
  }
  return { filename, thumbFilename, width: full.width, height: full.height, bytes: full.bytes.length };
}

function removeFiles(dir: string, files: Array<{ filename: string; thumbFilename: string }>): void {
  for (const f of files) {
    for (const name of [f.filename, f.thumbFilename]) {
      const p = photoPath(dir, name);
      if (p) {
        try { fs.unlinkSync(p); } catch { /* already gone */ }
      }
    }
  }
}

// ── A member's own data ───────────────────────────────────────────────────

/** Erasure: photos deleted from the disk and the rows, pins and visits left with nobody attached. */
export async function forgetMemberHiddenMap(pool: Pool, villageId: string, userId: string, dir: string): Promise<number> {
  const uid = String(userId ?? "").trim();
  if (!uid) return 0;
  const files = await repo.forgetMember(pool, villageId, uid);
  removeFiles(dir, files);
  return files.length;
}

/** Everything the hidden map holds about this member, for their own profile export. */
export async function exportMemberHiddenMap(pool: Pool, villageId: string, userId: string): Promise<{
  pins: PinView[];
  visits: Array<{ pinId: string; stageSeen: string | null; note: string | null; at: string }>;
  photos: number;
}> {
  const viewer: Viewer = { userId, open: false, keeper: false };
  const own = await repo.listPins(pool, villageId, userId, { ownerOnly: userId });
  const pins = own
    .map((p) => visiblePin(viewer, p, { openLayers: [], teaser: false }))
    .filter((v): v is PinView => v !== null && !("dot" in v));
  const [visits, photos] = await Promise.all([repo.ownVisits(pool, villageId, userId), repo.ownPhotos(pool, villageId, userId)]);
  return { pins, visits, photos: photos.length };
}
