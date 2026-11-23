// @vitest-environment jsdom
/**
 * The send and receive page, driven the way a member drives it: search, pick,
 * the pad, the check step, send, the receipt; a request link opened from the
 * address bar; and their own code.
 *
 * The assertions that matter are on the REQUEST BODY that leaves the browser,
 * because this codebase has twice shipped a display that divided while its
 * input did not. At two decimals a hundred-fold error is the failure that looks
 * plausible on both sides, so the amount typed and the amount posted are held
 * to the same quantity here (this replaces the old send card's scale test).
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ search: "" }));
const calls = vi.hoisted(() => ({ list: [] as Array<{ url: string; body: any }>, sendFails: 0 }));

vi.mock("wouter", () => ({
  useSearch: () => nav.search,
  Link: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/Layout", () => ({ default: ({ children }: any) => <div>{children}</div> }));
vi.mock("@/contexts/AuthContext", () => ({ useOptionalAuth: () => ({ user: { id: "usr-me", name: "Ora Vale" }, loading: false }) }));
vi.mock("@/lib/workPay", () => ({ chosenDisplayCurrency: () => "", useDisplayRates: () => ({ base: "EUR", asOf: null, rates: { USD: 1.1, CRC: 560 } }) }));

const ana = { kind: "member", id: "usr-ana", handle: "ana", name: "Ana Mora" };
const summary = {
  me: { kind: "member", id: "usr-me", handle: "ora", name: "Ora Vale" },
  tokens: [{ slug: "credits", name: "Village Credits", decimals: 2, balance: 10000, face: { currency: "USD", minorPerToken: 100 } }],
  displayCurrency: "CRC",
  villageCurrency: "USD",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

vi.mock("@/lib/gameApi", () => ({
  gameFetch: vi.fn(async (url: string, init?: RequestInit) => {
    calls.list.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (url === "/api/pay") return json(summary);
    if (url === "/api/pay/recent") return json({ people: [] });
    if (url.startsWith("/api/pay/people")) return json({ people: [ana] });
    if (url.startsWith("/api/pay/resolve")) return json({ payee: ana });
    if (url === "/api/wallet/send") {
      if (calls.sendFails > 0) {
        calls.sendFails--;
        throw new TypeError("network down");
      }
      return json({ success: true, sent: 2550, tokenName: "Village Credits", to: "Ana Mora", balance: 7450, balanceDecimals: 2 });
    }
    return json({}, 404);
  }),
}));

import Pay from "./Pay";

i18n.load("en", {});
i18n.activate("en");
const view = () => render(<I18nProvider i18n={i18n}>{<Pay />}</I18nProvider>);
const sends = () => calls.list.filter((c) => c.url === "/api/wallet/send");

beforeEach(() => {
  nav.search = "";
  calls.list = [];
  calls.sendFails = 0;
});

async function pickAnaAndType(keys: string[]) {
  const box = await screen.findByPlaceholderText("@handle or name");
  fireEvent.change(box, { target: { value: "an" } });
  fireEvent.click(await screen.findByRole("button", { name: /Ana Mora/ }));
  const pad = await screen.findByRole("group", { name: "Amount pad" });
  for (const k of keys) fireEvent.click(within(pad).getByRole("button", { name: k === "." ? "Decimal point" : k }));
}

describe("/pay", () => {
  it("pays a member found by search, and posts exactly the amount typed in minor units", async () => {
    view();
    await pickAnaAndType(["2", "5", ".", "5"]);
    // The member reads credits, and beside them colones: their saved currency is CRC.
    expect(screen.getAllByText(/about ₡|about CRC/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(await screen.findByText("Left after this")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Send 25.5 Village Credits to Ana Mora/ }));
    await screen.findByText("Paid to Ana Mora");
    expect(sends()).toHaveLength(1);
    expect(sends()[0].body).toMatchObject({ to: "usr-ana", tokenType: "credits", amount: 2550 });
    expect(typeof sends()[0].body.clientNonce).toBe("string");
    expect(screen.getByText("You hold now")).toBeTruthy();
  });

  it("sends a retry after a dropped connection under the same nonce, so it can only go once", async () => {
    calls.sendFails = 1;
    view();
    await pickAnaAndType(["2", "5", ".", "5"]);
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    const send = await screen.findByRole("button", { name: /Send 25.5/ });
    fireEvent.click(send);
    await screen.findByText(/it will only go once/);
    fireEvent.click(screen.getByRole("button", { name: /Send 25.5/ }));
    await screen.findByText("Paid to Ana Mora");
    expect(sends()).toHaveLength(2);
    expect(sends()[0].body.clientNonce).toBe(sends()[1].body.clientNonce);
  });

  it("will not review an amount above what the member holds", async () => {
    view();
    await pickAnaAndType(["2", "0", "0"]);
    expect(screen.getByText(/That is more than you hold/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Review" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("opens a request link with the person and the amount filled in", async () => {
    nav.search = "to=%40ana&amount=12.5&note=Honey";
    view();
    await screen.findByRole("group", { name: "Amount pad" });
    expect(calls.list.some((c) => c.url === "/api/pay/resolve?to=%40ana")).toBe(true);
    expect(screen.getByText("Ana Mora")).toBeTruthy();
    expect((screen.getByDisplayValue("Honey") as HTMLInputElement).value).toBe("Honey");
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    fireEvent.click(await screen.findByRole("button", { name: /Send 12.5 Village Credits/ }));
    await screen.findByText("Paid to Ana Mora");
    expect(sends()[0].body).toMatchObject({ to: "usr-ana", amount: 1250, note: "Honey" });
  });

  it("shows the member's own code and request link, and offers no cash-out and no expiry", async () => {
    nav.search = "tab=receive";
    view();
    const code = await screen.findByRole("img", { name: /opens a payment to @ora/ });
    expect(code.querySelector("path")?.getAttribute("d")).toMatch(/^M\d/);
    const link = document.querySelector("[data-pay-link]")?.textContent ?? "";
    expect(link).toMatch(/\/pay\?to=%40ora$/);
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Amount, if you like"), { target: { value: "8,5" } });
    });
    await waitFor(() => expect(document.querySelector("[data-pay-link]")?.textContent).toMatch(/amount=8\.50/));
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/cash out|cash-out|withdraw|redeem/i);
    expect(text).not.toMatch(/expire|expiry/i);
  });
});
