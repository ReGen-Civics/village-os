// @vitest-environment jsdom
/**
 * The Compare section on screen (the lead, 20 Nov 2026): the rule said in one line, a fifth tick refused in a plain
 * line, the columns lining up, and the split helper silent until a person marks who is qualified.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CompareItem, ComparePayload } from "@shared/proposalCompare";
import CompareTab from "./CompareTab";

const item = (n: number, extra: Partial<CompareItem> = {}): CompareItem => ({
  key: `op:op-${n}:r-garden`,
  kind: "role",
  way: "full",
  ref: `op-${n}`,
  who: `Person ${n}`,
  whoKind: "person",
  title: "Garden steward",
  roleId: "r-garden",
  category: "circle:c-land",
  commitmentPct: 50,
  aim: "",
  deliverables: [{ text: n % 2 ? "Run the weekly garden circle" : "Keep the seed bank catalogued", from: "outcome" }, { text: `Own piece ${n}`, from: "value" }],
  terms: null,
  dates: { earliestStart: null, startsOn: null, termStarts: null, termEnds: null, received: "2026-11-10" },
  href: `/open-proposals/op-${n}`,
  ...extra,
});

const PAYLOAD: ComparePayload = {
  items: [1, 2, 3, 4, 5].map((n) => item(n)).concat(item(6, { key: "op:op-6:r-cook", roleId: "r-cook", title: "Cook", category: "circle:c-kitchen" })),
  roles: [{ id: "r-garden", name: "Garden steward", category: "circle:c-land", outcomes: ["Run the weekly garden circle"], commitmentTarget: 100, places: 1, taken: 0 }],
  categories: [
    { key: "circle:c-land", label: "Land", count: 5 },
    { key: "circle:c-kitchen", label: "Kitchen", count: 1 },
  ],
  readsPay: false,
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(PAYLOAD), { status: 200, headers: { "Content-Type": "application/json" } })));
});
afterEach(() => vi.unstubAllGlobals());

const pick = (key: string) => document.querySelector(`[data-compare-pick="${key}"]`) as HTMLInputElement;

describe("the Compare section", () => {
  it("says the rule on screen in one line", async () => {
    render(<CompareTab password="pw" />);
    await waitFor(() => expect(document.querySelector("[data-compare-list]")).toBeTruthy());
    expect(document.querySelector("[data-compare-rule]")?.textContent).toMatch(/No AI chooses, ranks or scores anyone here/);
  });

  it("refuses a fifth tick and one from another category with a plain line, and keeps four", async () => {
    render(<CompareTab password="pw" />);
    await waitFor(() => expect(pick("op:op-1:r-garden")).toBeTruthy());
    for (const n of [1, 2, 3, 4]) await userEvent.click(pick(`op:op-${n}:r-garden`));
    await userEvent.click(pick("op:op-5:r-garden"));
    expect(document.querySelector("[data-compare-problem]")?.textContent).toMatch(/up to 4 at a time/);
    expect(pick("op:op-5:r-garden").checked).toBe(false);
    await userEvent.click(pick("op:op-4:r-garden"));
    await userEvent.click(pick("op:op-6:r-cook"));
    expect(document.querySelector("[data-compare-problem]")?.textContent).toMatch(/one category at a time/);
    expect(document.querySelectorAll('[data-compare-cell="who"]')).toHaveLength(3);
  });

  it("filters the list by category", async () => {
    render(<CompareTab password="pw" />);
    await waitFor(() => expect(pick("op:op-1:r-garden")).toBeTruthy());
    await userEvent.click(screen.getByRole("button", { name: "Kitchen (1)" }));
    const list = document.querySelector("[data-compare-list]") as HTMLElement;
    expect(within(list).getAllByRole("checkbox")).toHaveLength(1);
  });

  it("lines the same field up across the columns, and maps nothing until a person marks who is qualified", async () => {
    render(<CompareTab password="pw" />);
    await waitFor(() => expect(pick("op:op-1:r-garden")).toBeTruthy());
    await userEvent.click(pick("op:op-1:r-garden"));
    await userEvent.click(pick("op:op-3:r-garden"));
    const grid = document.querySelector("[data-compare-grid]") as HTMLElement;
    const cells = Array.from(grid.children).map((c) => (c as HTMLElement).dataset.compareCell ?? "label");
    // label, then one cell per proposal, row after row.
    expect(cells.slice(0, 6)).toEqual(["label", "who", "who", "label", "title", "title"]);
    expect(document.querySelector("[data-compare-map]")).toBeNull();
    await userEvent.click(document.querySelector('[data-compare-qualified="op:op-1:r-garden"]') as HTMLInputElement);
    await userEvent.click(document.querySelector('[data-compare-qualified="op:op-3:r-garden"]') as HTMLInputElement);
    const overlaps = document.querySelector("[data-compare-overlaps]")?.textContent ?? "";
    expect(overlaps).toMatch(/Person 1 and Person 3 both offered: Run the weekly garden circle/);
    expect(document.querySelectorAll("[data-compare-split-row]")).toHaveLength(2);
    expect(document.querySelector("[data-compare-commitment]")?.getAttribute("data-compare-commitment")).toBe("fits");
    // Two people for a role with one place: the page says the Org Chart needs a second place first.
    expect(document.querySelector("[data-compare-places]")?.textContent).toMatch(/Org Chart/);
  });
});
