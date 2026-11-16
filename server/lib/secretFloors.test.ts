/** R113: a set AUTH_TOKEN_SECRET shorter than 32 characters refuses to boot. */
import { describe, expect, it } from "vitest";
import { AUTH_TOKEN_SECRET_MIN_LENGTH, authTokenSecretProblem, underTestRunner } from "./secretFloors";

const env = (e: Record<string, string>) => e as NodeJS.ProcessEnv;

describe("authTokenSecretProblem", () => {
  it("unset is not a refusal: the random per-process fallback applies", () => {
    expect(authTokenSecretProblem(env({ NODE_ENV: "production" }))).toBeNull();
  });

  it("a short set value is refused, and the sentence names the variable and never the value", () => {
    const said = authTokenSecretProblem(env({ NODE_ENV: "production", AUTH_TOKEN_SECRET: "ci-smoke-not-a-secret" })); // module-review-ok: a fixture string the length check is run against, never a credential
    expect(said).toContain("AUTH_TOKEN_SECRET is set but is 21 characters");
    expect(said).not.toContain("ci-smoke-not-a-secret");
  });

  it("32 characters or more is accepted", () => {
    expect(AUTH_TOKEN_SECRET_MIN_LENGTH).toBe(32);
    expect(authTokenSecretProblem(env({ NODE_ENV: "production", AUTH_TOKEN_SECRET: "a".repeat(32) }))).toBeNull();
  });

  it("the test runner is exempt, and nothing else is", () => {
    expect(authTokenSecretProblem(env({ NODE_ENV: "production", VITEST: "true", AUTH_TOKEN_SECRET: "short" }))).toBeNull();
    expect(authTokenSecretProblem(env({ NODE_ENV: "test", AUTH_TOKEN_SECRET: "short" }))).toBeNull();
    expect(underTestRunner(env({ NODE_ENV: "development" }))).toBe(false);
    expect(underTestRunner(env({ VITEST: "1" }))).toBe(false);
  });
});
