/**
 * EVERY ANONYMISING PATH TAKES EVERY PERSONAL FIELD (security sweep, 14 Nov
 * 2026). `$.selfKnowledge` and `$.payAsk` were missed by all three lists and
 * `$.pieceSuggestions` by the expiry, because each list was typed by hand.
 *
 * `FULL` names every field of `OpenProposalBody`, made required, so a new
 * field fails to compile here until somebody fills it in; the first case then
 * fails until it is named in `ANONYMISE_REMOVES` or `ANONYMISE_KEEPS`. The
 * second runs all three anonymisers on a real schema and reads the raw body
 * back: only what `ANONYMISE_KEEPS` names is left.
 */
import type mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { OpenProposalBody } from "../../shared/openProposals";
import { provisionTestDb, testDbConfigured, type TestDb, testPool } from "../db/testDb";
import { ANONYMISE_KEEPS, ANONYMISE_REMOVES, anonymiseDecidedBefore, anonymiseOpenProposal, expireUndecidedBefore, insertOpenProposal } from "./openProposals";

/** One of every field, by name. The values only need to be there. */
const FULL: { [K in keyof Required<OpenProposalBody>]: unknown } = {
  roles: [
    { roleId: "r-1", note: "I keep wells.", commitmentPct: 60, payAsk: { kind: "amount", monthly: 4321 } },
    { roleId: "r-2", note: "", commitmentPct: 40, payAsk: { kind: "amount", monthly: 7777 }, paySplit: { commitmentPct: 40, offered: { total: 7777, shares: [{ label: "Cash", pct: 60, amount: 4666 }] }, proposed: { total: 7777, shares: [{ label: "Cash", pct: 100, amount: 7777 }] } } },
  ],
  why: "Why me.",
  aim: "The aim.",
  term: { startsOn: "2099-01-01", endsOn: "2099-03-20" },
  card: { roles: [], serves: [], hours: "10", agreed: { loveLetter: true, nda: true }, timeZone: "Europe/Lisbon", windows: [{ day: "mon", from: "09:00", to: "12:00" }], earliestStart: "2099-01-02", terms: { choice: "accept", note: "" } },
  membership: { letterVersion: "v1" },
  links: [{ url: "https://example.test/me", label: "Me" }],
  files: [{ id: "pf-0123456789abcdef", kind: "pdf", name: "cv.pdf", size: 10 }],
  references: [{ name: "Ref Person", contact: "ref@example.test", how: "neighbour" }],
  backgroundCheck: { consent: true },
  about: { based: "Up the road", languages: "English", story: "My story." },
  locale: "en",
  note: "A private note.",
  counterOffer: { revisions: [] },
  agent: null,
  knowUs: ["Visit the land"],
  rampUp: true,
  selfKnowledge: "Generator 2/4",
  pieceSuggestions: [{ roleId: "r-1", piece: "purpose", kind: "change", text: "Ring the bell twice" }],
  voice: { consent: true, notes: [], transcript: "What I said aloud." },
  payAsk: { amount: 900, period: "month" },
  paySplit: { commitmentPct: 60, offered: { total: 7217, shares: [{ label: "Cash", pct: 60, amount: 4330 }] }, proposed: { total: 7217, shares: [{ label: "Cash", pct: 100, amount: 7217 }] } },
};

const PERSONAL_WORDS = ["Europe/Lisbon", "09:00", "2099-01-02", "example.test", "cv.pdf", "Ref Person", "Up the road", "A private note", "Generator 2/4", "Ring the bell", "What I said aloud", "900", "4321", "7777", "4666"];

describe("anonymising an open proposal", () => {
  it("names every field of the body as removed or kept, and none as both", () => {
    const removedTop = new Set(ANONYMISE_REMOVES.filter((p) => !p.startsWith("$.card.") && !p.startsWith("$.roles[")).map((p) => p.slice(2)));
    const kept = new Set<string>(ANONYMISE_KEEPS);
    for (const key of Object.keys(FULL)) {
      expect(removedTop.has(key) !== kept.has(key), `${key}: name it in exactly one of ANONYMISE_REMOVES or ANONYMISE_KEEPS (server/repos/openProposals.ts)`).toBe(true);
    }
    expect([...removedTop, ...kept].sort()).toEqual(Object.keys(FULL).sort());
  });
});

const configured = testDbConfigured();
if (!configured) console.warn("[openProposals.anonymise] TEST_DATABASE_URL not set - DB cases SKIPPED. A skip is not a pass.");

describe.skipIf(!configured)("every anonymising path, on a real schema", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  const q = (sql: string, args: unknown[] = []) => pool.query<any[]>(sql, args).then(([rows]) => rows); // module-review-ok: fixture SQL on the scratch schema this suite provisioned

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 2 });
  });
  afterAll(async () => {
    await pool?.end();
    await db?.drop();
  });

  const old = new Date("2026-01-01T00:00:00Z");
  const now = new Date("2026-11-14T00:00:00Z");
  const put = async (id: string, status: string) => {
    await insertOpenProposal(pool, { id, name: "Rowan Field", email: "rowan@example.test", emailKey: "rowan@example.test", targetSeasonId: null, body: FULL as OpenProposalBody, confirmHash: `h-${id}`, linkId: null, now: old });
    await q("UPDATE open_role_proposals SET status = ?, confirmed_at = ?, decided_at = ? WHERE id = ?", [status, old, status === "confirmed" ? null : old, id]);
  };
  const left = async (id: string) => {
    const [row] = await q("SELECT name, email, email_key, body_json FROM open_role_proposals WHERE id = ?", [id]);
    return { row, body: typeof row.body_json === "string" ? JSON.parse(row.body_json) : row.body_json };
  };

  it("one proposal, the decided ones and the expired ones all leave only what ANONYMISE_KEEPS names", async () => {
    await put("op-anon-one", "adopted");
    await put("op-anon-declined", "declined");
    await put("op-anon-expired", "confirmed");
    expect(await anonymiseOpenProposal(pool, "op-anon-one", now)).toBe(true);
    expect(await anonymiseDecidedBefore(pool, now, now)).toBe(1);
    expect(await expireUndecidedBefore(pool, now, now)).toBe(1);
    for (const id of ["op-anon-one", "op-anon-declined", "op-anon-expired"]) {
      const { row, body } = await left(id);
      expect(row, id).toMatchObject({ name: null, email: null, email_key: null });
      expect(Object.keys(body).every((k) => (ANONYMISE_KEEPS as readonly string[]).includes(k)), `${id} kept ${Object.keys(body).join(", ")}`).toBe(true);
      expect(Object.keys(body.card).sort(), id).toEqual(["agreed", "hours", "roles", "serves", "terms"]);
      const text = JSON.stringify(body);
      for (const w of PERSONAL_WORDS) expect(text, `${id} still holds ${w}`).not.toContain(w);
      // CONTROL: the application's own substance stays.
      expect(body.why, id).toBe("Why me.");
      // Each role's commitment stays with the roles; its price ask and split go (the lead, 17 Nov 2026).
      expect(body.roles.map((r: { commitmentPct?: number }) => r.commitmentPct), id).toEqual([60, 40]);
    }
  });
});
