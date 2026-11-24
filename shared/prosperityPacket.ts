/**
 * THE PROSPERITY PACKET REQUEST (a reviewer's feedback, approved by the lead on
 * 24 Nov 2026).
 *
 * The /prosperity page asked a would-be business to "Request Prosperity
 * Packet" through a mailto: link, which opens nothing on a phone with no mail
 * app set up. It is now a short form on the page: a name, an email, what they
 * want to build and an optional note. It posts to the public forms door
 * (`POST /api/forms/submit`, type `prosperity-packet`) with that door's
 * honeypot and per-IP limit, lands in the admin's form submissions under its
 * own type, and reaches the inbox a partner proposal reaches: the holders of
 * the role named in `org.partnerships_role`, else the business inbox.
 *
 * The same check runs in the browser, to say what to fix, and on the server,
 * which refuses a request that fails it and stores nothing.
 */

/** The submissions pipeline's type for a packet request. */
export const PROSPERITY_PACKET_FORM = "prosperity-packet";

export interface PacketRequest {
  name: string;
  email: string;
  /** What they want to build. */
  build: string;
  /** Anything else, optional. */
  note: string;
}

export const PACKET_LIMITS = { name: 120, email: 254, build: 2000, note: 2000 } as const;

export type PacketProblem = "name" | "email" | "build" | "note";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Every thing missing or wrong, in the form's order; [] when it can be sent. */
export function packetProblems(p: PacketRequest): PacketProblem[] {
  const out: PacketProblem[] = [];
  if (!p.name.trim() || p.name.length > PACKET_LIMITS.name) out.push("name");
  if (!EMAIL.test(p.email.trim()) || p.email.length > PACKET_LIMITS.email) out.push("email");
  if (!p.build.trim() || p.build.length > PACKET_LIMITS.build) out.push("build");
  if (p.note.length > PACKET_LIMITS.note) out.push("note");
  return out;
}

/**
 * Read a request off an untrusted body: anything that is not a string reads
 * as empty, so a wrong shape fails the check instead of slipping past it.
 */
export function packetFrom(data: unknown): PacketRequest {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return { name: str(d.name), email: str(d.email), build: str(d.build), note: str(d.note) };
}
