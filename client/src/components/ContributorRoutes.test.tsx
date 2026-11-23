// @vitest-environment jsdom
/**
 * FOUR WAYS TO BUILD (the lead, 23 Nov 2026): one component, the same verbs everywhere, each card saying what you
 * bring, what you get back and when you hear, in the village's own days.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

let config: any = null;
let served = false;
vi.mock("@/lib/gameApi", () => ({ useGameConfig: () => config }));
vi.mock("@/lib/brochure", () => ({ useStoryPageShown: () => (href: string) => served && href === "/work-with-us" }));

import ContributorRoutes, { useFourWaysHeading } from "./ContributorRoutes";

afterEach(() => {
  cleanup();
  config = null;
  served = false;
});

function Headed() {
  return <ContributorRoutes heading={useFourWaysHeading()} />;
}

describe("the four cards", () => {
  it("draws the four in order, each with a line, what you bring, what you get back and the promise", () => {
    render(<ContributorRoutes />);
    const cards = Array.from(document.querySelectorAll("[data-route]"));
    expect(cards.map((c) => c.getAttribute("data-route"))).toEqual(["team", "venture", "partner", "quest"]);
    for (const c of cards) {
      expect(within(c as HTMLElement).getByText("You bring")).toBeTruthy();
      expect(within(c as HTMLElement).getByText("You get back")).toBeTruthy();
      expect(c.querySelector("[data-route-promise]")?.textContent).toBe("You'll hear within 14 days.");
    }
    expect(screen.getByRole("link", { name: "Join the team" }).getAttribute("href")).toBe("/roles");
    expect(screen.getByRole("link", { name: "Become a partner" }).getAttribute("href")).toBe("/partner");
    expect(screen.getByRole("link", { name: "Propose a quest" }).getAttribute("href")).toBe("/propose-quest");
    expect(screen.getByText("A partnership shaped together, with no role on the team and no lease.")).toBeTruthy();
  });

  it("promises the village's own days, and names the village in the heading", () => {
    config = { contributorReplyDays: 10, project: { name: "Riverbend" } };
    render(<Headed />);
    expect(screen.getByRole("heading", { level: 2, name: "Four ways to build Riverbend" })).toBeTruthy();
    expect(Array.from(document.querySelectorAll("[data-route-promise]")).map((p) => p.textContent)).toEqual(Array(4).fill("You'll hear within 10 days."));
  });

  it("CONTROL: with no name yet the heading says the village, and a bad number of days reads as 14", () => {
    config = { contributorReplyDays: 0, project: { name: "" } };
    render(<Headed />);
    expect(screen.getByRole("heading", { level: 2, name: "Four ways to build the village" })).toBeTruthy();
    expect(document.querySelector("[data-route-promise]")?.textContent).toBe("You'll hear within 14 days.");
  });

  it("starts a venture on the proposal form while the village serves it, and at the new-role door when it does not", () => {
    served = true;
    const { unmount } = render(<ContributorRoutes />);
    expect(screen.getByRole("link", { name: "Start a venture" }).getAttribute("href")).toBe("/work-with-us");
    unmount();
    served = false;
    render(<ContributorRoutes />);
    expect(screen.getByRole("link", { name: "Start a venture" }).getAttribute("href")).toBe("/role-proposals/new");
  });
});

describe("the other three, beside a role", () => {
  it("leaves out the one named, as a quiet list with one promise, and keeps a same-page anchor a plain link", () => {
    render(<ContributorRoutes variant="links" except={["team"]} heading="Don't see your gift in a role? Consider these:" />);
    expect(Array.from(document.querySelectorAll("[data-route-door]")).map((a) => a.getAttribute("data-route-door"))).toEqual(["venture", "partner", "quest"]);
    expect(screen.getByText("Don't see your gift in a role? Consider these:")).toBeTruthy();
    expect(screen.getAllByText("You'll hear within 14 days.")).toHaveLength(1);
    cleanup();
    render(<ContributorRoutes hrefs={{ team: "#open-now-heading" }} />);
    expect(screen.getByRole("link", { name: "Join the team" }).getAttribute("href")).toBe("#open-now-heading");
  });
});
