// @vitest-environment jsdom
/**
 * A PAY ROW IN SERA'S LIST: who sets pay, and, for a reader the pay route lets through, the role's own pay setter.
 *
 * Rye, 27 Nov 2026: "Sera, can also make suggestions for pay and new roles, but with our confirmation." Nothing in
 * the list writes pay. The confirmation is the role's own pay setter, opened under the row, by that person, behind
 * the pay route's own gate. A reader that gate would refuse is shown who sets pay and nothing to press, as before.
 * A pay row still has no tick, and opening the setter sends nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/gameApi", () => ({ authToken: () => "a-token" }));
// The setter itself is held by RolePayWithEngine.test.tsx. Here it is a stand-in that says what it was handed.
vi.mock("@/components/review/SeraPaySetter", () => ({
  default: (props: { role: { id: string; name: string }; sera: unknown; onSet?: () => void }) => (
    <div data-testid="setter" data-role={props.role.id} data-name={props.role.name} data-sera={JSON.stringify(props.sera)}>
      <button type="button" onClick={() => props.onSet?.()}>stand-in: pay was set</button>
    </div>
  ),
}));

import { RowActions } from "./SeraActs";
import { forgetPayDoor } from "@/lib/seraPay";
import { listed } from "@/test/seraDifferences";
import type { Door } from "@shared/seraDecides";

const TREASURER: Door = { by: "holders", labels: ["Treasurer (Rick)"], more: 0, stewards: false, others: 0, admins: false };
const payRow = (ourId: string | null = "r-cook", name = "Cook") =>
  listed({ kind: "pay", field: "pay", ours: "none", sera: "stipend|1200", bulkEligible: false, takeable: false, params: { model: "Stipend", monthlyUsd: 1200, standing: "pending" }, subject: { ourId, name } });

function serveDoor(answer: { status: number; body: unknown } | "offline") {
  const asked: Array<{ url: string; method: string }> = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: { method?: string }) => {
    asked.push({ url: String(url), method: init?.method ?? "GET" });
    if (answer === "offline") throw new Error("offline");
    return { ok: answer.status >= 200 && answer.status < 300, status: answer.status, json: async () => answer.body };
  }));
  return asked;
}
const door = (payDoor: string | null) => ({ status: 200, body: { model: {}, payDoor } });
const draw = (rows = [payRow()], pay: Door | null = TREASURER, acts: unknown = {}) =>
  render(
    <>
      {rows.map((d) => (
        <RowActions key={d.key} d={d} acts={acts as never} agent="Sera" pay={pay} layout="card" />
      ))}
    </>,
  );
/** The read has answered and the row has drawn what it will draw. */
const settled = async (asked: unknown[]) => {
  await waitFor(() => expect(asked.length).toBeGreaterThan(0));
  await new Promise((r) => setTimeout(r, 0));
};
// The opener has its own name. "Set this role's pay" is the setter's last button, and only that one sends.
const OPEN = "Open this role's pay";

beforeEach(() => forgetPayDoor());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("a pay row in Sera's list", () => {
  it("gives a reader the pay route lets through one control that opens the role's pay setter, beside who sets pay", async () => {
    const asked = serveDoor(door("holder"));
    const d = payRow();
    draw([d]);
    const open = await screen.findByRole("button", { name: OPEN });
    expect(open.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText("The Treasurer (Rick) sets pay.")).toBeTruthy();
    expect(screen.getByText("Nothing is set from this list. This opens the role's pay, where you set it.")).toBeTruthy();
    // Closed until asked, and never a tick: the list itself takes nothing.
    expect(screen.queryByTestId("setter")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();

    fireEvent.click(open);
    const setter = await screen.findByTestId("setter");
    // The setter is this row's role, and is handed what Sera lists for it: her words and her figure.
    expect(setter.getAttribute("data-role")).toBe("r-cook");
    expect(setter.getAttribute("data-name")).toBe("Cook");
    expect(JSON.parse(setter.getAttribute("data-sera")!)).toEqual({ agent: "Sera", sentence: d.words.sentence, monthlyUsd: 1200 });
    expect(screen.getByRole("button", { name: "Close this role's pay" }).getAttribute("aria-expanded")).toBe("true");
    // Opening it asked who may set pay and wrote nothing.
    expect(asked.every((a) => a.method === "GET")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Close this role's pay" }));
    expect(screen.queryByTestId("setter")).toBeNull();
  });

  it("gives it to an admin while the admin's door stands: before launch, and with no steward seated", async () => {
    for (const standing of ["admin-before-launch", "admin-no-steward"]) {
      forgetPayDoor();
      serveDoor(door(standing));
      draw();
      expect(await screen.findByRole("button", { name: OPEN }), standing).toBeTruthy();
      cleanup();
    }
  });

  it("shows a reader the pay route would refuse who sets pay, and nothing to press", async () => {
    for (const answer of [door(null), { status: 401, body: { error: "auth_required" } }, { status: 500, body: {} }, "offline" as const]) {
      forgetPayDoor();
      const asked = serveDoor(answer);
      draw();
      await settled(asked);
      expect(screen.getByText("The Treasurer (Rick) sets pay.")).toBeTruthy();
      expect(screen.queryByRole("button")).toBeNull();
      expect(screen.queryByRole("link")).toBeNull();
      expect(screen.queryByText(/Nothing is set from this list/)).toBeNull();
      cleanup();
    }
  });

  it("where nobody holds the power to set pay it says so and offers nothing", async () => {
    const asked = serveDoor(door(null));
    draw([payRow()], { by: "vote" });
    await settled(asked);
    expect(screen.getByText("Nobody holds the power to set pay right now.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("a pay row tied to no role here has nothing to open", async () => {
    const asked = serveDoor(door("holder"));
    draw([payRow(null)]);
    await settled(asked);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("asks once however many pay rows are drawn, and each row opens its own role", async () => {
    const asked = serveDoor(door("holder"));
    draw([payRow("r-cook", "Cook"), payRow("r-baker", "Baker"), payRow("r-gardener", "Gardener")]);
    await waitFor(() => expect(screen.getAllByRole("button", { name: OPEN })).toHaveLength(3));
    expect(asked).toEqual([{ url: "/api/valuation/model", method: "GET" }]);
    fireEvent.click(screen.getAllByRole("button", { name: OPEN })[1]);
    expect((await screen.findByTestId("setter")).getAttribute("data-role")).toBe("r-baker");
    expect(screen.getAllByTestId("setter")).toHaveLength(1);
  });

  it("a pane that draws one row at a time starts each role fresh: moving to another row closes the setter that was open", async () => {
    serveDoor(door("holder"));
    const cook = payRow("r-cook", "Cook");
    const baker = payRow("r-baker", "Baker");
    // The compare pane (SeraDifferences.tsx) and the phone's pane (SeraRows.tsx) draw the selected row in one place,
    // with no key of their own, so the row that is drawn changes under the same element.
    const pane = (d: ReturnType<typeof payRow>) => <RowActions d={d} acts={{} as never} agent="Sera" pay={TREASURER} layout="compare" />;
    const { rerender } = render(pane(cook));
    fireEvent.click(await screen.findByRole("button", { name: OPEN }));
    expect((await screen.findByTestId("setter")).getAttribute("data-role")).toBe("r-cook");
    rerender(pane(baker));
    // A setter opened for Cook, with whatever was typed and answered there, never becomes Baker's.
    expect(screen.queryByTestId("setter")).toBeNull();
    expect((await screen.findByRole("button", { name: OPEN })).getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: OPEN }));
    expect((await screen.findByTestId("setter")).getAttribute("data-role")).toBe("r-baker");
  });

  it("once pay is set there, the list is read again so the row settles", async () => {
    serveDoor(door("holder"));
    const reload = vi.fn(async () => {});
    draw([payRow()], TREASURER, { reload });
    fireEvent.click(await screen.findByRole("button", { name: OPEN }));
    fireEvent.click(await screen.findByRole("button", { name: "stand-in: pay was set" }));
    expect(reload).toHaveBeenCalledOnce();
  });
});
