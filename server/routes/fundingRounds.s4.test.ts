/**
 * FUNDING ROUNDS, THE COUNTED-VOICE GUARDRAILS (S4).
 *
 * Against a real scratch schema and the real ledger. Three things are pinned:
 *
 *  1. WORK-ONLY VOICE. The power count weighs each member by the Voice they
 *     earned through work. One member holds a mountain of Voice from a
 *     donation and one Voice from work; nine hold ten Voice each from work.
 *     Weighed by the whole balance the donor would decide; weighed by work,
 *     the two counts agree with the nine.
 *  2. THE SNAPSHOT. Voice is frozen when choosing opens. Work Voice the donor
 *     earns afterwards does not move the count, and a member who joins the
 *     roll afterwards cannot tick in that round.
 *  3. THE 48-HOUR VOTE. When the two counts disagree, the quests they agree on
 *     are funded at once and the disputed ones are held. A village vote opens
 *     on the ordinary ballot engine, 48 hours long; its closer funds the
 *     deciding count's quests when the vote does not carry and the other
 *     count's when it does, once. With voting off, the deciding count stands
 *     at once and the round says why.
 *
 * Every person here is invented.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type mysql from "mysql2/promise";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "../db/testDb";
import { loadModuleSettings, setModuleLifecycle } from "../lib/modules";
import { loadTokenRegistry } from "../lib/ledger";
import { loadVariables } from "../lib/variables";
import { ensureVoiceToken, mint, VILLAGE_VOICE, VOICE_MINT } from "../lib/economy";
import { ballotById } from "../lib/ballots";
import { fundingDivergenceCloser } from "../lib/fundingRounds";
import { register } from "./fundingRounds";

type Handler = (req: any, res: any) => Promise<unknown> | unknown;

function collect() {
  const handlers = new Map<string, Handler>();
  const record = (method: string) => (p: string, handler: Handler) => handlers.set(`${method} ${p}`, handler);
  return {
    app: { get: record("GET"), post: record("POST"), put: record("PUT"), patch: record("PATCH"), delete: record("DELETE"), use: () => undefined } as any,
    handlers,
  };
}

const DAY = 86_400_000;
const at = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY);

const configured = testDbConfigured();
if (!configured) {
  // eslint-disable-next-line no-console
  console.warn("[fundingRounds.s4] TEST_DATABASE_URL not set. This suite SKIPPED.");
}

describe.skipIf(!configured)("funding rounds S4: work-only Voice, the frozen snapshot and the divergence vote", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  let whoami: string | null = null;
  const as = (id: string | null) => { whoami = id; };
  const q = async (sql: string, params: unknown[] = []) => (await pool.query<any[]>(sql, params))[0]; // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
  const people = Array.from({ length: 10 }, (_v, i) => ({ id: `s4-${i}`, name: `Member${i} Reed` }));
  const roll = new Set(people.map((p) => p.id));
  const quests: any[] = [];
  const told: Array<{ ballotId: string; roll: string[] }> = [];
  let governance = true;
  let handlers: Map<string, Handler>;
  let potId = "";

  const call = async (key: string, req: any = {}) => {
    const handler = handlers.get(key);
    if (!handler) throw new Error(`no handler registered for ${key}`);
    const out: { status: number; body: any } = { status: 200, body: undefined };
    const res: any = {
      status(code: number) { out.status = code; return res; },
      json(body: unknown) { out.body = body; return res; },
    };
    await handler({ params: {}, body: {}, query: {}, ...req }, res);
    return out;
  };

  let mints = 0;
  const minted = async (id: string, minor: number, source: string) => {
    const r = await mint(pool, {
      toUserId: id, tokenSlug: VILLAGE_VOICE, amount: minor, from: VOICE_MINT, source, sourceRef: id,
      description: "seeded for the S4 suite", idempotencyKey: `s4:${id}:${source}:${++mints}`,
    });
    expect(r.ok, `minting ${source} to ${id}`).toBe(true);
  };

  /** Open a round with grown ideas, ready to be put into choose. */
  const newRound = async (title: string, ideas: Array<{ title: string; ask: number }>, offered?: number) => {
    as("s4-0");
    const round = await call("POST /api/funding-rounds/pots/:id/rounds", {
      params: { id: potId },
      body: { title, seedAt: at(-1).toISOString(), ...(offered != null ? { offeredMinor: offered } : {}) },
    });
    expect(round.status).toBe(201);
    const roundId = round.body.round.id as string;
    const ids: string[] = [];
    for (const [n, idea] of ideas.entries()) {
      as(people[n % people.length].id);
      const out = await call("POST /api/funding-rounds/rounds/:id/ideas", { params: { id: roundId }, body: { title: idea.title, what: `${idea.title}, for everyone` } });
      await q("UPDATE funding_round_ideas SET deliverable = ?, ask_minor = ?, status = 'grown' WHERE id = ?", [`${idea.title}, done`, idea.ask, out.body.idea.id]);
      ids.push(out.body.idea.id);
    }
    return { roundId, ids };
  };
  const putIn = async (roundId: string, stage: "choose" | "harvest") => {
    const d = stage === "choose" ? [-3, -2, -1, 1] : [-4, -3, -2, -0.01];
    await q("UPDATE funding_rounds SET seed_at = ?, grow_at = ?, choose_at = ?, harvest_at = ? WHERE id = ?", [at(d[0]), at(d[1]), at(d[2]), at(d[3]), roundId]);
  };
  const tick = async (who: string, roundId: string, ideaIds: string[]) => {
    as(who);
    return call("PUT /api/funding-rounds/rounds/:id/marks", { params: { id: roundId }, body: { ideaIds } });
  };
  const read = async (roundId: string, who = "s4-5") => {
    as(who);
    return call("GET /api/funding-rounds/rounds/:id", { params: { id: roundId } });
  };
  const closer = () => fundingDivergenceCloser(() => ({ pool, questsRepo: { add: async (x: any) => { quests.push(x); }, all: async () => quests } }));

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 });
    await loadModuleSettings(pool);
    await loadVariables(pool);
    await loadTokenRegistry(pool);
    await ensureVoiceToken(pool, "Village Voice");
    await loadTokenRegistry(pool);
    await setModuleLifecycle("funding-rounds", "members", null, { sharedPasswordPosture: () => false });
    for (const p of [...people, { id: "s4-late", name: "Late Reed" }]) {
      await q( // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
        "INSERT INTO `users` (`id`,`name`,`email`,`password_hash`) VALUES (?,?,?,'x') ON DUPLICATE KEY UPDATE `name` = VALUES(`name`)",
        [p.id, p.name, `${p.id}@examples.invalid`],
      );
    }
    // The donor: one Voice from work and a mountain from a donation.
    await minted("s4-0", 100, "quest_consent");
    await minted("s4-0", 10_000_000, "donation_voice");
    // Nine members: ten Voice each, from work.
    for (const p of people.slice(1)) await minted(p.id, 1000, "role_cycle");

    const c = collect();
    register(c.app, {
      authedUser: async () => (whoami ? { id: whoami } : null),
      getPool: () => pool,
      overLimit: async () => false,
      guardCapability: async (_req: any, res: any) => {
        if (whoami === "s4-0") return true;
        res.status(403).json({ error: "not_yours" });
        return false;
      },
      mayAct: async () => ({ ok: whoami === "s4-0" }),
      members: { all: async () => people, count: async () => people.length },
      questsRepo: { add: async (x: any) => { quests.push(x); }, all: async () => quests },
      // No countedVoice: the real ledger read, work-only.
      roll: async () => Array.from(roll),
      divergence: {
        governanceOn: () => governance,
        ballotSetup: async () => ({
          method: "majority",
          dials: { unityPct: 50, quorumPct: 0 },
          snapshot: { mode: "equal", token: null, capPct: null },
          tokenProblem: null,
          electorate: Array.from(roll).map((userId) => ({ userId, weight: 1 })),
          durationDays: 7,
        }),
        notifyRoll: async (b: { id: string }, input: any) => { told.push({ ballotId: b.id, roll: input.roll ?? [] }); return (input.roll ?? []).length; },
      },
    } as any);
    handlers = c.handlers;

    as("s4-0");
    const pot = await call("POST /api/funding-rounds/pots", { body: { name: "Village pot", unitCode: "CRC" } });
    potId = pot.body.pot.id;
    // The cap is lifted so the arithmetic stays readable, as in the loop suite.
    await q("UPDATE funding_pots SET weight_cap_pct = 100 WHERE id = ?", [potId]);
    await q("INSERT INTO funding_pot_receipts (id, pot_id, amount_minor, note, recorded_by) VALUES ('s4-rcpt', ?, 5000000, 'season dues', 's4-0')", [potId]);
  }, 180_000);

  afterAll(async () => {
    await pool?.end();
    await db?.drop();
  });

  it("weighs the power count by work-earned Voice, frozen when choosing opens", async () => {
    const { roundId, ids: [shed, seeds] } = await newRound("Dry season", [{ title: "Tool shed", ask: 600000 }, { title: "Seed bank", ask: 600000 }], 1000000);
    await putIn(roundId, "choose");

    // The first read in choose freezes the roll and its counted Voice.
    const opened = await read(roundId, "s4-0");
    expect(opened.body.voice).toMatchObject({ countedVoice: "work_only", roll: 10, mine: 100 });
    const frozen = await q("SELECT user_id, voice FROM funding_round_voice WHERE round_id = ? ORDER BY user_id", [roundId]);
    expect(frozen).toHaveLength(10);
    // The donation weighs nothing: 1.00 Voice from work, 100,001.00 in all.
    expect(Number(frozen.find((r: any) => r.user_id === "s4-0").voice)).toBe(100);
    expect(Number(frozen.find((r: any) => r.user_id === "s4-1").voice)).toBe(1000);

    expect((await tick("s4-0", roundId, [shed])).status).toBe(200);
    for (const p of people.slice(1)) expect((await tick(p.id, roundId, [seeds])).status).toBe(200);

    // After the freeze the donor earns a great deal of work Voice. It must not count here.
    await minted("s4-0", 50_000_000, "quest_consent");
    // A member who reaches the roll after the freeze cannot tick in this round.
    roll.add("s4-late");
    const late = await tick("s4-late", roundId, [seeds]);
    expect(late.status).toBe(403);
    expect(late.body.error).toMatch(/voting roll was set when choosing opened/);
    roll.delete("s4-late");

    await putIn(roundId, "harvest");
    const view = await read(roundId);
    const o = view.body.outcome;
    expect(o).toMatchObject({ quorumMet: true, decider: "power", electorate: 10, markers: 10, countedVoice: "work_only", voiceFrozenLate: false, heldForVote: [] });
    // Nine members with ten work Voice each outweigh one with one: both counts fund the seed bank.
    expect(o.power.funded).toEqual([seeds]);
    expect(o.people.funded).toEqual([seeds]);
    expect(o.divergence).toEqual([]);
    expect(view.body.divergenceVote).toBeNull();
    expect(view.body.ideas.find((i: any) => i.id === seeds).status).toBe("funded");
    expect(view.body.ideas.find((i: any) => i.id === shed).status).toBe("not_funded");
    expect(told).toHaveLength(0);
  });

  it("freezes at harvest, and says so, when nothing froze the Voice while the round chose", async () => {
    const { roundId, ids: [well] } = await newRound("Quiet season", [{ title: "Well cover", ask: 50000 }]);
    // Ticks written straight in, as though choosing came and went with nobody opening the page.
    await putIn(roundId, "harvest");
    for (const p of people) await q("INSERT INTO funding_round_marks (round_id, user_id, idea_id) VALUES (?, ?, ?)", [roundId, p.id, well]);
    const o = (await read(roundId)).body.outcome;
    expect(o.voiceFrozenLate).toBe(true);
    expect(o.power.funded).toEqual([well]);
  });

  it("holds the disputed quests and opens a 48-hour village vote; not carried, the deciding count stands", async () => {
    // The donor now holds by far the most work Voice (minted in the first case).
    const { roundId, ids: [shed, seeds, well] } = await newRound(
      "Wet season",
      [{ title: "Tool shed", ask: 600000 }, { title: "Seed bank", ask: 600000 }, { title: "Rain barrels", ask: 100000 }],
      700000,
    );
    await putIn(roundId, "choose");
    expect((await tick("s4-0", roundId, [shed, well])).status).toBe(200);
    for (const p of people.slice(1)) await tick(p.id, roundId, [seeds, well]);
    await putIn(roundId, "harvest");

    const view = await read(roundId);
    const o = view.body.outcome;
    expect(o.power.funded.sort()).toEqual([shed, well].sort());
    expect(o.people.funded.sort()).toEqual([seeds, well].sort());
    expect(o.heldForVote.sort()).toEqual([shed, seeds].sort());
    const status = (id: string) => view.body.ideas.find((i: any) => i.id === id).status;
    // What both counts fund goes ahead at once; the disputed quests wait.
    expect(status(well)).toBe("funded");
    expect(status(shed)).toBe("on_ballot");
    expect(status(seeds)).toBe("on_ballot");
    expect(await q("SELECT idea_id FROM funding_earmarks WHERE round_id = ?", [roundId])).toEqual([{ idea_id: well }]);

    // The vote is on the ordinary engine, 48 hours long, asked by the round and not by a person.
    const vote = view.body.divergenceVote;
    expect(vote).toMatchObject({ result: null, heldIdeaIds: expect.arrayContaining([shed, seeds]) });
    const ballot = await ballotById(pool, vote.ballotId);
    expect(ballot).toMatchObject({ subjectType: "funding_divergence", subjectRef: roundId, openedBy: "sys:funding-rounds", status: "open" });
    expect(Date.parse(ballot!.closesAt) - Date.parse(ballot!.opensAt)).toBe(48 * 3600 * 1000);
    expect(ballot!.docMarkdown).toContain("Tool shed");
    expect(ballot!.docMarkdown).toContain("Seed bank");
    expect(told.filter((t) => t.ballotId === ballot!.id)).toHaveLength(1);

    // A second read opens nothing new.
    await read(roundId);
    expect(await q("SELECT id FROM ballots WHERE subject_type = 'funding_divergence' AND subject_ref = ?", [roundId])).toHaveLength(1);

    // Pledging on a held quest waits for the vote.
    as("s4-3");
    const pledge = await call("POST /api/funding-rounds/ideas/:id/pledges", { params: { id: seeds }, body: { amountMinor: 1000 } });
    expect(pledge.status).toBe(409);

    // The vote does not carry: the deciding count (Voice) funds the shed.
    const c = closer();
    await c.settle(ballot!, "failed", "", "governance");
    const after = await read(roundId);
    expect(after.body.ideas.find((i: any) => i.id === shed).status).toBe("funded");
    expect(after.body.ideas.find((i: any) => i.id === seeds).status).toBe("not_funded");
    expect(after.body.divergenceVote).toMatchObject({ result: "decider" });
    expect(after.body.divergenceVote.note).toMatch(/deciding count stands/);
    const earmarks = await q("SELECT idea_id, amount_minor FROM funding_earmarks WHERE round_id = ? ORDER BY idea_id", [roundId]);
    expect(earmarks.map((e: any) => e.idea_id).sort()).toEqual([shed, well].sort());
    expect(quests.filter((x) => x.title === "Tool shed")).toHaveLength(1);

    // Settling twice changes nothing.
    await c.settle(ballot!, "failed", "", "governance");
    await c.execute!(ballot!, "governance");
    expect(await q("SELECT idea_id FROM funding_earmarks WHERE round_id = ?", [roundId])).toHaveLength(2);
    expect((await read(roundId)).body.divergenceVote.result).toBe("decider");
  });

  it("carried, funds the other count's quests once the landing is due", async () => {
    const { roundId, ids: [shed, seeds] } = await newRound("Planting moon", [{ title: "Tool shed", ask: 600000 }, { title: "Seed bank", ask: 600000 }], 600000);
    await putIn(roundId, "choose");
    await tick("s4-0", roundId, [shed]);
    for (const p of people.slice(1)) await tick(p.id, roundId, [seeds]);
    await putIn(roundId, "harvest");
    const vote = (await read(roundId)).body.divergenceVote;
    const ballot = (await ballotById(pool, vote.ballotId))!;
    const c = closer();
    // A carried vote settles nothing at the close; it lands later.
    await c.settle(ballot, "passed", "", "governance");
    expect((await read(roundId)).body.divergenceVote.result).toBeNull();
    await c.execute!(ballot, "governance");
    const after = await read(roundId);
    expect(after.body.divergenceVote.result).toBe("other");
    expect(after.body.ideas.find((i: any) => i.id === seeds).status).toBe("funded");
    expect(after.body.ideas.find((i: any) => i.id === shed).status).toBe("not_funded");
  });

  it("with voting off, the deciding count stands at once and the round says why", async () => {
    governance = false;
    try {
      const { roundId, ids: [shed, seeds] } = await newRound("Harvest moon", [{ title: "Tool shed", ask: 600000 }, { title: "Seed bank", ask: 600000 }], 600000);
      await putIn(roundId, "choose");
      await tick("s4-0", roundId, [shed]);
      for (const p of people.slice(1)) await tick(p.id, roundId, [seeds]);
      await putIn(roundId, "harvest");
      const view = await read(roundId);
      expect(view.body.divergenceVote).toMatchObject({ ballotId: null, result: "decider" });
      expect(view.body.divergenceVote.note).toMatch(/Voting is off/);
      expect(view.body.ideas.find((i: any) => i.id === shed).status).toBe("funded");
      expect(await q("SELECT id FROM ballots WHERE subject_ref = ?", [roundId])).toHaveLength(0);
    } finally {
      governance = true;
    }
  });

  it("erases a member's frozen Voice with them and puts it in their export", async () => {
    const { exportMemberFundingRounds, forgetMemberFundingRounds } = await import("../lib/fundingRounds");
    const out = (await exportMemberFundingRounds(pool, "s4-9")) as any;
    expect(out.voice.length).toBeGreaterThan(0);
    await forgetMemberFundingRounds(pool, "s4-9");
    expect(await q("SELECT * FROM funding_round_voice WHERE user_id = 's4-9'")).toHaveLength(0);
  });
});
