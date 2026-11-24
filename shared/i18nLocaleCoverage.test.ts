import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LOCALES, OFFER_FLOOR, offerLocaleKey, villageLocaleTags } from "./i18nLocales";
import { VARIABLES_BY_KEY } from "./gameVariables";

/**
 * A LANGUAGE IS OFFERED ONLY WITH REAL COVERAGE (the lead, 24 Nov 2026). The
 * picker lists every entry of LOCALES, so an entry whose PO file is mostly
 * empty would put a visitor into a page of English labelled as their language.
 */
const LOCALES_DIR = path.join(__dirname, "..", "client", "src", "locales");

/** Share of live messages with a translation, read straight off the PO file. */
function translatedShare(po: string): { share: number; total: number } {
  let total = 0;
  let done = 0;
  for (const block of po.split(/\r?\n\r?\n/)) {
    if (/^#~/m.test(block)) continue;
    const id = block.match(/^msgid "(.*)"/m);
    if (!id) continue;
    // The header: an empty id whose msgstr holds the file's metadata.
    if (id[1] === "" && /^"(Language|Content-Type|POT-Creation-Date|MIME-Version):/m.test(block)) continue;
    total++;
    const str = block.slice(block.search(/^msgstr/m)).replace(/^msgstr(\[\d+\])? /gm, "").replace(/"\s*\n\s*"/g, "");
    if (/"[^"]+/.test(str)) done++;
  }
  return { share: total ? done / total : 0, total };
}

describe("every offered language has a catalog and real coverage", () => {
  for (const l of LOCALES.filter((x) => x.tier !== "source")) {
    it(`${l.tag}: a PO file translating at least ${OFFER_FLOOR * 100}% of the messages`, () => {
      const file = path.join(LOCALES_DIR, `${l.tag}.po`);
      expect(fs.existsSync(file), `client/src/locales/${l.tag}.po`).toBe(true);
      const { share, total } = translatedShare(fs.readFileSync(file, "utf8"));
      expect(total).toBeGreaterThan(0);
      expect(share).toBeGreaterThanOrEqual(OFFER_FLOOR);
    });
  }

  it("reads a PO file the way the floor means it", () => {
    const po = ['msgid ""\nmsgstr ""\n"Language: xx\\n"', 'msgid "One"\nmsgstr "Uno"', 'msgid "Two"\nmsgstr ""', '#~ msgid "Old"\n#~ msgstr "Viejo"', 'msgid "Three"\nmsgstr ""\n"Tres"'].join("\n\n");
    expect(translatedShare(po)).toEqual({ share: 2 / 3, total: 3 });
  });
});

describe("each village chooses its languages", () => {
  it("every non-source language has its own switch, on by default", () => {
    for (const l of LOCALES.filter((x) => x.tier !== "source")) {
      const def = VARIABLES_BY_KEY[offerLocaleKey(l.tag)];
      expect(def?.type).toBe("boolean");
      expect(def?.default).toBe("true");
    }
    expect(VARIABLES_BY_KEY[offerLocaleKey("en")]).toBeUndefined();
  });

  it("the source language is always offered, the rest follow their switch", () => {
    expect(villageLocaleTags(() => true)).toEqual(LOCALES.map((l) => l.tag));
    expect(villageLocaleTags(() => false)).toEqual(LOCALES.filter((l) => l.tier === "source").map((l) => l.tag));
  });
});
