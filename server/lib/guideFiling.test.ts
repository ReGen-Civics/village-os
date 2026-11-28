/**
 * FILED FOR REVIEW, DRAFTED BY THE GUIDE (server/lib/guideFiling.ts).
 *
 *   - every kind the queue knows answers whether the guide may draft it, and the list is the short one
 *   - whatever `neverProposed` refuses is never drafted, kind by kind and category by category
 *   - a dial is never filed: it is handed back for the save bar's own road
 *   - a module that carries money, or is always on, is never drafted; a body carries the switch and nothing else
 *   - the ticket is the change exactly as it was read, for one person, for an hour, and only this process's
 *   - the mark that makes a filing read as the guide's draft cannot be made up
 */
import { describe, expect, it } from "vitest";
import {
  draftableModules,
  filingPromptLines,
  GUIDE_DRAFT_HEADER,
  GUIDE_FILING_MAX_BYTES,
  GUIDE_FILING_WORDS,
  GUIDE_MAY_FILE,
  GUIDE_TICKET_TTL_MS,
  guideDraftMark,
  isGuideDraft,
  readGuideFiling,
  readGuideTicket,
  signGuideFiling,
} from "./guideFiling";
import { FAQ_PATHWAYS_FOR_PROPOSALS } from "./proposedChanges";
import { MODULES } from "../../shared/modules";
import { neverProposed, NEVER_PROPOSED, PROPOSAL_KINDS, proposalNever, PROPOSER_KINDS, proposerKindOf, type NeverKey, type ProposalInput } from "../../shared/proposedChanges";

const FAQ = { kind: "faq_add", target: { pathway: "resident" }, body: { question: "Where do I park?", answer: "By the barn." }, summary: "Add an FAQ on parking." };
const plain = MODULES.find((m) => !m.core && !m.legalReview)!;
const money = MODULES.find((m) => m.legalReview)!;
const core = MODULES.find((m) => m.core)!;
const SWITCH = { kind: "module_lifecycle", target: { id: plain.id }, body: { lifecycle: "preview" }, summary: `Put ${plain.name} in preview.` };

describe("the kind: drafted by the guide", () => {
  it("is one of the three kinds a filing can carry, and anything unknown reads as an agent's", () => {
    expect(PROPOSER_KINDS).toEqual(["agent", "person", "guide"]);
    // The column is varchar(8) (0379): the word fits with room to spare, so no migration.
    for (const k of PROPOSER_KINDS) expect(k.length).toBeLessThanOrEqual(8);
    expect(proposerKindOf("guide")).toBe("guide");
    expect(proposerKindOf("person")).toBe("person");
    expect(proposerKindOf("agent")).toBe("agent");
    expect(proposerKindOf("something-new")).toBe("agent");
    expect(proposerKindOf(null)).toBe("agent");
  });
});

describe("what the guide may draft", () => {
  it("answers for every kind the queue knows, and drafts only a new FAQ and a module's switch", () => {
    expect(Object.keys(GUIDE_MAY_FILE).sort()).toEqual([...PROPOSAL_KINDS].sort());
    expect(PROPOSAL_KINDS.filter((k) => GUIDE_MAY_FILE[k])).toEqual(["faq_add", "module_lifecycle"]);
  });

  it("reads a new FAQ and a module's switch, keeping only what each kind sets", () => {
    expect(readGuideFiling(FAQ)).toEqual({ ok: true, value: { kind: "faq_add", target: { pathway: "resident" }, body: { question: "Where do I park?", answer: "By the barn." }, summary: "Add an FAQ on parking." } });
    // Anything else in a body the guide wrote does not ride along.
    const padded = readGuideFiling({ ...SWITCH, body: { lifecycle: "preview", config: { legalAck: true }, extra: 1 } });
    expect(padded).toEqual({ ok: true, value: { kind: "module_lifecycle", target: { id: plain.id }, body: { lifecycle: "preview" }, summary: SWITCH.summary } });
  });

  it("is nothing when the answer drafted nothing", () => {
    expect(readGuideFiling(null)).toBeNull();
    expect(readGuideFiling(undefined)).toBeNull();
    expect(readGuideFiling("turn it on")).toBeNull();
    expect(readGuideFiling([FAQ])).toBeNull();
  });

  it("refuses every kind off its list, in words, and a role's terms by name", () => {
    const sample: Record<string, unknown> = {
      role_card: { kind: "role_card", target: { roleId: "r-1" }, body: { words: { aim: "x" } }, summary: "Reword the aim." },
      page_content: { kind: "page_content", target: { section: "page-home" }, body: { hero: { headline: "x" } }, summary: "Reword the headline." },
      faq_edit: { kind: "faq_edit", target: { pathway: "resident", id: "f-1" }, body: { question: "x", answer: "y" }, summary: "Reword an FAQ." },
      faq_remove: { kind: "faq_remove", target: { pathway: "resident", id: "f-1" }, body: {}, summary: "Take an FAQ down." },
      module_config: { kind: "module_config", target: { id: plain.id }, body: { a: 1 }, summary: "Change a module's settings." },
      role_listing: { kind: "role_listing", target: {}, body: { ids: ["r-1"] }, summary: "List one role." },
      season_goals: { kind: "season_goals", target: { seasonId: "s-1" }, body: { goals: [{ text: "x" }] }, summary: "Set the goals." },
      onboarding_path: { kind: "onboarding_path", target: {}, body: { doc: {} }, summary: "Change the path." },
      session_agenda: { kind: "session_agenda", target: { circleId: "c-1" }, body: { items: [{ title: "x", kind: "discussion" }] }, summary: "Add an agenda item." },
      setting: { kind: "setting", target: { method: "PUT", path: "/api/admin/brand" }, body: { name: "x" }, summary: "Rename the village." },
    };
    for (const kind of PROPOSAL_KINDS.filter((k) => !GUIDE_MAY_FILE[k] && k !== "variable" && k !== "seat_terms")) {
      expect(sample[kind], `a sample for ${kind}`).toBeTruthy();
      expect(readGuideFiling(sample[kind]), kind).toEqual({ ok: false, error: GUIDE_FILING_WORDS.notThisKind });
    }
    expect(readGuideFiling({ kind: "seat_terms", target: { roleId: "r-1" }, body: { words: { bonus: "x" } }, summary: "Reword the bonus." })).toEqual({ ok: false, error: GUIDE_FILING_WORDS.terms });
  });

  it("hands a dial back for the save bar, however it was drafted, and never files one", () => {
    expect(readGuideFiling({ kind: "variable", target: { key: "feed.show_birthdays" }, body: { value: "true" }, summary: "Show birthdays." })).toEqual({ ok: "dial", key: "feed.show_birthdays", value: "true", why: "Show birthdays." });
    // The same dial named by its route is the same dial.
    expect(readGuideFiling({ kind: "setting", target: { method: "PUT", path: "/api/admin/variables/feed.show_birthdays" }, body: { value: "true" }, summary: "Show birthdays." })).toMatchObject({ ok: "dial", key: "feed.show_birthdays" });
  });

  it("never drafts a module that carries money or one that is always on, and names why", () => {
    expect(money, "a module with a legal card exists").toBeTruthy();
    expect(readGuideFiling({ ...SWITCH, target: { id: money.id } })).toEqual({ ok: false, error: GUIDE_FILING_WORDS.money(money.name) });
    expect(readGuideFiling({ ...SWITCH, target: { id: core.id } })).toEqual({ ok: false, error: GUIDE_FILING_WORDS.alwaysOn(core.name) });
    expect(readGuideFiling({ ...SWITCH, target: { id: "no-such-module" } })).toEqual({ ok: false, error: GUIDE_FILING_WORDS.noModule });
    expect(readGuideFiling({ ...SWITCH, body: { lifecycle: "everyone" } })).toEqual({ ok: false, error: GUIDE_FILING_WORDS.lifecycle });
    // She is only ever told the modules she may draft.
    const told = draftableModules().map((m) => m.id);
    expect(told).toContain(plain.id);
    expect(told).not.toContain(money.id);
    expect(told).not.toContain(core.id);
    expect(filingPromptLines().rule).toContain(`${plain.id} (${plain.name})`);
    expect(filingPromptLines().rule).not.toContain(`${money.id} (`);
  });

  it("holds a new FAQ to the pages the queue takes, a question, and a length a person would read", () => {
    expect(readGuideFiling({ ...FAQ, target: { pathway: "everyone" } })).toEqual({ ok: false, error: GUIDE_FILING_WORDS.pathway });
    for (const pathway of FAQ_PATHWAYS_FOR_PROPOSALS) expect(readGuideFiling({ ...FAQ, target: { pathway } })).toMatchObject({ ok: true });
    expect(readGuideFiling({ ...FAQ, body: { question: "  ", answer: "x" } })).toEqual({ ok: false, error: GUIDE_FILING_WORDS.question });
    expect(readGuideFiling({ ...FAQ, body: { question: "Why?", answer: "x".repeat(GUIDE_FILING_MAX_BYTES) } })).toEqual({ ok: false, error: GUIDE_FILING_WORDS.tooLong });
    // The queue's own shape rules come first: a filing with no sentence is not one.
    expect(readGuideFiling({ ...FAQ, summary: "" })).toMatchObject({ ok: false });
  });
});

describe("the never list: whatever the queue never takes, the guide never drafts", () => {
  /** One change per category the queue refuses, each named the way an agent would name it. */
  const NEVER: Record<NeverKey, { method: string; path: string; body: Record<string, unknown> }> = {
    secrets: { method: "PUT", path: "/api/admin/integrations/resend", body: { key: "x" } },
    erasure: { method: "POST", path: "/api/admin/players/u-1/purge", body: {} },
    agents: { method: "POST", path: "/api/admin/proposals/accept", body: {} },
    powers: { method: "POST", path: "/api/admin/capabilities/grant", body: {} },
    money: { method: "POST", path: "/api/admin/payouts/run", body: {} },
    seating: { method: "POST", path: "/api/admin/org/seatings", body: { userId: "u-1" } },
    sending: { method: "POST", path: "/api/admin/letters/send", body: {} },
    members: { method: "PUT", path: "/api/admin/members/u-1", body: { name: "x" } },
    legal: { method: "PUT", path: `/api/admin/modules/${plain.id}/config`, body: { legalAck: true } },
  };

  it("covers every category the queue names", () => {
    expect(Object.keys(NEVER).sort()).toEqual(Array.from(new Set(NEVER_PROPOSED.map((r) => r.key))).sort());
  });

  for (const [key, c] of Object.entries(NEVER)) {
    it(`${key}: refused by the queue, and so never drafted`, () => {
      expect(neverProposed(c.method, c.path, c.body), `the sample for ${key} is one the queue refuses`).not.toBeNull();
      const read = readGuideFiling({ kind: "setting", target: { method: c.method, path: c.path }, body: c.body, summary: `A change the ${key} rule refuses.` });
      expect(read).toMatchObject({ ok: false });
    });
  }

  it("nothing it reads as fileable is on the never list, across everything above", () => {
    const tried: unknown[] = [FAQ, SWITCH, ...Object.values(NEVER).map((c) => ({ kind: "setting", target: { method: c.method, path: c.path }, body: c.body, summary: "A sample change." }))];
    for (const raw of tried) {
      const read = readGuideFiling(raw);
      if (read?.ok === true) {
        expect(proposalNever(read.value)).toBeNull();
        expect(GUIDE_MAY_FILE[read.value.kind]).toBe(true);
      }
    }
    expect(tried.filter((raw) => readGuideFiling(raw)?.ok === true)).toHaveLength(2);
  });
});

describe("the ticket: only what the server read, for the person who asked", () => {
  const change = (readGuideFiling(FAQ) as { ok: true; value: ProposalInput }).value;
  const NOW = 1_800_000_000_000;

  it("carries the change exactly, for that person, for an hour", () => {
    const ticket = signGuideFiling("u-1", change, NOW);
    expect(readGuideTicket(ticket, "u-1", NOW)).toEqual(change);
    expect(readGuideTicket(ticket, "u-1", NOW + GUIDE_TICKET_TTL_MS)).toEqual(change);
    expect(readGuideTicket(ticket, "u-1", NOW + GUIDE_TICKET_TTL_MS + 1)).toBeNull();
    // Somebody else's ticket is nobody's.
    expect(readGuideTicket(ticket, "u-2", NOW)).toBeNull();
  });

  it("is refused when its change, its person or its signature was touched, or when it is not a ticket at all", () => {
    const ticket = signGuideFiling("u-1", change, NOW);
    const [payload, mac] = ticket.split(".");
    const other = Buffer.from(JSON.stringify({ a: "u-1", e: NOW + GUIDE_TICKET_TTL_MS, p: { ...change, target: { pathway: "investor" } } }), "utf8").toString("base64url");
    expect(readGuideTicket(`${other}.${mac}`, "u-1", NOW)).toBeNull();
    expect(readGuideTicket(`${payload}.${mac.slice(0, -1)}${mac.endsWith("0") ? "1" : "0"}`, "u-1", NOW)).toBeNull();
    expect(readGuideTicket(payload, "u-1", NOW)).toBeNull();
    for (const junk of [undefined, null, "", "a.b", 7, { ticket }, "x".repeat(50_000)]) expect(readGuideTicket(junk, "u-1", NOW)).toBeNull();
  });
});

describe("the mark: only this process files as the guide", () => {
  it("is this process's own, and no made-up value passes for it", () => {
    expect(GUIDE_DRAFT_HEADER).toBe("x-village-guide-draft");
    expect(isGuideDraft(guideDraftMark())).toBe(true);
    for (const forged of [undefined, null, "", "1", "true", "guide", guideDraftMark().slice(0, -1), `${guideDraftMark()}0`, ["x"]]) {
      expect(isGuideDraft(forged), String(forged)).toBe(false);
    }
  });
});
