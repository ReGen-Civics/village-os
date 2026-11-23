// @vitest-environment jsdom
/**
 * The operations report email in Notifications: offered to admins and founders
 * (the only people the daily failed-actions report goes to), daily until they
 * choose, and saved as `opsEmail` through the same PUT as every other cadence.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/modules/ModuleProvider", () => ({ useModuleOn: () => false }));
vi.mock("@/components/EmailFromVillage", () => ({ default: () => null }));
vi.mock("@/components/auth/ConfirmWithGoogle", () => ({
  useIdentityConfirm: () => ({ confirmed: false, returnError: "", reset: () => {} }),
  IdentityConfirmField: () => null,
  identityBody: () => ({}),
  identityReady: () => false,
}));

import NotifyPrefsPanel from "@/components/NotifyPrefsPanel";

const reply = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;

const fetchMock = vi.fn();
const notify = { emailsOff: false, questsEmail: "immediate", rolesEmail: "immediate", gratitudeEmail: "daily", mentionsEmail: "immediate", repliesEmail: "immediate", messagesEmail: "immediate", governanceEmail: "daily", celebrations: "on", opsEmail: "daily" };
let role = "admin";

beforeEach(() => {
  role = "admin";
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === "/api/profile/prefs" && init?.method === "PUT") {
      const patch = JSON.parse(String(init.body)).notify;
      return reply(200, { notify: { ...notify, ...patch } });
    }
    if (url === "/api/profile/prefs") return reply(200, { notify });
    if (url === "/api/profile") return reply(200, { contactable: true, role });
    return reply(404, {});
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("the operations report email in Notifications", () => {
  for (const r of ["admin", "founder"]) {
    it(`offers it to a ${r}, daily until chosen, and saves opsEmail`, async () => {
      role = r;
      render(<NotifyPrefsPanel />);
      const select = (await screen.findByLabelText(/Operations reports/)) as HTMLSelectElement;
      expect(select.value).toBe("daily");
      expect(Array.from(select.options).map((o) => o.textContent)).toEqual(["Daily digest", "In-app only"]);
      fireEvent.change(select, { target: { value: "off" } });
      await waitFor(() => expect(select.value).toBe("off"));
      const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
      expect(JSON.parse(String(put?.[1]?.body))).toEqual({ notify: { opsEmail: "off" } });
    });
  }

  it("is not offered to a member who does not receive the report", async () => {
    role = "member";
    render(<NotifyPrefsPanel />);
    await screen.findByText("Email me about village activity");
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => u === "/api/profile")).toBe(true));
    expect(screen.queryByLabelText(/Operations reports/)).toBeNull();
  });
});
