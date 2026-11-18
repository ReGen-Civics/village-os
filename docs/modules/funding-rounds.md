# Module design: funding-rounds

Provenance: platform

> Registry id `funding-rounds`. The count is `shared/equalShares.ts`; the stages and the idea shape are
> `shared/fundingRounds.ts`. Routes in `server/routes/fundingRounds.ts`; the rules in
> `server/lib/fundingRounds.ts`; every statement in `server/repos/fundingRounds.ts`; the schema in
> `drizzle/0338_the_village_chooses_which_quests_to_fund.sql`, `drizzle/0348_a_backer_pledges_to_a_quest.sql` and
> `drizzle/0402_a_round_freezes_its_voice.sql`.

**The village chooses together which quests the season funds, within a pot. Members share rough ideas, shape
them into quests, and tick every one they would fund. The count runs two ways on the same ticks: by Voice, and
by one member, one vote. Where the two differ, the village sees it. Funded quests hold an earmark on the pot and
are paid only when their work is done.**

## Status

Ships OFF, like every non-core module. An admin, or a holder of `module.switch`, turns it on.

Built so far:
- **S1:** the count (`shared/equalShares.ts`).
- **S2:** pots, rounds and the seed stage. Members share ideas, named or without a name by their own tick, and
  each idea opens a forum discussion thread when the forum is on for members.
- **S3:** the grow, choose and harvest doors, and backing pledges. The author shapes their idea into a quest;
  members tick what they would fund, privately until choosing closes; harvest runs both counts once, funds,
  holds an earmark per funded quest and puts it on the quest board. The 25% per-member cap on Voice
  (`weight_cap_pct`, `capWeights`) applies to the power count.
- **S4:** the counted-Voice guardrails. Counted Voice (all, or work-only), the Voice snapshot frozen when
  choosing opens, and the 48-hour vote on the quests the two counts disagree on. See "Counted Voice" below.
- **S4 rulings, this release** (the lead, 2026-11-18): new pots count all Voice, with a door to switch a pot to
  work-only; a carried divergence vote lands when it closes; held quests reserve their pot money.

Not built yet (next):
- **Earmark to paid.** An earmark stays `held`; moving it to `owed` and `paid` when the quest's completion is
  consented, through `cash_owed`, is not wired.
- **Equity on completion.** A backer's pledge earns nothing yet; equity goes through the economics lane's
  `issueInvestment` with ref `pledge:<id>` once Q-B1 (collecting a pledge) is answered.
- **The Treasurer's season board (S5).**
- **The stop vote on a backer-funded quest.** A quest its backers cover whole still goes ahead without the
  count, and no vote can stop it yet (plan Q-B6).

A round's stage is derived from its dates, so a round whose grow date is not set stays in seed for as long as
the pot's holder leaves it that way.

Rulings it follows (Rye, 2026-11-06, relayed by the master coordinator):
- A pot is a power held by the Treasurer by default: `pot.steward`, granted to the seeded Treasury role.
- Choosing is earmarking. Money is sent only when a quest is completed, so nothing is paid in advance and
  nothing ever returns. An earmark is held, owed, paid or released.
- Anonymous or named is the submitter's tick.
- No tokens for voting or posting. Every interaction is recorded, privacy-aware, to found later rewards.
- Ticks are shown with names when a round closes.
- Each village chooses its clock: lunar, seasonal or fixed days.

## The stages

| Stage | Opens at | What happens |
|---|---|---|
| seed | `seed_at` | Members share rough ideas. |
| grow | `grow_at` | The proposer shapes an idea into a quest: deliverable, price, rubric check. (S3) |
| choose | `choose_at` | The voting roll and each member's counted Voice are frozen. Members tick every quest they would fund. Ticks are hidden until close. (S3, S4) |
| harvest | `harvest_at` | Both counts run. Quests both counts fund become quests holding an earmark; quests they disagree on wait for a 48-hour village vote. (S3, S4) |

A later date that is NULL holds the round in the stage before it.

## Counted Voice (S4)

The original plan (section 13) is not in this repository, so S4 was built from the code comments, this
document and the existing patterns. The lead ruled on its six open questions on 2026-11-18; where a choice
below comes from that ruling, it says so.

**Which Voice counts.** Each pot says, in `counted_voice`:
- `all` (the default for a new pot, migration 0403; the lead: "count all voice for now"): each member's whole
  Voice balance.
- `work_only`: the Voice a member earned through work, their balance times the share of Voice ever minted to
  them from a work source (`workEarnedVoice` in `server/lib/voiceProvenance.ts`; the work sources are an
  allow-list, `WORK_VOICE_SOURCES` in `shared/voiceFromMoney.ts`). Voice from donations, investment and backing
  weighs nothing. A mint source that is neither work nor money counts against the member's share, so the count
  can only be understated, and the round records which sources it met.

A holder of `pot.steward` switches a pot between the two (`PATCH /api/funding-rounds/pots/:id/counted-voice`,
through the one capability gate, and on the funding rounds page under "Which Voice a pot counts"), or chooses
when opening the pot. The switch reaches only rounds that freeze afterwards: a round already choosing keeps
the setting it froze with, recorded on its snapshot and in its outcome.

**Who is on the roll.** The same roll every village vote opens with: present members holding `ballot.vote`
(`votingRoll` in `server/index.ts`). The village's own ballot weight mode is not read: before S4 a round
borrowed it, which in `equal` mode made the power count the same as the people's count.

**The snapshot.** The roll and each member's counted Voice are frozen once, when choosing opens, into
`funding_round_voice` (migration 0402). The pot's decider, cap and counted-Voice setting freeze with it, so a
change to the pot mid-round changes nothing for that round. Whichever comes first freezes it: the
`funding-voice-freeze` job (every 15 minutes; it reads balances and writes the snapshot, and asks nothing and
decides nothing), a member opening the round in choose, or a member's tick. If nothing froze it while the
round chose, harvest freezes it before counting and the outcome says `voiceFrozenLate`. Harvest reads only
the frozen rows. The freeze lands at most about 15 minutes after choosing opens; Voice is not rebuilt from
ledger history as of the opening instant (the lead, 2026-11-18). A member who was not on the roll when it
froze cannot tick in that round, and is told: "This round's list of who chooses was set when choosing opened
on <date>. You can take part in the next round."

**The 48-hour divergence vote.** When the two counts fund different quests:
- the quests both counts fund go ahead at once, with their earmarks;
- the quests they disagree on are held (status `on_ballot`), their firm pledges kept, and no earmark yet;
- the pot RESERVES the larger of the two sides' costs (`funding_rounds.reserved_minor`, migration 0403; the
  lead, 2026-11-18), so another round on the same pot cannot spend it first. The pot shows it as
  `reservedMinor` and leaves it out of its free money. The reservation counts only while the vote is
  undecided, so settling the vote releases it;
- a village vote opens on the ordinary ballot engine, subject `funding_divergence`, subject ref the round id,
  asked by `sys:funding-rounds` and not by a person, for 48 hours (two whole days, which is how the engine
  opens a window). The question is "fund the disputed quests by the other count?";
- it is weighed the way every village vote is (the village's own method, dials and weight mode, through
  `roleBallotSetup`; kept by the lead, 2026-11-18), priced at the routine tier like `admin_edit`, and a missed
  quorum is not asked again;
- the clock closes it. Not carried, too few votes or withdrawn: the pot's deciding count funds its side, at
  once. Carried: the other count funds its side, also when the vote closes. The subject is in
  `NO_WINDOW_SUBJECTS` (shared/governanceKinds.ts; the lead, 2026-11-18), so no steward window follows a
  carried vote. Its executor is safe to run twice, so a close whose landing throws is retried
  (`AT_CLOSE_RETRY_SAFE_SUBJECTS` in server/lib/atCloseLanding.ts);
- the closer (`fundingDivergenceCloser`) settles the round once. It funds the chosen side in that count's own
  order from the pot's free money plus the round's reservation, so every quest on the larger side fits; a
  quest that somehow does not is left unfunded and the round's note says how many;
- when no vote can open (voting is off, the weights cannot be read, nobody may vote, a governance window is
  shut) the deciding count stands at once, and the round's note says why.

The round only asks. The village's vote decides, and the closer carries out what it decided.

## Setup


Seat someone in the Treasury role (or another role carrying `pot.steward`). They open a pot (its unit is a
currency code such as CRC, or any registered token id) and a round on it.

## Privacy and erasure

- An anonymous idea's author is stored and never sent. Every idea leaves the server through `ideaView`, whose
  byline is "a member". Its forum thread is posted under the account that opened the round, with a line saying
  so.
- `interaction_events` holds references, never content. An anonymous idea's author's rows are `private`.
- Erasure deletes a member's private interaction rows and de-attributes the rest; deletes their ticks and their
  frozen Voice rows (a counted round keeps its numbers in its outcome); deletes
  their ideas still in seed; and keeps ideas already on a round's record, shown as "a member".
- The member export includes their ideas, anonymous ones too, their frozen Voice per round, and their
  interaction rows.
- A member sees only their own counted Voice. Nobody else's is sent.

## Turning it off

While a round is past seed and not closed, the module stays on (`openStateCheck`). Off deletes nothing:
pots, rounds, ideas and the record stay, and funded quests stay on the quest board.
