/**
 * R110: sign-in runs one bcrypt compare on every attempt, so the time it takes
 * does not say whether the address belongs to a member.
 */
import bcrypt from "bcrypt";
import { describe, expect, it } from "vitest";
import { checkPasswordUniformly, dummyHash } from "./passwordCheck";

const ROUNDS = 4; // the cheapest cost bcrypt takes; the rule is the same at any cost

function counting() {
  const seen: string[] = [];
  return {
    seen,
    deps: { compare: async (p: string, h: string) => { seen.push(h); return bcrypt.compare(p, h); } },
  };
}

describe("checkPasswordUniformly", () => {
  it("compares against the dummy hash when there is no account, and refuses", async () => {
    const { seen, deps } = counting();
    expect(await checkPasswordUniformly("anything", undefined, ROUNDS, deps)).toBe(false);
    expect(seen).toEqual([await dummyHash(ROUNDS)]);
  });

  it("does the same for an account with no password yet, which used to answer at once", async () => {
    const { seen, deps } = counting();
    expect(await checkPasswordUniformly("", "", ROUNDS, deps)).toBe(false);
    expect(await checkPasswordUniformly("x", "not-a-bcrypt-hash", ROUNDS, deps)).toBe(false);
    expect(seen).toHaveLength(2);
    expect(seen.every((h) => h.startsWith(`$2b$0${ROUNDS}$`))).toBe(true);
  });

  it("checks a real hash for real: right password passes, wrong one fails, one compare each", async () => {
    const stored = await bcrypt.hash("correct horse", ROUNDS);
    const { seen, deps } = counting();
    expect(await checkPasswordUniformly("correct horse", stored, ROUNDS, deps)).toBe(true);
    expect(await checkPasswordUniformly("wrong", stored, ROUNDS, deps)).toBe(false);
    expect(seen).toEqual([stored, stored]);
  });

  it("makes the dummy once per cost", async () => {
    expect(await dummyHash(ROUNDS)).toBe(await dummyHash(ROUNDS));
  });
});
