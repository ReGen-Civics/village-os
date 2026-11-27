/**
 * THE GOALS AND TERMS PARSERS' REFUSALS CARRY A CODE (lane ES-A, 27 Nov 2026).
 *
 * Additive: a refusal's English is unchanged, and beside it the code and what it was said with, so a page can say
 * the same sentence in the reader's language. Over a sweep of inputs that reaches every refusal, each one carries a
 * code, and the code's words said with its arguments are exactly the English it sent.
 */
import { describe, expect, it } from "vitest";
import { GOAL_LIMITS, GOAL_WORDS, parseGoals, type GoalCode, type GoalContext } from "./proposalGoals";
import { TERM_KEYS, TERM_LABELS, TERM_NOTE_MAX, TERMS_STEP_WORDS, judgeTermsStep, type TermKey, type TermsStepCode } from "./termsWords";

const goal = (over: Record<string, unknown> = {}) => ({ title: "Plant the first three beds", doneWhen: "they are planted and watered", roleId: "r1", ...over });
const CTX: GoalContext = { roleGoalsOf: (id) => (id === "r1" ? ["Food grows every season"] : []), roleIds: new Set(["r1", "r2"]), seasonKeys: new Set(["sg1"]), today: "2026-11-10" };
const many = (n: number) => Array.from({ length: n }, (_, i) => goal({ title: `Goal ${i}` }));

/** Inputs that reach every refusal parseGoals has, and a few that pass. */
const GOAL_INPUTS: Array<[unknown, GoalContext]> = [
  ["plant beds", CTX],
  [[5], CTX],
  [[], CTX],
  [[goal({ title: "" })], CTX],
  [[goal(), goal({ title: "" })], CTX],
  [[goal({ title: "x".repeat(GOAL_LIMITS.title + 1) })], CTX],
  [[goal({ doneWhen: "" })], CTX],
  [[goal({ doneWhen: "x".repeat(GOAL_LIMITS.doneWhen + 1) })], CTX],
  [[goal({ moves: "x".repeat(GOAL_LIMITS.text + 1) })], CTX],
  [[goal({ roleId: "r9" })], CTX],
  [[goal({ moves: "Something the role never listed" })], CTX],
  [[goal({ serves: "nope" })], CTX],
  [[goal({ date: "next friday" })], CTX],
  [[goal({ date: "2027-03-01" })], CTX],
  [many(GOAL_LIMITS.max + 1), CTX],
  [[goal()], { ...CTX, min: 3 }],
  [[goal()], CTX],
  [many(GOAL_LIMITS.max), CTX],
];

describe("parseGoals refusals carry a code", () => {
  it("every refusal says GOAL_WORDS[code](...args), and the sweep reaches every code", () => {
    const seen = new Set<GoalCode>();
    for (const [raw, ctx] of GOAL_INPUTS) {
      const r = parseGoals(raw, ctx);
      if (r.ok) continue;
      const words = GOAL_WORDS[r.code] as string | ((...a: unknown[]) => string);
      expect(typeof words === "function" ? words(...r.args) : words, JSON.stringify(raw).slice(0, 80)).toBe(r.error);
      seen.add(r.code);
    }
    expect([...seen].sort()).toEqual((Object.keys(GOAL_WORDS) as GoalCode[]).sort());
  });

  it("an accepted list is accepted as it was", () => {
    for (const raw of [[goal()], many(GOAL_LIMITS.max)]) expect(parseGoals(raw, CTX).ok).toBe(true);
  });
});

const accept = (keys: readonly TermKey[]) => Object.fromEntries(keys.map((k) => [k, { choice: "accept", note: "" }]));

describe("judgeTermsStep refusals carry a code", () => {
  it("every refusal says TERMS_STEP_WORDS[code] with the setting it names, and the sweep reaches every code", () => {
    const seen = new Set<TermsStepCode>();
    const inputs: Array<[unknown, TermKey[]]> = [
      [{ answers: {}, commitmentPct: 55 }, []],
      [{ answers: {}, commitmentPct: 50 }, ["term", "ending"]],
      ...TERM_KEYS.map((k): [unknown, TermKey[]] => [{ answers: { [k]: { choice: "maybe" } }, commitmentPct: 10 }, []]),
      ...TERM_KEYS.map((k): [unknown, TermKey[]] => [{ answers: { [k]: { choice: "talk", note: "x".repeat(TERM_NOTE_MAX + 1) } }, commitmentPct: 10 }, []]),
      ...TERM_KEYS.map((k): [unknown, TermKey[]] => [{ answers: {}, commitmentPct: 10 }, [k]]),
    ];
    for (const [raw, written] of inputs) {
      const r = judgeTermsStep(raw, written);
      if (r.ok) continue;
      seen.add(r.code);
      if (r.code === "commitment") {
        expect(r.key).toBe("commitment");
        expect(r.error).toBe(TERMS_STEP_WORDS.commitment);
        continue;
      }
      const label = TERM_LABELS[r.key as TermKey];
      expect(r.code === "unanswered" ? TERMS_STEP_WORDS.unanswered(label) : TERMS_STEP_WORDS.noteTooLong(label, TERM_NOTE_MAX)).toBe(r.error);
    }
    expect([...seen].sort()).toEqual((Object.keys(TERMS_STEP_WORDS) as TermsStepCode[]).sort());
  });

  it("says the same English it always said", () => {
    expect(judgeTermsStep({ answers: {}, commitmentPct: 50 }, ["term"])).toMatchObject({ ok: false, error: "Say whether you accept or would like to talk about Term.", key: "term" });
    expect(judgeTermsStep({ answers: { bonus: { choice: "talk", note: "x".repeat(TERM_NOTE_MAX + 1) } }, commitmentPct: 50 }, [])).toMatchObject({
      ok: false,
      error: `Keep your note on Bonus to ${TERM_NOTE_MAX} characters.`,
      key: "bonus",
    });
    expect(judgeTermsStep({ answers: {}, commitmentPct: 5 }, [])).toMatchObject({ ok: false, error: "Choose your commitment, from 0 to 100 in steps of 10.", key: "commitment" });
    expect(judgeTermsStep({ answers: accept(["term"]), commitmentPct: 50 }, ["term"]).ok).toBe(true);
  });
});
