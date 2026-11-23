# One review inbox: the plan

Status: PHASE 1, SCOPE. Nothing here is built. Waiting on the lead's yes.
Written 23 Nov 2026 against `main` at `a87d30b`.

## The ask, in one line

Bring every place a suggestion waits for a person into one inbox, give the pipeline its own
CI so suggestions stay consistent and improve, and make the next source a small addition
instead of a new page.

The lead could not find B-71 because they looked on `/review` and it was on
`/admin/proposals`. That is the problem in one sentence, and it is bigger than two pages.

## What exists today (checked in the code, not from memory)

There are **seven** queues across **three** pages, read by **five** different capability
sets. The ask names two pages; the third (`/approvals`) and the queues inside `/review` are
the same problem.

| # | Source | Table | Read route | Page | Who may read | Who may decide |
|---|---|---|---|---|---|---|
| 1 | Sera and outside intake (org, role, circle, task, event, risk, tension, commitment) | `external_proposals` (0140) | `GET /api/review/queue` | `/review` | `intake.moderate` | `intake.moderate`; accepting makes an org draft, never a seat |
| 2 | Quest proposals (intake, the companions' "quest idea") | `quest_proposals` (0141) | `GET /api/review/queue` | `/review` | `intake.moderate` or `quest.approve` | `quest.approve` (sets the pay) |
| 3 | Member-finished work waiting for a witness | quest claims | `GET /api/admin/quest-claims` | `/review` | `quest.consent` | `quest.consent`, through the consent route |
| 4 | Sera's differences (what Sera's memory says against what the village holds) | Saberra | `GET /api/saberra/differences` | `/review` | `intake.moderate` | `intake.moderate` |
| 5 | Agent role changes, seatings, letters | `agent_proposals` (0368) | `GET /api/agent-proposals/waiting` | `/review` (AgentProposalsCard) | admin, `org.decide`, `org.seat` | `org.seat`, or the letter's own author |
| 6 | Connector batches (`propose_changes`: role_card, page_content, setting, season_goals and 10 more) | `proposed_change_batches`, `proposed_changes` (0379, 0400, 0416) | `GET /api/admin/proposals` | `/admin/proposals` | `story.tell`, `org.decide`, `org.seat`, `dial.set` | the target route's own gate, run as the person |
| 7 | One-tap approvals (setting, listing, page copy, map publish, seating), lapse after 7 days | `agent_proposals` | `GET /api/approval-inbox` | `/approvals` | `org.decide`, `org.seat`, `story.tell`, `map.publish`, `intake.moderate` | the stored call's own route, run as the person |

What they already agree on, which is what makes one inbox possible without a rewrite:

- **Nothing decides itself.** Sources 6 and 7 run the target's own route as the person
  deciding, over the loopback. Sources 1 and 2 call the same creation function the admin
  form calls. None holds a permission of its own.
- **Filing is checked whole.** `propose_changes` refuses a batch whole with a reason per item,
  using the target route's own validators (`checkProposal` in `server/lib/proposedChanges.ts`).
- **Dedupe exists in one source.** `external_proposals` has `dedupe_key` and `identity_key`
  (NOT NULL, sha256 over module, kind, source ref and normalized claim) and supersedes.
- **Learning exists in one source.** `proposed_changes.lessons_json` keeps the field-level
  difference between what was proposed and what was accepted; `read_proposal_lessons` reads it.
- **Codes exist in one source.** B-71 and B-71.2 (0416). Nothing else has a code.

What disagrees, and is the work: seven card shapes, seven state vocabularies
(`proposed/accepted/rejected/superseded`, `proposed/accepted/discarded/failed/unknown`,
`waiting/approved/declined/expired/reverted`, and so on), five reader lists, no shared codes,
no dedupe across sources, lessons for one source only, and no numbers on any of it.

## The model: one suggestion contract, one adapter per source

**Decision: the inbox is a read model over the existing tables. It adds no write path.**
Each source keeps its table, its filing route and its decide routes exactly as they are.
An adapter projects its rows into one shape, and the inbox's buttons call that source's own
decide route. This is the property that lets every invariant below hold by construction:
the inbox cannot move value, seat anyone or skip a gate, because it holds no call that does.

### The contract (`shared/suggestions.ts`, pure)

```ts
export interface Suggestion {
  /** Stable across sources: "<source>:<source id>". */
  key: string;
  source: SuggestionSource;            // "intake" | "quest" | "claim" | "sera" | "agent" | "connector" | "approval" | later ones
  kind: string;                        // the source's own kind, such as role_card or task.proposed
  /** A code a person can say out loud: B-71.2 today, and the same scheme for every source. */
  code: string;
  target: { label: string; ref: Record<string, unknown>; circleId: string | null };
  /** What it would change, in the source's own shape, and in words. */
  proposed: { summary: string; body: unknown };
  /** What is live now, in the same shape, or null when it adds something new. */
  live: unknown | null;
  /** The person's saved edit, if any. */
  draft: unknown | null;
  proposer: { kind: "agent" | "person" | "integration" | "member"; ref: string; why: string | null };
  evidence: { level: "quoted" | "anchored" | "absent"; quote: string | null; sourceRef: string | null; occurredAt: string | null };
  /** Facts, never a model's score. See "Urgency" below. */
  risk: { reversible: boolean; touchesValue: boolean; touchesPeople: boolean; lapsesAt: string | null };
  /** The ONE capability that may decide this item, as the gate names it. */
  decideCapability: Capability;
  state: "waiting" | "accepted" | "edited" | "discarded" | "lapsed" | "stuck";
  batch: { key: string; code: string; title: string; position: number } | null;
  /** Same claim from two sources groups as one; see "Dedupe". */
  dedupeKey: string;
  identityKey: string;
  filedAt: string;
  decidedAt: string | null;
  /** Where each act goes: the source's own route. The inbox only ever calls these. */
  actions: { accept?: Call; edit?: Call; discard?: Call; undo?: Call };
}
```

The state map is the adapter's job, so the inbox reads one vocabulary and each table keeps its
own. Example: connector `failed` and `unknown` map to `stuck`; approval `expired` maps to
`lapsed`; intake `superseded` never reaches the inbox, since a newer row replaced it.

### The adapter (`server/lib/suggestions/<source>.ts`)

```ts
export interface SuggestionAdapter {
  source: SuggestionSource;
  /** The capabilities whose holders may read this source at all; the inbox asks the gate once per key. */
  readCapabilities: readonly Capability[];
  list(ctx: AdapterCtx, filter: { state: "waiting" | "decided" }): Promise<Suggestion[]>;
  /** The same validators the target route runs. Used at filing time and by the golden set. */
  check(ctx: AdapterCtx, proposed: unknown): Promise<Checked>;
  /** Field-level difference between proposed and accepted, for lessons and edit distance. */
  diff(proposed: unknown, accepted: unknown): FieldDiff[];
}
```

`check` already exists for source 6 (`checkProposal`) and source 7 (the filing templates); the
adapters for 1 and 2 wrap the accept-time validators that already run in `server/routes/review.ts`.
An adapter is registered in one list, `SUGGESTION_ADAPTERS`, and a test fails when a source has
no golden fixtures (see CI below).

### The next sources, and why each fits without a rewrite

| Next source | What it files | How it maps | New table? |
|---|---|---|---|
| Meeting transcripts filling session forms | a session's decisions, tasks, agenda items | `source: "transcript"`, kinds `session_agenda` and `task`; `evidence.quote` is the transcript line; decide calls the existing session routes. Can ride the connector's `session_agenda` kind today | No |
| Feedback relay (`server/lib/feedback.ts`) | bugs and ideas members raise | `source: "feedback"`, read only (triage, not a change), `decideCapability` is whoever keeps feedback; accept means "taken up", discard means "set aside". Local only: the relay to the hub is unchanged | No |
| The four contributor routes (partner, venture, quest, role) | a stranger's or member's proposal | `source: "contributor"`, kind per route; venture and partner land where `wt/ventures-pitch` puts them (coordinate its storage and its inbox tag so the adapter reads that tag instead of adding a second one); quest and role already land in sources 2 and the role-proposal flow | Whatever that lane adds, nothing more |
| AI companions | quest ideas, page fixes | already file into sources 2 and 7 (`companionItems.ts` sends a quest idea to the review queue); the adapter shows `proposer.kind: "agent"` with the companion named by role | No |
| Sera's outside vendor, new kinds | any new `*.proposed` kind | one line on `EXTERNAL_PROPOSAL_KINDS`, as today | No |

The test of the design is that every row above is "write an adapter and its fixtures", and none
is "change the inbox".

## One UI

**Recommendation: the inbox lives at `/review`**, because that is where people already look,
and the other two pages become filtered views of it. Every old link keeps working:

| Old link | Goes to |
|---|---|
| `/review` | the inbox, everything this person may decide |
| `/admin/proposals` | `/review?source=connector` |
| `/admin/proposals#B-71` and any `?code=B-71` | `/review?code=B-71`, that batch open |
| `/approvals` | `/review?source=approval` |
| `/review/structure/:batchId` | unchanged (a structure draft is its own page) |

The search box takes a code. Typing B-71 anywhere in the inbox opens B-71, which is the lead's
problem fixed on its own.

**What the page holds:**

- **Filters:** source, kind, circle, urgency, state (waiting by default; decided for the record).
- **Ordered batches:** a batch is shown as one card in its filing order, and accepting a batch
  runs its items in that order, exactly as `POST /api/admin/proposals/accept` does now. A batch
  a person must approve in order keeps its order across reloads and across sources.
- **Live beside proposed:** the existing side-by-side from `/admin/proposals` becomes the one
  card body for every source that has a live value. A source with nothing live (a new quest,
  an observed risk) shows the proposal and its evidence alone.
- **Accept, edit, discard in place.** Edits save as the person types (the existing
  `PUT /api/admin/proposals/:id/draft` pattern), and the dry run (`/check`) runs before accept.
- **The capability view.** The page shows only items whose `decideCapability` the reader
  holds, asked through the one gate (`shared/capabilities.ts`, via the same `mayStillSee` and
  `liveHoldersOf` the routes use). Nothing is gated by role or title. A source the reader holds
  none of is absent, never shown as empty, and a failed read is never shown as an empty queue
  (the rule `/review` already keeps).
- **Urgency is facts only:** lapses within two days (approvals), a witness waited more than N
  days (claims), a veto window closing, a batch blocking a draft. Never a model's score.

**Build order inside the UI:** the first visible version reuses today's card components
(`ProposedChanges` cards, `QuestProposalCard`, `ConsentQueue`, `SeraDifferences`,
`ApprovalInbox`, `AgentProposalsCard`) under one list with filters, so the design change is
one thing: where the cards sit. Unifying the card bodies comes after, one source at a time,
each with its own before and after screenshots at 390 and 1280.

## The pipeline's own CI

Four checks, each a named test that fails on its own.

### 1. Filed through the same validators, refused whole

Every adapter's filing path calls `adapter.check`, which is the target route's own validator.
A batch with one broken item is refused whole with a reason per item, as `propose_changes`
does now. Sources 1, 2 and 7 gain the per-item reason where they lack it. Test:
`server/lib/suggestions/filing.test.ts`, one broken item per source, asserting the whole batch
is refused and the reason names the field.

### 2. The golden set

`server/lib/suggestions/golden/<source>/*.json`: real past suggestions, each with what became
of it.

```json
{ "source": "connector", "kind": "role_card", "filed": { ... }, "outcome": "edited",
  "final": { ... }, "why": "the role card read as a job ad" }
```

Built by a script that reads decided rows from a village's own database and **redacts before
writing**: people become roles, member ids become `member-1`, no applicant data at all, no
amounts. A person reviews every fixture before it is committed (the public-tree check and the
brand check run on them like any file).

What CI runs on it, all deterministic, no model and no secret:

- **Validator replay:** every `accepted` and `edited` fixture's final value still passes
  today's validators; every fixture discarded as invalid is still refused. A route change that
  quietly breaks a kind fails a test named after the fixture.
- **Adapter snapshot:** each fixture's projection into `Suggestion` is stable.
- **Quality score against a ratchet:** for each source whose suggestions are written by a
  prompt in this repository (the connector's tool words in `server/lib/agentMcpProposals.ts`
  and `KIND_WORDS`, the companions), recorded outputs sit beside the golden outcome, and CI
  scores them: share accepted unedited, mean field edit distance to the final, and zero
  never-rule, voice or evidence-rule failures. The score lives in
  `scripts/suggestion-quality-baseline.json` and may only rise, like the other ratchets.
- **Prompt change means re-record:** a test hashes the prompt words; when they change, the
  recorded outputs must be re-recorded (`pnpm suggestions:record`, run by a person with access,
  never in CI) and the ratchet must hold. That is the honest limit: CI cannot call a model, so
  it checks what the model produced against what people decided.

Sera's extraction prompt lives with the outside service, not here. For source 1 the golden set
covers the adapter, the evidence rule and the validators, and the lessons feed (below) is how
Sera's side improves.

### 3. Dedupe across sources

`dedupeKey` generalizes the `external_proposals` rule to every source: sha256 over
(kind family, target ref, normalized change), with `none` for an absent part. `identityKey` is
the same without the change. Two effects:

- **In the inbox:** suggestions with the same `dedupeKey` from different sources show as one
  card with both proposers; deciding it decides each through its own route.
- **At filing:** a filing whose `dedupeKey` matches an open item in any source is refused with
  that item's code ("This is already waiting as B-71.2"). Same `identityKey`, different change:
  filed, and shown as a competing suggestion on the same card.

Test: fixtures of known duplicate pairs (the same role card change from Sera and the connector)
must group; near misses must not.

### 4. Lessons and metrics

- **Lessons for every source.** `read_proposal_lessons` and `GET /api/admin/proposals/lessons`
  gain an optional `source`; with none they answer as today, so nothing reading them breaks.
  Lessons come from the outcome log below. Seat, application and applicant decisions are
  **never** a lesson.
- **Metrics on the inbox**, per source and kind: acceptance rate, edited rate, mean edit
  distance, median time to decision, and how many lapsed. Read from the outcome log. Shown to
  whoever may decide that source, as plain numbers, never a ranking of people.

## Migrations (expand only)

One table, number **0424**, claimed in the ops ledger's section 3 by the coordinator on
23 Nov 2026 (0419 to 0423 are held by other lanes). Confirm with
`check-migration-numbers --next` before creating the file.

`0424_a_decision_is_kept_for_every_suggestion.sql`

```sql
CREATE TABLE IF NOT EXISTS `suggestion_outcomes` (
  `id` varchar(64) NOT NULL,
  `source` varchar(32) NOT NULL,
  `source_id` varchar(64) NOT NULL,
  `kind` varchar(64) NOT NULL,
  `dedupe_key` char(64) NOT NULL,
  `proposer_kind` varchar(16) NOT NULL,
  `outcome` varchar(12) NOT NULL,
  `fields_edited` int NOT NULL DEFAULT 0,
  `edit_distance` decimal(6,3) NULL,
  `lessons_json` mediumtext NULL,
  `filed_at` datetime(3) NOT NULL,
  `decided_at` datetime(3) NOT NULL,
  `decided_by_capability` varchar(64) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_outcome_source` (`source`, `source_id`),
  KEY `idx_outcome_metrics` (`source`, `kind`, `decided_at`)
);
```

New table, so the UNIQUE index is safe (the rule bars it on an existing table). Every column
in the unique key is NOT NULL. It names **who decided by capability, not by person**, and holds
no member id, so erasure has nothing to find in it. Written by one helper,
`recordOutcome()`, called from each source's existing decide route (one line each), never by a
`dbCollection` write with an unset column. The backfill from today's decided rows runs in
TypeScript on first read, each UPDATE and INSERT guarded by a WHERE, the way `ensureCodes`
does for 0416. Codes for sources other than the connector are computed, not stored, so they
need no column.

## The order of lanes, and what ships first

Each is one small pull request. Nothing visible changes until 4.

| # | Lane | Visible? | Touches contended files |
|---|---|---|---|
| 1 | `shared/suggestions.ts` contract, the seven read-only adapters, `GET /api/inbox` (capability-scoped), code lookup (`GET /api/inbox/code/B-71`), tests | No | `server/index.ts` (one route registration) |
| 2 | Golden set: the redacting export script, the first fixtures per source, validator replay, adapter snapshots, dedupe pairs | No | none |
| 3 | `suggestion_outcomes` migration, `recordOutcome()` in each decide route, backfill | No | migration number |
| 4 | `/review` becomes the inbox: existing cards under one list, filters, code search; `/admin/proposals` and `/approvals` redirect with filters | **Yes**, screenshots first | `client/src/App.tsx` |
| 5 | Dedupe at filing; lessons by source; `read_proposal_lessons` gains `source` | No (connector answers only) | none |
| 6 | Metrics strip on the inbox | **Yes**, screenshots first | none |
| 7 | Unify card bodies, one source per PR | **Yes**, each with screenshots | none |
| 8 | Quality ratchet and prompt-hash test for connector and companion prompts | No | a seventh ratchet baseline (claim in section 27) |
| 9+ | New sources: transcripts, feedback, contributor routes, one adapter each | per source | none |

**Ships first:** lane 1 with the code lookup, then lane 4's smallest form. The fastest relief
for the lead's actual problem is "type B-71 on `/review` and land on it", which lane 4 delivers
on top of lane 1.

## Invariants this keeps, and how

- **One capability gate.** The inbox asks `shared/capabilities.ts` through the existing
  `mayStillSee` and `liveHoldersOf`; each item carries the one capability its source's route
  already requires. The inbox never shows more than today's pages show the same person.
- **Nothing here moves value.** The inbox holds no write path. A quest claim's consent still
  goes through `POST /api/admin/quest-claims/:id/consent` with its own gate; owed payouts stay
  where they are. `suggestion_outcomes` records decisions, never amounts.
- **AI never selects, ranks or judges applicants.** Seatings, role applications and anything
  carrying an `application_ref` are listed in arrival order only, carry no confidence or
  significance, are left out of the golden set, the quality score, the metrics and the lessons,
  and are never grouped by dedupe with a machine's suggestion. Applications stay human-decided.
- **Names roles, not people** in fixtures, lessons and the outcome log.
- **Copy rules:** every new string passes `check-voice.mjs` and `check-brand-refs.mjs`, with
  Spanish in `client/src/locales/es.po`.
- **Generated docs are not committed by any lane**; main regenerates them.

## Risks

1. **Showing more than today.** Today several readers let an admin through before the
   capability check (`isAdmin(req)` in the reader of `server/routes/proposedChanges.ts` and
   `server/routes/approvalInbox.ts`). The inbox will reproduce each source's current read rule
   exactly, admin shortcut included, so lane 1 changes no one's access. Whether those admin
   shortcuts should go is a separate decision for the lead, and is not bundled here.
2. **Seatings filed by agents sit close to the applicant line.** `propose_seating` and the
   approval inbox's `seating` kind exist today. The inbox will show them with no ordering
   beyond arrival and no machine score. **Question for the lead:** keep them in the inbox, or
   show them only on the role's own page?
3. **`Review.tsx` is at 931 of the 1000-line ratchet.** Lane 4 moves the page into a folder of
   smaller components first; it does not raise the cap.
4. **Bundle budgets.** The inbox stays a lazy route; the main JS budget is the guard. Read all
   three budgets on the pull_request run.
5. **Golden fixtures are real data.** Redaction before writing, a person's review before
   commit, and the public-tree check. If a fixture cannot be redacted safely, it is not used.
6. **The prompt ratchet can only check recorded outputs.** It catches a prompt change made
   without re-recording and a re-recording that scores worse. It cannot judge a suggestion no
   person has decided.
7. **Contended storage with `wt/ventures-pitch`.** The contributor-routes adapter waits for
   that lane's storage to land and reads its tag; this plan adds no second tag.

## Decisions waiting on the lead

1. Yes or no to the plan as a whole, and to building it in the order above.
2. The inbox at `/review` (recommended), or a new `/inbox` with `/review` redirecting to it.
3. Agent-filed seatings: in the inbox (arrival order, no score), or only on the role's page.
4. Whether lessons may later be offered to the outside Sera service (content only, roles not
   people). Not built in this plan either way.
