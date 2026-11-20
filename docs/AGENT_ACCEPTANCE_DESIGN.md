# Delegated acceptance: letting an agent accept what the lead approved in chat

Status: **design only, for the lead to approve or reject.** Nothing here is built. Today only a person accepts a
proposed change, on `/admin/proposals`, and the connector is refused at accept (`person()` in
`server/routes/proposedChanges.ts`) whatever it carries.

## The question

The lead works with an agent in chat, reads a batch there, and says "yes, accept those". Then the lead has to open
the review page and press Accept on the same batch. Could the lead let the agent press it, without weakening
governance?

Our principles decide the shape: consent over command, distributed stewardship over founder dependency, decision
logs over private memory. A delegation is only acceptable if the village can see who consented to what, if it never
concentrates a power the village holds, and if every accepted change stays on the record and can be put back.

## What it would look like

### 1. A switch, off by default, that only a person turns on

- A village setting, `agents.delegated_accept`, ships **off**. It lives under `agents.`, so no agent can propose or
  set it (`variableNever` in `shared/proposedChanges.ts` refuses every `agents.` key, and the lead-approved writes
  never name it).
- Turning it on is a person's act in Admin. A village that has taken up `dial.set` needs a live holder of it, through
  the one capability gate (`shared/capabilities.ts`).

### 2. A delegation is a record, scoped and time-boxed

Turning the switch on does nothing alone. A person then **grants a delegation**: a stored row, never a code path.

| Field | Meaning |
|---|---|
| `grantedBy` | The person who granted it. Must hold the power each accepted change needs, checked at every accept. |
| `agentAccount` or token | Which connector may use it. One delegation, one agent. |
| `kinds` | Which proposal kinds it covers. Only the content and wording kinds may ever be listed (below). |
| `expiresAt` | A hard end, at most 7 days out. Default 24 hours. No renewal without a new grant. |
| `maxItems` | A ceiling on how many changes it may accept in total, such as 40. |
| `revokedAt` | A person may revoke it at any time; the next accept is refused. |

**The kinds it may ever cover** (a closed list in code, reviewed like `AGENT_WORDING_VARIABLES`): `page_content` (pages
and the word documents: vocabulary, menu, notices), `faq_add`, `faq_edit`, `seat_terms` (words only), and `role_card`
limited to its word fields (no `pay`, no `parameters` that carry money or holders).

**Never covered, whatever the grant says:** money and anything that moves value, powers and capability grants,
seating or unseating, secrets, erasure, agent accounts, sending letters or email, module lifecycle, variables other
than the wording list, and any `setting` kind (a `setting` can name any admin route, so it cannot be scoped by kind).
These are the existing never rules (`NEVER_PROPOSED`) plus the kinds above that are not wording.

### 3. The lead's quoted approval rides on each accepted item

The accept call from the agent carries, for each item, `approvedBy` (who approved it) and `approvalNote` (their words
in the chat, quoted), the same fields the lead-approved writes already carry (`APPROVAL_FIELDS` in
`shared/agentAdmin.ts`). They are stored on the change (`approved_by`, `approval_note` exist today and read
"accepted on the review page" for a person's accept), shown on the change in the page's history, and sent to the
village's organisational memory. An accept without them is refused.

The approval must name the person who granted the delegation. An agent cannot cite somebody else's approval.

### 4. The accept still runs as a person

The change still runs through its own route as the **grantor**, so the one capability gate answers for them at the
moment of the accept: if the grantor lost the power since granting, the accept fails. The agent account itself gains
no power. Mechanically this needs a short-lived grant credential the server signs for the grantor, scoped to the
accept route and the delegation id, never the grantor's own session token.

### 5. Undo is the existing "put an accepted change back"

Every change accepted this way keeps what was live before it (0400), so "Propose putting it back" works on it as on
any other. One addition: a **"Put back everything this delegation accepted"** button on the delegation, which files
one put-back batch for a person to accept. Kinds that cannot be put back (a new FAQ) say so, as they do today.

### 6. A daily digest to the lead

While a delegation is live, the lead (and every holder of the power the accepted kinds need) gets one notice a day:
what was accepted under it, each with its quoted approval and a link to put it back. The notice uses the
notifications spine (`server/lib/notify.ts`), one stable dedupe key per delegation per day.

### 7. Whether a second person's consent is needed

Recommendation: **yes for public words that speak for the village, no for the rest.**

- `page_content` on a public page (the shopfront, the investor page) and `seat_terms` (what a candidate reads before
  committing to a role) would need a second person's consent: another holder of `story.tell` (or `org.decide` for
  terms) taps "I consent" on the review page before the agent's accept goes through. Silence for 48 hours is not
  consent.
- Internal wording (FAQs, notice words, the menu, member-only pages) would need the grantor's approval alone.

This keeps the founder from being the only check on how the village presents itself, and it keeps the delegation
useful for the routine wording the lead approves many times a week.

## What risks remain

Said plainly:

1. **The chat is not the platform.** The quoted approval is whatever the agent writes. The platform cannot prove the
   lead typed it. The record makes a false approval visible and attributable to the agent's token, and the digest
   puts it in front of the lead within a day; it does not prevent it. This is the largest remaining risk.
2. **A batch can drift between approval and accept.** The lead approves what the agent showed in chat; the agent
   could accept a body that differs. Mitigation: the accept carries a hash of each body as shown, and the server
   refuses when the stored body or the person's draft differs from it. Still, the lead approves a summary in chat,
   and a summary can hide a word.
3. **Founder dependency grows, not shrinks.** A delegation from the lead makes the lead's chat the village's review
   page. The second-consent rule for public words, the 7-day ceiling and the digest to every power holder push back,
   but the pattern still routes decisions through one person's conversation. The village should revisit it after a
   season.
4. **Credentials.** A server-signed grant credential for the grantor is a new kind of token. It must be scoped to one
   route and one delegation, short-lived, and spent once per accept, or it becomes the grantor's session by another
   name.
5. **Kind scope is coarse.** `page_content` covers every page. A village may want to delegate member-only pages and
   keep the shopfront. A per-section allow-list would answer it, at the cost of one more thing to configure.
6. **Erasure.** A member's erasure must also erase the approvals they gave and the delegations they granted, and the
   accepted changes must keep their record without the name (as `forgetProposedChanges` does today).

## Open questions for the lead

1. Do you want this at all, given risk 1 (the platform cannot prove an approval in chat came from you)?
2. Which kinds should a delegation be able to cover? The proposal above: page words and word documents, FAQs, terms
   wording, role card words.
3. Should public pages and terms wording need a second person's consent, and who counts as that second person?
4. How long may a delegation last: 24 hours by default, 7 days at most?
5. Should the daily digest go to you alone, or to every holder of the powers involved?
6. Should a village be able to turn this on before it has a second steward, or only once two people hold
   `story.tell`?

## What was built instead, today (19 Nov 2026)

So the lead can judge the design against what now exists, the connector gained, with acceptance untouched:

- the village's word documents are proposable (`vocabulary`, and `page_content` on `app-vocabulary`, `app-menu`,
  `app-notices`), checked by the content route's own validators;
- a role's terms wording is readable (`read_seat_terms`, never a figure) and proposable (`seat_terms`, words only,
  every group kept as held, accepted through the org draft path as the person);
- the review queue is readable, redacted to batch, id, kind, sentence and state (`read_proposal_queue`);
- an agent may put aside proposals it filed while they wait (`discard_my_proposals`, two calls); it never accepts.
