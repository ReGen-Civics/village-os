// @vitest-environment jsdom
/**
 * COMING SOON ON THE CARD (Rye, 16 Nov 2026). Every host of the live role
 * card (/roles, /circles, the map) draws its action through `guardedAction`,
 * so a coming-soon seat shows a disabled "Coming soon" there, and the Apply
 * link is never built. The badge draws only on a seat the server flagged.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ComingSoonChip } from "./ComingSoon";
import { applyHrefFor, guardedAction } from "./power/SeatTermsSlot";
import { mayApply } from "./roleCard/FullRoleCard";

const APPLY = <a href="/apply">Apply</a>;
const seat = (over: Record<string, unknown> = {}) => ({ id: "r-weaver", name: "Community Weaver", state: "open", termsOffer: null, card: {}, ...over });

describe("a coming-soon seat on the card", () => {
  it("draws a disabled Coming soon where Apply would be, and builds no Apply link", () => {
    render(<div>{guardedAction(seat({ comingSoon: true, state: "forming" }), APPLY)}</div>);
    const button = screen.getByRole("button", { name: "Coming soon" });
    expect(button).toHaveProperty("disabled", true);
    expect(screen.getByText("This role opens later. Applications are not taken yet.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Apply" })).toBeNull();
    expect(applyHrefFor(seat({ comingSoon: true }))).toBeNull();
    expect(mayApply(seat({ comingSoon: true }))).toBe(false);
  });

  it("CONTROL: a plain seat keeps its Apply", () => {
    render(<div>{guardedAction(seat(), APPLY)}</div>);
    expect(screen.getByRole("link", { name: "Apply" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Coming soon" })).toBeNull();
    expect(applyHrefFor(seat())).toMatch(/r-weaver/);
    expect(mayApply(seat())).toBe(true);
  });

  it("draws the badge only on a flagged seat", () => {
    const { rerender } = render(<ComingSoonChip role={{ comingSoon: true }} />);
    expect(screen.getByTestId("coming-soon-chip").textContent).toBe("Coming soon");
    rerender(<ComingSoonChip role={{}} />);
    expect(screen.queryByTestId("coming-soon-chip")).toBeNull();
  });
});
