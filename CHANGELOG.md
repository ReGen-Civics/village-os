# Changelog

What changed in each release of the village platform, in plain language for
the people who run villages.

Every release is one container image, built once and published under its own
version number. A published version never changes afterwards, so a village
that pins a version keeps running exactly the software that was tested for
it. `ops/RELEASES.md` explains the version channels, how to pin one, and how
to pull the image if you host your own village.

## How to read this file

**`docs/UPGRADING.md` is the procedure.** Read it before your first upgrade.
It covers the backup to take, what happens while a release installs, and how
to put the previous version back.

Read every entry between the version you are on and the version you are moving
to. Each one answers the same three questions:

- **What changed for your village.** In plain words.
- **What you must do.** Usually nothing. Anything listed here is done *before*
  you start the upgrade.
- **Does it touch your data.** Whether the release reshapes your database on
  the way up, and whether going back would undo it.

**Starting a new image changes your database**, every time, by itself, before
the village answers anyone. That is why **Does it touch your data** is on
every entry, including the ones that say no.

---

## Unreleased

Work on `main` that has not been published as an image yet. No village runs
it. It is written here as it lands, so the next release entry is a record
made at the time.

To word with Rye and the Legal session for the next release, left out of 1.3.0 on purpose: the invoice and pay half of the approvals module; what work states it pays, Earned Equity, cash owed, draft invoices and the cash-payouts page; and the flat role mint going blank (#776) with the seeded dues note being blanked. Everything else up to 1.3.0 is in its entry below.

---

## 1.3.51 (2026-11-21)

### What changed for your village

- **The last small tap targets are a full finger's height.** The "Remember my answers on this device" tick box on the role application now has a tap area as large as its words, the "Join Community Call" buttons on the investor and prosperity journeys are 44px tall, and so is "How we create together" on the resident journey.

### What you must do

Nothing.

### Does it touch your data

No.

## 1.3.50 (2026-11-21)

### What changed for your village

- **Nine paintings repainted.** An audit of all 48 found a great green macaw with three wings, a hammerhead with one eye and its mouth on the side of its head, leafcutter ants with leaves floating over their backs, cacao pods hanging from twig tips, coffee cherries on stalks, a tree fern with a twisted trunk, guanacaste pods drawn as beans, a mangrove with roots under the water, and a basilisk with a doubtful leg. Each is repainted in the same style, and browsers fetch the new file at once.
- **An expanded venture shows its painting.** Opening a venture on /roles showed the full role card with its character drawing. The card now shows the role's painting, the same one as its row, and falls back to the character only if the painting cannot load.
- **An open waitlist keeps its painting in shape.** Opening "Join the waitlist" on an upcoming role used to stretch its painting into a tall sliver down the side of the form. The painting now sits beside the role's name as a portrait, and the form takes the full width.
- **Easier to tap on a phone.** The tick boxes on the role application, the waitlist and the love letter are larger, with a full finger's height of row around each. The "mark as done" circles on the investor and prosperity journeys, "Forgot your password?", "How we create together", the goal links on the home page and the visit form's fields are all a full finger's height.
- **Upcoming roles sit two to a row on a wide screen**, like the ventures, and a role with its waitlist open takes the whole row. "Apply early" is now a button beside "Join the waitlist".
- **The role card's "How we work" tab is now "How we co-create".**
- **Paintings load faster and update themselves.** Thumbnails and strips load a half-size copy of their painting, about a third of the bytes. Every painting's address now carries a fingerprint of its file, so a repainted painting reaches every reader the moment it ships, and browsers can keep each one for a year. `node scripts/nature-art-sizes.mjs` makes the copies and the fingerprints after any painting changes, and a test fails until it is run.
- **Desktop menus are easier to hit.** The top menu's items and the "your next step" link are at least 24px tall.

### What you must do

Nothing.

### Does it touch your data

No.

## 1.3.49 (2026-11-21)

### What changed for your village

- **Upcoming roles and open ventures get their own painting too.** 1.3.48 let the listed roles choose first, which left out the coming-soon roles and ventures a visitor also sees on /roles, so two of them could still share a painting. Every role on /roles now chooses before the hidden ones.

## 1.3.48 (2026-11-21)

### What changed for your village

- **No two roles a visitor can see share a painting.** The roles on /roles now choose their paintings before unlisted and rested roles, so each shown card has its own. A painting an admin picked in the Art library still wins.
- **The timeline's bars close on a second tap.** Tapping or clicking a bar on the founding roles' timeline opens its dates; tapping it again closes them, on a phone and on a desktop.
- **The timeline is easier to tap on a phone.** Its bars and its "Dates as a list" line are a full finger's height on a touch screen.

## 1.3.47 (2026-11-21)

### What changed for your village

- **Every role card has a painted animal or plant of Costa Rica.** 48 paintings in the style of the character cards: the founding cards, the roles opening next, the open ventures and every upcoming role show one, and no two roles share one.
- **An Art library in Admin** (Who runs this village) shows all 48 and which role uses each, and lets you pick a different painting for any role.
- **Open ventures sit in two columns on a desktop**; an opened venture takes the full width.
- **Companions can be painted.** A member can choose any of the 48 as their companion's look, and a role card's Digital Companion named after one of the animals shows its painting.

## 1.3.46 (2026-11-21)

### What changed for your village

- **The founding roles' shared timeline sits right under the founding roles**, folded. Open it to see every role's dated deliverables on one timeline.

## 1.3.45 (2026-11-21)

### What changed for your village

- **/roles shows the full role cards again**, as the village approved them in 1.3.41, with the role in one minute and every founding section. They now come in order: Open roles, then Open ventures, then Upcoming roles. Each role sits in its own clear frame, so you always know which card you are reading. The compact index cards from 1.3.42 are gone.
- **A lead role lists "Roles to be added:"**, the roles still to come under it. Each one opens its waitlist.
- **What stays:**
  - On a phone, Apply sits right under the role's name, clear of the tab bar.
  - Coming-soon roles offer "Join the waitlist" and "Apply early".
  - Each role keeps its own share page at /roles/<role>, and old role links still find it.

## 1.3.44 (2026-11-21)

### What changed for your village

- **"Pay to be determined" is a kind of pay on offer.** A paid role can open for applications while its pay is still being set, and its card reads "Pay to be determined". It records no amount: no invoice line, total, contract price or payout reads a figure from it. Choosing it in the editor clears any typed amount.

## 1.3.43 (2026-11-20)

### What changed for your village

- **/roles has three groups: Open roles, Open ventures and Upcoming roles**, in that order, each with a clear heading. Venture cards carry an "Open venture" badge and a "Bring your venture" button that uses the same apply form. With no venture open, the group says so and links to proposing one.
- **Coming-soon cards say "Join the waitlist"** beside "Apply early".
- **The apply form explains the ramp-up**: start lower and step up, for example half time the first month and full time the second.
- **When Continue is blocked, a list of what is missing appears just above the button.** Each line opens its step and puts you in the field.
- **"Your first day" is now "Your first moon"**, drawn as a numbered path. It says you and the circle reshape your deliverables timeline together, and the paid first cycle comes last.
- **Get to know us** says "webinar recording" and "webinar call", and every event time carries a "your time" note.
- **The village token is named in full, for example "Amora tokens"**, wherever it was shortened to the village's name alone.
- **A coming-soon role or an open venture can be listed once its card says its purpose and what it looks after.** An open role still needs its whole card, pay on offer included.
- **On a phone, "Apply for this role" sits right under the role's name** on its own page, clear of the bottom tab bar. The browser check now proves on iPhone, in both WebKit and Chromium, that nothing covers the button.
- **Proposals that could never land are refused when they are filed, not when someone accepts them.** That covers a new role carrying words that change only by consent, and a card asking to be listed before it is ready. The refusal says what is missing.

## 1.3.42 (2026-11-20)

### What changed for your village

- **/roles is an index of compact role cards.** Each card shows the role's name, its circle, the role in one minute, and its state. The full role now lives on its own page at /roles/<role>, so the list stays short and easy to scan.
- **Coming-soon roles show their name once**, with two choices: be told when the role opens, or apply early.
- **On a phone, Apply is on the first screen of a role's page**, under the role in one minute. The fact tiles and long notes come after it.
- **A hint above the "Why you, and why now" starters:** "Click one, then talk or type. Then click the next."
- **The optional self-knowledge box now asks for any way of working you should know about**: "Your Human Design, Gene Keys, or other ways of working we should know about (optional)". It is still never shown to the people who decide.

## 1.3.41 (2026-11-20)

### What changed for your village

- **Taking on several people for one role.** A role's limit now follows its total commitment (100% unless the role sets another), not only its number of places, so three people at 30% fit a one-place role. A decider may still go above the limit after one question: "This is above the limit set for this role, continue anyway?", with the numbers shown. Each choice to go above is recorded, and nobody goes over the limit without it.
- **Saving a split.** In Compare Proposals, a decider can save which deliverables each person will hold. It shows in Compare and on each person's admin proposal page, and never to the person it is about, the public or agents.
- **Quest approvers see the quest part of Compare**, with no role applications and no pay.
- **New connector powers for the village's own AI coordinator:**
  - Withdraw agenda items the holder may withdraw.
  - Read which power groups a role carries.
  - Add a power group to a seat with a person's approval quoted, never the veto, the break-glass or anything to do with money, and never removing one.
- **A full-access switch for one role's agent.** Off unless a person turns it on in Admin, Players, Agents, and it is tied to a role, not a person: it reaches only an agent whose holder sits in that role, and stops the moment the seat changes hands. With it on, the agent can make admin changes and accept or discard review-page items for the holder, each shown first and carrying the holder's approval in the audit. Secrets, erasure, money, the agent accounts, the veto and break-glass, and sending letters or email stay a person's act. Turning it on or off is recorded and the Anchor Circle is told.

### What you must do

Nothing. The full-access switch stays off until a person turns it on.

### Does it touch your data

No migration. Saved splits and over-limit choices sit in each proposal's existing record, and the switch is one stored setting.

---

## 1.3.40 (2026-11-20)

### What changed for your village

- **Rate limits count each visitor, not everyone at once.** Behind the hosting edge, the waitlist, the role card's reads, the founding team and the member companion's cost cap all counted every visitor as one, so five waitlist sign-ups in an hour from anybody closed the waitlist to the whole village. Each now counts the visitor's own address, the same rule sign-in already uses.
- **Apply is on a phone's first screen.** On a role card, Apply and "Start a conversation" sit right under the role's goal. A solid bar along the bottom offers Apply only while those are off the screen, so one Apply shows at a time and the goal is never covered.
- **Fewer words on "The terms".** The split explainer and the longer commitment hint are gone from that step. Every consent and agreement line stays.
- **Recordings are said on Review.** Review & submit now says how many recordings there are and whether each goes, with a way back to tick one. Before, an unticked recording was dropped at Send with nothing said.
- **Small fixes from an applicant walk-through:**
  - The phone's step marks are read aloud.
  - Growing boxes no longer clip their last line.
  - A file that is too big is marked on its own row.
  - "Start a conversation" shows a problem under the box it names, and marks a role that is not open yet.
  - A refusal that names no answer is plain words, not a dead link.
  - 32 more Spanish lines on the way in.
- **For people who run the platform:** the bot that rebuilds the generated docs can push with a deploy key, so main can require green CI.

### What you must do

Nothing.

### Does it touch your data

No. There is no migration.

---

## 1.3.39 (2026-11-20)

### What changed for your village

- **Compare proposals side by side.** A new admin section, Compare Proposals, lists every role application and quest idea waiting for a decision, grouped by circle. Tick up to four from one circle and read them in columns: who, the role, how it came in, commitment, aim, what they would deliver, their terms and dates, with a link to each full proposal. On a phone the columns become cards you swipe.
- **A split helper for taking on several people for one role.** Mark who you consider qualified, and the helper shows where their deliverables overlap, what only one person offered, what nobody offered yet, and whether their commitments add up to what the role needs. It suggests ways to share the work so no piece is held twice, and every piece can be moved by hand. It works by plain written rules, reads deliverables and commitments only, and never chooses, ranks or scores anyone. Each row opens that person's proposal with the suggested commitment typed into the counter-offer, and nothing changes until a person saves it there.

### What you must do

Nothing. To seat more people on a role than it has places, raise its number of places in the Org Chart first.

### Does it touch your data

No. There is no migration, and the new section only reads.

---

## 1.3.38 (2026-11-20)

### What changed for your village

- **The role in one minute.** Every role card opens with a short panel: the role's goal, its next three deliverables by date, and three facts (commitment, price, where). Each is said once on the card.
- **Five tabs on every role card:** The role, Deliverables, How we work, You and rewards, The path in. Old links to a piece still open the tab that holds it. On a phone, Apply sits in a bar along the bottom of the card.
- **The roles on one timeline.** The roles page draws each role as a lane, with today as one line through all of them and shared gates marked once. Tap a bar for its dates and what it feeds. "Dates as a list" is still there.
- **The timeline reads cleanly on a phone.** Today has a row of its own, gate names never cover each other and stay inside the chart, and the dotted lines sit exactly on their dates without crossing any words. On a phone the Apply bar is solid and appears once the role's goal has scrolled by, so the first screen shows the goal whole. A tab with nothing to show says so in one line, and the phone tab rail fades at the edge to show there is more.
- **A page for each role** at `/roles/<name>`, with a link to share it and a preview picture when the link is pasted. Old role links still work.
- **The village's shared goal** shows as its own banner on the card, and words like consent, steward and Founding Seeder carry a small tip the first time they appear. A village can add its own words in Admin.
- **Apply early for a role that is coming soon.** The waitlist comes first, then "Apply early". Reviewers see "An early application".
- **Start a conversation.** For someone short on time: name, email, a link to their work, a few lines on why, and up to three roles. A decider can turn it into a link to the full proposal.
- **Fewer words on the application.** The form is about a third shorter, with every consent and legal sentence kept. It opens with "6 steps. About 25 minutes. You can answer by voice." The confirmation says when we reply, taken from the village's own reply setting.

### What you must do

Nothing.

### Does it touch your data

No migration. A deliverable may carry an optional "feeds" line, stored with the role's existing data.

---

## 1.3.37 (2026-11-20)

### What changed for your village

- **Letters to the people waiting for a role.** The admin waitlist is grouped by role with a count. "Write to everyone waiting for" a role opens a draft with the role's name and card link filled in. Nothing is sent until a person presses a second button that names how many people it goes to, and one press reaches at most 150. Every letter carries a one-click link off the waitlist that the sender cannot remove, and the log keeps who sent what and when, with no addresses.
- **A box to say yes to letters.** The waitlist sign-up has an optional tick, unticked by default: "Yes, write to me about this role and other ways into the village. One click takes me off." Letters go only to people who ticked it, as ordinary mail that honours unsubscribes, Pause all and the daily limit. People who signed up before the tick existed are never written to. While Comms is in Preview or Off the send button stays closed and says which switch opens it.
- **A kind no.** A declined applicant's letter now ends with three ways to stay close: the waitlist, quests, and the resident path, in English and Spanish. It can be switched off.
- **A conversation guide for reviewers.** The role's selection criteria, worded as questions, with a notes box beside each. It has no score, rank or rating, only reviewers and the final call see it, and the notes are deleted with the review.
- **The nightly rehearsal follows the new role cards** and passes every act again.

### What you must do

Nothing. To send waitlist letters, Comms must be set to Members or Public.

### Does it touch your data

Yes, by adding only. Migration 0417 adds a table for reviewers' conversation notes, and 0418 adds two empty columns to the waitlist for the yes to letters and its date. The previous release ignores both, so going back is safe.

---

## 1.3.36 (2026-11-20)

### What changed for your village

- **Role cards read cleanly.** Where a role is held is said on one line. The last conversation in a role's path is called "the final conversation". The pay split has one heading. A card opens at the part you clicked, and on a phone the card's tabs sit in one row.
- **Short codes on the review page.** Every waiting proposal shows a short code in its corner: `B-27` is a batch and `B-27.2` the second change in it. Tap it to copy. A code is given when the proposal is filed and never changes or comes back. Older proposals are numbered in the order they were filed. A "Find a code" box opens the batch, rings the card and scrolls to it. Agents that propose changes get the codes back and cite them, and only a person accepts a change, as before.

### What you must do

Nothing.

### Does it touch your data

Yes, by adding only. Migration 0416 adds three empty columns for the codes, and the codes for older proposals are filled in the first time the review page or the agents' queue is read. The previous release ignores the new columns, so going back is safe.

---

## 1.3.35 (2026-11-20)

### What changed for your village

- **Room for seven minutes of talking, shown and never cut.** On the role application, "Why you, and why now" holds 8,000 characters and every box that takes voice holds at least 7,500 (about seven minutes of speech). The other applicant limits are tripled: answers, titles and lists. Every limit lives in one place (`shared/applyLimits.ts`) that the page, the server and transcription all read.
- **Nothing is cut without warning.** Text over a limit is kept in full and shown, and sending waits with a sentence saying how much to trim. Spoken words that would overflow a box are kept whole, with an offer to add them. Speech is no longer cut in any form on the site. Each limited box shows a counter at all times, with a calm notice at 80% and a stronger one at 95%, and a small "?" by each box explains the kinds of limit in plain words.
- **Recordings: up to 7 minutes each, and unmissable.** Beside the mic: "You can record up to 7 minutes each time." While recording, the time left is always shown. A gentle notice comes at 1 minute left, and a stronger one with a vibration at 30 seconds. At 7:00 the recording stops and keeps every word: "That's 7 minutes, the most for one recording. Your words are kept. Record again to add more."
- **Full uploads get through.** Files and recordings are written to disk as they arrive, so the server's memory is no longer the limit. Each file and recording now uploads on its own before the application is sent, so a slow phone connection stays inside the host's time limit for one upload. An application can carry up to 6 files, 6 recordings and 24 answer clips (doubled). Admins can see the server's memory, free disk and upload limits on a new capacity view.
- **The form grows with what people say.** Every box that takes voice is a multi-line box that grows to fit the whole answer.
- **"Remember my answers on this device" starts ticked**, with "On a shared device, untick it." beside it. A person who unticks it keeps that choice on that browser, and nothing clears a saved draft except the person's own untick or Forget.
- **Coming-soon roles go to their waitlist.** A coming-soon role cannot be applied for, alone or added to another role: its Apply link and the picker lead to "Join the waitlist for <role>" on the roles page, and the server refuses an application that names one.
- **References: at least two, we prefer three.** When references are given (leaving them all blank still means a background check), at least two are needed and up to six can be given on the form, ten on the status page. Members applying for their first long-term role are asked for references too. A member application's references are deleted 90 days after it is decided.
- The My Moon pay board names the contribution token in the village's own word.

### What you must do

Nothing is required. One migration (0415) widens the reference columns; it applies by itself at boot.

---

## 1.3.34 (2026-11-20)

### What changed for your village

- **The village's words can be proposed.** An agent working for the village can now put the village's own words (the vocabulary, such as what the contribution token is called, and the menu and notice wording) on the review page as a proposal. A person reads it beside the words in force and accepts or discards it, and "put it back" works on these too.
- **Seat terms wording can be read and proposed.** An agent can read a role's terms wording (the bonus wording among them, and the commitment) and propose new wording. It never sees or proposes an amount, a currency or a pay shape; everything else in the terms is written back exactly as the role holds it.
- **Agents can see what is waiting on the review page**, without the content: each item's batch, kind, summary and state. An agent can discard drafts it filed itself and no longer needs, so superseded drafts stop piling up for a person to clear.
- **Unchanged:** only a person accepts a proposal. Nothing that moves value, seats or unseats a person, touches secrets, powers, erasure or agent accounts, or sends a letter can be proposed by an agent. A design for letting a person delegate acceptance of wording changes is written up for decision (`docs/AGENT_ACCEPTANCE_DESIGN.md`) and is not built.

### What you must do

Nothing. Everything applies by itself. No migrations since v1.3.33.

---

## 1.3.33 (2026-11-19)

### What changed for your village

- **Role cards read as cards.** Lists show as bullets with the label before a colon in bold. "Why it matters" becomes "What {village} needs from you", with the village's shared lines first and then the role's own. "Not mine to hold" reads "Goes to the {circle}". "Bring me" sits beside what the role decides. The pay band, what it pays and "Value in equals value out." each appear once.
- **Dated deliverables, as a timeline.** A role can carry up to 12 dated deliverables (`sections.deliverables`), drawn as a timeline chart with a text list beside it; the founding team gets one combined chart. A card with no dated rows reads as before.
- **One shared rhythm, written once.** Four new village settings hold text every card shares: the shared lines (`org.role_card_shared`), the weekly and moon rhythm everyone attends (`org.role_card_rhythm`), the default onboarding steps (`org.role_card_onboarding`) and when the first review happens (`org.role_card_first_review`). Each card shows the shared rhythm first, then its own.
- **"Once you're selected"**, a new tab after "Holding it well", lists the onboarding steps (the village default, or the role's own).
- **Where the role is held, in the village's words** (`sections.where`), in place of the fixed on the land or remote label.
- **How to book each conversation** shows on the public card, from the interviewing role's own booking setting, which may now be a WhatsApp link or simply the word "whatsapp".
- **Coming-soon roles have a waitlist.** On the roles page they now sit under the open roles, each saying it is not open yet and may change, with a "Notify me" form: email, an optional WhatsApp number and which roles interest the person. Sign-ups are kept privately, readable only by admins, removed when a member is erased, and nothing is sent from them. The one-circle introduction shows only while the village has a single live circle.

### What you must do

Nothing is required. Fill the four new settings and the role cards' new sections when you are ready; until then cards read as before. One migration (0414) adds the waitlist table; it applies by itself at boot.

---

## 1.3.32 (2026-11-19)

### What changed for your village

- **No page can start before its words have arrived.** The crash that stopped applicants opening the role application in iPhone Safari (fixed for one page in 1.3.27) came from a page's code starting while it was still waiting for its English text. Seventeen more pieces of the site had the same shape. Now every page fetches its words first and only then starts, so nothing can be read before it exists, and a missing words file fails with a clear error instead of a blank. A new build check fails any release that brings the old shape back.
- **We hear about crashes before people tell us.** When a page shows its crash screen, it now sends one short report: what broke, where in the code, the page path and the browser. It never sends what was typed, what is saved on the device, links' query strings or anything personal. Admins see these on Village Health and get an alert, and repeats are rate limited.
- **Every release is tried in real browsers first.** A smoke test now renders 25 key pages in Chromium and in WebKit (the engine behind iPhone Safari) and sends one test application with a long answer, and the build fails if any page crashes or any email goes out. A test application is marked by a server-only token, checked like a real one and deleted at once: never emailed, never counted, never shown to reviewers.

### What you must do

Nothing is required. To run the browser smoke test against your own staging server, set `SMOKE_TEST_TOKEN` there (never on production); `docs/FORK_RUNBOOK.md` has the steps. No migrations since v1.3.31.

---

## 1.3.31 (2026-11-19)

### What changed for your village

- **The "moon" tip opens on the word you tap.** On a phone, when two dotted words sat on neighbouring lines (as on the role selection page), a tap on one could open or close the other's tip. A tap now goes to the word whose text is nearest your finger, and a tap no longer opens a tip twice. Keyboard focus still opens it.
- **Plain words when there is no signal.** Sign-in, the password pages and the member pages and panels showed the browser's own error ("Failed to fetch" or "Load failed") when the connection dropped. They now say "Nothing answered. Check your connection and try again.", and what was typed stays in place.
- **The application's safety net tells the truth about saving.** After a failed send, it said "Your answers are safe on this device" even when nothing was saved, because answers are kept on the device only when "Remember my answers on this device" is ticked. It now says so only when the answers are really stored; otherwise it says "Your answers are still on this page, so keep it open."

### What you must do

Nothing. Everything applies by itself. No migrations since v1.3.30.

---

## 1.3.30 (2026-11-19)

### What changed for your village

- **Room for honest answers in "Why you, and why now".** The role application's why box asks four things (what you have built before, why this role, why now, and what you would bring in your first month), and it held only 1200 characters. It now holds 4000, about 1000 for each prompt, and the counter, the voice drafts, the server's check and the drafting helper all read the same limit.
- **A long why is accepted all the way through.** When the village adopts a proposal, its why becomes the application's note, which was capped at 2000; it now holds 4000 too, so a why that was accepted when sent can no longer be refused at the decision. A voice clip spoken into the box keeps as many words as the box holds.
- **A saved draft loads whole.** Reading an applicant's saved answers on their device no longer cuts any text: the why, the story, the aim, the Human Design or Gene Keys answer and the value items come back exactly as saved.

### What you must do

Nothing. Everything applies by itself. No migrations since v1.3.29.

---

## 1.3.29 (2026-11-19)

### What changed for your village

- **A guided path from a role application to a decision.** Each open application's page now opens with a walkthrough: the stages (received, our review, shortlist, references, follow-ups and intuition conversations, final conversation, decision), who acts next by role, and one main action for each stage. A new admin desk lists every open application by stage, then by the date it arrived, with a count for each stage. Nothing ranks applicants, and nothing in this path calls an AI.
- **Shortlist.** After our review, a person who can place people in roles answers whether the application is shortlisted. A "no" only records the answer; a decline still goes through the usual decline and its letter.
- **References from people aligned with the work.** A shortlisted applicant gets one letter, in their language, asking for up to five references: people connected with this work who might also be allies or partners. They add them on their own status page.
- **Follow-ups by the right person.** Each reference starts with the village's follow-up role, and the team can give it to another role or a member. Only that owner writes the notes and marks it followed up. This runs alongside the intuition conversations; neither waits for the other.
- **Everything in one place for the final call.** The village's final-call role reads the scorecards, the references and the follow-up notes together, adds the final conversation, and then adopts or declines in the usual way.
- **References stay private.** Contact details reach only the reviewers, the final-call role and that reference's owner, and are removed with the rest of the application when it is anonymised or cleared.

### What you must do

Set two roles in Admin, Game Mechanics, "The village's people": the role that follows up references (`org.reference_followup_role`) and the role that makes the final call (`org.final_call_role`). Until the first is set, each reference waits for the team to pick who follows up. Until the second is set, the people who can place people in roles make the final call. One migration (0412) adds the references table; it applies by itself at boot.

---

## 1.3.28 (2026-11-19)

### What changed for your village

- **Member and applicant pages call the non-cash share of pay the village's contribution token.** No member or applicant page says "equity" for it any more. The name comes from a new word in Admin, Make it yours, "Your words for things": the contribution token. It reads in full in a sentence and short on a tile or a narrow cell (the full word without a trailing "Tokens"). With no word set, a village reads its token's registry name, unless that name says "equity"; then it reads "Contribution tokens". It is one token whether a contributor earns it or an investor buys it with cash, and the same token as its Hypha mirror.
- **Every mention carries a plain tip.** The contribution token's tip says what it tracks, that what it becomes is still being defined with legal advice, and that it is at risk. Village Credits carry a tip saying they are usage tokens, on the first mention in a passage.
- **Admin pages and the token registry keep their names.** The pricing desk, role pay, the Treasurer's and Finance desks, the review page, invoices and the server's words are unchanged.
- **End of Moon still pays the right share.** A pay share labelled with any of the token's names (the registry name, or the village's word in full or short) pays in that token, and a label that says "equity" is still read, so contracts stored before today keep working.

### What you must do

Nothing is required. To show your own name for the contribution token, set the word in Admin, Make it yours, "Your words for things". No migrations since v1.3.27.

---

## 1.3.27 (2026-11-19)

### What changed for your village

- **The role application no longer crashes on the voice step.** On iPhone and iPad (Safari, and in-app browsers such as WhatsApp's), /propose-a-role could show an error page instead of the form, at random, in a fresh browser too. The voice step's later half was loaded from two places at once, and Safari could start using it before it had finished loading. It now loads from one place, and the "Write down my words automatically" switch lives in the page's own code, so it is always ready. An applicant's saved answers on their device are not touched: reloading the page brings the form back with them.

- **A way out when sending an application fails.** If a role application cannot be sent (the connection drops, the send times out, or the server refuses for a reason the applicant cannot fix in a field), the page now says so and offers "Try again", "Download my application" (one file with every answer, made on the device) and "Email it to us". The email line shows only when the village has a contact email set (Admin, "Contact email for enquiries"). The saved draft is cleared only after a confirmed send. Every failed send now leaves one log line on the server, with nothing personal in it.

### What you must do

Nothing. Everything applies by itself. No migrations since v1.3.26.

---

## 1.3.26 (2026-11-18)

### What changed for your village

- **The moon tip opens on a phone tap.** On a phone, tapping a dotted "moon" did nothing, and a click drew a tip nobody could see. A tap now opens the tip and a second tap closes it. A tap or click elsewhere, a scroll or Escape also closes it. The tip now sits outside the card, so a dialog or a card cannot hide or clip it. On a phone it shows as a sheet along the foot of the screen; from 640px wide it sits over the word, or under it near the top of the page.
- **The phone's "How compensation is shaped" block says what the side panel says.** It shows the applicant's own split for each role, or the village's split in one line when there is none, and the one-line footnote about pay at risk. The village's longer pay note (`org.pay_shape_note`) and the old "Of this, ... we settle the split together" sentence no longer show on this step.
- **Choosing a role says moon.** The /roles/select page says "each moon and this season" and "Each moon you share what you'll bring the next moon", with the tip on "moon".
- **Journey steps wear the tip.** On the steward journey, a step or extra description that says moon now carries the tip on the word. Those descriptions are the village's own words, so the tip follows whatever the village wrote.

### What you must do

Nothing. Everything applies by itself.

### Does it touch your data

No. There are no migrations in this release and no stored data changes. `org.pay_shape_note` stays where it is; this step just no longer shows it.

Going back to 1.3.25 is safe. The database is the same, and 1.3.25 runs on it unchanged. You would only lose the changes above.

### Merged pull requests

- #1463 Moon word opens on a phone tap; phone terms say the rail's split; moon on the explainer pages

---

## 1.3.25 (2026-11-18)

### What changed for your village

- **Applicant pay and rhythm say moon, with a tip on the word.** Where an applicant sets or reads pay for a role priced per moon, every "moon" now carries a small tip: "We work in moon cycles, from new moon to new moon." It opens on hover, focus or tap and closes on Escape. It shows on the listed price and band, the commitment slider, the split total, the price ask and its popup, the Review & submit lines, the contract price and the value explainer. A role priced per month shows no tip. The explainer ("Each moon you recap what you delivered") and the goals list (first moon, each moon, mid-moon, "A day in this moon (optional)") say moon again, and so do the goal refusals. The "Adjust the price" dialog now loads the first time someone opens it, so the page loads lighter.
- **The words for notice kinds load when the bell opens.** Each notice kind's description and its batched line now load the first time a member opens the bell, or hovers or focuses it, so every page's first view is lighter. Until they load, a batched row reads a plain line with its count ("6 more notices."). How notices are sent, grouped, emailed and counted does not change.
- **Season places, a new module that ships off.** A village that does not turn it on sees no change.
  - Season crew: every season starts fresh. A member applies for the running or next season, naming a circle or none. Each circle's picker, the holder of the role named in `season_crew.picker_role` (or the circle's crew when it is blank or nobody holds it), picks from everyone who applied, up to the number of places the circle sets for that season. Two circles cannot pick the same person. With `season_crew.needs_place` on, a circle needs a season place before it picks.
  - Circles taking part: a circle proposes to take part in a season. A seat holder outside the circle adopts it, declines it or puts it to the village; with no such holder, a village ballot opens at once. `season_places.who` sets whether circles or single members take part, and `season_places.free_after` lets a circle that has served that many seasons skip the proposal.
  - A cap with a waitlist: `season_places.cap` sets the places in a season (blank is no cap, 0 is none). Over the cap a circle waits in order, takes the first place that frees, and its crew is told. Raising the cap fills the new places within the hour; lowering it removes nobody.
  - Circles at a gathering: a holder of `event.manage` can let a one-off gathering take circles, with its own cap and waitlist, and can require a season place. A circle's picker signs it up. People still answer the gathering as people.
  - What a role asks first: `roles.prerequisites` lets a role ask for paid products or finished quests before anyone applies, up to 12 items. The door names each missing item, and a reversed payment does not count.
  - Three new member pages: joining the season, the season's circles and gatherings, and a role's path (what it asks first, who holds it, its fee in the village's currency). Every number is a game variable the village can propose and vote on.
- **Proposals for several roles, the follow-up to 1.3.24.**
  - The draft saved on the device keeps the roles added to a proposal, each with its commitment, price and split.
  - The goals belong to the proposal and count for every role. Deciders no longer see "No goal" for an added role, and each role's agreement carries the proposal's goals.
  - Deciders can counter each role's price, and the commitment of every role after the first. "Terms we offer" shows one row per role. The applicant answers these with the other changed terms, and adopting warns while a countered value is not yet agreed. An agreed countered price becomes the contract's price, held to the same 120% cap as a price ask.
  - Putting a proposal to the village opens one ballot for all its roles. The ballot names every role, and when it closes every role's application is settled together. A candidate who withdraws one role takes the vote with it, and the other roles go back to waiting for a decision.
  - Review & submit shows each role's price and split, and the prices added together. The apply page's side panel shows the applicant's own split for each role in place of the fixed share tiles.
  - The "Choose a role" picker offers open roles, held roles still recruiting (marked "More players welcome") and roles coming soon (marked "(coming soon)"). It never offers a fully held role.
  - The role card's footnote says each thing once: "*At 100% commitment. Your first moon starts lower and follows what you deliver. Equity and credit terms are still being written and are subject to legal review."

### What you must do

Nothing. Everything applies by itself, and season places stay off until your village turns them on. If you mean to go back to 1.3.24 later, read the cases below first.

### Does it touch your data

Three migrations, all for season places.

- `0408_season_places.sql` adds two new tables, `season_places` and `season_place_locks`.
- `0409_event_circle_places.sql` adds two new tables, `event_circle_settings` and `event_circle_places`.
- `0410_season_crew.sql` adds two new tables, `season_crew_applications` and `season_crew_berths`.

They add six tables and change no existing table or row. Proposals for several roles need no migration: a role's counter-offer is kept in the counter-offer as `roles`, and the applications one proposal makes are linked in their answers as `together`.

Going back to 1.3.24 is safe. 1.3.24 never reads the six new tables, lists the season places module as unknown and ignores it, and never reads the two new keys. Four cases to know about:

- A counter-offer on a role's price or later commitment is not seen on 1.3.24. If a decider edits the counter-offer or the applicant answers it on 1.3.24, the role counters are dropped, and adopting on 1.3.24 ignores them. Settle countered proposals before going back.
- On 1.3.24 the applications of one proposal go to separate votes again. A ballot already open for the group still closes, and 1.3.24 settles only the application it was opened on, leaving the others with no vote of their own. Let those votes close before going back.
- A season places ballot that closes on 1.3.24 is marked done without placing the circle. Let open season places ballots close first.
- On 1.3.24 the season places pages, their waitlists and the role prerequisites stop working; the data stays, and comes back on 1.3.25.

### Merged pull requests

- #1459 Applicant pay and goals say moon, with a tooltip on the word
- #1458 Load notice kinds' words when the bell opens, off every page's first view
- #1371 Season places: season crew picked by each circle, a cap with a waitlist, circle caps per gathering, role prerequisites (0408-0410)
- #1461 Open proposals, multi-role follow-up: draft keeps added roles, goals for every role, counter-offers per role, one vote for all roles

---

## 1.3.24 (2026-11-18)

### What changed for your village

- **A role held with no application owes nothing until the Treasurer agrees terms.** Settlement used to owe every person seated on a role that states cash, with no adopted application behind the seat, the role's whole cash amount every cycle: no proposed price, no commitment, and nobody confirming it. That step is gone. Such a person is now owed nothing for the role until the Treasurer agrees terms with them through an application the village adopts; after that, their End of Moon invoice is confirmed like anyone else's. A new recommended launch row, "Set terms for roles held without an application", names those roles and links to Cash To Pay Out. It only reads; it changes nothing. People who hold a role through an adopted application are unchanged.
- **A village admin acting as themselves is no longer throttled on role edits and draft decisions.** The per-person limits on the role editor, on publishing a draft by power and on the arrangement door no longer apply to a person who is a village admin. That includes the role cards applied one by one when an admin accepts a batch of proposed changes, which used to count against the admin's limit of 30 role saves. An agent keeps every limit, even one holding an admin's grant: a request through the connector, one made with an agent token, or an account marked as an agent. Every other limit is unchanged.
- **When a decider accepts, the applicant's proposed split goes into the contract.** If the applicant changed the split and it still fits the role's shape (the same shares in the same order, whole percents adding to 100), the contract records their split. Otherwise it records the split the card showed, as before. The contract's amount does not change; End of Moon shares it by these percents. On the role card, the fixed split tiles (for example 60/40/0) are gone wherever the editable split shows, so there is one place to read and change the split. Inside an application and for deciders, where the split cannot be edited, the tiles stay.
- **Launch security rows, and the issuance cap after launch.**
  - A new blocking launch row, "Keep the founder password long, or unset". It passes when `ADMIN_PASSWORD` is unset, because both ways in it opens then stay shut, or when it is at least 20 characters. It fails when the password is blank, still the placeholder, or shorter than 20. The row never shows the password or its length.
  - A new recommended launch row, "Keep a way back in", checks that `BREAK_GLASS_ADMIN_EMAIL` is set. It never shows the address.
  - Once the Game starts, the cap on hand-minting each cycle (`ledger.admin_mint_cycle_cap`) changes only by the village's vote, or by a founder-steward who broke the glass. Before launch the founder sets it as before.
  - The issuance cap's wording is now exact: it names the five doors the cap refuses, says the other doors that mint are counted and never refused, and says work pay and the gratitude pool are not counted.
- **Funding rounds, the rulings on step four. The module still ships off.** A village that has not turned funding rounds on sees no change.
  - A new pot counts every member's whole Voice by default. Counting only Voice earned through work is still there, and a holder of `pot.steward` switches a pot between the two. Existing pots keep what they count.
  - While a round's divergence vote runs, the larger of the two sides' costs is held back from the pot's free money, so another round on the same pot cannot spend it first. Settling the vote releases it.
  - A carried divergence vote now takes effect when the round closes.
  - A member who joins after the round's Voice froze can still tick. Their tick is a signal with zero Voice, counted in neither count nor the quorum, and the page tells them so.
- **Caps on voting weight by source, off by default.** A village that weighs votes by a token can now cap how much of one member's balance a ballot counts from cash put in, and separately from every other contribution. Each cap has its own switch and whole-token number (`governance.weight_cap_cash_on` and `governance.weight_cap_cash`, the same pair for other), set by the founder before the Game starts and only by a proposal after. The cap is counted when a ballot opens and never at the mint, so the ledger keeps every contribution in full, and raising a cap counts the full balance again from the next ballot. Each ballot's roll records the figures each weight was counted from, so anyone can check it. A hand-mint now asks whether it was cash or another contribution, and the grants list shows it; a grant waiting for a co-sign keeps its tag. A former member's standing now says their Voice is resting and that a ballot counts none of it until they are admitted back, in place of a weight no ballot would give them.
- **One proposal for up to three roles, across circles.** A person can now propose for up to three roles in one proposal, in any circles. Each role has its own commitment, price and split, and the page shows the total across them; the prices add up. Deciders review each role's terms, the minimum and the hidden cap are judged per role, and when the proposal is adopted the village writes one agreement for each role, in one step.

### What you must do

- **If your village pays anyone automatically for a role they hold without an application, that payment stops on this release.** Before you upgrade, look at who settlement pays for a role that states cash with no adopted application, and settle any cycle you mean to pay the old way. After the upgrade, open the launch row "Set terms for roles held without an application" (or Admin, Cash To Pay Out) to see those roles, and have the Treasurer agree terms with each person through an application the village adopts. Until then they are owed nothing for the role. Tell them first, so the change does not reach them as a missing payment.
- **Check the founder password.** If `ADMIN_PASSWORD` is set and shorter than 20 characters, or still the placeholder, the new launch row fails. Make it at least 20 characters, or delete it if nobody needs the founder-password way back in. Set `BREAK_GLASS_ADMIN_EMAIL` if you have not.
- **After launch, the hand-mint cap moves by vote.** If you meant to change `ledger.admin_mint_cycle_cap` yourself after the Game started, it now goes to the village as a proposal.

Everything else applies by itself. The caps by source stay off until your village turns them on, and funding rounds stay off unless your village turns them on.

### Does it touch your data

Two migrations.

- `0403_a_pot_counts_all_voice.sql` changes the default of `funding_pots.counted_voice` to `all` and adds one nullable column, `funding_rounds.reserved_minor`. It changes no existing row: a pot keeps the count it holds.
- `0407_weight_caps_by_source.sql` adds four nullable columns to `ballot_electorate` (`held_weight`, `held_cash`, `cap_cash`, `cap_other`) and one column to `admin_mint_requests`, `contribution_kind`, NOT NULL with the default `other`. The four are empty on every ballot opened before this release and on any ballot opened with no cap by source. Every waiting hand-mint request reads `other`, which is what every hand-mint meant before the tag existed.

Neither removes or narrows anything. No migration came with the other changes.

Going back to 1.3.23 is safe. 1.3.23 names its columns when it writes a pot, a ballot roll or a hand-mint request, so the new columns take their default or stay empty, and it reads a pot set to count all Voice as it always could. A proposal with more than one role stays readable on 1.3.23, because the first role's terms sit where a one-role proposal keeps them. Four cases to know about:

- A proposal with more than one role that is adopted on 1.3.23 becomes one application for all its roles, priced from the first role with a band at the first role's commitment, with the card's split. Decide those proposals before going back, or wait to adopt them until you are on 1.3.24 again. 1.3.23 also refuses a new or edited proposal with more than one role.
- On 1.3.23 a hand-seated holder of a cash role is owed the role's cash again at the next settlement.
- With funding rounds on, 1.3.23 ignores the money held back for a running divergence vote, so another round on the same pot could spend it. Let any open divergence vote settle first.
- With a cap by source on, 1.3.23 counts whole balances on ballots it opens, and a cash-tagged hand-mint request approved on 1.3.23 posts as an ordinary hand-mint.

### Merged pull requests

- #1450 A role held with no application owes nothing until the Treasurer sets terms
- #1453 Uncap a village admin's own role edits and draft decisions; agents stay throttled
- #1454 Adoption writes the applicant's proposed split; the editable split replaces the card's split tiles
- #1455 Launch security checks: admin password floor, break-glass presence, issuance cap after launch
- #1456 Funding rounds S4 rulings: all Voice by default, divergence lands at close, held quests reserve money, newer members signal
- #1368 Cap voting weight by source (cash, other), counted at ballot open; resting Voice shown
- #1457 Open proposals: several roles in one proposal, each with its own commitment, price, split and agreement

---

## 1.3.23 (2026-11-18)

### What changed for your village

- **"Holding it now" on /roles is a roster, with the org chart beside it.** Each person who holds a role has one card: a gold crest with their initial (never a face), their first name, their circle as the team, and every role they hold. People are listed alphabetically and no card carries a number, score or rank. A role the village names nobody for keeps its own "Filled" card, and an agent gets one marked card per role. Beside the roster, a small picture of the org chart (the one from /circles) links into /circles; on a phone it is one row, for example "See the org chart / Anchor Circle: 9 held, 3 open". The Team sheet and Formation views, the tally, the filters and every other section of the page are unchanged.
- **Applicant screens say month, and promise no home.** On the role card and in the application's goals step, applicants now read "month" where they used to read "moon": "Each month you recap what you delivered, and pay follows what you deliver", "Your goals for your first month in" the role, and "Add at least one goal for your first month." The equity line now reads "a share of ownership in the village", with no promise of a home. A role whose price is set per moon still shows "a moon" on its price and band lines, because a moon and a month are paid differently; that wording waits for a decision.
- **A held role that is still recruiting keeps its Apply.** When every place in a role is taken but the role is still recruiting, it stays with the held roles and shows "More players welcome" and an Apply link, on its roster card, under a lead's card and on the open card in the directory. The village now accepts an application to such a role. Nobody is seated past the role's count: adopting the application still waits for a free place. A full role that is not recruiting still refuses applications, as before.
- **An End of Moon invoice paid with no cash reaches Paid.** An approved invoice whose every line is paid in Earned Equity and Credits, with no cash share, used to stay at Approved forever, because only a cash transfer ever marked an invoice Paid. It now turns Paid once every token share it owes has posted, or at approval when it owes none, and the member gets the usual notice. Nothing new moves tokens; the shares still post the way they always have. An invoice with any cash share still waits for its cash transfer.
- **The role card's slider and the application, fixed after the 1.3.22 check.**
  - The ramp-up box ticks only from the box and its words. Before, a tap anywhere on its tile could tick it, which on a phone happened by accident under the new split fields. Moving to another role starts the box unticked.
  - The slider's band line shows at every commitment, 100% included, for example "Band at 100%: $9,623 to $12,029 a month in total comp".
  - "At N%, the suggested price is ..." follows the slider. At 100% the sentence is left out, because the listed price already says it. Inside an application, it uses the commitment the person chose, else the role's minimum, in place of a fixed 50%.
  - The line telling a person to send one application for each role is gone, since an application carries one role. It now says: "Each role is priced at the commitment you give it, and the prices add up: two roles at 50% are rewarded like one whole role."
- **The Treasurer's Cash Budget has its page.** Admin, Money and agreements, now has a Cash Budget tab, and every member can open /budget, reached from the account menu and the Treasury page. Everyone sees this moon's cash budget: planned, already promised and left, each line, and why any line is not counted. The holder of the pay role (role.pay) also gets the editor: upload a CSV file or cells pasted from a spreadsheet, preview what will be added, changed and withdrawn, then save; add or edit one line; withdraw and restore a line. A refused row shows the server's own sentence, by row and cell. There is no screen yet for rate locks, period notes, source switches, circle envelopes or a moon other than the current one.
- **Funding rounds, step four. The module still ships off.** A village that has not turned funding rounds on sees no change. In a round, the power count now weighs each member only by Voice earned through work; Voice from donations, investment and backing counts for nothing there. When choosing opens, the roll and each member's counted Voice are written down once, and the harvest counts only those frozen figures. A member who joins after that cannot tick in that round. If the power count and the people's count fund different quests, the quests both counts fund go ahead at once, the disputed ones are held, and a 48-hour village vote on the ordinary ballot decides them: carried, the other count funds its side; anything else, the pot's deciding count does. The round page shows a member their own frozen Voice, "Held for the village's vote" and the vote's state.

### What you must do

Nothing. Every change above applies by itself. Funding rounds stay off unless your village turns them on, and the module is still held for review.

### Does it touch your data

One migration, `0402_a_round_freezes_its_voice.sql`. It adds a new table, `funding_round_voice`, and six new nullable columns on `funding_rounds` (when the Voice froze, the mint sources it could not classify, and the divergence vote's ballot, result, note and settled time). It changes no existing row and removes nothing. On a village that has never run a funding round, both stay empty.

Going back to 1.3.22 is safe. 1.3.22 never queries `funding_round_voice`, it reads a round through a list of the fields it knows, so the new columns are ignored, and it creates a round by naming only the columns it knows, so the new ones stay empty. An invoice marked Paid, and an application sent to a full role that is recruiting, use states 1.3.22 already knows. Two cases to know about, only for a village that turned funding rounds on: a round that harvests on 1.3.22 counts the old way, from live ballot weight, and ignores its frozen Voice; and a divergence vote still open when you go back closes on 1.3.22 with nothing carried out, so its held quests stay held. Let any open divergence vote settle before going back.

### Merged pull requests

- #1444 Roles: holding it now as a roster, with the org chart beside it
- #1445 Role card and apply flow: month in place of moon, no home promised
- #1446 Roles: a held role that is still recruiting keeps its Apply
- #1447 Pay: a 0%-cash End of Moon invoice reaches Paid once its token shares issue
- #1448 Slider and apply flow fixes from the 1.3.22 check
- #1449 Give the cash budget its page: Admin tab and /budget
- #1451 Funding rounds S4: work-only Voice, a snapshot frozen when choose opens, and the 48-hour divergence vote

---

## 1.3.22 (2026-11-18)

### What changed for your village

- **A role card that can be shared has a commitment slider, and the pay band follows it.** On a role that one person can take at less than full time, the card's Rewards piece now has a "Your commitment" slider in the same steps the application accepts. Below 100%, while the village shows pay ranges, the band under the listed price is worked at that commitment, for example "Band at 60%: $5,773 to $7,217 a month in total comp". A role that takes a whole person shows no slider, only the split below.
- **A person can change the cash, equity and credits split and send it with their application.** Under the slider, the card shows how the total is split into the village's own shares (the role's split, else the village's). Each share has a percent field and, when the reader may see the price, an amount field: typing a percent updates its amount, typing an amount updates its percent, and the other shares move in proportion so the split still adds up to 100% and to the total. "Use the village's split" puts it back. The card says plainly when a total sits above or below the band. The Apply link carries the commitment and a changed split into the application's price step, which has the same control, and Review & submit shows "Your split". The server checks the split against the role's shares and price and saves it with the application, together with the split the village offered at that commitment, worked by the server and never taken from the form. No 120% cap amount is shown anywhere in this; the server still refuses a price over the cap.
- **The people deciding see the offered split beside the proposed one.** An application that carries a split shows a "Cash, equity and credits" table with each share as offered and as proposed, percent and amount. A split the applicant changed carries a "Split changed by applicant" badge and its changed shares are marked; an untouched split shows no badge. Nothing ranks or judges the change, and the contract still sets the pay.
- **The village connector says plainly what it never sends.** Its instructions to an agent, the sign-in page a member sees when connecting one, and its documentation now say it never sends money or recaps, approves, issues or pays anything. Before, they said it never sends anything, which stopped being true once a handed-on task started emailing the role's holders. Nothing the connector can do changed.

### What you must do

Nothing. The slider and the split appear on role cards by themselves, using each role's split in force and the village's pay range setting. A village that hides pay ranges still hides the band.

### Does it touch your data

No migration. An application sent on 1.3.22 with a split keeps it as one more key, `paySplit`, inside the application's existing stored body, beside the other answers. Anonymising an application removes it, as it removes the price the person asked for.

Going back to 1.3.21 is safe. 1.3.21 reads each application's body through a list of the keys it knows and leaves the rest alone, so an application carrying a split opens, is decided and is invited as before, and its split stays stored without being shown. 1.3.21 changes stored applications only one named key at a time, so it never writes the split away. One difference while on 1.3.21: anonymising an application does not remove its split (shares and amounts, with no name or address), and a later 1.3.22 does not go back over an application already anonymised.

### Merged pull requests

- #1441 Role card commitment slider and an editable cash, equity and credits split that carries into the application
- #1442 Connector says plainly what it never sends

---

## 1.3.21 (2026-11-17)

### What changed for your village

- **The review page lists waiting changes oldest first, and flags changes that write the same thing.** Waiting batches and the changes in them now read from the oldest proposal to the newest, and the page says so. The history of decided changes stays newest first. When two waiting changes write the same thing (the same page words, setting, role card field, variable, season goals and so on), each card names the other one and a summary at the top counts them. A change is marked stale when something accepted after it was proposed wrote the same thing, and its card says accepting it would put back older words. Accepting a change that a later one also writes asks once on its card, and Accept all says so in its one question. Nothing is blocked or rejected: the reviewer decides.
- **Making a role from the review page explains every refusal.** Accepting a proposal that makes a new role could show "Internal server error", and a retry then failed again on the role the first try had already made. Now every problem is checked before the role is saved (an unknown or dormant circle, an id already in use or retired, a name or field that is too long, seats, order, criticality, yes-or-no fields, accountabilities and the card's parameters) and each one answers with a plain sentence. The same checks run when the proposal is filed and again before it is accepted. A retry whose earlier try already made the same role is recorded as done, with a note, so nothing is made twice. If the role is saved but something after it is not (a value, or a season pattern), the accept succeeds and the review page shows a warning saying what was left out. A failure with no sentence now shows a short reference the steward can quote, and the detail is in the server log.
- **The voice step writes down recordings with no key needed, and plays on every browser.** The image now carries its own speech-to-text (whisper.cpp with a small multilingual model), so a village transcribes recordings on its own server, with nothing sent anywhere. For speed, an admin can paste a free Groq key under Admin, Integrations; an OpenAI key also works, and the picker there shows which service is in use or turns transcription Off. Applicant takes and the short clips beside answers are written down automatically, behind a clear "Write down my words automatically" switch the applicant can turn off; words they typed are never written over. Admins and the people deciding get "Write down the words" beside each kept recording and a "Transcribe all waiting" button; those words are saved labelled as an AI transcript the applicant has not checked, and deleted with the recording. Recordings stop clearly at 5:00, Safari plays an MP4 copy, and the player shows a new take's full length before play. Takes and clips have separate limits.
- **A role card shows its pay band, and explains how pay is set.** When a village shows pay ranges, the Rewards piece reads the band under the listed price, for example "Band: $9,623 to $12,029 a month in total comp". A "Value in equals value out." callout opens a short explainer of how the price is set, the contractor agreement and what the village is aiming for. The proposal cap (120% of the listed price) is still enforced but no longer shown to applicants as an amount, on the card, the price step or Review & submit.
- **A circle can keep several named meetings.** A circle that meets more than once a week, for example "Monday all-staff" and "Thursday steward sync", can now set a rhythm for each, with its own name, day, time and length. Its existing rhythm stays as its first one. An agenda item can wait for one named meeting, or for the circle's next meeting whichever it is, as every existing item already does. A circle's own calendar can be read through a title word, so only events whose title carries that word count; blank keeps every timed event, as today.
- **Agenda items can be proposed for review.** A new proposal kind, `session_agenda`, carries agenda items for a circle. Accepted with a meeting named, they go on that meeting's agenda; with none named, they land on the circle's open agenda, which works for a circle with no rhythm at all. The connector can read the circles' meetings to fill one in.
- **A member's own AI agent can add agenda items.** A new connector scope, `sessions.write`, opens one tool, `add_agenda_item`: an item in the agenda library for a circle, or for none in particular, added as the member after their yes to the exact item. It brings nothing into a session and changes no agenda already set; a person does that in the room. Nothing changes until a member ticks the scope when they connect their agent.
- **A member's own AI agent can hand a task to a role.** The connector tool `hand_task_to_role`, under the existing `tasks.write` scope, sends a new task to a role exactly as the profile's form does, after the member's yes to the exact task and role. The role's holders still accept, suggest a change or decline it; nothing is accepted on its own.
- **A task handed to a role arrives by email.** Being handed a task, and a suggested change or a decline on one you sent, now follow the member's Task emails preference (immediate by default). An accept and a done go in the daily digest. Before, all five showed in the bell only. A member who set Task emails to Off hears nothing new.
- For maintainers: a release can now be tagged by running the `tag-release.yml` workflow with the version. It checks five things before it tags: the version is a plain X.Y.Z, the commit is on main, `package.json`, `PLATFORM_VERSION`, a changelog section and the compose file's default image all name it, no such tag exists yet, and CI passed on a push run at that exact commit. Then it pushes the tag and the usual release build runs. Villages see no difference.

### What you must do

Nothing, but know that voice transcription is now ON by default: recordings are written down on your own server with no key, and nothing leaves it. To stop it, choose Off under Admin, Integrations. The image is about 70 MB larger for the speech model. Each circle's existing rhythm, agenda items and attached calendars keep working as they did. The `sessions.write` scope is offered only when a member connects their agent.

### Does it touch your data

Yes, one expand-only migration:

| Migration | What it does | Does going back to 1.3.20 undo it |
|---|---|---|
| `0401_a_circle_keeps_several_rhythms` | Adds a new table for a circle's further rhythms, and three columns that start blank: a name on each existing rhythm, the meeting an agenda item waits for, and the title word on a circle's calendar. Changes no existing value. | No. The new table and columns stay, and 1.3.20 ignores them, so going back is safe. Each circle keeps its first rhythm as before; rhythms added on 1.3.21 wait unread, and agenda items tied to one meeting show for the circle's next meeting. |

### Merged pull requests

- #1431 Review page: oldest first, and flag changes that write the same thing
- #1432 A new role from the review page: a sentence for every refusal, and no failure for a role that stands
- #1433 Voice step: written down on every browser, played on every browser, cut off clearly at 5:00
- #1434 Several named rhythms per circle, agenda items for one meeting or the open agenda, a calendar title filter, and the session_agenda proposal kind
- #1435 Connector agenda tool (sessions.write) and handoff emails
- #1436 Tag a release by dispatching tag-release.yml
- #1437 Connector tool hand_task_to_role (tasks.write)
- #1438 Role card pay band, the Value callout, and no cap amount shown to applicants
- #1440 Voice step: transcription with no key (on-server Whisper), Groq free tier, automatic with an opt-out, transcribe kept recordings

---

## 1.3.20 (2026-11-17)

### What changed for your village

- **An accepted change can be put back, by the same review.** On the review page, an accepted change now keeps what was live just before it, and its card offers "Propose putting it back". That files a new proposal carrying the earlier value, marked "Puts back an earlier change". It changes nothing by itself: someone accepts it like any other proposal. Some changes cannot be put back this way, and the card says why in one line: a change that made something new or took something away, season goals, a field the change added, a change accepted before this release (nothing was kept then), and a change that already has a put-back waiting.
- **Each side of the no-sign band is its own village setting.** The band is the range around the valuation engine's suggested pay or price where one person's word is enough. It was the same distance under and over the suggestion. Two settings in Admin now set each side: "How far under the suggestion one person may set pay" (`valuation.band_below_pct`) and its partner for above (`valuation.band_above_pct`), each a whole percent from 0 to 100. Setting 20 under and 0 over, for example, gives a band from 80% to 100% of the suggestion. Both are blank by default, and blank follows the valuation model, so the band stays where it was. The role pay screen and the pricing desk now say the band in words.
- Two form tests now wait for the coming-soon note, which loads after the form. Villages see no difference.
- **The voice step on a role proposal keeps every recording.** When the browser ends a recording on its own (a call, another app, the screen locking), the take is kept and the card says why, where before it could freeze on "Stop recording" with nothing to play. A take that reaches the five-minute limit says so. A browser with no speech engine, such as Firefox, says so when recording starts, and the recording still counts on its own. Safari records in its own format, words are no longer dropped when the live transcript pauses, a recording that cannot play offers "Save a copy", and leaving the page while recording asks first. Recordings are about half the size they were, so five minutes is about 2.5 MB.

### What you must do

Nothing. Both band settings start blank, so nothing moves until a village sets one. Accepted changes from before this release show "nothing kept" and offer no put-back.

### Does it touch your data

Yes, one expand-only migration:

| Migration | What it does | Does going back to 1.3.19 undo it |
|---|---|---|
| `0400_a_proposal_keeps_what_was_live` | Adds two empty columns to proposed changes (what was live before an accept, and which change a proposal puts back) and an index on the second. Changes no existing value. From now on each accept fills in the first column. | No. The columns and the index stay and 1.3.19 ignores them, so going back is safe. Values kept while on 1.3.20 stay in place. |

### Merged pull requests

- #1421 Review page: propose putting an accepted change back
- #1427 Batch 191: ProposeARole tests wait for the lazy note (#1426)
- #1428 Let a village set each side of the valuation engine's no-sign band
- #1430 Voice step: keep every take, say why it stopped, and work without a speech engine

---

## 1.3.19 (2026-11-16)

### What changed for your village

- **Roles can show as Coming soon, Future venture, Held or Unlisted, besides Open.**
  - **Coming soon** roles are listed under the steward who leads their circle, as "Roles this steward will build", with a Coming soon tag. People can apply now through the same form. The card, the form and the confirmation all say: "We're focused on our three lead hires first. You're welcome to apply now; interviews for this role may take a little while to start."
  - **Future ventures** have their own section, with no lead. The card, the form and the confirmation show the five parts of a pitch.
  - **Held** roles show as held, with no Apply button.
  - **Unlisted** roles stay hidden, as before.
- **In Admin:** each role card has a "Who sees this role" choice and a circle picker. Moving a role keeps its id and history. Each circle has a "Lead role" picker, which decides whose list its coming-soon roles appear under. A circle with nothing left to show disappears for visitors.

### What you must do

Nothing. Every role keeps the state it had. Nothing becomes Coming soon or a Future venture until someone sets it.

### Does it touch your data

Yes, one expand-only migration:

| Migration | What it does | Does going back to 1.3.18 undo it |
|---|---|---|
| `0399_a_role_can_be_coming_soon` | Adds two role columns, coming soon and future venture, both off by default. Changes no existing value. | No. The columns stay and 1.3.18 ignores them, so going back is safe. |

### Merged pull requests

- #1424 Batch 190: roles coming soon and future venture (#1419)

---

## 1.3.18 (2026-11-17)

### What changed for your village

- **Interviews book with the person who holds them.** Each member can save their own booking link on their profile. An applicant's next conversation now offers the link of whoever holds that interviewing seat, named as "Role (First, First)", then the role's own link, then "We'll write to you with times". No email address is ever shown. Every scorecard now asks for a gut answer (yes, no or not sure, with one optional line). It is required, the applicant never sees it, and nothing counts it.
- **Role applications cannot be missed.** Admin's Today counts and lists every waiting role application, from people with an account and from people without one, with a link straight to each. The Inbox shows the same list.
- **Each role card chooses who sees its listed price.** It can follow the village switch (the default, so nothing changes until someone picks), show the price to everyone, or hide it from all but admins and the card's editors. A new village setting, off by default, can show each share's amount ("up to this much in cash and this much in equity a month").
- **Hand a task to a role.** From their profile a member can send a task to one of the village's roles, with a note and an optional date. The role's holders accept it, suggest a change, or decline with a reason. The sender hears each answer and sees where every task they sent stands.
- **Priorities everyone can see.** Each person shares one top priority a week, set on their profile or in the Monday meeting, and Friday's meeting marks it done, partly or carried over. The season's group priorities sit on one ordered board that the circle orders by vote. Whoever raised a tension with a role can see its place in that role's line and roughly when it will be picked up.
- **The review page for proposed changes is easier to read.** Each batch and each change shows as a card, with the change as before and after, plain flags (a public page, money words, a calendar event and the like), filters, and a history of what was decided and by whom. Accepting works as it did.
- **Season goals keep their links when reworded.** Rewording or moving a goal in a proposal keeps it the same goal, so the quests, moon items and tasks linked to it stay linked. An admin can also move links left behind by an earlier rewording onto the goal that replaced it.
- **Rites and invitations** (a new module, off by default): rites the village names, spoken ones sworn in a ceremony with witnesses present or on a call, a mark each member draws, a buddy beside each newcomer, an inviter's own line on an invitation, and a member's lasting door code for a printed QR.
- **Fonts load only from places the village trusts:** its own uploads, Google Fonts and the village's own site.
- **Smaller fixes.** A member's cash owed shows its cents, the same figure the Treasurer sees. A quest valued at zero shows what it pays and no longer reads "Worth $0.00". The public game rules page no longer says money can buy tokens in a village where the exchange is off. On the hidden map, a paid planting needs its own photo and two members vouching, with at most 5 a week (a dial). Only the person who started a protocol run, or someone who ticked a step on it, can end it.

### What you must do

Nothing. If you want applicants to see a different price on a role card, or each share's amount, set it in the role editor under "The listed price on the card".

### Does it touch your data

Yes, one expand-only migration:

| Migration | What it does | Does going back to 1.3.17 undo it |
|---|---|---|
| `0393_rites_and_invitations` | Adds 9 new tables for rites and invitations. Changes no existing table or value. | No. The tables stay and the previous release ignores them, so going back is safe. |

### Merged pull requests

- #1390 Rites and invitations (module, off)
- #1394 Game Mechanics says nothing about buying tokens where the exchange is off
- #1400 A quest valued at zero shows what it pays
- #1406 Batch 186: Protocols and Hidden map audit follow-ups
- #1409 Batch 187: members see cents (#1407)
- #1410 Season goals proposals keep goal ids when a goal is reworded or moved
- #1411 Book each conversation with its interviewer, and add a gut check to the scorecard
- #1412 Give each role card its own say over who sees its listed price
- #1414 Hand a task to a role: holders accept, suggest a change, or decline
- #1415 A season's goal links move off a goal id a rewording replaced
- #1416 Priorities everyone can see: weekly top priority, a priority board, an ask's place in line
- #1417 Review page as cards: batches, before and after, flags, filters, history
- #1418 Batch 188: role applications on Admin Today and Inbox (#1413)
- #1420 Batch 189: font hosts allowlist and the Spanish online-voice line (#1408)

---

## 1.3.17 (2026-11-16)

### What changed for your village

- **Only the person who proved an email address can take an applicant's role.** An account that signed up with someone's address but never confirmed it now counts as no account: adoption sends the real invitation, and that invitation takes over the unproven account. A link handed to the person adopting no longer proves the address; only a link that went by email does. When email is set up, the adopter no longer sees the link at all.
- **The hidden map is complete** (still off by default, members only): its page, where a photo's location is read for the pin and then stripped from the image; return visits that can open a claim on a quest the village names; and capture with no signal, kept on the phone and sent when signal returns.

### What you must do

Nothing.

### Does it touch your data

No migration. Going back to 1.3.16 is safe.

### Merged pull requests

- #1378 Hidden map, slice 2: the page
- #1380 Hidden map, slice 3: return visits
- #1382 Hidden map, slice 4: capture with no signal
- #1403 Batch 185: applicant identity (#1354)

---

## 1.3.16 (2026-11-16)

### What changed for your village

- **A Treasury page for whoever holds the money powers.** `/treasury` opens to members who hold `token.mint`, `cash.pay` or approve-alone, without needing admin. "Pay by member" is on it: each member's USD pay (owed, claimed, sent from escrow) and their Earned Equity and Credits to approve or adjust.
- **AI spending has limits you can set.** Admin dials cap what one account may use (25% of the village's share by default), what visitors may use (150 a day, 40 an hour), and how many documents the assistant reads (6, up to 12). If the village-wide cap can't be checked, AI requests stop instead of running unmetered.
- **Weak secrets are flagged.** A sign-in secret (`AUTH_TOKEN_SECRET`) shorter than 32 characters still boots but shows red on the launch plan; only a brand-new village with no members refuses to start with one. An `ADMIN_PASSWORD` shorter than 20 characters closes the first-admin and export doors until it is changed.
- **Make it yours, further** (each one off until a village sets it): a dark page and its own colours, with every colour pair measured for contrast; the game's own colours (paper, stamps, the map, places); its own menu labels, grouping and phone tabs; its own stock faces and portrait style; a font for each role (headings, body, accent, labels), its own sounds and its art direction; its own nouns for village, circle, members, gathering and the like, and its own words on notices and in letters; the words around the app (empty-board lines and the like); how the guide speaks; and the letter members sign opened to visitors, one paragraph per part.
- **Two new modules, both off by default.** *Protocols*: checklists a village walks the same way every time, working on a phone with no signal. *Hidden map*: a members-only map where each member sees their own pins until others vouch for 7 of them (a votable dial), then the whole map opens to them.
- **Smaller downloads.** Module card art is served by the server instead of riding in the app bundle (616 KB less).
- A code-scanning finding (CodeQL #489) is fixed.
- 1.3.15 also carried the Treasury naming fix (#1381) and a 168 KB bundle saving (#1383).

### What you must do

- **Self-hosters:** `docker-compose.yml` now publishes the app on `127.0.0.1` only, so put a reverse proxy in front of it. Set `VILLAGE_BIND=0.0.0.0` to publish on every interface as before.
- Check that `AUTH_TOKEN_SECRET` is at least 32 characters and `ADMIN_PASSWORD` at least 20. The launch plan shows red if the secret is too short.

### Does it touch your data

Yes, two expand-only migrations: `0389_a_village_keeps_its_protocols` (4 new tables) and `0392_a_hidden_map_opens_to_those_who_plant` (7 new tables). The previous release never reads them, so going back to 1.3.15 is safe; the tables stay and are ignored.

### Merged pull requests

- #1384 Module card art served from the server (-616 KB)
- #1396 Batch 183: AI budget and dials (#1350), CodeQL 489 (#1376), self-host and sign-in hardening (#1353)
- #1398 The letter members sign, opened to visitors (G15)
- #1393 Words around the app; unused tokens leave member pages (G7, G12)
- #1389 How the guide speaks (G13)
- #1377 Protocols module
- #1385 Dark page and village colours (G1)
- #1388 A village's own stock faces (G10)
- #1369 Hidden map, slice 1
- #1395 A village's menu and phone tabs (G5)
- #1391 The game's own colours (G3)
- #1401 Batch 184: Treasury page (#1366) and Pay by member (#1399)
- #1392 Fonts by role, a village's own sounds and art direction (G2, G8, G9)
- #1397 A village's own nouns and words on notices and letters (G4, G6)

---

## 1.3.15 (2026-11-16)

### What changed for your village

- **Founders and Treasurers can create tokens after launch.** A new power, `token.mint`, moves at launch to the steward and Treasury roles (and to them for villages that started before the launch ballot existed). A bare admin can no longer mint after launch, and agents never can. Every mint needs a reason, the cycle cap and co-sign rules still apply, and minting to yourself waits for a second holder. Stewards can pass the power to the village later.
- **After launch, the vote thresholds change only by vote** (the founder-steward break-glass excepted).
- **Treasurer pay, in one place.** Admin, Cash payouts, "Pay by member": pick a month and see each member's USD pay as owed, claimed or sent from escrow (date, reference, who recorded it), with totals. Beside it, their Earned Equity and Credits from End of Moon: a Treasurer or founder approves them, or changes them up or down with a reason, within 120% of the whole line. The member sees the change on My Moon ("Your token pay") and can reply. When two or more people can confirm, someone else confirms a change. Approved tokens issue at launch, and at once after it. Pay owed from before this release waits for the same review.
- **Supply chain:** every workflow step is pinned to an exact version, and the map prototype no longer loads outside code.
- **Calendar repeats** are bounded, and a bad "nth weekday" gets a clear refusal.

### What you must do

Treasurers: review each member's Equity and Credits in "Pay by member" after End of Moon. Nothing issues until you approve it.

### Does it touch your data

Yes, one expand-only migration: `0388_moon_reward_reviews` adds a new table. The previous release never reads it, so going back to 1.3.14 is safe; the table stays and is ignored.

### Merged pull requests

- #1367 Batch 181: token.mint and vote thresholds (#1332), supply chain (#1351), calendar guards (#1362)
- #1379 Batch 182: Treasurer pay server (#1349) and page (#1358)

---

## 1.3.14 (2026-11-16)

### What changed for your village

- **Security fixes before launch** (from the final audit):
  - Google sign-in binds its handoff to the browser that started it, with `__Host-` cookies.
  - The launch vote needs at least 3 people, and an admin can no longer close it early as "no quorum" or withdraw it once others have voted.
  - Powers a badge gave before the handover no longer outlast it; the launch seats only the people on its slate.
  - End of Moon: no double token pay with the hourly role settlement; a Treasurer can't set their own pay line or go past its range or the cap; an approved invoice can't be voided with its payments left live.
  - Seating someone into a group that opens the admin panel needs the person seating them to be able to open it.
  - Your founder's personal details are removed from the public code.
- **Launch rehearsal fixes:**
  - Earned Equity and Credits from pay approved before the launch are issued when the launch vote carries, and retried hourly after.
  - Clearer pay words on invoices and the member's pay, and a Treasury tab for members.
- **Calendar:** events can repeat on the nth weekday of the month (for example the first Friday).
- **Applicants:** a new-invitation door, a letter when an application closes, and an opt-in AI draft.
- **Accepted proposals show live** (gatherings, dials), and a failed accept says so.
- **The hatchery** speaks in a kinder browser voice; design and public-page fixes.

### What you must do

Nothing.

### Does it touch your data

No database migrations. Starting this release does not change your database.

### Merged pull requests

- #1363 Batch 179: launch rehearsal fixes (#1352, #1331, #1334, #1339, #1342)
- #1364 Batch 180: security fixes (#1330, #1333, #1335, #1336, #1338, #1340, #1341, #1345, #1346) and the launch vote (#1343)
- #1347, #1348, #1355, #1356, #1357, #1360

---

## 1.3.13 (2026-11-15)

### What changed for your village

- **Translated village content.** Role cards, their sections and page content can carry a translation for each language the village offers. A reader sees their language when a translation is up to date with the English, and the English otherwise. A machine draft is marked as machine translation until a person approves it. Whoever can edit the English can approve or improve a translation, and any member can suggest one. Legal and binding pages are never translated this way. Machine drafts are off unless the server sets `CONTENT_MACHINE_DRAFTS=on`, and they name the AI service they use.
- **Six focus steps.** `{focus}` in a role's qualities now reads one of six lines, at 10, 30, 50, 60, 80 and 100% commitment, following the applicant's chosen share.
- **Equity and credits always shown.** The role card's footnote keeps the equity and credits terms for every village for now.
- **The application names the split.** "Of this, X% is paid in cash, Y% in Earned Equity and Z% in credits by default; we settle the split together", built from the role's split.
- **A finished companion welcome stays finished,** even when an old tab tries to save over it.

### What you must do

Nothing. To offer machine drafts, set `CONTENT_MACHINE_DRAFTS=on` on the server.

### Does it touch your data

Yes, one expand-only migration: `0387_content_translations` adds a new table. The previous release never reads it, so going back to 1.3.12 is safe; the table stays and is ignored.

### Merged pull requests

- #1337 Batch 178: translated village content (#1316, #1319, #1320), equity and credits terms always on (#1325), six focus bands (#1326), application split line (#1327), finished welcome stays finished (#1329)

---

## 1.3.12 (2026-11-15)

### What changed for your village

- **A role's price is the whole reward, and End of Moon pays it that way.** When the Treasurer confirms a pay line, it is shared by the split the person's card showed (their contract's, else the role's, else the village's default). Only the cash share is owed in cash. Earned Equity and Credits are recorded to be issued, once per line, and they issue when the village's Game has started. The invoice shows the three parts and bills the cash share, listing Equity and Credits as "Also earned, nothing to pay". With no split anywhere, the line is all cash and the Treasurer is told so.
- **Adoption writes the split.** A contract adopted through a role application now records the split the card showed.
- **A month with a split change is paid by days.** If someone's split across roles changes mid-month, each split pays for the days it was in place.
- **Two people for a changed amount.** When two or more people can confirm pay, a changed amount must be confirmed by someone other than the person who proposed it. Founders and stewards who hold "approve alone" can confirm.
- **Footnote wording.** Role cards say "Your first month often starts lower and follows what you deliver."

### What you must do

Nothing. Treasurers: at End of Moon, check each line's split before you confirm.

### Does it touch your data

No database migrations. Starting this release does not change your database.

### Merged pull requests

- #1324 Batch 177: End of Moon shares pay into cash, Earned Equity and Credits (#1318), days-weighted split, two-person pay changes, approve-alone confirms, footnote (#1321)

---

## 1.3.11 (2026-11-15)

### What changed for your village

- **A second application starts from the first.** Someone applying to another role finds the form filled with what they wrote before (their details, value items, ways they got to know you, and the text of their voice notes, never the recordings or the price ask), with a line saying so. They can change anything.
- **The focus line follows the commitment.** A village can write `{focus}` on its own line in a role's qualities. The card then reads "Fully focused: … is your main work" at 60% and above, and "Focused: … is a main part of your work" below, and it changes as the applicant moves their share. Cards without `{focus}` are unchanged.
- **Spanish role picking.** On the role selection page the term date reads in the page's language, and the term line, season intro and commitment tip no longer mention the moon.

### What you must do

Nothing. To use the new focus line, replace a fixed focus line in a role's qualities with `{focus}`.

### Does it touch your data

No database migrations. Starting this release does not change your database.

### Merged pull requests

- #1314 Batch 175: Spanish role selection term dates and season intro (#1313)
- #1322 Batch 176: a second application carries over the first (#1317), focus line follows the commitment (#1315)

---

## 1.3.10 (2026-11-15)

### What changed for your village

- **People seated through a role application can now be paid.** When an application is adopted, its contract now records the price: the accepted ask, or the listed price if the person chose to negotiate, never above the cap. Before this, End of Moon had nothing to pay them.
- **Roles show a cap at 120% of the listed price.** A role listed at $13,000 a month for the full role accepts proposals up to $15,600. The role card, the price popup and the review step show it, and the server refuses an ask above it. The same cap bounds a scaled End of Moon line, which the Treasurer still confirms.
- **The application uses the same pay math as End of Moon.** Taking on several roles at different commitments shows each role's pay scaled once, never cut twice.
- **No automatic role pay at the start of a month.** A seat paid through End of Moon is no longer owed its full role cash when a new month begins, with no Treasurer involved.
- **Sturdier forms.** A broken request gets a clear error instead of a crash, hidden and look-alike characters are cleaned from applications, the same application is not kept twice, and odd price asks (negative, not a number, too large, or "negotiate" with an amount) are refused with a reason.
- **Deleting an account also removes their words from pay records.** Amounts and dates stay as the payment record.
- **Spanish on slow phones.** Spanish now applies even when it arrives late, and retries if it fails to load. The companion, voice consent and more screens are translated, and an offline error says so honestly.
- **Clearer words** on role cards, the application and /steward, from a steelman review.

### What you must do

Nothing. Treasurers: lines capped at 120% are marked, so check them at End of Moon.

### Does it touch your data

No database migrations. Starting this release does not change your database.

### Merged pull requests

- #1310 Batch 173: QA fixes from the steelman and three new perspectives (#1298, #1299, #1300, #1302, #1303, #1304, #1305, #1306, #1307, #1308)
- #1311 Batch 174: pay in the application, 120% cap, adoption writes pay, no settlement on End of Moon seats (#1301), Spanish when it loads late (#1309)

---

## 1.3.9 (2026-11-15)

### What changed for your village

- **Roles paid separately no longer have the commitment taken off twice.** When someone's roles are paid through separate agreements, the commitment split now scales each agreement against the commitment it was priced at, so the commitment counts once. Two roles each priced at 50% for $6,500, held by someone giving 100% split evenly, now pay $13,000 in all instead of $6,500.
- **The Treasurer sees more.** Each scaled line at End of Moon now shows the time given and the commitment it was priced at, next to the base, share and scaled amount. Nothing pays until a Treasurer confirms it.
- **Still safe when data is missing.** No split, a split that doesn't add to 100, no total commitment, or an agreement with no priced commitment all leave pay as the agreement states it.

### What you must do

Nothing. Treasurers: there is no cap, so a role priced at a small commitment that is given much more time pays more. Check those lines at End of Moon.

### Does it touch your data

No database migrations. Starting this release does not change your database.

### Merged pull requests

- #1296 Batch 172 (1.3.9): pay split applies the commitment once (#1295)

---

## 1.3.8 (2026-11-15)

### What changed for your village

- **Pages load much faster on phones.** On a slow phone the home page's main picture shows in about 5 seconds instead of 14, and it no longer jumps around while loading. Pictures are sent at the size they are shown, so the home page downloads about a third less.
- **Each key page loads only what it needs.** Voice, companion and chart code no longer load on the home page, /roles, the application or /steward. A build check now keeps each of those pages under its own size budget.
- **Small fixes.** An unknown address returns a proper not-found, /index.html sends you to the home page, and /health shows the orphan-file count right after a restart.

### What you must do

Nothing. Villages behind Cloudflare can add one cache rule for the translation files (docs/PROVISIONING.md, section 9b) to make first visits faster.

### Does it touch your data

No database migrations. Starting this release does not change your database.

### Merged pull requests

- #1293 Batch 171 (1.3.8): page speed, first-view bundling, image resize, real 404

---

## 1.3.7 (2026-11-15)

A release of fixes from six quality sweeps across the last ten days' work.

### What changed for your village

- **Pay is safer.** A member paid on separate applications whose amount the Treasurer changed could never be confirmed; that works now. A confirm is refused if the amounts changed since the Treasurer looked, nobody can confirm their own pay, goals still open count against progress, the far-off flag needs a fair sample, and a figure Finance set is no longer halved by a split.
- **Applications are safer and more private.** An address we have stopped emailing (bounced or erased) can no longer slip an application through; an unconfirmed address is never linked to the member who owns it; agents never read voice transcripts or suggestions; uploads have a total size cap; erasing an account now reaches that person's applications; and voice notes are heard by the deciders and admins, as the consent now says.
- **The application form reads and works better.** The email is checked as you go, the review shows your price and your notes on the role, the phone button bar no longer covers what you type, buttons are bigger and named, and focus stays where you are. Prices say their period, and a role held by one person no longer shows their exact share in public.
- **Words match the village.** No more "Lead" on the founding roles, the price says your proposal sets your pay, the Anchor Circle is the one circle for now, and "filling first" replaces "hiring first". New strings are now in Spanish.
- **Never a blank page.** If the village can't be reached the site says so and tries again; offline is told apart from an update; a missing file's not-found is never cached; /reset keeps you signed in and waits for you.
- **Smaller fixes.** A host who pressed quickly could get the wrong gathering length; a role card's "Last edited" date follows the village's time zone; the companion welcome keeps keyboard focus and asks before it speaks; the connector can now make approved role-card word edits and set the pay note.

### What you must do

Nothing.

### Does it touch your data

No database migrations. Starting this release does not change your database.

### Merged pull requests

- #1288 Batch 170 (1.3.7): open-proposal security, pay QA fixes, a11y, copy sweep, resilience
- #1287 Batch 169: Spanish strings, a11y fixes, release-notify, role-card price fixes
- #1282 Batch 168 (1.3.7): connector words, newsletter line, sessions length fix, /reset keeps sign-in

---

## 1.3.6 (2026-11-15)

### What changed for your village

- **The founding team is hired first.** The roles page and the application form say plainly that the founding roles are being filled first, and show the roles opening next.
- **"Get to know us" points somewhere.** The application's first step now offers a way in for each item: watch the last community call, join the next call, book a land tour, come to the next potluck. Each link can be set in Admin, and upcoming public events fill in their date and place by themselves; an item with nothing set stays hidden. It also offers a fork: new here? explore the Steward path first; already a strong fit? carry on with the application. Links open in a new tab, so the draft is kept.

### What you must do

To show the get-to-know-us links, set them in Admin under the founding team (recording, call, tour, potluck); until then they stay hidden.

### Does it touch your data

No database migrations. Starting this release does not change your database.

### Merged pull requests

- #1267 Batch 167: hire the founding team first + Get to know us

---

## 1.3.5 (2026-11-15)

### What changed for your village

- **Meet your companion.** A guided, playful welcome on the member profile: the member meets their companion, names it, chooses its personality and voice, and is shown around each part of their profile. They can skip and pick it up later from Today, and quiet and reduced-motion modes are there.
- **Optional lenses, private to the member.** A member may tell their companion about frameworks they like (for example Gene Keys, a Vedic chart, personality types, or how they like to be helped) so it speaks in a way that suits them. Lenses are optional, member-only, consent-based, never used to judge anyone, and deleted with the member's data. No birth details are stored.

### What you must do

Nothing.

### Does it touch your data

This release adds 1 database migration(s). Each runs by itself when the new image starts, before the village answers anyone. Before the image is published, release.yml checks that the previous release can still run over the schema they produce (docs/RELEASING.md):

- `0386_companion_persona_and_lenses.sql`

### Merged pull requests

- #1264 Batch 166: Meet your companion (persona, private lenses, guided welcome; migration 0386)

---

## 1.3.4 (2026-11-15)

### What changed for your village

- **Applications are voice-first.** Every free-text answer on the public role application has a mic. Applicants are invited to record a voice note (up to 3 of 5 minutes) and short clips beside each answer; with their consent the recordings are kept with the application and deciders can play them, on the decision page and in Admin's applications panel. Recordings are deleted with the application, and at the latest 90 days after the decision. The browser's own speech service turns speech into text.
- **AI can draft the answers from what the applicant said.** Only the transcript is sent, never the audio. Drafts fill only empty answers, and nothing goes into the form until the applicant presses "Use this". The AI never judges or ranks anyone.
- **A suggested price, and room to propose another.** The application suggests a monthly price from the role's band and the applicant's commitment. As a contractor, the applicant can take it, propose a higher or lower price with a reason, or choose to negotiate on the first call. Deciders see the suggestion, the proposal and the difference.
- **Paid on what we truly accomplish.** Role holders are told plainly that goals guide the work and pay follows what is delivered. At the End of Moon the review shows what was agreed beside what was delivered (goals done and other tasks taken on), flags a large gap, and lets the Treasurer propose an adjusted amount with a reason. Nothing is paid until the Treasurer confirms.
- **Fixes.** The founding team and role card read better on phones; a payer being added in End of Moon settings is no longer wiped when the saved list finishes loading.

### What you must do

Nothing. The new far-off dial (`moon_review.far_off_pct`) defaults to 25, and the clip limits default to 12 of 60 seconds; both can be changed in Admin.

### Does it touch your data

No database migrations. Starting this release does not change your database.

### Merged pull requests

- #1259 Batch 165: agreed vs delivered at End of Moon, proposed amount with a reason (Treasurer-confirmed)
- #1257 Payers editor: seed drafts once per loaded document (a new payer is never wiped)
- #1258 Batch 164: voice-first applications (mic, voice note, AI draft, per-answer clips)
- #1254 Batch 163: suggested price and adjust popup
- #1253 Batch 162: role-card layout fixes from the 1.3.2 live test

---

## 1.3.3 (2026-11-14)

### What changed for your village

- **A role can be shared, and proposals can be for part of it.** Each role can set a minimum commitment and a target total. The card shows the pay for the full role and what it pays at a given commitment; the application form offers commitments from the minimum to 100% and shows a live "up to" amount; applicants may name a monthly ask or choose to negotiate on the first call. The founding team shows how much of each role is held, and a role can be held beyond 100% when several people share it.
- **The commitment split can scale pay, with the Treasurer's confirmation.** When a member's roles are paid through separate applications, each role's pay follows its share of their time, and nothing is paid until the Treasurer confirms it at the End of Moon review. Roles paid as one are unchanged.
- **A page recovers by itself after an update.** A page left open across a release reloads once to fetch the new version, and shows a reload card instead of a blank page if that fails. Anyone can open `/reset` to clear the site from their device; drafts are kept.

### What you must do

Nothing. A role with no minimum or target set behaves exactly as before.

### Does it touch your data

This release adds 1 database migration(s). Each runs by itself when the new image starts, before the village answers anyone. Before the image is published, release.yml checks that the previous release can still run over the schema they produce (docs/RELEASING.md):

- `0385_role_commitment_range.sql`

### Merged pull requests

- #1248 Batch 161 (1.3.3): pay split, shared-role commitment range (0385), stale-page recovery
- #1241 Tests: wait for late-rendered UI in two flaky tests (moon review payer, steward thumb reach)

---

## 1.3.2 (2026-11-14)

### What changed for your village

- **Role cards you can explore piece by piece.** Each open role opens as a card that shows its purpose, what it looks after, what it delivers and how it rewards, one piece at a time, with an image and icons, or all at once.
- **The founding team, at a glance.** The roles page shows the Anchor Circle as a team sheet, or as a formation, with each role's domains and which places are open. Anyone can see it; holders appear by first name only, while the village shows people publicly.
- **Shape the role as you apply.** On each piece of a role card, an applicant can say what they would change, what is missing, or how they would deliver it. Their suggestions travel with the application, and deciders read them beside each piece.

### What you must do

Nothing.

### Does it touch your data

No database migrations. Starting this release does not change your database.

### Merged pull requests

- #1240 Batch 160: role cards (card, team sheet, founding team, per-piece suggestions)

---

## 1.3.1 (2026-11-14)

### What changed for your village

- **A role application is kept even when its confirmation email cannot be sent.** Before, a failed email threw the application away and told the applicant to try later. Now it is kept and reaches the deciders marked "email address not confirmed", the applicant is told it arrived, admins get a notice in the app, and the confirmation is tried again every hour for a week.
- **One commitment across all your roles.** The profile's Your roles card now holds how much of yourself you give, as one percentage, with an optional split across your roles. The split is shown and saved; it does not change pay in this release.
- **Your Progression is shorter.** It shows six powers first, with an icon for each kind, and the rest under "Show me everything".
- **A role card's "Last edited" now moves** when an admin or an agent edits the card.
- Developers on Windows can build and typecheck again (a file-name clash was renamed).

### What you must do

Nothing.

### Does it touch your data

This release adds 1 database migration(s). Each runs by itself when the new image starts, before the village answers anyone. Before the image is published, release.yml checks that the previous release can still run over the schema they produce (docs/RELEASING.md):

- `0384_commitment_split_across_roles.sql`

### Merged pull requests

- #1234 Batch 151: admin and agent role writes move Last edited
- #1236 Batch 159: profile commitment split + Progression top six (migration 0384)
- #1233 Fix the Windows build: rename moonSpiral.ts, keep release-train.mjs LF
- #1228 Batch 150: keep a role application when its confirmation email fails

---

## 1.3.0 (2026-11-13)

**Village OS moved to the ReGen Civics organisation, and nine new modules
arrived.** The code is now at github.com/ReGen-Civics/village-os, and the
image is published as `ghcr.io/regen-civics/village-os`. Links to the old
repository address redirect. **1.2.0 and every older release stay at the old
image address, `ghcr.io/rieki777/village-os`**, unchanged and still pullable.

**Village OS is now licensed AGPL-3.0-or-later.** It was MIT. The site footer
links to the source, which is what the licence asks of a village that runs the
code for others.

266 pull requests landed on `main` since 1.2.0, and together they make 94
database changes and add nine modules. 99 of those pull requests are landing
batches (their branch is named `wt/batch...`), and the smaller pull requests
each batch carries are not counted again. This release was drafted as 1.2.1
and never published under that number.

**How these numbers were counted**, from git and nothing else. Pull requests:
`git log --first-parent --merges cfaa41f..10328fc` (1.2.0 to the `main` this
release carries) has 220 `Merge pull request #N` subjects, and
`git log --first-parent --no-merges` over the same range has 46 squash commits
ending `(#N)`: 266 numbers, none twice. On this release branch,
`git log --merges --first-parent cfaa41f..HEAD` shows only nine of them (#413
to #440), because the other 257 arrive inside its merges of `main`. #750
was reverted and landed again as #759, and both count. Two more commits
reached `main` with no pull request: that revert, and a fix to the profile's
moon cycle. The documents bot's 21 `Regenerate the generated docs` commits are
not counted either. Migrations: `git diff --name-only --diff-filter=A v1.2.0
HEAD -- drizzle/` lists 94 files (167 at 1.2.0, 261 now), and
`--diff-filter=MDR` lists none, so no migration that shipped in 1.2.0 was
edited. Modules: `shared/modules.ts` adds `canvas`, `comms`,
`conflict-evolution`, `funding-rounds`, `gene-keys`, `moon-review`, `places`,
`session-card` and `sessions`. None of them is core, so all nine ship off.

### What changed for your village

**Nine new modules, all off until you turn them on**

- **Live Sessions.** A circle holds a working call together: an arrival round,
  an agenda the circle consents to, a page and a clock for each item, and every
  action held by a person or a seat. After the call each action carries on in
  a task board, with task emails. Arrival words are erased when the session
  closes.
- **Village Comms.** The village's email in one place: reminders for the
  gatherings people said yes to, a few emails along the path a person chose,
  guest RSVPs, a live vote on a session time, and letters to the people who
  agreed to get them. It needs a Resend account and a verified sending domain,
  and Admin, Comms, Settings walks through both.
- **Gene Keys.** Each member can find their Gene Keys lines and Human Design
  type, and their Sun, Moon and rising signs, from birth details read on their
  own device. No birth date, time or place is stored. The lines show as a seal
  on their portrait unless they hide them, and "Who complements me" shows a
  member only people who also said yes.
- **Session Card.** Anyone in a live session can pull a card at the start, as
  often as they like. It reads the day's sky and weaves in the Gene Keys of the
  people present who said yes. Each person's own line stays private until they
  share it, and the cards are deleted when the session closes.
- **End-of-Moon Review.** Once a moon, each member who holds a role gathers
  what they delivered, checks it against their role cards and the season
  goals, and sends a recap. Two different people approve, neither of them the
  member. The one interim exception, the Treasury power group approving its
  own, is marked on every such approval.
- **Funding Rounds.** The village chooses together which quests the season
  funds, within a pot. Members share rough ideas, shape them into quests, and
  tick the ones they would fund. The count shows what Voice chose and what one
  member, one vote chose, and a funded idea becomes a quest. A round runs four
  stages: seed, grow, choose and harvest. Any member can back a proposed quest
  with a pledge, shown with their name and open to withdraw until choosing
  closes.
- **Living Places.** Every place on the land as a living invitation: what it
  is, which stage it has reached from idea to built, which permits it waits
  on, the roles that care for it, and how to step forward as its steward. A
  place keeps the key the living map already uses for it.
- **Governance Canvas.** The village reads how it governs itself, block by
  block, on the twelve blocks of the canvas: a reading per block that is kept
  every time, a Baseline view, a Decision Matrix, anyone's suggestion for how a
  block is answered, and a notebook where a member keeps their own documents
  and may offer one to the village.
- **Conflict Evolution.** A conflict agreement the village writes and changes
  by vote: where a conflict goes, who takes it and who covers, how soon a
  member hears back, and a private ask to the ombuds.

**Every village's email**, whether or not Village Comms is on: each email is
recorded before it goes, carries a one-click stop and a preferences page, and
an address that bounces or complains stops being written to.

**Inside Live Sessions**

- A circle keeps a meeting rhythm, and Coming up on `/sessions` shows its next
  meeting. A circle can attach its own Google, Apple or Outlook calendar, and a
  member can follow circles on their own calendar.
- An agenda library holds what members bring for a circle's next session. A
  tension raised with a role, and a decision whose review date has come, each
  become an item there.
- In the room, everyone votes agenda items up or down until the facilitator
  sets the order. The facilitator can fill in for a member, who is told and
  can undo it. A proposal can be checked. Someone who sleeps on a proposal
  names a time to answer by, and a night left unanswered by then counts as no
  objection.
- Meeting templates, weekly priorities and wins that name the season goal they
  serve, and an advice process: before deciding something that touches others,
  a member asks the circle it touches.
- Enter the room from its card, discard an open session, and delete a closed
  record.

**Seats and seasons**

- A seat can say what it offers whoever holds it: how long it runs, its
  rhythm, what it records as pay, and its quests. Members can read it.
- A member can apply for one to five seats on terms, as one proposal. Whoever
  holds the seat power approves it, or the village votes. **Waiting on you**
  on the task board shows what needs an answer.
- **Your season:** each member says which seats they keep, hand back or apply
  for, and what they commit to.
- **Align:** a member aligns with a seat's terms in one click, the Aligned
  register shows what is in force, and aligned terms can change and end.
  Signing the Love Letter aligns a member with the words they read.

**Roles, circles and proposals**

- Each role has a card on its holder's profile: what it looks after, what to
  bring it, what it does not hold, how its work is done, and the sections of
  the CCOS Role Card. These words change by consent, through an org chart
  draft.
- Any member can raise a tension with a role. It reaches the role's holders,
  and only they and the member who raised it read it until a holder brings it
  to the circle.
- Each circle has a card at `/circles/<id>` with its charter, which changes by
  consent, and a governance layer that sets where it sits on the circles map.
- A member drafts their roles for next season. Every live holder of a role in
  the circles concerned is asked to consent or object within two business
  days. Somebody with no account can propose for a role through the village's
  public link or a link made for them, and no account is made for them until
  a proposal is adopted.

- **The role journey.** Only roles a steward has listed can be found, and a
  listed role carries its full card: the season goals it serves, its track,
  how it is selected, its languages, where it is worked and a booking link.
  One editor, Edit this role, changes the card. A visitor who is signed out can
  apply for an open role, and a member picks their roles in steps, with art,
  the five archetypes first. Each application is reviewed in order: the
  interviewing roles a role names are asked one after another, each scores,
  and a recusal is kept. The confidentiality agreement's PDF can be attached
  for signed-in members only. A member keeps a time zone, and a holder whose
  role runs by the moon files to carry on, which one person renews for the
  whole village.
- A new holder has an onboarding path in phases the village names, with a
  buddy and check-ins that only the holder, the buddy and the onboarding
  role read. Each role names the access it needs, raised as a task when the
  role starts and again when it ends.
- Role proposals: open ones can be for this moon, are hardened against floods,
  and give the applicant a status page, updates by email and on their profile,
  a reply promise and a kind no. A proposal asks for the first moon's goals as
  an interactive list.
- **Apply to the founding team** in six steps, with an About you step for
  references and background-check consent. Our review comes before the
  conversations: an invite, or a warm not-invited letter. A role that holds
  money or works near children can be always background-checked, and the
  check's wording says the village covers its cost. The founding offer shows
  the 60/40/0 rewards with their fine print, and how we see conflict.
- The eight terms come with our suggestion, with commitment in place of hours.
  The ops steward can offer terms back, with history, and the candidate
  answers on their status page. Sera drafts a first version of the aim, goals
  and story on request.
- Applicant emails and pages follow the applicant's language, and the joining
  pages are in Spanish. The first hour after yes is planned, and the joining
  form is six stones.
- **Agents can apply for and hold roles**, with a member who keeps each one
  and is shown beside it. The roles an agent may hold are set on the role.
  What a connected agent proposes waits for a person: a seating or a drafted
  letter lands in an approvals inbox.
- A role can be marked for the characters it suits, and the roles page shows
  founding roles first.
- **Commitment percent:** quests and roles size what they ask of a person as
  a number from 1 to 100, and a member records what they can give as a dated
  history that is never edited.

**Circles and the map**

- Circles show operating ones first, forming ones below, and one anchor marked
  everywhere. A draft can set a circle's standing and mark the anchor.
- Each circle has a hearth page: the roles round a fire, when we meet, what we
  tend, who holds what and what we decided. The living map draws hearths, the
  threads between them, and opt-in lights where people meet today.
- The map places seats by the village's own keys, not by circle name, serves
  its images as their own files and fetches construction sprites and
  satellite plates only when they are shown. The Enter the Land gate stands on
  the land, drawn as a plan.

**The village's structure**

- A batch of structure changes, from a person or an outside service, is
  reviewed on the map, its duplicates settled, and accepted as one draft.
- Whoever holds the new decide power publishes that draft, or puts it to the
  village as a vote.
- People can be carried across to a new chart, and the empty old circles
  retired.
- In Admin the org chart is nested (circles, roles, role) with one floating
  save bar. A change to an org draft waits for a publish.
- **Sera sync review:** one read-only list on `/review` shows where the outside
  service's chart and the village's differ. A person answers each difference:
  take the service's value into a draft, keep ours, edit it, or settle many
  together. A role the service archived is never made again, and a role a sync
  made matches itself.

**Deciding together**

- Holding an org seat grants the Power groups linked to it, for as long as the
  seat is held. Only the holders of `power.assign` hand out powers, and the
  members' powers page names every power and who holds it today. A power that
  matures waits a week before it crosses to the village, and any steward can
  stop it. An everyday power passes to the village as its stage floor, and
  nobody loses it. Five held-back keys move onto a role only at the village's
  highest tier.
- Operator powers reach the admin routes their power names. Every member can
  read the admin panel, and change nothing.
- **Change requests:** a member gathers several changes into one request,
  with a review round before the vote. Every setting shows its own history:
  who, when, why and the vote. The pages are `/changes` and `/changes/:id`.
  Suggest to edit sends a suggestion to the place a dial names.
- A ballot that too few answered is asked again once, at half its quorum,
  when the village turns on `governance.quorum_fallback`. A vote-weight cap,
  off by default, bounds one member's share of the vote.
- A village can change its name, its currency (at the highest tier), its
  badges and its minting rules by vote, and can vote one copy of its database
  to a named steward. A Hypha outcome that names no space waits for a person,
  and can always go to the village's vote after launch.
- The Governance page shows who holds the Voice as groups, and this season's
  votes. The launch's head count is a village dial, and the launch vote may
  carry the site address.
- Governance cannot be paused into a state nothing can undo. A launch never
  re-points a power the village already holds. A seat whose term ran out holds
  nothing on the pages members read.

**Members**

- **Waiting on you** also holds asks: one member can ask another to review,
  edit, approve or finish something.
- **Your list:** a member's own task list on their profile, which a steward
  turns on for each member, and which can bring in their tasks from the
  organisational memory library.
- **Companions:** every member gets a personal companion, and one for each
  role they hold (`companions.role_ids`, all roles by default). A companion
  brings questions, and drafts that wait for the member's yes. Before a
  member's words first go to a model on the platform's borrowed key, their
  companion names the provider and the operator and asks.

- **Profile Today** and the first 14 days: one next step everywhere, Your path
  on the profile, and the status page as a Seed of Life. Fireflies arrive
  where the bell's number was, and the Gathering fills a Seed of Life when a
  member says they will be there. The calendar shows the moon as a spiral of
  days, the moon garden shows the season, and the commons draws season goals
  as circles where moss spreads.
- **Gratitude threads:** a thanks is a thread between two people, newest first,
  with no count. An open work board shows goal threads.
- Two training pages, `/training/steward` and `/training/resident`, each with
  its own words in Admin. Steward the village is one flow built on eleven
  steps.
- **Proposed changes:** an agent can propose a change to any Admin setting.
  A person reads every proposal beside what is live, edits it in place, and
  accepts a selection, each through the setting's own route as that person.
- Companions follow the member's chosen guide, and Sera is on every guide
  surface, with a microphone and Talk it out on long text.

**Running the village**

- **The platform's timezone is UTC.** It was the first village's clock. A
  village that never chose or confirmed its timezone in Admin, Seasons moves
  to UTC with this release: season turns, role terms, the claims window, the
  calendar and the weekly brief follow. The Launch Plan's timezone row now has
  to be answered before a launch vote. A village that chose or confirmed its
  zone keeps it.
- Whoever holds the Founders Circle or steward power group can open the admin
  panel, for as long as the holding lasts. It gives admin access only: no
  decide power and no veto.
- Handing a power to the village, or a launch selection, waits for a second,
  different signer whenever two or more people may sign. The five riskiest
  powers ask each signer to confirm twice.
- After launch, saving a keystone secret in Admin, Integrations waits for a
  second person's co-sign, or for a cooling-off pause when nobody else can
  co-sign.
- **The setup game** at `/setup-game` plays the village's real setup, starting
  with email, for founders and admins.
- **Every village's pages are its own.** The journey pages, How We Govern, the
  path and stage words and Circles start neutral in a new village, and a new
  village starts with an empty Command Centre. An established village keeps
  the words it shows today.
- **Agents:** the Operations agent and the organisational memory's agent hold
  accounts of their own, which never hold a seat. A member can connect
  Claude's custom connectors to the village, through an OAuth 2.1 sign-in and
  a connector that runs every tool through the member's own access.
- **Village Tokens:** Admin, Tokens names each token and says what it means in
  the village's own words, and a badge's multiplier names the token it
  multiplies.
- **The connector:** its switch is first in Game Mechanics, and a panel walks
  a member through adding it to their Claude after they save a key. Behind one
  village switch, `agents.lead_approved_writes`, a person's approval lets an
  agent write role-card words, org drafts, seatings and a few wording
  switches. Every approval carries the person's note and is recorded in Admin
  and in Sera. Erasure, money, members, personal data and secrets are never
  open to an agent.
- Every page paints from the palette set in Admin, and the role card and the
  night sheet re-theme live.
- Four more keys have a slot under Admin, Integrations: the Hypha voice
  secret, Google sign-in's client pair, the channel crash alerts go to, and
  the satellite provider the village chooses.
- **A language selector** in the top banner and on every page without the site
  header. The catalogs are served by the village, and a ratchet counts any
  hardcoded English.
- An admin can export the whole village with the admin password. The launch
  vote document names the admin doors that close, and the launch row
  `site-address` waits for `FRONTEND_URL` (below).

**Quests, building and the investor path**

- A next-step box follows every claim, and both ways to claim pass one gate.
  A quest that asks something of the body says so: skill badges gate tools,
  heights and machines, and a member says their age band once. Minimum ages
  are an opt-in setting and off by default. Roles open to every character
  show again, and the Module Library has the builder's journey as a section.
- **The investor path** keeps what a village offers, who raised a hand, what a
  person said yes to, and when a home or a parcel changed hands, in words and
  dates and with no amounts, which stay in the ledger. Two badges, Homeowner
  and Neighbour, come with it.

**Value and work**

- **Invoice rails (#975, #991).** An invoice is followed from sending to
  approval to payment, and the Treasury card syncs read-only. The email that
  carried an invoice is recorded without its body or attachment.
- **The valuation engine.** It gives a suggested figure for a piece of work, and
  the figure a person sets is saved beside that suggestion. Each saved version
  of the village's model is kept.
- **The pricing desk.** A page at `/pricing` for whoever holds the pay-setting
  power. The server refuses everyone else.
- **Budgets.** The Treasurer uploads a cash budget in Admin. It is kept line by
  line, with each import, a note per period, the sources it comes from and an
  envelope per circle.
- **The price kept at claim (#1000).** A claim keeps the terms the quest had
  when it was taken.
- **Earned Equity's three rules switched on, amount blank (#892, #896, #992).**
  A running village has each of its three rules queued to go on from the next
  cycle with no amount written. A rule the village already switched on, or
  already has a change queued for, is left alone.

**Finding your way**

- The words on every page were rewritten so the village guides a member
  through it like a game, and **the Trail** shows a member their next step on
  every page.
- A **Start here** card on the profile shows the one next step to membership,
  a quest or a seat. **My tasks** is in the menus, a notice opens its task,
  and It's done works from the bell.
- **Role cards:** each seat has a card on `/roles`, `/circles`, the setup
  wizard and `/review`, and `/roles?seat=<id>` opens one seat's card.
- The menus are regrouped under Village and Decide, and the Module Library is
  on the bar.
- Joining: the Love Letter's thank-you says what happens next, a signed-in
  request to join names its account, and a yes to a request stops the "still
  with us" emails. The Love Letter is a member's door, and no one is a Member
  before it.
- The village pulse is in plain words, with no setting keys or stage lines in
  public.

**Look and feel**

- A design rule, with a gate, holds the joining flow to the profile's look.
  The pages where people decide sit in the night world, empty states give one
  door, the 404 is in the night world, tap targets are 44px, and nature art
  (fireflies, the Seed of Life, fern, moon) replaces white-framed characters.
- Pages download less: eight font families are served from one variable file
  each, and long text moved out of the lazy chunks.

**The Journal**, for villages that turned it on: an entry is shared with the
village's organisational memory, under code-names, unless its author keeps it
private. **Nothing leaves the village in this release.** The connection is not
built yet, so the village only records what would cross. An entry written
under 1.2.0 keeps its setting, and one its author marked `internal` or `clear`
then now counts as shared. The Journal has a door on the member's profile.

**The Living Map:** a second round of QA fixes (79 of the 80 confirmed
defects), the village's own circles and seats drawn live, crown bar chips the
founders choose, a blank slate for a village with no published map that its
founder's agent can draft from the masterplan, and a treasury chip for
members.

**Saberra villages** get a setup panel, Sync now, seats placed in their
circles, and a polling schedule with a report of each run. Stewards also get
the bridge board as quests on `/modules/saberra`, the outside service's
quests in the quest review queue, a sync health alert, a member's tasks
exported and removed there before that member's erasure, and matching of
members by a keyed hash, which is off by default. Members and stewards read
the service's name as Organisational Memory.

**Security and setup**

- Every page except the Living Map's own artifact sends a content security
  policy: only the village's own scripts run, with Cloudflare's Web Analytics
  beacon. `CSP_MODE` switches it to report-only.
- Sign-up sends a letter that proves the address. A Google sign-in onto an
  account whose password was never proved ends that password, signs its other
  devices out, and tells the member by letter.
- The web server framework (express) moved to 5.3.0, which fixes a critical
  advisory in how it reads proxy addresses (GHSA-jqcg-44mw-7w3h), and two high
  advisories in body-parser (GHSA-27r3-jxmh-p828) and multer
  (GHSA-q7qp-rjg7-q26m) are fixed.
- The public rules feed listed the blockchain RPC address together with its
  key. It now withholds the key. A dedicated Base endpoint is now a sealed
  secret in Admin, Integrations, and a failed chain read no longer writes the
  key into the log.
- The page a member returns to after signing in passes one strict rule
  everywhere, so a crafted link cannot send them outside the village.
- A link the village emails, its sitemap and its calendar address read the
  `Host` header only, never `X-Forwarded-Host`, which a caller writes.
- The tool checker closes IPv6 routes to private addresses. The public form
  doors decide an attachment by its bytes, and one address is heard three
  times a day. A cookie sent twice signs nobody in, and signing in is not
  being admitted: the named ballot roll is for voters. A seat's journal reads
  to members with no names in it.
- A ledger that does not add up at boot shows a page, not a 502. A call to
  the outside governance service has a deadline, and a reply has a size.
- A malformed `VILLAGE_SECRETS_KEY` is named, with what is wrong with it,
  before anything else.
- The setup prompt has your AI assistant find the latest release once and use
  that version for the guides, the download and the image.
- Dependency updates, including the test runner, the animation library and
  the PDF reader, with no change a member sees.

### What you must do

- **Pull from the new address.** On one computer with `docker-compose.yml`,
  set `VILLAGE_OS_IMAGE` in `.env` to `ghcr.io/regen-civics/village-os:1.3.0`,
  then `docker compose pull && docker compose up -d`. On a hosting provider,
  change the image to `ghcr.io/regen-civics/village-os:1.3.0` and redeploy.
  Going back to 1.2.0 means naming the old address (`docs/UPGRADING.md`).
- **Answer the timezone row.** Open the Launch Plan before upgrading. If its
  timezone row is not green, choose your zone (or press This is right) on the
  Seasons tab. Otherwise your village runs on UTC from 1.3.0.
- **If a proxy or CDN in front of your village adds a script to its pages,**
  set `CSP_MODE=report-only` before you upgrade. From 1.3.0 a page runs only
  the village's own scripts and Cloudflare's Web Analytics beacon, so any other
  added script stops running. `CSP_REPORT_URI` names an https address for the
  browsers' reports, if you want them.
- **If your village set a blockchain RPC key,** rotate it. Earlier releases
  published it.
- **Set `FRONTEND_URL`.** A village that has not set it cannot put its launch
  vote until it says where it lives, because the server no longer learns its
  address from the first request it hears. A village already launched is
  unaffected.
- **If you do not want connected agents to make approved writes,** set
  `agents.lead_approved_writes` to off in Game Mechanics, Connector. It is on
  from 1.3.0, and opens nothing by itself: a person's approval note is still
  needed for every write.
- **If your village runs the Journal and Saberra together,** tell members that
  a new entry is shared under a code-name unless they keep it private.
- **If you forked the repository,** the licence is now AGPL-3.0-or-later (it
  was MIT), so read `LICENSE` and `NOTICE`, and point your `upstream` remote at
  `https://github.com/ReGen-Civics/village-os.git`. A fork that builds with its
  own Dockerfile or deploy script ships `server/assets/` beside `dist/`, as the
  stock `Dockerfile` does, or the stock character art falls back to sigils.
- Nothing else. The nine new modules stay off until you turn them on, and
  Village Comms asks for its settings when you do. `RESEND_WEBHOOK_SECRET`,
  `PLATFORM_ASSISTANT_OPERATOR`, `BASE_RPC_URL` and `CSP_REPORT_URI` are new
  and optional. Comms Settings can create the webhook and store its secret for
  you, and the Base endpoint can be set in Admin, Integrations.

### Does it touch your data

**Yes. 94 database changes**, applied by the village itself as 1.3.0 starts,
before it answers anyone. Every one adds tables, columns, indexes, rows or
enum values. Three of them add rows to tables 1.2.0 already reads: 0266 (one
token and three system accounts), 0287 (one badge) and 0349 (two badges), and
those rows stay if you go back. None of the 94 rewrites a value you already
have, so going back to 1.2.0 leaves them in place and 1.2.0 ignores them.

**Live Sessions**

| File in `drizzle/` | What it adds | Undone by going back? |
|---|---|---|
| `0238_a_circle_holds_a_live_session.sql` | Six tables for Live Sessions | No; 1.2.0 ignores them |
| `0255_a_task_keeps_going_after_the_call.sql` | Three tables for the task board, filled from closed sessions (none, on a village coming from 1.2.0) | No; 1.2.0 ignores them |
| `0264_a_circle_keeps_an_agenda_library.sql` | Two tables: the agenda library, and each time a session took an item from it | No; 1.2.0 ignores them |
| `0271_a_circle_keeps_a_rhythm.sql` | A table of each circle's meeting rhythm | No; 1.2.0 ignores it |
| `0275_a_member_follows_circles_on_their_calendar.sql` | Two tables: the circles a member follows on their calendar, and the key to their calendar address, stored only as a hash | No; 1.2.0 ignores them |
| `0277_a_circle_attaches_its_own_calendar.sql` | A table saying which outside calendar belongs to which circle | No; 1.2.0 ignores it |
| `0279_an_agenda_item_remembers_where_it_came_from.sql` | A table saying which agenda item came from which tension | No; 1.2.0 ignores it |
| `0280_a_decision_names_when_it_is_reviewed.sql` | A table of review dates for decisions | No; 1.2.0 ignores it |
| `0281_a_night_has_an_answer_by_time.sql` | An empty column on `live_session_responses` for the time a member will answer by | No; 1.2.0 ignores it |
| `0284_a_member_asks_a_circle_for_advice.sql` | Two tables for the advice process: each request, and each person asked | No; 1.2.0 ignores them |
| `0288_a_facilitator_fills_in_for_a_member.sql` | A table of every time a facilitator filled in for a member | No; 1.2.0 ignores it |
| `0290_the_room_votes_its_agenda.sql` | A table of agenda votes | No; 1.2.0 ignores it |
| `0291_a_circle_keeps_its_meeting_templates.sql` | Four tables: meeting templates, which sessions used them, a meeting's priorities, and what was shared around a talking stick | No; 1.2.0 ignores them |
| `0292_a_priority_serves_the_season.sql` | Two empty columns naming the season goal a priority or a win serves | No; 1.2.0 ignores them |
| `0297_a_proposal_can_be_checked.sql` | A table of the latest check of each proposal, its words kept only as a hash | No; 1.2.0 ignores it |
| `0298_a_season_goal_keeps_its_name.sql` | Six columns, on tables this release made, that link priorities, wins and agenda items to a season goal by id and tell tensions apart. Its backfill runs at boot (below) | No; 1.2.0 ignores them |

**Village Comms**

| File in `drizzle/` | What it adds | Undone by going back? |
|---|---|---|
| `0244_every_email_is_recorded_before_it_is_sent.sql` | Nine tables: every email sent, the address book and its permissions, the stop list, delivery reports, editable words and journeys | No; 1.2.0 ignores them |
| `0245_a_gathering_asks_when_and_remembers_who_came.sql` | Eight tables for gatherings: guest requests, attendance, recaps, feedback and time votes | No; 1.2.0 ignores them |
| `0246_a_path_remembers_who_walks_it.sql` | Three tables: who walks a path, and letters with their recipients | No; 1.2.0 ignores them |
| `0371_an_address_remembers_its_language.sql` | An empty column on `comms_contacts` for the language a person used on the site when they gave their address | No; 1.2.0 ignores it |

**Seats, terms and seasons**

| File in `drizzle/` | What it adds | Undone by going back? |
|---|---|---|
| `0256_a_seat_offers_its_terms.sql` | Three empty columns on `org_roles` for the terms a seat offers | No; 1.2.0 ignores them |
| `0257_a_member_applies_for_seats_on_terms.sql` | A table of seat applications, and an empty column with an index on `org_role_assignments` | No; 1.2.0 ignores them |
| `0258_a_member_plans_their_season.sql` | A table of season plans | No; 1.2.0 ignores it |
| `0259_a_member_aligns_with_seat_terms.sql` | Four tables: the words members align with, who must align, each alignment, and its seal | No; 1.2.0 ignores them |
| `0260_aligned_terms_can_end.sql` | A table of how aligned terms end | No; 1.2.0 ignores it |
| `0267_a_player_card_carries_its_own_words.sql` | Three empty columns on `season_plans` (0258) for a member's own words, and a table of how each moon feels | No; 1.2.0 ignores them |

**Roles, circles and the structure**

| File in `drizzle/` | What it adds | Undone by going back? |
|---|---|---|
| `0243_a_draft_can_retire_a_circle.sql` | `rest_circle`, a new kind of structure change, in `org_draft_changes`.`op` | No; 1.2.0 never writes it |
| `0268_a_role_carries_its_handover_words.sql` | Three empty columns on `org_roles`: what to bring a role, what it does not hold, and its runbook | No; 1.2.0 ignores them |
| `0269_a_role_hears_a_tension.sql` | A table of tensions raised with a role | No; 1.2.0 ignores it |
| `0270_a_circle_keeps_its_charter.sql` | A table of circle charters, and `update_circle`, a new kind of structure change, in `org_draft_changes`.`op` | No; 1.2.0 ignores the table and never writes the value |
| `0273_a_member_drafts_their_roles_for_next_season.sql` | Two tables: members' drafts of next season's roles, and comments on them | No; 1.2.0 ignores them |
| `0274_a_role_card_speaks_ccos.sql` | Seven empty columns on `org_roles` for the CCOS Role Card sections | No; 1.2.0 ignores them |
| `0276_a_circle_consents_to_a_role_proposal.sql` | A table of the holders asked to consent to a role proposal, and an empty column for the decision in words | No; 1.2.0 ignores them |
| `0286_a_circle_has_a_governance_layer.sql` | An empty column on `circles` for its governance layer. The map stays as it is until somebody sets one | No; 1.2.0 ignores it |
| `0305_a_stranger_can_propose_for_a_role.sql` | Two tables: role proposals from people with no account, and the links made for them | No; 1.2.0 ignores them |
| `0322_a_seat_carries_power_groups.sql` | A table saying which Power group whoever holds an org seat holds. No row is seeded, so no one's powers change | No; 1.2.0 ignores it |
| `0337_sera_snapshots.sql` | A table keeping what the outside governance service holds, whole, after each read | No; 1.2.0 ignores it |
| `0361_a_sera_difference_is_answered.sql` | Two tables for answered differences from the outside service and its links, and two empty columns on `external_proposals` | No; 1.2.0 ignores them |
| `0362_a_role_can_be_listed_and_carry_its_card.sql` | Thirteen empty columns on `org_roles`: whether it is listed, and the parameters of its full card. An unset listing reads as listed | No; 1.2.0 ignores them |
| `0364_an_application_is_reviewed_in_order.sql` | Four tables: the steps of an application, its interviews, their scores and recusals | No; 1.2.0 ignores them |
| `0365_a_new_holder_has_a_path.sql` | Three tables: a new holder's onboarding path, its items and its check-ins | No; 1.2.0 ignores them |
| `0366_a_role_carries_on_by_the_moon_and_its_access_is_tracked.sql` | Two tables: a holder's carry-on for the next moon, and the access a role raises when it starts and ends. No credential is kept | No; 1.2.0 ignores them |
| `0367_a_member_keeps_a_time_zone.sql` | A table of each member's time zone | No; 1.2.0 ignores it |
| `0368_agent_proposals_wait_for_a_person.sql` | A table of what a connected agent proposes, which waits for a person | No; 1.2.0 ignores it |
| `0369_a_member_proposal_keeps_its_answers.sql` | An empty column on `seat_applications` for the answers the member door asks | No; 1.2.0 ignores it |
| `0370_a_role_can_be_always_background_checked.sql` | A column on `org_roles`, 0 by default, marking a role always background-checked | No; 1.2.0 ignores it |
| `0372_a_circle_can_be_the_anchor.sql` | A column on `circles`, 0 by default, marking the anchor | No; 1.2.0 ignores it |
| `0373_a_draft_can_set_a_circles_standing.sql` | `set_circle_standing`, a new kind of structure change, in `org_draft_changes`.`op`. Every old value stays | No; 1.2.0 never writes it |
| `0374_an_agent_can_hold_a_role.sql` | Two empty columns: who may hold a role (a person, an agent, or either) and the member who keeps a seated agent | No; 1.2.0 ignores them |

**Gene Keys and Session Card**

| File in `drizzle/` | What it adds | Undone by going back? |
|---|---|---|
| `0272_a_member_keeps_their_gene_keys.sql` | A table of each member's Gene Keys lines and Human Design type. No birth date, time or place | No; 1.2.0 ignores it |
| `0287_gene_keys_find_a_badge_and_a_match.sql` | Two switches on that table, both off until the member says yes, and one badge row, `lines-found`, in `badges`. A village that already has a badge with that id keeps its own | No; the badge row stays, and 1.2.0 does not know the metric it counts by |
| `0296_a_session_pulls_a_card.sql` | Two tables for session cards and each person's line on them, and a switch on `member_gene_keys` | No; 1.2.0 ignores them |
| `0308_a_card_asks_its_own_yes.sql` | A second switch on `member_gene_keys`, off for everybody, and an index on `session_cards` | No; 1.2.0 ignores them |
| `0309_a_member_keeps_their_signs.sql` | Three empty columns on `member_gene_keys` for the Sun, Moon and rising signs | No; 1.2.0 ignores them |

**Value and work**

| File in `drizzle/` | What it adds | Undone by going back? |
|---|---|---|
| `0265_work_carries_its_value.sql` | Three empty columns each on `quests` and `org_roles` | No; 1.2.0 ignores them |
| `0266_a_village_earns_equity_it_can_claim_on_hypha.sql` | One token row, `earned-equity`, in `tokens`, and three system accounts in `ledger_accounts` | No; the rows stay |
| `0278_a_badge_multiplies_named_tokens.sql` | An empty column on `badges` naming the token a multiplier applies to. The old `multiplier` column stays | No; 1.2.0 ignores it |
| `0283_a_token_says_what_it_means.sql` | An empty column on `tokens` for what a token means, in the village's own words | No; 1.2.0 ignores it |
| `0285_work_records_the_cash_it_owes.sql` | Two empty columns each on `quests` and `org_roles`, and a table, `cash_owed` | No; 1.2.0 ignores them |
| `0294_a_member_sees_what_landed_once.sql` | A table of the arrivals each member has already been shown | No; 1.2.0 ignores it |
| `0335_an_invoice_is_tracked_to_payment.sql` | Four tables for tracking an invoice from sending to payment and a read-only treasury sync. No email body or attachment is kept | No; 1.2.0 ignores them |
| `0336_a_valuation_is_kept_with_its_working.sql` | Two tables: each saved version of the village's valuation model, and each figure set beside the suggestion it came from | No; 1.2.0 ignores them |
| `0342_a_claim_keeps_the_price_it_was_taken_at.sql` | An empty column on `quest_claims` for the terms a claim was taken at. A claim taken before has none | No; 1.2.0 ignores it |
| `0360_budget_lines.sql` | Five tables: budget lines, each import of them, the sources that feed them, an envelope per circle, and a note per period | No; 1.2.0 ignores them |
| `0383_commitment_percent_as_data.sql` | A column on `quests` (empty), two on `org_roles` (one empty, one 0 by default), and a table of what a member says they can give, kept as a dated history | No; 1.2.0 ignores them |

**Members' own lists, asks and companions**

| File in `drizzle/` | What it adds | Undone by going back? |
|---|---|---|
| `0295_a_member_keeps_companions.sql` | Three tables: a member's companions, what each one brings, and each chat | No; 1.2.0 ignores them |
| `0299_a_member_can_ask_another.sql` | A table of one member's asks of another | No; 1.2.0 ignores it |
| `0310_a_member_keeps_their_own_list.sql` | Three tables for Your list: the tasks, their history, and each member's switch, which starts off | No; 1.2.0 ignores them |
| `0311_a_library_person_is_a_member.sql` | Two tables: which organisational memory person is which member, and tasks nobody owns yet | No; 1.2.0 ignores them |
| `0312_a_member_tells_the_library_why.sql` | Five tables for the feedback bridge to the knowledge library, and two columns on tables 0310 and 0311 made | No; 1.2.0 ignores them |
| `0314_a_member_tags_a_task_to_a_role.sql` | Two empty columns on `member_tasks` for a role and a season goal | No; 1.2.0 ignores them |
| `0316_a_task_says_who_asked.sql` | Three empty columns: who asked for a library task, and the role it sits with | No; 1.2.0 ignores them |
| `0320_a_member_is_matched_by_a_keyed_hash.sql` | A table of members the keyed-hash match could not link on its own. No email and no hash is stored | No; 1.2.0 ignores it |

**End-of-Moon Review**

| File in `drizzle/` | What it adds | Undone by going back? |
|---|---|---|
| `0313_a_member_reviews_their_moon.sql` | Five tables: `moon_recaps`, `moon_recap_items`, `moon_invoices`, `member_pay_routes` and `moon_review_events` | No; 1.2.0 ignores them |
| `0315_an_approval_can_be_the_members_own.sql` | A `self_approved` mark, 0 by default, on three of those tables | No; 1.2.0 ignores them |
| `0317_a_member_sets_the_next_moons_goals.sql` | A table of moon goals, and columns on recap items and recaps for how each piece of work ended and the score | No; 1.2.0 ignores them |
| `0318_a_moon_keeps_its_rhythm.sql` | Four columns on recap items and recaps, and a table of the reminders sent | No; 1.2.0 ignores them |

**The Journal, accounts, powers and erasure**

| File in `drizzle/` | What it adds | Undone by going back? |
|---|---|---|
| `0261_a_journal_crosses_under_a_code_name.sql` | Two tables: members' code-names, and the outbox of what would cross to organisational memory | No; 1.2.0 ignores them |
| `0282_an_erasure_remembers_who_it_is_for.sql` | An empty column on `member_erasures` that holds who an unfinished erasure is for, cleared when it finishes | No; 1.2.0 ignores it |
| `0304_a_member_proves_their_address.sql` | An empty column on `users`, `email_verified_at`. No backfill, so every existing account starts unproved | No; 1.2.0 ignores it |
| `0306_a_second_person_signs_a_keystone.sql` | A table of keystone secrets waiting for a second person | No; 1.2.0 ignores it |
| `0307_a_power_group_can_carry_admin_access.sql` | A switch on `roles`, `grants_admin`, turned on for `founders-circle` and `steward-circle` only | No; 1.2.0 never reads it, so admin access follows each account's own role again |
| `0321_agents_in_the_village.sql` | A column on `users` marking agent accounts, three tables for the connector sign-in and what an agent did, and `sera` added to `sera_person_links`.`how` | No; 1.2.0 ignores them |

**Deciding together**

| File in `drizzle/` | What it adds | Undone by going back? |
|---|---|---|
| `0330_a_member_gathers_changes.sql` | Three tables: change requests, the changes in each, and their notes | No; 1.2.0 ignores them |
| `0334_a_quiet_vote_is_asked_again.sql` | Two columns on `ballots`: the ballot a re-run follows, and a switch for the quorum fallback, off by default | No; 1.2.0 ignores them |
| `0379_proposed_changes.sql` | Two tables: a titled group of proposed changes, and each change with what was proposed, the person's edits and what was accepted | No; 1.2.0 ignores them |

**Funding Rounds, Living Places, the Canvas and the investor path**

| File in `drizzle/` | What it adds | Undone by going back? |
|---|---|---|
| `0338_the_village_chooses_which_quests_to_fund.sql` | Seven tables: pots, their receipts, rounds, ideas, marks, earmarks, and `interaction_events` | No; 1.2.0 ignores them |
| `0348_a_backer_pledges_to_a_quest.sql` | A table of pledges to a proposed quest | No; 1.2.0 ignores it |
| `0349_investor_path_invitations_and_milestones.sql` | Six tables for what a village offers, who raised a hand, what a person said yes to, and when a home or parcel changed hands, with no amount in any of them. Two badge rows, `homeowner` and `neighbour`, in `badges`. A village that already has a badge with either id keeps its own | No; the badge rows stay |
| `0354_every_place_is_a_living_invitation.sql` | Six tables: places, their zones, stage changes, permits, links and steward claims | No; 1.2.0 ignores them |
| `0356_a_quest_says_what_it_asks_of_the_body.sql` | Three tables: what a quest asks of the body, each member's age band, and the slots of a claim | No; 1.2.0 ignores them |
| `0357_a_village_reads_its_canvas.sql` | A table of every reading of a canvas block, never rewritten | No; 1.2.0 ignores it |
| `0358_a_canvas_answer_can_be_proposed.sql` | Two tables: suggestions for a block's answer, and the Decision Matrix rows | No; 1.2.0 ignores them |
| `0359_a_member_keeps_a_notebook.sql` | Three tables: a member's documents, the files kept whole, and the canvas resources picked | No; 1.2.0 ignores them |

**Once at boot, outside `drizzle/`.** The first time 1.3.0 starts, the server
also makes these changes in its own code, each one once. Some of them do
change what you have:

| Change | What it does | Undone by going back? |
|---|---|---|
| The Base RPC endpoint | With a usable `VILLAGE_SECRETS_KEY`, a dedicated endpoint stored in the `tokens.base_rpc_url` setting is sealed into Admin, Integrations, and the old setting is cleared. Amendment-ledger lines that recorded the key keep the address with the key removed. With no usable key nothing moves | **No.** 1.2.0 reads the cleared setting and uses the public Base node until the endpoint is typed in again |
| Finished erasures | Every member already erased is given the erasure steps added since their sweep ran: their agent token, open invite link, places at gatherings, a vouch for somebody still waiting, a group they owned, a voice handed to them, and an old tombstone's public handle | **No** |
| Power group keys | The seeded Treasury group gets `cash.pay`, `moon.approve_own`, `role.pay` and `pot.steward`, the founders' and stewards' groups get `moon.approve_alone`, and the Steward Circle gets `org.seat`, `org.decide` and `proposal.decide`. A village without those groups gets nothing. `power.assign` is given to no existing village | **No.** The keys stay on the groups |
| Redemption ceilings | A redemption ceiling stored as 0, which meant no ceiling, becomes blank, which is still no ceiling. From now on 0 means zero | **No.** 1.2.0 reads the blank as no ceiling |
| Gratitude's words | Two retired phrases the platform wrote itself ("Earn Gratitude for contributions", "Gratitude Economy") are swapped, character for character, for "See what each quest pays" and "Village Economy". A sentence a person wrote is never touched | **No** |
| An established village's words | A village that already holds page words of its own keeps the path and stage, How We Govern and Circles words it shows today, written into its stored content. A village that used the first Command Centre plan keeps that plan as its own | Harmless either way: these are the words and the plan it already shows |
| The address book and paths | Fills the new Comms tables from members' accounts, form submissions and housing requests, and records who is already on a path. Sends nothing and grants nothing | No; 1.2.0 ignores them |
| Season goal ids | Gives each link 0298 made by words the id those words derive, on tables this release made | No; 1.2.0 ignores them |
| Earned Equity's rules | Each of the three Earned Equity rules that is off and has no change queued is queued to go on from the next cycle, with its amount blank. A rule the village already switched on is left alone | **No.** The queued change stays |

**What the village keeps from now on:** every email it sends is recorded, with
its words, for 18 months by default (`comms.retention_months`). A password
link's words are never stored, and erasing a member clears theirs at once.

The release workflow runs `node scripts/check-migration-compat.mjs --base
v1.2.0` against a populated 1.2.0 database before the image is published.
Take the backup in `docs/UPGRADING.md` anyway.

### For operators

- **The image moved.** `release.yml` publishes to
  `ghcr.io/regen-civics/village-os` from 1.3.0 on, so it can only run from the
  transferred repository. The first publish creates the package under the
  organisation; check it is public with the `curl` in `ops/RELEASES.md`.
- **The pinned `VILLAGE_OS_RELEASE` changes with the version.** The
  regencivics.earth card moves `VILLAGE_OS_RELEASE` from `"1.2.0"` to
  `"1.3.0"` and `VILLAGE_OS_RELEASE_COMMIT` to the commit `v1.3.0` points at;
  the release job prints both (`docs/RELEASING.md`, step 8). For this release
  only, the card's `VILLAGE_OS_REPO_URL` and its setup prompt's raw address
  also change owner, from `Rieki777` to `ReGen-Civics`. Anyone else who pins
  `VILLAGE_OS_RELEASE` moves it the same way, because that number picks the
  starter kit, the guide and the prompt.
- `release.yml` refuses a tag whose `docker-compose.yml` starts a different
  image, because the starter kit carries that file.
  `scripts/setup-prompt-contract.test.mjs` holds the setup prompt's single
  `---` line, which the card's copy button depends on.
- The fleet ledger's home is `ReGen-Civics/village-os-ops`.
- A nightly rehearsal (`.github/workflows/rehearsal.yml`) has five people walk
  the joining path against a throwaway server. It holds no secrets and needs
  GitHub Actions enabled on the repository. `ci.yml` also gains a design-rule
  step and a larger total budget for the built files.
- **A migration statement waits at most `MIGRATION_LOCK_WAIT_SECONDS` (10)
  for its table** and is retried a bounded number of times in the same boot,
  then the boot fails naming the file and the statement, and the next boot
  resumes there (`server/db/migrate.ts`). A lock timeout in a deploy log means
  retry the deploy. Never edit the SQL.
- `scripts/check-migration-sql.mjs` refuses a SQL function no migration has
  run on production, after 0298's `SHA1()` passed every gate and failed a
  deploy. 0298 was shortened on `main` after that and its backfill moved to
  boot; an instance that ran its first six statements resumes it without
  replaying anything (`server/db/migrateShrink.test.ts`). A village on a
  tagged release never ran it.

---

## 1.2.0 (2026-10-03)

**The release that makes a village yours to run.** Village OS is now public,
free and open source, with a setup path anybody can follow on their own
computer or hosting provider, and a new village starts clean instead of
wearing the first village's story.

This is a large release: more than 230 changes on `main` and 60 database
changes since 1.1.0. Read `docs/UPGRADING.md` before you move, take the backup it describes,
and move from 1.1.0 straight to 1.2.0.

### What changed for your village

**Running it yourself**

- **The platform has a name: Village OS.** `/api/platform/info` reports it as
  `product`, and reports the true version, 1.2.0. (Its `platform` field keeps
  its old value on purpose: other villages and the hub match it exactly.)
- **One computer is enough.** `docker-compose.yml` runs the village and its
  MySQL database together, with a volume for uploads. `START_HERE.md` walks
  through it, and `node scripts/fork-init.mjs --compose` writes every setting
  and secret for you.
- **A starter kit on every release page**: the guide, the setup prompt for
  your own AI assistant, the compose file, the settings template and the setup
  script, packaged from the release itself.
- **An AI assistant has one rule.** `AGENTS.md` is its front door: it explains
  each step and runs a command only after you say yes, and secrets never pass
  through it. `fork-init` no longer prints your founder password; you read it
  from `.env` yourself.
- **Claim your village from a phone.** Open `/claim`, type the one-time
  password, set your own. No shell, no curl.
- **A second way to sign in,** with Google, and `FOUNDER_EMAILS` settles the
  founder role on sign-in.
- **Members arrive by invitation.** A member who may vouch makes a one-use
  link from their profile, valid for fourteen days. Anybody else can ask to
  join.

**A new village starts clean**

- **The first village's own story pages are off in every new village**: its
  four journey pages, master plan, team, housing, visit and membership forms,
  rights pages and build history. "/" shows a plain welcome page with your
  village's own name, and the menus, footer and sitemap carry no links to
  them. A village that already served them keeps them (see the data note).
- **Neutral legal and membership wording to start from,** with places for
  your village's name, legal entity, data controller and contact, in
  `server/seeds/templates/`. Nothing applies it for you.
- **Your currency is yours to set.** It no longer defaults to another
  village's, and the Launch Plan asks for it. It asks for your timezone too,
  which still starts on the first village's clock until you choose one.
- **A new village gets artwork made from its own name,** and names its own
  cast: the word for the people who run it (Catalyst by default), and its own
  archetypes.

**Deciding together**

- Proposals from inside and outside the village, delegation that a member
  accepts, terms on every seat, a steward's veto that carries a reason, and a
  village that can hold a power itself so that giving it back is a vote.
- A launch is a proposal that names its stewards, and a village says what it
  is for before it launches.

**Value and work**

- **Every village was losing the first payout of its life.** Fixed. It does
  not recover payouts already missed.
- **Seats pay Village Credits by default,** and Village Credits count in
  hundredths.
- A member can redeem what they hold, a circle can hold its own treasury with
  two caps, and a member is vouched into membership.
- **Two people editing the same list no longer erase each other.**

**Place and people**

- A village can say where its land is, and the Living Map draws its own
  ground. Land parcels, places, photographs.
- A member can open a venture, find their own reservation, say how they are,
  and carry a portrait. Training records what was completed, and a module can
  be marked mandatory.
- Erasure goes further and records how far it got, and a failed update shows a
  page that explains itself instead of a blank error.
- **A Journal module**, off until a village turns it on: a member answers good
  questions in their own words, morning and evening, with a weekly team pulse
  and a kind road for feedback that would otherwise go unsaid.

### What you must do

- **Read `docs/UPGRADING.md`, then take the backup it describes.** This
  release changes your database.
- **Set `FOUNDER_EMAILS`** if your village uses Google sign-in.
- **Check your village's currency and timezone** in the Launch Plan
  (`/journey-to-launch`) after upgrading. A village that never set its
  currency was reading another village's, and now reads blank until it
  chooses.

### Does it touch your data

**Yes. 60 database changes**, applied by the village itself as the new version
starts, before it answers anyone. Almost all of them add tables and columns.
A few correct values that were wrong, and those corrections stay if you go
back to 1.1.0:

| Change | What it does | Undone by going back? |
|---|---|---|
| Ownership token rename | Corrects the token's name and identifier | **No** |
| Seat payouts | Switches the Gratitude payout default off for seats | **No** |
| Brochure pages | Writes `brochure-pages: on` in a database that already has members, so an existing village keeps its story pages. A new, empty database gets nothing, which means off | Harmless either way |

Going back works. Before anything is published, the release workflow applies
every one of them to a populated 1.1.0 database and confirms that every table,
column, type and constraint 1.1.0 needs is still there
(`node scripts/check-migration-compat.mjs --base v1.1.0`). It passed on
2026-10-02, and the tag runs it again before the image is published. Take the
backup anyway.

### For operators

- **The repository is public**, and the internal coordination notes that
  were in it moved to a private operations repository.
  `scripts/check-public-tree.mjs` now fails CI on internal notes, Railway
  hosts and ids, key paths, private keys and home-folder paths.
- The release workflow checks that the tag, `package.json` and
  `PLATFORM_VERSION` agree before it builds, and publishes the GitHub release
  with the starter kit, built with `git archive` from the tag.
- `.github/workflows/selfhost-smoke.yml` walks the compose path from a clean
  checkout on every change to it: boot, migrations, `/claim`, a founder
  account, a restart, and a backup and restore with the exact commands in
  `START_HERE.md`. Run it by hand with a published image to prove a release
  pulls and boots.
- The encrypted database backup must run from a private repository. On a
  public one, anybody can download the artifacts and read the logs.

---

## 1.1.0 (2026-08-31)

The first release you can name and pin.

### What you must do

Nothing. This is the first packaged release. If you are standing a village up
for the first time, `docs/PROVISIONING.md` is the walkthrough.

### Does it touch your data

No. 1.1.0 is the starting point, so there is nothing to migrate from.

### What changed for your village

Before this, there was one way to run a village: deploy whatever was newest
in the source repository at that moment. Two villages deployed on different
days were running different software, and neither could say which. From here
on, each release is packaged once, proved to start before it is published,
and kept available under its own number for as long as anyone needs it.

- **A version number.** Your village runs 1.1.0. Its `/health` page reports
  the exact commit inside that release, so the version and the running
  software can always be checked against each other.
- **An image published for anyone to pull.**
  `ghcr.io/rieki777/village-os:1.1.0`. The package is open by ruling, so a
  village that hosts itself needs no account, no invitation to the source
  repository, and no access token to run it. `ops/RELEASES.md` has the one
  setting that has to be flipped by hand the first time, and the one command
  that tells you whether it has been.
- **A release that was started before it was published.** Every release is
  built, started against an empty database, and asked to serve three real
  pages of the village. A release that cannot do all three is never
  published, so a broken build stops at the workshop door instead of
  reaching thirteen villages.
- **A way to hold still.** A village can stay on the version it is on while
  the rest of the fleet moves. `ops/RELEASES.md` has the two ways to do
  that, one for ReGen-hosted villages and one for self-hosted ones.
- **A shutdown that finishes what it started.** The image runs the server
  under a small supervisor so that a restart asks the server to stop and
  waits for it, rather than cutting it off mid-request.

### What is inside 1.1.0

This is the first packaged release, so the image carries everything the
platform has grown so far. The number is 1.1.0 rather than 1.0.0 because the
platform has been announcing itself as 1.1.0 to other villages for a while
already, on three of its own endpoints. Starting the tags at 1.0.0 would have
meant two different answers to "which version is this", which is the exact
confusion version numbers exist to prevent.

The 1.1.0 contract, which is what other villages and the hub read, adds three
public documents to what 1.0.0 offered:

- `/.well-known/village.json`, the discovery document.
- `/api/public/org.json`, the org structure as data.
- `/org/**.md`, the same structure as readable pages.

Nothing that another village already read changed shape, so a peer written
against 1.0.0 keeps working.

### For operators

- `Dockerfile` at the repository root builds the image. It re-derives the
  server's real runtime dependency list from the built bundle on every build
  and fails if any of it is unresolvable, so the list cannot go stale.
- `.github/workflows/release.yml` publishes it. Pushing an annotated tag
  `v1.1.0` cuts release 1.1.0. The workflow refuses to publish any commit
  that has not already passed the full test suite.
- `railway.toml` now carries a health check, so a deployment that cannot
  serve `/health` is marked failed and the previous deployment keeps serving.
  The timeout is 900 seconds because a first boot applies every migration
  before it listens, which was measured at 228 seconds against a cold
  database.
- `ops/roll.mjs` rolls a release across the fleet in ring order and halts at
  the first village that does not come back healthy. `ops/README.md` has the
  full procedure.
