// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import OrgPreview from "./OrgPreview";

const circles = [{ id: "anchor", name: "Anchor Circle" }];
const seats = [
  { id: "finance", circleId: "anchor", seats: 1, holderCount: 0 },
  { id: "ops", circleId: "anchor", seats: 1, holderCount: 1 },
];
const counts = { circleId: "anchor", circleName: "Anchor Circle", held: 1, open: 1 };

const screenIs = (wide: boolean) =>
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: wide, media: q, addEventListener: () => {}, removeEventListener: () => {} }));

const draw = () =>
  render(<OrgPreview circles={circles} seats={seats} counts={counts} />);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the org chart beside the roster (Rye, 16 Nov 2026: a picture in picture of /circles)", () => {
  it("on a wide screen draws the live /circles picture as one link into /circles, the counts read aloud", async () => {
    screenIs(true);
    const { container } = draw();
    const door = await screen.findByRole("link", { name: "Open the circles. Anchor Circle: 1 held, 1 open." });
    expect(door.getAttribute("href")).toBe("/circles");
    expect(door.querySelector("svg")).toBeTruthy();
    expect(container.querySelector("[data-org-chart-tile]")?.textContent).toContain("The org chart");
    // One door: the tile holds no second link.
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
  it("on a phone gives one tappable row with the same counts, and no drawing to squint at", () => {
    screenIs(false);
    const { container } = draw();
    const door = screen.getByRole("link", { name: /See the org chart/ });
    expect(door.getAttribute("href")).toBe("/circles");
    expect(door.textContent).toContain("Anchor Circle: 1 held, 1 open");
    expect(container.querySelector("[data-org-chart-tile]")).toBeNull();
  });
  it("draws nothing with no circles to show", () => {
    screenIs(true);
    const { container } = render(<OrgPreview circles={[]} seats={[]} counts={counts} />);
    expect(container.innerHTML).toBe("");
  });
});
