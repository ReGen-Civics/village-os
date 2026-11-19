/**
 * AGENT POWERS (the lead, 19 Nov 2026), the pure halves:
 *
 *   - the village's word documents (the vocabulary, the menu, the notices) are proposable, read by the content route's own validators
 *   - `vocabulary` is page_content on app-vocabulary, and an alias never reaches an object's own keys
 *   - a role's terms are proposed as words only: anything beside `words` is refused, and every group, pay among them,
 *     is kept exactly as held
 *   - the read of a role's terms carries no figure, only the names of the groups set
 *   - the queue an agent reads carries batch, id, kind, sentence, state and whether it filed it, and nothing else
 *   - none of it opens what stays a person's: the never rules still refuse money, seating and the proposals routes
 */
import { describe, expect, it } from "vitest";
import { contentDocumentFor, contentDocumentLive, CONTENT_DOCUMENTS } from "./contentDocuments";
import { neverProposed, proposalNever, readProposalInput, routeOf } from "./proposedChanges";
import { liveSeatWords, readSeatTermsBody, seatTermsProblem, seatTermsRead, termsWithWords } from "./seatTermsProposal";
import { queueItemOf } from "./proposalQueue";
import { faceOf } from "./proposalReview";
import { footprintOf } from "./proposalConflicts";
import { alwaysAPerson } from "./agentAdmin";
import type { SeatSettings } from "./seatSettings";

const HELD: SeatSettings = {
  v: 1,
  pay: { kind: "fixed", currency: "USD", amountMinor: 300000, per: "moon" },
  bonus: { kind: "equity", capWords: "Up to a tenth of the moon" },
  words: { term: "We renew together each moon.", bonus: "Earned Equity under the moon-contract rule." },
  clocks: { commitmentPct: 100 },
};

describe("the village's word documents", () => {
  it("lists the vocabulary, the menu and the notices, and never the canvas", () => {
    expect(CONTENT_DOCUMENTS.map((d) => d.section)).toEqual(["app-vocabulary", "app-menu", "app-notices"]);
    expect(contentDocumentFor("canvas")).toBeNull();
    expect(contentDocumentFor("page-home")).toBeNull();
  });

  it("reads the vocabulary with the route's own validator", () => {
    const doc = contentDocumentFor("app-vocabulary")!;
    expect(doc.problem({ contributionToken: { one: "village token", many: "village tokens" } })).toBeNull();
    expect(doc.problem({ notASlot: { one: "x" } })).toContain("not one of the words");
    expect(doc.problem({ circle: { one: "x".repeat(40) } })).toContain("characters at most");
  });

  it("reads the vocabulary as the words in force, so a change has something to be put back to", () => {
    const live = contentDocumentLive("app-vocabulary", undefined) as Record<string, { one: string; many: string }>;
    expect(live.circle).toEqual({ one: "circle", many: "circles" });
    expect(live.contributionToken).toEqual({ one: "contribution token", many: "contribution tokens" });
    const set = contentDocumentLive("app-vocabulary", { contributionToken: { one: "village token" } }) as Record<string, { one: string; many: string }>;
    expect(set.contributionToken).toEqual({ one: "village token", many: "village tokens" });
  });
});

describe("kind vocabulary", () => {
  it("is page_content on app-vocabulary, whatever target it was sent with", () => {
    const r = readProposalInput({ kind: "vocabulary", target: { section: "page-home" }, body: { contributionToken: { one: "village token" } }, summary: "Call the contribution token the village token." });
    expect(r.ok && r.value).toEqual({ kind: "page_content", target: { section: "app-vocabulary" }, body: { contributionToken: { one: "village token" } }, summary: "Call the contribution token the village token." });
    expect(r.ok && proposalNever(r.value)).toBeNull();
  });

  it("an object's own keys are never an alias", () => {
    const r = readProposalInput({ kind: "toString", target: {}, body: {}, summary: "A kind that is not one." });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("vocabulary");
  });
});

describe("kind seat_terms: words only", () => {
  it("takes words for the eight settings and refuses anything beside them", () => {
    expect(readSeatTermsBody({ words: { bonus: "  A share when the goals are met.  ", ending: "" } })).toEqual({ ok: true, words: { bonus: "A share when the goals are met.", ending: "" } });
    for (const body of [{ pay: { amountMinor: 1 } }, { words: { bonus: "x" }, allowance: { kind: "flat" } }, { words: { payNote: "x" } }, { words: { bonus: 5 } }, { words: {} }, {}]) {
      expect(readSeatTermsBody(body as Record<string, unknown>).ok, JSON.stringify(body)).toBe(false);
    }
  });

  it("keeps every group as held, pay among them, and changes only the wordings sent", () => {
    const next = termsWithWords(HELD, { bonus: "A share when the goals are met.", term: "" })!;
    expect(next.pay).toEqual(HELD.pay);
    expect(next.bonus).toEqual(HELD.bonus);
    expect(next.clocks).toEqual(HELD.clocks);
    expect(next.words).toEqual({ bonus: "A share when the goals are met." });
    expect(termsWithWords(null, { bonus: "" })).toBeNull();
    expect(termsWithWords(null, { bonus: "Words alone." })).toEqual({ v: 1, words: { bonus: "Words alone." } });
  });

  it("is checked the way the draft checks a new offer, payment details included", () => {
    expect(seatTermsProblem(HELD, { bonus: "A share when the goals are met." })).toBeNull();
    expect(seatTermsProblem(HELD, { bonus: "Paid to account 123456789012" })).toContain("cannot be offered");
  });

  it("reads as words, the commitment, and the names of the groups set: never a figure", () => {
    const r = seatTermsRead({ id: "r-1", name: "Lead Steward", termsOffer: JSON.stringify(HELD) });
    expect(r.words.bonus).toBe("Earned Equity under the moon-contract rule.");
    expect(r.words.goals).toBe("");
    expect(r.commitmentPct).toBe(100);
    expect(r.setGroups).toEqual(["Clocks", "Pay", "Bonus"]);
    expect(JSON.stringify(r)).not.toMatch(/300000|USD|amountMinor|currency/);
    expect(Object.keys(liveSeatWords(HELD).words)).toHaveLength(8);
  });

  it("runs through the org draft path, reads on the role's card, and writes one field per wording", () => {
    const route = routeOf("seat_terms", { roleId: "r-1" });
    expect(route).toEqual({ method: "POST", path: "/api/admin/org/drafts", pattern: "/api/admin/org/drafts" });
    expect(faceOf("seat_terms", route)).toBe("role_card");
    expect(footprintOf("seat_terms", { roleId: "r-1" }, route, { words: { bonus: "x" } })).toEqual({ doc: "seat-terms:r-1", whole: false, fields: ["words.bonus"] });
  });
});

describe("the queue an agent reads", () => {
  const change = { id: "c-1", batchId: "b-1", kind: "variable" as const, summary: "Reply within ten days.", proposedBy: "u-lead", proposedByKind: "agent" as const };

  it("carries batch, id, kind, sentence, state and whether the reader filed it, and nothing else", () => {
    const item = queueItemOf({ ...change, status: "proposed", body: { value: "10" }, decidedBy: "u-x" } as any, "u-lead");
    expect(item).toEqual({ id: "c-1", batchId: "b-1", kind: "variable", summary: "Reply within ten days.", state: "waiting", stuck: false, yours: true });
  });

  it("reads three states, and what did not land still waits on a person", () => {
    expect(queueItemOf({ ...change, status: "accepted" }, "u-lead").state).toBe("accepted");
    expect(queueItemOf({ ...change, status: "discarded" }, "u-lead").state).toBe("discarded");
    expect(queueItemOf({ ...change, status: "failed" }, "u-lead")).toEqual(expect.objectContaining({ state: "waiting", stuck: true }));
    expect(queueItemOf({ ...change, status: "unknown" }, "u-lead")).toEqual(expect.objectContaining({ state: "waiting", stuck: true }));
  });

  it("is never yours when a person filed it in the app, or somebody else did", () => {
    expect(queueItemOf({ ...change, status: "proposed", proposedByKind: "person" }, "u-lead").yours).toBe(false);
    expect(queueItemOf({ ...change, status: "proposed" }, "u-other").yours).toBe(false);
  });
});

describe("what stays a person's", () => {
  it("money, seating and the proposals routes are still never proposed, and admin_request still never reaches the queue", () => {
    expect(neverProposed("POST", "/api/admin/payouts", {})?.key).toBe("money");
    expect(neverProposed("POST", "/api/admin/org/roles/r-1/holders", {})?.key).toBe("seating");
    expect(neverProposed("POST", "/api/admin/proposals/accept", {})?.key).toBe("agents");
    for (const p of ["/api/admin/proposals", "/api/admin/proposals/queue", "/api/admin/proposals/discard-mine"]) {
      expect(alwaysAPerson("GET", p)?.key, p).toBe("agents");
    }
  });
});
