/**
 * ONE ROLE'S PAY FOR THE TIME GIVEN TO IT, AND THE CAP ON IT (Rye, 15 Nov 2026).
 *
 *   "Have the new pay math apply to the role application process now ... also
 *   roles should show a cap at 120% the listed price we set."
 *
 * The one formula the application and the End of Moon invoice both use, so the
 * two can never drift apart:
 *
 *   pay = price x given / priced
 *
 * `price` is what the role pays at the commitment it was priced at (`priced`),
 * and `given` is the share of the whole person the role gets. The commitment
 * is applied once, never twice ("no double cut", #1295).
 *   - The application: a role's listed band is the full role, priced at 100%,
 *     so a person choosing 50% sees band x 50 / 100.
 *   - The End of Moon: an agreement is priced at its own commitment, and a
 *     member's split gives it total x share / 100 of them, so a 50% agreement
 *     that the split gives 50% pays its terms, whatever else they hold.
 *
 * THE CAP: a role pays at most ROLE_PAY_CAP_PCT of its listed price at the
 * same commitment. $13,000 a month at 100% caps at $15,600; at 50%, the listed
 * $6,500 caps at $7,800. It bounds the applicant's price ask (the form and the
 * server) and the End of Moon split line, which a Treasurer still confirms.
 * It is role pay only: the no-caps ruling on other work pay is unchanged.
 *
 * Pure, and imports nothing: pay modules and display modules both read it.
 */

/** The most a role pays, as a percent of its listed price at the same commitment (Rye, 15 Nov 2026). */
export const ROLE_PAY_CAP_PCT = 120;

/** The pay for `givenPct` of a person, on a price set at `pricedPct`: exact, unrounded. 0 for anything unreadable. */
export function payForTime(price: number, givenPct: number, pricedPct: number): number {
  if (![price, givenPct, pricedPct].every(Number.isFinite) || price <= 0 || givenPct <= 0 || pricedPct <= 0) return 0;
  return (price * givenPct) / pricedPct;
}

/** The cap on a listed price: ROLE_PAY_CAP_PCT of it, exact, unrounded. */
export function capOf(listed: number, capPct: number = ROLE_PAY_CAP_PCT): number {
  return Number.isFinite(listed) && listed > 0 ? (listed * capPct) / 100 : 0;
}
