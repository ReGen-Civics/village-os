/**
 * THE PORTAL'S VISITORS INTO THE VILLAGE'S EMAIL LIST (ops, 24 Nov 2026: "so that we can build our
 * CRM"). Brevo, because it is the list the village already keeps.
 *
 * WHO GOES: only a visitor who answered Yes to keeping in touch, never a test entry, and only while the
 * village has set both halves: the key under Admin, Integrations (`brevo_api_key`, sealed) and the
 * list's number in the dial `entrance.brevo_list_id` (0 is off, the default).
 *
 * WHAT IT DOES, AND NOTHING ELSE: it adds or updates one contact on that one list, with the name,
 * and the source and interest as attributes. It sends no email. Whether the list itself triggers a
 * welcome is the village's own setting inside Brevo, and the runbook says so. Forgetting a person
 * takes them off that list (never out of Brevo whole: they may be on the village's other lists by
 * their own choice).
 *
 * Every call goes through the guarded outbound door (server/lib/toolcheck.ts). A call that fails is
 * written down on the entry (`sync_error`) and tried again from Admin, Portal visitors.
 */
import type { PortalEntry } from "../../shared/entrance";
import { guardedFetchJson } from "./toolcheck";

const BREVO = "https://api.brevo.com/v3";

export interface BrevoDeps {
  apiKey(): string;
  listId(): number;
  /** One JSON POST; the default is the guarded door. Swapped in tests. */
  post?: (url: string, body: unknown, headers: Record<string, string>) => Promise<unknown>;
}

const guardedPost = (url: string, body: unknown, headers: Record<string, string>) => guardedFetchJson(url, 10_000, { method: "POST", body, headers });

export function brevoOn(deps: BrevoDeps): boolean {
  return !!deps.apiKey() && Number.isInteger(deps.listId()) && deps.listId() > 0;
}

/** First name and the rest, the way Brevo's two standard attributes hold a name. */
export function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

/** Add or update one visitor on the list. Answers null when it went, or a short reason when it did not. */
export async function syncToBrevo(deps: BrevoDeps, e: Pick<PortalEntry, "email" | "name" | "interest" | "whatsapp">): Promise<string | null> {
  if (!brevoOn(deps)) return "the email list is not set up";
  const post = deps.post ?? guardedPost;
  const headers = { "api-key": deps.apiKey(), accept: "application/json" };
  const { first, last } = splitName(e.name);
  const base = { email: e.email, listIds: [deps.listId()], updateEnabled: true };
  const full = {
    ...base,
    attributes: { FIRSTNAME: first, LASTNAME: last, PORTAL_SOURCE: "portal", ...(e.interest ? { PORTAL_INTEREST: e.interest } : {}), ...(e.whatsapp ? { WHATSAPP: e.whatsapp } : {}) },
  };
  try {
    await post(`${BREVO}/contacts`, full, headers);
    return null;
  } catch (first400) {
    // An account that has not made the three custom attributes refuses the whole contact. The
    // person still belongs on the list, so they go with the two attributes every account has.
    try {
      await post(`${BREVO}/contacts`, { ...base, attributes: { FIRSTNAME: first, LASTNAME: last } }, headers);
      return null;
    } catch (e2) {
      return `Brevo refused the contact (${String((e2 as Error)?.message ?? e2).slice(0, 80) || String((first400 as Error)?.message ?? "")})`;
    }
  }
}

/** Take addresses off the list, on a person's request. Answers null when it went. */
export async function removeFromBrevo(deps: BrevoDeps, emails: string[]): Promise<string | null> {
  if (!brevoOn(deps) || !emails.length) return null;
  const post = deps.post ?? guardedPost;
  try {
    await post(`${BREVO}/contacts/lists/${deps.listId()}/contacts/remove`, { emails }, { "api-key": deps.apiKey(), accept: "application/json" });
    return null;
  } catch (e) {
    return `Brevo did not take them off the list (${String((e as Error)?.message ?? e).slice(0, 80)})`;
  }
}

/** The Brevo card for Admin, Integrations. */
export const BREVO_CARD = {
  key: "brevo_api_key" as const,
  title: "Brevo, the village's email list",
  unlocks:
    "Visitors who enter the portal and answer Yes to keeping in touch are added to one Brevo list, with their name and, if Brevo has them, the attributes PORTAL_SOURCE, PORTAL_INTEREST and WHATSAPP. Set the list's number below, beside the key. Nothing here sends an email; a welcome only goes out if that list has one set up inside Brevo.",
  getAt: "app.brevo.com → SMTP & API → API keys",
  placeholder: "xkeysib-…",
};
