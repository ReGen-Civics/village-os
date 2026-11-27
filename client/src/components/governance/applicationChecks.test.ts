import path from "node:path";
import { i18n } from "@lingui/core";
import { formatter } from "@lingui/format-po";
import { generateMessageId } from "@lingui/message-utils/generateMessageId";
import { afterEach, describe, expect, it } from "vitest";
import { DRAFT_KINDS, DRAFT_WORDS, type DraftKind } from "@shared/seraDrafts";
// @ts-expect-error - scripts/ is untyped JavaScript, deliberately outside tsconfig
import { mergedPoText } from "../../../../scripts/lib/poFragments.mjs";
import { atMostRoles, draftBlocked, moreToFix, pickRole, pickVillageGoal, sayAim, termsUnanswered } from "./applicationChecks";

async function spanish(): Promise<Record<string, string>> {
  const dir = path.resolve(__dirname, "../../locales");
  const es = await formatter({ lineNumbers: false }).parse(mergedPoText(dir, "es"), { locale: "es", sourceLocale: "en", filename: path.join(dir, "es.po") });
  return Object.fromEntries(Object.entries(es).map(([id, m]) => [id, (m as { translation?: string }).translation ?? ""]));
}

/** Every ordered pick of one to three drafted parts, as the form can report them. */
function picks(): DraftKind[][] {
  const out: DraftKind[][] = [];
  const grow = (sofar: DraftKind[]) => {
    if (sofar.length) out.push(sofar);
    if (sofar.length === 3) return;
    for (const k of DRAFT_KINDS) if (!sofar.includes(k)) grow([...sofar, k]);
  };
  grow([]);
  return out;
}

const CHECK = "role application: check";
const IDS = [
  ...["your aim", "your goals", "your story line"].map((m) => generateMessageId(m, "role application: a drafted part")),
  ...["Your aim", "Your goals", "Your story line"].map((m) => generateMessageId(m, "role application: a drafted part, starting a sentence")),
  ...[
    "One proposal holds at most {max} roles.",
    "Pick the role you are proposing for.",
    "Pick the village goal your work serves.",
    "Say whether you accept each setting, or would like to talk about it, and choose your commitment.",
    "Say your aim for this role.",
    "{first} And {more} more to fix in the terms.",
    '{first} is still a draft from Sera. Edit it or press "Keep this", then send.',
    '{head} and {last} are still a draft from Sera. Edit them or press "Keep this", then send.',
  ].map((m) => generateMessageId(m, CHECK)),
];

describe("a role application's own checks in the reader's language (lane ES-A)", () => {
  afterEach(() => i18n.activate("en"));

  it("say exactly what they said in English", () => {
    expect(termsUnanswered()).toBe("Say whether you accept each setting, or would like to talk about it, and choose your commitment.");
    expect(moreToFix("Pick a currency.", 2)).toBe("Pick a currency. And 2 more to fix in the terms.");
    expect(moreToFix("Pick a currency.", 0)).toBe("Pick a currency.");
    expect(pickRole()).toBe("Pick the role you are proposing for.");
    expect(atMostRoles(3)).toBe("One proposal holds at most 3 roles.");
    expect(sayAim()).toBe("Say your aim for this role.");
    expect(pickVillageGoal()).toBe("Pick the village goal your work serves.");
  });

  it("the draft sentence is the shared DRAFT_WORDS.blocked, word for word, for every pick of drafted parts", () => {
    for (const p of picks()) expect(draftBlocked(p), p.join("+")).toBe(DRAFT_WORDS.blocked(p));
  });

  it("Spanish carries every entry, read from es.po with the fragments folded in", async () => {
    const es = await spanish();
    expect(IDS.filter((id) => !es[id]), "add them to client/src/locales/es.d/es-a-application-checks.po").toEqual([]);
  });

  it("speaks Spanish when the page does, the parts joined by the sentence", async () => {
    i18n.loadAndActivate({ locale: "es", messages: await spanish() });
    expect(pickRole()).toBe("Elija el rol para el que se propone.");
    expect(draftBlocked(["aim", "goals", "story"])).toBe('Su objetivo, sus metas y su línea de historia: siguen siendo un borrador de Sera. Edítelos o pulse "Quedarme con esto" y luego envíe.');
  });
});
