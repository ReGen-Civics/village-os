// @vitest-environment jsdom
/**
 * THE COMMITMENT SLIDER AND THE SPLIT (the lead, 17 Nov 2026): the band scales straight proportionally from 100% to
 * the role's minimum and hides while ranges are off; the split edits both ways and always adds up; the card's
 * choice rides the Apply link; the deciders see a badge only for a split the applicant changed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { setupI18n } from "@lingui/core";
import { offeredSplit, setPercent, type Split } from "@shared/proposalSplit";
import { bandAt, bandAtWords, offersSlider, sliderSteps, totalAgainstBand } from "./commitmentWords";
import { choiceQuery, commitmentFromQuery, splitFromQuery } from "./applyChoice";
import CommitmentPicker from "./CommitmentPicker";
import { useCommitmentChoice } from "./useCommitmentChoice";
import SplitControl from "./SplitControl";
import { exampleShare, rewardWords } from "./rewardWords";
import FullRoleCard, { applyHrefForRole } from "./FullRoleCard";
import SplitReview from "@/components/openProposal/SplitReview";

const i18n = setupI18n({ locale: "en", messages: { en: {} } });
const RANGE = { kind: "range", currency: "USD", minMinor: 962300, maxMinor: 1202900, per: "month" } as const;
const SHAPE = [
  { label: "Cash", pct: 60 },
  { label: "Equity", pct: 40 },
  { label: "Credits", pct: 0 },
];
const CEILING = { amount: 12029, currency: "USD", per: "month" as const };

afterEach(cleanup);

describe("the band at a commitment", () => {
  it("reads the band itself at 100%", () => {
    expect(bandAtWords(i18n, bandAt(RANGE, true, 100)!)).toBe("Band: $9,623 to $12,029 a month in total comp");
  });
  it("scales both ends straight proportionally down to the minimum, whole units", () => {
    const at30 = bandAt(RANGE, true, 30)!;
    expect([at30.lo, at30.hi]).toEqual([2886, 3608]);
    expect(bandAtWords(i18n, at30)).toBe("Band at 30%: $2,886 to $3,608 a month in total comp");
    expect(bandAtWords(i18n, bandAt({ ...RANGE, per: "moon" }, true, 60)!)).toBe("Band at 60%: $5,773 to $7,217 a moon in total comp");
  });
  it("is hidden while the village hides ranges, and for anything but a readable range", () => {
    expect(bandAt(RANGE, false, 100)).toBeNull();
    expect(bandAt({ kind: "fixed", currency: "USD", amountMinor: 900000, per: "month" }, true, 100)).toBeNull();
    expect(bandAt({ ...RANGE, minMinor: 1202900, maxMinor: 962300 }, true, 100)).toBeNull();
  });
  it("offers a slider only below 100%, in the terms' steps", () => {
    expect(offersSlider(null)).toBe(false);
    expect(offersSlider(100)).toBe(false);
    expect(sliderSteps(30)).toEqual([30, 40, 50, 60, 70, 80, 90, 100]);
  });
  it("says a total above or below the band, never a cap", () => {
    const band = bandAt(RANGE, true, 50)!;
    expect(totalAgainstBand(i18n, offeredSplit(SHAPE, 9000), band)).toBe("Your total is above the band at 50% ($4,811 to $6,014). You can still propose it.");
    expect(totalAgainstBand(i18n, offeredSplit(SHAPE, 5000), band)).toBeNull();
    expect(totalAgainstBand(i18n, offeredSplit(SHAPE, 4000), band)).toContain("below the band");
  });
});

describe("the card's choice on the Apply link", () => {
  it("carries the commitment, and the split only when it was changed", () => {
    const offered = offeredSplit(SHAPE, 6000);
    expect(choiceQuery(50, offered, offered)).toBe("commitment=50");
    expect(choiceQuery(50, setPercent(offered, 0, 50), offered)).toBe("commitment=50&split=50.50.0");
  });
  it("is read back only when it fits the role", () => {
    expect(commitmentFromQuery("?commitment=50", 30)).toBe(50);
    expect(commitmentFromQuery("?commitment=20", 30)).toBeNull();
    expect(commitmentFromQuery("?commitment=55", 30)).toBeNull();
    expect(splitFromQuery("?split=50.50.0", SHAPE)).toEqual([{ label: "Cash", pct: 50 }, { label: "Equity", pct: 50 }, { label: "Credits", pct: 0 }]);
    expect(splitFromQuery("?split=50.40.0", SHAPE)).toBeNull();
    expect(splitFromQuery("?split=100", SHAPE)).toBeNull();
  });
});

function Harness({ start }: { start: Split }) {
  const [split, setSplit] = useState(start);
  return <SplitControl idPrefix="t" split={split} offered={start} onChange={setSplit} currency="USD" per="month" pct={50} />;
}

describe("the split control, edited both ways", () => {
  it("says it is editable, and a percent updates its amount while the others rebalance", () => {
    render(<Harness start={offeredSplit(SHAPE, 6000)} />);
    expect(screen.getByText("You can change this split for your proposal. Type a percent or an amount.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Cash, percent of the total"), { target: { value: "50" } });
    expect((screen.getByLabelText("Cash, amount in USD") as HTMLInputElement).value).toBe("3000");
    expect((screen.getByLabelText("Contribution tokens, percent of the total") as HTMLInputElement).value).toBe("50");
    expect((screen.getByLabelText("Contribution tokens, amount in USD") as HTMLInputElement).value).toBe("3000");
  });
  it("an amount updates its percent, and the amounts still add up to the total", () => {
    render(<Harness start={offeredSplit(SHAPE, 6000)} />);
    fireEvent.change(screen.getByLabelText("Credits, amount in USD"), { target: { value: "600" } });
    expect((screen.getByLabelText("Credits, percent of the total") as HTMLInputElement).value).toBe("10");
    const amounts = ["Cash", "Contribution tokens", "Credits"].map((l) => Number((screen.getByLabelText(`${l}, amount in USD`) as HTMLInputElement).value));
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(6000);
    expect(screen.getByText("Total: $6,000 a month at 50%")).toBeTruthy();
    // Changed: the way back to the village's split appears, and puts it back.
    fireEvent.click(screen.getByText("Use the village's split"));
    expect((screen.getByLabelText("Cash, amount in USD") as HTMLInputElement).value).toBe("3600");
  });
});

function Card({ showsRange }: { showsRange: boolean }) {
  const { choice, setPct, setSplit } = useCommitmentChoice(30, CEILING, SHAPE);
  return <CommitmentPicker idPrefix="c" min={30} ceiling={CEILING} publicPay={RANGE} showsRange={showsRange} choice={choice} onPct={setPct} onSplit={setSplit} />;
}

describe("the picker on the card", () => {
  it("slides the band and the split's amounts together, with a spoken value", () => {
    render(<Card showsRange />);
    // At 100% too the slider has its own current figure (production check, 18 Nov 2026).
    expect(screen.getByText("Band at 100%: $9,623 to $12,029 a month in total comp")).toBeTruthy();
    const slider = screen.getByLabelText("Your commitment") as HTMLInputElement;
    expect(slider.getAttribute("aria-valuetext")).toBe("100% commitment, $9,623 to $12,029");
    fireEvent.change(slider, { target: { value: "30" } });
    expect(screen.getByText("Band at 30%: $2,886 to $3,608 a month in total comp")).toBeTruthy();
    expect((screen.getByLabelText("Cash, amount in USD") as HTMLInputElement).value).toBe(String(Math.round(3608 * 0.6)));
  });
  it("draws no band while the village hides ranges", () => {
    render(<Card showsRange={false} />);
    fireEvent.change(screen.getByLabelText("Your commitment"), { target: { value: "50" } });
    expect(screen.queryByText(/^Band/)).toBeNull();
    expect(screen.getByLabelText("Your commitment")).toBeTruthy();
  });
});

describe("the deciders' view of the split", () => {
  const offered = offeredSplit(SHAPE, 6000);
  it("shows no badge for an untouched split", () => {
    render(<SplitReview split={{ commitmentPct: 50, offered, proposed: offered }} currency="USD" />);
    expect(screen.queryByText("Split changed by applicant")).toBeNull();
    expect(document.querySelectorAll('[data-split-row-changed="yes"]').length).toBe(0);
  });
  it("badges a hand-changed split and marks each changed share, offered beside proposed", () => {
    render(<SplitReview split={{ commitmentPct: 50, offered, proposed: setPercent(offered, 0, 50) }} currency="USD" />);
    expect(screen.getByText("Split changed by applicant")).toBeTruthy();
    const rows = Array.from(document.querySelectorAll("[data-split-row]")).map((r) => [r.getAttribute("data-split-row"), r.getAttribute("data-split-row-changed"), r.textContent]);
    expect(rows[0]).toEqual(["Cash", "yes", "Cashchanged60% · $3,60050% · $3,000"]);
    expect(rows[2][1]).toBe("no");
  });
});

describe("the example price follows the slider (production check, 18 Nov 2026)", () => {
  const BAND9 = { amount: 9000, currency: "USD", per: "month" as const };
  it("prices the slider's commitment, held to the role's range, and says nothing at 100%", () => {
    expect(rewardWords(i18n, BAND9, 30, "", [], [], 60).proposal).toContain("At 60%, the suggested compensation is $5,400 a month.");
    expect(rewardWords(i18n, BAND9, 30, "", [], [], 10).proposal).toContain("At 30%, the suggested compensation is $2,700 a month.");
    expect(rewardWords(i18n, BAND9, 30, "", [], [], 100).proposal).not.toContain("suggested compensation is");
  });
  it("with no slider and no choice, uses the role's minimum as the example", () => {
    expect(exampleShare(30)).toBe(30);
    expect(rewardWords(i18n, BAND9, 30).proposal).toContain("At 30%, the suggested compensation is $2,700 a month.");
    expect(rewardWords(i18n, BAND9, null).proposal).not.toContain("suggested compensation is");
  });
});

describe("the slider on the full role card", () => {
  const SECTIONS = { idealBackground: [], qualities: [], aiSupport: "", aiCompanion: "", paid: true, payShape: SHAPE, payNote: "", payCeiling: CEILING, paySplitNote: "" };
  const seat = (card: Record<string, unknown>) => ({ id: "finance", name: "Lead Finance Steward", aim: "Keep the books true.", state: "open", archetypes: [], card });
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));
  });
  afterEach(() => vi.unstubAllGlobals());
  it("draws the slider and the split on a role taken from 30%, and moves the split's amounts with it", async () => {
    render(<FullRoleCard seat={seat({ commitmentMin: 30 })} sections={SECTIONS} register="founding" allPieces />);
    const slider = (await screen.findByLabelText("Your commitment")) as HTMLInputElement;
    expect(slider.min).toBe("30");
    fireEvent.change(slider, { target: { value: "50" } });
    // At 50% of $12,029 the listed price is $6,014, shared 60/40/0.
    expect((screen.getByLabelText("Cash, amount in USD") as HTMLInputElement).value).toBe("3608");
  });
  it("draws no slider on a role offered whole, and still offers the split (control)", async () => {
    render(<FullRoleCard seat={seat({})} sections={SECTIONS} register="founding" allPieces />);
    expect(await screen.findByLabelText("Cash, percent of the total")).toBeTruthy();
    expect(screen.queryByLabelText("Your commitment")).toBeNull();
  });
  it("draws neither inside an application or for the people deciding (noAct)", async () => {
    render(<FullRoleCard seat={seat({ commitmentMin: 30 })} sections={SECTIONS} register="founding" allPieces noAct />);
    await screen.findAllByTestId("pay-shape");
    expect(screen.queryByLabelText("Your commitment")).toBeNull();
    expect(screen.queryByLabelText("Cash, percent of the total")).toBeNull();
  });
  it("the proposal line follows the slider", async () => {
    render(<FullRoleCard seat={seat({ commitmentMin: 30 })} sections={SECTIONS} register="founding" allPieces />);
    const slider = (await screen.findByLabelText("Your commitment")) as HTMLInputElement;
    // At 100% the listed price is the figure, so no example line; slid to 50%, the line names 50%.
    await waitFor(() => expect(screen.getAllByTestId("pay-proposal-words")[0].textContent).not.toContain("suggested compensation is"));
    fireEvent.change(slider, { target: { value: "50" } });
    await waitFor(() => expect(screen.getAllByTestId("pay-proposal-words")[0].textContent).toContain("At 50%, the suggested compensation is $6,014 a month."));
  });
  it("the Apply link carries what the reader chose", () => {
    expect(applyHrefForRole("finance", "commitment=50&split=50.50.0")).toBe("/propose-a-role?role=finance&commitment=50&split=50.50.0");
    expect(applyHrefForRole("finance")).toBe("/propose-a-role?role=finance");
  });
});
