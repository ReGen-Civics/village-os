// @vitest-environment jsdom
/**
 * THE LIBRARY'S CREDIT-SALE SWITCH IS ON THE LIBRARY TAB (27 Nov 2026).
 *
 * It sat inside the Exchange tab. It is the library's own setting
 * (`library.creditSaleEnabled`, behind a caution card the server stamps), so
 * it moved: same control, same route, same permission. These hold that
 *
 *   - the Library tab draws the card from the same read the Exchange tab used,
 *     and each press sends what it always sent to the same route;
 *   - with the exchange off (its read answers 404) the card is not drawn,
 *     which is when it was not drawn before, and its place says why;
 *   - the Exchange tab no longer draws it, so there is one switch.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ExchangeAdminTab, LibraryAdminTab } from "./Admin";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const LIBRARY = { reconciliation: { ok: true, actual: 0, expected: 0 }, supply: { outstanding: 0, backing: 0, flagged: false }, poolBalance: 0, categories: [], items: [], loans: [] };
const exchange = (creditSale: unknown) => ({
  settings: [], latestPrices: {}, priceHistory: [], stock: {}, orders: [], listableTokens: [], swapReasons: {},
  tradingEnabled: false, legalCardVersion: "2026-07-27", legalAck: null, creditSale, mintCapPerCycle: 0, stripeConfigured: false,
});
const CLOSED = { open: false, cardVersion: "2026-07-27", ack: null, libraryOn: true };
const OPEN = { open: true, cardVersion: "2026-07-27", ack: { cardVersion: "2026-07-27", acceptedBy: "Rosa", acceptedAt: "2026-11-01T10:00:00Z" }, libraryOn: true };

interface Call { method: string; url: string; body: any }

function stub(exchangeAnswer: { status: number; body: unknown }) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: any, init?: any) => {
      const u = String(url);
      const method = String(init?.method ?? "GET");
      calls.push({ method, url: u, body: init?.body ? JSON.parse(init.body) : undefined });
      if (method !== "GET") return { ok: true, status: 200, json: async () => ({ success: true }) };
      if (u.endsWith("/admin/exchange")) return { ok: exchangeAnswer.status === 200, status: exchangeAnswer.status, json: async () => exchangeAnswer.body };
      if (u.endsWith("/admin/library")) return { ok: true, status: 200, json: async () => LIBRARY };
      if (u.endsWith("/admin/players")) return { ok: true, status: 200, json: async () => [] };
      return { ok: true, status: 200, json: async () => ({}) };
    }),
  );
  return calls;
}

const writes = (calls: Call[]) => calls.filter((c) => c.method !== "GET").map((c) => `${c.method} ${c.url} ${JSON.stringify(c.body)}`);

describe("the library's credit-sale switch", () => {
  it("is drawn on the Library tab, closed, with its caution card, and opening it sends the acceptance to the library's config", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    const calls = stub({ status: 200, body: exchange(CLOSED) });
    render(<LibraryAdminTab password="pw" onOpenTab={vi.fn()} />);
    expect(await screen.findByText("Selling library credits is CLOSED")).toBeTruthy();
    expect(screen.getByText(/Before you open this, read what it changes \(card 2026-07-27\)/)).toBeTruthy();
    expect(screen.getByText(/This card opens the shop, never the market/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Accept and open credit sales" }));
    await waitFor(() => expect(writes(calls)).toEqual([
      'PUT /api/admin/modules/library/config {"config":{"creditSaleEnabled":true,"creditSaleAck":{"cardVersion":"2026-07-27"}}}',
    ]));
  });

  it("opens nothing when the admin backs out of the confirmation", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    const calls = stub({ status: 200, body: exchange(CLOSED) });
    render(<LibraryAdminTab password="pw" onOpenTab={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Accept and open credit sales" }));
    expect(writes(calls)).toEqual([]);
  });

  it("when sales are open it says who accepted the card, and closing sends the switch off", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    const calls = stub({ status: 200, body: exchange(OPEN) });
    render(<LibraryAdminTab password="pw" onOpenTab={vi.fn()} />);
    expect(await screen.findByText("Selling library credits is OPEN")).toBeTruthy();
    expect(screen.getByText(/by Rosa \(card 2026-07-27\)/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Close credit sales" }));
    await waitFor(() => expect(writes(calls)).toEqual([
      'PUT /api/admin/modules/library/config {"config":{"creditSaleEnabled":false}}',
    ]));
  });

  // THE CARD USED TO BE SILENTLY ABSENT HERE, while the module's settings said the switch is on this screen.
  it("while the exchange is off the card is not drawn, and its place says why and links the Exchange module", async () => {
    const calls = stub({ status: 404, body: { error: "module_disabled", module: "exchange" } });
    render(<LibraryAdminTab password="pw" onOpenTab={vi.fn()} />);
    expect(await screen.findByText("Record an intake")).toBeTruthy();
    expect(screen.queryByText(/Selling library credits is/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Accept and open credit sales" })).toBeNull();
    const note = await screen.findByTestId("credit-sale-missing");
    expect(note.textContent).toBe("Selling library credits needs the ExchangeLibrary credits are listed and sold on the Exchange, and the Exchange module is off. Turn it on from its own page, and the caution card that opens credit sales shows here.Open the Exchange module");
    expect(screen.getByRole("link", { name: "Open the Exchange module" }).getAttribute("href")).toBe("/modules/exchange");
    // Words only: nothing is sent.
    expect(writes(calls)).toEqual([]);
  });

  it("when the read fails for any other reason it says the state did not load, never that sales are closed", async () => {
    for (const answer of [{ status: 401, body: { error: "auth_required" } }, { status: 500, body: {} }, { status: 404, body: { error: "not_found" } }, { status: 200, body: {} }]) {
      stub(answer);
      render(<LibraryAdminTab password="pw" onOpenTab={vi.fn()} />);
      expect(await screen.findByText("Record an intake")).toBeTruthy();
      expect((await screen.findByTestId("credit-sale-missing")).textContent, `status ${answer.status}`).toBe("Whether library credits can be sold did not load. Reload the page to try again.");
      expect(screen.queryByText(/Selling library credits/)).toBeNull();
      cleanup();
    }
  });

  it("a read that never arrives says the same", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: any) => {
      if (String(url).endsWith("/admin/exchange")) throw new Error("offline");
      if (String(url).endsWith("/admin/library")) return { ok: true, status: 200, json: async () => LIBRARY };
      return { ok: true, status: 200, json: async () => [] };
    }));
    render(<LibraryAdminTab password="pw" onOpenTab={vi.fn()} />);
    expect((await screen.findByTestId("credit-sale-missing")).textContent).toBe("Whether library credits can be sold did not load. Reload the page to try again.");
  });

  it("the card itself is drawn with no such note when the read answers", async () => {
    stub({ status: 200, body: exchange(CLOSED) });
    render(<LibraryAdminTab password="pw" onOpenTab={vi.fn()} />);
    expect(await screen.findByText("Selling library credits is CLOSED")).toBeTruthy();
    expect(screen.queryByTestId("credit-sale-missing")).toBeNull();
  });

  it("is no longer drawn on the Exchange tab, which keeps its own swapping card", async () => {
    stub({ status: 200, body: exchange(CLOSED) });
    render(<ExchangeAdminTab password="pw" />);
    expect(await screen.findByText("Token-for-token swapping is OFF")).toBeTruthy();
    expect(screen.queryByText(/Selling library credits is/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Accept and open credit sales" })).toBeNull();
  });
});
