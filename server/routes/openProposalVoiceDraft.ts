/**
 * "DRAFT MY ANSWERS FROM WHAT I SAID" on the public application, one door
 * (Rye, 14 Nov 2026; the contract is shared/voiceDrafts.ts).
 *
 *   POST /api/open-proposals/voice-draft   { roleId, heard, link? }
 *
 * Registered from routes/openProposals.ts, which hands over its own door, its
 * offered roles and the season's goals, so server/index.ts gains no line.
 *
 * WHO CAN ASK. Anybody the application is open to: an applicant has no
 * account. So it rides the public road the site's visitor guide already uses
 * (`mode: "proposal"`, the village's key and that mode's day budget), with
 * two caps of its own: a few drafts per connection an hour, and a ceiling for
 * the whole village a day.
 *
 * WHAT GOES TO THE MODEL. The words heard, as the applicant corrected them,
 * the public card of the one role named, and the season's goals. Nothing else
 * of an application exists here to send: no name, address, reference, link,
 * file or recording.
 *
 * NOTHING IS STORED OR LOGGED. The drafts go back to the asker's page alone;
 * neither the words sent nor the reply is written anywhere.
 */
import type { Express, Request } from "express";
import { DEFAULT_ASSISTANT_MODEL, callAssistant, type AssistantRequest, type AssistantResult } from "../lib/assistant";
import { readVoiceDraft, voiceDraftBrief, voiceDraftSystem } from "../lib/voiceDrafts";
import { OPEN_AIM_MAX, OPEN_WHY_MAX } from "@shared/openProposals";
import { ABOUT_STORY_MAX } from "@shared/proposalAbout";
import { GOAL_LIMITS } from "@shared/proposalGoals";
import { VOICE_DRAFT_INPUT_MAX, VOICE_DRAFT_INPUT_MIN, VOICE_DRAFT_WORDS, type VoiceDraft } from "@shared/voiceDrafts";

/** Per connection an hour, and for the whole village a day (proposed; Rye decides the numbers). */
export const VOICE_DRAFTS_PER_HOUR = 3;
export const VOICE_DRAFTS_PER_DAY = 40;
const HOUR_MS = 60 * 60 * 1000;
const LIMITS = { why: OPEN_WHY_MAX, aim: OPEN_AIM_MAX, story: ABOUT_STORY_MAX, title: GOAL_LIMITS.title, doneWhen: GOAL_LIMITS.doneWhen };

export interface VoiceDraftDeps {
  door: (rawLink: unknown) => Promise<{ open: boolean }>;
  offered: () => Promise<Array<{ id: string; name: string; aim: string | null; accountabilities: string[] }>>;
  seasonGoals: () => Promise<string[]>;
  overLimit: (key: string, max: number, windowMs: number) => Promise<boolean>;
  clientIp: (req: Request) => string;
  ipBucket: (ip: string) => string;
  villageName: () => string;
  /** The model call; tests hand in their own. */
  ask?: (req: AssistantRequest) => Promise<AssistantResult>;
}

export function registerVoiceDraft(app: Express, deps: VoiceDraftDeps): void {
  const ask = deps.ask ?? callAssistant;

  app.post("/api/open-proposals/voice-draft", async (req, res) => {
    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    if (!(await deps.door(body.link)).open) return res.status(403).json({ error: VOICE_DRAFT_WORDS.closed });
    const heard = String(typeof body.heard === "string" ? body.heard : "").trim().slice(0, VOICE_DRAFT_INPUT_MAX);
    if (heard.length < VOICE_DRAFT_INPUT_MIN) return res.status(400).json({ error: VOICE_DRAFT_WORDS.tooLittle });
    const roleId = String(typeof body.roleId === "string" ? body.roleId : "").trim();
    const role = roleId ? (await deps.offered()).find((r) => r.id === roleId) : undefined;
    if (!role) return res.status(400).json({ error: VOICE_DRAFT_WORDS.pickRole });
    const bucket = deps.ipBucket(deps.clientIp(req));
    if (await deps.overLimit(`open-proposal:voice-draft:ip:${bucket}`, VOICE_DRAFTS_PER_HOUR, HOUR_MS)) return res.status(429).json({ error: VOICE_DRAFT_WORDS.tooMany });
    if (await deps.overLimit("open-proposal:voice-draft:day", VOICE_DRAFTS_PER_DAY, 24 * HOUR_MS)) return res.status(503).json({ error: VOICE_DRAFT_WORDS.unavailable });

    const call = await ask({
      // Public: nobody is signed in, so there is no per-member ceiling; the caps above and the mode's day budget hold it.
      mode: "proposal",
      system: voiceDraftSystem(deps.villageName(), LIMITS),
      messages: [{ role: "user", content: "Write the first drafts." }],
      model: DEFAULT_ASSISTANT_MODEL,
      maxTokens: 1400,
      clientIp: deps.clientIp(req),
      userId: null,
      burstKey: `assist-voice-draft:${bucket}`,
      burstPerHour: VOICE_DRAFTS_PER_HOUR * 2,
      prefetch: [{ key: "application.voice", data: voiceDraftBrief({ role: { name: role.name, aim: role.aim, accountabilities: role.accountabilities }, seasonGoals: await deps.seasonGoals(), heard }) }],
    });
    if (!call.ok) return res.status(call.status === 429 ? 429 : 503).json({ error: call.status === 429 ? VOICE_DRAFT_WORDS.tooMany : VOICE_DRAFT_WORDS.unavailable });
    const draft: VoiceDraft | null = readVoiceDraft(call.text, LIMITS);
    res.json({ draft: draft ?? {} });
  });
}
