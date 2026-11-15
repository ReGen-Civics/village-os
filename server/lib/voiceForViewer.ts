/**
 * WHO MAY HEAR AN APPLICANT'S VOICE, and read what was heard (security sweep,
 * 14 Nov 2026). shared/voiceNotes.ts promises the kept recording, its words
 * and the applicant's thoughts on each role card's pieces reach no assistant
 * or agent tool. The "personal" rule in shared/agentAdmin.ts opens applicant
 * reads to agents once the Anchor approves AI agents, so that promise has to
 * be kept where the data is served, too:
 *
 *   - An agent never gets them: a call through the connector (it says so with
 *     `x-village-connector`, server/routes/agentMcp.ts) or from an account
 *     marked as an agent's. A person who sends the header only hides them from
 *     themself, so trusting it can never open anything.
 *   - Admin's applications panel plays them to the village's admins
 *     (admin or founder), whom the consent tick names, and to nobody else who
 *     holds `intake.moderate`. The decider page plays them to its deciders.
 */
import type { Pool } from "mysql2/promise";

import { isAgentAccount } from "../repos/agentAccounts";

export interface VoiceViewer {
  /** The caller is an agent, or speaks through the connector. */
  agent: boolean;
  /** An admin or a founder of this village, and a person. */
  admin: boolean;
}

export async function voiceViewerOf(req: { get(name: string): string | undefined }, db: Pool, user: { id?: unknown; role?: unknown } | null | undefined): Promise<VoiceViewer> {
  const id = user?.id != null ? String(user.id) : null;
  const agent = !!req.get("x-village-connector") || (id ? await isAgentAccount(db, id) : false);
  const admin = !agent && (user?.role === "admin" || user?.role === "founder");
  return { agent, admin };
}

/** The voice part for a viewer: nothing for an agent, whatever else they may read. */
export function voiceForViewer<T>(viewer: VoiceViewer, voice: T | null | undefined): T | null {
  return viewer.agent ? null : (voice ?? null);
}
