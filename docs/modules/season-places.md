# Module design: season-places

Provenance: platform

> Registry id `season-places`, named "Season places". The rules are `shared/seasonPlaces.ts` and
> `shared/circlePlaces.ts`; the orchestration is `server/lib/seasonPlaces.ts`; every statement is in
> `server/repos/seasonPlaces.ts` and `server/repos/circlePlaces.ts`; the routes are
> `server/routes/seasonPlaces.ts` and `server/routes/seasonPlaceGatherings.ts`; the schema is
> `drizzle/0404_season_places.sql`, `drizzle/0405_event_circle_places.sql` and `drizzle/0406_season_crew.sql`; season crew is `shared/seasonCrew.ts`, `server/lib/seasonCrew.ts`, `server/repos/seasonCrew.ts`, `server/routes/seasonCrew.ts`. Role prerequisites live beside it in
> the governance module: `shared/rolePrerequisites.ts`, `server/lib/rolePrerequisites.ts`,
> `server/routes/rolePrerequisites.ts`.

**Every season starts fresh: members apply, and each circle's picker chooses that season's crew from everyone who
applied. Circles propose to take part, a season can hold a set number of places with a waitlist in order and a
notice the moment a place opens, and each gathering can take circles up to a cap its host sets.**

## Status

Ships OFF, like every non-core module. Requires `governance` (proposals are decided on its road). Recommends
`events` (circle places at gatherings) and `commerce` (a role prerequisite can be a paid product).

## The dials

Every number is a game variable: every member sees it, anyone may propose a change, and it moves by a holder of
`dial.set` or a village vote at its tier.

| Dial | Meaning | Default |
|---|---|---|
| `season_places.who` | what takes part each season: `circle` or `member` (structural) | `circle` |
| `season_places.free_after` | seasons of holding a place after which no proposal is needed; blank means every season needs one; 0 means none ever does (structural) | blank |
| `season_places.cap` | places in one season; blank is no cap; 0 is no places | blank |
| `season_crew.picker_role` | the role, in each circle, whose live holder picks its crew; blank means the circle's crew picks (structural) | blank |
| `season_crew.needs_place` | a circle picks a crew only while it holds a place in the season (structural) | off |
| `roles.prerequisites` | what each role asks for before anyone applies (governance module, structural, longtext with a checked grammar) | blank |

## The season's crew

Every season starts fresh, and nothing here reads an earlier season.

1. A member applies for the season running now or the next one (`POST /api/season-places/crew/apply`), naming the
   circle they would like to sail with, or none, with up to 600 characters of words. That circle's pickers hear it.
2. Each circle's **picker** is a live holder of the role `season_crew.picker_role` names in that circle. With the
   dial blank, or no live holder of that role, every live role holder in the circle picks, so no circle is left
   unable to pick.
3. A picker picks from **everyone who applied**, whichever circle they named, up to the circle's berths for the
   season (`PUT /api/season-places/crew/circles/:circleId/berths`; blank is no limit). The pick takes the season's
   lock row, so two circles cannot pick one person and a circle cannot pick past its berths. The person is told
   "You're crew this season!"
4. A picker can release a person back to the pool; the person can withdraw.
5. With `season_crew.needs_place` on, a circle picks only while it holds a place in that season, so the season's
   cap on places caps how many circles sail.
6. Everyone sees each circle, who picks for it, its berths and the counts. The pool with names and words is for
   pickers; an applicant sees their own.

The same picker decides which gatherings the circle signs up for.

## Taking part in a season (circles)

A circle's crew is derived, as the org chart derives a circle's people: every live member holder of an active role
whose circle it is. A lapsed seating, a documented holder and a seated agent are not crew.

1. A crew member proposes the circle for the season running now or the next one queued, with up to 600
   characters of words (`POST /api/season-places`).
2. **Seasons served** are the earlier seasons in which the circle held a place, the one running now included. A
   season the calendar no longer lists still counts.
3. **The served road.** Served at least `free_after`: the circle takes a place at once, or the waitlist.
4. **The proposal road.** It waits on a live holder of `org.seat` (the member door for roles' own power) who
   holds no role in the circle; they adopt, decline, or put it to the village. Where the village holds `org.seat`,
   or nobody outside the circle holds it live, a `season_place` ballot opens at once, and a proposal left waiting
   after its holders leave can be put to the village by the crew. Nobody decides their own circle's proposal.
5. A carried vote places the circle when it lands; a no declines it, and the crew is told.

### The cap and the waitlist

Every write that can change how many places are taken locks the season's row in `season_place_locks` first, so
two adoptions at the same moment cannot both take the last place. Over the cap an eligible circle waits in the
order it became eligible. When a place frees (a withdrawal, or the cap raised by vote) the first in line takes it
under the same lock and its crew is told "A place opened. {Circle} takes part in {Season}." An hourly job
(`season-places-fill`) fills places a raised cap opened. Lowering the cap removes nobody; the page says how many
places are held over it.

## Circles at a gathering

A holder of `event.manage` (the power that already sets a gathering's person capacity) turns on "takes circles"
for a one-off gathering, sets a circle cap (blank is no cap) and whether a circle needs a place in the season the
gathering starts in (default yes). The circle's picker for the season signs it up; over the cap it waits in order, and a
circle leaving lets the next one in, with a notice to its crew. The events row is locked first, the same lock and
order an RSVP takes. People still answer the gathering as people; this is a second count, never instead.

## Role prerequisites

`roles.prerequisites` is one entry per role, joined by `;`: `role-id = product:product-id, quest:quest-id`. The
member door for roles refuses with each missing item in plain words until the applicant holds a `paid` purchase of
each product (a reversed one does not count) and a `consented` claim on each quest.
`GET /api/governance/role-prerequisites` tells a member what each role asks and what they have. A value that does
not parse is refused at every write door; one that somehow got stored fails closed for the roles it seems to name.
No new payment path: products are sold on the Contribute page through the Payments module.

## Powers

No new capability. Proposals follow `org.seat`; gathering settings follow `event.manage`; dials follow
`dial.set` or the village vote.

## Setup

Date the village's seasons (Admin, Season), then set the cap and `free_after` on the module card. Nothing else.

## Privacy and erasure

A row names a circle (or a member under `who = member`), the season and the words the crew wrote; a crew
application names the member, the circle they want and what they wrote. Notices and
ballot titles name the circle and the season, never a person. When a member leaves, their words come off every
proposal they wrote, their own member-subject rows go, and their name comes off every gathering answer they gave
for a circle, their crew applications go and their name comes off every pick they made
(`season-places-after-tombstone` in `server/lib/erasure.ts`). A circle keeps its place.

## Screens

None in this module yet. The members' screens (the season application and the pick, the fleet view, a role's
path of prerequisites) are built to the village's onboarding designs in a later slice, from the routes above.

## Turning it off

Off hides every surface. Places, the waitlist and gathering settings stay in their tables and return when it is
turned on. Role prerequisites keep working with governance on, since they are a governance dial.
