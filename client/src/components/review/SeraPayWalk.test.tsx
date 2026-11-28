// @vitest-environment jsdom
/**
 * SEVERAL PAY SUGGESTIONS, TICKED BY HAND, ARE SET ONE ROLE AT A TIME.
 *
 * Rye, 28 Nov 2026, on Sera's pay and new-role suggestions: "Can manually select multiple." For pay that is a walk:
 * the ticked roles are listed by name first, then each one opens in the role's own pay setter in turn. Each is its
 * own act through the pay route, with its own record and its own second signer where that rule applies. Nothing is
 * sent for a role the person skips, and nothing at all until the person presses the setter's own button.
 *
 * The setter is held by RolePayWithEngine.test.tsx. Here it is a stand-in that reports an outcome when told to.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/gameApi", () => ({ authToken: () => "a-token" }));
vi.mock("@/components/review/SeraPaySetter", () => ({
  default: (props: { role: { id: string; name: string }; sera: { monthlyUsd: number | null }; onOutcome?: (state: string) => void }) => (
    <div data-testid="setter" data-role={props.role.id} data-usd={String(props.sera.monthlyUsd)}>
      {["set", "awaiting_second", "village"].map((state) => (
        <button key={state} type="button" onClick={() => props.onOutcome?.(state)}>{`stand-in: ${state}`}</button>
      ))}
    </div>
  ),
}));

import { BulkBar } from "./SeraBulk";
import SeraPayWalk from "./SeraPayWalk";
import { listed } from "@/test/seraDifferences";
import type { ListedDifference } from "@/lib/seraReview";

const payRow = (ourId: string, name: string, usd = 1200) =>
  listed({ kind: "pay", field: "pay", ours: "none", sera: `stipend|${usd}`, bulkEligible: false, takeable: false, params: { model: "Stipend", monthlyUsd: usd, standing: "pending" }, subject: { ourId, name } });
const rename = (name: string) => listed({ kind: "rename", sera: `${name} (renamed)`, ours: name, subject: { name } });

afterEach(() => cleanup());

/** As much of the list's acts as the bar and the walk read. */
function actsFor(ticked: ListedDifference[], walk: ListedDifference[] | null = null) {
  return {
    ticked: new Set(ticked.map((d) => d.key)),
    tickedRows: ticked,
    busy: false,
    payWalk: walk,
    openSheet: vi.fn(),
    openPayWalk: vi.fn(),
    closePayWalk: vi.fn(),
    untickAll: vi.fn(),
  };
}

describe("the bar, once pay rows are ticked by hand", () => {
  it("offers to set pay for the ticked roles, beside the take, which never counts a pay row", () => {
    const acts = actsFor([rename("Water Steward"), payRow("r-cook", "Cook"), rename("Pump Keeper"), payRow("r-baker", "Baker")]);
    render(<BulkBar acts={acts as never} agent="Sera" />);
    expect(screen.getByText("4 ticked")).toBeTruthy();
    // The take is for the two that can be taken. Pay is its own act.
    expect(screen.getByRole("button", { name: "Take Sera's for 2" })).toBeTruthy();
    const pay = screen.getByRole("button", { name: "Set pay for 2 roles" });
    fireEvent.click(pay);
    expect(acts.openPayWalk).toHaveBeenCalledOnce();
    expect(acts.openSheet).not.toHaveBeenCalled();
  });

  it("with only pay rows ticked there is no take to offer, and one role reads as one", () => {
    const acts = actsFor([payRow("r-cook", "Cook")]);
    render(<BulkBar acts={acts as never} agent="Sera" />);
    expect(screen.queryByRole("button", { name: /^Take / })).toBeNull();
    expect(screen.getByRole("button", { name: "Set pay for 1 role" })).toBeTruthy();
  });

  it("with no pay row ticked the bar is exactly as it was", () => {
    const acts = actsFor([rename("Water Steward"), rename("Pump Keeper")]);
    render(<BulkBar acts={acts as never} agent="Sera" />);
    expect(screen.getByRole("button", { name: "Take Sera's for 2" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Set pay/ })).toBeNull();
  });
});

describe("the walk through the ticked roles", () => {
  const COOK = payRow("r-cook", "Cook", 1200);
  const BAKER = payRow("r-baker", "Baker", 900);
  const GARDENER = payRow("r-gardener", "Gardener", 700);
  const open = (rows = [COOK, BAKER, GARDENER]) => {
    const acts = actsFor(rows, rows);
    render(<SeraPayWalk acts={acts as never} agent="Sera" />);
    return acts;
  };

  it("is closed until it is opened", () => {
    const acts = actsFor([COOK], null);
    render(<SeraPayWalk acts={acts as never} agent="Sera" />);
    expect(screen.queryByTestId("pay-walk")).toBeNull();
  });

  it("lists every ticked role by name with what Sera lists for it, before any setter opens", () => {
    open();
    const walk = screen.getByTestId("pay-walk");
    expect(walk.textContent).toContain("Set pay for 3 roles, one at a time");
    const lines = screen.getAllByTestId("pay-walk-line").map((li) => li.textContent);
    expect(lines).toEqual([`Cook${COOK.words.sentence}`, `Baker${BAKER.words.sentence}`, `Gardener${GARDENER.words.sentence}`]);
    expect(walk.textContent).toContain("Each role is set on its own, in its own pay setter. Nothing is sent until you press Set this role's pay there.");
    expect(screen.queryByTestId("setter")).toBeNull();
  });

  it("opens each role's own setter in turn, handed that role's figure, and says where it is in the walk", async () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Start with Cook" }));
    expect(screen.getByText("Role 1 of 3: Cook")).toBeTruthy();
    // The setter loads on demand.
    expect((await screen.findByTestId("setter")).getAttribute("data-role")).toBe("r-cook");
    expect(screen.getByTestId("setter").getAttribute("data-usd")).toBe("1200");
    // Nothing was set for Cook: moving on is a skip, and says so.
    fireEvent.click(screen.getByRole("button", { name: "Skip this role" }));
    expect(screen.getByText("Role 2 of 3: Baker")).toBeTruthy();
    expect(screen.getByTestId("setter").getAttribute("data-role")).toBe("r-baker");
    expect(screen.getByTestId("setter").getAttribute("data-usd")).toBe("900");
    // Once the setter reports an outcome, the way on is "Next role".
    fireEvent.click(screen.getByRole("button", { name: "stand-in: set" }));
    expect(screen.queryByRole("button", { name: "Skip this role" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Next role" }));
    expect(screen.getByText("Role 3 of 3: Gardener")).toBeTruthy();
    expect(screen.getAllByTestId("setter")).toHaveLength(1);
  });

  it("ends by saying what happened to each role, in the words of the pay route's own outcomes", async () => {
    const acts = open();
    fireEvent.click(screen.getByRole("button", { name: "Start with Cook" }));
    fireEvent.click(await screen.findByRole("button", { name: "stand-in: set" }));
    fireEvent.click(screen.getByRole("button", { name: "Next role" }));
    fireEvent.click(screen.getByRole("button", { name: "stand-in: awaiting_second" }));
    fireEvent.click(screen.getByRole("button", { name: "Next role" }));
    // The last one is skipped.
    fireEvent.click(screen.getByRole("button", { name: "Skip this role" }));
    expect(screen.queryByTestId("setter")).toBeNull();
    expect(screen.getAllByTestId("pay-walk-result").map((li) => li.textContent)).toEqual([
      "Cook: pay is set.",
      "Baker: waiting for a second signer. Its pay stays as it is until they sign.",
      "Gardener: skipped. Nothing was sent.",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Back to the list" }));
    expect(acts.closePayWalk).toHaveBeenCalledOnce();
  });

  it("a figure nobody else can sign is said to go to the village", async () => {
    open([COOK]);
    fireEvent.click(screen.getByRole("button", { name: "Start with Cook" }));
    fireEvent.click(await screen.findByRole("button", { name: "stand-in: village" }));
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    expect(screen.getByTestId("pay-walk-result").textContent).toBe("Cook: nobody else can sign this figure, so it goes to the village.");
  });

  it("can be left at any point, and leaving sends nothing", () => {
    const acts = open();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(acts.closePayWalk).toHaveBeenCalledOnce();
    expect(screen.queryByTestId("setter")).toBeNull();
  });
});
