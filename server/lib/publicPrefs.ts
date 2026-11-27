/**
 * WHICH OF A MEMBER'S PREFS LEAVE THE SERVER IN A USER OBJECT (QA round 1 of today's card, 27 Nov 2026).
 *
 * `users.prefs` is the member's own JSON bag, and several features keep private state in it: their yeses to the
 * guide's provider lines (`companionConsent`), their kept daily cards (`todayCard`, which carry their Human Design
 * type, authority, profile, gates and the day's sky), the Google link, a pending email change. `publicUser` once
 * returned every key but one, and `PUT /api/admin/users/:id/role` answers with `publicUser(target)`, so an admin
 * changing a member's role was handed that member's chart.
 *
 * So the user object carries NAMED keys only: the ones the browser reads off it (`locale` for the language,
 * `displayCurrency` for the currency picker). Every other pref has its own door that only its owner can reach
 * (`/api/profile/prefs`, `/api/me/today-card`, `/api/agent/companion`). A new pref stays on the server until
 * somebody adds it here on purpose.
 */
export const PUBLIC_PREFS_KEYS = ["locale", "displayCurrency"] as const;

/** The prefs a user object may carry: the named keys that are set, and nothing else. */
export function publicPrefs(prefs: unknown): Record<string, unknown> | undefined {
  if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) return undefined;
  const p = prefs as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of PUBLIC_PREFS_KEYS) if (p[k] !== undefined) out[k] = p[k];
  return out;
}
