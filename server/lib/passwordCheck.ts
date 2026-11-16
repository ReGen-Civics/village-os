/**
 * A password compare that costs the same whether or not the account exists
 * (audit R110).
 *
 * Sign-in used to skip bcrypt entirely when no member had the address, and
 * when the member had no password yet (`bcrypt.compare` throws on an empty
 * hash, at once). A wrong password on a real account took a full bcrypt round
 * and an unknown address answered in a millisecond, so the response time said
 * which addresses belong to members. Now every attempt runs exactly one
 * compare: against the stored hash when there is a usable one, and against a
 * dummy hash at the same cost when there is not. The dummy can never match,
 * because nobody knows the random password it was made from.
 */
import crypto from "crypto";
import bcrypt from "bcrypt";

/** A bcrypt hash this compare can run against: `$2a$`, `$2b$` or `$2y$`. */
const BCRYPT_SHAPE = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

const dummies = new Map<number, Promise<string>>();

/** One dummy hash per cost, made once per process, from a password nobody holds. */
export function dummyHash(rounds: number): Promise<string> {
  let h = dummies.get(rounds);
  if (!h) {
    h = bcrypt.hash(crypto.randomBytes(32).toString("base64url"), rounds);
    dummies.set(rounds, h);
  }
  return h;
}

export interface PasswordCheckDeps {
  compare(password: string, hash: string): Promise<boolean>;
}

const realCompare: PasswordCheckDeps = { compare: (p, h) => bcrypt.compare(p, h) };

/**
 * True only when `storedHash` is a real bcrypt hash and `password` matches it.
 * Runs one bcrypt compare in every case.
 */
export async function checkPasswordUniformly(
  password: string,
  storedHash: string | null | undefined,
  rounds: number,
  deps: PasswordCheckDeps = realCompare,
): Promise<boolean> {
  const usable = typeof storedHash === "string" && BCRYPT_SHAPE.test(storedHash);
  const against = usable ? storedHash : await dummyHash(rounds);
  try {
    const ok = await deps.compare(String(password), against);
    return usable && ok;
  } catch {
    return false;
  }
}
