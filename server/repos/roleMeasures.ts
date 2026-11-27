/**
 * The stamped facts the role-journey measures are computed from (L11).
 *
 * Reads the application stamps (`application_steps`, the review lane), the
 * onboarding path (`onboarding_paths`, `onboarding_items`) and the moon
 * renewals (`role_moon_renewals`). TOLERANT: a table that does not exist yet
 * (a lane not landed in this release) reads as no facts, never as an error.
 *
 * Returns season, circle and instants only. No user id, application ref, name
 * or email leaves this file: refs and ids are used inside the queries to join
 * and are dropped from what is returned. Instants are read with
 * UNIX_TIMESTAMP so the host's offset cannot shift them.
 */
import type { Pool, RowDataPacket } from "mysql2/promise";
import type { ApplicationFact, CircleLeadSeat, HolderFact, Outcome, StartFact } from "../../shared/roleMeasures";
import { counterOfferOf } from "../../shared/counterOffer";

async function rows(pool: Pool, sql: string, params: unknown[] = []): Promise<RowDataPacket[]> {
  try {
    const [r] = await pool.query<RowDataPacket[]>(sql, params);
    return r;
  } catch (e: any) {
    if (e?.errno === 1146 || e?.code === "ER_NO_SUCH_TABLE" || e?.errno === 1054 || e?.code === "ER_BAD_FIELD_ERROR") return [];
    throw e;
  }
}

const ms = (v: unknown): number | null => (v === null || v === undefined ? null : Math.round(Number(v) * 1000));

function firstRoleOf(raw: unknown, key: "seat_ids" | "roles"): string | null {
  let v: unknown = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (key === "roles" && v && typeof v === "object") v = (v as any).roles;
  if (!Array.isArray(v) || v.length === 0) return null;
  const f = v[0];
  const id = typeof f === "string" ? f : f?.roleId;
  return typeof id === "string" && id ? id : null;
}

const json = (raw: unknown): any => {
  if (typeof raw !== "string") return raw ?? null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/** How the decided step says an application ended. A quiet withdrawal is the 90-day close. */
function outcomeOf(detail: any): Outcome {
  const how = detail?.how;
  if (how === "adopted") return "adopted";
  if (how === "withdrawn") return detail?.quiet === true ? "closed" : "withdrawn";
  return "declined";
}

/** Where each application sat (its season and first role), keyed by its ref, with a member application's adoption. */
async function placesOf(pool: Pool) {
  const place = new Map<string, { seasonId: string | null; roleId: string | null; countered: boolean }>();
  const adopted = new Map<string, number>();
  for (const a of await rows(pool, "SELECT id, term_season_id AS season, seat_ids AS ids, status, UNIX_TIMESTAMP(decided_at) AS decided FROM seat_applications")) {
    place.set(String(a.id), { seasonId: a.season ? String(a.season) : null, roleId: firstRoleOf(a.ids, "seat_ids"), countered: false });
    const at = ms(a.decided);
    if (String(a.status) === "adopted" && at !== null) adopted.set(String(a.id), at);
  }
  for (const a of await rows(pool, "SELECT id, target_season_id AS season, body_json AS body FROM open_role_proposals")) {
    const body = json(a.body);
    const co = counterOfferOf(body?.counterOffer);
    place.set(String(a.id), { seasonId: a.season ? String(a.season) : null, roleId: firstRoleOf(a.body, "roles"), countered: !!co && co.revisions.length > 0 });
  }
  const circles = new Map<string, string | null>();
  for (const r of await rows(pool, "SELECT id, circle_id FROM org_roles")) circles.set(String(r.id), r.circle_id ? String(r.circle_id) : null);
  const circleOf = (roleId: string | null) => (roleId ? (circles.get(roleId) ?? null) : null);
  return { place, adopted, circleOf };
}

export async function applicationFacts(pool: Pool): Promise<ApplicationFact[]> {
  const steps = await rows(
    pool,
    "SELECT application_ref AS ref, kind, UNIX_TIMESTAMP(MIN(stamped_at)) AS t FROM application_steps " +
      "WHERE kind IN ('confirmed','first_reply','interview','decided','shortlist','refs_asked') GROUP BY application_ref, kind",
  );
  if (steps.length === 0) return [];
  const byRef = new Map<string, Record<string, number | null>>();
  for (const s of steps) {
    const m = byRef.get(String(s.ref)) ?? {};
    m[String(s.kind)] = ms(s.t);
    byRef.set(String(s.ref), m);
  }
  // The answers the decided and shortlist steps carry: how it ended, and the shortlist's yes or no.
  const details = new Map<string, { decided?: any; shortlist?: any }>();
  for (const d of await rows(pool, "SELECT application_ref AS ref, kind, detail_json AS detail FROM application_steps WHERE kind IN ('decided','shortlist')")) {
    const m = details.get(String(d.ref)) ?? {};
    m[String(d.kind) as "decided" | "shortlist"] = json(d.detail);
    details.set(String(d.ref), m);
  }
  const talks = new Map<string, ApplicationFact["interviews"][number][]>();
  for (const i of await rows(
    pool,
    "SELECT application_ref AS ref, is_final, state, UNIX_TIMESTAMP(opened_at) AS o, UNIX_TIMESTAMP(booked_at) AS b, UNIX_TIMESTAMP(scored_at) AS s " +
      "FROM application_interviews ORDER BY application_ref, position",
  )) {
    const list = talks.get(String(i.ref)) ?? [];
    list.push({ final: Number(i.is_final) === 1, openedAt: ms(i.o), bookedAt: ms(i.b), scoredAt: ms(i.s), skipped: String(i.state) === "skipped" });
    talks.set(String(i.ref), list);
  }
  const followed = new Map<string, number | null>();
  for (const r of await rows(
    pool,
    "SELECT application_ref AS ref, COUNT(*) AS n, SUM(followed_up_at IS NULL) AS open_n, UNIX_TIMESTAMP(MAX(followed_up_at)) AS last FROM application_references GROUP BY application_ref",
  )) {
    followed.set(String(r.ref), Number(r.n) > 0 && Number(r.open_n) === 0 ? ms(r.last) : null);
  }
  const { place, circleOf } = await placesOf(pool);

  const out: ApplicationFact[] = [];
  for (const [ref, t] of Array.from(byRef.entries())) {
    if (t.confirmed == null) continue;
    const p = place.get(ref);
    const d = details.get(ref);
    out.push({
      seasonId: p?.seasonId ?? null,
      circleId: circleOf(p?.roleId ?? null),
      door: ref.startsWith("op-") ? "open" : "member",
      confirmedAt: t.confirmed,
      firstReplyAt: t.first_reply ?? null,
      firstInterviewAt: t.interview ?? null,
      decidedAt: t.decided ?? null,
      outcome: t.decided == null ? null : outcomeOf(d?.decided),
      shortlistYesAt: d?.shortlist?.answer === "yes" ? (t.shortlist ?? null) : null,
      refsAskedAt: t.refs_asked ?? null,
      refsAllFollowedUpAt: followed.get(ref) ?? null,
      interviews: talks.get(ref) ?? [],
      countered: p?.countered ?? false,
    });
  }
  return out;
}

/**
 * Adoption to start: every adopted member application (the door a proposal from
 * outside is seated through too) and the first seating that holds its terms
 * (`org_role_assignments.application_id`). No person leaves this function.
 */
export async function startFacts(pool: Pool): Promise<StartFact[]> {
  const firsts = await rows(
    pool,
    "SELECT application_id AS aid, UNIX_TIMESTAMP(MIN(started_at)) AS started FROM org_role_assignments " +
      "WHERE application_id IS NOT NULL AND is_example = 0 GROUP BY application_id",
  );
  if (firsts.length === 0) return [];
  const { place, adopted, circleOf } = await placesOf(pool);
  const out: StartFact[] = [];
  for (const f of firsts) {
    const id = String(f.aid);
    const adoptedAt = adopted.get(id);
    const startedAt = ms(f.started);
    if (adoptedAt === undefined || startedAt === null) continue;
    const p = place.get(id);
    out.push({ seasonId: p?.seasonId ?? null, circleId: circleOf(p?.roleId ?? null), adoptedAt, startedAt });
  }
  return out;
}

export async function holderFacts(pool: Pool): Promise<HolderFact[]> {
  const seatings = await rows(
    pool,
    "SELECT a.id, a.season_id AS season, r.circle_id AS circle, UNIX_TIMESTAMP(a.started_at) AS started, UNIX_TIMESTAMP(a.ended_at) AS ended " +
      "FROM org_role_assignments a JOIN org_roles r ON r.id = a.org_role_id " +
      "WHERE a.holder_kind = 'member' AND a.is_example = 0",
  );
  if (seatings.length === 0) return [];
  const paths = new Map<string, { opened: number | null; done: number | null }>();
  for (const p of await rows(
    pool,
    "SELECT p.assignment_id AS aid, UNIX_TIMESTAMP(p.opened_on) AS opened, COUNT(i.id) AS items, SUM(i.done_at IS NULL) AS open_items, " +
      "UNIX_TIMESTAMP(MAX(i.done_at)) AS last_done " +
      "FROM onboarding_paths p LEFT JOIN onboarding_items i ON i.path_id = p.id GROUP BY p.id, p.assignment_id, p.opened_on",
  )) {
    const complete = Number(p.items) > 0 && Number(p.open_items) === 0;
    paths.set(String(p.aid), { opened: ms(p.opened), done: complete ? ms(p.last_done) : null });
  }
  const renewals = new Map<string, { due: number; renewed: number }>();
  for (const x of await rows(
    pool,
    "SELECT assignment_id AS aid, COUNT(*) AS due, SUM(status = 'renewed') AS renewed FROM role_moon_renewals " +
      "WHERE for_term_ends_at <= NOW() GROUP BY assignment_id",
  )) {
    renewals.set(String(x.aid), { due: Number(x.due), renewed: Number(x.renewed ?? 0) });
  }
  return seatings.map((s) => {
    const path = paths.get(String(s.id));
    const ren = renewals.get(String(s.id));
    return {
      seasonId: s.season ? String(s.season) : null,
      circleId: s.circle ? String(s.circle) : null,
      startedAt: ms(s.started) ?? 0,
      endedAt: ms(s.ended),
      pathOpenedAt: path?.opened ?? null,
      pathDoneAt: path?.done ?? null,
      renewalsDue: ren?.due ?? 0,
      renewalsRenewed: ren?.renewed ?? 0,
    };
  });
}

/**
 * Each circle's lead seat (`circles.lead_role_id`) with the seat's own active
 * and example flags, for deciding which circles a lead reads (`circlesLed`
 * refuses a rested or example seat). Example circles never count.
 */
export async function circleLeadSeats(pool: Pool): Promise<CircleLeadSeat[]> {
  return (
    await rows(
      pool,
      "SELECT c.id, c.lead_role_id, r.active AS lead_active, r.is_example AS lead_is_example " +
        "FROM circles c JOIN org_roles r ON r.id = c.lead_role_id WHERE c.is_example = 0",
    )
  ).map((r) => ({
    id: String(r.id),
    leadRoleId: r.lead_role_id == null ? null : String(r.lead_role_id),
    leadActive: Number(r.lead_active) === 1,
    leadIsExample: Number(r.lead_is_example) === 1,
  }));
}

/** Circle names by id, for the page. A circle is not a person. */
export async function circleNames(pool: Pool): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const r of await rows(pool, "SELECT id, name FROM circles")) out.set(String(r.id), String(r.name));
  return out;
}
