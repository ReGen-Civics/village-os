/**
 * WHAT THE ROLES PAGE'S ORG CHART DRAWS (Rye, 16 Nov 2026: a picture in picture of /circles).
 *
 * The same rows /circles hands its drawing, the roles /api/org sends this reader, plus the held team
 * roles the founding team answer names and /api/org leaves out. A filled anchor role is usually
 * unlisted, so a visitor's /api/org carries only the open ones, and the picture would show three open
 * roles beside a roster of nine. Each added role is drawn held, in the founding circle, and carries
 * nothing about who holds it.
 *
 * The counts are the team circle's own, by the drawing's rule: a role is held when its holders fill
 * its places. Coming-soon and future-venture roles are drawn and never counted, as on /circles.
 */
import type { MiniCircle, MiniSeat } from "@/components/CirclesMiniMap";
import type { OrgChartCounts } from "./OrgChartTile";

export interface OrgChart {
  seats: MiniSeat[];
  counts: OrgChartCounts;
}

export function orgChartOf(
  circles: readonly MiniCircle[],
  orgRows: readonly any[],
  teamCircleId: string | null,
  team: readonly { id: string }[],
): OrgChart | null {
  if (circles.length === 0 || !teamCircleId) return null;
  const circle = circles.find((c) => String(c.id) === String(teamCircleId));
  if (!circle) return null;
  const seats: MiniSeat[] = orgRows
    .filter((r) => r && r.id != null)
    .map((r) => ({
      id: String(r.id),
      circleId: r.circleId ?? null,
      seats: r.seats,
      holderCount: r.holderCount,
      comingSoon: r.comingSoon === true,
      futureVenture: r.futureVenture === true,
    }));
  const have = new Set(seats.map((s) => s.id));
  for (const m of team) if (!have.has(m.id)) seats.push({ id: m.id, circleId: circle.id, seats: 1, holderCount: 1 });
  let held = 0;
  let open = 0;
  for (const s of seats) {
    if (String(s.circleId ?? "") !== String(circle.id) || s.comingSoon || s.futureVenture) continue;
    if (Number(s.holderCount ?? 0) >= Number(s.seats ?? 1)) held += 1;
    else open += 1;
  }
  return { seats, counts: { circleId: circle.id, circleName: circle.name, held, open } };
}
