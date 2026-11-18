/**
 * The `session_agenda` kind of a proposed change, pure: filing reads its shape,
 * the never rules let its one door through and nothing else under /api/sessions,
 * the review page reads it as a meeting's agenda, each item becomes the body the
 * member's own door takes, and the connector reads a circle's meetings while a
 * write to the agenda stays refused.
 */
import { describe, expect, it } from "vitest";
import { agendaItemBody, readProposedAgenda } from "./sessionAgendaProposal";
import { proposalNever, readProposalInput, routeOf } from "./proposedChanges";
import { agendaLines, faceOf } from "./proposalReview";
import { neverPutBack } from "./proposalPutBack";
import { adminRequestDecision, DEFAULT_AGENT_ADMIN_PATHS } from "./agentAdmin";

const target = { circleId: "c-anchor", rhythmKey: "main" };

describe("filing a proposed agenda", () => {
  it("reads target {circleId, rhythmKey?} and body {items: [{title, detail?, kind, ownerRole?}]}", () => {
    const read = readProposedAgenda(target, { items: [{ title: "  Adopt the\nwater agreement ", kind: "consent", detail: "Draft attached.", ownerRole: "Water Steward" }] });
    expect(read).toEqual({
      ok: true,
      value: { circleId: "c-anchor", rhythmKey: "main", items: [{ title: "Adopt the water agreement", detail: "Draft attached.", kind: "consent", ownerRole: "Water Steward" }] },
    });
    expect(readProposedAgenda({ circleId: "c-anchor" }, { items: [{ title: "A", kind: "discussion" }] })).toMatchObject({ ok: true, value: { rhythmKey: null } });
  });

  it("refuses each broken part with its field", () => {
    expect(readProposedAgenda({}, { items: [{ title: "A", kind: "decision" }] })).toMatchObject({ ok: false, field: "target.circleId" });
    expect(readProposedAgenda({ circleId: "c", rhythmKey: "Not A Key" }, { items: [{ title: "A", kind: "decision" }] })).toMatchObject({ ok: false, field: "target.rhythmKey" });
    expect(readProposedAgenda(target, { items: [] })).toMatchObject({ ok: false, field: "items" });
    expect(readProposedAgenda(target, { items: Array.from({ length: 21 }, () => ({ title: "A", kind: "decision" })) })).toMatchObject({ ok: false, field: "items" });
    expect(readProposedAgenda(target, { items: [{ title: " ", kind: "decision" }] })).toMatchObject({ ok: false, field: "items.0.title" });
    expect(readProposedAgenda(target, { items: [{ title: "A", kind: "decision" }, { title: "B", kind: "vote" }] })).toMatchObject({ ok: false, field: "items.1.kind" });
    expect(readProposedAgenda(target, { items: [{ title: "A", kind: "decision", detail: "x".repeat(20_000) }] })).toMatchObject({ ok: false, field: "items.0.detail" });
  });

  it("is a kind the connector may file, through the member's own door, which no never rule refuses", () => {
    const input = readProposalInput({ kind: "session_agenda", target, body: { items: [{ title: "A", kind: "decision" }] }, summary: "Put A on Thursday." });
    expect(input.ok).toBe(true);
    const p = (input as { ok: true; value: Parameters<typeof proposalNever>[0] }).value;
    expect(routeOf(p.kind, p.target)).toMatchObject({ method: "POST", path: "/api/sessions/library" });
    expect(proposalNever(p)).toBeNull();
    // Every other path under sessions still reads as a sign-in session, and is never proposed.
    expect(proposalNever({ kind: "setting", target: { method: "POST", path: "/api/admin/sessions/revoke" }, body: {}, summary: "x" })?.key).toBe("secrets");
    expect(proposalNever({ kind: "setting", target: { method: "PUT", path: "/api/sessions/library" }, body: {}, summary: "x" })?.key).toBe("secrets");
  });
});

describe("accepting a proposed agenda", () => {
  it("adds each item through the member's door with its aim, its note and its meeting", () => {
    const read = readProposedAgenda(target, { items: [{ title: "Water", kind: "consent", detail: "Draft attached.", ownerRole: "Water Steward" }, { title: "Guests", kind: "discussion" }] });
    if (!read.ok) throw new Error(read.error);
    expect(read.value.items.map((it) => agendaItemBody(read.value, it))).toEqual([
      { title: "Water", aim: "decide", note: "For consent.\n\nOwner role: Water Steward.\n\nDraft attached.", circleId: "c-anchor", rhythmKey: "main" },
      { title: "Guests", aim: "explore", note: "For discussion.", circleId: "c-anchor", rhythmKey: "main" },
    ]);
    // With no meeting named, the items wait for the circle's next meeting, as a member's own item does.
    expect(agendaItemBody({ circleId: "c-anchor", rhythmKey: null }, read.value.items[1])).not.toHaveProperty("rhythmKey");
  });

  it("is never put back: it made something new", () => {
    expect(neverPutBack("session_agenda", target)).toBe("made_new");
  });
});

describe("the review page", () => {
  it("reads it as a meeting's agenda, listing the items as the person would accept them", () => {
    expect(faceOf("session_agenda", { method: "POST", path: "/api/sessions/library" })).toBe("meeting_agenda");
    expect(agendaLines({ items: [{ title: " Water ", kind: "consent", ownerRole: "Water Steward" }, "junk"] })).toEqual([
      { title: "Water", kind: "consent", detail: "", ownerRole: "Water Steward" },
      { title: "", kind: "", detail: "", ownerRole: "" },
    ]);
    expect(agendaLines({})).toEqual([]);
  });
});

describe("the connector and a circle's meetings", () => {
  const empty = { paths: [] };
  it("reads the coming meetings and one circle's summary, whatever the village's list holds", () => {
    for (const doc of [empty, DEFAULT_AGENT_ADMIN_PATHS]) {
      expect(adminRequestDecision("GET", "/api/sessions", doc)).toMatchObject({ ok: true, write: false });
      expect(adminRequestDecision("GET", "/api/sessions/circles/c-anchor/summary", doc)).toMatchObject({ ok: true, write: false });
    }
  });

  it("never writes to them: the agenda, a rhythm or a skip", () => {
    expect(adminRequestDecision("POST", "/api/sessions/library", empty)).toMatchObject({ ok: false, code: "not_allowed" });
    expect(adminRequestDecision("PUT", "/api/sessions/circles/c-anchor/rhythm", empty)).toMatchObject({ ok: false });
    expect(adminRequestDecision("POST", "/api/sessions", empty)).toMatchObject({ ok: false });
    expect(adminRequestDecision("GET", "/api/sessions/7", empty)).toMatchObject({ ok: false, code: "not_allowed" });
  });
});
