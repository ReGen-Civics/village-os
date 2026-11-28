// @vitest-environment jsdom
/**
 * FIND ANYTHING for an admin who reads in Spanish (FindAnythingDialog.tsx).
 *
 *   - the index read names the reader's language, and a reader of English names none;
 *   - the session's copy of the index is kept per language, so a change of language reads it again;
 *   - a dial, served in English, shows the Game Mechanics page's Spanish label and is still found by its English one;
 *   - a member is served no dials, so a member who reads in Spanish never fetches the dials' words.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FindEntry, FindIndex } from "@shared/findAnything";
import { VARIABLES } from "@shared/gameVariables";
import { activateLocale } from "@/i18n/i18n";
import { DIAL_WORDS } from "@/pages/gameMechanicsDialWords";
import { FindAnything } from "./FindAnything";
import { forgetFindIndex } from "./FindAnythingDialog";

const DIAL = VARIABLES[0];
const DIAL_ES = "Avales que admiten a un miembro";
const DIAL_ID = `setting:dial.${DIAL.key}`;
const DIAL_PATH = `/admin?tab=variables&variable=${encodeURIComponent(DIAL.key)}`;
/** The dial as the server sends it in either language: its English label, its key and its category. */
const DIAL_ENTRY: FindEntry = { id: DIAL_ID, kind: "setting", title: DIAL.label, help: DIAL.description.slice(0, 240), path: DIAL_PATH, synonyms: [DIAL.key, DIAL.category] };
const QUESTS: FindEntry = { id: "page:/quests", kind: "page", title: "Quests", help: "Work the village needs done.", path: "/quests" };
/** An act as the server answers it in Spanish. */
const STAGE_ES: FindEntry = { id: "setting:gate.players.set-stage", kind: "setting", title: "Definir la etapa de un jugador", help: "Otorgue una etapa a mano.", path: "/admin?tab=players", synonyms: ["cambiar la etapa", "Set a player's stage", "stage"] };
const STAGE_EN: FindEntry = { ...STAGE_ES, title: "Set a player's stage", help: "Grant a stage by hand.", synonyms: ["stage"] };

let admin = true;
let reads: Array<Record<string, string>>;

beforeEach(() => {
  forgetFindIndex();
  window.history.replaceState({}, "", "/");
  admin = true;
  reads = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: any, init?: any) => {
      const u = String(url);
      if (u.endsWith("/api/work-with-us-config")) return { ok: true, status: 200, json: async () => ({ assistantName: "Sol" }) };
      if (u.endsWith("/api/admin/players")) return { ok: true, status: 200, json: async () => [] };
      const headers = (init?.headers ?? {}) as Record<string, string>;
      reads.push(headers);
      const spanish = headers["X-Village-Locale"] === "es";
      const index: FindIndex = {
        people: false,
        admin,
        guide: { name: "Sol", available: false },
        entries: admin ? [QUESTS, spanish ? STAGE_ES : STAGE_EN, DIAL_ENTRY] : [QUESTS],
      };
      return { ok: true, status: 200, json: async () => index };
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  activateLocale("en", {});
});

const spanish = () => activateLocale("es", { [DIAL_WORDS[DIAL.key].label.id]: DIAL_ES, [DIAL_WORDS[DIAL.key].description.id]: "Cuántas personas tienen que avalar a alguien." });

async function open() {
  render(<FindAnything />);
  await userEvent.click(screen.getByRole("button", { name: "Find anything" }));
  const d = await screen.findByRole("dialog", { name: "Find anything" });
  return { d, box: within(d).getByRole("combobox") };
}
const titles = (d: HTMLElement) => within(d).getAllByRole("option").map((o) => o.textContent ?? "");

describe("Find anything, for an admin who reads in Spanish", () => {
  it("names the reader's language on the index read", async () => {
    spanish();
    await open();
    await waitFor(() => expect(reads).toHaveLength(1));
    expect(reads[0]["X-Village-Locale"]).toBe("es");
  });

  it("draws the registry as the server answered it, found by Spanish words and by English ones", async () => {
    spanish();
    const { d, box } = await open();
    await userEvent.type(box, "cambiar la etapa");
    await waitFor(() => expect(titles(d)[0]).toContain("Definir la etapa de un jugador"));
    await userEvent.clear(box);
    await userEvent.type(box, "set a player's stage");
    await waitFor(() => expect(titles(d)[0]).toContain("Definir la etapa de un jugador"));
  });

  it("shows a dial under the Game Mechanics page's Spanish label, still found by its English label, at the same address", async () => {
    spanish();
    const { d, box } = await open();
    await userEvent.type(box, "avales que admiten");
    await waitFor(() => expect(titles(d)[0]).toContain(DIAL_ES));
    expect(titles(d)[0]).toContain("Cuántas personas tienen que avalar a alguien.");
    await userEvent.clear(box);
    await userEvent.type(box, DIAL.label);
    await waitFor(() => expect(titles(d)[0]).toContain(DIAL_ES));
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(`${window.location.pathname}${window.location.search}`).toBe(DIAL_PATH));
  });

  it("keeps the session's index per language: a reader who changes language is read again, in that language", async () => {
    spanish();
    const first = await open();
    await userEvent.type(first.box, "cambiar la etapa");
    await waitFor(() => expect(titles(first.d)[0]).toContain("Definir la etapa de un jugador"));
    cleanup();
    activateLocale("en", {});
    const second = await open();
    await waitFor(() => expect(reads).toHaveLength(2));
    expect("X-Village-Locale" in reads[1]).toBe(false);
    await userEvent.type(second.box, DIAL.label);
    await waitFor(() => expect(titles(second.d)[0]).toContain(DIAL.label));
    expect(titles(second.d).join(" ")).not.toContain(DIAL_ES);
    // The same language again draws from the session's copy: no third read.
    cleanup();
    await open();
    expect(reads).toHaveLength(2);
  });
});

describe("Find anything, for everybody else", () => {
  it("a reader of English names no language", async () => {
    await open();
    await waitFor(() => expect(reads).toHaveLength(1));
    expect("X-Village-Locale" in reads[0]).toBe(false);
  });

  it("a member who reads in Spanish still names their language, and their list is what the server sent", async () => {
    admin = false;
    spanish();
    const { d, box } = await open();
    await waitFor(() => expect(reads).toHaveLength(1));
    expect(reads[0]["X-Village-Locale"]).toBe("es");
    await userEvent.type(box, "quests");
    await waitFor(() => expect(titles(d)[0]).toContain("Quests"));
  });
});
