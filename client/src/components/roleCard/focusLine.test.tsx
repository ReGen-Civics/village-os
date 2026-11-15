// @vitest-environment jsdom
/**
 * THE FOCUS LINE ON THE CARD (Rye, 15 Nov 2026): the qualities' token draws "Fully focused" at 60% and above and
 * "Focused" below, from the commitment the card shows, and follows the applicant's choice live.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import FullRoleCard from "./FullRoleCard";

const SECTIONS = {
  idealBackground: [],
  qualities: ["{focus}", "Owns the whole domain"],
  aiSupport: "",
  aiCompanion: "",
  paid: true,
  payShape: [],
  payNote: "",
  payCeiling: null,
  paySplitNote: "",
};
const seat = (card: Record<string, unknown>) => ({ id: "finance", name: "Lead Finance Steward", aim: "Keep the books true.", state: "open", archetypes: [], card });
// The founding card draws a "Lead: rest" line as a tile, its lead as the title; the directory card draws it whole.
const MAIN = ["Fully focused", "The village is your main work"];
const PART = ["Focused", "The village is a main part of your work"];
const qualities = () => document.querySelector('[data-testid="qualities"]')?.textContent ?? "";
const says = ([lead, rest]: string[]) => expect(Array.from(document.querySelectorAll('[data-testid="qualities"] li')).map((li) => li.textContent)).toContain(lead + rest);

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the focus line on the role card", () => {
  it("a role that opens from 30% says a main part of your work, and keeps the village's other lines as written", async () => {
    render(<FullRoleCard seat={seat({ commitmentMin: 30 })} sections={SECTIONS} register="founding" noAct allPieces />);
    await waitFor(() => says(PART));
    expect(qualities()).toContain("Owns the whole domain");
    expect(qualities()).not.toContain("{focus}");
    expect(qualities()).not.toContain("Fully focused");
  });
  it("a role offered whole says your main work (control)", async () => {
    render(<FullRoleCard seat={seat({ commitmentPct: 100 })} sections={SECTIONS} register="founding" noAct allPieces />);
    await waitFor(() => says(MAIN));
  });
  it("follows the applicant's chosen share live: 30% then 60% then 59%", async () => {
    const card = (pct: number | null) => <FullRoleCard seat={seat({ commitmentMin: 30 })} sections={SECTIONS} register="founding" noAct allPieces commitmentChosen={pct} />;
    const view = render(card(null));
    await waitFor(() => says(PART));
    view.rerender(card(60));
    says(MAIN);
    view.rerender(card(59));
    says(PART);
  });
  it("the directory card (game register) draws the same line", async () => {
    render(<FullRoleCard seat={seat({ commitmentPct: 50 })} sections={SECTIONS} noAct />);
    await waitFor(() => expect(qualities()).toContain("Focused: The village is a main part of your work"));
  });
});
