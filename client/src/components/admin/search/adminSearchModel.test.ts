import { describe, expect, it } from "vitest";
import { CONTROL_ENTRIES, dialEntry } from "@shared/adminSearch";
import { navGroups } from "../adminNavGroups";
import { isSearchShortcut, pageEntries, searchEntries } from "./adminSearchModel";

describe("pageEntries", () => {
  it("names each menu page once, as the menu names it, with the area list's name as a synonym", () => {
    const pages = pageEntries(navGroups(true));
    const ids = pages.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const mail = pages.find((p) => p.tab === "comms-settings")!;
    expect(mail.title).toBe("Settings");
    expect(mail.synonyms).toContain("Mail settings");
  });
});

describe("searchEntries", () => {
  it("keeps a dial only while Game mechanics is in the menu", () => {
    const dial = dialEntry({ key: "comms.quiet_hours", label: "Quiet hours" });
    const all = navGroups(true);
    expect(searchEntries(all, [dial]).some((e) => e.id === dial.id)).toBe(true);
    const without = all.map((g) => ({ ...g, items: g.items.filter((i) => i.key !== "variables") }));
    expect(searchEntries(without, [dial]).some((e) => e.id === dial.id)).toBe(false);
    expect(CONTROL_ENTRIES.length).toBeGreaterThan(0);
  });
});

describe("isSearchShortcut", () => {
  const ev = (key: string, mods: Partial<KeyboardEvent> = {}, tag = "BODY") =>
    ({ key, ctrlKey: false, metaKey: false, altKey: false, target: { tagName: tag, isContentEditable: false }, ...mods }) as any;
  it("opens on / outside a field, and on Ctrl K or Cmd K anywhere", () => {
    expect(isSearchShortcut(ev("/"))).toBe(true);
    expect(isSearchShortcut(ev("/", {}, "INPUT"))).toBe(false);
    expect(isSearchShortcut(ev("k", { ctrlKey: true }, "INPUT"))).toBe(true);
    expect(isSearchShortcut(ev("K", { metaKey: true }))).toBe(true);
  });
  it("leaves Ctrl / to the guide", () => {
    expect(isSearchShortcut(ev("/", { ctrlKey: true }))).toBe(false);
    expect(isSearchShortcut(ev("/", { metaKey: true }))).toBe(false);
  });
});
