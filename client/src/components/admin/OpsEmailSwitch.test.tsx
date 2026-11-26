// @vitest-environment jsdom
/**
 * The admin's switch for another member's operations report email: it starts
 * from what the roster says, PUTs `{opsEmail}` to the member's own route, and
 * keeps the change on the page's one save bar, in the server's words, when
 * the server refuses.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { resetUnsavedForTests } from "@/lib/unsavedChanges";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import OpsEmailSwitch from "./OpsEmailSwitch";

const fetchMock = vi.fn();
const reply = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  resetUnsavedForTests();
  vi.unstubAllGlobals();
});

const barSave = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
  });
};

describe("OpsEmailSwitch", () => {
  it("starts daily, and off PUTs to the member's ops-email route", async () => {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => reply(200, { userId: "m-1", opsEmail: JSON.parse(String(init?.body)).opsEmail }));
    render(<OpsEmailSwitch userId="m-1" initial={undefined} password="" />);
    const select = screen.getByLabelText("Operations report email") as HTMLSelectElement;
    expect(select.value).toBe("daily");
    fireEvent.change(select, { target: { value: "off" } });
    // Nothing is sent until the one save bar's Save.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await screen.findByText("1 change not saved yet")).toBeTruthy();
    await barSave();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/admin\/players\/m-1\/ops-email$/);
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({ opsEmail: "off" });
    await waitFor(() => expect(select.value).toBe("off"));
  });

  it("keeps the change on the bar, in the server's words, when the server refuses", async () => {
    fetchMock.mockResolvedValue(reply(400, { error: "opsEmail is daily or off." }));
    render(<OpsEmailSwitch userId="m-1" initial="off" password="" />);
    const select = screen.getByLabelText("Operations report email") as HTMLSelectElement;
    expect(select.value).toBe("off");
    fireEvent.change(select, { target: { value: "daily" } });
    await barSave();
    expect(await screen.findByText(/opsEmail is daily or off\./)).toBeTruthy();
    expect(screen.getByText("1 change not saved yet")).toBeTruthy();
    // Discard puts the stored value back.
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(select.value).toBe("off"));
  });
});
