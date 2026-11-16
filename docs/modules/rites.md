# Module design: rites

Provenance: platform

> Registry id `rites`. The contract is `shared/rites.ts` (the `village-rites/1` document, the ceremony steps, who
> may witness, the mark, the ring's order, the door code). Routes in `server/routes/rites.ts`; every statement in
> `server/repos/rites.ts`; the schema in `drizzle/0393_rites_and_invitations.sql`. The printed code is drawn by
> `shared/qr.ts`. The join-request answers are shared with the admin desk through `joinAnswerDoor` in
> `server/routes/joinAnswers.ts`.

**A newcomer goes from an invitation to a member through rites the village names. Each rite waits on the member's
card until somebody already in witnesses it. A spoken rite is held as a ceremony: the newcomer speaks each line
from their own phone, draws their mark, and witnesses confirm on theirs, in person or on a live call. One rite may
admit the member. Every newcomer walks beside a member (the village names this person), the one who invited them
first. An invitation carries its maker's own line, and each member can print a lasting code that asks to join
through them.**

## Status

Ships OFF, like every non-core module. An admin turns it on to `public` when the welcome, the invitation letter
and the door code should reach people with no account, or to `members` for the card and ceremonies alone. Held in
`scripts/enable-all-modules.mjs` until the Module Library Contract clause 13 review.

## Setup

One document in the module card, `village-rites/1`:

- `rites`: up to 12, in the order the card shows them. Each has `id`, `todo` (the rite as a task), `done` (the
  rite done), `witnesses` (1 to 5), optional `lines` (spoken one at a time) and `gatheringLines` with a
  `gatheringAnswer` (used when the ceremony is held at a gathering), `mark` (the newcomer draws their mark),
  `admits` (at most one rite), `together` (rites stamped in the same moment), `callCounts` (a witness on a live
  video call counts; default yes), `ink` (`seal` or `alt`), `place` (`phone`, `site`, `gathering`), `byModule` (the
  module that stamps it when the thing itself happens; nobody stamps it by hand) and `pulse` (said on the public
  pulse when stamped; default yes).
- `words`: every line these screens show, each with a limit; blank keeps the platform's neutral words.
- `welcome`, `articles`, `letter`, `door`: the public welcome page, the excerpt of the village's agreement, the
  invitation letter and the door page, with photos as uploaded files or https addresses.
- `counts`: up to three of `sworn`, `circles`, `quests`, each with a label. Numbers only, never a place.
- `tokens`: the slug of the token the card shows first and of the village's voting token.
- `look`: colours (hex) and font families for the screens' scope. The faces themselves are uploaded as brand fonts.

A village that admits only by its rite sets `membership.vouches_required` to 0, so an invitation brings a newcomer
in and the rite admits them.

## Rules

- **Witnessed, never ticked.** A rite with lines, a mark or more than one witness is stamped only by a ceremony;
  any other by one witness's tap. Nobody witnesses their own rite (`refuseWitness`).
- **Who witnesses.** A member who holds the admitting rite. While nobody does, any admitted member, so the first
  two members can witness each other.
- **The ceremony.** Lines are copied in when it opens. Only the newcomer marks a line spoken, in order. A witness
  confirms only after every line is spoken and the mark is made. The confirmation that reaches the count closes
  the ceremony under its row lock, stamps the rite and its together rites once, fixes the mark, and, for the
  admitting rite, admits the member (`membershipGranted`, the `member_admitted` mail event). The pulse records the
  first name and the rite's done words.
- **A rite another module stamps.** `byModule` rites are refused at the stamp and ceremony doors; that module calls
  `stampRiteFromModule(moduleId, userId, riteId)` (server/routes/rites.ts) when the thing really happens.
- **The mark is fixed** the moment the witnesses are to confirm it: drawn after the last line, or the last line
  spoken over a mark already drawn.
- **The ring.** Every member holding the marked rite, in an order set by a hash of the village's name and the
  member's id: the same for everyone, led by nobody.
- **The buddy.** A newcomer who arrived on a link from a member who may witness is paired with them the first time
  their card is read. Any member who may witness pairs or re-pairs. Only the buddy writes the greeting, and only the
  buddy reads the newcomer's own line.
- **The door code.** Ten characters with no look-alikes, made for a member who holds `member.vouch`, lasting until
  they replace it. A request made at it is a `membership-request` in the village's intake naming the member; the
  member, or the intake desk, answers it with the same yes and no the desk gives. The invitation is the answerer's.
- **The letter.** Only the maker of an open invitation writes its line. A stranger holding the link reads the
  maker's first name, the line, the village's letter words and the counts, under the same rate limit as
  `/api/invites/check`.

## Privacy

Stamps, marks, pairings, a newcomer's line and names at an interest-only door name people (`member-pii`). Public
routes answer only the village's own words, a first name and counts. Erasure (`rites-after-tombstone`) deletes the
member's stamps, mark, ceremonies, pairings, line, door codes and invitation lines; a stamp they witnessed for
somebody else stays with no name on it.

## Routes

Public while the module is public: `GET /api/rites/public`, `GET /api/rites/letter?token=`, `GET /api/rites/door/:code`,
`POST /api/rites/door/:code/request`, `POST /api/rites/interest`. Signed in: `GET /api/rites/me`, `POST /api/rites/aboard`,
`GET /api/rites/record`, `GET /api/rites/crew`, `POST /api/rites/mark`, `GET /api/rites/ring`, the ceremony routes under
`/api/rites/ceremonies`, `POST /api/rites/stamps`, `GET /api/rites/newcomers`, `POST /api/rites/buddies`,
`PUT /api/rites/buddies/:newcomerId/greeting`, `GET /api/rites/door`, `POST /api/rites/door/replace`,
`GET /api/rites/door-requests` with `accept` and `decline`, `PUT /api/rites/letters/:inviteId`, `GET /api/rites/letters`.
Admin: `GET /api/rites/interest`.
