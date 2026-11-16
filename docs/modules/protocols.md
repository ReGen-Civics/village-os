# Module design: protocols

Provenance: platform

> Registry id `protocols`. The contract is `shared/protocols.ts` (limits, the draft check, the import reader, the
> tick and completion rules). Routes in `server/routes/protocols.ts`; every statement in `server/repos/protocols.ts`;
> the schema in `drizzle/0389_a_village_keeps_its_protocols.sql` (number provisional until compose). The member page
> is `client/src/pages/Protocols.tsx`, the Admin card `client/src/components/admin/ProtocolsEditor.tsx`, the offline
> shell `client/public/protocols-sw.js` with `client/src/lib/protocolsOffline.ts`, and the shared offline queue
> `client/src/lib/offlineQueue.ts`.

**Named checklists a village walks the same careful way every time. Any member starts a run and ticks the steps;
a step can be kept for the holder of one role; a run with a required step still open cannot be completed; every
run records who ticked what and when. The page works on a phone with no signal, sends what was ticked when the
signal comes back, and offers to add itself to the home screen.**

## Status

Ships OFF, like every non-core module. An admin writes the checklists on the module's card (`/modules/protocols`),
or imports a file of them, then turns the module on to `members`. Nothing has to be set before it is honest to run:
with no checklists the page says so.

## The model

- **Protocol**: a named, ordered list of steps, with an optional photo drawn at the top of a run (a path on this
  site or an https address). Each step has its words, optional detail, required (default) or optional, and who may
  tick it: any member, or the live holder of one org-chart role.
- **Version**: every save of a protocol is a new row in `protocol_versions`, never an update. A run is pinned to
  the version it started on, so editing a list never rewrites a run already walked. Saving a draft identical to the
  current version writes nothing, so re-importing the same file is harmless.
- **Run**: one walk through one version (`protocol_runs`). Its id is made on the member's phone.
- **Tick**: one member ticking or unticking one step at one moment (`protocol_run_ticks`), id made on the phone.
  A step's state is the latest event for it (ties by id), so two phones that ticked offline merge to the same
  answer in any order.
- **Ending**: complete (refused while a required step is open) or set aside. Both stay in history.
- **Quest** (optional, on the version): a quest on the village's board. The first time a run is completed, the
  member who completed it gets an ordinary claim on that quest, already handed in, with the words
  `Completed the checklist "<title>" on <day>.` (below).
- **Practice run**: walked on the phone only. Nothing is queued, sent or kept, and no quest is claimed (below).

The same rules run on the phone (offline, from the last role list it was given) and on the server (from the org
chart at the moment the tick arrives, lapse included). The server's answer stands.

## Routes

| Route | Who | What |
|---|---|---|
| `GET /api/protocols` | member | active protocols, open and recent runs with ticks and names, the viewer's id, name and live role ids, the first names of each kept-for role's live holders (`roleHolders`), the card's settings |
| `GET /api/protocols/runs/:id` | member | one run |
| `POST /api/protocols/runs` | member | start: `{ id, protocolId, version, startedAt }` |
| `POST /api/protocols/runs/:id/ticks` | member | `{ id, stepId, done, at }` |
| `POST /api/protocols/runs/:id/complete` | member | `{ id, at }`; the first completion of a linked run opens its quest claim |
| `POST /api/protocols/runs/:id/set-aside` | member | `{ id, at }` |
| `GET /api/protocols-app.webmanifest` | anyone, 404 while off | the installed app's manifest (outside the members gate, because a browser fetches a manifest with no session) |
| `GET /api/admin/protocols` | admin | every protocol, archived included, the org chart's roles, and the board's quests for the quest picker |
| `PUT /api/admin/protocols/:id` | admin | save a draft as the next version |
| `POST /api/admin/protocols/:id/status` | admin | `{ status: "active" \| "archived" }` |
| `POST /api/admin/protocols/import` | admin | `{ file, dryRun }`; a real run saves only a clean file |

**Every member write is safe to repeat.** A repeat of a run or tick id answers 200 with what is recorded. A refusal
the phone should not retry is a **422** with a sentence (`not_your_step`, `steps_open`, `run_ended`, `no_run`,
`id_taken`, `protocol_gone`). Times from the phone are kept as the phone's, except that one more than five minutes
ahead of the server is recorded at the server's now. Writes are bounded per member per hour.

The admin routes sit outside the module gate so a founder can write the lists before switching the module on.

## The import file

```json
{ "format": "village-protocols/1",
  "protocols": [
    { "id": "opening-up", "title": "Opening up", "summary": "Before anyone arrives.",
      "steps": [
        { "id": "lights", "text": "Lights on.", "who": "anyone", "required": true },
        { "id": "kettle", "text": "Kettle filled.", "required": false },
        { "id": "unlock", "text": "Front door unlocked.", "who": "Keyholder" } ],
      "quest": "Opening up" } ] }
```

- `format` may be left out; a different one is refused.
- A step's `who` (or `role`) is a role's title or id on this village's org chart, matched without case; `"anyone"`,
  `"any"`, `"member"` or nothing means any member. A role the chart does not hold is named, once, and nothing from
  that protocol is saved: add the role first.
- A protocol's `quest` (or `questId`) is a quest's id or title on this village's board, matched without case. A
  quest the board does not hold is named, once, and nothing from that protocol is saved: post the quest first.
  Left out, a completed run claims nothing.
- `required` defaults to true. Ids are made from the words when left out. Unknown fields (`source`, `_about`) are
  ignored.
- Importing an id that exists saves a new version of it.

## A completed run hands in its quest

`server/lib/workClaim.ts` (`openSubmittedClaim`), called by the complete route.

- **No new pay path.** It opens a claim exactly as the board's own claim route does (`claimRefusalFor`, then
  `openClaim` under the quest's row lock), hands it in with `submitOnce`, and rings whoever may consent quests, the
  member who did the work excepted, with the board's own bell (`quest-submission:<claim>:<recipient>`). A steward
  consents it through the quest routes, which refuse a member consenting their own work, and the village's
  `quest.completed` rules pay it there. A village with no rule for the quest pays nothing.
- **Once per run.** Only the call that moves a run from open to complete claims, and the run keeps the claim's id
  (`protocol_runs.quest_claim_id`), so the queue sending the ending twice, or two phones completing together, opens
  one claim.
- **The claimant is the member who completed the run.** A village that wants the claim to be whoever ran the list
  should have that member complete it.
- **A claim that cannot open leaves the run complete.** The quest closed, a gate the quest asks (stage, role, age,
  safety) refusing this member, or the member already holding a claim on it still waiting on a steward: the run
  stands, `questClaimed` is false, and nothing is retried.
- The words name the list and the day, nothing a member typed.
- The page says "Handed in for <quest>. A steward confirms it." on a completed run that opened one, and the list
  card says what completing hands in.

## Practice

`/protocols/practice/:protocolId`, a link on each protocol's card, and a door a joining flow may link to by the
protocol's id (the far-away path: someone learning the list before they are there to walk it).

- Walked in the page's memory from the same snapshot, so it opens with no signal. **Nothing is queued, sent or
  kept**: a reload starts it again, no run exists on the server, and no quest is claimed.
- Marked "Practice run" at the top, with what it does not do, and "Practice finished. Nothing was recorded." at the
  end, with Practise again.
- Every step may be ticked, a role's included; a role step says "In a real run, Role (Name) ticks this one."
- The offline shell's scope already covers it (`/protocols/...`).

## Offline

**The offline shell is its own service worker, `client/public/protocols-sw.js`, scoped to `/protocols`.** A worker
controls only the pages under its scope, so it can never answer for any other page. It is registered only by the
protocols page, only once that page has the module's data, so a village that never turns the module on never
installs it and nothing changes there. `client/public/sw.js` stays the worker for everything else; its one change is
that its clean-up leaves `protocols-shell-*` caches alone (Cache Storage is shared by the whole origin).

What it does, and why it cannot strand anybody on an old build:

- A page under `/protocols` comes from the network first, every time. The kept copy is used only when the network
  fails, or gives no answer in 8 seconds, or the browser says it is offline.
- Vite's hashed `/assets/*` files are kept cache-first; a name is its content, so a kept copy is never wrong.
- When a fresh page names a different entry script (a deploy), every kept asset of the build before is dropped.
- Public reads the page needs to draw (`/api/brand/theme.css`, `/api/game/config`, `/api/i18n/catalog/:locale` and
  its hashed parts, the protocols manifest) are network first with the kept copy as fallback.
- **No member data is ever kept in Cache Storage.** Everything that names a member goes through the page's own
  per-member snapshot (below), so a shared phone never shows one member's runs to the next.
- On the first visit the page's files loaded before the worker existed; the page hands the worker the list of what
  it loaded (`protocols-warm`), and the next visit opens with no signal. That takes a few seconds with signal: a
  phone that loses signal in the same breath as its very first visit has not kept the page yet.
- `/reset` unregisters every worker and empties Cache Storage, this one's included, and keeps the queue.

**The page works without the app's own boot.** With no signal, AuthProvider has no user and ModuleProvider ends
`failed`. The page reads the stored token's owner and that owner's snapshot of `GET /api/protocols` (which proves the
module was on at the last visit), draws from it at once, and lays the waiting queue on top
(`client/src/lib/protocolsState.ts`).

Measured with Playwright (Chromium, 390x844): visit online, go offline, reload `/protocols`, start a run, tick,
complete, go online, and the run arrives on the server; no file the page needs fails on the offline reload.

### The shared offline queue: `client/src/lib/offlineQueue.ts`

The journal outbox's rules, with the journal taken out, for any module a member uses where the signal comes and
goes. The hidden map reuses it.

```ts
const q = offlineQueue("name", { ordered: true });   // one instance per name per page
q.enqueue(ownerId, { id, path: "/api/...", body, method?: "POST" | "PUT", group?: string }) // -> { stored }
q.pending(ownerId)          // QueuedRequest[], oldest first, refused ones included
q.flush(ownerId)            // -> { sent, kept, refused, offline, sessionEnded }
q.retry(ownerId, id)        // send a refused one again
q.remove(id)                // drop one from the device
q.subscribe(fn)             // re-read on any change, this tab or another; returns the unsubscribe
flushWhenOnline(q, () => ownerId, onResult?)        // flush on `online` and on return to the tab
readSnapshot<T>(name, ownerId) / writeSnapshot(name, ownerId, value)   // last answer, per member
newRequestId(), tokenOwner(token)
```

- Stored in localStorage under `village.queue.<name>` (snapshots under `village.offline.<name>.<owner>`). JSON
  bodies only, and small: localStorage is a few megabytes for the whole site. A photo needs another store.
- Each request carries its `id` as `Idempotency-Key`, and the server endpoint **must** treat a repeat of that id as a
  no-op.
- Only the owner's requests are sent, with the token proven to be theirs, and a run stops if the token changes.
- Answers: 2xx removes it; 400 or 422 marks it refused with the server's `error` (or `message`) and carries on;
  401 stops the run as a session end; 403, 404, 408, 409, 429 stop it and keep everything; 5xx keeps it and, in an
  `ordered` queue, stops the run so nothing overtakes it. A send has 20 seconds before it counts as no connection.
- `/reset` keeps every `village.queue.*` key.

## The screens

Built to the approved mock-ups (`pirates-onboarding` lane, screen 05 and its design language): a calm offline notice
(never red), the photo header with the title over it, a meter of required steps done ("15 of 19 done", "with" the
other members who ticked), one row per step with who ticked it by first name, the step in front of the member
highlighted with its detail, optional steps faded, a role step drawn dashed with "Role (Name) ticks this one", and
one main button: tick the step in front of you, or complete once every required step is ticked. Colours come only
from the village theme (`primary`, `open` for done, `card`, `muted-foreground`), so another village's palette and
words carry through with nothing of this one's.

Not built from the mock-up, because nothing in a protocol holds it: the reward panel under the list ("+25 tokens")
and the "Your first quest" label belong to the quest a village links to the protocol, which is `vos-onboarding`'s.

## Add to your phone

`client/src/lib/installPrompt.ts` and `client/src/components/protocols/InstallCard.tsx`.

- Chrome and its kin fire `beforeinstallprompt`; the page holds it (and only then calls `preventDefault`) and its
  card's Add opens the browser's own dialog. Safari on iPhone and iPad gets the three taps (Share, Add to Home
  Screen, Add), then "open it once with signal and sign in", because a home-screen app there keeps its own storage.
- While the protocols page is open, the document's manifest link points at `/api/protocols-app.webmanifest`
  (start and scope `/protocols`, name "<village> Protocols"), so what installs is the checklists; the village's
  own manifest comes back when the page closes.
- Not nagging: never as an installed app, never after an install, shown by itself 1.5 seconds after the list draws,
  a dismissal waits 30 days, three dismissals end it. A quiet "Add to your phone" link stays. The card's switch is
  `showInstallCard` in the module's config (default on).

## Data and leaving

`dataClass: member-pii`: a run names who ticked each step. Member ids are read through `users` at display time, so an
erased member shows as the platform's erased name; nothing here stores a member's words. Turning the module off
hides every surface and keeps every table.

## Not built

- Device-to-device sync with no network. Two phones offline each hold their own ticks until both sync.
- A `protocols.manage` power a role could hold; editing is an admin act for now.
- Photos, notes or timers on a step; scheduling; notifications.
- Moving the journal's outbox onto the shared queue.
- A practice run that survives a reload. It is in memory on purpose, so nothing that looks like a record exists.
- A claim for each member who ticked. The quest goes to the one member who completed the run.
