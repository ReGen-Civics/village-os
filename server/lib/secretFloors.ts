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

/** The words an admin reads on the launch journey, and the boot log repeats. */
export const SHORT_AUTH_TOKEN_SECRET_SENTENCE =
  `AUTH_TOKEN_SECRET is shorter than ${AUTH_TOKEN_SECRET_MIN_LENGTH} characters. Set a long random value and redeploy.`;

/**
 * True when AUTH_TOKEN_SECRET is SET and shorter than the floor. Unset is not
 * this problem: the server then signs with a random per-process secret and
 * says so, which fails closed. The test runner is exempt (see the header).
 */
export function authTokenSecretTooShort(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.AUTH_TOKEN_SECRET;
  if (!value) return false;
  if (underTestRunner(env)) return false;
  return value.length < AUTH_TOKEN_SECRET_MIN_LENGTH;
}

/** The loud boot line. Names the variable and the floor, never the value or its length. */
export function shortAuthTokenSecretWarning(): string {
  return (
    `[startup] WARNING: ${SHORT_AUTH_TOKEN_SECRET_SENTENCE} Every sign-in token is signed with it, and a short one ` +
    "can be guessed offline from any one token. Use openssl rand -hex 32. Changing it signs everybody out once."
  );
}

export type AuthTokenSecretVerdict =
  | { action: "ok" }
  | { action: "warn"; line: string }
  | { action: "refuse"; line: string };

/**
 * What boot does about a short AUTH_TOKEN_SECRET (R113), decided once the
 * database is reachable.
 *
 * A VILLAGE IN USE NEVER GOES DOWN FOR IT. A deployment that already has a
 * real user boots, warns on every start, and shows the problem red on the
 * launch journey (server/lib/launchProofs.ts, `session-secret`): taking a live
 * village offline over a value nobody has measured, on a deploy that promotes
 * itself, is a worse outcome than the weak secret.
 *
 * A FIRST START REFUSES. With nobody in the database there is nothing to take
 * down, and the founder is at the keyboard choosing the value right now, so
 * this is the cheapest moment there will ever be to fix it.
 *
 * A READ THAT FAILS BOOTS. Not knowing whether anybody lives here is never a
 * reason to refuse: it warns, and says the read failed.
 */
export async function decideAuthTokenSecretAtBoot(
  env: NodeJS.ProcessEnv,
  hasAnyRealUser: () => Promise<boolean>,
): Promise<AuthTokenSecretVerdict> {
  if (!authTokenSecretTooShort(env)) return { action: "ok" };
  let inUse: boolean;
  try {
    inUse = await hasAnyRealUser();
  } catch {
    return {
      action: "warn",
      line: `${shortAuthTokenSecretWarning()} (Whether this village has members could not be read, so it starts anyway.)`,
    };
  }
  if (inUse) return { action: "warn", line: shortAuthTokenSecretWarning() };
  return {
    action: "refuse",
    line:
      `[startup] refusing to start: ${SHORT_AUTH_TOKEN_SECRET_SENTENCE} This village has nobody in it yet, so this is the ` +
      "moment to fix it: use openssl rand -hex 32 (node scripts/fork-init.mjs generates one) and start again.",
  };
}
