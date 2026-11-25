// @vitest-environment jsdom
/**
 * ABSENT, NOT EMPTY on the live card (profile overhaul, Direction D, 25 Nov 2026).
 *
 * An unwritten part prints nothing on a live card. The owner reads one line saying how many parts
 * wait, with one door into edit mode, where each gap shows beside its edit control. Anyone else reads
 * nothing at all. A proposal card is different: its empty words say what to fill in, so they stay.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PlayerRoleCardView } from "./PlayerRoleCard";
import { countUnwritten } from "./cardParts";
import { fixturePayload } from "@/test/playerCardFixture";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), message: vi.fn(), error: vi.fn() } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u-reader" } }) }));

afterEach(() => cleanup());

const GROWING_EDGE = "Growing edge";

describe("the live card's unwritten parts", () => {
  it("are absent for the owner, who reads one counted line instead, and edit mode shows each gap", () => {
    const data = fixturePayload(1, "self", { growingEdge: null });
    const n = countUnwritten(data.card);
    expect(n).toBeGreaterThan(0);
    render(<PlayerRoleCardView data={data} />);
    expect(screen.queryByText(GROWING_EDGE)).toBeNull();
    const line = document.querySelector("[data-card-unwritten]");
    expect(line?.textContent).toContain(n === 1 ? "One part of your card is not written yet." : `${n} parts of your card are not written yet.`);
    fireEvent.click(screen.getByRole("button", { name: "Write them" }));
    // Edit mode: the gap is back, beside its edit control, and the counted line has gone.
    expect(screen.getByText(GROWING_EDGE)).toBeTruthy();
    expect(screen.getByRole("button", { name: `Edit: ${GROWING_EDGE}` })).toBeTruthy();
    expect(document.querySelector("[data-card-unwritten]")).toBeNull();
  });

  it("are absent for anyone else, with no counted line", () => {
    render(<PlayerRoleCardView data={fixturePayload(1, "member", { growingEdge: null })} />);
    expect(screen.queryByText(GROWING_EDGE)).toBeNull();
    expect(document.querySelector("[data-card-unwritten]")).toBeNull();
    expect(screen.queryByText("Not written yet")).toBeNull();
  });

  it("stay on a proposal card, where the empty words say what to fill in", () => {
    render(<PlayerRoleCardView data={fixturePayload(1, "member", { mode: "proposal" })} mode="proposal" />);
    expect(screen.getAllByText("Open for now. You'll add these once the role is adopted.").length).toBeGreaterThan(0);
    expect(document.querySelector("[data-card-unwritten]")).toBeNull();
  });
});

describe("countUnwritten", () => {
  it("counts every empty slot, at any depth, and nothing else", () => {
    expect(countUnwritten({ a: { kind: "empty", words: "x" }, b: [{ kind: "shown", value: 1 }, { kind: "empty", words: "y" }], c: { kind: "unread" } })).toBe(2);
    expect(countUnwritten(null)).toBe(0);
  });
});
