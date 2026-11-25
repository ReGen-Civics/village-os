/**
 * The Admin search index (shared/adminSearch.ts): the triggering case finds
 * the test email, entries are data and nothing else, ids are unique, and
 * every address is the one the page lands on.
 */
import { describe, expect, it } from "vitest";
import { SETUP_KEYS } from "./comms/settings";
import {
  CONTROL_ENTRIES,
  OUTSIDE_ENTRIES,
  TAB_SYNONYMS,
  adminSearchHref,
  controlsOn,
  dialEntry,
  rankAdminSearch,
  type AdminSearchEntry,
} from "./adminSearch";

const PAGES: AdminSearchEntry[] = [
  { id: "tab.comms-settings", kind: "page", tab: "comms-settings", title: "Mail settings", help: "How the village sends mail.", synonyms: TAB_SYNONYMS["comms-settings"] },
  { id: "tab.comms-sent", kind: "page", tab: "comms-sent", title: "Sent mail", help: "Mail that has already gone out.", synonyms: TAB_SYNONYMS["comms-sent"] },
  { id: "tab.variables", kind: "page", tab: "variables", title: "Game mechanics", help: "The dials.", synonyms: TAB_SYNONYMS.variables },
  { id: "tab.players", kind: "page", tab: "players", title: "Players", help: "Everyone in the village.", synonyms: TAB_SYNONYMS.players },
];
const ALL = [...PAGES, ...CONTROL_ENTRIES, ...OUTSIDE_ENTRIES];

describe("the case that started it", () => {
  it("'mail settings' puts Mail settings first and the test email among the results", () => {
    const r = rankAdminSearch("mail settings", ALL);
    expect(r[0].id).toBe("tab.comms-settings");
    expect(r.map((e) => e.id)).toContain("comms.test-email");
  });

  it("'send me a test' puts the test email button first", () => {
    expect(rankAdminSearch("send me a test", ALL)[0].id).toBe("comms.test-email");
  });

  it("the old names of the page still find it", () => {
    for (const q of ["email settings", "comms settings", "test email", "resend"]) {
      expect(rankAdminSearch(q, ALL).slice(0, 3).map((e) => e.id), q).toEqual(
        expect.arrayContaining([expect.stringMatching(/^(tab\.comms-settings|comms\.)/)]),
      );
    }
  });

  it("the jump-to row under Mail settings offers the test email", () => {
    expect(controlsOn("comms-settings", ALL).map((e) => e.id)).toContain("comms.test-email");
  });

  it("lands on the exact control", () => {
    const e = CONTROL_ENTRIES.find((x) => x.id === "comms.test-email")!;
    expect(adminSearchHref(e)).toBe("/admin?tab=comms-settings&setting=comms.test-email");
  });
});

describe("the index is data", () => {
  it("every entry survives a JSON round trip unchanged, so nothing in it can act", () => {
    for (const e of [...CONTROL_ENTRIES, ...OUTSIDE_ENTRIES]) expect(JSON.parse(JSON.stringify(e))).toEqual(e);
  });

  it("ids are unique across controls, outside pages and dials", () => {
    const ids = [...CONTROL_ENTRIES, ...OUTSIDE_ENTRIES].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(dialEntry({ key: "comms.quiet_hours", label: "Quiet hours" }).id).toBe("dial.comms.quiet_hours");
  });

  it("every mail checklist item has a control the page can land on", () => {
    for (const key of SETUP_KEYS) expect(CONTROL_ENTRIES.some((e) => e.id === `comms.${key}`), key).toBe(true);
  });

  it("controls name a tab, outside pages name a path", () => {
    for (const e of CONTROL_ENTRIES) expect(e.tab, e.id).toBeTruthy();
    for (const e of OUTSIDE_ENTRIES) expect(e.path?.startsWith("/"), e.id).toBe(true);
  });

  it("a dial lands on Game mechanics with its key, and carries no value", () => {
    const e = dialEntry({ key: "comms.quiet_hours", label: "Quiet hours", description: "When nothing is sent.", category: "Comms" });
    expect(adminSearchHref(e)).toBe("/admin?tab=variables&variable=comms.quiet_hours");
    expect(Object.keys(e)).not.toContain("value");
  });

  it("an empty or unmatched query finds nothing, never everything", () => {
    expect(rankAdminSearch("", ALL)).toEqual([]);
    expect(rankAdminSearch("zzqx", ALL)).toEqual([]);
  });
});
