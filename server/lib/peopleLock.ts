/**
 * WHAT A SIGNED-OUT VISITOR MAY READ ABOUT THE VILLAGE'S PEOPLE
 * (readiness findings R097 and R098).
 *
 * ── THE TIERS ───────────────────────────────────────────────────────────────
 *
 *   member   anyone signed in. Every route answers as it always has.
 *   public   a stranger while `org.public_people` is on, the platform default:
 *            a first name and a handle (the public address of a profile) at
 *            most. Never a full display name, never an internal user id,
 *            never an email. A member who turned off "Show my first name
 *            to visitors" is "A member" here, with no handle (see
 *            `peopleLockMiddleware` and `VISITOR_NEUTRAL_NAME`).
 *   none     a stranger while the village keeps its people for members (the
 *            secret-society lock, `org.public_people` off): no name, no
 *            handle, no id, no portrait, anywhere.
 *
 * ── WHY THE LOCK IS ENFORCED ON THE WAY OUT ────────────────────────────────
 *
 * R097 found the lock honoured by three routes while every other anonymous
 * route went on naming members, and the reason was structural: a lock read
 * per route is a lock every new route forgets. Worse, many names are not
 * fields at all. The pulse stores "<first name> joined the <role>" as text,
 * a seat vote freezes "the village asks <first name> to sit in it" into its
 * title and document, a mechanics proposal freezes its proposer into its
 * document. No projection of a field reaches a name already written into a
 * sentence.
 *
 * So `peopleLockMiddleware` sits in front of every route. When the lock is on
 * and the caller is not signed in, it reads the village's people once (every
 * non-example account and every documented holder, cached for a few seconds)
 * and rewrites every string body leaving by `res.send`, which `res.json` goes
 * through: a full name, first name or last name becomes "a member", a handle,
 * a user id and an email become empty. JSON stays JSON, because every token it
 * replaces sits inside a string and no replacement carries a quote.
 *
 * WHAT IT CANNOT SEE, said here so nobody leans on it for more:
 *   - a name the roster no longer holds. An erased member's old first name in
 *     an old pulse line is R099's, and the erasure rewrites those lines.
 *   - a nickname or misspelling a member typed into free text.
 *   - a body that is not a string: files, streams and buffers pass untouched.
 *     No route sends a person as a buffer today.
 *   - a GET from a signed-in caller. The lock is about strangers.
 * And names are matched case-sensitively on word edges, so a member called
 * Hope turns a sentence-initial "Hope" in copy into "A member" for a stranger
 * under the lock. That is the side the lock errs on, deliberately.
 *
 * ── WHY BALLOTS ALSO HAVE A PROJECTION ─────────────────────────────────────
 *
 * R098 is not about names alone. `serveBallot` hands out every voter's
 * choice, weight and cast time, the electors who have not voted, and who
 * objected, and that is voter-level data at EITHER setting of the lock.
 * Ruling 22 (docs/GOVERNANCE.md) is staged, so a member still reads the named
 * roll exactly as today. A stranger reads what docs/GOVERNANCE_EVOLUTION_PROMPT.md
 * 21.8 allows a stranger: counts, tallies, dials, status and dates. The
 * projection keeps every key the decision page reads, emptied rather than
 * deleted, and says `viewerTier: "stranger"` so the page can say why the
 * roll is empty instead of reporting that nobody voted.
 */
import type { NextFunction, Request, Response } from "express";
import type { Pool } from "mysql2/promise";
import { rosterRows } from "../repos/peopleRoster";
import { membersHidingFirstName } from "./profile";

export type PeopleTier = "member" | "public" | "none";

/** Which tier a caller reads. Pure, so every route asks the same question. */
export function peopleTier(signedIn: boolean, peopleArePublic: boolean): PeopleTier {
  return signedIn ? "member" : peopleArePublic ? "public" : "none";
}

/**
 * A first name the way every surface writes one: the first word of the name.
 * The tombstone's words stay whole, because "A" is not anybody's first name.
 */
export function firstNameOf(name: unknown): string {
  const full = String(name ?? "").trim();
  if (full === DEPARTED_NAME) return full;
  return full.split(/\s+/)[0] ?? "";
}

// ── A member who keeps their first name from visitors ──────────────────────

/**
 * What a visitor reads where a member who turned off "Show my first name to visitors" would be named
 * (`showFirstNameToVisitors`, server/lib/profile.ts). The same words the lock writes, so a page reads one
 * neutral phrase whichever rule took the name out. Server copy is English today: the catalog covers the
 * client's chrome only (docs/I18N_STRATEGY.md section 1).
 */
export const VISITOR_NEUTRAL_NAME = "A member";

// ── The roster the lock scrubs ─────────────────────────────────────────────

export interface RosterPerson {
  id: string | null;
  name: string;
  handle: string | null;
  email: string | null;
}

/**
 * Words a person's name can collide with that the product prints as copy on
 * nearly every page. A member called "Member" is not a secret the lock can
 * keep by rewriting the word everywhere it appears.
 */
const NEVER_A_NAME = new Set(["a", "member", "members", "founder", "admin", "guest", "visitor", "steward", "someone", "departed"]);

/** The tombstone's own words and address (server/lib/erasure.ts), which name nobody. */
const DEPARTED_NAME = "A departed member";
const DEPARTED_ADDRESS = /@anonymized\.invalid$/i;

/** Every person the village has on its record, as the lock sees them. */
export async function readRoster(pool: Pool): Promise<RosterPerson[]> {
  // A tombstone names nobody, and its words are copy the lock must not chase.
  return (await rosterRows(pool)).filter(
    (r) => r.name !== DEPARTED_NAME && !(r.email && DEPARTED_ADDRESS.test(r.email)),
  );
}

export interface CompiledRoster {
  /** Names and their parts, matched case-sensitively on word edges. */
  names: RegExp | null;
  /** Ids, and handles with a hyphen, digit or dot in them, matched whole and exactly. */
  tokens: RegExp | null;
  /** Emails, matched whole and in any case. */
  emails: RegExp | null;
  /**
   * Handles that are a plain word ("rye"), matched only where a handle sits:
   * a whole quoted value, a path segment, or after an @. Anywhere else the
   * same letters are an ordinary word in a sentence.
   */
  plainHandles: RegExp | null;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Longest first, so a full name is replaced before its parts. */
const alternation = (words: Iterable<string>) =>
  Array.from(new Set(words)).sort((a, b) => b.length - a.length).map(escapeRe).join("|");

export function compileRoster(people: RosterPerson[]): CompiledRoster {
  const names = new Set<string>();
  const tokens = new Set<string>();
  const emails = new Set<string>();
  const plain = new Set<string>();
  for (const p of people) {
    const full = p.name.trim().replace(/\s+/g, " ");
    // A JSON string escapes a quote or a backslash, so a name holding one could
    // never match the body it sits in. Its parts still can.
    if (full.length >= 2 && !NEVER_A_NAME.has(full.toLowerCase()) && !/["\\]/.test(full)) names.add(full);
    for (const part of full.split(" ")) {
      if (part.length >= 2 && !NEVER_A_NAME.has(part.toLowerCase()) && !/["\\]/.test(part)) names.add(part);
    }
    const usable = (s: string | null): s is string => !!s && s.length >= 2 && !/["\\]/.test(s) && !NEVER_A_NAME.has(s.toLowerCase());
    if (usable(p.id)) tokens.add(p.id);
    if (usable(p.email)) emails.add(p.email);
    if (usable(p.handle)) (/^[a-z]+$/.test(p.handle) ? plain : tokens).add(p.handle);
  }
  return {
    names: names.size ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternation(names)})(?![\\p{L}\\p{N}])`, "gu") : null,
    tokens: tokens.size ? new RegExp(`(?<![A-Za-z0-9_.@-])(?:${alternation(tokens)})(?![A-Za-z0-9_-])`, "g") : null,
    emails: emails.size ? new RegExp(`(?<![A-Za-z0-9_.+-])(?:${alternation(emails)})(?![A-Za-z0-9_.-])`, "gi") : null,
    plainHandles: plain.size ? new RegExp(`(?<=["/@])(?:${alternation(plain)})(?![A-Za-z0-9_-])`, "g") : null,
  };
}

/** A body with every person the roster holds taken out of it. */
export function scrubPeople(text: string, roster: CompiledRoster): string {
  let out = text;
  if (roster.emails) out = out.replace(roster.emails, "");
  if (roster.tokens) out = out.replace(roster.tokens, "");
  if (roster.plainHandles) out = out.replace(roster.plainHandles, "");
  if (roster.names) {
    out = out.replace(roster.names, (_m, offset: number, whole: string) => {
      const before = whole.slice(0, offset).replace(/\s+$/, "");
      const opens = before === "" || /["'.!?:(]$/.test(before);
      return opens ? "A member" : "a member";
    });
  }
  return out;
}

// ── The middleware ─────────────────────────────────────────────────────────

export interface PeopleLockDeps {
  authedUser(req: Request): Promise<unknown>;
  getPool(): Pool;
  boolVar(key: string): boolean;
  /** Tests hand in a clock. */
  now?: () => number;
  /** The members who keep their first name from visitors. Defaults to reading the database. */
  hidingFirstName?: () => Promise<Set<string>>;
}

/**
 * A member who changes "Show my first name to visitors" is honoured on the next request, not after the roster
 * cache runs out: the privacy route calls this after it writes, and every middleware drops what it holds.
 */
let rosterGeneration = 0;
export function forgetCachedRosters(): void {
  rosterGeneration += 1;
}

/** How long one read of the roster serves. A new member is hidden within this. */
export const ROSTER_TTL_MS = 5_000;

/**
 * Paths the lock never reads the roster for, matched exactly.
 *
 * The middleware is an `app.use` with no path, registered before `/health`,
 * `/api/platform/info` and every static asset. With the lock on, a roster read
 * that failed (a cold pool, a database blip) answered the liveness probe 503,
 * and Railway replaces a container whose probe fails: a privacy rule could
 * take a healthy village down. None of these carries a member. `/health` and
 * the platform handshake name the village and its build. A built asset is a
 * file, sent by express.static rather than res.send, so the lock never scrubbed
 * it anyway. Reading the roster for them protected nobody and risked
 * everything.
 */
const NEVER_LOCKED = new Set(["/health", "/api/platform/info"]);
/** Vite's hashed build output: code, styles and fonts, never a person. */
const NEVER_LOCKED_UNDER = "/assets/";

export function lockExempt(path: string): boolean {
  if (NEVER_LOCKED.has(path)) return true;
  return path.startsWith(NEVER_LOCKED_UNDER) && !path.includes("..");
}

const isEmptyRoster = (r: CompiledRoster) => !r.names && !r.tokens && !r.emails && !r.plainHandles;

/**
 * THE SECOND RULE THIS MIDDLEWARE CARRIES: A MEMBER'S OWN "SHOW MY FIRST NAME TO VISITORS".
 *
 * While the village's people are public, a stranger reads first names (the lead, 24 Nov 2026), and a member
 * may opt out of that for themselves (`showFirstNameToVisitors`, server/lib/profile.ts). The routes that put a
 * first name in a field say `VISITOR_NEUTRAL_NAME` for such a member already; this is the net under them, for
 * the names frozen into sentences that no field projection reaches. The roster it scrubs is those members only,
 * every part of their name, their handle, id and email, exactly as the lock scrubs everyone.
 *
 * What it costs: nothing while nobody has opted out, since the sign-in question is asked only once the roster
 * holds somebody. What it errs on: another member who shares an opted-out member's first name reads as
 * "a member" to a stranger too, the same side the lock errs on. It fails closed like the lock.
 */
export function peopleLockMiddleware(deps: PeopleLockDeps) {
  const now = deps.now ?? (() => Date.now());
  const hiding = deps.hidingFirstName ?? (() => membersHidingFirstName(deps.getPool()));
  const cache = (read: () => Promise<CompiledRoster>) => {
    let held: { at: number; generation: number; roster: CompiledRoster } | null = null;
    return async (): Promise<CompiledRoster> => {
      if (held && held.generation === rosterGeneration && now() - held.at < ROSTER_TTL_MS) return held.roster;
      const generation = rosterGeneration;
      const roster = await read();
      held = { at: now(), generation, roster };
      return roster;
    };
  };
  const everyone = cache(async () => compileRoster(await readRoster(deps.getPool())));
  const optedOut = cache(async () => {
    const hidden = await hiding();
    if (hidden.size === 0) return compileRoster([]);
    return compileRoster((await readRoster(deps.getPool())).filter((p) => p.id !== null && hidden.has(p.id)));
  });
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (lockExempt(req.path)) return next();
    const locked = !deps.boolVar("org.public_people");
    try {
      let r: CompiledRoster;
      if (locked) {
        if (await deps.authedUser(req)) return next();
        r = await everyone();
      } else {
        try {
          r = await optedOut();
        } catch (e) {
          // A member reads names anyway, so a failed read of who opted out costs a member nothing.
          if (await deps.authedUser(req)) return next();
          throw e;
        }
        if (isEmptyRoster(r)) return next();
        if (await deps.authedUser(req)) return next();
      }
      if (isEmptyRoster(r)) return next();
      const send = res.send.bind(res);
      res.send = ((body?: unknown) => send(typeof body === "string" ? scrubPeople(body, r) : body)) as Response["send"];
      next();
    } catch {
      // A lock that cannot read who to hide fails closed: a stranger is told
      // to come back rather than handed a page that might name somebody.
      res.status(503).json({ error: "unavailable", message: "This page is not available right now. Try again in a moment." });
    }
  };
}

// ── A stranger's ballot (R098) ─────────────────────────────────────────────

/**
 * One decision as a stranger reads it: what was asked, how it is going, and
 * when it closes. Every key the page reads is still present, emptied.
 */
export function strangerBallot<T extends Record<string, any>>(b: T): T {
  return {
    ...b,
    // The subject's ref can hold a member's id (a seat vote's is `<user>@<role>`).
    subjectRef: "",
    // Frozen words the members read: the document, the proposer's purpose line,
    // the closing note. Each can name a person, and none is a count.
    docMarkdown: "",
    purposeAlignment: null,
    outcomeNote: null,
    closedBy: null,
    votes: [],
    silent: [],
    objections: [],
    objectionsFiled: Array.isArray(b.objections) ? b.objections.length : 0,
    myVote: null,
    myWeight: null,
    ...(Array.isArray(b.priorAttempts)
      ? { priorAttempts: b.priorAttempts.map((p: any) => ({ ...p, outcomeNote: null })) }
      : {}),
    viewerTier: "stranger",
  };
}

/** One card on the list, as a stranger reads it. */
export function strangerBallotCard<T extends Record<string, any>>(c: T): T {
  return { ...c, subjectRef: "", outcomeNote: null, myVote: null, myWeight: null, viewerTier: "stranger" };
}

/** The ballot a caller reads: a member's as served, a stranger's projected. */
export function ballotForViewer<T extends Record<string, any>>(viewer: unknown, b: T): T {
  return viewer ? b : strangerBallot(b);
}

export function ballotCardForViewer<T extends Record<string, any>>(viewer: unknown, c: T): T {
  return viewer ? c : strangerBallotCard(c);
}

/**
 * A person reached by handle (a profile, a role card) is not found for a
 * stranger while the lock is on: answering at all would confirm a member of
 * that name exists, and the portrait would show who.
 */
export function hiddenFromStranger(viewer: unknown, peopleArePublic: boolean): boolean {
  return peopleTier(!!viewer, peopleArePublic) === "none";
}
