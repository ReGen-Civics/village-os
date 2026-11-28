import { describe, expect, it } from "vitest";
import { CONTROL_ENTRIES, dialEntry, rankAdminSearch } from "@shared/adminSearch";
import { navGroups } from "../adminNavGroups";
import { isSearchShortcut, pageEntries, readPageWords, searchEntries, type PageWords } from "./adminSearchModel";

describe("pageEntries", () => {
  it("names each menu page once, by its one name, with the menu's own label as a synonym", () => {
    const pages = pageEntries(navGroups(true));
    const ids = pages.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const mail = pages.find((p) => p.tab === "comms-settings")!;
    expect(mail.title).toBe("Mail settings");
    expect(mail.synonyms).toContain("Settings");
  });
});

describe("pageEntries in the reader's language", () => {
  const WORDS: PageWords[] = [
    { id: "tab.game-roles", title: "Grupos de poder", help: "Grupos de permisos que usted puede darle a la gente.", synonyms: ["grupos de poder", "permisos", "Power groups", "permissions"] },
    { id: "tab.nowhere", title: "Ninguna parte", help: "No está en el menú.", synonyms: [] },
  ];

  it("lays the served words over the page the menu built, and keeps every English word as a synonym", () => {
    const english = pageEntries(navGroups(true)).find((p) => p.id === "tab.game-roles")!;
    const spanish = pageEntries(navGroups(true), WORDS).find((p) => p.id === "tab.game-roles")!;
    expect(spanish.title).toBe("Grupos de poder");
    expect(spanish.help).toBe("Grupos de permisos que usted puede darle a la gente.");
    expect(spanish.synonyms.slice(0, 2)).toEqual(["grupos de poder", "permisos"]);
    for (const s of [english.title, ...english.synonyms]) expect(spanish.synonyms.map((x) => x.toLowerCase())).toContain(s.toLowerCase());
    expect(new Set(spanish.synonyms.map((s) => s.toLowerCase())).size).toBe(spanish.synonyms.length);
    // Its address is the menu's own: the words change, the page does not.
    expect({ id: spanish.id, kind: spanish.kind, tab: spanish.tab }).toEqual({ id: english.id, kind: english.kind, tab: english.tab });
    expect(rankAdminSearch("grupos de poder", pageEntries(navGroups(true), WORDS), 3)[0].id).toBe("tab.game-roles");
    expect(rankAdminSearch("power groups", pageEntries(navGroups(true), WORDS), 3)[0].id).toBe("tab.game-roles");
  });

  it("with no words, or words for a page the menu does not show, is exactly the English list", () => {
    const english = pageEntries(navGroups(true));
    expect(pageEntries(navGroups(true), [])).toEqual(english);
    expect(pageEntries(navGroups(true), [WORDS[1]])).toEqual(english);
    expect(searchEntries(navGroups(true), [], [WORDS[1]])).toEqual(searchEntries(navGroups(true), []));
  });

  it("reads only well-formed words from the server's answer", () => {
    expect(readPageWords(WORDS)).toEqual(WORDS);
    expect(readPageWords(undefined)).toEqual([]);
    expect(readPageWords({ id: "tab.x" })).toEqual([]);
    expect(readPageWords([null, 3, { id: "tab.x" }, { id: "tab.x", title: "X", help: "x", synonyms: [1] }, { id: 7, title: "X", help: "x", synonyms: [] }])).toEqual([]);
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
