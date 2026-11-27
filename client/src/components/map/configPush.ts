/**
 * What the shell's config push says about the LAND: which scene, and whether
 * the seed's own ground belongs under it.
 *
 * Two decisions, both pure, so they are tested without a frame. LivingMap's
 * `pushConfig` sends what they return.
 *
 * ── THE SCENE ────────────────────────────────────────────────────────────
 * A published scene travels as JSON text and is parsed here, once. NOTHING
 * PUBLISHED (`scene: null` with `sceneVersion: 0`, which only a server that
 * answered says) is no longer "keep your own": the map's own is another
 * village's land. It gets `blankScene()` instead, once per frame, because
 * the map treats every version-0 push as news and a second one, sent when a
 * skin is saved, would tell a cartographer mid-draft that the live map had
 * changed. Anything the server did not answer still sends no scene at all.
 *
 * ── THE GROUND ───────────────────────────────────────────────────────────
 * `seedFrame` from `GET /api/land` says whether this village stands on the
 * seed's own rectangle. The map took the seed's coast and place names down
 * only under a village with its own picture; under one without, it drew the
 * seed's satellite, coast, place names and district names as the village's.
 * The verdict rides the config push, ahead of the scene, so the land is
 * painted once on the right ground and the cover lifts on it. A land read
 * that fails says nothing, and the map keeps what it would have drawn before.
 *
 * The land read is the one the ground push makes as well, so the shell asks
 * once per boot and hands the same answer to both.
 */
import { blankScene } from "@shared/mapFromMasterplan";
import { walkPush } from "@shared/mapAddress";
import { landGroundOf } from "./landGround";

export type LandAnswer = Record<string, any> | null;

/** The village's public land record, or null when it could not be read. */
export function readLand(): Promise<LandAnswer> {
  return fetch("/api/land")
    .then(async (res) => (res.ok ? ((await res.json()) as LandAnswer) : null))
    .catch(() => null);
}

/** Whether the village stands on the seed's rectangle, or null when nothing reliable was said. */
export function seedGroundOf(land: LandAnswer): boolean | null {
  return land && typeof land.seedFrame === "boolean" ? land.seedFrame : null;
}

/**
 * The scene part of a config push, from the config route's answer.
 *
 * Returns null when no scene should be sent: the server sent one that will
 * not parse (the map keeps the land it already has, a strictly better failure
 * than a half-applied scene), or said nothing usable, or the blank has
 * already been sent to this frame.
 */
export function configScene(
  body: any,
  blankAlreadySent: boolean,
): { scene: unknown; sceneVersion: number; blank: boolean } | null {
  if (typeof body?.scene === "string" && body.scene) {
    try {
      return { scene: JSON.parse(body.scene), sceneVersion: Number(body.sceneVersion) || 0, blank: false };
    } catch {
      return null;
    }
  }
  if (body?.scene === null && body?.sceneVersion === 0 && !blankAlreadySent) {
    return { scene: blankScene(), sceneVersion: 0, blank: true };
  }
  return null;
}

/**
 * Push the village's own map into a frame: its skin, walk, vocabulary, name, the published scene and its ground.
 *
 * ONE PUSH FOR EVERY FRAME. The Living Map's shell (pages/LivingMap.tsx) sends it when the artifact announces itself
 * and again when the wizard saves; the home page's peek (components/MapPeek.tsx) sends it once, so the small window
 * shows the village's map as it stands and never the artifact's own sample village (the lead, 27 Nov 2026: "it's
 * actually not reflecting the latest map").
 *
 * A message goes on EVERY path, a bare `{type:'config'}` when the fetch fails: the artifact keeps its land covered
 * until the shell has said what it will say about the land, and a bare message changes nothing while it ends the
 * wait. The village's own ground also goes on its own the moment it is known, so the picture downloads while the
 * config is still on its way. `blankSent` is per frame: the blank scene goes once.
 */
export async function pushVillageConfig(
  win: Window,
  opts: { blankSent: { current: boolean }; land?: Promise<LandAnswer> },
): Promise<void> {
  const payload: Record<string, unknown> = { type: "config" };
  const ground = (opts.land ?? readLand()).then((body) => {
    const g = landGroundOf(body);
    if (g) {
      try {
        win.postMessage({ type: "ground", ...g }, window.location.origin);
      } catch {
        /* The frame went away: nobody is waiting. */
      }
    }
    return g;
  });
  try {
    // Where the village stands rides the boot push only.
    const [res, landBody] = await Promise.all([fetch("/api/map/config"), opts.land ?? Promise.resolve(null)]);
    const seedGround = seedGroundOf(landBody);
    if (seedGround !== null) payload.seedGround = seedGround;
    if (!res.ok) return;
    const body = await res.json();
    // One push carries skin, walk and vocabulary; the artifact applies each part only when present.
    if (body?.skin) payload.skin = body.skin;
    Object.assign(payload, walkPush(body));
    if (body?.vocabulary) payload.vocabulary = body.vocabulary;
    // The village's own name and its guide's, for the map's top bar and dock.
    if (body?.village) payload.village = body.village;
    // The published land, or the blank one when nothing is published: the map's own seed is another village's land.
    const told = configScene(body, opts.blankSent.current);
    if (told) {
      payload.scene = told.scene;
      payload.sceneVersion = told.sceneVersion;
      if (told.blank) opts.blankSent.current = true;
    }
  } catch {
    /* The map keeps whatever it is already wearing. */
  } finally {
    const g = await ground;
    if (g) payload.ground = g;
    try {
      win.postMessage(payload, window.location.origin);
    } catch {
      /* The frame went away under the fetch: nobody is waiting. */
    }
  }
}
