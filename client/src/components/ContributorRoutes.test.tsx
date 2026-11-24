// @vitest-environment jsdom
/**
 * FOUR WAYS TO BUILD (the lead, 23 Nov 2026): one component, the same verbs everywhere, each card saying what you
 * bring and what you get back, and the village's one reply promise said once under the group. Join the team and Start
 * a venture land on the founding team and the open ventures of /roles: scrolled to on /roles, linked from elsewhere.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

let config: any = null;
let served = false;
vi.mock("@/lib/gameApi", () => ({ useGameConfig: () => config }));
vi.mock("@/lib/brochure", () => ({ useStoryPageShown: () => (href: string) => served && href === "/work-with-us" }));

import ContributorRoutes, { StartVentureButton, useFourWaysHeading } from "./ContributorRoutes";

afterEach(() => {
  cleanup();
  config = null;
  served = false;
});

function Headed() {
  return <ContributorRoutes heading={useFourWaysHeading()} />;
}

describe("the four cards", () => {
  it("draws the four in order, each with a line, what you bring and what you get back, and the promise once under them", () => {
    served = true;
    render(<ContributorRoutes />);
    const cards = Array.from(document.querySelectorAll("[data-route]"));
    expect(cards.map((c) => c.getAttribute("data-route"))).toEqual(["team", "venture", "partner", "quest"]);
    for (const c of cards) {
      expect(within(c as HTMLElement).getByText("You bring")).toBeTruthy();
      expect(within(c as HTMLElement).getByText("You get back")).toBeTruthy();
      expect(c.querySelector("[data-route-promise]")).toBeNull();
    }
    // One promise for the group, the village's one reply number (org.applicant_reply_days, 7 by default).
    expect(Array.from(document.querySelectorAll("[data-route-promise]")).map((p) => p.textContent)).toEqual(["You'll hear within 7 days."]);
    // Compensation for a role; "rewarded" is for quests only.
    expect(within(cards[0] as HTMLElement).getByText("The compensation the role's terms set out, agreed together.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Join the team" }).getAttribute("href")).toBe("/roles#founding-team");
    // Start a venture lands on the proposal form set up for a venture (the lead, 24 Nov 2026).
    expect(screen.getByRole("link", { name: "Start a venture" }).getAttribute("href")).toBe("/work-with-us?kind=venture");
    expect(screen.getByRole("link", { name: "Become a partner" }).getAttribute("href")).toBe("/partner");
    expect(screen.getByRole("link", { name: "Propose a quest" }).getAttribute("href")).toBe("/propose-quest");
    expect(screen.getByText("A partnership shaped together, with no role on the team and no lease.")).toBeTruthy();
  });

  it("promises the village's own days, and names the village in the heading", () => {
    config = { applicantReplyDays: 10, project: { name: "Riverbend" } };
    render(<Headed />);
    expect(screen.getByRole("heading", { level: 2, name: "Four ways to build Riverbend" })).toBeTruthy();
    expect(Array.from(document.querySelectorAll("[data-route-promise]")).map((p) => p.textContent)).toEqual(["You'll hear within 10 days."]);
  });

  it("CONTROL: with no name yet the heading says the village, and a bad number of days reads as the default 7", () => {
    config = { applicantReplyDays: 0, project: { name: "" } };
    render(<Headed />);
    expect(screen.getByRole("heading", { level: 2, name: "Four ways to build the village" })).toBeTruthy();
    expect(document.querySelector("[data-route-promise]")?.textContent).toBe("You'll hear within 7 days.");
  });

  it("leaves the promise out where the page already makes its own", () => {
    render(<ContributorRoutes variant="links" except={["team"]} promise={false} />);
    expect(document.querySelector("[data-route-promise]")).toBeNull();
  });

  it("pitches a venture from the Open ventures button on the proposal form while the village serves it, else at the new-role door", () => {
    served = true;
    const { unmount } = render(<StartVentureButton />);
    expect(screen.getByRole("link", { name: "Start a venture" }).getAttribute("href")).toBe("/work-with-us?kind=venture");
    unmount();
    served = false;
    render(<StartVentureButton />);
    expect(screen.getByRole("link", { name: "Start a venture" }).getAttribute("href")).toBe("/role-proposals/new");
  });
});

describe("Start a venture lands on the venture form (the lead, 24 Nov 2026)", () => {
  const ventureHref = () => document.querySelector('[data-route-door="venture"]')?.getAttribute("href");

  it("sends every list and card to /work-with-us?kind=venture: the home page's cards, the thank-you pages' lists, the founding register", () => {
    served = true;
    for (const el of [
      <ContributorRoutes key="cards" />,
      <ContributorRoutes key="gift" except={["team"]} heading="Don't see your gift in a role? Consider these:" />,
      <ContributorRoutes key="links" variant="links" except={["team"]} />,
      <ContributorRoutes key="founding" variant="links" register="founding" except={["team"]} promise={false} />,
    ]) {
      render(el);
      expect(ventureHref()).toBe("/work-with-us?kind=venture");
      cleanup();
    }
  });

  it("keeps the compact tile at the top of /roles scrolling to the open ventures, and a page's own href still wins", () => {
    served = true;
    render(<ContributorRoutes variant="tiles" />);
    expect(ventureHref()).toBe("/roles#open-ventures");
    cleanup();
    render(<ContributorRoutes variant="tiles" hrefs={{ venture: "/work-with-us?kind=venture" }} />);
    expect(ventureHref()).toBe("/work-with-us?kind=venture");
  });

  it("CONTROL: a village that switched the proposal page off sends a venture to the new-role door, never a page it hid", () => {
    render(<ContributorRoutes variant="links" except={["team"]} />);
    expect(ventureHref()).toBe("/role-proposals/new");
  });
});

describe("the compact tiles, the application's register and the nonprofit line", () => {
  it("draws the tiles with the verb and a few words only, no promise", () => {
    render(<ContributorRoutes variant="tiles" />);
    expect(Array.from(document.querySelectorAll("[data-route-door]")).map((a) => a.textContent)).toEqual([
      "Join the teamA role on the team, with its own terms.",
      "Start a ventureYour own business on the land.",
      "Become a partnerPartner with us, thrive together.",
      "Propose a questA one-off piece of work, rewarded.",
    ]);
    expect(document.querySelector("[data-route-promise], dt")).toBeNull();
  });

  it("calls the quest route a one-off piece of work in the founding register, with the same link", () => {
    render(<ContributorRoutes variant="links" register="founding" except={["team"]} />);
    const quest = document.querySelector('[data-route-door="quest"]') as HTMLElement;
    expect(quest.textContent).toMatch(/^Offer a one-off piece of work/);
    expect(quest.getAttribute("href")).toBe("/propose-quest");
    expect(document.body.textContent).not.toMatch(/\bquest/i);
  });

  it("says on the partner card that local nonprofits can partner, profits included", () => {
    render(<ContributorRoutes />);
    const notes = Array.from(document.querySelectorAll("[data-route-note]"));
    expect(notes.map((n) => n.closest("[data-route]")?.getAttribute("data-route"))).toEqual(["partner"]);
    expect(notes[0].textContent).toBe("Local nonprofits can partner with the village too, including to share in its profits.");
  });
});

describe("the other three, beside a role", () => {
  it("leaves out the one named, as a quiet list with one promise, and keeps a same-page anchor a plain link", () => {
    render(<ContributorRoutes variant="links" except={["team"]} heading="Don't see your gift in a role? Consider these:" />);
    expect(Array.from(document.querySelectorAll("[data-route-door]")).map((a) => a.getAttribute("data-route-door"))).toEqual(["venture", "partner", "quest"]);
    expect(screen.getByText("Don't see your gift in a role? Consider these:")).toBeTruthy();
    expect(screen.getAllByText("You'll hear within 7 days.")).toHaveLength(1);
    cleanup();
    render(<ContributorRoutes hrefs={{ team: "/roles/select" }} />);
    expect(screen.getByRole("link", { name: "Join the team" }).getAttribute("href")).toBe("/roles/select");
  });
});

describe("the in-page anchors on /roles", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    window.history.replaceState(null, "", "/");
  });

  it("scrolls Join the team and Start a venture down the page, focuses the section's heading and keeps the address", () => {
    window.history.replaceState(null, "", "/roles");
    const scrolled: string[] = [];
    Element.prototype.scrollIntoView = function (this: Element, opts?: ScrollIntoViewOptions | boolean) {
      scrolled.push(`${this.id}:${typeof opts === "object" ? opts.behavior : ""}`);
    } as typeof Element.prototype.scrollIntoView;
    render(
      <>
        <ContributorRoutes variant="tiles" />
        <section id="founding-team">
          <h1 data-section-focus="" tabIndex={-1}>Join the founding team</h1>
        </section>
        <section id="open-ventures">
          <h2 data-section-focus="" tabIndex={-1}>Open ventures</h2>
        </section>
      </>,
    );
    const team = document.querySelector('[data-route-door="team"]') as HTMLAnchorElement;
    expect(team.getAttribute("href")).toBe("#founding-team");
    fireEvent.click(team);
    expect(scrolled).toEqual(["founding-team:smooth"]);
    expect(document.activeElement?.textContent).toBe("Join the founding team");
    expect(window.location.pathname + window.location.hash).toBe("/roles#founding-team");
    fireEvent.click(document.querySelector('[data-route-door="venture"]') as HTMLElement);
    expect(scrolled[1]).toBe("open-ventures:smooth");
    expect(document.activeElement?.textContent).toBe("Open ventures");
    // Partner and quest still leave for their own pages.
    expect(document.querySelector('[data-route-door="partner"]')?.getAttribute("href")).toBe("/partner");
  });

  it("scrolls at once when the reader asks for less motion, and focuses a section with no marked heading", () => {
    window.history.replaceState(null, "", "/roles");
    const mm = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
    const seen: unknown[] = [];
    Element.prototype.scrollIntoView = function (opts?: ScrollIntoViewOptions | boolean) {
      seen.push(typeof opts === "object" ? opts.behavior : opts);
    } as typeof Element.prototype.scrollIntoView;
    render(
      <>
        <ContributorRoutes variant="tiles" />
        <section id="founding-team" />
      </>,
    );
    fireEvent.click(document.querySelector('[data-route-door="team"]') as HTMLElement);
    expect(seen).toEqual(["auto"]);
    expect(document.activeElement?.id).toBe("founding-team");
    window.matchMedia = mm;
  });
});
