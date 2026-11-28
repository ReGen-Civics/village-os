/**
 * FILED FOR REVIEW, DRAFTED BY THE GUIDE (27 Nov 2026).
 *
 * The guide in Admin had one road for a change: ONE dial, put on the page's
 * save bar for a person to save. This is the second road. When the admin
 * wants something changed that is not a dial, the guide may draft it as a
 * proposed change, and the admin's "Send to review" files it into the review
 * queue (/admin/proposals), where a person accepts it like any other. The
 * guide applies nothing, ever.
 *
 * WHAT SHE MAY DRAFT. `GUIDE_MAY_FILE` answers for every kind the queue knows,
 * keyed by the union so a new kind cannot ship without a decision here. It is
 * short on purpose: she drafts only what she can know. Today that is a new FAQ
 * and a module's lifecycle, because their targets are fixed lists she is told
 * in her prompt. A kind whose target she cannot read (a role's id, a page's
 * fields) waits for a reader of its own. On top of the list:
 *   - a `variable` is never filed. A dial goes to the save bar, through
 *     `buildProposal` (shared/adminHelper.ts), with every refusal that has;
 *   - a module that carries money (`legalReview`) is never drafted: money
 *     stays in a person's hands, here as on the save bar;
 *   - whatever `neverProposed` refuses is refused, by its own words.
 *
 * ONLY WHAT THE SERVER READ. The card the dock draws carries a TICKET: the
 * change exactly as this server read and checked it in that turn, signed for
 * the person who asked, good for an hour. "Send to review" hands the ticket
 * back and nothing else, so a browser cannot invent a body, swap a target or
 * file as somebody else. The key is made when the process starts and never
 * leaves it; a ticket from before a restart is simply asked for again.
 *
 * FILED THROUGH THE QUEUE'S OWN DOOR. The filing is one POST to
 * `/api/admin/proposals` over the loopback, as the person, so the reader gate,
 * the rate limit, each kind's validator, the staging engine and the audit
 * event all run as they do for any filing. The same key marks that request as
 * the guide's draft (`GUIDE_DRAFT_HEADER`), which is the only thing that makes
 * a row's `proposed_by_kind` read `guide`: no outside caller can make the mark.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { MODULES, MODULES_BY_ID } from "../../shared/modules";
import { proposalNever, readProposalInput, type ProposalInput, type ProposalKind } from "../../shared/proposedChanges";
import { FAQ_PATHWAYS_FOR_PROPOSALS } from "./proposedChanges";

/** Whether the guide may draft this kind for review. Every kind answers. */
export const GUIDE_MAY_FILE: Record<ProposalKind, boolean> = {
  faq_add: true,
  module_lifecycle: true,
  // A dial goes to the save bar, never to the queue.
  variable: false,
  // She has no reader for what these change: a role's id, a page's fields, an FAQ's id, a season's goals.
  role_card: false,
  page_content: false,
  faq_edit: false,
  faq_remove: false,
  module_config: false,
  role_listing: false,
  season_goals: false,
  onboarding_path: false,
  session_agenda: false,
  // A role's terms stay a person's: she never reads terms or pay.
  seat_terms: false,
  // Any other admin route, by a path and body she would be guessing.
  setting: false,
};

export const GUIDE_FILING_WORDS = {
  notThisKind: "The guide can draft a new FAQ or a module's switch for review. That one is made by hand, on its own page.",
  terms: "A role's terms and pay stay in your own hands, so the guide does not draft them.",
  money: (name: string) => `${name} carries money, and money stays in your own hands. Turn it on or off yourself under Modules.`,
  noModule: "There is no module by that name here. Open the Module Library to see what the village can run.",
  alwaysOn: (name: string) => `${name} is always on, so there is nothing to switch.`,
  lifecycle: "A module is off, preview, members or public.",
  pathway: `A new FAQ goes on one of these pages: ${FAQ_PATHWAYS_FOR_PROPOSALS.join(", ")}.`,
  question: "A new FAQ needs its question.",
  tooLong: "That is longer than the guide can draft for review. Shorten it, or write it on its own page.",
  gone: "That draft is no longer here. Ask the guide again and it will be drafted afresh.",
} as const;

/** The most a drafted body may hold. An FAQ answer is a few paragraphs; anything longer is written by hand. */
export const GUIDE_FILING_MAX_BYTES = 8_000;

export type GuideFilingRead =
  | { ok: true; value: ProposalInput }
  /** A dial: it belongs on the save bar, so the caller hands it to `buildProposal`. */
  | { ok: "dial"; key: string; value: unknown; why: string }
  | { ok: false; error: string };

const LIFECYCLES = ["off", "preview", "members", "public"];

/**
 * One change the guide drafted, read. Null when there is none. PURE.
 *
 * The shape is the queue's own (`readProposalInput`), so a draft that reads
 * here files there; then the guide's own list, and the never rules.
 */
export function readGuideFiling(raw: unknown): GuideFilingRead | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const read = readProposalInput(raw);
  if (!read.ok) return { ok: false, error: read.error };
  const p = read.value;
  if (p.kind === "variable") {
    return { ok: "dial", key: String(p.target.key ?? ""), value: p.body.value, why: p.summary };
  }
  if (p.kind === "seat_terms") return { ok: false, error: GUIDE_FILING_WORDS.terms };
  if (!GUIDE_MAY_FILE[p.kind]) return { ok: false, error: GUIDE_FILING_WORDS.notThisKind };
  const never = proposalNever(p);
  if (never) return { ok: false, error: never.words };
  if (JSON.stringify(p.body).length > GUIDE_FILING_MAX_BYTES) return { ok: false, error: GUIDE_FILING_WORDS.tooLong };

  if (p.kind === "module_lifecycle") {
    const def = MODULES_BY_ID[String(p.target.id ?? "")];
    if (!def) return { ok: false, error: GUIDE_FILING_WORDS.noModule };
    if (def.core) return { ok: false, error: GUIDE_FILING_WORDS.alwaysOn(def.name) };
    if (def.legalReview) return { ok: false, error: GUIDE_FILING_WORDS.money(def.name) };
    const lifecycle = String(p.body.lifecycle ?? "");
    if (!LIFECYCLES.includes(lifecycle)) return { ok: false, error: GUIDE_FILING_WORDS.lifecycle };
    // Only the switch: nothing else rides along in a body the guide wrote.
    return { ok: true, value: { kind: p.kind, target: { id: def.id }, body: { lifecycle }, summary: p.summary } };
  }
  if (p.kind === "faq_add") {
    const pathway = String(p.target.pathway ?? "");
    if (!(FAQ_PATHWAYS_FOR_PROPOSALS as readonly string[]).includes(pathway)) return { ok: false, error: GUIDE_FILING_WORDS.pathway };
    const question = typeof p.body.question === "string" ? p.body.question.trim() : "";
    if (!question) return { ok: false, error: GUIDE_FILING_WORDS.question };
    const answer = typeof p.body.answer === "string" ? p.body.answer.trim() : "";
    return { ok: true, value: { kind: p.kind, target: { pathway }, body: { question, answer }, summary: p.summary } };
  }
  // A kind the list allows and this function does not read yet is not drafted: fail closed.
  return { ok: false, error: GUIDE_FILING_WORDS.notThisKind };
}

/** The modules she may draft a switch for: by id and name, never one that is always on or carries money. */
export function draftableModules(): Array<{ id: string; name: string }> {
  return MODULES.filter((m) => !m.core && !m.legalReview).map((m) => ({ id: m.id, name: m.name }));
}

/**
 * What the guide is told about this road: the rule, and the shape of `file`.
 * Said to both answerers (the village's own model and Sera), so the acts and
 * the limits are the same whoever answers.
 */
export function filingPromptLines(): { rule: string; shape: string } {
  const modules = draftableModules().map((m) => `${m.id} (${m.name})`).join(", ");
  return {
    rule: [
      "- When the admin wants one of these two things changed, you may draft it in \"file\" for a person to review. It goes to the review page, and nothing changes until a person accepts it there. Say so in your reply.",
      `  - A new FAQ: {"kind": "faq_add", "target": {"pathway": "<one of ${FAQ_PATHWAYS_FOR_PROPOSALS.join(", ")}>"}, "body": {"question": "<the question>", "answer": "<the answer>"}, "summary": "<one plain sentence saying what it adds>"}`,
      `  - A module switched off, preview, members or public: {"kind": "module_lifecycle", "target": {"id": "<module id>"}, "body": {"lifecycle": "<off | preview | members | public>"}, "summary": "<one plain sentence>"}. The modules, by id: ${modules}.`,
      "  - Never draft a module that carries money, a role's terms or pay, or anything about a person. For anything else that is not a setting, say which page the admin changes it on.",
      "  - One change an answer: \"propose\" for a setting, or \"file\" for one of the two above, never both.",
    ].join("\n"),
    shape: '"file": null or {"kind": "...", "target": {...}, "body": {...}, "summary": "..."}',
  };
}

// ── The ticket and the mark ─────────────────────────────────────────────────

/** Made when the process starts; never stored, never sent anywhere but this process's own loopback. */
const KEY = randomBytes(32);
const sign = (text: string) => createHmac("sha256", KEY).update(text).digest("hex");
const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** How long a drafted change waits for its "Send to review". */
export const GUIDE_TICKET_TTL_MS = 60 * 60 * 1000;

/** The change exactly as it was read, signed for the person who asked. */
export function signGuideFiling(actor: string, p: ProposalInput, now: number = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ a: actor, e: now + GUIDE_TICKET_TTL_MS, p }), "utf8").toString("base64url");
  return `${payload}.${sign(`ticket:${payload}`)}`;
}

/** The change a ticket carries, when this process signed it for this person and it has not lapsed; else null. */
export function readGuideTicket(ticket: unknown, actor: string, now: number = Date.now()): ProposalInput | null {
  if (typeof ticket !== "string" || ticket.length > 40_000) return null;
  const dot = ticket.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = ticket.slice(0, dot);
  if (!same(ticket.slice(dot + 1), sign(`ticket:${payload}`))) return null;
  try {
    const d = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { a?: unknown; e?: unknown; p?: unknown };
    if (d.a !== actor || typeof d.e !== "number" || d.e < now) return null;
    const p = d.p as ProposalInput | undefined;
    if (!p || typeof p !== "object" || typeof p.kind !== "string") return null;
    return p;
  } catch {
    return null;
  }
}

/** The header that marks a filing as the guide's draft, on this process's own loopback only. */
export const GUIDE_DRAFT_HEADER = "x-village-guide-draft";

/** The mark's value. Only this process can make it. */
export function guideDraftMark(): string {
  return sign("guide-draft");
}

/** Whether a request carries the mark this process makes. */
export function isGuideDraft(value: unknown): boolean {
  return typeof value === "string" && value.length > 0 && same(value, guideDraftMark());
}
