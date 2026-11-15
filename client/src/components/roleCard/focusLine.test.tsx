// @vitest-environment jsdom
/**
 * THE FOCUS LINE ON THE CARD (Rye, 15 Nov 2026): the qualities' token draws the words of the band the commitment
 * the card shows falls in, follows the applicant's choice live, and says exactly what shared/focusLine.ts holds.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { i18n } from "@lingui/core";
import { FOCUS_BAND_STARTS, focusEnglish } from "@shared/focusLine";
import { splitLine } from "@shared/rolePieces";
import { bandWords } from "./focusLine";
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
const VILLAGE = "The village";
/** A line as its tile reads: the title then the body, nothing between. */
const asTile = (line: string): string => {
  const t = splitLine(line);
  return (t.title ?? "") + t.body;
};
const qualities = () => document.querySelector('[data-testid="qualities"]')?.textContent ?? "";
// The founding card draws a "Lead: rest" line as a tile, its lead as the title and the rest as the body.
const tiles = () => Array.from(document.querySelectorAll('[data-testid="qualities"] li')).map((li) => li.textContent);
const says = (band: (typeof FOCUS_BAND_STARTS)[number]) => expect(tiles()).toContain(asTile(focusEnglish(band, VILLAGE)));

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the focus line on the role card", () => {
  it("each band's message says what the table in shared/focusLine.ts says", () => {
    for (const b of FOCUS_BAND_STARTS) expect(bandWords(i18n, b, "Rivermoor"), `${b}%`).toBe(focusEnglish(b, "Rivermoor"));
  });
  it("a role that opens from 30% draws the 30% band, and keeps the village's other lines as written", async () => {
    render(<FullRoleCard seat={seat({ commitmentMin: 30 })} sections={SECTIONS} register="founding" noAct allPieces />);
    await waitFor(() => says(30));
    expect(qualities()).toContain("Owns the whole domain");
    expect(qualities()).not.toContain("{focus}");
  });
  it("a role offered whole draws the 100% band (control)", async () => {
    render(<FullRoleCard seat={seat({ commitmentPct: 100 })} sections={SECTIONS} register="founding" noAct allPieces />);
    await waitFor(() => says(100));
  });
  it("follows the applicant's chosen share live through every band, and below 10% reads as 10%", async () => {
    const card = (pct: number | null) => <FullRoleCard seat={seat({ commitmentMin: 10 })} sections={SECTIONS} register="founding" noAct allPieces commitmentChosen={pct} />;
    const view = render(card(5));
    await waitFor(() => says(10));
    for (const [pct, band] of [[30, 30], [55, 50], [60, 60], [85, 80], [100, 100], [59, 50]] as const) {
      view.rerender(card(pct));
      says(band);
    }
  });
  it("the directory card (game register) draws the same line whole", async () => {
    render(<FullRoleCard seat={seat({ commitmentPct: 50 })} sections={SECTIONS} noAct />);
    await waitFor(() => expect(qualities()).toContain(focusEnglish(50, VILLAGE)));
  });
});
