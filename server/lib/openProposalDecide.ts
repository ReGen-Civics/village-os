/**
 * OPEN ROLE PROPOSALS, THE DECISION (part B): the work, with no request in it.
 * The words and shapes are shared/openProposalDecide.ts; the doors are
 * server/routes/openProposalDecide.ts and, for the confirm step, part A's
 * server/routes/openProposals.ts.
 *
 *   confirmAndAsk          the address confirms, and in the same transaction
 *                          the circle is asked (`role_proposal_asks`, whose
 *                          `proposal_id` carries no key, so an `op-` id fits)
 *   tellTheCircle          the asked holders, and the holders of the power
 *                          that seats people, each hear it once
 *   decideRule             who may adopt or decline at the door today
 *   placeOnRoles           an adoption's place for one account: the roles, as
 *                          an application adopted for the target season, and
 *                          the Member stage
 *   arrivalFor             what a sign-up through an adopted proposal's
 *                          invitation does (server/lib/inviteDoor.ts)
 *   openProposalsWaitingOn the task board's rows
 *
 * ── NOTHING UNCONFIRMED REACHES A PERSON ────────────────────────────────────
 *
 * Every ask and every notice here goes out from the confirm step and never from
 * the submit (master coordinator, 2026-10-31). A proposal still unconfirmed is
 * on no list and its page answers 404.
 *
 * ── THE ROLES, THE WAY A MEMBER'S ADOPTED PROPOSAL GETS THEM ────────────────
 *
 * An adoption writes an ordinary seat application through the member door's
 * own writer (server/lib/seatApplicationWrite.ts): the proposed roles, the
 * proposal's words as the note and the season aim, no terms, its first day the
 * target season's first day. The adopting holder then adopts it through
 * `adoptApplication`, as their click on a member's application does, so it
 * reads `adopted` and the hourly `season-plan-turn` job seats it on that day
 * through the same locked count (server/lib/seasonTurn.ts). Nobody aligns with
 * the terms' words on the person's behalf: they have not read them.
 *
 * ── THE MEMBER STAGE (coordinator's call 2) ─────────────────────────────────
 *
 * Granted through the admin roster's one path (server/lib/stageGrant.ts), as a
 * raise only: a floor already above Member stays where it is. Adoption needs no
 * vouch; the invitation's own arrival vouch is recorded as any invitation's is.
 *
 * No `recordEvent` and no `addActivity`: the rows are the record.
 */
import { adoptedShape } from "../../shared/proposalSplit";
import { cardSummary } from "../../shared/openProposalCard";
import { stampApplication } from "../repos/proposalStamps";
import { summaryWithin } from "../../shared/applyLimits";
import { roleTermsOf, termsPerRole, type RoleTerms } from "../../shared/openProposals";
import type { PayAsk } from "../../shared/commitmentRange";
import { currentRoleValue, rolePriceCountered } from "../../shared/roleCounterOffer";
import type { ProposalSplit } from "../../shared/proposalSplitStored";
import { isCommitment, notesAsText, overallChoice } from "../../shared/termsWords";
import { baseOf } from "./counterOffer";
import { contractPriceWith, payGroupOf, type ContractPrice } from "../../shared/contractPrice";
import { sectionsForMany } from "./roleCardSections";
import { cardPay, villagePayFrom } from "../../shared/roleCardSections";
import { stringVar } from "./variables";
import type { Pool, PoolConnection } from "mysql2/promise";
import { isVillageHeld, type Capability } from "../../shared/capabilities";
import { civilDateKey } from "../../shared/lunar";
import { agreedTerms, greetingName, OPEN_NOTICE_WORDS, openInviteId, openProposalHref, proposalOfInvite } from "../../shared/openProposalDecide";
import { whoMayPutHandToVillage, type HandOpenerRule } from "../../shared/powerHands";
import { CONSENT_WORDS, consentClosesAt } from "../../shared/roleProposalConsent";
import { ADOPTING_POWER, parseApplicationInput } from "../../shared/seatApplications";
import type { ProposalGoal } from "../../shared/proposalGoals";
import { civilDateInstant, type SeatCalendar } from "../../shared/seatTerms";
import { emailKeyOf } from "../../shared/comms/address";
import type { WaitingOpenProposal } from "../../shared/waitingOnYou";
import type { AppDeps } from "./appDeps";
import { settleText } from "./alignmentSubjects";
import { villageHeldCapabilities } from "./capabilityHolding";
import { leftTheVillage } from "./formerMember";
import type { InviteDescriber, InvitedArrival } from "./inviteDoor";
import type { NotifyInput } from "./notify";
import { trustedAccountFor } from "./applicantAccount";
import { listOrgRoles, type LapseContext } from "./orgChart";
import { adoptApplication, seatsWithoutRoom, settleDepsOf, tellOutcome, wholeSecond, type FullSeat } from "./seatApplicationCloser";
import { prepareApplication, writeApplicationOn } from "./seatApplicationWrite";
import { inTransaction } from "../repos/liveSessions";
import { inviteById, revokeInvite } from "../repos/memberInvites";
import * as store from "../repos/openProposals";
import { asksFor, holdersInCircles, insertAsks } from "../repos/roleProposals";
import { inApplicationTransaction, seatsForUpdate, seatsWithCircles, setTogether } from "../repos/seatApplications";
import { carryUpdatesToAccount } from "./applicantUpdates";
import { announceReview, beginReview, reviewFirstOn, type ReviewDeps, type ReviewStart } from "./applicationReview";
import { agentRoleNamesInCircles, stampStep } from "../repos/applicationReview";
import * as review from "../repos/applicationReview";
import { REVIEW_WORDS } from "../../shared/applicationReview";

type Db = Pool | PoolConnection;

export interface DecideDeps extends Pick<AppDeps, "members" | "stageOf" | "recordStageEvent"> {
  getPool(): Pool;
  notify(input: NotifyInput): Promise<unknown>;
  notifyAdmins(type: string, title: string, dedupeKey: string, link?: string): Promise<unknown>;
  /** Who holds a power live, counted the way the gate counts. `liveHoldersOf` in server/index.ts. */
  liveHoldersOf(capability: string): Promise<string[]>;
  calendar(): SeatCalendar;
  lapse(): LapseContext;
  now(): Date;
  /** The village's name, for the updates an arrival carries onto the new profile. Absent skips them. */
  projectName?(): string;
}

/**
 * The address's account and the proposal's own account: one rule, kept in
 * server/lib/applicantAccount.ts (audit, 15 Nov 2026: an account counts as the
 * address's only once it proved the address). Re-exported for the routes.
 */
export { ownAccountOf } from "./applicantAccount";

/**
 * WHO MAY ADOPT OR DECLINE AT THE DOOR TODAY (Rye, 2026-10-31, sheet 24a): the
 * raised-hand rule over `org.seat`, read the way the member door reads it. A
 * role holds it and somebody sits in it live: those holders. The village holds
 * it, or nobody holds it live: nobody, at the door (`adoptRefusal`).
 */
export async function decideRule(deps: Pick<DecideDeps, "getPool" | "liveHoldersOf">): Promise<HandOpenerRule> {
  const held = await villageHeldCapabilities(deps.getPool());
  return whoMayPutHandToVillage(isVillageHeld(ADOPTING_POWER as Capability, held), await deps.liveHoldersOf(ADOPTING_POWER));
}

/** The proposal's roles by id, with their names and circles, as they read now. */
async function rolesNamed(db: Db, roleIds: readonly string[]) {
  const rows = await seatsWithCircles(db, roleIds);
  return new Map(rows.map((r) => [r.id, r]));
}

/** "Gate Keeper", "Well Keeper": a role gone since reads as its id, so a notice is never blank. */
async function roleNames(db: Db, p: store.StoredOpenProposal): Promise<string[]> {
  const named = await rolesNamed(db, p.body.roles.map((r) => r.roleId));
  return p.body.roles.map((r) => named.get(r.roleId)?.name ?? r.roleId);
}

// ── Confirming asks the circle ──────────────────────────────────────────────

export interface Confirmed {
  proposal: store.StoredOpenProposal;
  asked: Array<{ userId: string; circleId: string }>;
  closesAt: Date;
  /** The proposer's own account here, if their address has one. Never asked, never told. */
  own: string | null;
  /** The review begun at confirm: the role's interviewers, in order (role journey L5). */
  review?: ReviewStart;
  /** Roles in the circles held by an AI agent: never asked, and the round says so (D31). */
  skippedAgents?: string[];
}

/**
 * THE ADDRESS CONFIRMS, AND THE CIRCLE IS ASKED, in one transaction, so a
 * proposal is never confirmed half asked. Asked: every live holder of a role in
 * the circles the proposed roles sit in, in the order the proposal names them,
 * once each, the proposer's own account excluded. Their 2 business days run
 * from now. Null when the token confirms nothing: used, run out, or unknown.
 *
 * `addressUnconfirmed`: the intake confirms it itself because the confirmation
 * email did not go (Rye, 14 Nov 2026), and the proposal carries the note that
 * says so (server/repos/openProposals.ts, `AddressUnconfirmed`).
 */
export async function confirmAndAsk(
  deps: Pick<DecideDeps, "getPool" | "members" | "calendar"> & Pick<ReviewDeps, "consentAfterInterviews" | "reviewFirst">,
  confirmHash: string,
  notBefore: Date,
  at: Date,
  opts: { addressUnconfirmed?: boolean } = {},
): Promise<Confirmed | null> {
  const pool = deps.getPool();
  const circleOf = new Map((await listOrgRoles(pool)).map((r) => [r.id, r.circleId]));
  const closesAt = consentClosesAt(at, deps.calendar().timezone || "UTC");
  return inTransaction(pool, async (conn) => {
    const proposal = await store.confirmOpenProposal(conn, confirmHash, notBefore, at, opts);
    if (!proposal) return null;
    // Trusted only: an address not yet confirmed links to no account here (server/lib/applicantAccount.ts).
    const own = await trustedAccountFor(deps.members, proposal, conn);
    const circles: string[] = [];
    for (const r of proposal.body.roles) {
      const c = circleOf.get(r.roleId);
      if (c && !circles.includes(c)) circles.push(c);
    }
    const holders = await holdersInCircles(conn, circles);
    const asked: Array<{ userId: string; circleId: string }> = [];
    for (const circleId of circles) {
      for (const h of holders) {
        if (h.circleId !== circleId || h.userId === own || asked.some((a) => a.userId === h.userId)) continue;
        asked.push({ userId: h.userId, circleId });
      }
    }
    // The review begins in this same transaction, so a proposal is never confirmed with half a review.
    // Our review comes first where the village asks for it (Phase A). An agent's proposal is its keeper's, and is decided as it always was.
    const reviewFirst = !proposal.body.agent && reviewFirstOn(deps);
    const review = await beginReview(conn, deps, { ref: proposal.id, roleIds: proposal.body.roles.map((r) => r.roleId), applicantUserId: own, at, reviewFirst });
    // Where the village asked for it, the circle is asked once the interviews are scored (shared/applicationReview.ts).
    if (!review.holdConsent) {
      await insertAsks(conn, asked.map((a) => ({ proposalId: proposal.id, userId: a.userId, circleId: a.circleId, askedAt: at, closesAt })));
      await stampStep(conn, { ref: proposal.id, kind: "consent", at });
    }
    const skippedAgents = await agentRoleNamesInCircles(conn, circles);
    return { proposal, asked, closesAt, own, review, skippedAgents };
  });
}

/**
 * Each asked holder hears once, by the roles' names, in the bell and under
 * Tasks; each live holder of the power that seats people who was not asked
 * hears it waits on them. The proposer's own account hears nothing. When
 * nobody can adopt it at the door, the admins hear it once instead. Keys are
 * per proposal and person, so a retry writes nothing twice.
 */
export async function tellTheCircle(deps: Pick<DecideDeps, "getPool" | "notify" | "notifyAdmins" | "liveHoldersOf" | "calendar">, c: Confirmed): Promise<void> {
  if (c.review) await announceReview(deps, c.review, greetingName(c.proposal.name));
  const pool = deps.getPool();
  const names = await roleNames(pool, c.proposal);
  const link = openProposalHref(c.proposal.id);
  const closesOn = civilDateKey(new Date(c.closesAt.getTime() - 1), deps.calendar().timezone || "UTC");
  for (const a of c.asked) {
    if (c.review?.holdConsent) {
      // Told it arrived; the ask itself waits for the interviews.
      await deps.notify({
        userId: a.userId,
        type: "application_arrived",
        title: REVIEW_WORDS.arrived(names),
        body: REVIEW_WORDS.consentWaitsForInterviews,
        link,
        actorUserId: null,
        dedupeKey: `op:${c.proposal.id}:arrived:${a.userId}`,
      });
      continue;
    }
    await deps.notify({
      userId: a.userId,
      type: "open_role_proposal_consent_ask",
      title: CONSENT_WORDS.askTitle(names),
      body: `${CONSENT_WORDS.askBody(closesOn)}${c.skippedAgents?.length ? ` ${REVIEW_WORDS.agentsSkipped(c.skippedAgents)}` : ""}`,
      link,
      actorUserId: null,
      dedupeKey: `op:${c.proposal.id}:ask:${a.userId}`,
    });
  }
  const rule = await decideRule(deps);
  // Nobody can adopt it at the door: nobody holds the power live, the village holds it, or its only holder is the proposer.
  const deciders = (rule.who === "live-holders" ? rule.holders : []).filter((h) => h !== c.own);
  if (deciders.length === 0) {
    // The admins hear it, once, so it does not wait unseen. No vote is opened (Rye's sheet, 24d).
    await deps.notifyAdmins("governance", OPEN_NOTICE_WORDS.nobodyToDecideTitle(names), `op:${c.proposal.id}:waiting:admins`, link);
  }
  for (const userId of deciders) {
    if (c.asked.some((a) => a.userId === userId)) continue;
    await deps.notify({
      userId,
      type: "open_role_proposal_waiting",
      title: OPEN_NOTICE_WORDS.waitingTitle(names),
      body: OPEN_NOTICE_WORDS.waitingBody,
      link,
      actorUserId: null,
      dedupeKey: `op:${c.proposal.id}:waiting:${userId}`,
    });
  }
}

// ── The place an adoption makes ─────────────────────────────────────────────

export type Placed =
  /** `applicationIds`: one per role when the proposal named several roles, each with its own terms (the lead, 17 Nov 2026). The first is `applicationId`. */
  | { ok: true; applicationId: string; outcome: string; applicationIds?: string[] }
  | { ok: false; code: "pending"; applicationId: string }
  | { ok: false; code: "cannot"; error: string };

/**
 * THE PLACE, FOR ONE ACCOUNT: the proposed roles as an application for the
 * target season, adopted by the holder who adopted the proposal under the
 * authority they adopted it by, and the Member stage. The roles are checked
 * before anything is written, so a role gone since refuses here and never on
 * the season's first day. An application already waiting for one of the roles
 * is answered `pending`, with its id, and nothing is written.
 */
/**
 * What the role application says the person will deliver: their aim, then
 * their own role card (shared/openProposalCard.ts) in plain words, within the
 * application's 2000 characters.
 */
function deliverablesOf(whole: store.StoredOpenProposal["body"], seats: Array<{ id: string; name?: string }>, agreed?: Agreed | null, only?: readonly string[]): string {
  const aim = String(whole.aim ?? "").trim();
  if (!whole.card) return aim;
  // One agreement of several (the lead, 17 Nov 2026, and 18 Nov: the goals are the proposal's and count for every
  // role): each of its roles with its own picks and every goal for the first moon, and every season goal served.
  const own = whole.card;
  const body = only
    ? {
        ...whole,
        card: {
          ...own,
          roles: only.map((id) => ({ roleId: id, moves: own.roles.find((r) => r.roleId === id)?.moves ?? [], firstMoon: own.roles.find((r) => r.roleId === id)?.firstMoon.length ? (own.roles.find((r) => r.roleId === id)?.firstMoon ?? []) : own.roles.flatMap((r) => r.firstMoon) })),
          serves: own.serves.map((x) => (x.roleId && !only.includes(x.roleId) ? { ...x, roleId: only[0] } : x)),
        },
      }
    : whole;
  if (!body.card) return aim;
  const name = (id: string) => seats.find((s) => s.id === id)?.name ?? id;
  const goal = (id: string) => body.card?.serves.find((s) => s.goalId === id)?.goal || id;
  // The terms line and the commitment from the FINAL answers (audit B2): a "let's talk" settled since reads as agreed.
  const card = agreed && body.card.terms
    ? {
        ...body.card,
        ...(agreed.commitmentPct != null ? { commitmentPct: agreed.commitmentPct } : {}),
        terms: { ...body.card.terms, choice: overallChoice(agreed.answers), note: notesAsText(agreed.answers), answers: agreed.answers },
      }
    : body.card;
  const text = [aim, cardSummary(card, name, goal)].filter(Boolean).join("\n\n");
  return summaryWithin(text);
}

type Agreed = ReturnType<typeof agreedTerms>;

/**
 * WHAT WAS AGREED, FOR ONE PROPOSAL (audit B2): the roles' suggested words, every
 * counter-offer revision, and the applicant's last answer to each. Read from the
 * proposal's own body and the roles' offers.
 */
export async function agreedOf(db: Db, proposal: store.StoredOpenProposal, part?: AgreementPart): Promise<Agreed> {
  const base = await baseOf(db, part?.roleIds ?? proposal.body.roles.map((r) => r.roleId));
  const agreed = agreedTerms({ base: base.words, answers: proposal.body.card?.terms?.answers ?? {}, theirs: part ? part.terms.commitmentPct : (proposal.body.card?.commitmentPct ?? null), co: proposal.body.counterOffer ?? null });
  // The proposal's counter-offer carries the first role's commitment; every other role signs its own, as countered for
  // that role (the lead, 18 Nov 2026, shared/roleCounterOffer.ts).
  if (!part || part.first) return agreed;
  return { ...agreed, commitmentPct: currentRoleValue(proposal.body.counterOffer?.roles ?? null, part.terms.roleId, "commitment", part.terms.commitmentPct) };
}

/**
 * ONE AGREEMENT PER ROLE (the lead, 17 Nov 2026): a proposal naming several roles with a commitment for each becomes
 * one application per role, each with its own commitment, price and split. Any other proposal is one application
 * for all its roles, as it always was (an older one naming several roles with one commitment among them).
 */
export interface AgreementPart {
  roleIds: string[];
  terms: RoleTerms;
  /** The proposal's first role: the counter-offer's commitment and the shared goals ride with it. */
  first: boolean;
}

export function agreementParts(body: store.StoredOpenProposal["body"]): AgreementPart[] {
  const terms = roleTermsOf(body);
  if (termsPerRole(body)) return terms.map((t, i) => ({ roleIds: [t.roleId], terms: t, first: i === 0 }));
  const first = terms[0] ?? { roleId: "", commitmentPct: null, payAsk: null, paySplit: null };
  return [{ roleIds: body.roles.map((r) => r.roleId), terms: first, first: true }];
}

/**
 * The application's settings: the moon's end when it is a moon proposal, the agreed
 * words for each setting, and the agreed commitment under Clocks. These are what the
 * holder aligns with (shared/alignments.ts renders the words).
 */
export function settingsOfAgreed(agreed: Agreed, term: { endsOn: string } | null | undefined, price: ContractPrice | null = null): Record<string, unknown> {
  const words = Object.fromEntries(Object.entries(agreed.words).filter(([, w]) => typeof w === "string" && w.trim()));
  return {
    v: 1,
    ...(term ? { term: { endsOn: term.endsOn } } : {}),
    ...(isCommitment(agreed.commitmentPct) ? { clocks: { commitmentPct: agreed.commitmentPct } } : {}),
    // The contract's price (QA-1115 P0-1): without it End of Moon has nothing to invoice.
    ...(price ? { pay: payGroupOf(price) } : {}),
    ...(Object.keys(words).length ? { words } : {}),
  };
}

/**
 * THE PRICE ADOPTION WRITES (shared/contractPrice.ts): the accepted ask held to the cap, else the suggested
 * price, at the agreed commitment, from the role's own band, shared by the applicant's proposed split when they
 * sent one (shared/proposalSplit.ts `adoptedShape`). One role per application; an older proposal
 * naming several is priced by the first role that lists a band. Null with no band: the contract records no pay.
 */
export async function contractPriceFor(db: Pool, proposal: store.StoredOpenProposal, agreed: Agreed, part?: AgreementPart): Promise<ContractPrice | null> {
  const ids = part?.roleIds ?? proposal.body.roles.map((r) => r.roleId);
  // Each role of several brings its own ask and split (the lead, 17 Nov 2026); otherwise the proposal's. A price the
  // people who seat the role countered is the price agreed (18 Nov 2026): the agreement's role, or the proposal's first.
  const countered = rolePriceCountered(proposal.body.counterOffer?.roles ?? null, part?.terms.roleId ?? ids[0] ?? "");
  return part
    ? contractPriceForRoles(db, ids, agreed.commitmentPct ?? null, part.terms.payAsk, part.terms.paySplit, countered)
    : contractPriceForRoles(db, ids, agreed.commitmentPct ?? null, proposal.body.payAsk ?? null, proposal.body.paySplit ?? null, countered);
}

/** The price for one agreement: the first of its roles that lists a band, at the agreed commitment, with the ask and the split given for it. */
export async function contractPriceForRoles(db: Pool, ids: readonly string[], commitmentPct: number | null, ask: PayAsk | null, split: ProposalSplit | null, countered: number | null = null): Promise<ContractPrice | null> {
  const sections = await sectionsForMany(db, [...ids]);
  const ceiling = ids.map((id) => sections.get(id)?.payCeiling ?? null).find((c) => !!c) ?? null;
  const price = contractPriceWith(ceiling, commitmentPct, ask, countered);
  if (!price) return null;
  // The applicant's proposed split when they sent one that fits the role's shape in force, else the split the card
  // showed them, its own shares, else the village's (the lead, 18 Nov 2026, replacing P1-6's "follows the card").
  const role = ids.find((id) => sections.get(id)?.payCeiling) ?? ids[0];
  const shown = cardPay(sections.get(role) ?? null, villagePayFrom({ shape: stringVar("org.pay_shape"), atRisk: "", note: "" }))?.shape ?? [];
  const shape = adoptedShape(shown, split?.proposed);
  return shape.length ? { ...price, shape } : price;
}

/** The card's goals for the first moon as the application's list holds them. */
function goalsOfCard(body: store.StoredOpenProposal["body"]): ProposalGoal[] {
  const card = body.card;
  if (!card) return [];
  return card.roles.flatMap((r) =>
    r.firstMoon.map((q) => ({
      title: q.quest,
      doneWhen: q.doneWhen,
      moves: q.moves ?? "",
      serves: (q.serves && card.serves.find((s) => s.goalId === q.serves)?.goal) || "",
      date: q.date ?? "",
      roleId: r.roleId,
    })),
  );
}

/** The village's season goals the card picked, in their words, with how the work serves each. A goal whose words were not kept is left out. */
function servesOfCard(body: store.StoredOpenProposal["body"]): Array<{ goal: string; howItHelps: string | null }> {
  const out: Array<{ goal: string; howItHelps: string | null }> = [];
  for (const s of body.card?.serves ?? []) {
    const goal = String(s.goal ?? "").trim();
    if (!goal || out.some((g) => g.goal === goal)) continue;
    out.push({ goal, howItHelps: String(s.how ?? "").trim() || null });
  }
  return out;
}

/**
 * THE CONVERSATIONS STILL TO BE WRITTEN UP, by role (audit M10), the same rule
 * `interviewsAreIn` holds Adopt to: a proposal with no review has none. Each
 * says whether anybody holds its role right now: a conversation whose role
 * nobody holds can never be written up until somebody is seated in it.
 */
export async function conversationsLeft(db: Db, ref: string): Promise<Array<{ roleId: string; role: string; unheld: boolean }>> {
  if (!(await review.stepsOf(db, ref)).some((s) => s.kind === "confirmed")) return [];
  const left = (await review.interviewsOf(db, ref)).filter((i) => i.state !== "scored" && i.state !== "skipped");
  if (!left.length) return [];
  const names = await review.roleNamesById(db, left.map((i) => i.roleId));
  const out: Array<{ roleId: string; role: string; unheld: boolean }> = [];
  for (const i of left) out.push({ roleId: i.roleId, role: names.get(i.roleId) ?? i.roleId, unheld: (await review.liveHoldersOfRole(db, i.roleId)).length === 0 });
  return out;
}

/** When a proposal's roles would start if adopted now: a moon proposal at adoption (never before its first day), a season one on the season's first day. */
export function startOf(deps: Pick<DecideDeps, "calendar" | "now">, proposal: store.StoredOpenProposal): Date | null {
  const calendar = deps.calendar();
  const tz = calendar.timezone || "UTC";
  const now = deps.now();
  const term = proposal.body.term;
  if (term) {
    const moonStart = civilDateInstant(term.startsOn, tz);
    return moonStart && moonStart.getTime() > now.getTime() ? moonStart : wholeSecond(now);
  }
  const season = calendar.seasons.find((s) => s.id === proposal.targetSeasonId);
  return season ? civilDateInstant(season.startsOn, tz) : null;
}

/**
 * WHETHER EVERY SEAT OF A PROPOSED ROLE IS TAKEN when it would start (audit B3).
 * Counted by `seatsWithoutRoom`, plus the places promised to other adopted
 * proposals whose invitation is still out: those people have been told yes and
 * have no application yet. The proposer's own account and address never count
 * against them.
 */
export async function roomFor(deps: Pick<DecideDeps, "getPool" | "calendar" | "lapse" | "now">, proposal: store.StoredOpenProposal, own: string | null): Promise<FullSeat[]> {
  const pool = deps.getPool();
  const at = startOf(deps, proposal);
  if (!at) return [];
  const seatIds = proposal.body.roles.map((r) => r.roleId);
  const promised = new Map<string, number>();
  // The commitments behind those promised places (the lead, 20 Nov 2026), for the commitment limit.
  const promisedCommitments = new Map<string, Array<number | null>>();
  const mine = proposal.email ? emailKeyOf(proposal.email) : null;
  for (const other of await store.listOpenProposals(pool, ["adopted"], 5000)) {
    if (other.id === proposal.id || (mine && other.email && emailKeyOf(other.email) === mine)) continue;
    const roles = other.body.roles.map((r) => r.roleId).filter((id) => seatIds.includes(id));
    if (!roles.length) continue;
    const inv = await inviteById(pool, openInviteId(other.id));
    if (!inv || inv.usedByUserId || inv.revokedAt || inv.expired) continue;
    const terms = roleTermsOf(other.body);
    for (const id of roles) {
      promised.set(id, (promised.get(id) ?? 0) + 1);
      promisedCommitments.set(id, [...(promisedCommitments.get(id) ?? []), terms.find((t) => t.roleId === id)?.commitmentPct ?? null]);
    }
  }
  // This proposal's own commitment for each role, and the roles a decider already chose to go above.
  const adding = new Map(roleTermsOf(proposal.body).map((t) => [t.roleId, proposal.body.kind === "conversation" ? null : t.commitmentPct]));
  const overridden = new Set(seatIds.filter((id) => (proposal.overLimit ?? []).some((s) => s.roleId === id)));
  return seatsWithoutRoom(pool, { seatIds, candidateUserId: own, at, calendar: deps.calendar(), lapse: { ...deps.lapse(), now: deps.now() }, seasonId: proposal.body.term ? null : proposal.targetSeasonId, promised, promisedCommitments, adding, overridden });
}

export async function placeOnRoles(
  deps: DecideDeps,
  p: { account: string; proposal: store.StoredOpenProposal; adopterId: string; authority: string; /** False writes the application and stops: it waits for a vote (role journey L5, the ballot fallback). */ adopt?: boolean },
): Promise<Placed> {
  const pool = deps.getPool();
  const calendar = deps.calendar();
  const tz = calendar.timezone || "UTC";
  const now = deps.now();
  const season = calendar.seasons.find((s) => s.id === p.proposal.targetSeasonId);
  const term = p.proposal.body.term;
  // A season proposal starts on the season's first day. A moon proposal starts
  // at adoption, never before the moon's first day, and ends on its last day
  // (shared/openProposalTerm.ts, Rye 9 Nov 2026).
  const moonStart = term ? civilDateInstant(term.startsOn, tz) : null;
  // "Now" in whole seconds, the precision `starts_at` keeps (see startReached in seatApplicationCloser.ts).
  const nowSecond = wholeSecond(now);
  const startsAt = term ? (moonStart && moonStart.getTime() > now.getTime() ? moonStart : nowSecond) : season ? civilDateInstant(season.startsOn, tz) : null;
  if (!season || !startsAt) return { ok: false, code: "cannot", error: "The season this proposal was for is no longer on the village's calendar, so nothing was changed." };
  if (term && civilDateKey(now, tz) > term.endsOn) {
    return { ok: false, code: "cannot", error: "The moon this proposal was for has ended, so nothing was changed. Ask them to propose again for this moon." };
  }
  const seatIds = p.proposal.body.roles.map((r) => r.roleId);
  const seats = await seatsForUpdate(pool, seatIds);
  for (const id of seatIds) {
    const seat = seats.find((s) => s.id === id);
    if (!seat || !seat.active || seat.isExample) {
      return { ok: false, code: "cannot", error: `${seat?.name ?? "A role it names"} is no longer a role the village fills, so nothing was changed.` };
    }
  }
  // ONE AGREEMENT PER ROLE (the lead, 17 Nov 2026): each role of a proposal with a commitment for each is its own
  // application, with its own commitment, price and split. Every one is prepared before any is written, and all are
  // written in one transaction, so a role that cannot be placed leaves none placed.
  const parts = agreementParts(p.proposal.body);
  const prepared: Array<Extract<Awaited<ReturnType<typeof prepareApplication>>, { ok: true }>> = [];
  for (const part of parts) {
    // What was agreed is what is signed (audit B2): the offer, the latest revision, their answers and the commitment.
    const agreed = await agreedOf(pool, p.proposal, parts.length > 1 ? part : undefined);
    const price = await contractPriceFor(pool, p.proposal, agreed, parts.length > 1 ? part : undefined);
    const only = parts.length > 1 ? part.roleIds : undefined;
    // The goals are the proposal's and count for every role (the lead, 18 Nov 2026): an agreement whose role has none
    // of its own carries them all, as its own role's. A card written with goals under each role keeps each role's own.
    const all = goalsOfCard(p.proposal.body);
    const mine = only ? all.filter((g) => g.roleId === only[0]) : all;
    const goals = only && !mine.length ? all.map((g) => ({ ...g, roleId: only[0] })) : mine;
    const cardTerms = p.proposal.body.card?.terms ?? null;
    const aim = String(p.proposal.body.aim ?? "").trim();
    const serves = servesOfCard(p.proposal.body);
    const answers = {
      // The aim and the season goals she picked, so the adopted card reads them (verify item 7).
      ...(aim ? { aim } : {}),
      ...(serves.length ? { serves } : {}),
      ...(goals.length ? { goals } : {}),
      ...(cardTerms || agreed.commitmentPct != null
        ? {
            terms: {
              choice: overallChoice(agreed.answers),
              note: notesAsText(agreed.answers),
              // The per-setting answers ride with a commitment only: the parser asks for both together.
              ...(isCommitment(agreed.commitmentPct) ? { answers: agreed.answers, commitmentPct: agreed.commitmentPct } : {}),
            },
          }
        : {}),
    };
    const parsed = parseApplicationInput({
      seatIds: part.roleIds,
      note: p.proposal.body.why || null,
      deliverables: deliverablesOf(p.proposal.body, seats, agreed, only) || null,
      // The goals as a list, so the proposal's page draws them as one (joining lane PR 1), and the terms as agreed.
      ...(Object.keys(answers).length ? { answers } : {}),
      settings: settingsOfAgreed(agreed, term, price),
    });
    if (!parsed.ok) return { ok: false, code: "cannot", error: parsed.error };
    const made = await prepareApplication({
      candidateUserId: p.account,
      proposedBy: p.account,
      input: parsed.input,
      startsAt,
      startsNoEarlierThan: startsAt,
      seatNames: part.roleIds.map((id) => seats.find((s) => s.id === id)?.name ?? id),
      calendar,
      now,
      supersedes: null,
    });
    if (!made.ok) return { ok: false, code: "cannot", error: String(made.body.error ?? "The roles could not be set up.") };
    prepared.push(made);
  }
  try {
    await inApplicationTransaction(pool, async (conn) => {
      for (const made of prepared) {
        await writeApplicationOn(conn, made.app, "awaiting-holder", { candidateAligns: false });
        // The deciders' stamps ride onto the application made for those roles (the lead, 20 Nov 2026): a choice to go
        // above a role's limit, and the deliverables a saved split gives this person.
        const roles = new Set(made.app.row.seatIds);
        const over = (p.proposal.overLimit ?? []).filter((x) => roles.has(x.roleId));
        const held = (p.proposal.held ?? []).filter((x) => roles.has(x.roleId));
        if (over.length) await stampApplication(conn, made.app.row.id, "overLimit", over);
        if (held.length) await stampApplication(conn, made.app.row.id, "heldSplit", held);
      }
      // One proposal's roles are decided together: by one holder's adoption, or by ONE village vote (the lead, 18 Nov 2026).
      await setTogether(conn, prepared.map((made) => made.app.row.id));
    });
  } catch (e: any) {
    if (e?.code === "SA_PENDING") return { ok: false, code: "pending", applicationId: String(e.applicationId) };
    throw e;
  }
  const ids = prepared.map((made) => made.app.row.id);
  const many = ids.length > 1 ? { applicationIds: ids } : {};
  if (p.adopt === false) return { ok: true, applicationId: ids[0], outcome: "awaiting-holder", ...many };
  let first = "";
  for (const id of ids) {
    const { outcome, app, textId } = await adoptApplication(
      pool,
      id,
      ["awaiting-holder"],
      { via: "holder", ref: p.adopterId, authority: p.authority.slice(0, 64) },
      { now, lapse: { ...deps.lapse(), now }, calendar },
    );
    if (app) await tellOutcome(deps, app, outcome, "open", p.adopterId);
    if (textId) await settleText(settleDepsOf(deps, deps.now), textId);
    if (!first) first = outcome.kind;
  }
  // NO STAGE GRANT HERE (Rye's ruling: Voice is only for people who signed the
  // membership agreement). A stage grant at Member is an admission
  // (server/lib/admission.ts), and it opened ballots to somebody who had signed
  // nothing. The seat is placed; Member comes when their signed Love Letter is
  // accepted, which the adoption letter asks for.
  return { ok: true, applicationId: ids[0], outcome: first, ...many };
}

/**
 * WHAT A SIGN-UP THROUGH AN ADOPTED PROPOSAL'S INVITATION DOES, run by the
 * welcome step both sign-up doors share (`whenInvitedArrives`,
 * server/lib/inviteDoor.ts). The invitation's maker is the holder who adopted
 * it, and the authority is the one the adoption recorded. A place that cannot
 * be made never costs the person their account: the admins are told, once,
 * with the proposal's page.
 *
 * EVERY ADOPTED PROPOSAL FOR THAT ADDRESS IS PLACED (coordinator, 2026-10-31),
 * not only the one whose link was used: once the address has an account, no
 * other invitation for it can ever make one. Each other proposal whose link
 * nobody used has that link withdrawn first, and only a withdrawal that this
 * arrival made places it, so a second arrival places nothing twice. A proposal
 * adopted onto an account already here made no invitation and was placed then.
 */
/**
 * WHAT AN ADOPTED PROPOSAL'S LINK SAYS ON THE SIGN-UP PAGE (role audit, 10 Nov
 * 2026): the roles it places the person on, and the name and address they sent,
 * so the account step finishes the application instead of starting over. Only
 * an adopted proposal answers; anything else reads as an ordinary invitation.
 */
export function describeFor(deps: Pick<DecideDeps, "getPool">): InviteDescriber {
  return async (inviteId) => {
    const id = proposalOfInvite(inviteId);
    if (!id) return null;
    const pool = deps.getPool();
    const proposal = await store.readOpenProposal(pool, id);
    if (!proposal || proposal.status !== "adopted") return null;
    // `mailed`: the link went only to the address, and nobody else was handed it (audit, 15 Nov 2026). A link the
    // email did not carry was given to the adopter to pass on, so opening it proves nothing about the address.
    const mailed = (await store.invitationSentOf(pool, proposal.id))?.emailed === true;
    return { roles: await roleNames(pool, proposal), name: proposal.name ?? null, email: proposal.email ?? null, mailed };
  };
}

export function arrivalFor(deps: DecideDeps): InvitedArrival {
  return async ({ inviteId, inviterUserId, userId }) => {
    const id = proposalOfInvite(inviteId);
    if (!id) return;
    const pool = deps.getPool();
    const proposal = await store.readOpenProposal(pool, id);
    if (!proposal || proposal.status !== "adopted") return;
    const places: Array<{ proposal: store.StoredOpenProposal; adopterId: string }> = [{ proposal, adopterId: inviterUserId }];
    if (proposal.email) {
      for (const other of await store.adoptedForAddress(pool, emailKeyOf(proposal.email))) {
        if (other.id === proposal.id) continue;
        const link = await inviteById(pool, openInviteId(other.id));
        if (!link || link.usedByUserId) continue;
        if (!(await revokeInvite(pool, link.id, link.inviterUserId))) continue;
        places.push({ proposal: other, adopterId: link.inviterUserId });
      }
    }
    for (const place of places) {
      let failed = false;
      try {
        const out = await placeOnRoles(deps, {
          account: userId,
          proposal: place.proposal,
          adopterId: place.adopterId,
          authority: place.proposal.decision.authority ?? `${ADOPTING_POWER}@badge`,
        });
        failed = !out.ok && out.code === "cannot";
        // The updates already sent about it are there to read on the new profile.
        if (deps.projectName) await carryUpdatesToAccount({ getPool: deps.getPool, notify: deps.notify, projectName: deps.projectName }, place.proposal, userId);
      } catch (err) {
        failed = true;
        console.warn(`[open-proposals] the place for ${userId} was not made: ${String((err as Error)?.message ?? err)}`);
      }
      if (failed) {
        const pid = place.proposal.id;
        await deps.notifyAdmins("governance", OPEN_NOTICE_WORDS.arrivalFailedTitle(await roleNames(pool, place.proposal)), `op:${pid}:arrival-failed`, openProposalHref(pid));
      }
    }
  };
}

/**
 * Whether an account left the village and was not admitted again (Rye,
 * 2026-10-31: former members never invite). Adopting their proposal would
 * re-admit them; that is its own act, so adoption refuses it.
 */
export async function isFormerMemberAccount(deps: Pick<DecideDeps, "getPool" | "members">, accountId: string): Promise<boolean> {
  return leftTheVillage(deps.getPool(), (await deps.members.byId(accountId)) as any);
}

// ── Waiting on you ──────────────────────────────────────────────────────────

/**
 * THE TASK BOARD'S ROWS: every confirmed proposal the reader's circle asks
 * them about, inside the window and unanswered (`consent`), and otherwise every
 * one they may adopt or decline (`adopt`), never their own address's. Oldest
 * first. A fixed number of reads however many rows.
 */
export async function openProposalsWaitingOn(
  deps: { pool: Pool; timezone: string; now: Date },
  rule: HandOpenerRule,
  viewerId: string,
  viewerEmail: string | null = null,
): Promise<WaitingOpenProposal[]> {
  const waiting = await store.listOpenProposals(deps.pool, ["confirmed"]);
  if (!waiting.length) return [];
  const asks = await asksFor(deps.pool, waiting.map((p) => p.id));
  const mayDecide = rule.who === "live-holders" && rule.holders.includes(viewerId);
  const named = await rolesNamed(deps.pool, Array.from(new Set(waiting.flatMap((p) => p.body.roles.map((r) => r.roleId)))));
  const mine = viewerEmail ? emailKeyOf(viewerEmail) : null;
  const tz = deps.timezone || "UTC";
  const out: WaitingOpenProposal[] = [];
  for (const p of waiting) {
    const ask = (asks.get(p.id) ?? []).find((a) => a.userId === viewerId) ?? null;
    const asking = !!ask && !ask.answer && ask.closesAt.getTime() > deps.now.getTime();
    const own = (!!mine && !!p.email && emailKeyOf(p.email) === mine) || p.body.agent?.keeperUserId === viewerId;
    if (!asking && (!mayDecide || own)) continue;
    const roles = p.body.roles.map((r) => named.get(r.roleId));
    const circles: string[] = [];
    for (const r of roles) if (r?.circle && !circles.includes(r.circle)) circles.push(r.circle);
    out.push({
      id: p.id,
      href: openProposalHref(p.id),
      roles: p.body.roles.map((r, i) => roles[i]?.name ?? r.roleId),
      circles,
      // A first name only, never the address (shared/waitingOnYou.ts).
      proposer: greetingName(p.name) ?? "",
      ask: asking ? "consent" : "adopt",
      closesOn: asking && ask ? civilDateKey(new Date(ask.closesAt.getTime() - 1), tz) : null,
      confirmedOn: civilDateKey(p.confirmedAt ?? p.createdAt, tz),
    });
  }
  return out;
}
