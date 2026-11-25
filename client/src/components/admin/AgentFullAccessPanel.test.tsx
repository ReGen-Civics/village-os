// @vitest-environment jsdom
/**
 * The full-access switch on Admin, Players, Agents (the lead, 20 Nov 2026). What each case pins:
 *
 *   1. It shows one control with its warning line, off, and saving a role sends that role's id after a confirm.
 *   2. Turning it off sends null.
 *   3. A server without the switch, or one that refuses, renders nothing.
 *   4. Reads open (25 Nov 2026): shown beside the switch, off, with what stays closed; ticking it sends on: true to its
 *      own route after a confirm; it cannot be opened while no role is named; a server without it shows no second switch.
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
  const calls: Array<{ method: string; body: any; url: string }> = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ method, url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null });
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

describe("reads open, beside the switch", () => {
  const ON = { on: true, roleId: "r-ops", roleName: "Operations Lead Steward", setBy: "Fern Oak", setAt: "2026-11-20T10:00:00.000Z", roles: ROLES };

  it("shows the second switch off, says what stays closed, and opens reads through its own route after a confirm", async () => {
    const calls = stub({ ...ON, readsOpen: false, readsSetBy: null });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<AgentFullAccessPanel password="tok" />);
    const box = (await screen.findByLabelText("Reads open for the full-access role's agent")) as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(document.body.textContent).toContain("as a plain member reads them");
    expect(document.body.textContent).toContain("Secrets and keys, money and pay, applicant data, members' contact details and legal names, sign-in and tokens, the agent list, voice recordings and erasure records stay closed.");
    fireEvent.click(box);
    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    const put = calls.find((c) => c.method === "PUT")!;
    expect(put.url).toContain("/admin/agent-accounts/full-access/reads-open");
    expect(put.body).toEqual({ on: true });
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("Operations Lead Steward"));
  });

  it("sends nothing when the confirm is declined, and cannot be opened while no role is named", async () => {
    const calls = stub({ ...ON, readsOpen: false });
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<AgentFullAccessPanel password="tok" />);
    fireEvent.click(await screen.findByLabelText("Reads open for the full-access role's agent"));
    await new Promise((r) => setTimeout(r, 20));
    expect(calls.some((c) => c.method === "PUT")).toBe(false);
    cleanup();
    stub({ on: false, roleId: null, roleName: null, setBy: null, setAt: null, roles: ROLES, readsOpen: false });
    render(<AgentFullAccessPanel password="tok" />);
    expect(((await screen.findByLabelText("Reads open for the full-access role's agent")) as HTMLInputElement).disabled).toBe(true);
  });

  it("shows who opened reads, and a server without reads open shows no second switch", async () => {
    stub({ ...ON, readsOpen: true, readsSetBy: "Fern Oak" });
    render(<AgentFullAccessPanel password="tok" />);
    expect(await screen.findByText(/Open\. Set by Fern Oak\./)).toBeTruthy();
    cleanup();
    stub(ON);
    render(<AgentFullAccessPanel password="tok" />);
    await screen.findByLabelText("Role whose agent has full access");
    expect(screen.queryByLabelText("Reads open for the full-access role's agent")).toBeNull();
  });
});
