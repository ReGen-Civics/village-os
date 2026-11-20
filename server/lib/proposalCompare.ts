/**
 * COMPARE PROPOSALS (the lead, 20 Nov 2026): every proposal waiting for a decision, as entries the admin Compare
 * section lines up side by side. The rules are shared/proposalCompare.ts; the door is
 * server/routes/proposalCompare.ts.
 *
 *   open proposals     a stranger's, `confirmed` and not decided: one entry per role it names
 *   member applications  `awaiting-holder` or `voting`: one entry per role
 *   quest proposals    `proposed`
 *
 * READ ONLY. Nothing here adopts, declines, seats, sends or writes. Deciding stays on each proposal's own page.
 *
 * NO MODEL READS THIS. The entries go to a person's browser and nowhere else: no companion, guide, agent or Sera
 * tool names this file or its door (server/lib/applicationReview.refusal.test.ts). The split helper that reads the
 * deliverables is plain arithmetic in shared/deliverableSplit.ts.
 *
 * The order is the order the proposals arrived in, never a ranking.
 */
import { roleTermsOf, type OpenProposalBody } from "../../shared/openProposals";
import { openProposalHref } from "../../shared/openProposalDecide";
import { applicationHref, goalsOfApplication, OPEN_STATUSES, type ApplicationAnswers } from "../../shared/seatApplications";
import { TERM_LABELS, type TermKey } from "../../shared/termsWords";
import { askPeriod, COMMITMENT_TARGET_DEFAULT, type PayAsk } from "../../shared/commitmentRange";
import { categoriesOf, questCategory, roleCategory, NO_CIRCLE, type CompareDeliverable, type CompareItem, type ComparePayload, type CompareRole, type CompareTerms } from "../../shared/proposalCompare";
import type { StoredOpenProposal } from "../repos/openProposals";
import type { StoredApplication } from "../repos/seatApplications";
import type { QuestProposalRow } from "./questProposals";
import type { OrgRole } from "./orgChart";

/** What building the list reads. Each is a plain read; a suite hands in its own. */
export interface CompareSources {
  openProposals(): Promise<StoredOpenProposal[]>;
  applications(): Promise<StoredApplication[]>;
  questProposals(): Promise<QuestProposalRow[]>;
  roles(): Promise<OrgRole[]>;
  circles(): Promise<Array<{ id: string; name: string }>>;
  /** Live seatings per role id, for how many places are taken. */
  taken(roleIds: readonly string[]): Promise<Map<string, number>>;
  /** A member's name by id, or null. */
  nameOf(userId: string): Promise<string | null>;
}

const day = (d: Date | string | null | undefined): string | null => {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(String(d));
  return Number.isNaN(x.getTime()) ? null : x.toISOString().slice(0, 10);
};

const clip = (s: unknown, n = 400): string => (typeof s === "string" ? s.trim().slice(0, n) : "");

/** A price ask for a reader who may read pay, else nothing. */
function askOf(ask: PayAsk | null | undefined, readsPay: boolean): CompareTerms["ask"] {
  if (!readsPay || !ask) return null;
  if (ask.kind === "amount") return { kind: "amount", amount: ask.monthly, per: askPeriod(ask) };
  return { kind: "negotiate" };
}

const talkLabels = (answers: Partial<Record<TermKey, { choice: string }>> | undefined): string[] =>
  answers ? (Object.keys(answers) as TermKey[]).filter((k) => answers[k]?.choice === "talk" && TERM_LABELS[k]).map((k) => TERM_LABELS[k]) : [];

/** One open proposal's entries, one per role. */
export function openEntries(p: StoredOpenProposal, roleById: Map<string, OrgRole>, readsPay: boolean): CompareItem[] {
  const body: OpenProposalBody = p.body;
  const terms = roleTermsOf(body);
  return body.roles.map((r, i): CompareItem => {
    const role = roleById.get(r.roleId);
    const cardRole = body.card?.roles.find((c) => c.roleId === r.roleId);
    const deliverables: CompareDeliverable[] = [
      ...(cardRole?.moves ?? []).map((m) => ({ text: clip(m.text), ...(m.target ? { doneWhen: clip(m.target) } : {}), from: "outcome" as const })),
      ...(cardRole?.firstMoon ?? []).map((g) => ({ text: clip(g.quest), ...(g.doneWhen ? { doneWhen: clip(g.doneWhen) } : {}), ...(g.date ? { date: g.date } : {}), from: "value" as const })),
      ...(body.pieceSuggestions ?? []).filter((s) => s.roleId === r.roleId && s.kind === "deliver").map((s) => ({ text: clip(s.text), from: "deliver" as const })),
    ].filter((d) => d.text);
    const t = terms[i];
    const cardTerms = body.card?.terms;
    return {
      key: `op:${p.id}:${r.roleId}`,
      kind: "role",
      way: body.kind === "conversation" ? "conversation" : r.early ? "early" : "full",
      ref: p.id,
      who: clip(p.name, 120),
      whoKind: "person",
      title: role?.name ?? r.roleId,
      roleId: r.roleId,
      category: roleCategory(role?.circleId ?? null),
      commitmentPct: t?.commitmentPct ?? null,
      aim: clip(body.aim),
      deliverables,
      terms: {
        choice: cardTerms?.choice ?? null,
        note: clip(cardTerms?.note),
        talkAbout: talkLabels(cardTerms?.answers),
        rampUp: body.rampUp === true,
        ask: askOf(t?.payAsk, readsPay),
        countered: !!body.counterOffer?.revisions.length,
      },
      dates: {
        earliestStart: body.card?.earliestStart ?? null,
        startsOn: null,
        termStarts: body.term?.startsOn ?? null,
        termEnds: body.term?.endsOn ?? null,
        received: day(p.confirmedAt ?? p.createdAt),
      },
      href: openProposalHref(p.id),
    };
  });
}

/** One member application's entries, one per role. */
export function memberEntries(a: StoredApplication, who: string, roleById: Map<string, OrgRole>): CompareItem[] {
  const answers: ApplicationAnswers | null = a.answers;
  const goals = goalsOfApplication(a);
  return a.seatIds.map((roleId): CompareItem => {
    const role = roleById.get(roleId);
    const mine = goals.filter((g) => !g.roleId || g.roleId === roleId);
    return {
      key: `sa:${a.id}:${roleId}`,
      kind: "role",
      way: "member",
      ref: a.id,
      who,
      whoKind: "person",
      title: role?.name ?? roleId,
      roleId,
      category: roleCategory(role?.circleId ?? null),
      commitmentPct: typeof answers?.terms?.commitmentPct === "number" ? answers.terms.commitmentPct : null,
      aim: clip(answers?.aim),
      // The role outcomes their goals move, once each, then each goal as the value they would deliver.
      deliverables: [
        ...Array.from(new Set(mine.map((g) => clip(g.moves)).filter(Boolean))).map((text): CompareDeliverable => ({ text, from: "outcome" })),
        ...mine.map((g): CompareDeliverable => ({ text: clip(g.title), ...(g.doneWhen ? { doneWhen: clip(g.doneWhen) } : {}), ...(g.date ? { date: g.date } : {}), from: "goal" })),
      ].filter((d) => d.text),
      terms: answers?.terms
        ? { choice: answers.terms.choice, note: clip(answers.terms.note), talkAbout: talkLabels(answers.terms.answers), rampUp: false, ask: null, countered: !!answers.counterOffer?.revisions.length }
        : null,
      dates: { earliestStart: answers?.earliestStart ?? null, startsOn: day(a.startsAt), termStarts: null, termEnds: day(a.termEndsAt), received: day(a.createdAt) },
      href: applicationHref(a.id),
    };
  });
}

/** One quest proposal's entry. */
export function questEntry(q: QuestProposalRow, who: string): CompareItem {
  const deliverables: CompareDeliverable[] = [
    ...(q.prose.deliverable ? [{ text: clip(q.prose.deliverable), from: "quest" as const }] : []),
    ...(q.prose.steps ?? []).map((s) => ({ text: clip(s), from: "quest" as const })),
  ].filter((d) => d.text);
  return {
    key: `qp:${q.id}`,
    kind: "quest",
    way: "quest",
    ref: q.id,
    who,
    whoKind: who ? "person" : q.proposedByKind === "human" ? "visitor" : "machine",
    title: clip(q.prose.title, 200),
    roleId: null,
    category: questCategory(q.prose.circle),
    commitmentPct: null,
    aim: clip(q.prose.description ?? q.prose.impact),
    deliverables,
    terms: null,
    dates: { earliestStart: null, startsOn: null, termStarts: null, termEnds: null, received: day(q.receivedAt) },
    href: "/review",
  };
}

/** Every proposal waiting for a decision, in the order each arrived. */
export async function buildComparison(src: CompareSources, readsPay: boolean): Promise<ComparePayload> {
  const [open, apps, quests, roles, circles] = await Promise.all([src.openProposals(), src.applications(), src.questProposals(), src.roles(), src.circles()]);
  const roleById = new Map(roles.map((r) => [r.id, r]));
  const circleName = new Map(circles.map((c) => [c.id, c.name]));
  const waitingApps = apps.filter((a) => (OPEN_STATUSES as readonly string[]).includes(a.status));
  const names = new Map<string, string | null>();
  const nameOf = async (id: string | null): Promise<string> => {
    if (!id) return "";
    if (!names.has(id)) names.set(id, await src.nameOf(id));
    return clip(names.get(id) ?? "", 120);
  };
  const entries: Array<{ at: number; items: CompareItem[] }> = [];
  for (const p of open.filter((x) => x.status === "confirmed")) entries.push({ at: new Date(p.confirmedAt ?? p.createdAt).getTime(), items: openEntries(p, roleById, readsPay) });
  for (const a of waitingApps) entries.push({ at: new Date(a.createdAt).getTime(), items: memberEntries(a, await nameOf(a.candidateUserId), roleById) });
  for (const q of quests.filter((x) => x.status === "proposed")) entries.push({ at: new Date(q.receivedAt).getTime(), items: [questEntry(q, await nameOf(q.proposedBy))] });
  // Arrival order, oldest first; the proposals arriving together keep the order they were read in.
  const items = entries
    .map((e, i) => ({ ...e, i }))
    .sort((x, y) => (x.at || 0) - (y.at || 0) || x.i - y.i)
    .flatMap((e) => e.items);
  const roleIds = Array.from(new Set(items.map((i) => i.roleId).filter((x): x is string => !!x)));
  const taken = await src.taken(roleIds);
  const compareRoles: CompareRole[] = roleIds.map((id) => {
    const r = roleById.get(id);
    return {
      id,
      name: r?.name ?? id,
      category: roleCategory(r?.circleId ?? null),
      outcomes: (r?.accountabilities ?? []).map((a) => String(a ?? "").trim()).filter(Boolean),
      commitmentTarget: typeof r?.commitmentTarget === "number" && r.commitmentTarget > 0 ? r.commitmentTarget : COMMITMENT_TARGET_DEFAULT,
      places: r?.seats ?? 1,
      taken: taken.get(id) ?? 0,
    };
  });
  const labelOf = (key: string): string => {
    if (key === NO_CIRCLE) return "";
    if (key.startsWith("circle:")) return circleName.get(key.slice("circle:".length)) ?? "";
    const quest = items.find((i) => i.category === key && i.kind === "quest");
    return quest ? clip(quests.find((q) => q.id === quest.ref)?.prose.circle, 80) : "";
  };
  return { items, roles: compareRoles, categories: categoriesOf(items, labelOf), readsPay };
}
