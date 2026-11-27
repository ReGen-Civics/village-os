import path from "node:path";
import { i18n, type MessageDescriptor } from "@lingui/core";
import { formatter } from "@lingui/format-po";
import { afterEach, describe, expect, it } from "vitest";
import { CONSENT_WORDS, TALLY_WORDS } from "@shared/roleProposalConsent";
// @ts-expect-error - scripts/ is untyped JavaScript, deliberately outside tsconfig
import { mergedPoText } from "../../../../scripts/lib/poFragments.mjs";
import { expectMirrorMatches } from "@/i18n/wordTableTesting";
import { CONSENT_MIRROR, HEADINGS_MIRROR, TALLY_MIRROR, consentHeadings, consentWords, stateLine, tallyLine } from "./consentWords";
import { ADOPTED_HEADING, STATE_HEADINGS } from "./proposalWords";

const SAMPLES = {
  open: [["2026-11-09"]],
  askTitle: [[[]], [["Gate keeper"]], [["Gate keeper", "Orchard keeper", "Seed saver"]]],
  askBody: [["2026-11-09"]],
  askedYou: [["2026-11-09"]],
};

/** Every descriptor id the mirrors draw, with the function entries run on their samples. */
function ids(): string[] {
  const out = new Set<string>();
  const walk = (node: unknown, at: string) => {
    if (node && typeof node === "object" && typeof (node as MessageDescriptor).id === "string") {
      out.add((node as MessageDescriptor).id);
      return;
    }
    if (typeof node === "function") {
      for (const args of (SAMPLES as Record<string, unknown[][]>)[at] ?? []) walk((node as (...a: unknown[]) => unknown)(...args), at);
      return;
    }
    if (node && typeof node === "object") for (const [k, v] of Object.entries(node)) walk(v, k);
  };
  walk(CONSENT_MIRROR, "");
  walk(TALLY_MIRROR, "");
  walk(HEADINGS_MIRROR, "");
  return Array.from(out);
}

async function spanish(): Promise<Record<string, string>> {
  const dir = path.resolve(__dirname, "../../locales");
  const es = await formatter({ lineNumbers: false }).parse(mergedPoText(dir, "es"), { locale: "es", sourceLocale: "en", filename: path.join(dir, "es.po") });
  return Object.fromEntries(Object.entries(es).map(([id, m]) => [id, (m as { translation?: string }).translation ?? ""]));
}

describe("the circle's consent in the reader's language (lane ES-A)", () => {
  afterEach(() => i18n.activate("en"));

  it("draws exactly the shared English, and every entry goes through the catalog", () => {
    expectMirrorMatches(CONSENT_WORDS, CONSENT_MIRROR, SAMPLES);
    expectMirrorMatches(TALLY_WORDS, TALLY_MIRROR);
    expectMirrorMatches({ states: STATE_HEADINGS, adopted: ADOPTED_HEADING }, HEADINGS_MIRROR);
  });

  it("Spanish carries every entry, read from es.po with the fragments folded in", async () => {
    const es = await spanish();
    const missing = ids().filter((id) => !es[id]);
    expect(missing, "add them to client/src/locales/es.d/es-a-circle-consent.po").toEqual([]);
  });

  it("in Spanish: the date in the reader's locale, the roles joined by the sentence, and the state line", async () => {
    i18n.loadAndActivate({ locale: "es", messages: await spanish() });
    const w = consentWords(i18n);
    expect(w.askedYou("2026-11-09")).toBe("Su círculo le pide que consienta u objete a más tardar el 9 de noviembre de 2026.");
    expect(w.askTitle(["Gate keeper", "Orchard keeper", "Seed saver"])).toBe("Se consulta a su círculo sobre una propuesta de roles: Gate keeper, Orchard keeper y Seed saver");
    expect(stateLine("lapsed", null, w)).toMatch(/^Pasaron los 2 días hábiles/);
    expect(consentHeadings(i18n).states.open).toBe("A la espera del círculo");
  });

  it("the tally keeps the shared numbers and titles, with the drawn None", () => {
    const none = { asked: "", consented: "", objected: "", none: "Ninguno" };
    expect(tallyLine(0, [], none)).toBe("Ninguno");
    expect(tallyLine(2, ["Gate keeper", " Orchard keeper "], none)).toBe("2 (Gate keeper, Orchard keeper)");
    expect(tallyLine(1, [], none)).toBe("1");
  });
});
