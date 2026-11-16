/**
 * SEASON CREW, WHO PICKS (shared/seasonCrew.ts holds the rules).
 *
 * A circle's picker is a live member holder of the circle's role named by
 * `season_crew.picker_role`. A circle with no such live holder, or a village
 * that leaves the dial blank, is picked for by every live role holder in the
 * circle (`crews`), so no circle is left unable to pick (constitution 0.4).
 * Lapsing, documented holders and agents follow the org chart exactly as the
 * crew reader does.
 */
import type { Pool } from "mysql2/promise";
import { isPickerRole, PICKER_ROLE_KEY, SHIP_NEEDS_PLACE_KEY } from "../../shared/seasonCrew";
import { listOrgAssignments, listOrgRoles, type LapseContext } from "./orgChart";
import { crews } from "./seasonPlaces";
import { boolVar, stringVar } from "./variables";

export interface CirclePickers {
  /** The live holders who pick for this circle. */
  pickers: string[];
  /** The picking role's name when a live holder of it picks; null when the crew picks. */
  roleName: string | null;
}

export const crewDials = {
  pickerRole: (): string => stringVar(PICKER_ROLE_KEY),
  needsPlace: (): boolean => boolVar(SHIP_NEEDS_PLACE_KEY),
};

/** Every circle's pickers, read once. */
export async function pickersByCircle(pool: Pool, lapse: LapseContext): Promise<Map<string, CirclePickers>> {
  const dial = crewDials.pickerRole();
  const crewMap = await crews(pool, lapse);
  const out = new Map<string, CirclePickers>();
  const pickerRoles = new Map<string, { circleId: string; name: string }>();
  if (dial.trim()) {
    for (const r of await listOrgRoles(pool)) {
      if (r.active && r.circleId && isPickerRole(r.name, dial)) pickerRoles.set(r.id, { circleId: r.circleId, name: r.name });
    }
  }
  if (pickerRoles.size) {
    for (const a of await listOrgAssignments(pool, lapse)) {
      const role = pickerRoles.get(a.orgRoleId);
      if (!role || a.lapsed || a.holderKind !== "member" || !a.userId || a.isAgent) continue;
      const entry = out.get(role.circleId) ?? { pickers: [], roleName: role.name };
      if (!entry.pickers.includes(a.userId)) entry.pickers.push(a.userId);
      out.set(role.circleId, entry);
    }
  }
  // The fallback: a circle with no live picker is picked for by its crew.
  for (const [circleId, crew] of Array.from(crewMap.entries())) {
    if (!out.has(circleId) && crew.length) out.set(circleId, { pickers: [...crew], roleName: null });
  }
  return out;
}

export async function pickersOf(pool: Pool, lapse: LapseContext, circleId: string): Promise<CirclePickers> {
  return (await pickersByCircle(pool, lapse)).get(circleId) ?? { pickers: [], roleName: null };
}
