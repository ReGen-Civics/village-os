// @vitest-environment jsdom
/**
 * MAKE THIS YOURS ON THE ONE SAVE BAR (the lead, 25 Nov 2026): "whenever I'm
 * changing a setting, have it pop up ... so I can immediately save it rather
 * than it being in different dialog boxes and places where I find the save
 * button."
 *
 * The page stacks many panels. Each used to carry its own Save button; now an
 * edit in any of them raises the same bar, one Save writes every panel that
 * changed through its own route, and a refusal keeps that panel's change on
 * the bar in the server's words while the rest go.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { resetUnsavedForTests } from "@/lib/unsavedChanges";
import VocabularyPanel from "./VocabularyPanel";
import MenuPanel from "./MenuPanel";
import NoticeWordsPanel from "./NoticeWordsPanel";
import ArchetypesPanel from "./ArchetypesPanel";
import SoundsPanel from "../SoundsPanel";

type Call = { url: string; method: string; body: any };
let calls: Call[];
let refuse: Record<string, string>;

const CLASSES = [
  { key: "building", name: "Builder", subtitle: "", blurb: "", examples: [], sigil: "hammer", sortOrder: 0 },
  { key: "tending", name: "Tender", subtitle: "", blurb: "", examples: [], sigil: "leaf", sortOrder: 1 },
];

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  calls = [];
  refuse = {};
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: any, init?: any) => {
      const u = String(url);
      const method = String(init?.method ?? "GET");
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
      calls.push({ url: u, method, body });
      const answer = (status: number, json: unknown) => new Response(JSON.stringify(json), { status });
      if (method === "PUT") {
        const why = Object.entries(refuse).find(([k]) => u.includes(k));
        if (why) return answer(400, { error: why[1] });
        if (u.includes("/admin/archetypes/")) return answer(200, { archetype: { ...CLASSES.find((c) => u.endsWith(c.key)), ...body } });
        if (u.endsWith("/admin/brand/sounds")) return answer(200, { sounds: { volume: body.volume, files: {} } });
        return answer(200, body);
      }
      if (u.includes("/content/")) return answer(200, {});
      if (u.endsWith("/admin/archetypes")) return answer(200, { archetypes: CLASSES });
      if (u.endsWith("/brand/sounds")) return answer(200, { volume: 0.5, files: {} });
      if (u.includes("stock-art")) return answer(200, { slots: [], replaced: [] });
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
const puts = () => calls.filter((c) => c.method === "PUT");
const clickSave = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
  });
};

describe("Make this yours on the one save bar", () => {
  it("has no Save button of its own in any panel, and no bar until something changes", async () => {
    wrap(<><VocabularyPanel password="pw" /><MenuPanel password="pw" /><NoticeWordsPanel password="pw" /></>);
    await screen.findByLabelText("Your word for village");
    await screen.findByLabelText("Find a notice");
    expect(screen.queryByRole("button", { name: /Save your words|Save the menu|Save the notice words/ })).toBeNull();
    expect(screen.queryByText(/not saved yet/)).toBeNull();
  });

  it("gathers edits from two panels on one bar, and one Save writes both through their own routes", async () => {
    wrap(<><VocabularyPanel password="pw" /><MenuPanel password="pw" /></>);
    fireEvent.change(await screen.findByLabelText("Your word for village"), { target: { value: "pueblo" } });
    const groupBox = screen.getAllByLabelText(/^The name for the .* group$/)[0];
    fireEvent.change(groupBox, { target: { value: "Ours" } });
    expect(await screen.findByText("2 changes not saved yet")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Save" })).toHaveLength(1);
    await clickSave();
    const urls = puts().map((c) => c.url);
    expect(urls.some((u) => u.endsWith("/admin/content/app-vocabulary"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/admin/content/app-menu"))).toBe(true);
    expect(puts().find((c) => c.url.endsWith("app-vocabulary"))!.body.village.one).toBe("pueblo");
    expect(await screen.findByText("Saved")).toBeTruthy();
  });

  it("keeps a refused panel's change on the bar, in the server's words", async () => {
    refuse = { "app-menu": "The menu is locked while the village votes." };
    wrap(<><VocabularyPanel password="pw" /><MenuPanel password="pw" /></>);
    fireEvent.change(await screen.findByLabelText("Your word for village"), { target: { value: "pueblo" } });
    fireEvent.change(screen.getAllByLabelText(/^The name for the .* group$/)[0], { target: { value: "Ours" } });
    await clickSave();
    expect(await screen.findByText(/The menu is locked while the village votes\./)).toBeTruthy();
    await waitFor(() => expect(screen.getByText("1 change not saved yet")).toBeTruthy());
  });

  it("saves every class that changed in one press, and Discard puts the words back", async () => {
    wrap(<ArchetypesPanel password="pw" />);
    const names = await screen.findAllByLabelText("Name");
    fireEvent.change(names[0], { target: { value: "Maker" } });
    fireEvent.change(names[1], { target: { value: "Gardener" } });
    expect(await screen.findByText("2 changes not saved yet")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save these words" })).toBeNull();
    await clickSave();
    const saved = puts().filter((c) => /\/admin\/archetypes\/(building|tending)$/.test(c.url));
    expect(saved.map((c) => c.body.name).sort()).toEqual(["Gardener", "Maker"]);

    fireEvent.change(screen.getAllByLabelText("Name")[0], { target: { value: "Something else" } });
    fireEvent.click(await screen.findByRole("button", { name: "Discard" }));
    expect((screen.getAllByLabelText("Name")[0] as HTMLInputElement).value).toBe("Maker");
  });

  it("holds the volume on the bar, so a touch drag is saved too", async () => {
    wrap(<SoundsPanel password="pw" />);
    const slider = await screen.findByRole("slider");
    fireEvent.change(slider, { target: { value: "0.8" } });
    expect(await screen.findByText("1 change not saved yet")).toBeTruthy();
    expect(puts()).toHaveLength(0);
    await clickSave();
    expect(puts()[0].url).toMatch(/\/admin\/brand\/sounds$/);
    expect(puts()[0].body).toEqual({ volume: 0.8 });
    expect(screen.getByText("80%")).toBeTruthy();
  });
});
