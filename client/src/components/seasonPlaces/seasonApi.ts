/**
 * The season places screens' reads and writes (module `season-places`), and
 * their words. Platform words only: "circle", "gathering", "team". A village's
 * own words reach these screens through its data (each circle's name, each
 * gathering's title, the picking role's title), never through this file.
 *
 * Routes: server/routes/seasonCrew.ts, seasonPlaces.ts, seasonPlaceGatherings.ts
 * and rolePrerequisites.ts.
 */
import { authToken } from "@/lib/gameApi";

export async function ask(path: string, method: "GET" | "POST" | "PUT" = "GET", body?: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  const t = authToken();
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export interface CrewCircle {
  circleId: string;
  name: string;
  pickedBy: { role: string; roleId: string | null; names: string[] } | null;
  berths: number | null;
  picked: number;
  berthsLeft: number | null;
  wanted: number;
}

export interface CrewPayload {
  season: { id: string; name: string | null } | null;
  seasons: Array<{ id: string; name: string | null }>;
  goals: Array<{ text: string; done: boolean }>;
  applied?: number;
  circles: CrewCircle[];
  mine: { id: string; status: "applied" | "picked" | "withdrawn"; wantsCircleId: string | null; pickedCircleId: string | null; pickedCircleName: string | null; words: string | null } | null;
  picksFor: string[];
  pickerRoles?: Array<{ id: string; name: string; circleId: string }>;
  pool: Array<{ id: string; name: string | null; wantsCircleId: string | null; words: string | null; status: string; pickedCircleId: string | null }> | null;
}

export interface PlacesPayload {
  dials: { who: string; freeAfter: number | null; cap: number | null };
  taken?: number;
  waiting?: number;
  places: Array<{ id: string; subjectId: string; name: string; status: string; mine: boolean }>;
  mine: Array<{ subjectId: string; name: string; place: { id: string; status: string } | null }>;
}

export interface GatheringRow {
  eventId: string;
  title: string;
  startsAt: string;
  circleCap: number | null;
  going: number;
  waiting: number;
  mine: Array<{ circleId: string; name: string; status: "going" | "waiting"; position: number | null }>;
}

/** "Role (Ada, Bo)": the role first, holders' first names in parentheses, at most three then "+N" (III.2). */
export function roleWithHolders(role: string, names: readonly string[]): string {
  if (names.length === 0) return role;
  const shown = names.slice(0, 3).join(", ");
  return `${role} (${shown}${names.length > 3 ? ` +${names.length - 3}` : ""})`;
}

export const ordinal = (n: number) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${s}`;
};

export const SEASON_WORDS = {
  loading: "Reading the season",
  membersOnly: "Members see who takes part each season.",
  noSeason: "There is no season open yet. The village's seasons are dated in Admin, Season.",
  circlesTakingPart: "Circles taking part",
  of: (n: number, cap: number | null) => (cap === null ? `${n}` : `${n} of ${cap}`),
  picked: "Picked",
  pickedStamp: "In this season",
  youreIn: "You're in this season!",
  pickedLine: (who: string, circle: string) => `${who} picked you for ${circle}.`,
  yourApplication: "Your application",
  anyCircle: "Any circle",
  anyCircleLine: "Whoever picks for any circle can pick you.",
  circleLine: (c: CrewCircle) =>
    [c.pickedBy ? `${roleWithHolders(c.pickedBy.role, c.pickedBy.names)} picks` : "Its role holders pick", c.berths === null ? null : `${c.berths} spots`, `${c.wanted} applied`]
      .filter(Boolean)
      .join(" · "),
  wordsLabel: "What you bring this season (optional)",
  apply: "Apply for this season",
  update: "Update my application",
  withdraw: "Withdraw",
  stepApplied: "Applied",
  stepAppliedLine: "sent",
  stepPicks: "The picker picks",
  stepPicksLine: "from everyone who applied",
  stepIn: "You're in",
  stepInLine: "this season",
  fresh: "Every season starts fresh. Next season, apply again and that season's pickers choose again.",
  youPick: (circle: string) => `You pick for ${circle}`,
  spots: "Spots this season (blank for no limit)",
  saveSpots: "Save",
  pick: "Pick",
  release: "Release",
  pickedElsewhere: "Picked",
  noApplicants: "Nobody has applied yet.",
  gatherings: "Gatherings",
  rigsAt: (going: number, cap: number | null) => (cap === null ? `${going} circles` : going >= cap ? `Full · ${going} of ${cap} circles` : `${going} of ${cap} circles`),
  isGoing: (circle: string) => `${circle} is going`,
  waitlistLine: (circle: string) => `on the waitlist for ${circle}. When a place opens, the waitlist is asked in order.`,
  signUp: (circle: string) => `Sign ${circle} up`,
  takeOut: (circle: string) => `Take ${circle} out`,
  capsNote: (cap: number | null) =>
    cap === null
      ? "Each gathering sets how many circles it can hold."
      : `Each gathering sets how many circles it can hold. When ${cap} circles take part, new circles join the season's waitlist.`,
  seeCircles: "See every circle this season",
  thisSeason: "This season",
  goalsEmpty: "The season's goals are set in Admin, Season.",
  done: "done",
  underway: "underway",
  takingPart: "taking part",
  teamOf: (n: number) => `team of ${n}`,
  bringYours: "Bring your own circle",
  bringYoursLine: "A circle proposes to take part, one season at a time.",
  propose: (circle: string) => `Propose ${circle}`,
  nextSeason: "Next season's teams",
  nextSeasonLine: "Every season starts fresh. Apply, and each circle's picker chooses that season's team from everyone who applied.",
  applyCta: "Apply for the season",
  pathTitle: (role: string) => `${role}'s path`,
  pathLine: "What it asks first.",
  failed: "That did not go through. Try again.",
} as const;

export const PATH_WORDS = {
  loading: "Reading the path",
  notFound: "There is no role by that id.",
  eyebrow: "The path to a role",
  title: (role: string) => `The ${role}'s path`,
  wayThere: "Your way there",
  apply: (role: string) => `Apply to hold ${role}`,
  applyLine: "after the rest",
  done: "done",
  holdsItNow: "Holds it now",
  nobodyHolds: "Nobody holds it right now.",
  steps: "The steps",
  fee: (amount: string) => amount,
  pay: (name: string) => `Pay for ${name}`,
  paid: "Paid",
  nothingAsked: "This role asks for nothing first. Apply when you're ready.",
  seeCircles: "See every circle this season",
  applyNow: "Apply now",
} as const;

export const usd = (minor: number) => `$${(minor / 100).toFixed(minor % 100 === 0 ? 0 : 2)}`;
