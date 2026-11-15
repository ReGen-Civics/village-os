/**
 * Minimum lengths for the secrets a deployment is configured with (audit S2,
 * R113), and the one exemption they share.
 *
 * THE EXEMPTION IS THE TEST RUNNER, and only the test runner. The e2e suites
 * boot the built server as a child process with NODE_ENV=production (they
 * test what ships) and short fixture values, eighty-odd of them, each a
 * throwaway on a scratch schema. The child inherits the runner's environment,
 * and vitest marks it with VITEST=true. NODE_ENV=test is honoured as well. No
 * hosting platform sets either, and an operator who sets one on a real
 * deployment has chosen to run it as a test.
 */

export function underTestRunner(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "test" || env.VITEST === "true";
}

export const AUTH_TOKEN_SECRET_MIN_LENGTH = 32;

/**
 * Why AUTH_TOKEN_SECRET cannot be used, or null when it can. Unset is not a
 * problem here: the server then signs with a random per-process secret and
 * says so, which fails closed. A SET value that is short is a secret a
 * guesser can brute-force offline from any one token, so it refuses to boot.
 */
export function authTokenSecretProblem(env: NodeJS.ProcessEnv = process.env): string | null {
  const value = env.AUTH_TOKEN_SECRET;
  if (!value) return null;
  if (underTestRunner(env)) return null;
  if (value.length >= AUTH_TOKEN_SECRET_MIN_LENGTH) return null;
  return (
    `AUTH_TOKEN_SECRET is set but is ${value.length} characters, under the ${AUTH_TOKEN_SECRET_MIN_LENGTH} it needs. ` +
    "Every sign-in token is signed with it, and a short one can be guessed from any token. " +
    "Set a long random value (openssl rand -hex 32) and restart. Changing it signs everybody out once."
  );
}
