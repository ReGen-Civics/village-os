// @vitest-environment jsdom
/**
 * The full-access switch on Admin, Players, Agents (the lead, 20 Nov 2026). What each case pins:
 *
 *   1. It shows one control with its warning line, off, and saving a role sends that role's id after a confirm.
 *   2. Turning it off sends null.
 *   3. A server without the switch, or one that refuses, renders nothing.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AgentFullAccessPanel from "./AgentFullAccessPanel";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const ROLES = [{ id: "r-ops", name: "Operations Lead Steward" }, { id: "r-garden", name: "Gardener" }];

function stub(answer: any, status = 200) {
  const calls: Array<{ method: string; body: any }> = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ method, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (status !== 200) return { ok: false, status, json: async () => ({ error: "auth_required" }) };
    return { ok: true, status: 200, json: async () => (method === "PUT" ? { on: true } : answer) };
  }));
  return calls;
}

describe("the full-access switch", () => {
  it("shows one control with its warning, and saves the chosen role after a confirm", async () => {
    const calls = stub({ on: false, roleId: null, roleName: null, setBy: null, setAt: null, roles: ROLES });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<AgentFullAccessPanel password="tok" />);
    const select = (await screen.findByLabelText("Role whose agent has full access")) as HTMLSelectElement;
    expect(screen.getByRole("note").textContent).toContain("every email names who it goes to before the yes. Money, secrets, erasure, the veto and the agent accounts stay a person's act.");
    expect(select.value).toBe("");
    fireEvent.change(select, { target: { value: "r-ops" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    expect(calls.find((c) => c.method === "PUT")?.body).toEqual({ roleId: "r-ops" });
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("Operations Lead Steward"));
  });

  it("turns it off by sending null", async () => {
    const calls = stub({ on: true, roleId: "r-ops", roleName: "Operations Lead Steward", setBy: "Fern Oak", setAt: "2026-11-20T10:00:00.000Z", roles: ROLES });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<AgentFullAccessPanel password="tok" />);
    expect(await screen.findByText(/On for the agent of whoever holds Operations Lead Steward/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Role whose agent has full access"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls.find((c) => c.method === "PUT")?.body).toEqual({ roleId: null }));
  });

  it("renders nothing for a server without the switch, or one that refuses", async () => {
    stub({});
    const { container } = render(<AgentFullAccessPanel password="tok" />);
    await new Promise((r) => setTimeout(r, 20));
    expect(container.textContent).toBe("");
    cleanup();
    stub(null, 401);
    const second = render(<AgentFullAccessPanel password="tok" />);
    await new Promise((r) => setTimeout(r, 20));
    expect(second.container.textContent).toBe("");
  });
});
