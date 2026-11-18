/**
 * THE COUNTER-OFFER, THE WORK (joining lane PR 4). Words and rules are shared/counterOffer.ts.
 *
 * One subject shape reads both doors: an open proposal (`op-`, the counter-offer in its JSON body)
 * and a member's application (`sa-`, in its answers). Every write locks the row, checks the
 * revision the editor read, appends, and writes the whole object back, so two editors never
 * overwrite each other and a retried save is refused instead of repeated.
 *
 * WHO MAY EDIT is decided by the doors, with the gate that adopts (`adoptRefusal` over `org.seat`).
 * This file holds no gate of its own.
 */
import type { Pool, PoolConnection } from "mysql2/promise";
import {
  baseWordsOf,
  counterOfferOf,
  currentCommitment,
  currentWords,
  editOffer,
  offerForCandidate,
  OFFER_WORDS,
  openTalks,
  replyToOffer,
  stateOf,
  changedIn,
  OFFER_KEYS,
  OFFER_LABELS,
  type CounterOffer,
  type OfferEdit,
  type OfferKey,
  type OfferRevision,
  offerVersion,
} from "../../shared/counterOffer";
import {
  currentRoleValue,
  editRoleOffer,
  replyKey,
  replyToRoleOffer,
  roleChangedIn,
  roleOpenTalks,
  roleStateOf,
  type RoleOfferKey,
  type RoleOfferState,
} from "../../shared/roleCounterOffer";
import { roleTermsOf } from "../../shared/openProposals";
import type { PayAsk } from "../../shared/commitmentRange";
import { roleNamesById } from "../repos/applicationReview";
import { sectionsForMany } from "./roleCardSections";
import type { PayCeiling } from "../../shared/roleCardSections";
import { moneyWords } from "../../shared/roleRewardWords";
import { kindOfRef } from "../../shared/applicationReview";
import { publicTermsOf } from "../../shared/seatTermsOffer";
import type { TermAnswers, TermsWords } from "../../shared/termsWords";
import { inTransaction } from "../repos/liveSessions";
import * as proposals from "../repos/openProposals";
import * as apps from "../repos/seatApplications";

type Db = Pool | PoolConnection;

export interface OfferSubject {
  kind: "open" | "member";
  id: string;
  roleIds: string[];
  answers: TermAnswers;
  theirs: number | null;
  co: CounterOffer | null;
  /** Still waiting for its deciders: the only time terms may change. */
  open: boolean;
  /** The member door's candidate, to tell. */
  candidateUserId: string | null;
  /**
   * EACH ROLE'S OWN TERMS, before any counter (the lead, 18 Nov 2026): the applicant's commitment and price ask, and
   * the role's name. An open proposal's roles; the member door's application is one agreement and counters none.
   */
  roles: Array<{ roleId: string; name: string; commitmentPct: number | null; ask: PayAsk | null; ceiling: PayCeiling | null }>;
}

/** What a role's price was before a counter: their amount ask, else nothing (the suggested price stands). */
const askedPrice = (ask: PayAsk | null): number | null => (ask?.kind === "amount" ? ask.monthly : null);

/** The subject behind a ref, or null. */
export async function loadSubject(db: Db, ref: string, lock = false): Promise<OfferSubject | null> {
  const kind = kindOfRef(ref);
  if (kind === "open") {
    const p = await proposals.readOpenProposal(db, ref, lock);
    if (!p || p.status === "unconfirmed") return null;
    const ids = p.body.roles.map((r) => r.roleId);
    const [names, sections] = await Promise.all([roleNamesById(db, ids), sectionsForMany(db as Pool, ids)]);
    const roles = roleTermsOf(p.body).map((t) => ({ roleId: t.roleId, name: names.get(t.roleId) ?? t.roleId, commitmentPct: t.commitmentPct, ask: t.payAsk, ceiling: sections.get(t.roleId)?.payCeiling ?? null }));
    return { kind, id: p.id, roleIds: p.body.roles.map((r) => r.roleId), answers: p.body.card?.terms?.answers ?? {}, theirs: p.body.card?.commitmentPct ?? null, co: p.body.counterOffer ?? null, open: p.status === "confirmed", candidateUserId: null, roles };
  }
  if (kind === "member") {
    const a = await apps.readApplication(db, ref, lock);
    if (!a) return null;
    return { kind, id: a.id, roleIds: a.seatIds, answers: a.answers?.terms?.answers ?? {}, theirs: a.answers?.terms?.commitmentPct ?? null, co: a.answers?.counterOffer ?? null, open: a.status === "awaiting-holder", candidateUserId: a.candidateUserId, roles: [] };
  }
  return null;
}

async function writeSubject(db: Db, s: OfferSubject, co: CounterOffer): Promise<boolean> {
  return s.kind === "open" ? proposals.setCounterOffer(db, s.id, co) : apps.setApplicationCounterOffer(db, s.id, co);
}

/** The role's suggestion for this proposal, from the roles it names. */
export async function baseOf(db: Db, roleIds: readonly string[]): Promise<{ words: TermsWords; commitmentPct: number | null }> {
  const offers = (await apps.termsOffersOf(db, roleIds)).map((o) => publicTermsOf(o));
  return { words: baseWordsOf(offers), commitmentPct: offers.find((o) => o.commitmentPct != null)?.commitmentPct ?? null };
}

export interface DeciderOffer {
  revision: number;
  rows: Array<{
    key: OfferKey;
    label: string;
    suggested: string | null;
    current: string | null;
    theirs: { choice: "accept" | "talk"; note: string } | null;
    state: "accept" | "talk" | "waiting";
    changed: boolean;
  }>;
  theirCommitment: number | null;
  roleCommitment: number | null;
  ourCommitment: number | null;
  /** Newest first, for the deciders only. */
  history: Array<OfferRevision & { changes: Array<{ key: OfferKey; label: string; from: string | null; to: string | null }> }>;
  /** Settings still open at adoption, by label. */
  openTalks: string[];
  /** Each role's commitment and price, as asked and as countered (the lead, 18 Nov 2026). Empty on the member door. */
  roles: DeciderRoleRow[];
}

export interface DeciderRoleRow {
  roleId: string;
  name: string;
  /** The first role's commitment is countered with the rest of the terms, above. */
  first: boolean;
  theirCommitment: number | null;
  ourCommitment: number | null;
  commitmentChanged: boolean;
  commitmentState: RoleOfferState;
  ask: PayAsk | null;
  /** The role's listed price for the full role, for the deciders: the price is countered in its currency and period. */
  ceiling: PayCeiling | null;
  ourPrice: number | null;
  priceChanged: boolean;
  priceState: RoleOfferState;
}

/** The label of one role's countered value, for the open talks and the history. */
export const roleOfferLabel = (name: string, key: RoleOfferKey): string => (key === "price" ? `Price for ${name}` : `Commitment for ${name}`);

/** Every value still open at adoption, by label: the proposal's settings, then each role's countered commitment and price. */
export function openTalkLabels(s: Pick<OfferSubject, "answers" | "co" | "roles">): string[] {
  const nameOf = (id: string) => s.roles.find((r) => r.roleId === id)?.name ?? id;
  return [...openTalks({ answers: s.answers, co: s.co }).map((k) => OFFER_LABELS[k]), ...roleOpenTalks(s.co?.roles ?? null).map((t) => roleOfferLabel(nameOf(t.roleId), t.key))];
}

/** Each role's row for the deciders. */
function roleRows(s: OfferSubject): DeciderRoleRow[] {
  const rc = s.co?.roles ?? null;
  const at = roleChangedIn(rc);
  return s.roles.map((r, i) => ({
    roleId: r.roleId,
    name: r.name,
    first: i === 0,
    theirCommitment: r.commitmentPct,
    ourCommitment: i === 0 ? currentCommitment(s.theirs, s.co) : currentRoleValue(rc, r.roleId, "commitment", r.commitmentPct),
    commitmentChanged: i > 0 && !!at[replyKey(r.roleId, "commitment")],
    commitmentState: rc ? roleStateOf(rc, r.roleId, "commitment") : "accept",
    ask: r.ask,
    ceiling: r.ceiling,
    ourPrice: currentRoleValue(rc, r.roleId, "price", askedPrice(r.ask)),
    priceChanged: !!at[replyKey(r.roleId, "price")],
    priceState: rc ? roleStateOf(rc, r.roleId, "price") : "accept",
  }));
}

/** What a decider reads: the suggestion, the answer, our wording, the state of each, and the log. */
export function deciderOffer(s: OfferSubject, base: { words: TermsWords; commitmentPct: number | null }): DeciderOffer {
  const words = currentWords(base.words, s.co);
  const at = changedIn(s.co);
  const rows = OFFER_KEYS.filter((k) => k !== "commitment").map((k) => ({
    key: k,
    label: OFFER_LABELS[k],
    suggested: base.words[k as keyof TermsWords] ?? null,
    current: words[k as keyof TermsWords] ?? null,
    theirs: s.answers[k as keyof TermAnswers] ?? null,
    state: s.co && at[k] ? stateOf(k, s.co) : s.answers[k as keyof TermAnswers]?.choice === "talk" ? ("talk" as const) : ("accept" as const),
    changed: !!at[k],
  }));
  const nameOf = (id: string) => s.roles.find((r) => r.roleId === id)?.name ?? id;
  // The roles' revisions sit in the history beside the proposal's, by when they were saved.
  const roleHistory = (s.co?.roles?.revisions ?? []).map((r) => ({ ...r, n: r.n, role: true as const, changes: r.changes.map((c) => ({ key: replyKey(c.roleId, c.key) as OfferKey, label: roleOfferLabel(nameOf(c.roleId), c.key), from: c.from, to: c.to })) }));
  const history = [...(s.co?.revisions ?? []).map((r) => ({ ...r, changes: r.changes.map((c) => ({ ...c, label: OFFER_LABELS[c.key] })) })), ...roleHistory].sort((a, b) => a.at.localeCompare(b.at));
  return {
    revision: offerVersion(s.co),
    rows,
    theirCommitment: s.theirs,
    roleCommitment: base.commitmentPct,
    ourCommitment: currentCommitment(s.theirs, s.co),
    // Numbered in the order saved, across the proposal's revisions and the roles'.
    history: history.map((r, i) => ({ ...r, n: i + 1 })).reverse(),
    openTalks: openTalkLabels(s),
    roles: roleRows(s),
  };
}

export type Saved = { ok: true; revision: { n: number }; subject: OfferSubject } | { ok: false; status: number; error: string; key?: OfferKey | string };

/** A decider saves a counter-offer: one new revision, or a refusal. The caller has already checked the gate. */
/**
 * `edit.roles`: each role's commitment (after the first) and price, countered (the lead, 18 Nov 2026). One save may
 * change the proposal's settings, the roles' values, or both; the version it read covers all of them.
 */
export async function saveOffer(pool: Pool, ref: string, p: { edit: OfferEdit & { roles?: unknown }; expectedRevision: unknown; by: { id: string; name: string }; now: Date }): Promise<Saved> {
  return inTransaction(pool, async (conn): Promise<Saved> => {
    const s = await loadSubject(conn, ref, true);
    if (!s) return { ok: false, status: 404, error: "There is nothing here." };
    if (!s.open) return { ok: false, status: 409, error: "This is decided, so its terms are closed." };
    if (Number(p.expectedRevision) !== offerVersion(s.co)) return { ok: false, status: 409, error: OFFER_WORDS.moved };
    const roleSent = Array.isArray(p.edit.roles) && p.edit.roles.length > 0;
    const termsSent = (p.edit.words && Object.keys(p.edit.words).length > 0) || (p.edit.commitmentPct !== undefined && p.edit.commitmentPct !== null);
    let co: CounterOffer | null = s.co;
    let changed = false;
    if (termsSent || !roleSent) {
      const base = await baseOf(conn, s.roleIds);
      const edited = editOffer({ base: base.words, theirs: s.theirs, co, edit: { words: p.edit.words, commitmentPct: p.edit.commitmentPct }, by: p.by, now: p.now });
      if (edited.ok) {
        co = edited.co;
        changed = true;
      } else if (!roleSent || edited.error !== OFFER_WORDS.nothingChanged) return { ok: false, status: 400, error: edited.error, key: edited.key };
    }
    if (roleSent) {
      const roles = s.roles.map((r) => ({ roleId: r.roleId, commitmentPct: r.commitmentPct, price: askedPrice(r.ask) }));
      const edited = editRoleOffer({ rc: co?.roles ?? null, roles, edits: p.edit.roles, by: p.by, now: p.now });
      if (!edited.ok) return { ok: false, status: 400, error: edited.error, key: edited.roleId };
      if (edited.revision) {
        co = { ...(co ?? { revisions: [], replies: {} }), roles: edited.rc };
        changed = true;
      }
    }
    if (!changed || !co) return { ok: false, status: 400, error: OFFER_WORDS.nothingChanged };
    if (!(await writeSubject(conn, s, co))) return { ok: false, status: 409, error: OFFER_WORDS.moved };
    return { ok: true, revision: { n: offerVersion(co) }, subject: { ...s, co } };
  });
}

export type Replied = { ok: true; subject: OfferSubject } | { ok: false; status: number; error: string; key?: OfferKey | string };

/** The applicant answers the changed settings. The caller has already proved who they are. */
export async function replyOffer(pool: Pool, ref: string, raw: unknown, now: Date): Promise<Replied> {
  return inTransaction(pool, async (conn): Promise<Replied> => {
    const s = await loadSubject(conn, ref, true);
    if (!s) return { ok: false, status: 404, error: "There is nothing here." };
    if (!s.open) return { ok: false, status: 409, error: "This is decided, so its terms are closed." };
    // The proposal's settings, and each role's countered values under `roles` (the lead, 18 Nov 2026).
    const given = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const settings: Record<string, unknown> = {};
    const roleReplies: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(given)) {
      if (k.startsWith(ROLE_ROW_PREFIX)) roleReplies[k.slice(ROLE_ROW_PREFIX.length)] = v;
      else settings[k] = v;
    }
    let co = s.co;
    const settingsSent = Object.values(settings).some((v) => v !== undefined && v !== null);
    const rolesReplied = replyToRoleOffer(co?.roles ?? null, roleReplies, now);
    if (!rolesReplied.ok) return { ok: false, status: 400, error: rolesReplied.error, key: rolesReplied.key };
    if (settingsSent || !rolesReplied.any) {
      const r = replyToOffer(co, settings, now);
      if (!r.ok) return { ok: false, status: 400, error: r.error, key: r.key };
      co = r.co;
    }
    if (rolesReplied.any && co && rolesReplied.rc) co = { ...co, roles: rolesReplied.rc };
    if (!co) return { ok: false, status: 400, error: OFFER_WORDS.nothingToAnswer };
    if (!(await writeSubject(conn, s, co))) return { ok: false, status: 409, error: OFFER_WORDS.moved };
    return { ok: true, subject: { ...s, co } };
  });
}

/** What the applicant reads: the changed settings beside their answers. Never the log. */
export async function applicantOffer(db: Db, ref: string) {
  const s = await loadSubject(db, ref);
  if (!s || !s.co) return null;
  const base = await baseOf(db, s.roleIds);
  const offer = offerForCandidate({ base: base.words, answers: s.answers, theirs: s.theirs, co: s.co });
  if (!offer) return null;
  const roles = applicantRoleRows(s);
  return { ...offer, revision: offerVersion(s.co), rows: [...offer.rows, ...roles], open: offer.open + roles.filter((r) => r.state === "waiting").length, mayAnswer: s.open };
}

/** A role row's key on the applicant's page and in their reply: `role:<roleId>:<kind>`. */
export const ROLE_ROW_PREFIX = "role:";
const roleRowKey = (roleId: string, kind: RoleOfferKey) => `${ROLE_ROW_PREFIX}${roleId}:${kind}`;

/** "6,500 USD a month": an amount in a role's own currency and period, for the applicant's page. */
function priceWords(amount: number, ceiling: PayCeiling | null): string {
  if (!ceiling) return String(amount);
  return `${moneyWords(amount, ceiling.currency, "en-US")} a ${ceiling.per}`;
}

/**
 * EACH ROLE'S COUNTERED COMMITMENT AND PRICE, for the applicant (the lead, 18 Nov 2026): in the same rows as the changed
 * settings, so one page answers both. Ours now beside what they proposed, and their answer. Never the log, and never
 * the cap.
 */
export function applicantRoleRows(s: OfferSubject) {
  const rc = s.co?.roles ?? null;
  if (!rc) return [];
  const at = roleChangedIn(rc);
  const out: Array<{ key: string; label: string; ours: string; theirs: null; theirCommitment: number | null; theirsText?: string; state: RoleOfferState; reply: { choice: "accept" | "talk"; note: string } | null }> = [];
  for (const r of s.roles) {
    for (const kind of ["commitment", "price"] as const) {
      if (!at[replyKey(r.roleId, kind)]) continue;
      const state = roleStateOf(rc, r.roleId, kind);
      const reply = rc.replies[replyKey(r.roleId, kind)];
      const theirPrice = askedPrice(r.ask);
      const ours = currentRoleValue(rc, r.roleId, kind, kind === "commitment" ? r.commitmentPct : theirPrice);
      out.push({
        key: roleRowKey(r.roleId, kind),
        label: roleOfferLabel(r.name, kind),
        ours: ours == null ? "" : kind === "commitment" ? `${ours}%` : priceWords(ours, r.ceiling),
        theirs: null,
        theirCommitment: kind === "commitment" ? r.commitmentPct : null,
        ...(kind === "price" ? { theirsText: theirPrice !== null ? priceWords(theirPrice, r.ceiling) : r.ask?.kind === "negotiate" ? "Negotiate on the first call" : "The suggested price" } : {}),
        state,
        reply: state === "waiting" || !reply ? null : { choice: reply.choice, note: reply.note },
      });
    }
  }
  return out;
}

/** The settings still open if this were adopted now, by label; empty when none. */
export async function openTalksOf(db: Db, ref: string): Promise<string[]> {
  const s = await loadSubject(db, ref);
  return s ? openTalkLabels(s) : [];
}

