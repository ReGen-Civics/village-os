/**
 * THE INVESTOR GATE (the lead, 27 Nov 2026): "hide all the wording on investor for now to just give a
 * form for investors to give their information if they are interested. Let's gate keep this page for
 * now and only those we accept should be able to see it and get the 'investor' tag."
 *
 * The contract the page, the routes and the admin desk share:
 *
 *   - Somebody WITHOUT investor access sees, on the investor page, a short welcome line and the
 *     interest form, and nothing else of the page: no summary, terms, questions, roadmap or packet.
 *     The server refuses the summary and the packet to them too (server/routes/investorAccess.ts).
 *   - The form asks for a name and an email, and every other question is optional (the real estate
 *     norms below). A name and address the village already holds (the entrance, a visitor profile,
 *     an account) come filled in and locked, so the form reads as one more request.
 *   - An answer lands in the team's existing submissions queue as `INVESTOR_INTEREST_FORM`, routed to
 *     the investor inbox like every investor form. Accepting it there grants access; declining grants
 *     nothing. Access sits on an ACCOUNT, or on a visitor's address proven by the entrance's code or
 *     by Google, never on an address somebody only typed.
 */

/** The submission type an investor interest answer is stored under. */
export const INVESTOR_INTEREST_FORM = "investor-interest";

/** The page the gate stands in front of. */
export const INVESTOR_PAGE = "/investor";

/** That page's id among the village's pages (shared/pageContent/journeys.ts, `INVESTOR_JOURNEY`): its words are kept too. */
export const INVESTOR_PAGE_ID = "investor";

/** Who the answer was tied to when it was sent, decided by the server, never by the form. */
export type InvestorIdentity = "account" | "visitor" | "unverified";

export const INVESTOR_TYPES = ["individual", "family-office", "fund", "company", "other"] as const;
export type InvestorType = (typeof INVESTOR_TYPES)[number];

/** Self-reported. The village checks nothing here, and the form says so. */
export const ACCREDITATION = ["accredited", "qualified-purchaser", "not-accredited", "not-sure"] as const;
export type Accreditation = (typeof ACCREDITATION)[number];

/** Typical check size, in US dollars. */
export const CHECK_SIZES = ["under-25k", "25k-100k", "100k-250k", "250k-1m", "1m-5m", "over-5m"] as const;
export type CheckSize = (typeof CHECK_SIZES)[number];

/** Total the investor means to place in this village, in US dollars. */
export const ALLOCATIONS = ["under-100k", "100k-500k", "500k-2m", "over-2m", "not-sure"] as const;
export type Allocation = (typeof ALLOCATIONS)[number];

export const STRUCTURES = ["equity", "debt", "revenue-share", "open"] as const;
export type Structure = (typeof STRUCTURES)[number];

export const HORIZONS = ["under-3y", "3-5y", "5-10y", "over-10y", "not-sure"] as const;
export type Horizon = (typeof HORIZONS)[number];

export const INTERESTS = ["land", "homes", "ventures", "impact", "other"] as const;
export type InvestorInterestArea = (typeof INTERESTS)[number];

export const EXPERIENCE = ["none", "some", "experienced", "professional"] as const;
export type Experience = (typeof EXPERIENCE)[number];

export const ENTITY = ["personal", "entity", "not-sure"] as const;
export type EntityAnswer = (typeof ENTITY)[number];

export const NAME_MAX = 120;
export const EMAIL_MAX = 320;
export const SHORT_MAX = 200;
export const LONG_MAX = 4000;
/** The privacy words shown under the form, kept with the answer (the entrance's pattern). */
export const CONSENT_MAX = 2000;

/** The optional answers, cleaned. Every field may be absent. */
export interface InvestorAnswers {
  investorType?: InvestorType;
  country?: string;
  accreditation?: Accreditation;
  checkSize?: CheckSize;
  allocation?: Allocation;
  structure?: Structure;
  horizon?: Horizon;
  thesis?: string;
  interests?: InvestorInterestArea[];
  experience?: Experience;
  entity?: EntityAnswer;
  heardFrom?: string;
  more?: string;
}

/** What the form sends. Name and email are required; the server overrides both when it already holds them. */
export interface InvestorInterestInput extends InvestorAnswers {
  name: string;
  email: string;
  whatsapp?: string;
  link?: string;
  /** The privacy words the person read under the form, as shown. */
  consent: string;
}

const oneOf = <T extends string>(list: readonly T[], v: unknown): T | undefined =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : undefined;

const text = (v: unknown, max: number): string | undefined => {
  if (typeof v !== "string") return undefined;
  const s = v.replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : undefined;
};

const longText = (v: unknown, max: number): string | undefined => {
  if (typeof v !== "string") return undefined;
  const s = v.replace(/\r\n/g, "\n").trim();
  return s ? s.slice(0, max) : undefined;
};

/** The optional answers from an untrusted body: an unknown choice is dropped, never stored. */
export function cleanAnswers(body: unknown): InvestorAnswers {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const out: InvestorAnswers = {};
  const put = <K extends keyof InvestorAnswers>(k: K, v: InvestorAnswers[K] | undefined) => {
    if (v !== undefined) out[k] = v;
  };
  put("investorType", oneOf(INVESTOR_TYPES, b.investorType));
  put("country", text(b.country, SHORT_MAX));
  put("accreditation", oneOf(ACCREDITATION, b.accreditation));
  put("checkSize", oneOf(CHECK_SIZES, b.checkSize));
  put("allocation", oneOf(ALLOCATIONS, b.allocation));
  put("structure", oneOf(STRUCTURES, b.structure));
  put("horizon", oneOf(HORIZONS, b.horizon));
  put("thesis", longText(b.thesis, LONG_MAX));
  if (Array.isArray(b.interests)) {
    const picked = INTERESTS.filter((i) => (b.interests as unknown[]).includes(i));
    if (picked.length) out.interests = picked;
  }
  put("experience", oneOf(EXPERIENCE, b.experience));
  put("entity", oneOf(ENTITY, b.entity));
  put("heardFrom", text(b.heardFrom, SHORT_MAX));
  put("more", longText(b.more, LONG_MAX));
  return out;
}

/** A plain check of a typed name and address; the server decides the rest. */
export function contactProblem(name: unknown, email: unknown): "name" | "email" | null {
  const n = typeof name === "string" ? name.trim() : "";
  if (!n || n.length > NAME_MAX) return "name";
  const e = typeof email === "string" ? email.trim() : "";
  if (!e || e.length > EMAIL_MAX || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(e)) return "email";
  return null;
}

/** Where a request stands, as the page reads it. */
export interface InvestorAccessState {
  /** Whether this reader sees the whole investor page. */
  access: boolean;
  /** What the village already holds about this reader, for the form. `locked` means the form shows it and does not ask again. */
  prefill: { name: string; email: string; whatsapp: string; link: string; locked: boolean };
  /** The newest interest answer from this reader, if any: when it was sent and where it stands. */
  request: { sentAt: string; status: string } | null;
}
