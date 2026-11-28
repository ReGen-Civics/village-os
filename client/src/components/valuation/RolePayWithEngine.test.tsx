// @vitest-environment jsdom
/**
 * The Treasurer's screen for a role's pay, rendered (spec 3.3, 3.4; research 03
 * and the UX pass, qa/03).
 *
 *   1. The setter's own figure is asked BEFORE the suggestion shows, so the
 *      suggestion cannot anchor it.
 *   2. The figure field is never prefilled: "Use the suggestion" is a choice.
 *   3. A figure outside the band asks a reason, and the screen says who signs
 *      next before anything is sent.
 *   4. Save sends the inputs and the figure; the server prices them again.
 *   5. The receipt names no hours and no hourly figure, and opens with a 44 px
 *      button that says what it does.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RolePayWithEngine from "./RolePayWithEngine";
import { modelForVillage, suggestValuation } from "@shared/valuationEngine";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const MODEL = {
  ...modelForVillage("CRC"),
  version: 1,
  bands: [{ key: "general", label: "General help", hourValueMinor: 155455, source: { sentence: "Decree 45303-MTSS", date: "2026-10-31" } }],
};

const setup = (put: (body: any) => any = () => ({ state: "set" }), model: typeof MODEL = MODEL) => {
  const calls: Array<{ path: string; body: any; method?: string }> = [];
  const call = vi.fn(async (path: string, body?: any, method?: string) => {
    calls.push({ path, body, method });
    if (path === "/valuation/model") return { model, eeMeaningWritten: true, tokenNames: { credits: "Village Credits", "earned-equity": "Earned Equity", "village-voice": "Village Voice" } };
    return put(body);
  });
  render(<RolePayWithEngine role={{ id: "garden-steward", name: "Garden Steward" }} call={call} onSaved={() => {}} />);
  return calls;
};

describe("setting a role's pay with the valuation engine", () => {
  it("asks the setter's own figure before showing the suggestion, and never prefills the figure", async () => {
    setup();
    const user = userEvent.setup();
    await screen.findByText("Kind of work");
    await user.type(screen.getByLabelText(/Estimated effort for the moon/), "20");
    expect(screen.queryByText("Reward")).toBeNull();
    await user.type(screen.getByLabelText(/Your own figure first/), "60000");
    await user.click(screen.getByRole("button", { name: "Show the suggestion" }));
    expect(await screen.findByText("Reward")).toBeTruthy();
    expect(screen.getByText(/Your own figure was ₡60,000/)).toBeTruthy();
    expect(screen.queryByLabelText("Your figure")).toBeNull();
    expect((screen.getByRole("button", { name: "Set this role's pay" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("asks a reason for a figure outside the band, says who signs next, and sends the inputs and the figure", async () => {
    const calls = setup(() => ({ state: "awaiting_second" }));
    const user = userEvent.setup();
    await screen.findByText("Kind of work");
    await user.type(screen.getByLabelText(/Estimated effort for the moon/), "20");
    await user.click(screen.getByRole("button", { name: "Show the suggestion" }));
    await user.click(screen.getByLabelText("My own figure"));
    await user.type(screen.getByLabelText("Your figure"), "200000");
    expect(screen.getByText(/A second Treasurer or a steward then signs it/)).toBeTruthy();
    await user.selectOptions(screen.getByLabelText("Reason"), "Fairness with similar work");
    await user.click(screen.getByRole("button", { name: "Set this role's pay" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    const put = calls.find((c) => c.method === "PUT")!;
    expect(put.path).toBe("/org/roles/garden-steward/pay");
    expect(put.body).toMatchObject({ set: { totalMinor: 20000000 }, reason: "Fairness with similar work", work: { kind: "role", lines: [{ band: "general", estimatedHours: 20 }] } });
    expect(await screen.findByRole("status")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toMatch(/Waiting for a second signer/);
  });

  it("shows a receipt with no hours and no hourly figure", async () => {
    setup();
    const user = userEvent.setup();
    await screen.findByText("Kind of work");
    await user.type(screen.getByLabelText(/Estimated effort for the moon/), "20");
    await user.click(screen.getByRole("button", { name: "Show the suggestion" }));
    await user.click(screen.getByRole("button", { name: "How this was worked out" }));
    const receipt = document.querySelector("[data-valuation-receipt]")!.textContent ?? "";
    expect(receipt).toMatch(/Base price/);
    expect(receipt).not.toMatch(/\bhours?\b/i);
    expect(receipt).not.toContain("1,554");
  });

  it("judges a figure against the village's own band, 20% under the suggestion up to the suggestion itself", async () => {
    const banded = { ...MODEL, engine: { bandBelowPct: 20, bandAbovePct: 0 } };
    const expected = (suggestValuation(banded, { kind: "role", lines: [{ band: "general", payee: "lead", estimatedHours: 20 }], responsibility: "none" }, { eeMeaningWritten: true }) as any).payees[0].expected.totalMinor as number;
    const whole = (minor: number) => String(Math.floor(minor / 100));
    setup(undefined, banded);
    const user = userEvent.setup();
    await screen.findByText("Kind of work");
    await user.type(screen.getByLabelText(/Estimated effort for the moon/), "20");
    await user.click(screen.getByRole("button", { name: "Show the suggestion" }));
    expect(screen.getByText(/The band runs from 20% under the suggestion up to the suggestion itself/)).toBeTruthy();
    await user.click(screen.getByLabelText("My own figure"));
    // 85% of the suggestion: inside this band, outside the platform's 10% one.
    await user.type(screen.getByLabelText("Your figure"), whole(Math.ceil(expected * 0.85)));
    expect(screen.getByText(/inside the suggestion's band, so your word sets it/)).toBeTruthy();
    // A little over the suggestion: outside, because the band stops at the suggestion.
    await user.clear(screen.getByLabelText("Your figure"));
    await user.type(screen.getByLabelText("Your figure"), whole(expected * 1.05));
    expect(screen.getByText(/A second Treasurer or a steward then signs it/)).toBeTruthy();
  });

  it("says the village has not set its rates, and where, when there are none", async () => {
    const call = vi.fn(async () => ({ model: { ...MODEL, bands: [] }, eeMeaningWritten: true, tokenNames: {} }));
    render(<RolePayWithEngine role={{ id: "r", name: "R" }} call={call} onSaved={() => {}} />);
    expect(await screen.findByText(/has not set its rates yet/)).toBeTruthy();
  });
});

/*
 * OPENED FROM ONE OF SERA'S PAY ROWS. Rye, 28 Nov 2026: "both write the figure and open the pay control to show it,
 * so that a player can simply accept or edit and accept". This is a ruled EXCEPTION to the setter's own rule (own
 * number first, nothing prefilled), and it holds only when the setter is handed `sera`. Her figure arrives written
 * and chosen, the estimate from last time arrives filled in, and nothing is saved until the person presses. On her
 * monthly figure, Rye: "As listed". The last block holds the rule itself, unchanged, when opened any other way.
 */
describe("opened from one of Sera's pay rows: her figure arrives written, to accept or to edit and accept", () => {
  const USD = { ...modelForVillage("USD"), version: 1, bands: [{ key: "general", label: "General help", hourValueMinor: 2500, source: { sentence: "Set by the village", date: "2026-10-31" } }] };
  const suggestedFor = (hours: number) =>
    (suggestValuation(USD, { kind: "role", lines: [{ band: "general", payee: "lead", estimatedHours: hours }], responsibility: "none" }, { eeMeaningWritten: true }) as any).payees[0].expected.totalMinor as number;
  // She lists what the engine suggests for 40 hours, to the dollar: a figure inside the band.
  const INSIDE = Math.round(suggestedFor(40) / 100);
  const sera = (usd: number | null, over: Record<string, unknown> = {}) => ({
    agent: "Sera",
    sentence: usd === null ? "Sera lists pay for Cook." : `Sera lists Cook's pay as a stipend of US$${usd.toLocaleString("en-US")} a month for the whole role. This village has no pay set for it.`,
    monthlyUsd: usd,
    editedAt: "2026-11-10T12:00:00.000Z" as string | null,
    ...over,
  });
  const STORED = { band: "general", estimatedHours: 40, estimateLow: null as number | null, estimateHigh: null as number | null, responsibility: "none" as string | null, setAt: "2026-10-30T12:00:00.000Z" };
  const money = (usd: number) => `$${usd.toLocaleString("en-US")}`;
  const HERS = (usd: number) => `Sera suggests ${money(usd)} a month, used as this moon's pay`;

  const open = (props: { sera?: ReturnType<typeof sera> | null; stored?: typeof STORED | null; current?: { minor: number; currency: string; setAt: string | null } | null; model?: any }, put: (body: any) => any = () => ({ state: "set" })) => {
    const calls: Array<{ path: string; body: any; method?: string }> = [];
    const call = vi.fn(async (path: string, body?: any, method?: string) => {
      calls.push({ path, body, method });
      if (path === "/valuation/model") return { model: props.model ?? USD, eeMeaningWritten: true, tokenNames: {} };
      return put(body);
    });
    render(<RolePayWithEngine role={{ id: "cook", name: "Cook" }} call={call} onSaved={() => {}} sera={props.sera ?? null} stored={props.stored ?? null} current={props.current ?? null} />);
    return calls;
  };
  const puts = (calls: Array<{ method?: string; body: any }>) => calls.filter((c) => c.method === "PUT").map((c) => c.body);

  it("with an estimate from last time, everything is ready: her figure is written and chosen, and one press accepts it", async () => {
    const calls = open({ sera: sera(INSIDE), stored: STORED });
    const user = userEvent.setup();
    await screen.findByText("Kind of work");
    // The exception: no own number first, no reveal step.
    expect(screen.queryByLabelText(/Your own figure first/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Show the suggestion" })).toBeNull();
    // The estimate arrives filled in, said to come from last time, and stays editable.
    expect((screen.getByLabelText(/Estimated effort for the moon/) as HTMLInputElement).value).toBe("40");
    expect(screen.getByTestId("stored-estimate").textContent).toBe("Filled in from the last time this role's pay was set: General help, 40 hours for the moon. Change anything that is different now.");
    // Her figure is written, chosen and marked as hers, beside the engine's suggestion.
    expect(screen.getByText(sera(INSIDE).sentence)).toBeTruthy();
    expect((screen.getByLabelText(HERS(INSIDE)) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText(/^Use the suggestion,/) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText("The figure to set") as HTMLInputElement).value).toBe(String(INSIDE));
    expect(screen.getByText("This role has no pay set now.")).toBeTruthy();
    // Nothing is saved until the person presses.
    expect(puts(calls)).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Set this role's pay" }));
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    const put = puts(calls)[0];
    // As listed: her monthly figure, with no conversion, and the estimate, through the one pay door.
    expect(put.set).toEqual({ totalMinor: INSIDE * 100 });
    expect(put.work).toMatchObject({ kind: "role", lines: [{ band: "general", estimatedHours: 40 }] });
    expect(put.reason).toBeUndefined();
    // The record keeps what she listed, what it replaces and what was saved.
    expect(put.note).toBe(`Opened from the pay Sera lists: US$${INSIDE.toLocaleString("en-US")} a month. Before: no pay set. Saved: ${money(INSIDE)}.`);
    expect(calls.find((c) => c.method === "PUT")!.path).toBe("/org/roles/cook/pay");
  });

  it("editing her figure makes it the person's own, and the record keeps both", async () => {
    const calls = open({ sera: sera(INSIDE), stored: STORED, current: { minor: 90000, currency: "USD", setAt: "2026-10-30T12:00:00.000Z" } });
    const user = userEvent.setup();
    await screen.findByText("Kind of work");
    expect(screen.getByText("This role's pay is $900 now.")).toBeTruthy();
    const figure = screen.getByLabelText("The figure to set") as HTMLInputElement;
    const mine = INSIDE - 10;
    await user.clear(figure);
    await user.type(screen.getByLabelText(/^(The figure to set|Your figure)$/), String(mine));
    // It reads as their own figure now.
    expect((screen.getByLabelText("My own figure") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText(HERS(INSIDE)) as HTMLInputElement).checked).toBe(false);
    await user.click(screen.getByRole("button", { name: "Set this role's pay" }));
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    expect(puts(calls)[0].set).toEqual({ totalMinor: mine * 100 });
    expect(puts(calls)[0].note).toBe(`Opened from the pay Sera lists: US$${INSIDE.toLocaleString("en-US")} a month. Before: $900. Saved: ${money(mine)}.`);
  });

  it("outside the band the reason arrives filled with one true sentence, editable, and the band rule is unchanged", async () => {
    // Four hours of this work is worth far less than the 1,200 she lists.
    const calls = open({ sera: sera(1200), stored: { ...STORED, estimatedHours: 4 } }, () => ({ state: "awaiting_second" }));
    const user = userEvent.setup();
    await screen.findByText("Kind of work");
    expect(screen.getByText(/A second Treasurer or a steward then signs it/)).toBeTruthy();
    expect((screen.getByLabelText("Reason") as HTMLSelectElement).value).toBe("Other");
    const why = screen.getByLabelText("Say why") as HTMLInputElement;
    expect(why.value).toBe("Sera lists this role at US$1,200 a month.");
    await user.type(why, " The cook now also runs the pantry.");
    await user.click(screen.getByRole("button", { name: "Set this role's pay" }));
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    expect(puts(calls)[0].reason).toBe("Sera lists this role at US$1,200 a month. The cook now also runs the pantry.");
    expect(puts(calls)[0].set).toEqual({ totalMinor: 120000 });
    // The route decides, and the control says which outcome happened.
    expect((await screen.findByRole("status")).textContent).toMatch(/Waiting for a second signer/);
  });

  it("with no estimate from last time the person gives it, and is told so before anything else", async () => {
    const calls = open({ sera: sera(INSIDE) });
    const user = userEvent.setup();
    await screen.findByText("Kind of work");
    expect(screen.getByTestId("needs-estimate").textContent).toBe("Give this role's effort for the moon first. The figure Sera lists is ready below once you do.");
    expect(screen.queryByRole("button", { name: "Set this role's pay" })).toBeNull();
    await user.type(screen.getByLabelText(/Estimated effort for the moon/), "40");
    expect((screen.getByLabelText(HERS(INSIDE)) as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByTestId("needs-estimate")).toBeNull();
    expect(puts(calls)).toEqual([]);
  });

  it("says so, before the person accepts, when pay was set here after her suggestion was made", async () => {
    open({ sera: sera(INSIDE, { editedAt: "2026-11-10T12:00:00.000Z" }), stored: STORED, current: { minor: 90000, currency: "USD", setAt: "2026-11-20T12:00:00.000Z" } });
    await screen.findByText("Kind of work");
    expect(screen.getByTestId("pay-stale").textContent).toBe("Pay was set here on 20 Nov 2026, after Sera last edited the suggestion on 10 Nov 2026. Check the figure still applies before you set it.");
  });

  it("says nothing of the kind when her suggestion is the newer of the two", async () => {
    open({ sera: sera(INSIDE, { editedAt: "2026-11-25T12:00:00.000Z" }), stored: STORED, current: { minor: 90000, currency: "USD", setAt: "2026-11-20T12:00:00.000Z" } });
    await screen.findByText("Kind of work");
    expect(screen.queryByTestId("pay-stale")).toBeNull();
  });

  it("the person may still choose the engine's suggestion, and the record still says where the visit came from", async () => {
    const calls = open({ sera: sera(1200), stored: STORED });
    const user = userEvent.setup();
    await screen.findByText("Kind of work");
    await user.click(screen.getByLabelText(/^Use the suggestion,/));
    await user.click(screen.getByRole("button", { name: "Set this role's pay" }));
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    expect(puts(calls)[0].set).toEqual({ totalMinor: suggestedFor(40) });
    expect(puts(calls)[0].reason).toBeUndefined();
    expect(puts(calls)[0].note).toMatch(/^Opened from the pay Sera lists: US\$1,200 a month\. Before: no pay set\. Saved: /);
  });

  it("in a village that does not set pay in US dollars nothing is written as the figure: her words show and the person types", async () => {
    open({ sera: sera(1200), stored: { ...STORED, estimatedHours: 20 }, model: MODEL });
    const user = userEvent.setup();
    await screen.findByText("Kind of work");
    // The estimate is still filled in. The figure is the setter's own rule: own number first, then the suggestion.
    expect((screen.getByLabelText(/Estimated effort for the moon/) as HTMLInputElement).value).toBe("20");
    expect(screen.queryByText(sera(1200).sentence)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Show the suggestion" }));
    expect(screen.getByText(sera(1200).sentence)).toBeTruthy();
    expect(screen.queryByLabelText(/^Sera suggests/)).toBeNull();
    expect(screen.getByText("Sera lists a figure in US dollars. This village sets pay in CRC, so choose the suggestion or type your own figure.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Set this role's pay" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("with no figure from her, her words alone, and the setter's own order", async () => {
    open({ sera: sera(null), stored: STORED });
    const user = userEvent.setup();
    await screen.findByText("Kind of work");
    await user.click(screen.getByRole("button", { name: "Show the suggestion" }));
    expect(screen.getByText("Sera lists pay for Cook.")).toBeTruthy();
    expect(screen.queryByLabelText(/^Sera suggests/)).toBeNull();
    expect(screen.queryByText(/lists a figure in US dollars/)).toBeNull();
  });

  it("an estimate for a kind of work the village no longer has is not filled in", async () => {
    open({ sera: sera(INSIDE), stored: { ...STORED, band: "retired-band" } });
    await screen.findByText("Kind of work");
    expect(screen.queryByTestId("stored-estimate")).toBeNull();
    expect((screen.getByLabelText(/Estimated effort for the moon/) as HTMLInputElement).value).toBe("");
    expect(screen.getByTestId("needs-estimate")).toBeTruthy();
  });
});

describe("opened any other way, the setter keeps its own rule: own number first, nothing prefilled", () => {
  const STORED = { band: "general", estimatedHours: 40, estimateLow: 30, estimateHigh: 55, responsibility: "none", setAt: "2026-10-30T12:00:00.000Z" };

  it("prefills nothing and asks the own figure first, even when handed an estimate and the pay as it stands", async () => {
    const calls: Array<{ method?: string }> = [];
    const call = vi.fn(async (path: string, _body?: any, method?: string) => {
      calls.push({ method });
      if (path === "/valuation/model") return { model: MODEL, eeMeaningWritten: true, tokenNames: {} };
      return { state: "set" };
    });
    render(<RolePayWithEngine role={{ id: "cook", name: "Cook" }} call={call} onSaved={() => {}} stored={STORED} current={{ minor: 90000, currency: "CRC", setAt: null }} />);
    const user = userEvent.setup();
    await screen.findByText("Kind of work");
    expect((screen.getByLabelText(/Estimated effort for the moon/) as HTMLInputElement).value).toBe("");
    expect(screen.queryByTestId("stored-estimate")).toBeNull();
    expect(screen.queryByTestId("needs-estimate")).toBeNull();
    expect(screen.getByLabelText(/Your own figure first/)).toBeTruthy();
    expect(screen.queryByText("Reward")).toBeNull();
    await user.type(screen.getByLabelText(/Estimated effort for the moon/), "20");
    await user.click(screen.getByRole("button", { name: "Show the suggestion" }));
    // No figure is chosen, nothing is written, and the last button waits.
    expect(screen.getAllByRole("radio").map((r) => (r as HTMLInputElement).checked)).toEqual([false, false]);
    expect(screen.queryByLabelText(/^(The figure to set|Your figure)$/)).toBeNull();
    expect((screen.getByRole("button", { name: "Set this role's pay" }) as HTMLButtonElement).disabled).toBe(true);
    expect(calls.some((c) => c.method === "PUT")).toBe(false);
  });

  it("a save from anywhere else carries no record of Sera", async () => {
    const calls: Array<{ method?: string; body?: any }> = [];
    const call = vi.fn(async (path: string, body?: any, method?: string) => {
      calls.push({ method, body });
      if (path === "/valuation/model") return { model: MODEL, eeMeaningWritten: true, tokenNames: {} };
      return { state: "set" };
    });
    render(<RolePayWithEngine role={{ id: "cook", name: "Cook" }} call={call} onSaved={() => {}} />);
    const user = userEvent.setup();
    await screen.findByText("Kind of work");
    await user.type(screen.getByLabelText(/Estimated effort for the moon/), "20");
    await user.click(screen.getByRole("button", { name: "Show the suggestion" }));
    await user.click(screen.getByLabelText(/^Use the suggestion,/));
    await user.click(screen.getByRole("button", { name: "Set this role's pay" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    expect(calls.find((c) => c.method === "PUT")!.body.note).toBeUndefined();
  });
});
