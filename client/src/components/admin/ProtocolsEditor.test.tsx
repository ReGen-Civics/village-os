// @vitest-environment jsdom
/**
 * The protocols card in Admin: a draft is checked in the browser by the same
 * rule the server runs before anything is sent, and an import is shown (with
 * its problems by name) before it can be saved.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("./ModuleConfigPanels", () => ({
  useModuleConfig: () => ({ config: { showInstallCard: true }, lifecycle: "off", loading: false, save: vi.fn(async () => true), reload: vi.fn() }),
}));

import ProtocolsEditor from "./ProtocolsEditor";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async (url: string) => {
    if (url === "/api/admin/protocols") return json({ protocols: [], roles: [{ id: "role-key", title: "Keyholder" }], settings: { showInstallCard: true } });
    if (url === "/api/admin/protocols/import")
      return json({ plan: [], problems: ["Add this role to the org chart first, or edit the file: Night warden."], missingRoles: ["Night warden"], saved: false }, 400);
    return json({});
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("the protocols card", () => {
  it("refuses a nameless draft in the browser and sends nothing", async () => {
    render(<ProtocolsEditor password="tok" />);
    fireEvent.click(await screen.findByRole("button", { name: "New protocol" }));
    fireEvent.click(screen.getByRole("button", { name: "Save protocol" }));
    expect(await screen.findByText("Give the protocol a name.")).toBeTruthy();
    expect(fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "PUT")).toHaveLength(0);
  });

  it("offers the org chart's roles for a step", async () => {
    render(<ProtocolsEditor password="tok" />);
    fireEvent.click(await screen.findByRole("button", { name: "New protocol" }));
    expect(screen.getByRole("option", { name: "Keyholder" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Any member" })).toBeTruthy();
  });

  it("an import names its problem and cannot be saved", async () => {
    render(<ProtocolsEditor password="tok" />);
    fireEvent.change(await screen.findByLabelText("Or paste the file here"), { target: { value: '{"protocols":[]}' } });
    fireEvent.click(screen.getByRole("button", { name: "Check the file" }));
    expect(await screen.findByText(/Night warden/)).toBeTruthy();
    await waitFor(() => expect((screen.getByRole("button", { name: "Import" }) as HTMLButtonElement).disabled).toBe(true));
  });
});
