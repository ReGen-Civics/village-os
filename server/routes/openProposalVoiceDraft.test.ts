/**
 * "Draft my answers from what I said" (Rye, 14 Nov 2026; shared/voiceDrafts.ts),
 * over real HTTP with the model handed in. What is pinned:
 *
 *   - Only the words heard, the one role's public card and the season's goals
 *     reach the model, whatever else the page sends.
 *   - The model writes for the applicant and is told never to judge them.
 *   - The reply is read strictly to each field's limits.
 *   - The door, too little to draft from, an unknown role, the caps and a
 *     model that cannot answer are each answered in words, and nothing is kept.
 */
import http from "node:http";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AssistantRequest, AssistantResult } from "../lib/assistant";
import { readVoiceDraft, voiceDraftSystem } from "../lib/voiceDrafts";
import { VOICE_DRAFT_WORDS } from "../../shared/voiceDrafts";
import { VOICE_DRAFTS_PER_HOUR, registerVoiceDraft } from "./openProposalVoiceDraft";

const HEARD = "I have run the seed library on my road for six years, and I want to bring people to the land the same way. In my first months I would start a seed swap every new moon.";
const ROLE = { id: "r-seeds", name: "Seed Keeper", aim: "Every household saves seed.", accountabilities: ["Run the seed swap"] };
const LIMITS = { why: 1200, aim: 300, story: 160, title: 120, doneWhen: 200 };

describe("the reader", () => {
  it("cuts each part to its field, drops dashes and empty parts, and keeps at most three items", () => {
    const read = readVoiceDraft(
      JSON.stringify({ why: "I keep seed — it matters.", aim: "x".repeat(400), story: "", items: [1, 2, 3, 4].map((n) => ({ title: `Swap ${n}`, doneWhen: "Held once" })).concat([{ title: "", doneWhen: "no title" } as any]) }),
      LIMITS,
    );
    expect(read?.why).toBe("I keep seed, it matters.");
    expect(read?.aim).toHaveLength(300);
    expect(read?.story).toBeUndefined();
    expect(read?.items).toHaveLength(3);
    expect(readVoiceDraft("not json at all", LIMITS)).toBeNull();
    expect(readVoiceDraft(JSON.stringify({ why: "", items: [] }), LIMITS)).toBeNull();
  });

  it("tells the model it writes for the applicant, from their words only, and never judges them", () => {
    const system = voiceDraftSystem("Test Village", LIMITS);
    expect(system).toContain("Use ONLY what they said");
    expect(system).toContain("You never judge, rank, score, praise or describe them for anyone else");
  });
});

describe("the door, over HTTP", () => {
  let server: http.Server;
  let base = "";
  const state = {
    open: true,
    limited: new Set<string>(),
    counted: [] as string[],
    asked: [] as AssistantRequest[],
    reply: { ok: true, text: JSON.stringify({ why: "I have run the seed library for six years.", aim: "A seed swap every new moon.", items: [{ title: "Start the seed swap", doneWhen: "One swap held" }] }) } as Partial<AssistantResult>,
  };

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    registerVoiceDraft(app, {
      door: async () => ({ open: state.open }),
      offered: async () => [ROLE],
      seasonGoals: async () => ["Grow the commons"],
      overLimit: async (key) => {
        state.counted.push(key);
        return [...state.limited].some((k) => key.startsWith(k));
      },
      clientIp: () => "203.0.113.9",
      ipBucket: (ip) => ip,
      villageName: () => "Test Village",
      ask: async (req) => {
        state.asked.push(req);
        return state.reply as AssistantResult;
      },
    });
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    base = `http://127.0.0.1:${addr.port}`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });
  beforeEach(() => {
    state.open = true;
    state.limited.clear();
    state.counted.length = 0;
    state.asked.length = 0;
  });

  const post = async (body: unknown) => {
    const res = await fetch(`${base}/api/open-proposals/voice-draft`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); // module-review-ok: a test calling its own local server
    return { status: res.status, body: (await res.json()) as any };
  };

  it("drafts from the words heard and the one role's card, and sends the model nothing else", async () => {
    const r = await post({ roleId: ROLE.id, heard: HEARD, name: "Rowan Field", email: "rowan@example.test", references: [{ name: "Ana" }] });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.draft).toEqual({ why: "I have run the seed library for six years.", aim: "A seed swap every new moon.", items: [{ title: "Start the seed swap", doneWhen: "One swap held" }] });
    expect(state.asked).toHaveLength(1);
    const sent = state.asked[0];
    expect(sent.mode).toBe("proposal");
    expect(sent.userId).toBeNull();
    expect(sent.prefetch).toEqual([{ key: "application.voice", data: { roleCard: { name: ROLE.name, aim: ROLE.aim, accountabilities: ROLE.accountabilities }, seasonGoals: ["Grow the commons"], heard: HEARD } }]);
    const everything = JSON.stringify(sent);
    expect(everything).not.toContain("Rowan");
    expect(everything).not.toContain("example.test");
    expect(everything).not.toContain("Ana");
  });

  it("answers in words and asks no model: closed, too little, an unknown role, the caps", async () => {
    state.open = false;
    expect(await post({ roleId: ROLE.id, heard: HEARD })).toEqual({ status: 403, body: { error: VOICE_DRAFT_WORDS.closed } });
    state.open = true;
    expect(await post({ roleId: ROLE.id, heard: "Hello." })).toEqual({ status: 400, body: { error: VOICE_DRAFT_WORDS.tooLittle } });
    expect(await post({ roleId: "r-nope", heard: HEARD })).toEqual({ status: 400, body: { error: VOICE_DRAFT_WORDS.pickRole } });
    state.limited.add("open-proposal:voice-draft:ip:");
    expect(await post({ roleId: ROLE.id, heard: HEARD })).toEqual({ status: 429, body: { error: VOICE_DRAFT_WORDS.tooMany } });
    state.limited.clear();
    // One connection's day (security sweep, 14 Nov 2026): refused before the village's day is counted, so it spends none of it.
    state.limited.add("open-proposal:voice-draft:daily-ip:");
    state.counted.length = 0;
    expect(await post({ roleId: ROLE.id, heard: HEARD })).toEqual({ status: 429, body: { error: VOICE_DRAFT_WORDS.tooMany } });
    expect(state.counted).toEqual(["open-proposal:voice-draft:ip:203.0.113.9", "open-proposal:voice-draft:daily-ip:203.0.113.9"]);
    state.limited.clear();
    state.limited.add("open-proposal:voice-draft:day");
    expect(await post({ roleId: ROLE.id, heard: HEARD })).toEqual({ status: 503, body: { error: VOICE_DRAFT_WORDS.unavailable } });
    expect(state.asked).toHaveLength(0);
    expect(VOICE_DRAFTS_PER_HOUR).toBeGreaterThan(0);
  });

  it("a model that cannot answer is said plainly, and an unusable reply is an empty draft", async () => {
    state.reply = { ok: false, status: 503, error: "assistant-unavailable" } as any;
    expect(await post({ roleId: ROLE.id, heard: HEARD })).toEqual({ status: 503, body: { error: VOICE_DRAFT_WORDS.unavailable } });
    state.reply = { ok: true, text: "I'd rather not." } as any;
    expect(await post({ roleId: ROLE.id, heard: HEARD })).toEqual({ status: 200, body: { draft: {} } });
  });
});
