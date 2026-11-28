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
 * CONFIRMING ONE OF SERA'S PAY SUGGESTIONS happens HERE, in the role's own pay setter, never in her list (Rye,
 * 27 Nov 2026: "Sera, can also make suggestions for pay and new roles, but with our confirmation."). What she lists
 * is shown beside the engine's suggestion, her figure is a choice the person may make, and the route's own rules
 * (the band, the reason, the second signer) judge it like any other figure.
 */
describe("setting pay from one of Sera's suggestions", () => {
  const USD = { ...modelForVillage("USD"), version: 1, bands: [{ key: "general", label: "General help", hourValueMinor: 2500, source: { sentence: "Set by the village", date: "2026-10-31" } }] };
  const SERA = { agent: "Sera", sentence: "Sera lists Cook's pay as a stipend of US$1,200 a month for the whole role, still pending in Sera. This village has no pay set for it.", monthlyUsd: 1200 as number | null };
  const STORED = { band: "general", estimatedHours: 40, estimateLow: 30 as number | null, estimateHigh: 55 as number | null, responsibility: "none" as string | null, setAt: "2026-10-30T12:00:00.000Z" };
  const HERS = "Use the figure Sera lists, $1,200 a month, as this moon's pay";

  const open = (props: { sera?: typeof SERA | null; stored?: typeof STORED | null; model?: any }, put: (body: any) => any = () => ({ state: "set" })) => {
    const calls: Array<{ path: string; body: any; method?: string }> = [];
    const call = vi.fn(async (path: string, body?: any, method?: string) => {
      calls.push({ path, body, method });
      if (path === "/valuation/model") return { model: props.model ?? USD, eeMeaningWritten: true, tokenNames: {} };
      return put(body);
    });
    render(<RolePayWithEngine role={{ id: "cook", name: "Cook" }} call={call} onSaved={() => {}} sera={props.sera ?? null} stored={props.stored ?? null} />);
    return calls;
  };
  const reveal = async (user: ReturnType<typeof userEvent.setup>, hours = "40") => {
    await screen.findByText("Kind of work");
    await user.type(screen.getByLabelText(/Estimated effort for the moon/), hours);
    await user.click(screen.getByRole("button", { name: "Show the suggestion" }));
  };

  it("shows what she lists only once the suggestion shows, and offers her figure as a choice that is never made for the person", async () => {
    const calls = open({ sera: SERA });
    const user = userEvent.setup();
    await screen.findByText("Kind of work");
    // Before the suggestion shows, neither her words nor her figure are on the screen.
    expect(screen.queryByText(SERA.sentence)).toBeNull();
    expect(screen.queryByLabelText(HERS)).toBeNull();
    await reveal(user);
    expect(screen.getByText(SERA.sentence)).toBeTruthy();
    const hers = screen.getByLabelText(HERS) as HTMLInputElement;
    expect(hers.checked).toBe(false);
    expect((screen.getByLabelText(/^Use the suggestion,/) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByRole("button", { name: "Set this role's pay" }) as HTMLButtonElement).disabled).toBe(true);
    expect(calls.some((c) => c.method === "PUT")).toBe(false);
  });

  it("choosing her figure sends it with the person's own estimate, through the role's pay route", async () => {
    // She lists what the engine suggests for 40 hours of this work, to the dollar, so her figure sits inside the band.
    const suggested = (suggestValuation(USD, { kind: "role", lines: [{ band: "general", payee: "lead", estimatedHours: 40 }], responsibility: "none" }, { eeMeaningWritten: true }) as any).payees[0].expected.totalMinor as number;
    const dollars = Math.round(suggested / 100);
    const calls = open({ sera: { ...SERA, monthlyUsd: dollars } });
    const user = userEvent.setup();
    await reveal(user, "40");
    await user.click(screen.getByLabelText(/^Use the figure Sera lists, /));
    expect(screen.getByText(/inside the suggestion's band, so your word sets it/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Set this role's pay" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    const put = calls.find((c) => c.method === "PUT")!;
    expect(put.path).toBe("/org/roles/cook/pay");
    // Her figure, in this village's money, and the estimate the person gave: the server prices that estimate again.
    expect(put.body.set).toEqual({ totalMinor: dollars * 100 });
    expect(put.body.work).toMatchObject({ kind: "role", lines: [{ band: "general", estimatedHours: 40 }] });
  });

  it("her figure outside the band is asked a reason and told who signs next, like any other figure", async () => {
    const calls = open({ sera: SERA });
    const user = userEvent.setup();
    // Four hours of this work is worth far less than she lists.
    await reveal(user, "4");
    await user.click(screen.getByLabelText(HERS));
    expect(screen.getByText(/A second Treasurer or a steward then signs it/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Set this role's pay" }));
    // No reason picked: nothing is sent.
    expect(calls.some((c) => c.method === "PUT")).toBe(false);
  });

  it("in a village that does not set pay in US dollars her words are shown and her figure is not offered as the figure", async () => {
    open({ sera: SERA, model: MODEL });
    const user = userEvent.setup();
    await reveal(user, "20");
    expect(screen.getByText(SERA.sentence)).toBeTruthy();
    expect(screen.queryByLabelText(HERS)).toBeNull();
    expect(screen.getByText("Sera lists a figure in US dollars. This village sets pay in CRC, so choose the suggestion or type your own figure.")).toBeTruthy();
  });

  it("with no figure from her, her words alone", async () => {
    open({ sera: { ...SERA, sentence: "Sera lists pay for Cook.", monthlyUsd: null } });
    const user = userEvent.setup();
    await reveal(user);
    expect(screen.getByText("Sera lists pay for Cook.")).toBeTruthy();
    expect(screen.queryByLabelText(/Use the figure Sera lists/)).toBeNull();
    expect(screen.queryByText(/lists a figure in US dollars/)).toBeNull();
  });

  it("offers the estimate from the last time this role's pay was set, shows it, and fills nothing until the person asks", async () => {
    open({ sera: SERA, stored: STORED });
    const user = userEvent.setup();
    await screen.findByText("Kind of work");
    const offer = screen.getByTestId("stored-estimate");
    expect(offer.textContent).toContain("The last time this role's pay was set, the estimate was General help, 40 hours for the moon. It could be as little as 30 or as much as 55.");
    const hours = screen.getByLabelText(/Estimated effort for the moon/) as HTMLInputElement;
    expect(hours.value).toBe("");
    await user.click(screen.getByRole("button", { name: "Use that estimate" }));
    expect(hours.value).toBe("40");
    expect((screen.getByLabelText("Could be as little as") as HTMLInputElement).value).toBe("30");
    expect((screen.getByLabelText("Or as much as") as HTMLInputElement).value).toBe("55");
    // The estimate is filled in where the person can read and change it; no figure is chosen.
    expect((screen.getByRole("button", { name: "Show the suggestion" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole("button", { name: "Set this role's pay" })).toBeNull();
  });

  it("offers no stored estimate for a kind of work the village no longer has, and none when there is none", async () => {
    open({ stored: { ...STORED, band: "retired-band" } });
    await screen.findByText("Kind of work");
    expect(screen.queryByTestId("stored-estimate")).toBeNull();
    expect(screen.queryByRole("button", { name: "Use that estimate" })).toBeNull();
  });
});
