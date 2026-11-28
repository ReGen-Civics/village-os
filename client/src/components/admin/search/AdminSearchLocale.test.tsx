// @vitest-environment jsdom
/**
 * Admin search for a reader of Spanish (AdminSearch.tsx).
 *
 *   - the read names the reader's language, and a reader of English names none;
 *   - what the server answered in Spanish is drawn and found: an act, and a tab by the words the read brought;
 *   - a dial, served in English, shows the Game Mechanics page's Spanish label and is still found by its English one;
 *   - a reader of English never fetches the dials' words, and their list is the served list.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CONTROL_ENTRIES, dialEntry, type AdminSearchEntry } from "@shared/adminSearch";
import { VARIABLES } from "@shared/gameVariables";
import { activateLocale } from "@/i18n/i18n";
import { DIAL_WORDS } from "@/pages/gameMechanicsDialWords";
import { navGroups } from "../adminNavGroups";
import AdminSearch from "./AdminSearch";

const GROUPS = navGroups(true);
const DIAL = VARIABLES[0];
const DIAL_ES = "Avales que admiten a un miembro";
const TEST_EMAIL = CONTROL_ENTRIES.find((e) => e.id === "comms.test-email")!;
/** The control as the server answers it in Spanish: Spanish words first, the English kept behind them. */
const TEST_EMAIL_ES: AdminSearchEntry = { ...TEST_EMAIL, title: "Enviarme un correo de prueba", help: "Le envía una prueba.", synonyms: ["enviar correo de prueba", TEST_EMAIL.title, ...TEST_EMAIL.synonyms] };
const PAGES_ES = [{ id: "tab.game-roles", title: "Grupos de poder", help: "Grupos de permisos.", synonyms: ["grupos de poder", "Power groups"] }];

let calls: Array<{ url: string; headers: Record<string, string> }>;

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, "", "/admin?tab=home");
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: any, init?: any) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      calls.push({ url: String(url), headers });
      const spanish = headers["X-Village-Locale"] === "es";
      const entries = [spanish ? TEST_EMAIL_ES : TEST_EMAIL, dialEntry(DIAL)];
      return { ok: true, status: 200, json: async () => (spanish ? { entries, pages: PAGES_ES } : { entries }) };
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  activateLocale("en", {});
});

const open = async () => {
  await userEvent.click(screen.getByRole("button", { name: "Search Admin" }));
  return screen.getByRole("dialog", { name: "Search Admin" });
};
const first = (dialog: HTMLElement) => within(dialog).getAllByRole("option")[0].textContent ?? "";
const indexReads = () => calls.filter((c) => c.url.endsWith("/admin/search-index"));

describe("Admin search, for a reader of Spanish", () => {
  beforeEach(() => {
    activateLocale("es", { [DIAL_WORDS[DIAL.key].label.id]: DIAL_ES, [DIAL_WORDS[DIAL.key].description.id]: "Cuántas personas tienen que avalar a alguien." });
  });

  it("names the reader's language on the read, beside the admin's own key", async () => {
    render(<AdminSearch password="pw" groups={GROUPS} />);
    await open();
    await waitFor(() => expect(indexReads()).toHaveLength(1));
    expect(indexReads()[0].headers["X-Village-Locale"]).toBe("es");
    // The read still carries what the admin door asks for.
    expect(Object.keys(indexReads()[0].headers).length).toBeGreaterThan(1);
  });

  it("finds an act by Spanish words and by English ones, and draws it in Spanish", async () => {
    render(<AdminSearch password="pw" groups={GROUPS} />);
    const dialog = await open();
    const box = within(dialog).getByRole("combobox");
    await userEvent.type(box, "enviar correo de prueba");
    await waitFor(() => expect(first(dialog)).toContain("Enviarme un correo de prueba"));
    await userEvent.clear(box);
    await userEvent.type(box, "send me a test");
    await waitFor(() => expect(first(dialog)).toContain("Enviarme un correo de prueba"));
  });

  it("finds a tab by the Spanish words the read brought, and opens the same page", async () => {
    render(<AdminSearch password="pw" groups={GROUPS} />);
    const dialog = await open();
    await userEvent.type(within(dialog).getByRole("combobox"), "grupos de poder");
    await waitFor(() => expect(first(dialog)).toContain("Grupos de poder"));
    await userEvent.keyboard("{Enter}");
    expect(window.location.pathname + window.location.search).toBe("/admin?tab=game-roles");
  });

  it("shows a dial under the Game Mechanics page's Spanish label, still found by its English label", async () => {
    render(<AdminSearch password="pw" groups={GROUPS} />);
    const dialog = await open();
    const box = within(dialog).getByRole("combobox");
    await userEvent.type(box, "avales que admiten");
    await waitFor(() => expect(first(dialog)).toContain(DIAL_ES));
    expect(first(dialog)).toContain("Cuántas personas tienen que avalar a alguien.");
    await userEvent.clear(box);
    await userEvent.type(box, DIAL.label);
    await waitFor(() => expect(first(dialog)).toContain(DIAL_ES));
    await userEvent.keyboard("{Enter}");
    expect(window.location.pathname + window.location.search).toBe(`/admin?tab=variables&variable=${encodeURIComponent(DIAL.key)}`);
  });
});

describe("Admin search, for a reader of English", () => {
  it("names no language on the read, and draws the dial as the server sent it", async () => {
    render(<AdminSearch password="pw" groups={GROUPS} />);
    const dialog = await open();
    await waitFor(() => expect(indexReads()).toHaveLength(1));
    expect("X-Village-Locale" in indexReads()[0].headers).toBe(false);
    await userEvent.type(within(dialog).getByRole("combobox"), DIAL.label);
    await waitFor(() => expect(first(dialog)).toContain(DIAL.label));
    expect(first(dialog)).not.toContain(DIAL_ES);
  });
});
