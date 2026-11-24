/**
 * LISTING: which roles a visitor or a member may discover (role journey PR-A,
 * Rye 9 Nov 2026: only confirmed roles are listed).
 *
 * `listed` is a nullable column. NULL reads as listed, so a village that has
 * never touched it changes nothing on deploy. Only an explicit 0 hides a role.
 * An unlisted role still exists: its holders keep it, history keeps it, and a
 * steward or admin sees it with a "Not listed" chip. It is absent from every
 * discovery surface: /api/org, /api/map, the open form, the draft board,
 * Circles, "Roles that fit", the map card and /roles.
 *
 * Pure: shared by the server projection and every client surface.
 */

export const LISTING_WORDS = {
  chip: "Not listed",
  chipHint: "Only holders, stewards and admins can see this role. It is left out of every list a visitor or member browses.",
  startUnlistedLabel: "Roles accepted from a sync start unlisted",
  startUnlistedHelp:
    "On, a role that arrives from a sync and is accepted starts unlisted, and a steward lists it once its card is ready. Off, accepted roles are listed at once.",
  listOnly: "List only these",
  listOnlyHelp: "Lists the roles you tick and unlists every other role. The roles listed before are kept, so you can put them back.",
  undo: "Put the earlier listing back",
} as const;

/** NULL and absent read as listed. Only an explicit false hides a role. */
export function isListed(role: { listed?: boolean | null } | null | undefined): boolean {
  return role?.listed !== false;
}

/**
 * A ROLE'S STATES (Rye, 16 Nov 2026, and the Operations Steward's fifth):
 *
 *   Open            listed, taking applications now. Today only the lead roles.
 *   Coming soon     shown under the steward who leads its circle ("Roles this
 *                   steward will build") and applied for early, through the same
 *                   one-role flow, with the note below on the card, the form and
 *                   the confirmation.
 *   Future venture  shown in its own "Future ventures" section, with no lead, and
 *                   applied for with a pitch (the prompts below).
 *   Held            someone holds it: shown as held, with no Apply. Derived from
 *                   the seatings, never stored. A role only an agent holds says so
 *                   by the agent's name; a person is named only as the village's
 *                   people setting allows (seatProjection.ts).
 *   Unlisted        hidden from the public, kept in the admin view.
 *
 * Coming soon and Future venture are columns beside `listed`, and either is
 * shown even while unlisted: a short card cannot pass the listing gate until its
 * lead is in place, and being seen is the point. Clearing the mark puts the role
 * back to what `listed` says.
 */
export type RoleVisibility = "open" | "comingSoon" | "futureVenture" | "unlisted";

export const COMING_SOON_WORDS = {
  badge: "Coming soon",
  note: "This role is not open yet, and the card may change before it opens. Leave your details and we will write to you when it does.",
  leadBuilds: "Roles this steward will build",
  ventureBadge: "Future venture",
  ventures: "Future ventures",
  ventureNote:
    "Apply to hold this venture: to build it and run it, in partnership with the village. Tell us your vision as a pitch. Terms such as space, partnership and revenue share are shaped together and are subject to legal review.",
  pitch: [
    "Your concept and offering",
    "How it serves the village, the land and the wider community",
    "Your experience building and running something like it",
    "How it would operate, and what you bring: skills, team, capital",
    "A first financial picture",
  ],
} as const;

/** The state a role's columns read as, for the editor's one choice. Held is derived from the seatings and is not here. */
export function visibilityOf(role: { listed?: boolean | null; comingSoon?: boolean | null; futureVenture?: boolean | null }): RoleVisibility {
  if (role.futureVenture === true) return "futureVenture";
  if (role.comingSoon === true) return "comingSoon";
  return isListed(role) ? "open" : "unlisted";
}

/** The columns one choice writes. Coming soon and Future venture leave `listed` as it is, so clearing them returns the role to it. */
export function columnsOfVisibility(v: RoleVisibility): { listed?: boolean; comingSoon: boolean; futureVenture: boolean } {
  if (v === "comingSoon") return { comingSoon: true, futureVenture: false };
  if (v === "futureVenture") return { comingSoon: false, futureVenture: true };
  return { listed: v === "open", comingSoon: false, futureVenture: false };
}

/**
 * THE ROLES A STEWARD WILL BUILD: the live coming-soon roles in the circles
 * whose lead is this role (`circles.lead_role_id`), in the chart's order. A
 * future venture has no lead and is never here. The circle says who leads it, so
 * a role moved to another circle moves to that circle's lead with nothing else to set.
 */
export function rolesLeadWillBuild<R extends { id: string; circleId?: string | null; comingSoon?: boolean | null; futureVenture?: boolean | null; active?: boolean; isExample?: boolean }>(
  leadRoleId: string,
  roles: readonly R[],
  circles: ReadonlyArray<{ id: string; leadRoleId?: string | null }>,
): R[] {
  const led = new Set(circles.filter((c) => c.leadRoleId && c.leadRoleId === leadRoleId).map((c) => c.id));
  return roles.filter((r) => r.id !== leadRoleId && !!r.circleId && led.has(r.circleId) && r.comingSoon === true && r.futureVenture !== true && r.active !== false && r.isExample !== true);
}

export function isComingSoon(role: { comingSoon?: boolean | null } | null | undefined): boolean {
  return role?.comingSoon === true;
}

/**
 * WHERE A COMING-SOON ROLE'S WAITLIST IS: its card on the roles page, which opens the waitlist form for this anchor
 * (lane D). A coming-soon role takes no application (the lead, 19 Nov 2026): every door to one leads here.
 */
export function waitlistHref(roleId: string): string {
  return `/roles#waitlist-${encodeURIComponent(roleId)}`;
}

export function isFutureVenture(role: { futureVenture?: boolean | null } | null | undefined): boolean {
  return role?.futureVenture === true;
}

/**
 * A VENTURE OPEN NOW (the lead, 23 Nov 2026): a future venture whose door is open. It reuses `recruiting`, the
 * door every role card already carries and the role_card proposal already writes, so no column is added. The
 * roles page draws it first with "Open now, high priority"; every other venture reads "Accepting proposals". A venture is still applied
 * for with a pitch, never a raised hand, whatever its door says.
 */
export function ventureOpenNow(role: { futureVenture?: boolean | null; recruiting?: boolean | null } | null | undefined): boolean {
  return role?.futureVenture === true && role?.recruiting === true;
}

/** Whether a role is on the discovery surfaces: listed, or marked coming soon or a future venture. */
export function isShown(role: { listed?: boolean | null; comingSoon?: boolean | null; futureVenture?: boolean | null } | null | undefined): boolean {
  return isListed(role) || isComingSoon(role) || isFutureVenture(role);
}

/**
 * Whether a role is left in a list for one reader.
 * Stewards and admins see every role. A holder sees their own roles.
 * Everyone else sees listed roles only.
 */
export function visibleTo(
  role: { id: string; listed?: boolean | null; comingSoon?: boolean | null; futureVenture?: boolean | null },
  viewer: { seesUnlisted: boolean; ownRoleIds?: ReadonlySet<string> | readonly string[] },
): boolean {
  if (isShown(role) || viewer.seesUnlisted) return true;
  const own = viewer.ownRoleIds;
  if (!own) return false;
  return Array.isArray(own) ? own.includes(role.id) : (own as ReadonlySet<string>).has(role.id);
}

/**
 * A circle with no listed role is left off the public circles list.
 * A circle that holds no role at all is not a circle awaiting confirmation, so
 * it stays: only a circle whose roles are all unlisted goes.
 */
export function circleHasListedRole(
  circleId: string,
  roles: ReadonlyArray<{ circleId?: string | null; listed?: boolean | null; comingSoon?: boolean | null; futureVenture?: boolean | null; active?: boolean }>,
): boolean {
  let any = false;
  for (const r of roles) {
    if (r.circleId !== circleId || r.active === false) continue;
    any = true;
    if (isShown(r)) return true;
  }
  return !any;
}

/** A circle with at least one live, listed role. */
function circleListsARole(
  circleId: string,
  roles: ReadonlyArray<{ circleId?: string | null; listed?: boolean | null; comingSoon?: boolean | null; futureVenture?: boolean | null; active?: boolean }>,
): boolean {
  return roles.some((r) => r.circleId === circleId && r.active !== false && isShown(r));
}

/**
 * A role "invites" applications: a free place not forming, a declared open state, or recruiting.
 * A coming-soon role takes applications, but is not Open, so its card shows no pay range (Rye, 16 Nov 2026:
 * no pay ranges until the budget decisions are made).
 */
const OPEN_STATES = new Set(["open", "partial", "expired"]);
export function invitesApplications(r: { seats: number; held: number; state: string; recruiting: boolean; comingSoon?: boolean | null; futureVenture?: boolean | null }): boolean {
  if (r.comingSoon === true || r.futureVenture === true) return false;
  const openPlaces = Math.max(0, r.seats - r.held);
  return (openPlaces > 0 && r.state !== "forming") || OPEN_STATES.has(r.state) || r.recruiting === true;
}

/**
 * A HELD ROLE WITH ITS DOOR OPEN (the lead, 17 Nov 2026): every place taken, and the role still
 * recruiting. It stays where held roles sit and keeps its Apply, because the village wants more
 * people in it. A role that is not filled already offers Apply by its state.
 */
export function heldButRecruiting(r: { state?: unknown; recruiting?: unknown } | null | undefined): boolean {
  return !!r && r.state === "filled" && r.recruiting === true;
}

export interface ListingBefore {
  id: string;
  /** What the role read as before: true listed (or never set), false unlisted. */
  listed: boolean;
}

export interface ListOnlyPlan {
  /** Ids to write as listed. */
  list: string[];
  /** Ids to write as unlisted. */
  unlist: string[];
  /** What each role read as before, for putting it back. */
  before: ListingBefore[];
}

/** "List only these": the named roles listed, every other role unlisted, with the earlier state kept. */
export function planListOnly(
  roles: ReadonlyArray<{ id: string; listed?: boolean | null }>,
  keep: readonly string[],
): ListOnlyPlan {
  const keepSet = new Set(keep);
  const list: string[] = [];
  const unlist: string[] = [];
  const before: ListingBefore[] = [];
  for (const r of roles) {
    before.push({ id: r.id, listed: isListed(r) });
    (keepSet.has(r.id) ? list : unlist).push(r.id);
  }
  return { list, unlist, before };
}

/** The stored record of one "List only these" run. */
export interface ListingRecord {
  at: string;
  kept: string[];
  before: ListingBefore[];
  /** Set when this run was put back. */
  undoneAt?: string | null;
}

/** What one reader may see of unlisted roles. */
export interface ListingViewer {
  seesUnlisted: boolean;
  ownRoleIds?: ReadonlySet<string>;
}

/** The roles a person holds now, by role id. */
export function ownRoleIdsOf(
  assignments: ReadonlyArray<{ orgRoleId: string; userId?: string | null; endedAt?: unknown }>,
  userId: string | null | undefined,
): Set<string> {
  const out = new Set<string>();
  if (!userId) return out;
  for (const a of assignments) if (a.userId === userId && !a.endedAt) out.add(a.orgRoleId);
  return out;
}

/**
 * The circles a reader sees. A circle stays when it has a listed role, when it
 * has no role at all, or when a circle beneath it stays (so the tree keeps its
 * parents). A viewer who sees unlisted roles sees every circle.
 */
export function circlesToShow<C extends { id: string; parentCircleId?: string | null }>(
  circles: readonly C[],
  roles: ReadonlyArray<{ circleId?: string | null; listed?: boolean | null; comingSoon?: boolean | null; futureVenture?: boolean | null; active?: boolean }>,
  viewer: ListingViewer,
): C[] {
  if (viewer.seesUnlisted) return [...circles];
  // A CURATING VILLAGE shows only what it listed (phase A, verify 2.2). Once any live role is
  // unlisted, the village has said what a visitor may find, and a circle holding no listed role
  // goes too, an empty or projected one included. Before, "List only these" hid every role but
  // left eleven projected circles on /api/org and the map, which read as the projected roles
  // still being public. A village that has never unlisted a role keeps its empty circles.
  // Curating reads the `listed` column itself: a village that unlisted roles and marked some coming soon is still
  // curating, so its empty circles stay hidden while the circles of its coming-soon roles show.
  const curating = roles.some((r) => r.active !== false && !isListed(r));
  const keep = new Set<string>();
  for (const c of circles) if (curating ? circleListsARole(c.id, roles) : circleHasListedRole(c.id, roles)) keep.add(c.id);
  const byId = new Map(circles.map((c) => [c.id, c]));
  for (const id of Array.from(keep)) {
    let up = byId.get(id)?.parentCircleId ?? null;
    const seen = new Set<string>();
    while (up && !seen.has(up)) {
      seen.add(up);
      keep.add(up);
      up = byId.get(up)?.parentCircleId ?? null;
    }
  }
  return circles.filter((c) => keep.has(c.id));
}

export const LISTING_RECORDS_MAX = 20;

/** Keeps the newest records only. */
export function pushRecord(records: readonly ListingRecord[], next: ListingRecord): ListingRecord[] {
  return [...records, next].slice(-LISTING_RECORDS_MAX);
}
