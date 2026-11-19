/**
 * WHEN A SEND NEEDS THE SAFETY NET (apply safety net, 19 Nov 2026).
 *
 * Applicants met intermittent errors sending an application, with a draft on
 * the device and no way out. A failure that is the applicant's to fix (a
 * refusal naming one of their answers, such as a missing line or a bad
 * address) lands on its field as before. Every other failure offers the way
 * out: the network dropped, the post took too long, the server answered 5xx,
 * a cap or limit refused it, or the refusal named no field. Those can also
 * happen to an application that is perfectly fine.
 *
 * Small and eager on purpose: the page decides here, and only the net itself
 * (SafetyNet.tsx, applyBackup.ts) loads when it is needed.
 */

export type SendFailure =
  | { kind: "network" }
  | { kind: "timeout" }
  | { kind: "status"; status: number; field: string | null };

/** Fields whose refusals are about the upload itself, which a person cannot fix by editing an answer. */
const UPLOAD_FIELDS: readonly string[] = ["files", "voice"];

/** Whether this failure shows the safety net: every failure but a refusal of one answer the applicant can fix. */
export function needsSafetyNet(f: SendFailure): boolean {
  if (f.kind !== "status") return true;
  if (f.status >= 500 || f.status === 408 || f.status === 413 || f.status === 429 || f.status === 403 || f.status === 411) return true;
  if (!f.field) return true;
  return UPLOAD_FIELDS.includes(f.field);
}

/** How long a send may take before the page gives up: a post with files on a slow line takes minutes. */
export function sendTimeoutMs(multipart: boolean): number {
  return multipart ? 6 * 60_000 : 90_000;
}
