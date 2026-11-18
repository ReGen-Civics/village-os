/**
 * Propose putting it back: the proposal's shape, and where it is never offered (shared/proposalPutBack.ts).
 */
import { describe, expect, it } from "vitest";
import { heldAt, neverPutBack, putBackOf, putBackSummary, putBackVerdict, type PutBackSource } from "./proposalPutBack";

const src = (over: Partial<PutBackSource>): PutBackSource => ({
  id: "pc_1",
  kind: "variable",
  target: { key: "org.applicant_reply_days" },
  status: "accepted",
  accepted: { value: "10" },
  body: { value: "9" },
  before: { value: { value: 14 } },
  ...over,
});

describe("the put-back proposal", () => {
  it("is the same kind and target, carries the value live before, and names the change it puts back", () => {
    const r = putBackOf(src({}), "Promise a reply within ten days.");
    expect(r).toEqual({
      ok: true,
      proposal: {
        kind: "variable",
        target: { key: "org.applicant_reply_days" },
        body: { value: 14 },
        summary: "Put back what was live before: Promise a reply within ten days.",
        reverts: "pc_1",
      },
    });
  });

  it("sends exactly the fields the accepted change sent, at every depth, never the ones it left alone", () => {
    const r = putBackOf(
      src({
        kind: "page_content",
        target: { section: "page-home" },
        accepted: { hero: { headline: "New words" } },
        before: { value: { hero: { headline: "Welcome home", badge: "Open" }, footer: { note: "x" } } },
      }),
      "Reword the headline.",
    );
    expect(r.ok && r.proposal.body).toEqual({ hero: { headline: "Welcome home" } });
  });

  it("reads what was ACCEPTED (the person's edits), falling back to what was proposed", () => {
    const before = { value: { words: { aim: "Old aim", purpose: "Old purpose" } } };
    const edited = putBackOf(src({ kind: "role_card", target: { roleId: "r1" }, body: { words: { aim: "a" } }, accepted: { words: { aim: "b", purpose: "c" } }, before }), "s");
    expect(edited.ok && edited.proposal.body).toEqual({ words: { aim: "Old aim", purpose: "Old purpose" } });
    const plain = putBackOf(src({ kind: "role_card", target: { roleId: "r1" }, body: { words: { aim: "a" } }, accepted: null, before }), "s");
    expect(plain.ok && plain.proposal.body).toEqual({ words: { aim: "Old aim" } });
  });

  it("a list or a whole value is taken whole from before", () => {
    const r = putBackOf(src({ kind: "role_listing", target: {}, accepted: { ids: ["a"] }, before: { value: { ids: ["a", "b", "c"] } } }), "s");
    expect(r.ok && r.proposal.body).toEqual({ ids: ["a", "b", "c"] });
  });

  it("a field held as null before is held, and comes back as null", () => {
    expect(heldAt({ tagline: null }, { tagline: "Living together" })).toEqual({ ok: true, value: { tagline: null } });
  });

  it("the summary stays inside the limit", () => {
    expect(putBackSummary("x".repeat(500))).toHaveLength(400);
  });
});

describe("where it is never offered", () => {
  it("a change accepted before this release kept nothing", () => {
    expect(putBackVerdict(src({ before: null }))).toEqual({ can: false, reason: "not_kept" });
  });

  it("a read that found nothing is not a value to put back", () => {
    expect(putBackVerdict(src({ before: { value: null } }))).toEqual({ can: false, reason: "unread" });
  });

  it("only an accepted change", () => {
    for (const status of ["discarded", "failed", "proposed", "unknown"]) expect(putBackVerdict(src({ status }))).toEqual({ can: false, reason: "not_accepted" });
  });

  it("a field the change set that was not there before cannot be taken away by sending fields", () => {
    const r = putBackVerdict(src({ kind: "page_content", target: { section: "page-home" }, accepted: { hero: { headline: "x", badge: "New" } }, before: { value: { hero: { headline: "Old" } } } }));
    expect(r).toEqual({ can: false, reason: "added_fields" });
    expect(heldAt({ hero: { headline: "Old" } }, { hero: { headline: "x", badge: "New" } })).toEqual({ ok: false, missing: "hero.badge" });
  });

  it("a new calendar event, a new FAQ and any POSTed setting made something new", () => {
    expect(neverPutBack("setting", { method: "POST", path: "/api/admin/events" })).toBe("made_new");
    expect(neverPutBack("faq_add", { pathway: "steward" })).toBe("made_new");
    // Even with a value kept, the verdict holds.
    expect(putBackVerdict(src({ kind: "setting", target: { method: "POST", path: "/api/admin/events" }, accepted: { title: "Potluck" }, before: { value: { title: "Old" } } }))).toEqual({ can: false, reason: "made_new" });
  });

  it("an FAQ taken down and a DELETE took something away", () => {
    expect(neverPutBack("faq_remove", { pathway: "steward", id: "ste-1" })).toBe("took_away");
    expect(neverPutBack("setting", { method: "DELETE", path: "/api/admin/events/e1" })).toBe("took_away");
  });

  it("season goals, whose links ride on ids the kept value does not hold", () => {
    expect(neverPutBack("season_goals", { seasonId: "s1" })).toBe("goal_links");
  });

  it("the kinds that are offered", () => {
    for (const kind of ["role_card", "page_content", "faq_edit", "variable", "module_lifecycle", "module_config", "role_listing", "onboarding_path"] as const) expect(neverPutBack(kind, {})).toBeNull();
    expect(neverPutBack("setting", { method: "PUT", path: "/api/admin/brand" })).toBeNull();
    expect(neverPutBack("setting", { method: "PATCH", path: "/api/admin/events/e1" })).toBeNull();
  });
});
