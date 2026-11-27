import path from "node:path";
import { i18n, type MessageDescriptor } from "@lingui/core";
import { formatter } from "@lingui/format-po";
import { afterEach, describe, expect, it } from "vitest";
import { GOAL_LIMITS, GOAL_WORDS, parseGoals } from "@shared/proposalGoals";
import { TERM_KEYS, TERM_LABELS, TERM_NOTE_MAX, TERMS_STEP_WORDS, judgeTermsStep } from "@shared/termsWords";
// @ts-expect-error - scripts/ is untyped JavaScript, deliberately outside tsconfig
import { mergedPoText } from "../../../../scripts/lib/poFragments.mjs";
import { expectMirrorMatches } from "@/i18n/wordTableTesting";
import { GOAL_MIRROR, TERM_LABEL_MIRROR, TERMS_STEP_MIRROR, goalsRefusal, termsRefusal } from "./parsedChecks";

const GOAL_SAMPLES = {
  needTitle: [[1], [4]],
  needDoneWhen: [[2]],
  tooLong: [["A goal", GOAL_LIMITS.title], ["Done when", GOAL_LIMITS.doneWhen], ["Something new", 9]],
  notTheRole: [[1]],
  notASeasonGoal: [[3]],
  badDate: [[1]],
  dateOutside: [[2]],
  notThisProposal: [[5]],
};
const TERMS_SAMPLES = { unanswered: [["Term"], ["Bonus"]], noteTooLong: [["Ending", TERM_NOTE_MAX]] };

/** Every descriptor id the mirrors draw, with the function entries run on their samples. */
function ids(): string[] {
  const out = new Set<string>();
  const walk = (mirror: Record<string, unknown>, samples: Record<string, unknown[][]>) => {
    for (const [k, v] of Object.entries(mirror)) {
      if (typeof v === "function") for (const args of samples[k] ?? []) out.add(((v as (...a: unknown[]) => MessageDescriptor)(...args)).id);
      else out.add((v as MessageDescriptor).id);
    }
  };
  walk(GOAL_MIRROR, GOAL_SAMPLES);
  walk(TERM_LABEL_MIRROR, {});
  walk(TERMS_STEP_MIRROR, TERMS_SAMPLES);
  return Array.from(out);
}

async function spanish(): Promise<Record<string, string>> {
  const dir = path.resolve(__dirname, "../../locales");
  const es = await formatter({ lineNumbers: false }).parse(mergedPoText(dir, "es"), { locale: "es", sourceLocale: "en", filename: path.join(dir, "es.po") });
  return Object.fromEntries(Object.entries(es).map(([id, m]) => [id, (m as { translation?: string }).translation ?? ""]));
}

const goal = (over: Record<string, unknown> = {}) => ({ title: "Plant the first three beds", doneWhen: "they are planted and watered", roleId: "r1", ...over });

describe("the goals and terms parsers' refusals in the reader's language (lane ES-A)", () => {
  afterEach(() => i18n.activate("en"));

  it("each mirror draws exactly the shared English, and every entry goes through the catalog", () => {
    expectMirrorMatches(GOAL_WORDS, GOAL_MIRROR, GOAL_SAMPLES);
    expectMirrorMatches(TERM_LABELS, TERM_LABEL_MIRROR);
    expectMirrorMatches(TERMS_STEP_WORDS, TERMS_STEP_MIRROR, TERMS_SAMPLES);
  });

  it("in English, a refusal drawn from its code is the parser's own English", () => {
    const goals: unknown[] = [[], [goal({ title: "" })], [goal({ doneWhen: "x".repeat(GOAL_LIMITS.doneWhen + 1) })], [goal({ date: "soon" })]];
    for (const raw of goals) {
      const r = parseGoals(raw, {});
      expect(r.ok).toBe(false);
      if (!r.ok) expect(goalsRefusal(r)).toBe(r.error);
    }
    for (const k of TERM_KEYS) {
      for (const r of [judgeTermsStep({ answers: {}, commitmentPct: 10 }, [k]), judgeTermsStep({ answers: { [k]: { choice: "talk", note: "x".repeat(TERM_NOTE_MAX + 1) } }, commitmentPct: 10 }, [])]) {
        expect(r.ok).toBe(false);
        if (!r.ok) expect(termsRefusal(r)).toBe(r.error);
      }
    }
    const c = judgeTermsStep({ answers: {}, commitmentPct: 3 }, []);
    if (!c.ok) expect(termsRefusal(c)).toBe(c.error);
  });

  it("a refusal with no code, or one this build does not know, is said in its own English", () => {
    expect(goalsRefusal({ error: "Something older." })).toBe("Something older.");
    expect(goalsRefusal({ error: "Something newer.", code: "notYetAThing" })).toBe("Something newer.");
    expect(termsRefusal({ error: "Something older." })).toBe("Something older.");
    expect(termsRefusal({ error: "Something newer.", code: "notYetAThing", key: "term" })).toBe("Something newer.");
  });

  it("Spanish carries every entry, read from es.po with the fragments folded in", async () => {
    const es = await spanish();
    const missing = ids().filter((id) => !es[id]);
    expect(missing, "add them to client/src/locales/es.d/es-a-goal-terms-checks.po").toEqual([]);
  });

  it("speaks Spanish when the page does", async () => {
    i18n.loadAndActivate({ locale: "es", messages: await spanish() });
    const needTitle = parseGoals([goal(), goal({ title: "" })], {});
    expect(needTitle.ok).toBe(false);
    if (!needTitle.ok) expect(goalsRefusal(needTitle)).toBe("Ponga nombre a la meta 2.");
    const unanswered = judgeTermsStep({ answers: {}, commitmentPct: 50 }, ["allowance"]);
    if (!unanswered.ok) expect(termsRefusal(unanswered)).toBe("Asignación: diga si lo acepta o si prefiere conversarlo.");
  });
});
