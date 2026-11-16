/**
 * R113: AUTH_TOKEN_SECRET has a 32-character floor. A village in use never
 * goes down for it (it warns and reads red on the launch journey); only a
 * first start, with nobody in the database, refuses.
 */
import { describe, expect, it } from "vitest";
import { LAUNCH_PROOFS, sessionSecretProof } from "./launchProofs";
import {
  AUTH_TOKEN_SECRET_MIN_LENGTH,
  authTokenSecretTooShort,
  decideAuthTokenSecretAtBoot,
  SHORT_AUTH_TOKEN_SECRET_SENTENCE,
  underTestRunner,
} from "./secretFloors";

const env = (e: Record<string, string>) => e as NodeJS.ProcessEnv;
const SHORT = "ci-smoke-not-a-secret"; // module-review-ok: a fixture string the length check is run against, never a credential
const LONG = "a".repeat(AUTH_TOKEN_SECRET_MIN_LENGTH);
const prod = (secret?: string) => env(secret === undefined ? { NODE_ENV: "production" } : { NODE_ENV: "production", AUTH_TOKEN_SECRET: secret });
const users = (has: boolean) => async () => has;
const readFails = async (): Promise<boolean> => {
  throw new Error("connection lost");
};

describe("what boot does about a short AUTH_TOKEN_SECRET", () => {
  it("existing users and a short secret: boots, and warns naming the variable and the floor, never the value", async () => {
    const v = await decideAuthTokenSecretAtBoot(prod(SHORT), users(true));
    expect(v.action).toBe("warn");
    if (v.action === "ok") throw new Error("expected a line");
    expect(v.line).toContain(SHORT_AUTH_TOKEN_SECRET_SENTENCE);
    expect(v.line).toContain("32 characters");
    expect(v.line).not.toContain(SHORT);
  });

  it("no users yet and a short secret: refuses the first start", async () => {
    const v = await decideAuthTokenSecretAtBoot(prod(SHORT), users(false));
    expect(v.action).toBe("refuse");
    if (v.action === "ok") throw new Error("expected a line");
    expect(v.line).not.toContain(SHORT);
  });

  it("a read of the users that fails: boots and warns, never refuses", async () => {
    const v = await decideAuthTokenSecretAtBoot(prod(SHORT), readFails);
    expect(v.action).toBe("warn");
  });

  it("a long secret, or none: fine, and the users are not even read", async () => {
    expect(await decideAuthTokenSecretAtBoot(prod(LONG), readFails)).toEqual({ action: "ok" });
    expect(await decideAuthTokenSecretAtBoot(prod(), readFails)).toEqual({ action: "ok" });
  });

  it("the test runner is exempt, and nothing else is", () => {
    expect(authTokenSecretTooShort(env({ NODE_ENV: "production", VITEST: "true", AUTH_TOKEN_SECRET: SHORT }))).toBe(false);
    expect(authTokenSecretTooShort(env({ NODE_ENV: "test", AUTH_TOKEN_SECRET: SHORT }))).toBe(false);
    expect(authTokenSecretTooShort(prod(SHORT))).toBe(true);
    expect(underTestRunner(env({ NODE_ENV: "development" }))).toBe(false);
    expect(underTestRunner(env({ VITEST: "1" }))).toBe(false);
  });
});

describe("the launch journey's session-secret row", () => {
  const row = (e: NodeJS.ProcessEnv) => LAUNCH_PROOFS["session-secret"]({} as any, e);

  it("reads red for a short secret, in the words an admin acts on", async () => {
    const r = await row(prod(SHORT));
    expect(r.state).toBe("missing");
    expect(r.detail).toBe("AUTH_TOKEN_SECRET is shorter than 32 characters. Set a long random value and redeploy.");
  });

  it("reads green for a long one", async () => {
    expect((await row(prod(LONG))).state).toBe("ok");
  });

  it("the proof itself: short is red only when the floor applies", () => {
    expect(sessionSecretProof(SHORT, true).state).toBe("missing");
    expect(sessionSecretProof(SHORT, false).state).toBe("ok");
  });
});
