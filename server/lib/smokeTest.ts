/**
 * A RELEASE SMOKE TEST'S APPLICATION (browser smoke, 19 Nov 2026).
 *
 * scripts/browser-smoke.mjs walks the apply flow in a real browser against a
 * built server or a staging deploy, and finishes it by sending an
 * application. That application must be judged exactly like a real one (so a
 * broken limit or a broken table shows up) and then must never reach anybody:
 * no confirmation email, no row a reviewer can list.
 *
 * It counts as a smoke test only when ALL of these hold:
 *  - the server has SMOKE_TEST_TOKEN set, at least SMOKE_TOKEN_MIN characters;
 *  - the request carries the same token in the SMOKE_HEADER header
 *    (compared in constant time);
 *  - the applicant's address ends in SMOKE_DOMAIN, a reserved domain no
 *    person can receive mail at (RFC 2606 `.invalid`).
 * Unset on the server, the header is ignored and the address is an ordinary
 * one, so a production village without the variable has no test door at all.
 */
import crypto from "node:crypto";

export const SMOKE_HEADER = "x-village-smoke-test";
export const SMOKE_DOMAIN = "@smoke.example.invalid";
export const SMOKE_TOKEN_MIN = 16;

export function isSmokeSubmission(header: unknown, email: unknown, token: string | undefined = process.env.SMOKE_TEST_TOKEN): boolean {
  const want = String(token ?? "");
  if (want.length < SMOKE_TOKEN_MIN) return false;
  if (typeof header !== "string" || typeof email !== "string") return false;
  if (!email.trim().toLowerCase().endsWith(SMOKE_DOMAIN)) return false;
  const a = crypto.createHash("sha256").update(header).digest();
  const b = crypto.createHash("sha256").update(want).digest();
  return crypto.timingSafeEqual(a, b);
}
