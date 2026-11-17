/**
 * PROPOSED AGENDA ITEMS: the `session_agenda` kind of a proposed change (the
 * Operations Steward, 17 Nov 2026: "For this and all things we need to go
 * over in our Thursday meeting, add them to the agenda on the /sessions page,
 * and make sure our MCP is able to do this").
 *
 * An agent proposes items for one circle's meeting; a person reads them on the
 * review page, edits them in place, and accepts. Accepting runs each item
 * through the door a member uses to add one (`POST /api/sessions/library`,
 * shared/sessionLibrary.ts) as the person accepting, so the item is theirs and
 * the agenda library's own rules answer for it. Nothing new is stored: an
 * accepted item is an ordinary agenda item waiting for its meeting.
 *
 *   target {circleId, rhythmKey?}   the circle. With no rhythmKey (the usual
 *                                   case, the lead, 17 Nov 2026) the items are
 *                                   the circle's open agenda items, which need
 *                                   no rhythm and wait for whichever session
 *                                   the circle opens next; a rhythmKey (0401)
 *                                   ties them to one of its meeting rhythms
 *   body   {items: [{title, detail?, kind, ownerRole?}]}
 *          kind is consent, decision or discussion
 *
 * Pure: no database. The server checks that the circle and the rhythm are
 * there (server/lib/proposedChanges.ts).
 */
import { LIBRARY_API, LIBRARY_LIMITS } from "./sessionLibrary";
import { RHYTHM_KEY } from "./sessionRhythm";
import type { ItemAim } from "./sessions";

export const AGENDA_PROPOSAL_ROUTE = { method: "POST", path: LIBRARY_API } as const;

export const AGENDA_ITEM_KINDS = ["consent", "decision", "discussion"] as const;
export type AgendaItemKind = (typeof AGENDA_ITEM_KINDS)[number];

export const AGENDA_PROPOSAL_LIMITS = { items: 20, ownerRole: 120 } as const;

/** The aim each kind takes on the agenda: a consent round and a decision both decide; a discussion explores. */
export const AIM_OF_KIND: Record<AgendaItemKind, ItemAim> = { consent: "decide", decision: "decide", discussion: "explore" };

/** The line the item's note opens with, so the room reads how the item asks to be held. */
export const AGENDA_KIND_WORDS: Record<AgendaItemKind, string> = {
  consent: "For consent.",
  decision: "For a decision.",
  discussion: "For discussion.",
};

export interface ProposedAgendaItem {
  title: string;
  detail: string | null;
  kind: AgendaItemKind;
  ownerRole: string | null;
}

export interface ProposedAgenda {
  circleId: string;
  rhythmKey: string | null;
  items: ProposedAgendaItem[];
}

type Read = { ok: true; value: ProposedAgenda } | { ok: false; error: string; field: string };

const line = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");
const text = (v: unknown) => (typeof v === "string" ? v.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim() : "");

/** A proposed agenda, read and checked for shape; or the sentence and the field saying why not. */
export function readProposedAgenda(target: Record<string, unknown>, body: Record<string, unknown>): Read {
  const circleId = line(target.circleId);
  if (!circleId) return { ok: false, error: "Name the circle whose meeting the items are for: target.circleId.", field: "target.circleId" };
  const rawKey = target.rhythmKey;
  const rhythmKey = rawKey == null || rawKey === "" ? null : line(rawKey);
  if (rhythmKey !== null && !RHYTHM_KEY.test(rhythmKey)) return { ok: false, error: "target.rhythmKey is the key of one of the circle's meeting rhythms, or left out for its next meeting.", field: "target.rhythmKey" };
  if (!Array.isArray(body.items) || body.items.length === 0) return { ok: false, error: "Send the agenda items as body.items, at least one.", field: "items" };
  if (body.items.length > AGENDA_PROPOSAL_LIMITS.items) return { ok: false, error: `Propose at most ${AGENDA_PROPOSAL_LIMITS.items} agenda items at once.`, field: "items" };
  const items: ProposedAgendaItem[] = [];
  for (let i = 0; i < body.items.length; i++) {
    const raw = body.items[i];
    const it = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const n = i + 1;
    const title = line(it.title);
    if (!title) return { ok: false, error: `Item ${n} needs a title.`, field: `items.${i}.title` };
    if (title.length > LIBRARY_LIMITS.title) return { ok: false, error: `Item ${n}'s title is longer than ${LIBRARY_LIMITS.title} characters.`, field: `items.${i}.title` };
    if (!(AGENDA_ITEM_KINDS as readonly string[]).includes(String(it.kind))) {
      return { ok: false, error: `Item ${n}'s kind is one of ${AGENDA_ITEM_KINDS.join(", ")}.`, field: `items.${i}.kind` };
    }
    const detail = text(it.detail);
    const ownerRole = line(it.ownerRole);
    if (ownerRole.length > AGENDA_PROPOSAL_LIMITS.ownerRole) return { ok: false, error: `Item ${n}'s owner role is longer than ${AGENDA_PROPOSAL_LIMITS.ownerRole} characters.`, field: `items.${i}.ownerRole` };
    const item: ProposedAgendaItem = { title, detail: detail || null, kind: it.kind as AgendaItemKind, ownerRole: ownerRole || null };
    if (agendaNote(item).length > LIBRARY_LIMITS.note) return { ok: false, error: `Item ${n}'s detail is longer than an agenda item's note can hold.`, field: `items.${i}.detail` };
    items.push(item);
  }
  return { ok: true, value: { circleId, rhythmKey, items } };
}

/** The note an accepted item carries: how it asks to be held, the role that owns it, and the detail. */
export function agendaNote(item: ProposedAgendaItem): string {
  return [AGENDA_KIND_WORDS[item.kind], item.ownerRole ? `Owner role: ${item.ownerRole}.` : "", item.detail ?? ""].filter(Boolean).join("\n\n");
}

/** The body the member's own door takes for one accepted item. */
export function agendaItemBody(agenda: Pick<ProposedAgenda, "circleId" | "rhythmKey">, item: ProposedAgendaItem): Record<string, unknown> {
  return {
    title: item.title,
    aim: AIM_OF_KIND[item.kind],
    note: agendaNote(item),
    circleId: agenda.circleId,
    ...(agenda.rhythmKey ? { rhythmKey: agenda.rhythmKey } : {}),
  };
}
