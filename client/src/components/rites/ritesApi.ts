/**
 * What the rites screens read and send (server/routes/rites.ts). Every call
 * carries the session when there is one; the public ones work without.
 */
import type { NavItem, PlaceKey, StampView } from "@shared/rites";
import { gameFetch } from "@/lib/gameApi";
import type { Look, Places } from "./parts";

export class RitesError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function ritesGet<T>(path: string): Promise<T> {
  const res = await gameFetch(path);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new RitesError(res.status, String((body as any)?.error ?? res.status));
  return body as T;
}

export async function ritesSend<T>(method: "POST" | "PUT", path: string, json: unknown = {}): Promise<T> {
  const res = await gameFetch(path, { method, body: JSON.stringify(json) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new RitesError(res.status, String((body as any)?.error ?? res.status));
  return body as T;
}

export interface StepView {
  title: string;
  line: string;
  place: PlaceKey | null;
}

export interface DoorView extends StepView {
  id: string;
  interestOnly: boolean;
  href: string;
  onWelcome?: boolean;
  choiceTitle?: string;
  choiceLine?: string;
  questTitle?: string;
  questHref?: string;
  questPlace?: PlaceKey | null;
  meetLabel?: string;
}

export interface PublicView {
  village: string;
  inviter: string | null;
  welcome: Record<string, string> & { steps: StepView[]; road: StepView[]; doors: DoorView[] };
  articles: Record<string, string> & { items: Array<{ n: number; title: string; line: string }>; linkFor?: "everyone" | "members" };
  counts: Array<{ label: string; n: number }>;
  places: Places;
  look: Look;
  sigil: string;
  nav: NavItem[];
  words: Record<string, string>;
  steps: string[];
}

export interface MeView {
  id: string;
  name: string;
  stageWord: string;
  memberWord: string;
  sworn: boolean;
  admitted: boolean;
  mayWitness: boolean;
  mark: string | null;
  buddy: { id: string; name: string; handle: string | null; avatar: string | null; greeting: string | null } | null;
  inviter: string | null;
  aboard: { doorId: string | null; why: string | null } | null;
  stamps: StampView[];
  rites: Array<{ id: string; todo: string; done: string; spoken: boolean; admits: boolean; place: PlaceKey | null; atGathering?: boolean; callCounts?: boolean }>;
  openCeremonies: Array<{ id: string; riteId: string }>;
  tokens: { record: { slug: string; name: string; n: number } | null; voice: { slug: string; name: string; n: number } | null };
  words: Record<string, string>;
  doors: DoorView[];
  steps: string[];
  look: Look;
  sigil: string;
  nav: NavItem[];
  village: string;
}

export interface CeremonyView {
  id: string;
  rite: { id: string; title: string; todo: string; done: string; callCounts: boolean; place: PlaceKey | null };
  photo: string;
  sigil: string;
  village: string;
  place: PlaceKey | null;
  lines: string[];
  answer: string | null;
  spoken: number;
  step: "speaking" | "marking" | "witnessing" | "sworn" | "set-aside";
  needed: number;
  confirmed: number;
  markNeeded: boolean;
  mark: string | null;
  candidate: { id: string; name: string };
  witnesses: Array<{ id: string; name: string; initial: string; isBuddy: boolean; via: "present" | "call"; confirmed: boolean; you: boolean }>;
  you: { isCandidate: boolean; isWitness: boolean; mayWitness: boolean };
  words: Record<string, string> & { places: Places };
  look: Look;
}

export interface RingView {
  count: number;
  marks: Array<{ path: string; mine: boolean }>;
  title: string;
}

export interface CrewView {
  member: string;
  voiceName: string | null;
  crew: Array<{ id: string; name: string; avatar: string | null; you: boolean; resting: boolean; roles: string[]; voice: number }>;
}

export interface RecordView {
  token: string | null;
  entries: Array<{ id: string; title: string; n: number; at: string }>;
}
