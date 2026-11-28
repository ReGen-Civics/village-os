# ADR: a circle's lead seat may read that circle's role measures

Date: 2026-11-27. Status: accepted. The lead's ruling, 27 Nov 2026.

## Context

How roles are going (`GET /api/role-measures`) counts, per season and circle,
the applications a circle's roles drew and how its holders fared: applied,
answered, first reply, first interview, decision, seated, path done, still in
the role, renewed. No name, no id of a person.

It was admin only. The lead, 27 Nov 2026:

> "Let's have these be admin for the whole village and circle leads for their
> circle and we can show fewer counts show all data we have If we have none
> say 'no data'"

"Circle leads for their circle" is a fact about a SEAT: who sits in the seat a
circle names as its lead (`circles.lead_role_id`). The one gate in
`shared/capabilities.ts` was built never to read the seat plane, and
`docs/ADR_2026-08_REPRESENTS_CIRCLE_DECLARES.md` records the first, narrow
exception. This is the second.

## Decision

`circlesLed` and `measuresScope` in `shared/roleMeasures.ts`, enforced by
`server/routes/roleMeasures.ts`, open the read to:

1. an admin (the house `isAdmin`): every circle, and the rows of roles in no
   circle;
2. **for their own circle only**: a member who sits now in that circle's lead
   seat. The seating is live and held as a member, its term not lapsed, not an
   example (`liveSeatIdsFor` over `listOrgAssignments(pool, lapseContext())`),
   and the seat is one the circle still keeps: active, not an example (the
   `keptSeat` rule in `server/lib/circleStanding.ts`).

Everybody else gets 403. `?circle=<id>` for a circle the reader does not lead
is 403. The scope is decided before the rate limit and before any read that
could fail, so a member who leads nothing only ever sees a refusal.

## Why this is safe to allow

- **It is a read, and an anonymous one.** The rows carry counts and medians,
  never a person (`MEASURE_KEYS`, held by a test). Nothing is written.
- **It grants no key.** No capability, no `capabilityCtx`, no other gate
  consults it.
- **It follows the seat's own lifecycle, more strictly than the 2026-08
  exception.** End the seating, let the term lapse, rest the seat or mark it
  an example, and the read closes. A lapsed holder keeps the pen in the
  2026-08 bridge; here they do not, because a read of other people's journeys
  should not outlive the mandate.
- **Naming the lead seat stays admin.** `lead_role_id` is set through the
  existing circle editor.

## Why not a capability instead

A global key (`measures.read`) would let one circle's lead read every circle,
which is not the ruling. Per-circle keys would copy the org chart into the
permission table, the drift the 2026-08 ADR already refused. The seat is the
source of truth for who leads a circle.

## What this is not

Not a precedent. Any future "holding seat X opens Y" gets its own ADR.

## Code

- `shared/roleMeasures.ts`: `circlesLed`, `measuresScope`, `rowsInScope`.
- `server/routes/roleMeasures.ts`: the route.
- `server/repos/roleMeasures.ts`: `circleLeadSeats`.
- `server/routes/roleMeasures.scope.test.ts`, `server/roleMeasures.db.test.ts`,
  `shared/roleMeasures.test.ts`: the rights matrix, rested and example seats
  included.
