/**
 * WHO SET A KEY, AS A NAME. The secrets store records the account id of whoever typed a key
 * (server/lib/secrets.ts), and the Integrations card showed it raw ("set by usr-…"). This turns an
 * account id into that person's display name, falling back to "an admin" when the account is gone
 * or the setter was the admin password. Notes the store writes itself (a migration, the old game
 * variable) already read as words and pass through.
 */
export const UNNAMED_SETTER = "an admin";

const ALREADY_WORDS = /^(migration:|the old game variable )/;

export async function namedSetters<T extends { setBy?: string | null }>(statuses: T[], nameOf: (userId: string) => Promise<string | null | undefined>): Promise<T[]> {
  const names = new Map<string, string>();
  for (const s of statuses) {
    const by = s.setBy;
    if (!by || ALREADY_WORDS.test(by) || names.has(by)) continue;
    let name: string | null | undefined = null;
    try {
      name = await nameOf(by);
    } catch {
      name = null;
    }
    names.set(by, name && name.trim() ? name.trim() : UNNAMED_SETTER);
  }
  return statuses.map((s) => (s.setBy && names.has(s.setBy) ? { ...s, setBy: names.get(s.setBy)! } : s));
}
