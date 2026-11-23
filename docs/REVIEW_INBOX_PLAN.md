# One review page, fed by one coherent stream: the plan

Status: PHASE 1, SCOPE, revision 2. Nothing is built. Waiting on the lead's yes.
Written 23 Nov 2026 against `main` at `a87d30b`.

Revision 2 follows the lead's first answers, relayed by the coordinator the same day:

1. The page lives under admin at `/admin/review`. `/review` is retired and old links redirect.
2. "Its own CI" means a continuous-integration process for the **streams themselves**, upstream
   of the page. Suggestions from Sera, agents and every other stream land in staging first and
   are integrated into one coherent stream before anything reaches the page, so streams never
   contradict or duplicate each other. Machines merge identical suggestions; only people
   resolve conflicts. The golden set stays as the test of this pipeline.

Revision 1 treated the page as a read model over seven separate queues. That is replaced: the
streams now converge **before** the page, and the page reads one stream.

## The problem, in one sentence and then in full

The lead could not find B-71 because they looked on `/review` and it was on `/admin/proposals`.

Checked in the code, there are **seven queues on three pages, read by five capability sets**:

| # | Stream | Table | Page today | Who may decide |
|---|---|---|---|---|
| 1 | Sera and outside intake (org, role, circle, task, event, risk, tension, commitment) | `external_proposals` (0140) | `/review` | `intake.moderate`, into an org draft, never a seat |
| 2 | Quest proposals, including the companions' quest ideas | `quest_proposals` (0141) | `/review` | `quest.approve` (sets the pay) |
| 3 | Member-finished work waiting for a witness | quest claims | `/review` | `quest.consent`, through the consent route |
| 4 | Sera's differences (Sera's memory against what the village holds) | Saberra | `/review` | `intake.moderate` |
| 5 | Agent role changes, seatings, letters | `agent_proposals` (0368) | `/review` | `org.seat`, or a letter's author |
| 6 | Connector batches (`propose_changes`, where B-71 lives) | `proposed_change_batches`, `proposed_changes` (0379, 0400, 0416) | `/admin/proposals` | the target route's own gate, run as the person |
| 7 | One-tap approvals (setting, listing, page copy, map publish, seating), lapse after 7 days | `agent_proposals` | `/approvals` | the stored call's own route, run as the person |

Today each stream files straight into its own queue. Nothing stops Sera proposing one wording for
a role card while the connector proposes another, and a person can accept both, one after the
other, with the second silently overwriting the first. Nothing stops a change discarded on
Monday coming back on Tuesday. That is the gap the pipeline closes.

What already exists and is reused, not rebuilt:

- **Nothing decides itself.** Streams 6 and 7 apply through the target's own route as the person
  deciding; streams 1 and 2 call the creation function the admin form calls.
- **Validation at filing**, refused whole with a reason per item (`checkProposal` in
  `server/lib/proposedChanges.ts`).
- **Dedupe keys** (`dedupe_key`, `identity_key`, NOT NULL) in `external_proposals`.
- **What was live when proposed** (`proposed_changes.before_json`, 0400): the anchor for
  catching a stale suggestion.
- **Lessons** (`proposed_changes.lessons_json`, `read_proposal_lessons`).
- **Codes** (B-71, B-71.2; 0416).

## The shape: streams, then staging, then gates, then the page

```
 Sera intake ─┐
 Connector ───┤                ┌─ 1 normalize ─ 2 check ─ 3 group ─ 4 order ─ 5 validate ─┐
 Agents ──────┼─► STAGING ────►│                                                          ├─► PUBLISHED ─► /admin/review
 Companions ──┤   (every       └──────────── held, with its reason ◄─ any gate fails ─────┘   (one stream)       │
 Quest ideas ─┤    suggestion                                                                                  │
 Later ones ──┘    lands here)       re-run on every new suggestion and on every live change                   │
        ▲                                                                                                      │
        └──────────────────────────── 7 outcomes fed back to every stream (lessons, Sera memory) ◄─────────────┘
```

**Decision: one staging table in front, and the existing `proposed_changes` table as the one
published stream.** It already has batches, order, codes, live-beside-proposed, edit in place,
accept through the target's own route, put-back and lessons. Streams that file elsewhere today
are re-pointed to staging one at a time, and their old tables stop receiving new rows (they
are read, never dropped).

## The pipeline, gate by gate

Every gate is a pure function in `shared/suggestionPipeline/` (no database, no Express), so the
golden set can run the whole pipeline in a test. The server half reads live state and writes
the results.

### 0. Intake to staging

Each stream has an **adapter** that turns its native payload into one staged row: stream, its
own reference, kind, proposed body, why, evidence (quote, source, time), proposer (agent,
person, integration, member; named by role). A re-send of the same row is a no-op
(`UNIQUE (stream, dedupe_key)`, NOT NULL). Nothing is visible to anyone yet.

### 1. Normalize to a canonical target key

One key per thing a suggestion can change, so two streams talking about the same thing land on
the same key:

| Target | Canonical key |
|---|---|
| a role card field | `role:<roleId>:<field>` (one key per field, so a change to the purpose and a change to the pay are separate) |
| a new role | `role:new:<circleId>:<normalized name>` |
| a page section | `page:<section>:<field>` |
| a setting or variable | `setting:<key>` |
| a module | `module:<id>:lifecycle`, `module:<id>:config:<field>` |
| a season's goals | `season:<id>:goals` (the list is one thing) |
| an FAQ | `faq:<pathway>:<id>`, `faq:<pathway>:new:<normalized question>` |
| a quest | `quest:new:<normalized title>` |
| an agenda item | `agenda:<circleId>:<normalized title>` |
| an observation (risk, tension, commitment) | `observe:<kind>:<source ref>` |

A suggestion touching several fields is split into one item per key and kept together as one
group, so a partial conflict does not block the rest. "Normalized" means whitespace and Unicode
form only; case and wording are kept, because a person's words are the content.

### 2. Check against live state, recent outcomes and recorded decisions

Held, with the reason shown, when any of these is true:

- **No change:** the proposed value equals what is live now.
- **Target gone:** the role, page, setting or module no longer exists.
- **Recently discarded:** the same key and the same value were discarded within the window
  (`review.rediscard_days`, a new variable, default 30), unless the suggestion carries
  `reconsider: { code, reason }` naming the discarded change and saying what is new. The reason
  is shown on the card.
- **Against a recorded decision:** a decision recorded against this canonical key (an accepted
  change, a published draft, a ballot that set it) after the suggestion's own evidence time. The
  card cites the decision. Decisions recorded only as prose in a meeting log are shown as context
  beside the card and are **never** machine-judged: a machine does not decide what a person meant.

### 3. Group by target: merge what agrees, one conflict card for what does not

For each canonical key with more than one open suggestion:

- **Identical values merge** into one card that credits every stream and every proposer, with
  each one's why and evidence. This is the only thing a machine merges.
- **Different values become ONE conflict card** showing every option side by side with the live
  value, each option credited. A person picks one option, or edits one, or discards all. Picking
  one records the others as "another option was chosen". The server refuses a second accept in
  the same conflict group, so two cards that could both be accepted cannot exist.
- A new suggestion on a key that already has a **published, waiting** card joins that card (as a
  merge or as a new option), so the page never shows two cards for one thing.

Seatings and anything tied to an application are the exception: they are never merged, never
grouped into a conflict, never ordered by anything but arrival. AI never selects, ranks or
judges applicants.

### 4. Order dependencies into batches

Rules per kind, written as data: a circle before a role in it; a role before its card, listing or
terms; a module turned on before its settings; a season before its goals; a page section's
existence before its fields. Within a batch the items run in that order, which is the order
`POST /api/admin/proposals/accept` already applies them. A suggestion whose dependency is held is
held too ("waits on B-80.1"). A cycle is held whole with both codes named.

### 5. Validate with the route validators and house rules

The target route's own validator (`checkProposal`, and the validators streams 1, 2 and 7 already
run), the never rules (`NEVER_PROPOSED`: money, secrets, erasure, powers, seating by a machine
where refused today), the evidence rule (a member-facing claim needs a quote and an anchor), and
the voice and brand rules on any copy. A filing that fails validation is **refused whole at the
door with a reason per item**, as `propose_changes` does today, so the filing agent learns at once.
Gates 2 to 4 hold rather than refuse, because their answer can change.

### 6. Publish

Passing items become `proposed_changes` rows in batches, with codes, credits, the live value at
publish time (`before_json`) and, for a conflict, a `conflict_group`. The page shows them.

### 7. Feed outcomes back to every stream

Every decision writes one row to `suggestion_outcomes` and goes back to the streams:

- **Lessons for every stream:** `read_proposal_lessons` gains an optional `stream` and answers as
  today without one. What people changed, discarded (with the reason), or chose over another
  option is the lesson.
- **Sera memory:** the outcome of each Sera suggestion goes back through Sera's existing
  integration, content only, roles not people, nothing about applicants.
- **The held reasons** are readable by the stream that filed (`read_proposal_queue` gains held
  items with their reason), so an agent stops re-sending what was held.

### Re-run: on every new suggestion and every live change

- **On filing:** the pipeline runs for the keys the new suggestion touches.
- **On a live change:** after any accepted change, and on a scheduler job (`registerJob`) that
  compares each waiting card's `before_json` with what is live now. A card whose live value moved
  goes back through the gates and is marked **stale** ("live changed since this was proposed")
  with the new live value shown. A stale card cannot be accepted until a person has seen the new
  value. The job only flags and holds; it never decides, merges a conflict or applies anything.

## The page: `/admin/review`

**One page, capability-gated, never admin-gated.** The page asks the one gate
(`shared/capabilities.ts`, through the same `mayStillSee` and `liveHoldersOf` the routes use) and
shows each person what they may decide. A steward who is not an admin reaches it, as on `/review`
today. `/admin/proposals` already works this way in the browser.

| Old link | Goes to |
|---|---|
| `/review` | `/admin/review` |
| `/admin/proposals`, `/admin/proposals#B-71` | `/admin/review`, `?code=B-71` opens it |
| `/approvals` | `/admin/review?stream=approval` |
| `/review/structure/:batchId` | unchanged (a structure draft is its own page) |

Views on the page:

- **Waiting:** batches in the order they must be approved, each card with live beside proposed,
  its credits, edit in place, accept, discard.
- **Conflicts:** the one-card-many-options view, side by side.
- **Held:** everything a gate stopped, with its reason and what would release it.
- **Finished work:** quest claims waiting for a witness. These are a member's own act, not a
  stream's suggestion, so they do **not** pass through the pipeline; the witness decides through
  the existing consent route and its own gate. Value moves there, never here.
- **Decided:** the record, with the numbers (below).

Filters on every view: stream, kind, circle, urgency (facts only: lapsing soon, stale, a witness
waiting, a veto window closing). The search box takes a code.

## The golden set: the test of this pipeline

Because every gate is pure, the golden set runs the **whole pipeline** in CI with no model and no
secret.

Each fixture under `shared/suggestionPipeline/golden/` is a small scene:

```json
{ "name": "sera-and-connector-word-the-same-role-differently",
  "live": { "role:r-water:purpose": "..." },
  "outcomes": [ ],
  "streams": [ { "stream": "intake", ... }, { "stream": "connector", ... } ],
  "expect": { "conflicts": [ { "key": "role:r-water:purpose", "options": 2 } ], "held": [], "published": 1 } }
```

Built from real past suggestions by a script that **redacts before writing** (people become roles,
no applicant data, no amounts), each reviewed by a person before commit. The named cases CI runs:

- two streams, same change: one card, both credited
- two streams, different changes: one conflict card, never two
- discarded last week, re-sent without a reason: held; with `reconsider`: published, reason shown
- equals live: held as "no change"
- create role plus write its card in one go: one batch, role first
- live moved after publish: stale, not acceptable until seen
- a seating suggestion beside another: never merged, never ordered beyond arrival
- validator replay: every past accepted final still passes today's validators

Plus a **quality ratchet** for prompts that live in this repository (the connector's tool words in
`server/lib/agentMcpProposals.ts` and `KIND_WORDS`, the companions): recorded outputs scored
against what people decided (share accepted unedited, edit distance, zero rule failures), held to
a baseline that may only rise. A change to the prompt words fails until its outputs are
re-recorded by a person (`pnpm suggestions:record`, never in CI). CI cannot call a model, so it
checks what the model produced against what people decided.

## Numbers on the page

Per stream and kind, from `suggestion_outcomes`: accepted, edited, discarded, held and why, merged,
conflicts and which option won, median time to decision, how many went stale. Plain numbers for
whoever decides that stream, never a ranking of people.

## Migration: 0424, one file, expand only

Number 0424, claimed in the ops ledger's section 3 by the coordinator on 23 Nov 2026. Confirm with
`check-migration-numbers --next` before creating the file.

`0424_suggestions_meet_before_a_person_sees_them.sql`, three parts:

- **`suggestion_staging`**, a new table: id, stream, stream_ref, kind, canonical_key, body_json,
  why, evidence_json, proposer_kind, proposer_role, received_at, state
  (`staged | held | published | merged | dropped`), held_reason, held_code, published_change_id,
  dedupe_key. `UNIQUE (stream, dedupe_key)` with both NOT NULL; an index on
  `(canonical_key, state)`.
- **`suggestion_outcomes`**, a new table: one row per decision, naming the deciding capability,
  never the person, so erasure has nothing to find. `UNIQUE (source, source_id)`, both NOT NULL.
- **Two nullable columns on `proposed_changes`:** `conflict_group varchar(40) NULL` and
  `credits_json mediumtext NULL`, plus a non-unique index on `conflict_group`. Nullable, so the
  previous release's inserts leave them NULL and its reads ignore them.

Every NOT NULL column that a `dbCollection` write might leave unset is written explicitly by the
repo (the house trap: a DEFAULT never applies to those writes), and
`check-repo-payloads.mjs` holds it. Backfill of outcomes from today's decided rows runs in
TypeScript with a WHERE on every write, as `ensureCodes` does for 0416. A new variable,
`review.rediscard_days`, goes in `shared/gameVariables.ts` (plane 1), not in the schema.

## Order of work

Small pull requests. Nothing visible until lane 5.

| # | Lane | Visible? | Contended files |
|---|---|---|---|
| 1 | The pure pipeline: canonical keys, gates 1 to 5, grouping, conflicts, ordering, and the golden-set runner with the first scenes | No | none |
| 2 | Migration 0424, the staging and outcomes repos, `recordOutcome()` in each decide route, backfill | No | migration 0424 |
| 3 | Re-point the connector's `propose_changes` through staging (the closest shape); held items in `read_proposal_queue`; one accept per conflict group | No (agents see held reasons) | `server/index.ts` if a route is registered |
| 4 | `/admin/review`: Waiting, Conflicts, Held, Finished work, Decided; code search; redirects from `/review`, `/admin/proposals`, `/approvals` | **Yes**, screenshots at 390 and 1280 first | `client/src/App.tsx` |
| 5 | Re-point Sera intake and quest proposals through staging | No | none |
| 6 | Re-point agent proposals and one-tap approvals through staging | No | none |
| 7 | The staleness job and the re-run on live change | Small (stale badge), screenshots first | none |
| 8 | Outcomes back to every stream: lessons by stream, Sera memory, held reasons | No | none |
| 9 | Numbers on the page | **Yes**, screenshots first | none |
| 10 | The quality ratchet and the prompt-hash test | No | a new ratchet baseline (claim in section 27) |
| 11+ | New streams (meeting transcripts filling session forms, the feedback relay, the four contributor routes, the companions), one adapter each | per stream | none |

Lane 1 is pure code and the golden set, and it proves the design before any table or page exists.
Lane 4 relieves the lead's actual problem: one page, and B-71 found by typing it.

## How the next streams fit

Each is an adapter into staging and its golden scenes; none changes the pipeline or the page.

| Next stream | Canonical keys it writes |
|---|---|
| Meeting transcripts filling session forms | `agenda:<circle>:...`, task keys; the evidence quote is the transcript line |
| Feedback relay | `observe:feedback:<id>`: triage, accept means taken up. Local only; the hub relay is unchanged |
| Four contributor routes (partner, venture, quest, role) | `quest:new:...`, `role:new:...`, and the venture and partner keys `wt/ventures-pitch` defines; its storage and inbox tag are read, never duplicated |
| AI companions | whatever they suggest, credited to the companion by role |
| New Sera kinds | one line on its allowlist and a canonical-key rule |

## Invariants, and how this keeps them

- **One capability gate.** The page and each card ask `shared/capabilities.ts`. The page never
  shows a person more than today's pages do. Where today's readers let an admin through first
  (`isAdmin(req)` in the readers of `proposedChanges.ts` and `approvalInbox.ts`), the new page
  copies that exactly, so no one's access changes; whether those shortcuts should go is a
  separate decision.
- **Nothing here moves value.** Every accept still runs the target's own route as the person.
  Finished work keeps its own consent route. The outcome log holds no amounts.
- **AI never selects, ranks or judges applicants.** Seatings and anything with an application
  pass only the validate gate, are shown in arrival order, are never merged, grouped, ordered by
  merit, scored, or used as lessons.
- **Machines merge identical suggestions only; only people resolve conflicts.** A conflict card
  is decided by a person. Prose decisions are shown, never machine-judged.
- **Roles, not people,** in staging, outcomes, fixtures and lessons.
- **Copy rules:** voice and brand checks, Spanish in `client/src/locales/es.po`.
- **Generated docs are never committed by a lane.**

## Risks

1. **Re-pointing a live stream changes what agents get back.** Each stream moves in its own pull
   request, its old filing answer kept (batch code, item codes), with held reasons added beside it.
2. **A held suggestion is out of sight.** The Held view shows the count on the page header, and
   held items lapse after the same seven days the approval inbox uses, with the reason kept.
3. **Canonical keys are a vocabulary that grows.** An unknown target is held as "no key for this
   yet", never silently published, and a test fails when a proposal kind has no key rule.
4. **Staleness checks read live state for every waiting card.** The job runs at a modest interval
   and per key on accept; waiting cards number in the hundreds at most.
5. **`Review.tsx` is at 931 of its 1000-line cap.** The new page is built as a folder of small
   components; the cap is not raised.
6. **Bundle budgets.** The page stays a lazy route; read all three budgets on the pull_request run.
7. **Golden fixtures come from real data.** Redacted before writing, reviewed before commit, or not
   used.
8. **Shared storage with `wt/ventures-pitch`.** The contributor adapter waits for that lane.

## Decisions still with the lead

The coordinator is talking these through with the lead now.

1. Yes to the revised plan and its order.
2. `/admin/review` as the address, with `/admin/proposals` redirecting (assumed here), or keep
   `/admin/proposals` as the address.
3. The re-propose window: 30 days by default, a village variable.
4. Agent-filed seatings: on this page (arrival order, no score, validate gate only), or only on the
   role's own page.
5. Held items lapse after 7 days like approvals, or stay until a person clears them.
