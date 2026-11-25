/**
 * THE TEAM CARDS, TO WHOM (the lead, 25 Nov 2026: "/team shows visitors first names only").
 *
 * The `team` content section is the cards /team merges with the seat holders: a full name, a portrait and a bio
 * each. /api/content/:section is unauthenticated, so it handed every one of them to any stranger, surname
 * included, while /api/org was careful to give that stranger first names only and "A member" for whoever turned
 * off "Show my first name to visitors". This is the same line /api/org draws (`map.viewPeople`, or an admin):
 * a reader who may see the village's people gets the cards, and anyone else gets none. No card is cut down to a
 * first name instead, because a card is not tied to an account and so cannot honour a member's own setting; the
 * first names a visitor reads come from /api/org, which can.
 *
 * Only Team.tsx reads this section (client/src/pages/Team.tsx, `teamCardsShown`), and it asks only at the member
 * tier, so an empty answer costs a visitor nothing they were meant to see.
 */
export const TEAM_SECTION = "team";

export function teamCardsFor(cards: unknown, maySeePeople: boolean): unknown {
  return maySeePeople ? cards : [];
}
