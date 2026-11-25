# One review engine, two faces: the plan

Status: APPROVED by the lead on 25 Nov 2026 (decisions below). PHASE 2, building in the order below.
Written 23 Nov 2026 against `main` at `a87d30b`.

## What changed in revision 3

The lead asked for QA, red-team, design and UX passes, and for **two faces of one engine**:
`/admin/review` for the people who decide, and `/review` for the community. Four passes ran
independently against the code. What they changed, in short:

- **Two faces.** `/review` is kept, not retired. It is already in member nav and in steward
  notifications. It becomes the community face. `/admin/review` is the deciding face.
- **The inventory was far too small.** Revision 2 counted seven queues. The code holds at least
  thirty-five surfaces where something is filed, waits or is decided: ballots, change requests,
  role and open proposals, member suggest-to-edit, raised hands, role tensions, the "Waiting on
  you" board, the duties already on `/review` and more. All are placed below.
- **Ballots are a decision source.** A machine suggestion on a key that is under an open village
  vote is held. A steward's accept can never override a vote in progress.
- **The community face is its own projection**, built from an allowlist. It is never a filtered
  copy of the admin payload, which carries live values, quotes and pay.
- **Conflicts are one row the previous release cannot accept.** Revision 2's separate option rows
  would have let a rolled-back server accept both.
- **Fourteen red-team findings closed**, including forged provenance, borrowed credit, lookalike
  letters in keys, the `reconsider` bypass, flooding, prompt injection into agents, and erasure.
- **Fewer views.** Three tabs on the admin face, two on the community face. Conflict and stale are
  chips, not tabs.
- **Corrected facts.** Quest ideas from the public form already land in `quest_proposals`, so they
  are not a second adapter. `shared/proposalConflicts.ts` already flags conflicts and stale values.
  It informs and never blocks, so this plan **reverses that rule for conflicts**, which needs the
  lead's yes. The payout button for finished work is on `/review` today.

## The problem

The lead could not find B-71 because they looked on `/review` and it was on `/admin/proposals`.
Beneath that: suggestions, votes, consents and duties are spread across many pages. Streams can
contradict each other. A person can accept two incompatible changes one after the other. A change
discarded on Monday can come back on Tuesday.

## The shape: one engine, two faces

```
                         ┌────────────────────────── THE ENGINE ──────────────────────────┐
 Machine streams ───────►│ staging ─► normalize ─► check ─► group ─► order ─► validate ─► publish
 (Sera, connector,       │     │         held, with a reason ◄── any gate fails            │
  agents, approvals)     │     └── re-run on every new suggestion and every live change    │
                         │                                                                 │
 Human processes ───────►│ read as they are: ballots, change requests, role and open        │
 (votes, consents,       │ proposals, suggest-to-edit, tensions, raised hands. Never         │
  proposals, tensions)   │ re-filed; they HOLD any machine suggestion on the same key.       │
                         │                                                                 │
 Duties ────────────────►│ erasures owed, cancels, postings, stuck drafts: shown as they are │
                         └───────────────┬──────────────────────────────┬──────────────────┘
                                         │                              │
                         /admin/review: what I may decide   /review: what is open for my voice,
                         (capability, per item)             and what I filed (member projection)
```

**Machines feed the engine. People's own processes are read, never rewritten.** A member's vote,
consent, proposal or tension keeps its own page, route and rules. The engine reads those
processes to stay coherent, and both faces link to them.

## Every surface, and where it goes

Checked in the code. "Engine" means it flows through staging and the gates. "Read" means its
own flow is unchanged and the faces list it with a link. "Duty" means it is shown as it is today.

### Machine streams (through the engine)

| Surface | Where | Decider | Admin face | Community face |
|---|---|---|---|---|
| Sera and outside intake | `server/routes/review.ts:598,717`; `external_proposals` | `intake.moderate` | Waiting | Count only, never the subject (R38) |
| Sera differences | `server/routes/saberra.ts:465` | `intake.moderate` | Waiting | Sera member phase as today (`SeraMember.tsx`) |
| Connector batches (B-71) | `server/routes/proposedChanges.ts:182,567` | target route as the person | Waiting | none |
| One-tap approvals | `server/routes/approvalInbox.ts:151-278` | stored route as the person | Waiting | none |
| Agent role changes, letters | `server/routes/agentProposals.ts:95-243` | `org.seat`, or the letter's author | Waiting | none |
| Agent seatings | `agentProposals.ts:132`, approvals `seating` | `org.seat` | Waiting, arrival order, validate gate only | never |
| Quest proposals (Sera, companions' accepted ideas, the public form) | `quest_proposals`; `server/lib/publicForms.ts` | `quest.approve` | Waiting | "Yours" for the person who filed it |
| Assistant drafts and escalations | `server/index.ts:13403-13506`; Admin drafts | admin today | Waiting | none |
| Agenda proposals | `session_agenda` kind, and `add_agenda_item` (`server/lib/agentMcp.ts:533`) | the circle | Waiting | the circle's own session page |

`add_agenda_item` writes directly today, beside the `session_agenda` kind. Both go through
staging, so one item cannot arrive twice by two doors.

### Human processes (read, never re-filed)

| Surface | Where | Decider | Admin face | Community face |
|---|---|---|---|---|
| Ballots, objections, closes (mechanics, gps change, power, cycle settlement, org draft, admin edit, role application, mint, season place, closing policy) | `server/index.ts:22738-23150`; `/decisions` | the electorate | Open votes, read only | **Open for your voice**, linking to `/decisions` |
| Steward veto and no-objection windows | `server/routes/governanceVetoes.ts:171,276` | `steward.veto` | Waiting, with the window's close | the window and its close |
| Change requests | `server/routes/changeRequests.ts`; `/changes` | review, then a vote | Waiting (review step) | Yours; Open for your voice when voting |
| Mechanics proposals, support and sponsor | `server/index.ts:20257-20436` | ballot | read | Open for your voice |
| Member suggest-to-edit | `server/routes/adminSuggestions.ts:272-456`, `/mine` | the live holder; raised to a ballot after 14 days | Waiting | Yours |
| Role proposals and circle consent | `server/routes/roleProposals.ts:579,797,881` | the circle (2 business days) | read | Open for your voice (my circle); Yours |
| Open proposals from strangers | `server/repos/openProposals.ts`; `openProposalDecide.ts` | circle consent, `org.seat` adopts | Waiting (adopt) | the circle's consent; the stranger follows only by their emailed token |
| Agent role proposals | `server/lib/agentRoleProposals.ts:106` | the circle | read | Open for your voice (my circle) |
| Org drafts from player cards | `shared/playerCardProposals.ts`; `DecideDoors.tsx` | `org.decide`, or a ballot | Waiting | Open for your voice when put to the village |
| Sera member phase: publish, put to the village | `server/lib/orgDraftDecide.ts:219,287` | `org.decide`, or any member when the village holds the power | Waiting | Open for your voice |
| Canvas proposals | `server/routes/canvasFrames.ts:704,1031,1068` | `story.tell` | Waiting | Yours |
| Raised hands | `server/routes/powerHands.ts:421` | ballot | read | Open for your voice |
| Role tensions | `server/routes/roleTensions.ts:107,152` | the role's holder | read | **Waiting on you** (holder); Yours (raiser) |
| Done tasks to accept | `shared/waitingOnYou.ts` | `org.seat` | read | Waiting on you |
| Companion drafts | `server/routes/companions.ts:571` | **the member themself** | none | the member's own companions page |
| Feedback | `server/lib/feedback.ts:54,86` | admin today | Waiting (triage) | Yours |
| Contributor routes: partner, venture | Form Submissions; partner tagged `route: "partner"` (PR #1510) | `org.partnerships_role` | Waiting | Yours (only by the filer's own token or account) |

### Applications (never in the engine)

| Surface | Where | Rule |
|---|---|---|
| Seat applications and status by token | `server/routes/seatApplications.ts:797-1196`; `/application-status/:ref` | Never staged, merged, ordered, scored, counted or used as a lesson. The admin face links to the application's own page in arrival order. The community face never lists anyone's application; an applicant follows their own by token. |

### Duties already on `/review` (a home on the admin face, unchanged)

| Duty | Where | Note |
|---|---|---|
| Erasure retry | `Review.tsx:217`; the erasure queue | Needs a hand |
| Owed cancels | `OwedCancels.tsx:68` | Needs a hand |
| Owed postings, with its pay button | `OwedPostings.tsx:101,171` | **Moves value through its own route and gate (`quest.consent`), exactly as today.** It is the one value control on either face, and it stays where it is, untouched. |
| Stuck drafts, open drafts, withdraw | `server/routes/review.ts:695` | Needs a hand |
| Unattributed subjects, drop counts | `review.ts:673,680` | Needs a hand |
| Finished work to witness | `ConsentQueue.tsx:115` | Waiting, its own group |

### Value decisions that stay on their own pages

Moon recaps (`/treasury`, `moon.approve`, `cash.pay`), mint requests and planting co-signs
(`mintRequestVotes.ts`, `plantingRequests.ts`). The admin face shows a count and a door to
each, never the control.

### Doors that decide from outside the page

MCP `accept_proposals` (`server/lib/agentMcpProposals.ts:178`), lead-approved `admin_request`
writes (`agentLeadApproval.ts`), member suggest-to-edit accept, and canvas adopt all write keys
the engine watches. Each one calls `recordOutcome()` and honours the conflict rule. Otherwise
conflict and staleness detection go blind.

## The engine

### The suggestion contract (`shared/suggestions.ts`, pure)

```ts
export interface Suggestion {
  key: string;                       // "<stream>:<id>", internal only
  stream: StreamId;                  // set by the route it arrived on, never by the payload
  kind: string;
  code: string;                      // B-71.2: one scheme for every stream
  canonicalKey: string;              // see gate 1
  target: { label: string; ref: Record<string, unknown>; circleId: string | null };
  proposed: { summary: string; body: unknown };
  options?: Option[];                // a conflict card: every option, each credited
  live: unknown | null;              // read as the reader, and only for the admin face
  draft: unknown | null;
  credits: Credit[];                 // first filer first; later ones "also proposed by (role)"
  evidence: { level: "quoted" | "anchored" | "absent"; quote: string | null; sourceRef: string | null; occurredAt: string | null };
  facts: { reversible: boolean; touchesValue: boolean; touchesPeople: boolean; lapsesAt: string | null; underBallot: string | null };
  decideCapability: Capability;      // the ONE key that decides THIS item
  adminShortcut: boolean;            // true only on streams that let an admin through today
  state: "waiting" | "choose" | "stale" | "held" | "accepted" | "edited" | "discarded" | "lapsed";
  heldReason: HeldCode | null;       // a fixed code plus fields, never prose
  batch: { key: string; code: string; position: number; filer: string } | null;
  version: string;                   // hash of the card as shown; accept must carry it
  filedAt: string; receivedAt: string; decidedAt: string | null;
  actions: { accept?: Call; edit?: Call; discard?: Call; undo?: Call };   // the stream's own routes
}
```

`version` is what makes "accept what you saw" true: the server refuses an accept whose version
or `before_json` no longer matches.

### The gates

Every gate is a pure function in `shared/suggestionPipeline/`. The server half reads live state
and writes results.

**0. Intake to staging.** One adapter per stream. The stream and the proposer come from the
signed-in principal and the route the filing arrived on, **never from the payload**, so a
connector filing cannot claim to be Sera. A re-send of the same row is ignored
(`UNIQUE (stream, dedupe_key)`, both NOT NULL, with the key derived by the server from content
plus the filer's principal). Caps: a number of staged rows per filer per day, and a number of
open options per key. Anything over a cap is held, never dropped.

**1. Normalize to a canonical key.** One key per thing: `role:<id>:<field>`,
`page:<section>:<field>`, `setting:<key>`, `module:<id>:lifecycle`, `season:<id>:goals`,
`faq:<pathway>:<id>`, `agenda:<circle>:<title>`, and the `new:` forms for things that do not exist
yet. **The key is built from a confusable skeleton** (NFKC, then Unicode's UTS #39 skeleton), so
"Wаter Steward" with a Cyrillic а lands on the same key as "Water Steward". Names in mixed scripts
are held. The person's words in the body are never altered. `role:<id>:pay` and every other key
that names money has its own refusal: the never rule tests the key, not only the route path.

**2. Check.** Held with a fixed reason when:
- the value equals what is live (`already_live`);
- the target is gone (`target_gone`);
- the same key and value were discarded within `review.rediscard_days` (default 30)
  (`recently_discarded`). `reconsider: { code, reason }` does **not** bypass the window. It moves the
  item to Held, where a holder of the deciding capability may release it. There is a per-filer
  limit on reconsiders.
- **an open ballot, a frozen draft or a veto window covers the key** (`under_vote`). The vote
  decides, and a suggestion waits for it to close.
- a decision recorded against the key (an accepted change, a published draft, a closed ballot)
  came after the suggestion's **received time** (`decided_since`). The received time is the
  server's clock, never the filer's evidence time.

Decisions recorded only as meeting prose are shown beside the card and are never machine-judged.

**3. Group by key.**
- **Identical values merge** into one card. The first filer's why and evidence lead. Later filers
  show as "also proposed by (role)", and their text appears only when expanded, marked unverified.
  This is the only thing a machine merges.
- **Different values become one conflict card** with the options side by side. A person picks one,
  edits one, or discards all. The others are recorded as "another option was chosen".
- **This reverses today's rule** in `shared/proposalConflicts.ts` ("a flag informs, nothing blocks")
  for conflicts only. For stale values the flag stays, plus "see what is live now" before accept.
  The reversal needs the lead's yes.
- Seatings, applications and anything a person filed about themselves are never merged or grouped.

**4. Order.** Dependency rules as data: a circle before its roles, a role before its card or listing,
a module on before its settings, a season before its goals. **A batch never mixes filers or
streams.** A dependency on another filer's item shows as "waits on B-80.1" and is accepted on its
own, so nobody's change can ride in behind a trusted one. A cycle is held.

**5. Validate.** The target route's own validators (`checkProposal` and the validators streams
already run), the never rules, the evidence rule, and the voice and brand rules on copy. A broken
filing is refused whole at the door with a reason per item, as `propose_changes` does now.

**6. Publish.** Into `proposed_changes`, the one published stream:
- an ordinary card is a row with status `proposed`, as today;
- **a conflict card is one row with status `choose`**, holding every option in `options_json`;
- a stale card's status becomes `stale` until seen.

The previous release lists and accepts only `proposed`, `failed` and `unknown`
(`server/repos/proposedChanges.ts:215,272`). So during a rollback it neither shows nor accepts a
conflict or a stale card, and cannot accept both options. On roll-forward, rows filed during the
rollback are swept back through staging.

**7. Feed back.**
- Lessons by stream: `read_proposal_lessons` gains `stream` and answers as today without it. **A
  stream reads only its own items' lessons.** Another filer's text and a stranger's words never
  reach an agent tool, which closes prompt injection through lessons.
- Held reasons reach the filing stream as fixed codes plus fields, never prose.
- Sera: for Sera-origin items only, the state plus the change to Sera's own text. Never a steward's
  free text, never another stream's words, nothing about applicants. Behind a village variable
  that ships off. Each send is logged. On erasure, the matching Sera record is asked to forget.

**Re-run** on every filing, after every accepted change, after every ballot closes, and on a
scheduled check that compares each waiting card's `before_json` with live. The check works in a
bounded batch with a time budget, so it cannot become a denial of service. It only flags and
holds; it never decides.

### Who sees what: the security model

- **Per item, through the one gate.** Each item carries its `decideCapability`, and the read asks
  `mayStillSee` for it. No union of reader lists: a `story.tell` holder does not start reading
  Sera intake or quest pay.
- **The admin shortcut stays per stream**, only where it exists today (the readers of
  `proposedChanges.ts:133` and `approvalInbox.ts:79`). It is never extended to intake or quests,
  where `review.ts` deliberately asks `mayStillSee` only. Whether to remove those shortcuts is a
  separate decision.
- **An equivalence test**: for every capability and every stream, the new admin read returns
  exactly what the old pages return. It fails if anyone sees more.
- **Codes:** `?code=` and lookup by code run the per-item check and answer the same "not found"
  whether the code does not exist or the reader may not see it. The community face uses opaque
  ids, never B-codes.
- **Value and governance:** the engine holds no write path. Every accept runs the target's own
  route as the person. Nothing here calls `publishDraft`. Every route it reaches still refuses
  after launch where it refuses today (`readGameStart`). Quest pay is set only through the route
  `quest.approve` gates.

## The admin face: `/admin/review`

Open by capability, never by role. A steward who is not an admin reaches it. Nav shows
**"Decide suggestions"** only to people the server says may decide something.

```
Review                                   [ Find B-71 ............ ]
Waiting on the people who decide
7 waiting on you. 2 held.                                  (role="status")

[ Needs a hand: 1 erasure to retry · 2 postings owed ]     (only when not empty)

( Waiting )  ( Held 2 )  ( Decided )                       (links: ?view=)
```

- **Find**, always visible, takes B-71, B-71.2 or an old long id. `?code=B-71` opens the tab that
  holds it and says so: "B-71 was decided on 20 Nov. It is under Decided." No match: "No B-71 that
  you may see."
- **Waiting** (default): oldest first, and inside a batch in the order the items apply. Groups:
  *Suggestions* (connector, Sera, agents, approvals, quests, assistant drafts), *Finished work to
  witness*, *Your circle's and the village's open decisions* (veto windows, adopt, review steps).
  A person sees only the groups their keys open. Conflict and stale sit in place with a chip.
- **Held**: grouped by reason, each with what would release it and how long it has waited ("Waiting 6 days").
  Held items stay until a person clears them; nothing lapses silently.
- **Decided**: newest first. The numbers fold
  in here (accepted, edited, discarded, held and why, merged, conflicts won, time to decision,
  stale), per stream. Never a ranking of people.
- **Needs a hand**: erasures, cancels, postings, stuck and open drafts, drops. These are today's
  `Review.tsx` cards, reused.
- **Value pages**: a quiet line with counts and doors to moon recaps, mint requests and planting
  co-signs.

**A suggestion card:** the code in the corner, a one-line summary, "Lands on Roles", credits by
role ("Suggested by Sera and the connector"), the why and the quoted evidence, the word diff
(`client/src/components/proposals/Diff.tsx`), the chips, then **Accept**, **Edit words**, **Discard**.

**A conflict card:** "Now" at top, then the options as tiles, each credited and diffed against Now.
Radios in a fieldset, nothing preselected. **Accept this option** asks once: "Accept option 1.
Option 2 is recorded as another option chosen." **Discard all options.**

**A stale card:** Accept is replaced by **See what is live now**, which redraws the diff against the
new value and then enables Accept. That press is what "seen" means, and the server checks it
through `version`.

**Undo:** one phrase everywhere, **Propose putting it back**, which files a new proposal. The one-tap
approvals' direct "Put it back" is relabelled **Put it back now** so the difference is plain.

**States, kept apart per section:** loading ("Reading what is waiting."), failed ("This list did
not load. Suggestions may be waiting. Try again."), forbidden ("This page is for people who decide
suggestions. Yours are on Review." with a door), empty ("Nothing is waiting on you.").

## The community face: `/review`

Members only. Signed out, it shows the sign-in doors and one sentence, and lists nothing.
Strangers follow what they filed only by their emailed token, on the pages they have today.

**Built from its own projection**, a separate read with an allowlist of fields:
- proposers by role, or as "a member";
- no live values unless already public;
- no evidence quotes, no held reasons, no amounts, no counts or tallies about the reader;
- never seatings, applications, contributor submissions, observations, feedback from others, or
  finished work.

It is never the admin payload filtered.

```
Review
What is open for your voice, and what you sent

( Open for your voice 3 )  ( Yours )        [ Suggest something ]
```

- **Open for your voice** (default when it has items): votes waiting on you, consent rounds in your
  circle, veto and objection windows ("Closes 28 Nov"), raised hands, change requests in a vote.
  Each card says what it is, who decides (by role), how you take part, when it closes, and links to
  the page where you act. Nothing is decided on this face; it is an index of doors.
- **Waiting on you** sits inside it when you hold something: tensions raised with your role, done
  tasks to accept, adopts. This is `shared/waitingOnYou.ts`, unchanged.
- **Yours** (default when Open is empty): everything you filed, as three stones: **Sent**,
  **Being read**, **Decided**. Status words: "Accepted", "Accepted with changes", "Not taken up",
  "Joined with the same suggestion. Both of you are credited." When yours is in a conflict: "Another
  suggestion for the same thing is waiting. A person will choose." The other person's words are not
  shown.
- **Machine suggestions:** a count and who decides, never the subject (R38, as `SeraMember.tsx`).
- **For a decider:** a quiet door, "You also decide suggestions. Open Decide suggestions."
- **Desktop side rail:** "How a suggestion travels", in four short lines.

## Layouts

**Phone (390):** one column; tabs as a sticky row of 44px pills; filters behind one **Filter**
button that opens a sheet, active filters as removable chips; one card open at a time; the
unified word diff with a **Now / Suggested** toggle for long text, never two columns; conflict
options stacked as "Option 1 of 2"; card actions in `DecideDock`, which already steps aside for
the save bar; the find box with `autoCapitalize="characters"`.

**Desktop (1280):** a list of about 380px (code, summary, kind, arrival, chips) beside a detail
pane with Now and Suggested in two columns. A conflict shows Now plus up to three options as
columns, and stacks beyond that. Filters in a left rail. `j` and `k` move, Enter opens. There is
no single-key accept.

**Accessibility:**
- After an accept or discard, focus moves to the next card's heading, or to the outcome line when
  the list empties.
- One polite live region speaks a decision ("Accepted B-71.2. 6 waiting."). Polling never speaks.
- Hidden "Taken out:" and "Added:" text inside the diff.
- Every chip carries an icon and a word, never colour alone.
- The code chip grows to 44px. Escape cancels an ask-once.

**Language:** every string through Lingui with context and plurals, with Spanish in
the per-page Spanish catalogues that PR #1601 adds, once it lands (until then `client/src/locales/es.po`). Codes stay as they are. The Spanish pills are tested at 390.
Dates follow the reader's language (not the hardcoded `en-GB` in `SeraMember.tsx`).
`PageLanguageBar` sits on `/review`.

## Links that move

| Today | After |
|---|---|
| `/review` in member nav ("Review Queue", `client/src/config/nav.ts:229`) | stays `/review`, label **Review** |
| steward notifications to `/review` (`server/lib/workClaim.ts:85`, `server/routes/quests.ts:1242`, `server/routes/questClaims.ts:272`, `server/lib/proposalCompare.ts:161`) | new ones point at `/admin/review?view=waiting#witness`; old stored links land on `/review`, which shows the decider door |
| `/admin/proposals`, `#B-71` | `/admin/review`, `?code=B-71` |
| `/approvals` | `/admin/review` |
| `/review/structure/:batchId` | `/admin/review/structure/:batchId`, the old path kept as an alias |
| `reviewAt` (`proposedChanges.ts:240`), connector text (`agentMcpProposals.ts:47,207`), `pageTitles.ts:58-59`, `waitingOnYou.ts:151`, the text in `failedActions.ts:326-357`, `exit.ts:176`, `owedCancels.ts:190` | updated in the same pull request as the page |

## Module gating

Each section follows its module's lifecycle, including `public` where strangers may file: saberra,
propose-quest, governance, sessions, canvas, moon-review. A section whose module is off is absent,
never shown as empty. `server/routes/review.ts` mounts behind no module today
(`docs/modules/quests.md:140`), and the new routes keep that: the engine is core, its sections are not.

## Data: migration 0432, one file, expand only

Number 0432 is claimed in the ops ledger's section 3 by the coordinator (25 Nov 2026). 0424, claimed
first, was released when 0425 landed ahead of this lane, and stays a gap.

- **`suggestion_staging`**, new: id, stream, stream_ref, kind, canonical_key, body_ref or body_json,
  why, evidence_json, proposer_kind, proposer_principal, received_at, state, held_code,
  held_fields_json, published_change_id, dedupe_key. `UNIQUE (stream, dedupe_key)`, both NOT NULL.
  Indexed by state and by filer; what a row is about is kept as `keys_json` and compared in memory over the open set, which is how the engine stays one pure function. A contributor adapter stores a **reference** to the submission,
  never a copy of its text.
- **`suggestion_outcomes`**, new: `id` is the decision id (primary key). A non-unique index on
  `(stream, source_id)`, so a put-back or a reconsider of the same item records a second decision
  without colliding. It names the deciding capability, never the person, and holds no amounts.
- **Three nullable columns on `proposed_changes`**: `conflict_group`, `options_json`, `credits_json`,
  and a non-unique index on `conflict_group`. The new statuses `choose` and `stale` fit the
  existing `varchar(12)`.

Rules the repos follow:
- every NOT NULL column is written explicitly (the `dbCollection` DEFAULT trap);
- `recordOutcome()` runs after the target write and never throws, so a change that applied is
  never reported as failed;
- outcomes are backfilled from today's decided rows in TypeScript, with a WHERE on every write.

**Erasure.** `anonymizeMember` gains named steps, added to the resume list in
`server/lib/erasure.ts`. They blank the member's staged text, and blank `canonical_key` values built
from their words (a role name, a question, an agenda title). The proposer principal is held only
while needed for the per-filer caps and the same-submitter dedupe, and is blanked by erasure.

`review.rediscard_days` and the Sera feedback switch are village variables in
`shared/gameVariables.ts`, not schema.

## The golden set: the test of the engine

Scenes under `shared/suggestionPipeline/golden/`, from real past suggestions, redacted before
writing (roles not people, no applicant data, no amounts) and reviewed by a person before commit.
Each gives what is live, what was decided, which votes are open, and what the streams sent, then
states what the engine must produce. The named cases:

- two streams, same change: one card, first filer leads, both credited
- two streams, different changes: one `choose` row, never two acceptable rows
- the previous release's accept refuses a `choose` row and a `stale` row
- a lookalike-letter role name lands on the same key as the real one
- discarded last week, re-sent: held; with `reconsider`: held for release, not published
- a key under an open ballot: held until it closes; then re-run
- a forged `stream: "sera"` in a connector payload: credited to the connector
- create a role plus write its card, same filer: one batch, role first; different filers: two, the
  second "waits on"
- live moved after publish: `stale`; an accept carrying the old version is refused
- a seating beside another: never merged, never grouped, arrival order
- a stream's lessons never contain another filer's words
- every past accepted final still passes today's validators

Plus **the visibility equivalence test** (above), the **projection test** (the community payload
carries no field outside its allowlist), and a **quality ratchet** for prompts in this repository
(the connector's tool words and `KIND_WORDS`). Recorded outputs are scored against what people
decided, on a baseline that may only rise. A change to the prompt words fails until its outputs
are re-recorded by a person.

## Order of work

Small pull requests. Each visible step gets phone (390) and desktop (1280) screenshots for the
lead's yes before merge.

| # | Lane | Visible? |
|---|---|---|
| 1 | The pure engine: keys with confusable skeletons, gates 1 to 5, grouping, ordering, versions; the golden runner and first scenes | No |
| 2 | Migration 0432; staging and outcomes repos; `recordOutcome()` in every decide route and every outside door; erasure steps; backfill | No |
| 3 | The admin read: per-item capability, the equivalence test, code lookup with the same not-found | No |
| 4a | `/admin/review` in its smallest form: find box, the existing cards as they are under Waiting, Needs a hand; redirects from `/admin/proposals` and `/approvals`; link rewrites | **Yes** |
| 5 | The connector through staging; `choose` and `stale` statuses; held codes for agents | Small (chips) |
| 6 | The community projection and `/review`: Open for your voice, Yours, Waiting on you, the decider door | **Yes** |
| 7 | Sera intake, quest proposals and assistant drafts through staging; ballots read by gate 2 | No |
| 8 | Agent proposals, approvals and `add_agenda_item` through staging | No |
| 4b | The admin face's Held and Decided tabs, conflict and stale cards, the desktop two-pane | **Yes** |
| 9 | Outcomes back to streams; the Sera switch (off) | No |
| 10 | Numbers in Decided | **Yes** |
| 11 | The quality ratchet | No |
| 12+ | New streams: meeting transcripts, feedback triage, partner and venture forms (after PR #1510) | per stream |

Lane 4a fixes what the lead hit first: one page, and B-71 found by typing it.

## Invariants

- **One capability gate**, asked per item. Nobody sees more than today.
- **Nothing here moves value.** Every accept runs the target's own route as the person. The only
  value control on either face, the owed-postings pay button, keeps its own route and gate exactly as
  today. Moon recaps, mints and co-signs stay on their own pages.
- **AI never selects, ranks or judges applicants.** Applications never enter the engine. Seatings
  pass only the validate gate, appear in arrival order, and are never merged, scored, counted or
  used as lessons.
- **Machines merge only identical suggestions. People resolve every conflict. Votes are never
  overridden by a steward's accept.**
- **Roles, not people,** in everything stored and everything sent to Sera.
- **Copy:** voice and brand checks; Spanish for every string; the generated docs are never
  committed by a lane.

## Risks

1. **Reversing "a flag informs, nothing blocks" for conflicts** changes how people work today. It is
   the lead's call, and the plan needs their yes on it.
2. **Re-pointing live streams** changes what agents get back. Each stream moves in its own pull
   request and keeps its old answer (batch code, item codes), with held codes added.
3. **Held items are out of sight.** The held count sits in the header, and each item shows how long it
   has waited. Held items never lapse; a person clears them.
4. **The canonical-key vocabulary grows.** An unknown target is held as "no home for this kind yet".
   A test fails when a proposal kind has no key rule.
5. **The staleness check reads live state.** It runs in bounded batches with a time budget.
6. **`Review.tsx` is at 931 of its 1000-line cap.** Both faces are built as folders of small
   components; the cap is not raised.
7. **Bundles.** There are two lazy chunks, and `/review` never imports the editor or Sera's tools.
   All three budgets are read on the pull_request run.
8. **Golden scenes come from real data.** They are redacted and reviewed, or not used.
9. **Old stored notification links** land on the community face. The decider door covers them, and
   new links point at the admin face.

## Decisions (the lead, 25 Nov 2026)

Relayed by the coordinator, the lead accepting the coordinator's suggestions:

1. **Yes** to revision 3 and its order.
2. **Conflicts block**: one card, one accept. This reverses "a flag informs, nothing blocks" in
   `shared/proposalConflicts.ts` for conflicts; stale cards keep the flag plus "see what is live now".
3. **`/review` is for members only.** Votes carry names, and visitors now pass a gate. Signed out, the
   page shows the sign-in doors and lists nothing.
4. **The re-propose window is 30 days** (`review.rediscard_days`).
5. **Held items stay until a person clears them**, with their age showing. They never lapse silently.
6. **Agent-filed seatings show on the admin face**, in arrival order, and on the role's own page.
7. **Sera hearing back about outcomes ships off**, turned on per village after a security check.

## Build log

| Lane | Branch | State |
|---|---|---|
| 1, the pure engine and the golden set | `wt/review-engine` | merged, PR #1615 |
| 2a, migration 0432, the staging and outcomes repos, the erasure step | `wt/review-engine` | merged, PR #1617 |
| 2b, outcomes at the connector's doors (accept, discard, the full-access agent's), and the backfill of its past decisions | `wt/review-engine` | built |
| 2b, the other streams' doors | | each with the lane that moves its stream through staging (7, 8) |
