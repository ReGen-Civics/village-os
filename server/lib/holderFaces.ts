/**
 * THE FACES OF THE PEOPLE HOLDING ROLES (the lead, 26 Nov 2026: "Should we put our faces here and actually show
 * humans? ... I like humans"), for the founding team on /roles.
 *
 * A face is a portrait its owner has PUBLISHED, and nothing else:
 *   - The read passes no viewer (`portraitsVisibleTo(..., null)`), so the SQL returns published rows only and a
 *     private filename never leaves the database on this request. Same rule as every stranger's read of a portrait.
 *   - No stock art and no generated stand-in: a holder with no published portrait has no face here, and the page
 *     draws their initial as before.
 *   - Which portrait: the one for the character that fronts their sheet (the primary, else the first they walked),
 *     as the player card picks it, else any other portrait they have published.
 *
 * Nobody can give someone else a face: a portrait is uploaded and published by its owner, and this only reads.
 */
import type { Pool } from "mysql2/promise";
import { portraitsVisibleTo } from "../repos/characterPortraits";
import { readCharacters } from "../repos/playerCard";
import { portraitUrl } from "./characterPortraits";

export async function publishedFacesOf(pool: Pool, villageId: string | undefined, userIds: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (!villageId || ids.length === 0) return out;
  const [portraits, { primary, characters }] = await Promise.all([
    portraitsVisibleTo(pool, villageId, ids, null),
    readCharacters(pool, villageId, ids),
  ]);
  for (const id of ids) {
    const theirs = portraits.filter((p) => p.userId === id);
    if (theirs.length === 0) continue;
    const mine = characters.filter((c) => c.userId === id);
    const front = mine.find((c) => c.id === primary.get(id)) ?? mine[0];
    const pick = (front && theirs.find((p) => p.archetypeKey === front.archetypeKey)) ?? theirs[0];
    const url = portraitUrl(pick.fileName);
    if (url) out.set(id, url);
  }
  return out;
}
