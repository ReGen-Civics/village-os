// @vitest-environment jsdom
/**
 * TERMS WE OFFER (audit M5, 11 Nov 2026): typed counter-offer words are never lost quietly. A change
 * puts the house save bar up, leaving the page asks first while it waits, and saving from the bar
 * posts the revision the panel read.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { resetUnsavedForTests, unsavedCount } from "@/lib/unsavedChanges";
import TermsWeOffer, { type ServedDeciderOffer } from "./TermsWeOffer";

const OFFER: ServedDeciderOffer = {
  revision: 1,
  rows: [{ key: "ending", label: "Ending", suggested: "One moon's notice.", current: "One moon's notice.", theirs: { choice: "talk", note: "Two?" }, state: "talk", changed: false }],
  theirCommitment: 60,
  roleCommitment: 100,
  ourCommitment: 60,
  history: [],
  openTalks: ["Ending"],
};

const bar = () => document.querySelector("[data-save-bar]");

describe("the counter-offer keeps what was typed", () => {
  afterEach(() => {
    cleanup();
    resetUnsavedForTests();
    vi.unstubAllGlobals();
  });

  it("puts the save bar up on a change, guards leaving, and saves revision 2 from the bar", async () => {
    const posted: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: { body?: string }) => {
        posted.push(JSON.parse(String(init?.body ?? "{}")));
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
      }),
    );
    const saved = vi.fn();
    render(<TermsWeOffer offer={OFFER} mayEdit savePath="/api/x/terms" onSaved={saved} />);
    expect(bar()).toBeNull();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Two moons' notice." } });
    await waitFor(() => expect(bar()).not.toBeNull());
    expect(unsavedCount()).toBe(1);
    expect(bar()?.textContent).toContain("Revision 2 of the terms");
    const inBar = (bar() as HTMLElement).querySelectorAll("button");
    fireEvent.click(Array.from(inBar).find((b) => b.textContent === "Save") as HTMLButtonElement);
    await waitFor(() => expect(saved).toHaveBeenCalled());
    expect(posted[0]).toMatchObject({ expectedRevision: 1, words: { ending: "Two moons' notice." } });
    // The panel clears its edits, then calls onSaved; the save bar lets go of the change on the render after, so wait
    // for it (CI, 21 Nov 2026: read in the same tick as onSaved it was still 1 on a busy runner).
    await waitFor(() => expect(unsavedCount()).toBe(0));
  });

  it("counters each role's commitment and price on its own, and posts them with the revision (the lead, 18 Nov 2026)", async () => {
    const posted: any[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: { body?: string }) => {
        posted.push(JSON.parse(String(init?.body ?? "{}")));
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
      }),
    );
    const ROLES: ServedDeciderOffer["roles"] = [
      { roleId: "r1", name: "Gate Keeper", first: true, theirCommitment: 60, ourCommitment: 60, commitmentChanged: false, commitmentState: "accept", ask: { kind: "amount", monthly: 5000 }, ceiling: { amount: 10000, currency: "USD", per: "month" }, ourPrice: 5000, priceChanged: false, priceState: "accept" },
      { roleId: "r2", name: "Well Keeper", first: false, theirCommitment: 40, ourCommitment: 40, commitmentChanged: false, commitmentState: "accept", ask: null, ceiling: { amount: 8000, currency: "USD", per: "month" }, ourPrice: null, priceChanged: false, priceState: "accept" },
    ];
    render(<TermsWeOffer offer={{ ...OFFER, roles: ROLES }} mayEdit savePath="/api/x/terms" onSaved={() => {}} />);
    // The first role's commitment is countered above, with the rest of the terms: no second control for it.
    expect(screen.queryByLabelText("The commitment we'd agree on for Gate Keeper")).toBeNull();
    fireEvent.change(screen.getByLabelText("The commitment we'd agree on for Well Keeper"), { target: { value: "60" } });
    fireEvent.change(screen.getByLabelText("The price we'd agree on for Well Keeper, each month"), { target: { value: "4,500" } });
    expect(document.querySelector('[data-role-counter="r2"]')?.textContent).toContain("They asked no price of their own.");
    fireEvent.click(screen.getByRole("button", { name: "Save revision 2" }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({ expectedRevision: 1, roles: [{ roleId: "r2", commitmentPct: 60, price: 4500 }] });
  });

  it("types a commitment the Compare split suggests into the counter-offer, sends nothing until Save, and posts it then (the lead, 20 Nov 2026)", async () => {
    const posted: any[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: { body?: string }) => {
        posted.push(JSON.parse(String(init?.body ?? "{}")));
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
      }),
    );
    render(<TermsWeOffer offer={OFFER} mayEdit savePath="/api/x/terms" onSaved={() => {}} prefill={{ commitmentPct: 40 }} />);
    await waitFor(() => expect(bar()).not.toBeNull());
    expect(posted).toEqual([]);
    expect(unsavedCount()).toBe(1);
    fireEvent.click(Array.from((bar() as HTMLElement).querySelectorAll("button")).find((b) => b.textContent === "Save") as HTMLButtonElement);
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({ expectedRevision: 1, commitmentPct: 40 });
  });

  it("CONTROL: a reader who may not edit gets no prefill and no save bar", () => {
    render(<TermsWeOffer offer={OFFER} mayEdit={false} savePath="/api/x/terms" onSaved={() => {}} prefill={{ commitmentPct: 40 }} />);
    expect(bar()).toBeNull();
    expect(unsavedCount()).toBe(0);
  });
});

describe("the over-limit confirm step (the lead, 20 Nov 2026)", () => {
  it("asks in the lead's exact words, names the numbers, and only a tick says yes", async () => {
    const { OverLimitWarning } = await import("./TermsWeOffer");
    const { OVER_LIMIT_WORDS } = await import("@shared/commitmentLimit");
    const seen: boolean[] = [];
    render(<OverLimitWarning over={{ ask: OVER_LIMIT_WORDS.ask, roles: [{ roleId: "r", name: "Land Steward", used: 90, adding: 30, target: 100, words: "" }] }} confirmed={false} onConfirm={(v) => seen.push(v)} />);
    const box = document.querySelector("[data-over-limit]") as HTMLElement;
    expect(box.textContent).toContain(OVER_LIMIT_WORDS.ask);
    expect(box.textContent).toContain("Land Steward: 90% is given already, this adds 30%, and the role's limit is 100%.");
    fireEvent.click(document.querySelector("[data-over-limit-confirm]") as HTMLInputElement);
    expect(seen).toEqual([true]);
    cleanup();
  });
  it("draws nothing when no role is above its limit", async () => {
    const { OverLimitWarning } = await import("./TermsWeOffer");
    render(<OverLimitWarning over={null} confirmed={false} onConfirm={() => {}} />);
    expect(document.querySelector("[data-over-limit]")).toBeNull();
    cleanup();
  });
});
