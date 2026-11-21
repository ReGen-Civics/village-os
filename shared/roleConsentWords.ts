/**
 * THE ROLE WORDS THE ADMIN ROUTES REFUSE, in one place both sides read.
 *
 * The role's handover words (0268, #534) and its CCOS words (0274) change by
 * consent, through an org chart draft (`update_seat`), never through the admin
 * create or edit. Those routes refuse them by name (`server/routes/org.ts`), and
 * the proposal check (`server/lib/proposedChanges.ts`) refuses a `setting`
 * proposal that would carry them at filing, with the same sentence, so a change
 * that would fail on accept is never filed (20 Nov 2026). Before this file the
 * lists lived in the route, and a lib may not import a route.
 */
import { ROLE_CCOS_COLUMNS, ROLE_CCOS_FIELDS } from "./roleCcos";

/** The handover words, in either spelling. */
export const HANDOVER_WORD_KEYS = ["bringMe", "notMine", "runbook", "bring_me", "not_mine"] as const;

export const HANDOVER_WORDS_REFUSAL =
  "Bring me, Not mine to hold and the runbook change by consent: propose them through an org chart draft.";

/** Whether this admin body carries any of the role's handover words. */
export function carriesHandoverWords(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  return HANDOVER_WORD_KEYS.some((k) => Object.prototype.hasOwnProperty.call(body, k));
}

/**
 * The CCOS words, in either spelling. The recruitment pack's own `authority`
 * note is a different, admin-only field and stays writable.
 */
export const CCOS_WORD_KEYS: readonly string[] = [...ROLE_CCOS_FIELDS, ...ROLE_CCOS_FIELDS.map((f) => ROLE_CCOS_COLUMNS[f])];

export const CCOS_WORDS_REFUSAL =
  "These role words change by consent: this role exists while, what it can decide on its own, what it does regularly, holding it well, and its time. Propose them through an org chart draft.";

/** Whether this admin body carries any of the role's CCOS words. */
export function carriesCcosWords(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  return CCOS_WORD_KEYS.some((k) => Object.prototype.hasOwnProperty.call(body, k));
}
