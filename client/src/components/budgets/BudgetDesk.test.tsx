// @vitest-environment jsdom
/**
 * The cash budget desk: what every member reads (the moon's figure and its
 * lines), the editor only when the server's door is open, and every refusal
 * as the server's sentence. The server is stubbed with the shapes
 * server/routes/budgets.ts answers.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import BudgetDesk from "./BudgetDesk";
import { SHEET_LOOK } from "./budgetLook";
import type { BudgetCall, BudgetReply } from "./budgetApi";

i18n.load("en", {});
i18n.activate("en");

const line = (over: Record<string, unknown> = {}) => ({
  id: "bl-1", label: "Garden crew pay", note: null, source: "upload", sourceLabel: null,
  periodKind: "month", periodKey: "2026-11", startsOn: "2026-11-01", endsOn: "2026-11-30",
  circleId: "@village", villageWide: true, roleId: null, category: "role_pay",
  plannedMinor: 120000, spentMinor: null, convertedMinor: 120000, currency: "USD", status: "approved",
  changedAt: null, changedAs: "Treasurer", ...over,
});

const readOf = (door: Record<string, unknown>, over: Record<string, unknown> = {}) => ({
  moon: { id: "2026-11-05", startsOn: "2026-11-05", endsOn: "2026-12-03", days: 29 },
  villageCurrency: "USD",
  lines: [line()],
  figure: { plannedMinor: 100000, committedMinor: 25000, leftMinor: 75000, currency: "USD", working: { notCounted: [] } },
  byCircle: [],
  note: null,
  mayReadCash: false,
  door,
  ...over,
});

const answer = (over: Record<string, unknown> = {}) => ({
  ok: true, code: null, message: null, written: false, revision: "rev-1",
  added: [], changed: [], withdrawn: [], unchanged: 0, refused: [], held: [], flags: [],
  door: { mayWrite: true, via: "holder" }, ...over,
});

type Handler = (path: string, body: any, method: string) => BudgetReply;
const stub = (h: Handler) => {
  const calls: Array<{ path: string; body: any; method: string }> = [];
  const call: BudgetCall = vi.fn(async (path: string, body?: unknown, method = "POST") => {
    calls.push({ path, body, method });
    return h(path, body, method);
  });
  return { call, calls };
};
const ok = (data: unknown): BudgetReply => ({ ok: true, status: 200, data });
const draw = (call: BudgetCall) => render(<I18nProvider i18n={i18n}><BudgetDesk bearer="tok" look={SHEET_LOOK} call={call} /></I18nProvider>);

describe("BudgetDesk", () => {
  it("shows a member the moon's figure and its lines, with no editor and the server's sentence for who changes it", async () => {
    const door = { mayWrite: false, code: "holders_only", message: "Only the people who hold the budget power change the budget. Suggest the change, and it goes to them." };
    const { call } = stub(() => ok(readOf(door)));
    draw(call);
    expect(await screen.findByText("$750.00")).toBeInTheDocument();
    expect(screen.getByText("$1,000.00")).toBeInTheDocument();
    expect(screen.getByText("$250.00")).toBeInTheDocument();
    expect(screen.getByText("Garden crew pay")).toBeInTheDocument();
    expect(screen.getByText(door.message)).toBeInTheDocument();
    expect(screen.queryByText("Upload a budget sheet")).toBeNull();
    expect(screen.queryByRole("button", { name: /Withdraw/ })).toBeNull();
  });

  it("says why there is no figure when the village has no currency", async () => {
    const { call } = stub(() => ok(readOf({ mayWrite: false }, { figure: null, villageCurrency: null })));
    draw(call);
    expect(await screen.findByText(/The village has no currency set yet/)).toBeInTheDocument();
  });

  it("prints the server's sentence when the read is refused, never its code", async () => {
    const { call } = stub(() => ({ ok: false, status: 403, data: { error: "members_only", message: "The budget is read by members of the village, from the member rung." } }));
    draw(call);
    expect(await screen.findByRole("alert")).toHaveTextContent("The budget is read by members of the village, from the member rung.");
    expect(screen.queryByText("members_only")).toBeNull();
  });

  it("uploads a sheet for the holder: preview, read what changes, then save the preview's revision", async () => {
    let saved = false;
    const { call, calls } = stub((path, body) => {
      if (path === "/budgets") return ok(readOf({ mayWrite: true, via: "holder" }));
      if (path === "/admin/budgets/import" && body.dryRun) {
        return ok(answer({ added: [{ row: 1, id: null, label: "Seeds", category: "materials", periodKey: "2026-11", plannedMinor: 4000, currency: "USD", status: "approved" }] }));
      }
      saved = true;
      return ok(answer({ written: true, added: [{ row: 1 }] }));
    });
    draw(call);
    fireEvent.change(await screen.findByLabelText("Or paste the cells"), { target: { value: "period,label,category,planned\n2026-11,Seeds,materials,40" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview the upload" }));
    expect(await screen.findByText("Adds Seeds: $40.00, 2026-11")).toBeInTheDocument();
    expect(calls.find((c) => c.path === "/admin/budgets/import")!.body).toMatchObject({
      dryRun: true,
      scope: null,
      lines: [{ period: "2026-11", label: "Seeds", category: "materials", planned: "40" }],
    });
    fireEvent.click(screen.getByRole("button", { name: "Save this budget" }));
    expect(await screen.findByText("Saved. 1 added, 0 changed, 0 withdrawn.")).toBeInTheDocument();
    expect(saved).toBe(true);
    expect(calls.filter((c) => c.path === "/admin/budgets/import").pop()!.body).toMatchObject({ dryRun: false, revision: "rev-1" });
  });

  it("shows each refused row with the server's sentence, and a sheet with no label column before asking the server", async () => {
    const { call, calls } = stub((path) => {
      if (path === "/budgets") return ok(readOf({ mayWrite: true, via: "holder" }));
      return ok(answer({ refused: [{ row: 1, cell: "planned", reason: "planned", message: "Write the planned amount as a number." }] }));
    });
    draw(call);
    const box = await screen.findByLabelText("Or paste the cells");
    fireEvent.change(box, { target: { value: "period,planned\n2026-11,5" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview the upload" }));
    expect(await screen.findByText("The sheet needs a label column, so every line has a name.")).toBeInTheDocument();
    expect(calls.some((c) => c.path === "/admin/budgets/import")).toBe(false);
    fireEvent.change(box, { target: { value: "label,planned\nSeeds,lots" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview the upload" }));
    expect(await screen.findByText("Row 1, planned: Write the planned amount as a number.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save this budget" })).toBeDisabled();
  });

  it("adds a line by hand in one press, and shows the door's sentence when the write is refused", async () => {
    const { call, calls } = stub((path, body) => {
      if (path === "/budgets") return ok(readOf({ mayWrite: true, via: "admin_before_launch" }));
      if (body.dryRun) return ok(answer({ added: [{ row: 1, id: null, label: "Tools", category: "other", periodKey: "2026-11-05", plannedMinor: 500, currency: "USD", status: "approved" }] }));
      return { ok: false, status: 409, data: { error: "The village holds the budget power, so a change to the budget goes to a vote. Suggest the change.", code: "village_holds_it" } };
    });
    draw(call);
    fireEvent.change(await screen.findByLabelText("Label", { selector: "#budget-add-label" }), { target: { value: "Tools" } });
    fireEvent.change(screen.getByLabelText("Planned amount", { selector: "#budget-add-planned" }), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Add the line" }));
    expect(await screen.findByText("The village holds the budget power, so a change to the budget goes to a vote. Suggest the change.")).toBeInTheDocument();
    const writes = calls.filter((c) => c.path === "/admin/budgets/lines");
    expect(writes[0].body).toMatchObject({ dryRun: true, line: { label: "Tools", planned: "5", period: "2026-11-05", category: "role_pay", currency: "USD" } });
    expect(writes[1].body).toMatchObject({ dryRun: false, revision: "rev-1" });
  });

  it("edits only the cells that changed, and withdraws a line in one press", async () => {
    const { call, calls } = stub((path, body) => {
      if (path === "/budgets") return ok(readOf({ mayWrite: true, via: "holder" }));
      if (path.endsWith("/withdraw")) return ok(answer({ written: true }));
      if (body.dryRun) return ok(answer({ changed: [{ op: "change" }] }));
      return ok(answer({ written: true }));
    });
    draw(call);
    fireEvent.click(await screen.findByRole("button", { name: "Edit Garden crew pay" }));
    const planned = screen.getByLabelText("Planned amount", { selector: "#budget-edit-bl-1-planned" }) as HTMLInputElement;
    expect(planned.value).toBe("1200.00");
    fireEvent.change(planned, { target: { value: "1500" } });
    fireEvent.click(screen.getByRole("button", { name: "Save the change" }));
    await waitFor(() => expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(2));
    expect(calls.find((c) => c.method === "PATCH")).toMatchObject({ path: "/admin/budgets/lines/bl-1", body: { changes: { planned: "1500" }, dryRun: true } });
    fireEvent.click(await screen.findByRole("button", { name: "Withdraw Garden crew pay" }));
    expect(await screen.findByText("Withdrawn. It stops counting and stays on the record.")).toBeInTheDocument();
    expect(calls.some((c) => c.path === "/admin/budgets/lines/bl-1/withdraw")).toBe(true);
  });

  it("says plainly when the server cannot be reached during a save", async () => {
    const { call } = stub((path) => (path === "/budgets" ? ok(readOf({ mayWrite: true, via: "holder" })) : { ok: false, status: 0, data: {} }));
    draw(call);
    fireEvent.click(await screen.findByRole("button", { name: "Withdraw Garden crew pay" }));
    expect(await screen.findByText("The server could not be reached, so nothing was saved. Check the connection and try again.")).toBeInTheDocument();
  });
});
