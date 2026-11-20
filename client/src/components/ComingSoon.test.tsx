// @vitest-environment jsdom
/**
 * COMING SOON ON THE CARD AND UNDER THE LEAD (Rye, 16 Nov 2026). Every host of
 * the live role card (/roles, /circles, the map) draws its action through
 * `guardedAction`: a coming-soon seat keeps its Apply, with the note that
 * interviews may take a while. The lead card lists the roles it will build.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ComingSoonChip, ComingSoonNote, HeldByAgentLine } from "./ComingSoon";
import { applyHrefFor, guardedAction } from "./power/SeatTermsSlot";
import { mayApply } from "./roleCard/FullRoleCard";
import LeadBuilds from "./roleCard/LeadBuilds";
import { RoleChoice } from "./fireflyPath/ApplySteps";

const NOTE = "This role is not open yet, and the card may change before it opens. Leave your details and we will write to you when it does.";
const APPLY = <a href="/apply">Apply</a>;
const seat = (over: Record<string, unknown> = {}) => ({ id: "r-weaver", name: "Community Weaver", state: "open", termsOffer: null, card: {}, ...over });

describe("a coming-soon seat on the card", () => {
  it("keeps Apply, with Rye's note beside it", () => {
    render(<div>{guardedAction(seat({ comingSoon: true, state: "forming" }), APPLY)}</div>);
    expect(screen.getByRole("link", { name: "Apply" })).toBeTruthy();
    expect(screen.getByText(NOTE)).toBeTruthy();
    expect(applyHrefFor(seat({ comingSoon: true, state: "forming" }))).toMatch(/r-weaver/);
    expect(mayApply(seat({ comingSoon: true, state: "forming" }))).toBe(true);
  });

  it("CONTROL: a plain seat keeps its Apply with no note, and a held one has no Apply", () => {
    render(<div>{guardedAction(seat(), APPLY)}</div>);
    expect(screen.getByRole("link", { name: "Apply" })).toBeTruthy();
    expect(screen.queryByText(NOTE)).toBeNull();
    expect(applyHrefFor(seat({ comingSoon: true, state: "filled" }))).toBeNull();
    expect(mayApply(seat({ comingSoon: true, state: "filled" }))).toBe(false);
  });

  it("a held seat still recruiting keeps its Apply; the same seat with its door closed has none (the lead, 17 Nov 2026)", () => {
    expect(applyHrefFor(seat({ state: "filled", recruiting: true }))).toMatch(/r-weaver/);
    expect(mayApply(seat({ state: "filled", recruiting: true }))).toBe(true);
    // CONTROL: door closed, no Apply.
    expect(applyHrefFor(seat({ state: "filled", recruiting: false }))).toBeNull();
    expect(mayApply(seat({ state: "filled", recruiting: false }))).toBe(false);
  });

  it("draws the badge only on a flagged seat, and the note only when asked", () => {
    const { rerender } = render(<ComingSoonChip role={{ comingSoon: true }} />);
    expect(screen.getByTestId("coming-soon-chip").textContent).toBe("Coming soon");
    rerender(<ComingSoonChip role={{}} />);
    expect(screen.queryByTestId("coming-soon-chip")).toBeNull();
    rerender(<ComingSoonNote show={false} />);
    expect(screen.queryByText(NOTE)).toBeNull();
  });
});

describe("a future venture and an agent-held role on the card", () => {
  it("keeps Apply on a venture, with the pitch's five parts and its own badge", () => {
    render(<div>{guardedAction(seat({ futureVenture: true, state: "forming" }), APPLY)}</div>);
    expect(screen.getByRole("link", { name: "Apply" })).toBeTruthy();
    expect(screen.queryByText(NOTE)).toBeNull();
    const note = document.querySelector("[data-venture-note]") as HTMLElement;
    expect(note.querySelectorAll("li")).toHaveLength(5);
    expect(note.textContent).toMatch(/A first financial picture/);
    render(<ComingSoonChip role={{ futureVenture: true }} />);
    expect(screen.getByText("Future venture")).toBeTruthy();
  });

  it("says an agent holds it, never by name; a person-held role says nothing", () => {
    const { rerender } = render(<HeldByAgentLine role={{ heldByAgent: true }} />);
    expect(screen.getByText("Held for now by our digital assistant.")).toBeTruthy();
    rerender(<HeldByAgentLine role={{}} />);
    expect(screen.queryByText("Held for now by our digital assistant.")).toBeNull();
  });
});

describe("roles this steward will build", () => {
  it("lists each coming-soon role with its badge and opens its card on the page", () => {
    const onOpen = vi.fn();
    render(<LeadBuilds leadName="Regenerative Land & Building Steward" roles={[{ id: "builder", name: "Natural Builder", aim: "Build with earth." }, { id: "gardener", name: "Food Forest Gardener", aim: null }]} onOpen={onOpen} />);
    expect(screen.getByRole("heading", { name: "Roles this steward will build" })).toBeTruthy();
    expect(screen.getAllByTestId("coming-soon-chip")).toHaveLength(2);
    expect(screen.getByText(NOTE)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Natural Builder/ }));
    expect(onOpen).toHaveBeenCalledWith("builder");
  });

  it("shows a held role beside them as Held, with no button to open an application and no name", () => {
    render(<LeadBuilds leadName="Community Building Steward" roles={[{ id: "soon", name: "Social Media Steward", aim: null }, { id: "gatherings", name: "Gatherings Steward", aim: "Make the land come alive.", held: true }]} onOpen={() => {}} />);
    const held = document.querySelector('[data-lead-builds-held="gatherings"]') as HTMLElement;
    expect(held.textContent).toMatch(/Gatherings Steward/);
    expect(held.textContent).toMatch(/Held/);
    expect(held.querySelector("button")).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("a held role still recruiting stays Held, says more players are welcome and offers Apply (the lead, 17 Nov 2026)", () => {
    render(
      <LeadBuilds
        leadName="Community Building Steward"
        roles={[
          { id: "gatherings", name: "Gatherings Steward", aim: null, held: true, recruiting: true },
          { id: "kitchen", name: "Kitchen Steward", aim: null, held: true },
        ]}
        onOpen={() => {}}
      />,
    );
    const open = document.querySelector('[data-lead-builds-held="gatherings"]') as HTMLElement;
    expect(open.textContent).toMatch(/Held/);
    expect(open.textContent).toMatch(/More players welcome/);
    expect(open.querySelector('a[data-apply-role="gatherings"]')?.getAttribute("href")).toBe("/propose-a-role?role=gatherings");
    // CONTROL: held with the door closed, no Apply and no line.
    const closed = document.querySelector('[data-lead-builds-held="kitchen"]') as HTMLElement;
    expect(closed.querySelector("a")).toBeNull();
    expect(closed.textContent).not.toMatch(/More players welcome/);
  });

  it("CONTROL: a lead with nothing to build draws nothing", () => {
    const { container } = render(<LeadBuilds leadName="Lead" roles={[]} onOpen={() => {}} />);
    expect(container.textContent).toBe("");
  });
});

describe("the application form's role chooser", () => {
  it("offers no Apply for a held role, and keeps the rest", () => {
    render(<RoleChoice roles={[{ id: "open", name: "Social Media Steward", circle: "Community", aim: null }, { id: "held", name: "Gatherings Steward", circle: "Community", aim: null, held: true }]} onPick={() => {}} />);
    expect(screen.getByRole("button", { name: /Social Media Steward/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Gatherings Steward/ })).toBeNull();
  });
});
