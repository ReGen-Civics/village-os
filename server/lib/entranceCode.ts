/**
 * THE ENTRANCE'S CODE: making one, keeping only its hash, the letter that carries it, and whether an
 * address's domain receives mail at all (the lead, 24 Nov 2026: "a short look, then the code").
 *
 * The code is 6 digits from `crypto.randomInt`, sent once by the one mail door as an essential
 * email, and stored only as an HMAC under the server's secret, bound to the entry it confirms, so a
 * read of the table cannot replay a code and a code for one entry never fits another.
 */
import crypto from "node:crypto";
import { promises as dns } from "node:dns";
import { CODE_LENGTH } from "../../shared/entrance";

export function makeCode(): string {
  return String(crypto.randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

function keyOf(secret: string): Buffer {
  return crypto.createHmac("sha256", secret).update("village-os/portal-code/v1").digest();
}

export function hashCode(secret: string, entryId: string, code: string): string {
  return crypto.createHmac("sha256", keyOf(secret)).update(`${entryId}.${code}`).digest("hex");
}

/** Whether a typed code matches a stored hash, in constant time. */
export function codeMatches(secret: string, entryId: string, code: string, storedHash: string): boolean {
  const a = Buffer.from(hashCode(secret, entryId, code), "hex");
  const b = Buffer.from(String(storedHash), "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export interface MailLookup {
  resolveMx(domain: string): Promise<unknown[]>;
  resolve4(domain: string): Promise<unknown[]>;
}

const NO_SUCH = new Set(["ENOTFOUND", "ENODATA", "NXDOMAIN"]);

/**
 * Whether a domain can receive mail: it publishes an MX record, or, as mail itself falls back to,
 * an address record. Answers "no" only when DNS says the name does not exist or has neither; a
 * slow or failing resolver answers "unknown", which lets the visitor through, since the code is the
 * real check and a DNS hiccup must never turn a person away.
 */
export async function domainTakesMail(domain: string, lookup: MailLookup = dns, timeoutMs = 3000): Promise<"yes" | "no" | "unknown"> {
  if (!domain || !domain.includes(".")) return "no";
  const timed = <T>(p: Promise<T>) =>
    Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "ETIMEOUT" })), timeoutMs))]);
  const ask = async (f: () => Promise<unknown[]>): Promise<"yes" | "no" | "unknown"> => {
    try {
      return (await timed(f())).length > 0 ? "yes" : "no";
    } catch (e) {
      return NO_SUCH.has(String((e as { code?: unknown })?.code ?? "")) ? "no" : "unknown";
    }
  };
  const mx = await ask(() => lookup.resolveMx(domain));
  if (mx !== "no") return mx;
  const a = await ask(() => lookup.resolve4(domain));
  return a === "yes" ? "yes" : a === "unknown" ? "unknown" : "no";
}

export interface CodeLetterDeps {
  sendEmail(opts: { to: string[]; subject: string; html: string; text?: string; origin?: string }): Promise<{ sent: boolean; reason?: string }>;
  escapeHtml(s: string): string;
  projectName(): string;
}

/** The letter. Never throws; answers whether the provider took it. */
export async function sendCodeLetter(deps: CodeLetterDeps, to: string, code: string, signIn: boolean): Promise<{ sent: boolean; reason?: string }> {
  const village = deps.escapeHtml(deps.projectName());
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  const lead = signIn
    ? `Here is your code to sign in to ${village}.`
    : `Here is your code to keep exploring ${village}.`;
  try {
    return await deps.sendEmail({
      to: [to],
      origin: "entrance.code",
      subject: `${spaced} is your code for ${deps.projectName()}`,
      html: `<p>${lead}</p>
<p style="font-size:28px;letter-spacing:6px;font-weight:bold">${spaced}</p>
<p>Type it on the page that asked for it. It works for 15 minutes, once.</p>
<p>If you did not ask for this, you can ignore this message. Nothing happens without the code.</p>`,
      text: `${lead}\n\n${spaced}\n\nType it on the page that asked for it. It works for 15 minutes, once.\n\nIf you did not ask for this, you can ignore this message. Nothing happens without the code.\n`,
    });
  } catch {
    return { sent: false, reason: "failed" };
  }
}
