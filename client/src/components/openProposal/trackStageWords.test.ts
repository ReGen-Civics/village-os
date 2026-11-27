import path from "node:path";
import { formatter } from "@lingui/format-po";
import { describe, expect, it } from "vitest";
import { TRACK_WORDS } from "@shared/applicantOnboarding";
// @ts-expect-error - scripts/ is untyped JavaScript, deliberately outside tsconfig
import { mergedPoText } from "../../../../scripts/lib/poFragments.mjs";
import { expectMirrorMatches } from "@/i18n/wordTableTesting";
import { TRACK_STAGE_MIRROR } from "./trackStageWords";

describe("the application stages in the reader's language (lane ES-A)", () => {
  it("draws exactly the shared English, and every entry goes through the catalog", () => {
    expectMirrorMatches(TRACK_WORDS, TRACK_STAGE_MIRROR);
  });

  it("Spanish carries every entry, read from es.po with the fragments folded in", async () => {
    const dir = path.resolve(__dirname, "../../locales");
    const es = await formatter({ lineNumbers: false }).parse(mergedPoText(dir, "es"), { locale: "es", sourceLocale: "en", filename: path.join(dir, "es.po") });
    const missing = Object.entries(TRACK_STAGE_MIRROR)
      .filter(([, d]) => !(es[d.id] as { translation?: string } | undefined)?.translation)
      .map(([k]) => k);
    expect(missing, "add them to client/src/locales/es.d/es-a-small-tables.po").toEqual([]);
  });
});
