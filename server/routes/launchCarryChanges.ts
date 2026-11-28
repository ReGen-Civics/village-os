/**
 * `GET /api/admin/launch/carry-changes`: what changes when the launch vote
 * carries, and who it reaches. READ-ONLY.
 *
 * The list and its words are `launchCarryChanges` (server/lib/
 * launchCarryChanges.ts), which is pure. This file is the reading: every fact
 * that function is handed comes from the same function the door itself asks,
 * so the list cannot describe a door differently from how it behaves.
 *
 *   which vote this is      `ratifyStanding`, `readGameStart`, `launchedAtOf`
 *   who is on the roll      `launchRoll` (the route's own, from server/index.ts)
 *   who holds each power    `liveHoldersOf`, the gate's own reader
 *   who the vote named      `slateFor`, on the open launch ballot if there is one
 *   what crosses            `selectionForLaunch`
 *   the season              `seasonTurnAtLaunch`, then `resolveSeatTerm` on the
 *                           calendar as the carry would leave it
 *   token.mint              `villageHeldCapabilities` and the two roles' holders
 *   budget sources          `budgetSourceRows`
 *
 * It writes nothing, takes no lock and opens no ballot. `?lang=es` answers in
 * Spanish; anything else in English.
 *
 * WHO MAY READ IT: whoever `isAdmin` lets read the launch page, which is the
 * same door `GET /api/admin/launch` uses.
 */
import type { Express } from "express";
import type { AppDeps } from "../lib/appDeps";
import { ADMIN_BEFORE_LAUNCH, ADMIN_NO_STEWARD } from "../../shared/budgets";
import { LAUNCH_SUBJECT_REF, VILLAGE_LAUNCH, type LaunchRollKind } from "../../shared/ballotSubjects";
import { resolveSeatTerm } from "../../shared/seatTerms";
import { openBallotFor } from "../lib/ballots";
import { villageHeldCapabilities } from "../lib/capabilityHolding";
import { isExampleUser } from "../lib/examples";
import { readGameStart } from "../lib/gameStart";
import { adminGroupsOf } from "../lib/groupAdmin";
import { launchedAtOf } from "../lib/launch";
import {
  carryLangFrom,
  launchCarryChanges,
  testAccountReason,
  type AdminAccount,
  type CarryFacts,
  type CarryKind,
  type Person,
} from "../lib/launchCarryChanges";
import { powerInPlainWords, selectionForLaunch } from "../lib/launchHandover";
import { ratifyStanding } from "../lib/launchRatify";
import type { LaunchRoll } from "../lib/launchRoll";
import { seasonTurnAtLaunch, type TurnSeason } from "../lib/launchSeasonTurn";
import { QA_VIEWERS_GROUP_ID } from "../lib/starterRoles";
import { holdingHasLapsed, STEWARD_VETO } from "../lib/stewardship";
import { TOKEN_MINT_ROLE_IDS, TOKEN_MINT_TREASURY_ROLE_ID } from "../lib/tokenMintHandover";
import { stringVar } from "../lib/variables";
import { FIRST_MOON_KEY } from "../lib/villageMoon";
import { budgetSourceRows } from "../repos/budgets";
import { slateFor } from "../repos/stewardSlate";

type Deps = Pick<AppDeps, "isAdmin" | "getPool"> & {
  members: { all(): Promise<any[]> };
  /** The launch roll as it stands now, and the village's rule for it. */
  launchRoll(): Promise<LaunchRoll>;
  launchRule(): { roll: LaunchRollKind; yesNeeded: number };
  liveHoldersOf(capability: string): Promise<string[]>;
  loadRoles(): any[];
  loadPowerHoldings(): any[];
  /** Whether an account can sign in today (`isPresentMember`). */
  isPresent(member: any): boolean;
  /** The season list, today's civil date and the zone, as `seasonState` reads them. */
  seasons(): TurnSeason[];
  today(): string;
  timezone(): string;
  currency(): string | null;
};

const nameOfRecord = (u: any): string => String(u?.name ?? "").trim() || String(u?.id ?? "");

/** Every fact the list is built from. Reads only. */
export async function carryFacts(deps: Deps, now: Date = new Date()): Promise<CarryFacts> {
  const pool = deps.getPool();
  const [gameStart, ratify, launchedAt, everyone, roll, open] = await Promise.all([
    readGameStart(pool),
    ratifyStanding(pool),
    launchedAtOf(pool),
    deps.members.all(),
    deps.launchRoll(),
    openBallotFor(pool, VILLAGE_LAUNCH, LAUNCH_SUBJECT_REF),
  ]);
  const rule = deps.launchRule();
  const byId = new Map(everyone.map((u) => [String(u.id), u]));
  const nameOf = (id: string) => (byId.has(id) ? nameOfRecord(byId.get(id)) : id);
  const person = (id: string): Person => ({ id, name: nameOf(id) });

  // A started village that may still hold its vote is ratifying. One that may not has carried.
  const kind: CarryKind = ratify.mayRatify ? "ratifying" : gameStart.started ? "carried" : "first";

  const roles = deps.loadRoles();
  const holdings = deps.loadPowerHoldings();
  const live = holdings.filter((h) => !holdingHasLapsed(h as any, now));
  const admins: AdminAccount[] = [];
  for (const u of everyone) {
    if (isExampleUser(u)) continue;
    const id = String(u.id);
    const viaRole = u.role === "admin" || u.role === "founder";
    const groups = adminGroupsOf(id, roles as any, holdings as any, now, holdingHasLapsed as any).map((g: any) => String(g.name ?? g.id));
    if (!viaRole && groups.length === 0) continue;
    admins.push({ id, name: nameOfRecord(u), role: String(u.role ?? ""), viaRole, groups, present: deps.isPresent(u) });
  }
  admins.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

  const [pay, moduleSwitch, orgDecide, tokenMint, steward, held, selection] = await Promise.all([
    deps.liveHoldersOf("role.pay"),
    deps.liveHoldersOf("module.switch"),
    deps.liveHoldersOf("org.decide"),
    deps.liveHoldersOf("token.mint"),
    deps.liveHoldersOf(STEWARD_VETO),
    villageHeldCapabilities(pool),
    selectionForLaunch(pool, open?.id ?? null),
  ]);

  const inQaGroup = new Set(live.filter((h) => h.roleId === QA_VIEWERS_GROUP_ID).map((h) => String(h.userId)));
  const testFounders = everyone
    .filter((u) => u.role === "founder")
    .map((u) => ({ u, why: testAccountReason({ name: u.name, email: u.email, isExample: u.isExample, isAgent: u.isAgent, inQaGroup: inQaGroup.has(String(u.id)) }) }))
    .filter((x) => x.why !== null)
    .map((x) => ({ id: String(x.u.id), name: nameOfRecord(x.u), why: x.why! }));

  let slate: CarryFacts["slate"] = null;
  if (open) {
    const rows = await slateFor(pool, open.id);
    slate = {
      named: rows.map((r) => person(r.userId)),
      accepted: rows.filter((r) => r.accepted).map((r) => r.userId),
      declined: rows.filter((r) => r.declinedAt !== null).map((r) => r.userId),
    };
  }

  // The season as the carry would leave it, and the term a steward seated then would get.
  const seasons = deps.seasons();
  const season = seasonTurnAtLaunch(seasons, deps.today());
  const term = resolveSeatTerm({
    calendar: {
      seasons: (season.turned ? season.seasons : seasons) as any[],
      currentSeasonId: season.turned ? season.to.id : season.running?.id ?? null,
      timezone: deps.timezone(),
    },
    capAtSeasonEnd: true,
    now,
  });

  // token.mint crosses to the steward role and the Treasury role, when either has somebody in it.
  const mintRoles = TOKEN_MINT_ROLE_IDS.filter((id) => roles.some((r) => r.id === id && r.isExample !== true));
  const inMintRoles = live.filter((h) => mintRoles.includes(String(h.roleId)));
  const treasury = Array.from(new Set(inMintRoles.filter((h) => h.roleId === TOKEN_MINT_TREASURY_ROLE_ID).map((h) => String(h.userId)))).map(person);

  // A budget source that is on because an admin switched it on. A read that fails says nothing, and never fails the list.
  const adminSources = await budgetSourceRows(pool)
    .then((rows) => rows.filter((r) => Number(r.on) === 1 && (r.set_as === ADMIN_BEFORE_LAUNCH || r.set_as === ADMIN_NO_STEWARD)).map((r) => String(r.source)))
    .catch(() => [] as string[]);

  return {
    kind,
    issuingSince: gameStart.started ? gameStart.startedAt ?? null : null,
    launchedAt,
    admins,
    holders: { pay, moduleSwitch, orgDecide, tokenMint, steward },
    roll: {
      kind: rule.roll,
      yesNeeded: rule.yesNeeded,
      onIt: roll.founders.map((f) => person(f.id)),
      notOnIt: roll.notOnTheRoll.map((f) => ({ ...person(f.id), reason: f.reason })),
    },
    testFounders,
    slate,
    handover: selection.map((c) => powerInPlainWords(c).title),
    season,
    stewardTerm: term.ok ? { endsOn: term.endsOn, problem: null } : { endsOn: null, problem: term.error },
    tokenMint: { alreadyHeld: held.includes("token.mint"), rolesWithSomebody: inMintRoles.length > 0, treasury },
    adminSources,
    currency: deps.currency(),
    moonSetByHand: stringVar(FIRST_MOON_KEY).trim() !== "",
    nameOf,
  };
}

export function register(app: Express, deps: Deps): void {
  app.get("/api/admin/launch/carry-changes", async (req, res) => {
    if (!(await deps.isAdmin(req))) return res.status(401).json({ error: "auth_required" });
    res.json(launchCarryChanges(await carryFacts(deps), carryLangFrom(req.query.lang)));
  });
}
