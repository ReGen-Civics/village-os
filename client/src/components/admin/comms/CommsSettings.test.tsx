// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";
import { DEFAULT_CONSENT_TEXT, DEFAULT_RECAP_QUESTIONS, SETUP_KEYS } from "@shared/comms/settings";
import CommsSettings from "@/components/admin/comms/CommsSettings";
import { TEST_POLL_MS } from "@/components/admin/comms/MailNow";

/**
 * Comms Settings (the comms build spec 5.15): the setup checklist with an
 * editor under every item, the dials, and Pause all. It began as the old
 * Email Settings, and that screen's behaviour is held here too: it reads the
 * same document, shows the four inboxes, and saves them back to the same route
 * with the same body.
 */

type Call = { url: string; method: string; body: any; auth: string | null };

const LABELS: Record<string, string> = {
  "api-key": "The Resend API key",
  domain: "Sending domain",
  sender: "Sender name and address",
  "delivery-reports": "Delivery reports",
  "postal-address": "Postal address for the footer",
  "reply-to": "Reply-to inbox for each path",
  "path-contacts": "Who writes back for each path",
  "consent-words": "The words beside the tick-box on public forms",
  "recap-questions": "The two recap questions",
  "who-runs-comms": "Who runs comms",
  "investor-words": "Investor words reviewed",
  "rehearsal-inbox": "Rehearsal inbox",
  "test-email": "A test email to yourself, delivered",
};
const REQUIRED = new Set(["api-key", "domain", "sender", "delivery-reports", "postal-address", "test-email"]);

/** The server's answer, for a village that has done `done` and nothing else. */
function payload(done: string[] = [], over: Record<string, unknown> = {}) {
  return {
    lifecycle: "off",
    ready: Array.from(REQUIRED).every((k) => done.includes(k)),
    checklist: SETUP_KEYS.map((key, i) => ({
      key,
      n: i + 1,
      label: LABELS[key],
      done: done.includes(key),
      required: REQUIRED.has(key),
      detail: `${LABELS[key]} detail`,
      fix: `${LABELS[key]} fix`,
    })),
    settings: {
      senderName: "",
      domain: "",
      domainId: "",
      domainStatus: "none",
      domainCheckedAt: null,
      domainConfirmedBy: null,
      postalAddress: "",
      consentText: DEFAULT_CONSENT_TEXT,
      recapQuestions: [...DEFAULT_RECAP_QUESTIONS],
      pathContacts: {},
      investorWordsReviewed: null,
      rehearsalTo: [],
      paused: false,
      webhookConnectedAt: null,
      webhookConnectedBy: null,
      webhookId: null,
    },
    key: { configured: false, source: "none", last4: null, setAt: null, setBy: null },
    webhook: {
      configured: false,
      source: "none",
      url: "https://village.example.test/api/comms/webhooks/resend",
      events: ["email.sent", "email.delivered"],
      connectedAt: null,
      connectedBy: null,
      byHand: false,
      lastReportAt: null,
    },
    sender: { line: "", source: "none", name: "", address: "" },
    paths: [
      { id: "investor", label: "Investor", inbox: "investor" },
      { id: "resident", label: "Resident", inbox: "resident" },
    ],
    members: [{ id: "u1", name: "Ada" }],
    holders: [],
    admins: ["founder@example.test"],
    testEmail: null,
    me: { email: "founder@example.test" },
    secretsKeySet: true,
    ...over,
  };
}

let calls: Call[];
let current: any;
let inboxes: Record<string, string>;

const stubFetch = () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: any, init?: any) => {
      const u = String(url);
      const method = String(init?.method ?? "GET");
      const body = init?.body ? JSON.parse(init.body) : null;
      calls.push({ url: u, method, body, auth: (init?.headers as Record<string, string> | undefined)?.Authorization ?? null });
      const answer = (status: number, json: unknown) => ({ ok: status < 400, status, json: async () => json });
      if (u.endsWith("/admin/email-config")) return method === "PUT" ? answer(200, { success: true }) : answer(200, inboxes);
      if (u.endsWith("/admin/variables")) return answer(200, { categories: [] });
      if (u.endsWith("/admin/integrations/resend_api_key")) return answer(200, { success: true, secrets: [] });
      if (u.endsWith("/admin/comms/settings") && method === "PUT") {
        if (body && "postalAddress" in body) {
          current = payload(["postal-address"], { settings: { ...current.settings, postalAddress: body.postalAddress } });
        }
        if (body && "paused" in body) current = { ...current, settings: { ...current.settings, paused: body.paused } };
        return answer(200, current);
      }
      if (u.endsWith("/admin/comms/settings")) return answer(200, current);
      return answer(404, { error: "not stubbed" });
    }),
  );
};

const row = (key: string) => screen.getByRole("heading", { name: new RegExp(`^\\d+\\. ${LABELS[key]}`) }).closest("li") as HTMLElement;

describe("Comms Settings", () => {
  beforeEach(() => {
    calls = [];
    current = payload(["consent-words", "recap-questions", "rehearsal-inbox"]);
    inboxes = { investor: "invest@example.test", steward: "", resident: "home@example.test", prosperity: "" };
    stubFetch();
  });
  // Unmount first: a describe's own afterEach runs before setup.ts's cleanup.
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("lists all thirteen items with how many required steps are done, and opens the required ones still to do", async () => {
    render(<CommsSettings password="secret" openIntegrations={() => undefined} />);
    expect(await screen.findByRole("heading", { name: "Mail settings" })).toBeTruthy();
    for (const key of SETUP_KEYS) expect(row(key), key).toBeTruthy();
    expect(screen.getByText("0 of 6 required steps done.")).toBeTruthy();
    // Required and not done: open, showing its editor.
    expect(within(row("postal-address")).getByLabelText("Postal address")).toBeTruthy();
    // Optional, or done: closed until somebody presses Edit.
    expect(within(row("consent-words")).queryByLabelText("The words beside the box")).toBeNull();
    expect(within(row("consent-words")).getByRole("button", { name: /Edit/ })).toBeTruthy();
    expect(calls[0]).toMatchObject({ url: expect.stringMatching(/\/admin\/comms\/settings$/), method: "GET", auth: "Bearer secret" });
  });

  it("reads the email-config document and shows each inbox, behind the reply-to item", async () => {
    render(<CommsSettings password="secret" openIntegrations={() => undefined} />);
    await screen.findByRole("heading", { name: "Mail settings" });
    await userEvent.click(within(row("reply-to")).getByRole("button", { name: /Set up/ }));
    expect(await screen.findByDisplayValue("invest@example.test")).toBeTruthy();
    expect(screen.getByDisplayValue("home@example.test")).toBeTruthy();
    const read = calls.find((c) => /\/admin\/email-config$/.test(c.url));
    expect(read).toMatchObject({ method: "GET", auth: "Bearer secret" });
  });

  it("saves the four inboxes back to the same route with the same body", async () => {
    inboxes = { investor: "", steward: "", resident: "", prosperity: "" };
    render(<CommsSettings password="secret" openIntegrations={() => undefined} />);
    await screen.findByRole("heading", { name: "Mail settings" });
    await userEvent.click(within(row("reply-to")).getByRole("button", { name: /Set up/ }));
    await userEvent.type(await screen.findByLabelText("Core Team (Steward)"), "core@example.test");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PUT" && /\/admin\/email-config$/.test(c.url))).toBe(true));
    const put = calls.find((c) => c.method === "PUT" && /\/admin\/email-config$/.test(c.url))!;
    expect(put.body).toEqual({ investor: "", steward: "core@example.test", resident: "", prosperity: "" });
    // The floating save bar, not a toast, says it landed.
    expect(await screen.findByText("Saved")).toBeTruthy();
  });

  it("saves the postal address through the settings route and redraws the item from the answer", async () => {
    render(<CommsSettings password="secret" openIntegrations={() => undefined} />);
    await screen.findByRole("heading", { name: "Mail settings" });
    await userEvent.type(within(row("postal-address")).getByLabelText("Postal address"), "1 Orchard Lane");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByText("1 of 6 required steps done.")).toBeTruthy());
    const put = calls.find((c) => c.method === "PUT" && /\/admin\/comms\/settings$/.test(c.url))!;
    // Only the field that changed travels, so the village's document never
    // freezes the platform's defaults into itself.
    expect(put.body).toEqual({ postalAddress: "1 Orchard Lane" });
  });

  it("saves the provider key through the existing secrets route, then reads the checklist again", async () => {
    render(<CommsSettings password="secret" openIntegrations={() => undefined} />);
    await screen.findByRole("heading", { name: "Mail settings" });
    await userEvent.type(within(row("api-key")).getByLabelText("Resend API key"), "re_test_key");
    await userEvent.click(within(row("api-key")).getByRole("button", { name: "Save key" }));
    await waitFor(() => expect(calls.some((c) => /\/admin\/integrations\/resend_api_key$/.test(c.url))).toBe(true));
    const put = calls.find((c) => /\/admin\/integrations\/resend_api_key$/.test(c.url))!;
    expect(put).toMatchObject({ method: "PUT", body: { value: "re_test_key" }, auth: "Bearer secret" });
    await waitFor(() => expect(calls.filter((c) => c.method === "GET" && /\/admin\/comms\/settings$/.test(c.url)).length).toBe(2));
  });

  it("presses Pause all through the settings route", async () => {
    render(<CommsSettings password="secret" openIntegrations={() => undefined} />);
    await screen.findByRole("heading", { name: "Mail settings" });
    await userEvent.click(screen.getByRole("button", { name: "Pause all automated email" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Let email flow again" })).toBeTruthy());
    const put = calls.find((c) => c.method === "PUT" && /\/admin\/comms\/settings$/.test(c.url))!;
    expect(put.body).toEqual({ paused: true });
  });

  // Admin search (PR 1): `?setting=comms.test-email` is where "mail settings"
  // lands. Since PR 2 the button lives at the top of the page, so nothing has
  // to open; the focus goes straight to it and the key leaves the address.
  it("lands on Send me a test from its address, even when the test was already delivered", async () => {
    current = payload([...SETUP_KEYS]);
    window.history.replaceState({}, "", "/admin?tab=comms-settings&setting=comms.test-email");
    render(<CommsSettings password="secret" openIntegrations={() => undefined} />);
    const button = await screen.findByRole("button", { name: "Send me a test" });
    await waitFor(() => expect(document.activeElement).toBe(button));
    expect(window.location.search).toBe("?tab=comms-settings");
    expect(within(row("consent-words")).getByRole("button", { name: /Edit/ })).toBeTruthy();
    window.history.replaceState({}, "", "/");
  });

  it("lands on Pause all from its address", async () => {
    window.history.replaceState({}, "", "/admin?tab=comms-settings&setting=comms.pause-all");
    render(<CommsSettings password="secret" openIntegrations={() => undefined} />);
    const button = await screen.findByRole("button", { name: "Pause all automated email" });
    await waitFor(() => expect(document.activeElement).toBe(button));
    window.history.replaceState({}, "", "/");
  });

  // PR 2: an act is never behind Change. The test, Pause all and the way to
  // Sent mail open the page, and the test reports its own outcome there.
  describe("Mail now, at the top", () => {
    it("shows Send me a test, Pause all and Sent mail before the checklist, with the test's outcome in the server's words", async () => {
      current = payload([...SETUP_KEYS], { testEmail: { status: "delivered", toEmail: "founder@example.test", createdAt: 1764000000, delivered: true } });
      current.checklist = current.checklist.map((i: any) => (i.key === "test-email" ? { ...i, detail: "Delivered to founder@example.test." } : i));
      render(<CommsSettings password="secret" openIntegrations={() => undefined} />);
      const panel = (await screen.findByRole("heading", { name: "Mail is off" })).closest("section") as HTMLElement;
      expect(within(panel).getByRole("button", { name: "Send me a test" })).toBeTruthy();
      expect(within(panel).getByRole("button", { name: "Pause all automated email" })).toBeTruthy();
      expect(within(panel).getByRole("link", { name: "Open Sent mail" }).getAttribute("href")).toBe("/admin?tab=comms-sent");
      expect(within(panel).getByRole("status").textContent).toContain("Delivered to founder@example.test.");
      // Before the checklist, in the page's order.
      const checklist = screen.getByRole("heading", { name: "Setup checklist" });
      expect(panel.compareDocumentPosition(checklist) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("sends the test through its route and shows the new outcome in place", async () => {
      render(<CommsSettings password="secret" openIntegrations={() => undefined} />);
      const button = await screen.findByRole("button", { name: "Send me a test" });
      const after = payload(["consent-words", "recap-questions", "rehearsal-inbox"], { testEmail: { status: "sent", toEmail: "founder@example.test", createdAt: 1764000000, delivered: false } });
      after.checklist = after.checklist.map((i: any) => (i.key === "test-email" ? { ...i, detail: "Sent to founder@example.test. Waiting for the delivery report." } : i));
      current = after;
      vi.mocked(fetch as any).mockImplementationOnce(async () => ({ ok: true, status: 200, json: async () => ({ ...after, result: { status: "sent" } }) }));
      await userEvent.click(button);
      const status = (await screen.findByRole("heading", { name: "Mail is off" })).closest("section")!.querySelector('[role="status"]') as HTMLElement;
      await waitFor(() => expect(status.textContent).toContain("Sent to founder@example.test. Waiting for the delivery report."));
      expect(screen.getByRole("button", { name: "Check again" })).toBeTruthy();
    });

    it("asks again by itself while a test waits for its report, and stops once it arrived", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        current = payload([], { testEmail: { status: "sent", toEmail: "founder@example.test", createdAt: 1764000000, delivered: false } });
        render(<CommsSettings password="secret" openIntegrations={() => undefined} />);
        await screen.findByRole("button", { name: "Check again" });
        const reads = () => calls.filter((c) => /\/admin\/comms\/settings$/.test(c.url) && c.method === "GET").length;
        const before = reads();
        // The report arrives before the next look.
        current = payload([], { testEmail: { status: "delivered", toEmail: "founder@example.test", createdAt: 1764000000, delivered: true } });
        await vi.advanceTimersByTimeAsync(TEST_POLL_MS + 50);
        await waitFor(() => expect(reads()).toBe(before + 1));
        await waitFor(() => expect(screen.queryByRole("button", { name: "Check again" })).toBeNull());
        await vi.advanceTimersByTimeAsync(TEST_POLL_MS * 3);
        expect(reads()).toBe(before + 1);
      } finally {
        vi.useRealTimers();
      }
    });

    it("item 13 has no Change: its button takes you to the test at the top", async () => {
      current = payload([...SETUP_KEYS]);
      render(<CommsSettings password="secret" openIntegrations={() => undefined} />);
      await screen.findByRole("heading", { name: /^13\. / });
      expect(within(row("test-email")).queryByRole("button", { name: /Edit|Change|Set up/ })).toBeNull();
      await userEvent.click(within(row("test-email")).getByRole("button", { name: "Send it from the top" }));
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Send me a test" }));
    });

    it("disconnects delivery reports only from the danger zone, after an in-page confirm", async () => {
      current = payload([...SETUP_KEYS], { webhook: { ...payload().webhook, configured: true, source: "admin" } });
      render(<CommsSettings password="secret" openIntegrations={() => undefined} />);
      const zone = (await screen.findByRole("heading", { name: "Danger zone" })).closest("section") as HTMLElement;
      await userEvent.click(within(zone).getByRole("button", { name: "Disconnect..." }));
      expect(calls.some((c) => /\/webhook$/.test(c.url))).toBe(false);
      await userEvent.click(within(zone).getByRole("button", { name: "Disconnect delivery reports" }));
      await waitFor(() => expect(calls.find((c) => /\/admin\/comms\/settings\/webhook$/.test(c.url))).toMatchObject({ method: "PUT", body: { secret: "" } }));
    });

    it("shows no danger zone when the host's setting made the connection", async () => {
      current = payload([...SETUP_KEYS], { webhook: { ...payload().webhook, configured: true, source: "env" } });
      render(<CommsSettings password="secret" openIntegrations={() => undefined} />);
      await screen.findByRole("heading", { name: "Mail settings" });
      expect(screen.queryByRole("heading", { name: "Danger zone" })).toBeNull();
    });
  });

  it("says why the screen could not be read, in the server's words", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 403, json: async () => ({ error: "Running the village's email is an appointment" }) })),
    );
    render(<CommsSettings password="secret" openIntegrations={() => undefined} />);
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Running the village's email is an appointment");
  });
});
