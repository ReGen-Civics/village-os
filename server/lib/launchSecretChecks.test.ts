/**
 * THREE LAUNCH SECURITY CHECKS (2026-11-18).
 *
 *   1. `admin-password`: ADMIN_PASSWORD set and at least 20 characters, a
 *      blocking row. Before this the floor was met only at the two doors it
 *      guards (founder claim, village export), on the day somebody needed one.
 *   2. `break-glass-email`: the `env-present` probe the guild row asked for,
 *      a recommended row that reads present or not.
 *   3. The issuance-cap row says which doors refuse at the number, and which
 *      are only counted (the dial's own closing at launch is pinned in
 *      launchDoors.test.ts).
 *
 * No answer here may carry a secret's value or its length, so each case
 * checks the detail against both.
 */
import { describe, expect, it } from "vitest";
import { LAUNCH_REQUIREMENTS } from "../../shared/launchRequirements";
import { SEEDS_BY_ID } from "../../shared/guilds";
import { LAUNCH_PROOFS, adminPasswordProof, breakGlassEmailProof } from "./launchProofs";
import { ADMIN_PASSWORD_MIN_LENGTH } from "./passwordDoors";

/** An environment outside the test runner, so the floors apply. */
const prod = (over: Record<string, string>): NodeJS.ProcessEnv => ({ NODE_ENV: "production", ...over }) as NodeJS.ProcessEnv;

const SHORT = "short-but-real-pw"; // 17 characters
const LONG = "a-long-founder-password-for-this-test"; // 37 characters
const EMAIL = "steward@village.example.org";

/** True when the text names the value, or a length other than the floor itself. */
function leaks(text: string, value: string): boolean {
  if (text.includes(value)) return true;
  const numbers = (text.match(/\d+/g) ?? []).map(Number);
  return numbers.some((n) => n !== ADMIN_PASSWORD_MIN_LENGTH && (n === value.length || n === value.trim().length));
}

const row = (id: string) => LAUNCH_REQUIREMENTS.find((r) => r.id === id)!;
const resolve = (key: string, env: NodeJS.ProcessEnv) => LAUNCH_PROOFS[key]!({} as any, env);

describe("admin-password: a blocking row on the journey", () => {
  it("is blocking, resolved by a proof, and sends the founder to the host's variables", () => {
    const r = row("admin-password");
    expect(r.severity).toBe("blocking");
    expect(r.checkKey).toBe("admin-password");
    expect(LAUNCH_PROOFS[r.checkKey]).toBeTypeOf("function");
    expect(r.fixAt).toContain("#environment-variables");
    expect(r.why).toContain(`${ADMIN_PASSWORD_MIN_LENGTH} characters`);
    expect(r.carriedByVote).toBeFalsy();
  });

  it("passes when set and long enough, naming neither the value nor its length", async () => {
    const r = await resolve("admin-password", prod({ ADMIN_PASSWORD: LONG }));
    expect(r.state).toBe("ok");
    expect(leaks(r.detail, LONG)).toBe(false);
  });

  it("fails when shorter than the floor, naming neither the value nor its length", async () => {
    const r = await resolve("admin-password", prod({ ADMIN_PASSWORD: SHORT }));
    expect(r.state).toBe("missing");
    expect(r.detail).toContain(`shorter than ${ADMIN_PASSWORD_MIN_LENGTH} characters`);
    expect(leaks(r.detail, SHORT)).toBe(false);
  });

  it("fails when exactly one short of the floor, and passes at the floor", async () => {
    expect((await resolve("admin-password", prod({ ADMIN_PASSWORD: "x".repeat(ADMIN_PASSWORD_MIN_LENGTH - 1) }))).state).toBe("missing");
    expect((await resolve("admin-password", prod({ ADMIN_PASSWORD: "x".repeat(ADMIN_PASSWORD_MIN_LENGTH) }))).state).toBe("ok");
  });

  it("passes when unset, saying the founder-password way back is off", async () => {
    const r = await resolve("admin-password", prod({}));
    expect(r.state).toBe("ok");
    expect(r.detail).toBe("Not set, so the founder-password way back is off; a lockout then needs the host");
  });

  it("fails when set and weak: blank, or the placeholder the server falls back to", async () => {
    for (const env of [prod({ ADMIN_PASSWORD: "" }), prod({ ADMIN_PASSWORD: "   " }), prod({ ADMIN_PASSWORD: "change-me" })]) {
      const r = await resolve("admin-password", env);
      expect(r.state).toBe("missing");
      expect(r.detail).toContain("blank value or the placeholder");
      expect(r.detail).not.toContain("change-me");
    }
  });

  it("follows the test runner's exemption from the floor, the way the doors do", () => {
    expect(adminPasswordProof(SHORT, false).state).toBe("ok");
    expect(adminPasswordProof(SHORT, true).state).toBe("missing");
    expect(adminPasswordProof(undefined, true).state, "unset passes whatever the floor").toBe("ok");
  });
});

describe("break-glass-email: the env-present probe", () => {
  it("is a recommended row, never blocking", () => {
    const r = row("break-glass-email");
    expect(r.severity).toBe("recommended");
    expect(r.checkKey).toBe("break-glass-email");
    expect(LAUNCH_PROOFS[r.checkKey]).toBeTypeOf("function");
  });

  it("reports present without the address", async () => {
    const r = await resolve("break-glass-email", prod({ BREAK_GLASS_ADMIN_EMAIL: EMAIL }));
    expect(r.state).toBe("ok");
    expect(r.detail).not.toContain(EMAIL);
    expect(r.detail).not.toContain("@");
    expect(r.detail).toContain("lockout drill");
  });

  it("reports absent when unset or blank", async () => {
    expect((await resolve("break-glass-email", prod({}))).state).toBe("missing");
    expect(breakGlassEmailProof("  ").state).toBe("missing");
  });

  it("the guild seed reads this row, at presence strength, and no longer says the probe is to build", () => {
    const seed = SEEDS_BY_ID["break-glass-email"]!;
    expect(seed.launchRequirement).toBe("break-glass-email");
    expect(seed.liveCheck).toMatchObject({ via: "launch-check", checkKey: "break-glass-email", strength: "present" });
    expect(seed.certainty).toBe("verified");
    expect(seed.open ?? []).toEqual([]);
  });

  it("the admin-password seed reads the new password row", () => {
    const seed = SEEDS_BY_ID["admin-password"]!;
    expect(seed.launchRequirement).toBe("admin-password");
    expect(seed.liveCheck).toMatchObject({ via: "launch-check", checkKey: "admin-password", strength: "present" });
  });
});

describe("the issuance-cap row says which doors refuse at the number", () => {
  const why = row("issuance-cap").why;

  it("names the five guarded doors and says the others are counted and never refused", () => {
    for (const door of ["hand mint", "co-signed mint approval", "treasury stocking", "funding a circle treasury", "cap bonus"]) {
      expect(why, door).toContain(door);
    }
    expect(why).toContain("those five are refused");
    expect(why).toContain("never refused");
    expect(why).toContain("not counted at all");
    expect(why).toContain("only a village vote changes it");
  });

  it("no longer claims every door spends the number", () => {
    expect(why.toLowerCase()).not.toContain("every door");
  });

  it("follows the house voice", () => {
    for (const r of [row("issuance-cap"), row("admin-password"), row("break-glass-email")]) {
      expect(r.why).not.toMatch(/[–—]/);
      expect(r.why.toLowerCase()).not.toContain("rather than");
    }
  });
});
