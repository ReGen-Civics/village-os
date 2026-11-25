/**
 * WHEN THE PAY TILE SHOWS (the lead, 25 Nov 2026: "the Pay tile shows to
 * members once credits are in use").
 *
 * Pay has no module of its own: /api/pay answers whenever a member is signed
 * in, and lists the credits this village lets members send. So the phone's
 * More sheet asks one question of that answer, here, and nowhere else:
 *
 *   credits are in use for this member when the village offers a credit a
 *   member can send AND this member holds some, or has paid or been paid.
 *
 * A village that never set up credits offers none, so nobody sees the tile. A
 * member who has never touched them sees it the day a credit reaches them.
 */

/** The slice of GET /api/pay this reads. */
export interface PayRead {
  tokens?: ReadonlyArray<{ balance?: number }>;
}

/** The slice of GET /api/pay/recent this reads. */
export interface PayRecentRead {
  people?: ReadonlyArray<unknown>;
}

export function creditsInUse(pay: PayRead | null | undefined, recent: PayRecentRead | null | undefined): boolean {
  const tokens = Array.isArray(pay?.tokens) ? pay!.tokens : [];
  if (tokens.length === 0) return false;
  if (tokens.some((t) => Number(t?.balance ?? 0) > 0)) return true;
  return Array.isArray(recent?.people) && recent!.people.length > 0;
}
