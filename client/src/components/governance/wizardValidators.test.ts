import path from "node:path";
import { i18n } from "@lingui/core";
import { formatter } from "@lingui/format-po";
import { generateMessageId } from "@lingui/message-utils/generateMessageId";
import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error - scripts/ is untyped JavaScript, deliberately outside tsconfig
import { mergedPoText } from "../../../../scripts/lib/poFragments.mjs";
import { expectKeyedMatches } from "@/i18n/wordTableTesting";
import { FIELD_NAMES, atLeast, changesPresent, pct, positive, required } from "./wizardValidators";

async function spanish(): Promise<Record<string, string>> {
  const dir = path.resolve(__dirname, "../../locales");
  const es = await formatter({ lineNumbers: false }).parse(mergedPoText(dir, "es"), { locale: "es", sourceLocale: "en", filename: path.join(dir, "es.po") });
  return Object.fromEntries(Object.entries(es).map(([id, m]) => [id, (m as { translation?: string }).translation ?? ""]));
}

/** The checks' own sentences and the review heading, as the catalog keys them. */
const CHECKS = [
  "{field} is the part only you can write. It cannot be blank",
  "{field} needs at least {n} characters so the village can weigh it",
  "That needs to be a number between 0 and 100",
  "A percentage runs from 0 to 100",
  "{field} has to be more than zero",
  "Pick at least one dial to change, and say what it becomes",
].map((m) => generateMessageId(m, "proposal wizard: check"));
const REVIEW = generateMessageId("{0, plural, one {One thing is not ready} other {# things are not ready}}", "proposal wizard: review");

describe("the proposal wizard's checks in the reader's language (lane ES-A)", () => {
  afterEach(() => i18n.activate("en"));

  it("say exactly what they said in English", () => {
    expect(required("A title")("")).toBe("A title is the part only you can write. It cannot be blank");
    expect(required("A title")("x")).toBeNull();
    expect(atLeast(30, '"Why you"')("short")).toBe('"Why you" needs at least 30 characters so the village can weigh it');
    expect(pct("x")).toBe("That needs to be a number between 0 and 100");
    expect(pct(120)).toBe("A percentage runs from 0 to 100");
    expect(pct(50)).toBeNull();
    expect(positive("An amount")(0)).toBe("An amount has to be more than zero");
    expect(positive("An amount")(3)).toBeNull();
    expect(changesPresent([])).toBe("Pick at least one dial to change, and say what it becomes");
    // A field the map does not know is said as written.
    expect(required("A new field")("")).toBe("A new field is the part only you can write. It cannot be blank");
  });

  it("each field a check names is its own English, and goes through the catalog", () => {
    expectKeyedMatches(FIELD_NAMES);
  });

  it("Spanish carries every field, every check and the review heading, read from es.po with the fragments folded in", async () => {
    const es = await spanish();
    const missing = [...Object.values(FIELD_NAMES).map((d) => d.id), ...CHECKS, REVIEW].filter((id) => !es[id]);
    expect(missing, "add them to client/src/locales/es.d/es-a-wizard-checks.po").toEqual([]);
  });

  it("speaks Spanish when the page does", async () => {
    i18n.loadAndActivate({ locale: "es", messages: await spanish() });
    expect(required("A title")("")).toBe("Un título: es la parte que solo usted puede escribir. No puede quedar en blanco");
    expect(atLeast(30, '"Why you"')("")).toBe('"Por qué usted": necesita al menos 30 caracteres, así la aldea tiene algo que valorar');
  });
});
