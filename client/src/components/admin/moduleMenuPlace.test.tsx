// @vitest-environment jsdom
/**
 * NAMING AND PLACING A MODULE'S MENU ENTRY WHERE IT IS TURNED ON, AND LATER IN ADMIN, MENU (the lead, 27 Nov 2026).
 *
 * Turning a module on shows "In the menu as" and "Where" with the entry's name and place as they stand; kept as they
 * are, nothing is written to the menu; changed, the menu document saves both through the content route. A place the
 * rules refuse says why and holds the confirm back. Admin's list renames and moves an entry into the same document.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));
vi.mock("@/lib/gameApi", () => ({ authToken: () => "t", useGameConfig: () => null, refreshGameConfig: vi.fn(async () => null) }));
vi.mock("@/modules/ModuleProvider", () => ({ useModules: () => ({ modules: [{ id: "forum", lifecycle: "public" }], loaded: true, failed: false }) }));

import ModuleStewardPanel from "./ModuleStewardPanel";
import MenuPanel from "./MenuPanel";
import TurnOnAction from "@/components/modules/TurnOnAction";
import type { LibraryViewer } from "@shared/moduleSwitch";
import { resetUnsavedForTests } from "@/lib/unsavedChanges";

type Call = { url: string; method: string; body: any };
let calls: Call[];
let stored: unknown;

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  calls = [];
  stored = {};
  window.history.replaceState({}, "", "/modules/feed");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: any, init?: any) => {
      const u = String(url);
      const method = String(init?.method ?? "GET");
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
      calls.push({ url: u, method, body });
      const answer = (status: number, json: unknown) => new Response(JSON.stringify(json), { status });
      if (u.includes("/content/app-menu") && method === "GET") return answer(200, stored);
      if (u.includes("/content/app-menu") && method === "PUT") {
        stored = body;
        return answer(200, { success: true });
      }
      if (u.includes("/lifecycle")) return answer(200, { lifecycle: body?.lifecycle });
      return answer(404, {});
    }),
  );
});
afterEach(() => {
  cleanup();
  resetUnsavedForTests();
  vi.unstubAllGlobals();
});

const wrap = (ui: React.ReactNode) => render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
const steward: LibraryViewer = { mode: "steward", launched: false, canSwitch: true, canPause: true };
const feed = { id: "feed", name: "Feed", description: "", core: false, lifecycle: "off", served: "off", tier: "included", dataClass: "none", group: "connect", setup: "none", ready: { ready: true }, requires: [], recommends: [], capabilities: [], maxLifecycle: "public", examplesAvailable: false, showingExamples: false, config: {}, health: [] };
const menuWrites = () => calls.filter((c) => c.method === "PUT" && c.url.includes("/content/app-menu"));
const lifecycleWrites = () => calls.filter((c) => c.method === "PUT" && c.url.includes("/lifecycle"));

describe("turning a module on from the Module Library", () => {
  it("shows the name and the place as they stand, and with the defaults kept writes nothing to the menu", async () => {
    wrap(<TurnOnAction ids={["feed"]} all={[feed]} viewer={steward} />);
    const name = (await screen.findByLabelText("In the menu as")) as HTMLInputElement;
    expect(name.value).toBe("");
    expect(name.placeholder).toBe("Feed");
    expect((screen.getByLabelText("Where") as HTMLSelectElement).value).toBe("Community::Conversations");
    // The preview: Community as members will meet it, the forum and the feed in Conversations.
    expect(document.querySelector('[data-menu-preview="Community"]')?.textContent).toContain("Feed");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Turn on" }));
    });
    await waitFor(() => expect(lifecycleWrites().length).toBe(1));
    expect(menuWrites()).toEqual([]);
  });

  it("saves a new name and place with the module once it is on", async () => {
    wrap(<TurnOnAction ids={["feed"]} all={[feed]} viewer={steward} />);
    fireEvent.change(await screen.findByLabelText("In the menu as"), { target: { value: "Town Square" } });
    fireEvent.change(screen.getByLabelText("Where"), { target: { value: "Village::Maps" } });
    expect(document.querySelector('[data-menu-preview="Village"] [data-here]')?.textContent).toBe("Town Square");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Turn on" }));
    });
    await waitFor(() => expect(menuWrites().length).toBe(1));
    expect(menuWrites()[0]!.body.labels).toEqual({ "/feed": "Town Square" });
    expect(menuWrites()[0]!.body.places).toEqual({ "/feed": { group: "Village", sub: "Maps" } });
    // The module was turned on first, then the menu saved.
    expect(calls.findIndex((c) => c.url.includes("/lifecycle"))).toBeLessThan(calls.findIndex((c) => c.method === "PUT" && c.url.includes("/content/app-menu")));
  });

  it("says why a place breaks the menu's rules and holds the confirm back", async () => {
    wrap(<TurnOnAction ids={["feed"]} all={[feed]} viewer={steward} />);
    fireEvent.change(await screen.findByLabelText("Where"), { target: { value: "Village::" } });
    expect((await screen.findByRole("alert")).textContent).toMatch(/Village would show 7 rows once every module is on, and it shows 6 at most/);
    expect((screen.getByRole("button", { name: "Turn on" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows a proposer where the entry will appear, to change once it is on", async () => {
    const member: LibraryViewer = { mode: "member", launched: true, canSwitch: false, canPause: false };
    wrap(<TurnOnAction ids={["feed"]} all={[feed]} viewer={member} />);
    fireEvent.click(screen.getByRole("button", { name: "Propose to turn on" }));
    expect((await screen.findByText(/In the menu as Feed, in Community, Conversations\./)).textContent).toBeTruthy();
    expect(screen.queryByLabelText("In the menu as")).toBeNull();
  });
});

describe("turning a module on from its steward panel", () => {
  it("asks for the name and place first, then turns it on and saves them", async () => {
    wrap(<ModuleStewardPanel m={feed} all={[feed]} extra={{ orphans: [], hypha: null }} viewer={steward} onChanged={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(lifecycleWrites()).toEqual([]);
    const step = await screen.findByTestId("turn-on-menu-step");
    fireEvent.change(await within(step).findByLabelText("In the menu as"), { target: { value: "Town Square" } });
    await act(async () => {
      fireEvent.click(within(step).getByRole("button", { name: "Turn on" }));
    });
    await waitFor(() => expect(menuWrites().length).toBe(1));
    expect(lifecycleWrites()[0]!.body.lifecycle).toBe("preview");
    expect(menuWrites()[0]!.body.labels["/feed"]).toBe("Town Square");
  });
});

describe("Admin, Menu, Module entries", () => {
  it("renames and moves an entry into the menu document the page saves", async () => {
    stored = { labels: {} };
    wrap(<MenuPanel password="pw" />);
    const item = await screen.findByText("/forum").then((el) => el.closest("[data-module-entry]") as HTMLElement);
    fireEvent.change(within(item).getByLabelText("In the menu as"), { target: { value: "Crew Talk" } });
    fireEvent.change(within(item).getByLabelText("Where"), { target: { value: "Govern::Decide" } });
    expect(item.querySelector('[data-menu-preview="Govern"] [data-here]')?.textContent).toBe("Crew Talk");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    await waitFor(() => expect(menuWrites().length).toBe(1));
    expect(menuWrites()[0]!.body.labels).toEqual({ "/forum": "Crew Talk" });
    expect(menuWrites()[0]!.body.places).toEqual({ "/forum": { group: "Govern", sub: "Decide" } });
    // A module entry has one name field on the page: it left the plain list of entries.
    expect(screen.queryByLabelText("Your word for Forum")).toBeNull();
  });
});
