// @vitest-environment jsdom
/**
 * HOW MUCH YOU GIVE, on the Your roles card (Rye, 14 Nov 2026):
 *   - one total for every role, saved as the member's word;
 *   - roles paid through one agreement are told so, and the split stays shut;
 *   - roles paid apart open the split, and a split that misses 100% cannot save;
 *   - saving sends the total and the split together, one word.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const say = vi.fn();
let now: any = null;
vi.mock("@/lib/useMyCommitment", () => ({
  useMyCommitment: () => ({ pct: now?.pct ?? null, now, history: now ? [now] : [], loaded: true, say }),
}));

import RolesCommitment from "./RolesCommitment";

const seat = (id: string, through: string | null) => ({ id, name: `Role ${id}`, heldThrough: through });

beforeEach(() => {
  say.mockReset();
  say.mockResolvedValue({ ok: true });
  now = { id: 1, pct: 50, fromDate: "2026-11-01", period: "season", note: null, saidAt: null, split: null };
});
afterEach(cleanup);

describe("how much you give, across your roles", () => {
  it("says roles on one agreement share one pay, and keeps the split shut", () => {
    render(<RolesCommitment seats={[seat("a", "app-1"), seat("b", "app-1")]} />);
    const split = document.querySelector("[data-commitment-split]") as HTMLDetailsElement;
    expect(split.open).toBe(false);
    expect(split.textContent).toContain("Your roles share one pay");
  });

  it("opens the split for roles paid apart, and says pay scales by it once a Treasurer confirms", () => {
    render(<RolesCommitment seats={[seat("a", "app-1"), seat("b", "app-2")]} />);
    const split = document.querySelector("[data-commitment-split]") as HTMLDetailsElement;
    expect(split.open).toBe(true);
    expect(split.textContent).toContain("each role's pay at End of Moon scales by its part here");
    expect(split.textContent).toContain("a Treasurer confirms it before anything is paid");
  });

  it("offers no split for a single role", () => {
    render(<RolesCommitment seats={[seat("a", "app-1")]} />);
    expect(document.querySelector("[data-commitment-split]")).toBeNull();
  });

  it("saves the total and the split as one word, and refuses a split that is not whole", async () => {
    render(<RolesCommitment seats={[seat("a", "app-1"), seat("b", "app-2")]} />);
    fireEvent.change(screen.getByLabelText("Role a"), { target: { value: "70" } });
    expect(screen.getByText(/The parts add up to 120%/)).toBeTruthy();
    const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Role b"), { target: { value: "30" } });
    expect(save.disabled).toBe(false);
    expect(screen.getByText("35% of you")).toBeTruthy();
    fireEvent.click(save);
    expect(say).toHaveBeenCalledWith({ pct: 50, period: "season", note: null, split: [{ roleId: "a", share: 70 }, { roleId: "b", share: 30 }] });
  });

  it("keeps a saved split when only the total changes", () => {
    now = { ...now, split: [{ roleId: "b", share: 20 }, { roleId: "a", share: 80 }] };
    render(<RolesCommitment seats={[seat("a", "app-1"), seat("b", "app-2")]} />);
    fireEvent.change(screen.getByLabelText("Percent you can give"), { target: { value: "60" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(say).toHaveBeenCalledWith({ pct: 60, period: "season", note: null, split: [{ roleId: "a", share: 80 }, { roleId: "b", share: 20 }] });
  });
});
