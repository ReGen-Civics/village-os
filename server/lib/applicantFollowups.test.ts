/**
 * The applicant follow-ups' server side, with the repositories stubbed so it runs without a database:
 *  - the new-invitation ask tells the holders with one stable key per application and holder, falls back
 *    to the admins, and NEVER makes an invitation (no invite write is reachable from here);
 *  - the closed letter goes through the post office under one key per application, so a second run is
 *    the post office's duplicate and never a second letter;
 *  - the quiet close stamps the review's decided step as withdrawn and quiet, only where a review began.
 * The SQL itself (the JSON_SET guard, the per-id close) is covered by the database suites when
 * TEST_DATABASE_URL is set.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  proposal: null as any,
  invite: null as any,
  askedAt: null as Date | null,
  noted: [] as string[],
  steps: new Map<string, Array<{ kind: string }>>(),
  stamped: [] as Array<{ ref: string; kind: string; detail: unknown }>,
}));

vi.mock("../repos/openProposals", () => ({
  readOpenProposal: async () => state.proposal,
  newInvitationAskedOf: async () => state.askedAt,
  noteNewInvitationAsked: async (_db: unknown, id: string, at: Date) => {
    state.noted.push(id);
    if (state.askedAt) return false;
    state.askedAt = at;
    return true;
  },
}));
vi.mock("../repos/memberInvites", () => ({
  inviteById: async () => state.invite,
}));
vi.mock("../repos/applicationReview", () => ({
  roleNamesById: async (_db: unknown, ids: string[]) => new Map(ids.map((id) => [id, id === "r-gate" ? "Gate Keeper" : id === "r-host" ? "Welcome Host" : id])),
  stepsOf: async (_db: unknown, ref: string) => state.steps.get(ref) ?? [],
  stampStep: async (_db: unknown, s: { ref: string; kind: string; detail: unknown }) => {
    state.stamped.push({ ref: s.ref, kind: s.kind, detail: s.detail });
    return true;
  },
}));
vi.mock("./comms/links", () => ({ signLink: () => "signed" }));

import { askForNewInvitation, closedEmailFor, closedLetterKey, invitationDoorOf, sendClosedLetters, stampQuietClose } from "./applicantFollowups";
import * as followups from "./applicantFollowups";

const pool = {} as any;
const adopted = { id: "op_1", status: "adopted", email: "ana@example.test", name: "Ana Lopez", body: { roles: [{ roleId: "r-gate", note: "" }], why: "", aim: "" } };
const expired = { id: "inv-op_1", usedByUserId: null, revokedAt: null, expired: true };

function askDeps(rule: any) {
  const notices: any[] = [];
  const admins: any[] = [];
  return {
    notices,
    admins,
    deps: {
      getPool: () => pool,
      notify: async (n: any) => void notices.push(n),
      notifyAdmins: async (type: string, title: string, key: string, link?: string) => void admins.push({ type, title, key, link }),
      now: () => new Date("2026-11-15T12:00:00Z"),
      rule: async () => rule,
    },
  };
}

beforeEach(() => {
  state.proposal = { ...adopted };
  state.invite = { ...expired };
  state.askedAt = null;
  state.noted = [];
  state.steps = new Map();
  state.stamped = [];
});

describe("the new-invitation door", () => {
  it("shows only for an adopted proposal whose invitation expired unused and was never withdrawn", async () => {
    expect(await invitationDoorOf(pool, adopted as any)).toBe("expired");
    state.invite = { ...expired, expired: false };
    expect(await invitationDoorOf(pool, adopted as any)).toBe("none");
    state.invite = { ...expired, usedByUserId: "u1" };
    expect(await invitationDoorOf(pool, adopted as any)).toBe("none");
    state.invite = { ...expired, revokedAt: new Date() };
    expect(await invitationDoorOf(pool, adopted as any)).toBe("none");
    state.invite = null;
    expect(await invitationDoorOf(pool, adopted as any)).toBe("none");
    state.invite = { ...expired };
    expect(await invitationDoorOf(pool, { ...adopted, status: "declined" } as any)).toBe("none");
    // Anonymised: no address to send a new one to.
    expect(await invitationDoorOf(pool, { ...adopted, email: null } as any)).toBe("none");
    state.askedAt = new Date();
    expect(await invitationDoorOf(pool, adopted as any)).toBe("asked");
  });

  it("tells each live holder once, by a stable key per application and holder, with the role names and no person", async () => {
    const { deps, notices } = askDeps({ who: "live-holders", because: "a-role-holds-it", holders: ["h1", "h2"] });
    expect(await askForNewInvitation(deps, "op_1")).toEqual({ ok: true, door: "asked" });
    expect(await askForNewInvitation(deps, "op_1")).toEqual({ ok: true, door: "asked" });
    expect(notices.map((n) => n.dedupeKey)).toEqual([
      "open-proposal:op_1:new-invitation-asked:h1",
      "open-proposal:op_1:new-invitation-asked:h2",
      "open-proposal:op_1:new-invitation-asked:h1",
      "open-proposal:op_1:new-invitation-asked:h2",
    ]);
    // The same key twice is the notify spine's no-op: each holder hears it once.
    expect(new Set(notices.map((n) => n.dedupeKey)).size).toBe(2);
    expect(notices[0]).toMatchObject({ type: "application_new_invitation_asked", link: "/open-proposals/op_1", actorUserId: null });
    expect(notices[0].title).toContain("Gate Keeper");
    expect(notices[0].title).not.toContain("Ana");
    expect(state.askedAt).not.toBeNull();
  });

  it("with no live holder, the admins hear it under one key", async () => {
    const { deps, admins, notices } = askDeps({ who: "any-member", because: "village-holds-it", holders: [] });
    await askForNewInvitation(deps, "op_1");
    expect(notices).toEqual([]);
    expect(admins).toEqual([expect.objectContaining({ type: "application_new_invitation_asked", key: "open-proposal:op_1:new-invitation-asked" })]);
  });

  it("refuses when there is nothing expired to ask about, and tells nobody", async () => {
    const { deps, notices } = askDeps({ who: "live-holders", because: "a-role-holds-it", holders: ["h1"] });
    state.invite = { ...expired, expired: false };
    expect(await askForNewInvitation(deps, "op_1")).toEqual({ ok: false, status: 409 });
    state.proposal = null;
    expect(await askForNewInvitation(deps, "op_1")).toEqual({ ok: false, status: 404 });
    expect(notices).toEqual([]);
    expect(state.noted).toEqual([]);
  });

  it("makes no invitation: nothing in this module can write one", () => {
    expect(Object.keys(followups).sort()).toEqual(["askForNewInvitation", "closedEmailFor", "closedLetterKey", "invitationDoorOf", "sendClosedLetters", "stampQuietClose"]);
  });
});

describe("the closed letter", () => {
  const closing = (statuses: string[] = ["sent"]) => {
    const sent: any[] = [];
    return {
      sent,
      deps: {
        postEmail: async (e: any) => {
          sent.push(e);
          return { status: (statuses.shift() ?? "duplicate") as any, messageId: null };
        },
        projectName: () => "Test Village",
        siteUrl: () => "https://x.test/",
        onboardingRole: () => "r-host",
      },
    };
  };
  const confirmed = { ...adopted, status: "confirmed", body: { ...adopted.body, locale: "en" } };

  it("goes as one essential letter keyed per application, signed by the village's team (QA round 4: never a role's)", async () => {
    const { deps } = closing();
    const e = await closedEmailFor(pool, deps, confirmed as any);
    expect(e).toMatchObject({ idempotencyKey: closedLetterKey("op_1"), kind: "essential", origin: "open_proposal.closed", to: { email: "ana@example.test", name: "Ana" } });
    expect(e!.text).toContain("Gate Keeper");
    expect(e!.text).toContain("https://x.test/quests");
    expect(e!.text).toContain("The Test Village team");
    expect(e!.text).not.toContain("The Welcome Host team");
    expect(e!.text).not.toMatch(/\b90\b/);
  });

  it("has one hook for the shared come-and-play block: its html and text go under the letter's words", async () => {
    const { deps } = closing();
    const e = await closedEmailFor(pool, { ...deps, footer: () => ({ html: "<div data-come-and-play></div>", text: "COME AND PLAY" }) }, confirmed as any);
    expect(e!.html).toContain("<div data-come-and-play></div>");
    expect(e!.text.indexOf("COME AND PLAY")).toBeGreaterThan(e!.text.indexOf("The Test Village team"));
    const plain = await closedEmailFor(pool, deps, confirmed as any);
    expect(plain!.text).not.toContain("COME AND PLAY");
  });

  it("with no welcoming role, the village's name signs", async () => {
    const { deps } = closing();
    const e = await closedEmailFor(pool, { ...deps, onboardingRole: () => "" }, confirmed as any);
    expect(e!.text).toContain("The Test Village team");
  });

  it("a second run sends under the same key, which the post office answers as a duplicate: one letter", async () => {
    const { deps, sent } = closing(["sent", "duplicate"]);
    expect(await sendClosedLetters(pool, deps, [confirmed as any])).toBe(1);
    await sendClosedLetters(pool, deps, [confirmed as any]);
    expect(sent.map((e) => e.idempotencyKey)).toEqual([closedLetterKey("op_1"), closedLetterKey("op_1")]);
  });

  it("no address, nothing sent; a failed send is counted out and never throws", async () => {
    const { deps, sent } = closing(["failed"]);
    expect(await sendClosedLetters(pool, deps, [{ ...confirmed, email: null } as any])).toBe(0);
    expect(sent).toEqual([]);
    expect(await sendClosedLetters(pool, deps, [confirmed as any])).toBe(0);
    const throwing = { ...deps, postEmail: async () => { throw new Error("down"); } };
    await expect(sendClosedLetters(pool, throwing as any, [confirmed as any])).resolves.toBe(0);
  });
});

describe("the quiet close", () => {
  it("stamps decided as withdrawn and quiet where the review began, and skips the rest", async () => {
    state.steps.set("op_1", [{ kind: "confirmed" }]);
    await stampQuietClose(pool, ["op_1", "op_old"], new Date());
    expect(state.stamped).toEqual([{ ref: "op_1", kind: "decided", detail: { how: "withdrawn", quiet: true } }]);
  });
});
