import { setupI18n } from "@lingui/core";
import { describe, expect, it } from "vitest";
import { NOTIFICATION_KIND_WORDS } from "@shared/notificationKindWords";
import { NOTIFICATION_GROUPS, PLAIN_WORDS } from "@shared/notificationKinds";
import { KIND_WORDS_MSG, kindWordsIn } from "./noticeKindWordsI18n";
import { GROUP_TITLE_MSG, groupTitle } from "./noticeGroupWords";
import { BATCH_AT, batchRows, type FeedItem } from "./notificationFeed";

const en = setupI18n({ locale: "en", messages: { en: {} } });

describe("the bell's words match the shared table, kind for kind (the lead, 26 Nov 2026)", () => {
  it("every kind is here, with the same English blurb and batched line", () => {
    expect(Object.keys(KIND_WORDS_MSG).sort()).toEqual(Object.keys(NOTIFICATION_KIND_WORDS).sort());
    const words = kindWordsIn(en);
    for (const [kind, shared] of Object.entries(NOTIFICATION_KIND_WORDS)) {
      expect(words(kind), kind).toEqual(shared);
    }
  });

  it("a kind nobody declared reads the plain words", () => {
    expect(kindWordsIn(en)("not_a_kind")).toEqual(PLAIN_WORDS);
  });

  it("every section heading is here, with the same English", () => {
    expect(Object.keys(GROUP_TITLE_MSG).sort()).toEqual(NOTIFICATION_GROUPS.map((g) => g.id).sort());
    for (const g of NOTIFICATION_GROUPS) expect(groupTitle(g.id, "unused", en)).toBe(g.title);
    expect(groupTitle("unknown", "Kept", en)).toBe("Kept");
  });
});

describe("in Spanish", () => {
  const kind = "ballot_opened";
  const pair = KIND_WORDS_MSG[kind];
  const es = setupI18n({
    locale: "es",
    messages: { es: { [pair.blurb.id]: "La aldea abrió una votación.", [pair.many.id]: "Se abrieron {n} votaciones." } },
  });

  it("the batched line keeps its count slot, and the feed fills it in", () => {
    expect(BATCH_AT).toBe(4);
    const items: FeedItem[] = [0, 1, 2, 3].map((i) => ({ id: `n${i}`, type: kind, title: "x", body: null, isRead: false, at: `2026-11-2${i}T00:00:00Z` }) as FeedItem);
    const [row] = batchRows(items, undefined, kindWordsIn(es));
    expect(row.title).toBe("Se abrieron 4 votaciones.");
    expect(row.detail).toBe("La aldea abrió una votación.");
  });

  it("a village's own blurb for the kind still wins", () => {
    const items = [{ id: "a", type: kind, title: "x", body: null, isRead: false, at: "2026-11-20T00:00:00Z" }] as FeedItem[];
    const [row] = batchRows(items, (type, platform) => (type === kind ? "Words the village wrote" : platform), kindWordsIn(es));
    expect(row.detail).toBe("Words the village wrote");
  });
});
