// @vitest-environment jsdom
/**
 * The walkthrough on an application's page: the stage track, who acts next, one act per stage,
 * the references with their owners and notes, and the gathered view. It renders nothing for a
 * reader the door answers 404, and it ranks nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ONBOARDING_WORDS, TRACK, TRACK_WORDS } from "@shared/applicantOnboarding";

let served: { status: number; body: unknown } = { status: 404, body: {} };
let posts: Array<{ url: string; body: any }> = [];
vi.mock("@/lib/gameApi", () => ({
  gameFetch: async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      posts.push({ url, body: JSON.parse(String(init.body ?? "{}")) });
      return new Response(JSON.stringify({ success: true, message: "Done." }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify(served.body), { status: served.status, headers: { "content-type": "application/json" } });
  },
}));

import Walkthrough from "./Walkthrough";

const stages = (now: string) => TRACK.map((key, i) => ({ key, label: TRACK_WORDS[key], state: TRACK.indexOf(now as any) > i ? "done" : key === now ? "now" : "later" }));
const you = { mayShortlist: false, mayAskReferences: false, mayAddFinal: false, isFinalCall: false, holdsPower: false };
const walk = (over: Record<string, unknown> = {}) => ({
  walkthrough: {
    track: { stages: stages("review"), now: "review", who: "the holders of the power to place people in roles", next: "Shortlist this application, or say it is not shortlisted.", primary: "shortlist" },
    shortlist: null,
    references: { asked: false, given: false, list: [], total: 0, mayAssign: false },
    roles: [],
    members: [],
    scorecards: null,
    roleNames: { followup: "People and Operations", finalCall: "Lead Steward" },
    you,
    ...over,
  },
});

const REF = {
  id: 7,
  position: 1,
  name: "Ana Reference",
  contact: "ana@example.test",
  how: "We built a garden.",
  ally: "Runs the seed library.",
  owner: { roleId: "r-hr", roleName: "People and Operations", userId: null, userName: null, isDefault: true },
  notes: null,
  notesOn: null,
  followedUp: false,
  mine: false,
};

beforeEach(() => {
  posts = [];
});
afterEach(() => cleanup());

describe("the walkthrough", () => {
  it("renders nothing for a reader the door answers 404", async () => {
    served = { status: 404, body: { error: "not_found" } };
    const { container } = render(<Walkthrough applicationRef="op-0123456789abcdef0123" />);
    await new Promise((r) => setTimeout(r, 20));
    expect(container.innerHTML).toBe("");
  });

  it("draws every stage, says who acts next by role, and offers the one act: shortlist or not", async () => {
    served = { status: 200, body: walk({ you: { ...you, mayShortlist: true, holdsPower: true } }) };
    render(<Walkthrough applicationRef="op-0123456789abcdef0123" />);
    expect(await screen.findByRole("heading", { level: 2, name: ONBOARDING_WORDS.heading })).toBeTruthy();
    expect(document.querySelectorAll("[data-walk-stage]")).toHaveLength(TRACK.length);
    expect(document.querySelector('[data-walk-stage="review"]')?.getAttribute("aria-current")).toBe("step");
    expect(screen.getByText("the holders of the power to place people in roles")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: ONBOARDING_WORDS.primary.shortlist }));
    await screen.findByText("Done.");
    expect(posts).toEqual([{ url: "/api/governance/applications/op-0123456789abcdef0123/shortlist", body: { answer: "yes" } }]);
  });

  it("QA round 2: who acts next and the act come before the stage track, so the act is on a phone's first screen", async () => {
    served = { status: 200, body: walk({ you: { ...you, mayShortlist: true, holdsPower: true } }) };
    render(<Walkthrough applicationRef="op-0123456789abcdef0123" />);
    await screen.findByRole("heading", { level: 2, name: ONBOARDING_WORDS.heading });
    const next = document.querySelector("[data-walk-next]")!;
    const track = document.querySelector("[data-walk-track]")!;
    expect(next.compareDocumentPosition(track) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(next.querySelector("[data-walk-shortlist]")).toBeTruthy();
    // QA round 3: who acts, then the act, then what happens next; the intro waits below sm.
    const who = next.querySelector("[data-walk-who]")!;
    const act = next.querySelector("[data-walk-act]")!;
    const what = next.querySelector("[data-walk-what]")!;
    expect(who.compareDocumentPosition(act) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(act.compareDocumentPosition(what) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText(ONBOARDING_WORDS.intro).className.split(" ")).toEqual(expect.arrayContaining(["hidden", "sm:block"]));
    // The track is trail stones, the one you stand on gold, with every stage's name kept for a screen reader.
    expect(document.querySelector('[data-walk-stage="review"] .jw-stone')?.getAttribute("data-state")).toBe("here");
    expect(document.querySelector('[data-walk-stage="received"] .jw-stone')?.getAttribute("data-state")).toBe("done");
    for (const key of TRACK) expect(document.querySelector(`[data-walk-stage="${key}"]`)?.textContent).toContain(TRACK_WORDS[key]);
  });

  it("QA round 3: 'Go to the decision' is gold-edged when the decide panel and its gold act are on the page", async () => {
    served = { status: 200, body: walk({ track: { stages: stages("agreement"), now: "agreement", who: "the circle", next: "Decide.", primary: "decide" } }) };
    render(<Walkthrough applicationRef="op-0123456789abcdef0123" decideOnPage />);
    expect((await screen.findByRole("link", { name: ONBOARDING_WORDS.primary.decide })).getAttribute("data-walk-decide")).toBe("edged");
    // QA rounds 4 and 5: below md the floating panel holds Adopt and Decline, so the words point there; from md up
    // (no floating bar) the link shows.
    expect(screen.getByText(ONBOARDING_WORDS.decideBelow).className.split(" ")).toContain("md:hidden");
    expect(screen.getByRole("link", { name: ONBOARDING_WORDS.primary.decide }).parentElement?.className.split(" ")).toEqual(expect.arrayContaining(["hidden", "md:block"]));
    cleanup();
    // CONTROL: with no decide panel on the page, the link is the page's gold act.
    render(<Walkthrough applicationRef="op-0123456789abcdef0123" />);
    expect((await screen.findByRole("link", { name: ONBOARDING_WORDS.primary.decide })).getAttribute("data-walk-decide")).toBe("gold");
  });

  it("QA round 2: a bell's link to a part of the card lands there once the card has loaded", async () => {
    const seen: string[] = [];
    const was = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (this: Element) {
      seen.push(this.id);
    } as typeof was;
    window.history.replaceState(null, "", "#walk-heading");
    try {
      served = { status: 200, body: walk() };
      render(<Walkthrough applicationRef="op-0123456789abcdef0123" />);
      await screen.findByRole("heading", { level: 2, name: ONBOARDING_WORDS.heading });
      await new Promise((r) => setTimeout(r, 0));
      expect(seen).toEqual(["walk-heading"]);
      // QA round 4: the page grows after the jump, so it lands again once it settles...
      await new Promise((r) => setTimeout(r, 400));
      expect(seen).toEqual(["walk-heading", "walk-heading"]);
      // ...and never again once the reader has moved the page themselves.
      window.dispatchEvent(new Event("wheel"));
      await new Promise((r) => setTimeout(r, 700));
      expect(seen).toEqual(["walk-heading", "walk-heading"]);
    } finally {
      Element.prototype.scrollIntoView = was;
      window.history.replaceState(null, "", "#");
    }
  });

  it("a reader who may not shortlist sees the stage and no button", async () => {
    served = { status: 200, body: walk() };
    render(<Walkthrough applicationRef="op-0123456789abcdef0123" />);
    await screen.findByRole("heading", { level: 2, name: ONBOARDING_WORDS.heading });
    expect(screen.queryByRole("button", { name: ONBOARDING_WORDS.primary.shortlist })).toBeNull();
  });

  it("shows each reference with its default owner role, and the owner writes notes", async () => {
    served = {
      status: 200,
      body: walk({
        track: { stages: stages("references"), now: "references", who: "People and Operations and the other follow-up owners, and the conversation roles", next: "x", primary: "follow_up" },
        references: { asked: true, given: true, list: [{ ...REF, mine: true }], total: 1, mayAssign: false },
      }),
    };
    render(<Walkthrough applicationRef="op-0123456789abcdef0123" />);
    expect(await screen.findByText("ana@example.test")).toBeTruthy();
    expect(screen.getByText(ONBOARDING_WORDS.ownerDefault("People and Operations"))).toBeTruthy();
    fireEvent.change(screen.getByLabelText(ONBOARDING_WORDS.notes), { target: { value: "Called her." } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: ONBOARDING_WORDS.notesSave }));
    await screen.findByText("Done.");
    expect(posts).toEqual([{ url: "/api/governance/applications/op-0123456789abcdef0123/references/7/notes", body: { notes: "Called her.", followedUp: true } }]);
  });

  it("QA round 5: at our review the founder's 'Go to our review' shows at every width, and never says 'Adopt or decline below'", async () => {
    for (const now of ["received", "review"] as const) {
      served = { status: 200, body: walk({ track: { stages: stages(now), now, who: "the holders of the power to place people in roles", next: "Read it.", primary: "review" } }) };
      render(<Walkthrough applicationRef="op-0123456789abcdef0123" decideOnPage />);
      const link = await screen.findByRole("link", { name: ONBOARDING_WORDS.primary.review });
      // Gold-edged beside the panel's own gold act, and nothing hides it at any width.
      expect(link.getAttribute("data-walk-decide")).toBe("edged");
      for (let el: HTMLElement | null = link; el && !el.hasAttribute("data-walkthrough"); el = el.parentElement) {
        expect(el.className.split(" ").filter((c) => /(^|:)hidden$/.test(c)), `${now}: ${el.tagName}`).toEqual([]);
      }
      expect(screen.queryByText(ONBOARDING_WORDS.decideBelow)).toBeNull();
      cleanup();
    }
  });

  it("QA round 4: a section reads a kicker, one line of privacy with the rest behind a disclosure, and the follow-up day in words", async () => {
    served = {
      status: 200,
      body: walk({
        track: { stages: stages("references"), now: "references", who: "People and Operations", next: "x", primary: "follow_up" },
        references: { asked: true, given: true, list: [{ ...REF, notes: "Called her.", notesOn: "2026-11-27", followedUp: true }], total: 1, mayAssign: false },
      }),
    };
    render(<Walkthrough applicationRef="op-0123456789abcdef0123" />);
    const section = (await screen.findByText(ONBOARDING_WORDS.referencesHeading)).closest("[data-walk-references]")!;
    expect(section.textContent).toContain(ONBOARDING_WORDS.referencesKicker);
    const note = section.querySelector("[data-privacy-note]")!;
    expect(note.querySelector("p")?.textContent).toBe(ONBOARDING_WORDS.referencesShort);
    // The long words are kept, behind "Who reads these".
    expect(note.querySelector("details summary")?.textContent).toBe(ONBOARDING_WORDS.whoReads);
    expect(note.querySelector("details")?.textContent).toContain(ONBOARDING_WORDS.referencesPrivate);
    expect(section.textContent).toContain("November 27, 2026");
    expect(section.textContent).not.toContain("(2026-11-27)");
  });

  it("gathers the notes and the scorecards, as written, for the final call", async () => {
    served = {
      status: 200,
      body: walk({
        track: { stages: stages("agreement"), now: "agreement", who: "Lead Steward", next: "x", primary: "decide" },
        references: { asked: true, given: true, list: [{ ...REF, notes: "Warm and keen.", followedUp: true }], total: 1, mayAssign: false },
        scorecards: {
          criteria: [{ id: "c1", text: "Keeps the pace" }],
          mayRead: true,
          interviews: [{ position: 1, roleName: "Channel Role", minutes: 30, final: false, state: "scored", entries: [{ criterionId: "c1", level: "solid", evidence: "Heard it." }], gut: { answer: "yes", note: "" } }],
        },
        you: { ...you, isFinalCall: true },
      }),
    };
    render(<Walkthrough applicationRef="op-0123456789abcdef0123" />);
    expect(await screen.findByText(ONBOARDING_WORDS.gatheredHeading)).toBeTruthy();
    const gathered = document.querySelector("[data-walk-gathered]")!;
    expect(gathered.textContent).toContain("Warm and keen.");
    expect(gathered.textContent).toContain("Keeps the pace");
    expect(gathered.textContent).toContain("Heard it.");
    // Nothing is totalled: no count of levels or answers is drawn.
    expect(gathered.textContent).not.toMatch(/\b\d+\s*(points|score|total)/i);
    expect(screen.getByRole("link", { name: ONBOARDING_WORDS.primary.decide }).getAttribute("href")).toBe("#op-decide-panel");
  });
});
