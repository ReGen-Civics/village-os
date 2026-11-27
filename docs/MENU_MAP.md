# The menu by membership

The lead, 27 Nov 2026, round 1:

- "Let's rethink this menu from the different levels of membership (visitor, member, role holder, admin, investor, etc) and what we prioritize (like having join be first, and module library at the bottom)."
- "Let's map EVERY page in the site, determine where in the menu to show and make use of nesting to not overwhelm so we're never showing more than ~5 options while still being able to nest all pages into the menu."

Round 2, on PR #1847: "Under visitors signed out, when they go to come and see, we shouldn't have signed the love letter under there. That would be under community. ... any of the shared things can be hidden from a visitor. And wallet shouldn't be under shared things anyway. ... Library could just be its own tab under village, and so could village health. And then circles and roles can come under governance, which we could just call govern. ... The good neighbor criteria should be under village, under places and homes. ... Quests could be in both village and in governance. So with the feedback that I gave you here, take that same logic and apply it to the rest and go and redo that menu and give me another round, because I'm also looking at the member portal."

This file is the map. `client/src/config/nav.ts` is the menu it describes, and `client/src/config/navNest.test.ts` holds the menu to it for every audience.

## The rules (round 2)

1. **Four groups, by what each holds.** **Village**: the place and its life (the maps, Quests, Places and homes, the Library, Village Health). **Community**: the people and the story (Our story with the team and the Love Letter, conversations, Gratitude, gatherings, welcoming). **Join**: the ways in. **Govern** (Governance until round 2; the routes are unchanged): how the village is run and how we work (deciding, Circles & Roles, this season, the guides, how we work).
2. **Five rows at most in a group, five links at most in a folder.** A folder left with one link for a reader shows as that link (`client/src/config/navNest.ts`).
3. **Join first for a newcomer,** a visitor or someone signed in but not admitted. A member meets Village, Community, Join, Govern.
4. **The Module Library at the very bottom:** Govern is the last group for every reader, and the library is the last link of its last folder.
5. **No catch-all folder.** "Shared things" is gone. The Wallet is the member's own, in the account menu.
6. **A stranger sees only what a stranger needs:** what the village is, how to come and see, how to join, its story and team, and the Love Letter. No Wallet, Village Health, Library, Village Email, Village Tools or member tools.
7. **Each page in one place, with two named exceptions:** Quests (Village, and Govern's This season) and the roles (Join's Open Roles, and Govern's Circles & Roles). The test names both.
8. **The same rows everywhere:** the desktop dropdowns, the drawer, the account menu and the phone's More sheet draw through `client/src/components/nav/MenuRows.tsx`.

Audiences, as the gates see them: **V** visitor, **N** newcomer (signed in, not admitted), **M** member, **R** role holder (a seat or a power, such as a treasury power), **I** investor (the investor tag from #1837 unlocks `/investor`; their menu is a member's or a visitor's), **A** admin or founder. The gates are the existing ones in `nav.ts`: `roles`, `newcomers`, `module`, `door`, `brochure` and `signedIn`.

## The menu each audience sees

Every optional module on and every story page served: the most any reader can be shown. A village with a module off loses that entry, and a folder left with one entry shows as that entry.

### Visitor (signed out), and a newcomer signed in but not admitted

```
Join
  Choose your path ▸
    Investor  `/investor`
    Village Steward  `/steward`
    Resident  `/resident`
    Prosperity Creator  `/prosperity`
  Open Roles  `/roles`
  Plan a Visit  `/visit`
  Build with us ▸
    Become a partner  `/partner`
    Propose a quest  `/propose-quest`
    Business Opportunities  `/opportunities`
    Work With Us  `/work-with-us`
  Contribute  `/contribute`
Village
  Living Map  `/map`
  Quests  `/quests`
  Places and homes ▸
    Housing  `/housing`
    Stay  `/stay`
    Good Neighbor Criteria  `/rights#good-neighbor`
Community
  Our story ▸
    Our Team  `/team`
    Master Plan  `/master-plan`
    Sign the Love Letter  `/love-letter`
  Share Feedback  `/feedback`
  Gratitude  `/gratitude`
Govern
  What's happening now  `/governance`
  Circles & Roles ▸
    Circles  `/map/circles`
    Roles  `/roles`
    What We Look After  `/powers`
  Quests  `/quests`
  Guides ▸
    Co-Creators Guide  `/co-creators-guide`
    Training  `/training`
    Rights and agreements  `/rights`
    Leaving Well  `/rights#leaving-well`
  How we work ▸
    How we work together  `/governance/how`
    How We Create  `/how-we-create`
    Module Library  `/modules`
```

### Member

```
Village
  Maps ▸
    Living Map  `/map`
    Hidden map  `/hidden-map`
  Quests  `/quests`
  Places and homes ▸
    Housing  `/housing`
    Stay  `/stay`
    Good Neighbor Criteria  `/rights#good-neighbor`
    Places  `/places`
  Library  `/library`
  Village Health  `/village-health`
Community
  Our story ▸
    Our Team  `/team`
    Master Plan  `/master-plan`
    Sign the Love Letter  `/love-letter`
    Village Network  `/network`
  Conversations ▸
    Feed  `/feed`
    Forum  `/forum`
    Village Tools  `/tools`
    Share Feedback  `/feedback`
  Gratitude  `/gratitude`
  Gatherings ▸
    Events  `/events`
    Live Sessions  `/sessions`
    Seasonal Festivals  `/seasonal-festivals`
  Welcoming ▸
    Rites  `/rites`
    Introductions  `/introductions`
Join
  Choose your path ▸
    Investor  `/investor`
    Village Steward  `/steward`
    Resident  `/resident`
    Prosperity Creator  `/prosperity`
  Open Roles  `/roles`
  Plan a Visit  `/visit`
  Build with us ▸
    Become a partner  `/partner`
    Propose a quest  `/propose-quest`
    Business Opportunities  `/opportunities`
    Work With Us  `/work-with-us`
  Fund the village ▸
    Contribute  `/contribute`
    Crowd pooling  `/campaigns`
Govern
  Decide ▸
    What's happening now  `/governance`
    Decisions  `/governance/decisions`
    Treasury  `/governance/treasury`
    Make a Proposal  `/propose`
  Circles & Roles ▸
    Circles  `/map/circles`
    Roles  `/roles`
    What We Look After  `/powers`
    How roles are going  `/role-measures`
  This season ▸
    Season Plans  `/season-plans`
    Join the Season  `/season-places`
    Funding Rounds  `/funding-rounds`
    Agreed terms  `/aligned`
    Quests  `/quests`
  Guides ▸
    Co-Creators Guide  `/co-creators-guide`
    Training  `/training`
    Rights and agreements  `/rights`
    Leaving Well  `/rights#leaving-well`
  How we work ▸
    How we work together  `/governance/how`
    How We Create  `/how-we-create`
    Village Email  `/village-email`
    Module Library  `/modules`
Account menu (your name)
  My Profile  `/profile`
  Messages  `/messages`
  My tasks  `/profile#my-tasks`
  Your things ▸
    Waiting on you  `/governance/work`
    Wallet  `/wallet`
    Journal  `/journal`
    Protocols  `/protocols`
    Badges  `/badges`
  🌳 Launch Plan  `/journey-to-launch`
```

### Role holder with a treasury power

```
Village
  Maps ▸
    Living Map  `/map`
    Hidden map  `/hidden-map`
  Quests  `/quests`
  Places and homes ▸
    Housing  `/housing`
    Stay  `/stay`
    Good Neighbor Criteria  `/rights#good-neighbor`
    Places  `/places`
  Library  `/library`
  Village Health  `/village-health`
Community
  Our story ▸
    Our Team  `/team`
    Master Plan  `/master-plan`
    Sign the Love Letter  `/love-letter`
    Village Network  `/network`
  Conversations ▸
    Feed  `/feed`
    Forum  `/forum`
    Village Tools  `/tools`
    Share Feedback  `/feedback`
  Gratitude  `/gratitude`
  Gatherings ▸
    Events  `/events`
    Live Sessions  `/sessions`
    Seasonal Festivals  `/seasonal-festivals`
  Welcoming ▸
    Rites  `/rites`
    Introductions  `/introductions`
Join
  Choose your path ▸
    Investor  `/investor`
    Village Steward  `/steward`
    Resident  `/resident`
    Prosperity Creator  `/prosperity`
  Open Roles  `/roles`
  Plan a Visit  `/visit`
  Build with us ▸
    Become a partner  `/partner`
    Propose a quest  `/propose-quest`
    Business Opportunities  `/opportunities`
    Work With Us  `/work-with-us`
  Fund the village ▸
    Contribute  `/contribute`
    Crowd pooling  `/campaigns`
Govern
  Decide ▸
    What's happening now  `/governance`
    Decisions  `/governance/decisions`
    Treasury  `/governance/treasury`
    Make a Proposal  `/propose`
  Circles & Roles ▸
    Circles  `/map/circles`
    Roles  `/roles`
    What We Look After  `/powers`
    How roles are going  `/role-measures`
  This season ▸
    Season Plans  `/season-plans`
    Join the Season  `/season-places`
    Funding Rounds  `/funding-rounds`
    Agreed terms  `/aligned`
    Quests  `/quests`
  Guides ▸
    Co-Creators Guide  `/co-creators-guide`
    Training  `/training`
    Rights and agreements  `/rights`
    Leaving Well  `/rights#leaving-well`
  How we work ▸
    How we work together  `/governance/how`
    How We Create  `/how-we-create`
    Village Email  `/village-email`
    Module Library  `/modules`
Account menu (your name)
  My Profile  `/profile`
  Messages  `/messages`
  My tasks  `/profile#my-tasks`
  Your things ▸
    Waiting on you  `/governance/work`
    Wallet  `/wallet`
    Journal  `/journal`
    Protocols  `/protocols`
    Badges  `/badges`
  Running the village ▸
    🌳 Launch Plan  `/journey-to-launch`
    Treasury desk  `/treasury`
```

### Admin or founder

```
Village
  Maps ▸
    Living Map  `/map`
    Hidden map  `/hidden-map`
  Quests  `/quests`
  Places and homes ▸
    Housing  `/housing`
    Stay  `/stay`
    Good Neighbor Criteria  `/rights#good-neighbor`
    Places  `/places`
  Library  `/library`
  Village Health  `/village-health`
Community
  Our story ▸
    Our Team  `/team`
    Master Plan  `/master-plan`
    Sign the Love Letter  `/love-letter`
    Village Network  `/network`
  Conversations ▸
    Feed  `/feed`
    Forum  `/forum`
    Village Tools  `/tools`
    Share Feedback  `/feedback`
  Gratitude  `/gratitude`
  Gatherings ▸
    Events  `/events`
    Live Sessions  `/sessions`
    Seasonal Festivals  `/seasonal-festivals`
  Welcoming ▸
    Rites  `/rites`
    Introductions  `/introductions`
Join
  Choose your path ▸
    Investor  `/investor`
    Village Steward  `/steward`
    Resident  `/resident`
    Prosperity Creator  `/prosperity`
  Open Roles  `/roles`
  Plan a Visit  `/visit`
  Build with us ▸
    Become a partner  `/partner`
    Propose a quest  `/propose-quest`
    Business Opportunities  `/opportunities`
    Work With Us  `/work-with-us`
  Fund the village ▸
    Contribute  `/contribute`
    Crowd pooling  `/campaigns`
Govern
  Decide ▸
    What's happening now  `/governance`
    Decisions  `/governance/decisions`
    Treasury  `/governance/treasury`
    Make a Proposal  `/propose`
  Circles & Roles ▸
    Circles  `/map/circles`
    Roles  `/roles`
    What We Look After  `/powers`
    How roles are going  `/role-measures`
  This season ▸
    Season Plans  `/season-plans`
    Join the Season  `/season-places`
    Funding Rounds  `/funding-rounds`
    Agreed terms  `/aligned`
    Quests  `/quests`
  Guides ▸
    Co-Creators Guide  `/co-creators-guide`
    Training  `/training`
    Rights and agreements  `/rights`
    Leaving Well  `/rights#leaving-well`
  How we work ▸
    How we work together  `/governance/how`
    How We Create  `/how-we-create`
    Village Email  `/village-email`
    Module Library  `/modules`
Account menu (your name)
  My Profile  `/profile`
  Messages  `/messages`
  My tasks  `/profile#my-tasks`
  Your things ▸
    Waiting on you  `/governance/work`
    Wallet  `/wallet`
    Journal  `/journal`
    Protocols  `/protocols`
    Badges  `/badges`
  Running the village ▸
    🌳 Launch Plan  `/journey-to-launch`
    Treasury desk  `/treasury`
    🛠 Command Centre  `/project-history`
    Review  `/admin/review`
    Village Settings  `/admin`
```

## The member portal (the profile's phone tabs)

The lead, round 2: "I'm also looking at the member portal and I'm seeing some things could be rearranged here too, following the same logic." On a phone the profile is five tabs (`client/src/components/profileDash/ProfileTabs.tsx`); a desktop shows the whole page in one column, unchanged.

| Tab, before | Tab, now | What changed |
|---|---|---|
| Today | Today | Your path, your first 14 days, who you are (the hero stays here), your week, follow-ups. The door to proposing moved to My work and My roles. |
| Quests | My work | Renamed, so it never reads as the village's Quests page. Your quests, tasks and asks, and now the door to proposing a role or a quest. |
| Roles | My roles | Renamed, so it never reads as the village's Roles page. Your roles, your card, your moon, your season plan, and the door to proposing. |
| Treasury | My treasury | Renamed, so it never reads as Govern's Treasury tab (the village's budget). What you hold, Gratitude first, cash owed, the ledger. |
| Sheet | Sheet | Unchanged: your needs, journal, Gene Keys, about you and your paths. |

The tab ids are unchanged, so every `/profile#anchor` the app links to still opens its tab. The village's own things on the portal (the quest board, the roles) link out to their menu homes. Moves to decide next are listed under "For the lead" below.


## Every page

Every route in `client/src/App.tsx`, 151 of them, plus Rights and agreements (`/rights`), which fold 3 (#1857) adds. "Menu on main" is where `nav.ts` had it before this change, and "Menu now" is where it is after. A page with no menu entry is reached from the page in the last column. Decisions: **STAY**; **FOLD?** a candidate to fold into another page (listed below, not done here); **FOLDED** or **FOLDING** done or under way in another lane; **REMOVED**.

| Route | Page | Who | Menu on main | Menu now | Decision | Note |
|---|---|---|---|---|---|---|
| `/` |  | V N M R I A | - | - | STAY | Home: the logo and the phone's Home tab |
| `/journey-to-launch` | Journey to launch | M R A | Governance / 🌳 Launch Plan | Account menu / Running the village / 🌳 Launch Plan | STAY | the village test run |
| `/setup-game` | The Setup Game | A | - | - | STAY | the Setup Game (Rye, 2026-10-31), reached from Village Settings |
| `/canvas/workbook` | Canvas workbook | A | - | - | STAY | reached from the Governance canvas |
| `/project-history` | Command Centre | A | Governance / 🛠 Command Centre | Account menu / Running the village / 🛠 Command Centre | STAY | the first village's build history |
| `/claim` | Claim this village | A | - | - | STAY | a new village's first step, reached by link |
| `/feedback` | Feedback | V N M R I A | Community / Share Feedback | Community / Conversations / Share Feedback | FOLD? | could become a row in the guide's corner panel (Scarlet) |
| `/network` | Village network | V N M R I A | About / Village Network | Community / Our story / Village Network | STAY |  |
| `/contribute` | Contribute | V N M R I A | Join / Contribute | Join / Fund the village / Contribute | STAY |  |
| `/seasonal-festivals` | Seasonal festivals | V N M R I A | Community / Seasonal Festivals | Community / Gatherings / Seasonal Festivals | STAY |  |
| `/investor` | Investor journey | V N M R I A | Join / Investor | Join / Choose your path / Investor | STAY | gated to accepted investors by #1837 |
| `/steward` | Steward journey | V N M R I A | Join / Village Steward | Join / Choose your path / Village Steward | STAY |  |
| `/resident` | Resident journey | V N M R I A | Join / Resident | Join / Choose your path / Resident | STAY |  |
| `/prosperity` | Prosperity journey | V N M R I A | Join / Prosperity Creator | Join / Choose your path / Prosperity Creator | STAY |  |
| `/love-letter` | {commitment} | V N M R I A | Join / Sign the Love Letter | Community / Our story / Sign the Love Letter | STAY | Community, Our story (round 2) |
| `/circles` | Circles | V N M R I A | Village / Circles | Govern / Circles & Roles / Circles | STAY | folds into Circles & Roles where the map runs (unlessModule) |
| `/circles/:id` |  | V N M R I A | - | - | STAY | reached from Circles & Roles |
| `/quests` | Quests | V N M R I A | Village / Quests | Village / Quests; Govern / This season / Quests | STAY | in Village and in Govern's This season, on purpose (round 2); also a phone tab |
| `/quests/:id` |  | V N M R I A | - | - | STAY | reached from Quests, the treasury and the profile |
| `/tools` | Tools | M R A | Village / Tools | Community / Conversations / Village Tools | STAY | Village Tools, in Community's Conversations: where the village talks and meets outside this app |
| `/modules` | Module Library | V N M R I A | the bar / Module Library; About / Module Library | Govern / How we work / Module Library | STAY | last of all: the last link of Govern, the last group |
| `/modules/:id` |  | V N M R I A | - | - | STAY | reached from the Module Library |
| `/campaigns` | Crowd pooling | V N M R I A | Join / Crowd pooling | Join / Fund the village / Crowd pooling | STAY |  |
| `/campaign/:slug` |  | V N M R I A | - | - | STAY | reached from Crowd pooling |
| `/map` | Village map | V N M R I A | the bar / Living Map | Village / Maps / Living Map | STAY | Village's first row (with the hidden map beside it for a member) |
| `/places` | Places, photographed | M R A | Village / Places | Village / Places and homes / Places | STAY | Village, Places and homes; holds the photographs since fold 5, #1856 |
| `/places/:key` |  | M R A | - | - | STAY | reached from Places and the map |
| `/photographs` | Every photograph | - | Village / Photographs | - | FOLDED | into Places (/places#photos) by fold 5, #1856; redirects there |
| `/map/circles` | Circles and roles | V N M R I A | Village / Circles & Roles | Govern / Circles & Roles / Circles | STAY |  |
| `/events` | Village Calendar | V N M R I A | Community / Events | Community / Gatherings / Events | STAY |  |
| `/first-walk` | redirects to `/` | - | Guides / Your First Walk | - | REMOVED | the lead, 27 Nov 2026: "Let's get rid of this"; redirects home |
| `/feed` | Village feed | V N M R I A | Community / Feed | Community / Conversations / Feed | STAY |  |
| `/stay` | Stays | V N M R I A | Village / Stay | Village / Places and homes / Stay | STAY |  |
| `/tokens` | redirects to `/wallet` | - | - | - | STAY | old address, redirects to Wallet |
| `/wallet` | Wallet | M R A | Village / Wallet; Account menu / Wallet | Account menu / Your things / Wallet | STAY | the member's own: account menu, Your things (round 2: never under shared) |
| `/pay` | Pay and receive | M R A | - | - | STAY | a phone tile once credits are in use, and the treasury's Send; no menu entry, because its gate is the credits read |
| `/badges` | Badges & skills | M R A | Account menu / Badges | Account menu / Your things / Badges | STAY |  |
| `/powers` | What this village looks after | V N M R I A | Governance / What We Look After | Govern / Circles & Roles / What We Look After | STAY |  |
| `/pricing` | Pricing desk | R A | - | - | FOLD? | the pricing desk: could be a section of the Treasury |
| `/budget` | redirects to `/governance/treasury#cash-budget` | - | Account menu / Cash Budget | - | FOLDED | into Govern's Treasury tab by #1843 (on this branch since the 1.3.94 merge); redirects to /governance/treasury#cash-budget |
| `/review/structure/:batchId` |  | A | - | - | STAY | reached from Review |
| `/approvals` | Approvals | - | - | - | FOLDED | into Your work (/governance/work#approvals) by folds 6 and 7, #1861 |
| `/governance/work` |  | M R A | Governance / Your work | Account menu / Your things / Waiting on you | STAY | a Governance view; "Waiting on you" in the account menu, the member's own |
| `/review` | redirects to `/governance/work` | - | - | - | STAY | old address, redirects to Your work |
| `/cash-payouts` | Cash to pay out | R A | - | - | FOLD? | the cash pay queue: a section of the Treasury desk |
| `/treasury` | Treasury | R A | Account menu / Treasury | Account menu / Running the village / Treasury desk | FOLD? | the treasurer's desk (mint and pay queues). With the Treasury tab at /governance/treasury there are two treasuries: one page with the desk shown to power holders |
| `/library` | Material library | M R A | Village / Library | Village / Library | STAY | its own entry in Village (round 2); a member's. Also the footer |
| `/village-health` | Village health | M R A | Village / Health | Village / Village Health | STAY | its own entry in Village (round 2); a member's |
| `/exit-policy` | Leaving well | - | Guides / Leaving Well | Govern / Guides / Leaving Well (`/rights#leaving-well`) | FOLDED | into Rights and agreements (/rights#leaving-well) by fold 3, #1857; Govern, Guides keeps a Leaving Well row that opens the chapter |
| `/forum` | Forum | M R A | Community / Forum | Community / Conversations / Forum | STAY |  |
| `/forum/:id` |  | M R A | - | - | STAY | reached from the Forum |
| `/messages` | Messages | M R A | Community / Messages; Account menu / Messages | Account menu / Messages | STAY | one menu door now, with its count (it was in Community and the account menu) |
| `/messages/:id` |  | M R A | - | - | STAY | reached from Messages |
| `/introductions` | Introductions | M R A | Community / Introductions | Community / Welcoming / Introductions | STAY |  |
| `/propose-quest` | Propose a quest | V N M R I A | - | Join / Build with us / Propose a quest | STAY | new menu door (27 Nov 2026); also the four ways to build |
| `/partner` | Become a partner | V N M R I A | - | Join / Build with us / Become a partner | STAY | new menu door (27 Nov 2026); also the four ways to build |
| `/roles/select` | Find your roles | V N M R | - | - | STAY | reached from Open Roles (Apply) |
| `/roles/draft` | redirects to `/roles/select` | - | - | - | STAY | old address, redirects |
| `/roles` | Roles | V N M R I A | Village / Roles | Join / Open Roles; Govern / Circles & Roles / Roles | STAY | Open Roles under Join and Roles under Govern's Circles & Roles, on purpose; also a phone tab |
| `/roles/:slug` |  | V N M R I A | - | - | STAY | reached from Open Roles |
| `/join` | redirects to `/roles` | - | - | - | STAY | old address, redirects to Open Roles |
| `/apply` | redirects to `/roles` | - | - | - | STAY | old address, redirects to Open Roles |
| `/how-we-create` | How we create | V N M R I A | About / How We Create | Govern / How we work / How We Create | STAY |  |
| `/co-creators-guide` | Co-creators guide | V N M R I A | Guides / Co-Creators Guide | Govern / Guides / Co-Creators Guide | STAY |  |
| `/housing` | Housing | V N M R I A | Village / Housing | Village / Places and homes / Housing | STAY |  |
| `/reserve` | Reserve your home | M R | - | - | STAY | reached from Housing |
| `/opportunities` | Opportunities | V N M R I A | Join / Business Opportunities | Join / Build with us / Business Opportunities | STAY |  |
| `/master-plan` | Master plan | V N M R I A | About / Master Plan | Community / Our story / Master Plan | STAY |  |
| `/team` | Team | V N M R I A | About / Our Team | Community / Our story / Our Team | STAY |  |
| `/admin` | Village settings | A | Account menu / Village Settings | Account menu / Running the village / Village Settings | STAY |  |
| `/admin/mint` |  | R A | - | - | STAY | reached from the Treasury desk |
| `/admin/proposals` |  | A | - | - | FOLDING | the Governance lane folds it into /admin/review |
| `/admin/review` |  | A | - | Account menu / Running the village / Review | STAY | new menu door (27 Nov 2026): the admin's one review page |
| `/profile` | My profile | N M R I A | Account menu / My Profile | Account menu / My Profile | STAY |  |
| `/profile/characters` |  | M R A | - | - | STAY | reached from the profile |
| `/profile/gene-keys` |  | M R A | - | - | STAY | reached from the profile |
| `/profile/settings` |  | N M R I A | - | - | STAY | reached from the profile's own Settings button |
| `/welcome` | Welcome | V N | - | - | STAY | a rite's welcome, reached by its link |
| `/aboard` | Join | V N | - | - | STAY | a rite's joining flow, reached by its link |
| `/aboard/welcome` | You're in | N | - | - | STAY | the end of that flow |
| `/rites` | Rites | M R A | Community / Rites | Community / Welcoming / Rites | STAY |  |
| `/rites/ceremony/:id` |  | M R A | - | - | STAY | reached from Rites |
| `/rites/packet` | Your printed code | M R A | - | - | STAY | reached from Rites |
| `/card` | Your card | M R A | - | - | STAY | reached from Rites |
| `/fleet` | The village at a glance | M R A | - | - | FOLD? | the village at a glance: overlaps the map and Now; reached from Rites |
| `/door/:code` |  | V | - | - | STAY | a printed code's door |
| `/profile/:handle` |  | V N M R I A | - | - | STAY | a member's public page, reached from names |
| `/login` | Sign in | V | - | - | STAY | the header's Sign in |
| `/visitor/sign-in` |  | V | - | - | STAY | a visitor's way back in |
| `/visitor` |  | V | - | - | STAY | a visitor's own profile, the menu's visitor link |
| `/oauth/authorize` | Connect an agent | M A | - | - | STAY | connecting an agent, reached from Settings |
| `/register` | Join | V | - | - | STAY | reached from Sign in |
| `/request-membership` | Ask to join | V N | - | - | STAY | reached from Sign in and Open Roles |
| `/propose-a-role/confirm` |  | V N | - | - | STAY | a step of the application |
| `/propose-a-role/:token` |  | V N | - | - | STAY | a saved application |
| `/propose-a-role` | Apply | V N M | - | - | STAY | the application, reached from Open Roles |
| `/set-password` | Choose a password | V | - | - | STAY | an email link |
| `/verify-email` | Confirm your address | V | - | - | STAY | an email link |
| `/email/preferences` |  | N M R I A | - | - | STAY | an email link and Settings |
| `/email/unsubscribe` |  | V N M | - | - | STAY | an email link |
| `/email/a` |  | V N M | - | - | STAY | an email's one-tap action |
| `/forgot-password` | Set a new password | V | - | - | STAY | reached from Sign in |
| `/game-mechanics` | Game Mechanics | - | Guides / Game Mechanics | - | FOLDED | into How we work together (/governance/how#game-mechanics, members only) by fold 4, #1854; redirects there |
| `/changes` | Change requests | - | Governance / Change Requests | - | FOLDED | into Decisions (/governance/decisions#changes) by folds 6 and 7, #1861 |
| `/changes/:id` |  | M R A | - | - | STAY | reached from the change requests inside Decisions |
| `/village-email` | How the village emails | M R A | Guides / Village Email | Govern / How we work / Village Email | STAY | out of Guides (the lead: "the village emails can be nested somewhere else"), into Govern's How we work; a member's |
| `/good-neighbor` | Good neighbor | - | Guides / Good Neighbor | Village / Places and homes / Good Neighbor Criteria (`/rights#good-neighbor`) | FOLDED | into Rights and agreements (/rights#good-neighbor) by fold 3, #1857; Village, Places and homes keeps its row, opening the chapter, with its switch and name still under /good-neighbor |
| `/steward-rights` | Steward rights | - | Guides / Steward Rights | - | FOLDED | into Rights and agreements (/rights#steward-rights) by fold 3, #1857 |
| `/resident-rights` | Resident rights | - | Guides / Resident Rights | - | FOLDED | into Rights and agreements (/rights#resident-rights) by fold 3, #1857 |
| `/training/steward` | Steward training | M R | - | - | STAY | reached from Training |
| `/training/resident` | Resident training | M R | - | - | STAY | reached from Training |
| `/training` | Training | V N M R I A | Guides / Training | Govern / Guides / Training | STAY |  |
| `/governance` | Governance | V N M R I A | - | Govern / Decide; Govern / Decide / What's happening now | STAY | Govern's hub and its group page; "What's happening now" in the menu |
| `/governance/how` |  | V N M R I A | About / How we work together | Govern / How we work / How we work together | STAY | in Govern's How we work |
| `/governance/treasury` | Treasury | M R A | - | Govern / Decide / Treasury | STAY | Govern's Treasury tab (#1843): the cash budget folded in from /budget |
| `/governance/decisions` |  | M R A | Governance / Decisions | Govern / Decide / Decisions | STAY |  |
| `/governance/decisions/drafts/:draftId` |  | M R A | - | - | STAY | a draft's page (#1806), reached from Decisions and Review |
| `/governance/decisions/:id` |  | M R A | - | - | STAY | reached from Decisions |
| `/decisions` | redirects to `/governance/decisions` | - | - | - | STAY | old address, redirects |
| `/decisions/:id` | redirects to `/governance/decisions/` | - | - | - | STAY | old address, redirects |
| `/propose` | Start a proposal | M R A | Governance / Make a Proposal | Govern / Decide / Make a Proposal | STAY |  |
| `/role-applications/:id` |  | N M A | - | - | STAY | an application's page |
| `/open-proposals/:id` |  | V N M A | - | - | STAY | a proposal's page |
| `/role-measures` | How roles are going | M R A | - | Govern / Circles & Roles / How roles are going | STAY | new menu door: Govern, Circles & Roles (round 2) |
| `/application-status/:ref` |  | V N | - | - | STAY | an applicant's own status link |
| `/path` | Your path | V N M R I A | - | - | STAY | the phone tab Your path |
| `/seat-applications/:id` |  | - | - | - | STAY | old address |
| `/role-proposals/new` |  | M R A | - | - | STAY | reached from Open Roles and Make a Proposal |
| `/role-proposals/shared/:token` |  | V N M | - | - | STAY | a shared draft link |
| `/role-proposals/:id` |  | M R A | - | - | STAY | reached from Your work |
| `/season-plans/mine` | Your season | M R | - | - | STAY | reached from Season Plans and the profile |
| `/season-plans` | The village's season | M R A | Governance / Season Plans | Govern / This season / Season Plans | FOLD? | Season Plans, Join the Season and Aligned are three views of one season: one page with tabs |
| `/season-places/circles` | The season's circles | M R A | - | - | STAY | reached from Join the Season |
| `/season-places` | Join the season | M R A | Governance / Join the Season | Govern / This season / Join the Season | FOLD? | see Season Plans |
| `/role-path/:roleId` |  | M R | - | - | STAY | a role's path, reached from the role |
| `/aligned` | Aligned | M R A | Governance / Aligned | Govern / This season / Agreed terms | FOLD? | "Agreed terms" in the menu (QA, 27 Nov 2026), the register of terms members aligned with; see Season Plans |
| `/visit` | Visit | V N M R I A | Join / Plan a Visit | Join / Plan a Visit | STAY |  |
| `/gratitude` | Gratitude | V N M R I A | Community / Gratitude | Community / Gratitude | STAY |  |
| `/journal` | Journal | M R A | Account menu / Journal | Account menu / Your things / Journal | STAY |  |
| `/protocols/practice/:protocolId` |  | M R A | - | - | STAY | reached from Protocols |
| `/protocols/run/:id` |  | M R A | - | - | STAY | reached from Protocols |
| `/protocols` | Protocols | M R A | Account menu / Protocols | Account menu / Your things / Protocols | STAY |  |
| `/hidden-map` | Hidden map | M R A | Village / Hidden map | Village / Maps / Hidden map | STAY | Village's Maps folder; no longer added to the phone sheet's Also yours |
| `/funding-rounds` | Funding rounds | M R A | Governance / Funding Rounds | Govern / This season / Funding Rounds | STAY |  |
| `/funding-rounds/:id` |  | M R A | - | - | STAY | reached from Funding Rounds |
| `/sessions` | Live sessions | M R A | Community / Live Sessions | Community / Gatherings / Live Sessions | STAY |  |
| `/sessions/season` |  | M R A | - | - | STAY | reached from Live Sessions |
| `/sessions/:id` |  | M R A | - | - | STAY | reached from Live Sessions |
| `/work-with-us` | Work with us | V N M R I A | Join / Work With Us | Join / Build with us / Work With Us | STAY |  |
| `/reset` | A fresh start | V N M | - | - | STAY | a fresh start for a phone stuck on an old version, handed over as a link |
| `/404` | Page not found | V N M R I A | - | - | STAY | the not-found page |
| `/rights` | Rights and agreements | V N M R I A | - | Govern / Guides / Rights and agreements | STAY | Rights and agreements (fold 3, #1857): Good Neighbor criteria, Resident Rights, Steward Rights and Leaving Well as four chapters |

## What changed, in short

- **Gone:** Your First Walk (`/first-walk` redirects home). The bar's separate Living Map and Module Library entries. The About and Guides groups and the "Shared things" folder; their pages are in Community, Village and Govern.
- **Village:** the maps (the hidden map beside the Living Map for a member), Quests, Places and homes (Housing, Stay, Good Neighbor Criteria, a chapter of Rights and agreements since #1857, Places, which holds the photographs since #1856), the Library and Village Health as their own entries.
- **Community:** Our story (Our Team, Master Plan, the Love Letter, Village Network), Conversations (Feed, Forum, Village Tools, Share Feedback), Gratitude, Gatherings, Welcoming.
- **Join:** the paths, Open Roles, Plan a Visit, Build with us (Become a partner, Propose a quest, Business Opportunities, Work With Us), Fund the village.
- **Govern:** Decide (What's happening now, Decisions, which holds change requests since #1861, Treasury, Make a Proposal), Circles & Roles (Circles, Roles, What We Look After, How roles are going), This season (Season Plans, Join the Season, Funding Rounds, Agreed terms, Quests), Guides (Co-Creators Guide, Training, Rights and agreements since #1857, Leaving Well), How we work (How we work together, which holds Game Mechanics since #1854, How We Create, Village Email, Module Library).
- **The account menu, the member's own:** My Profile, Messages, My tasks (each with its count), Your things (Waiting on you, Wallet, Journal, Protocols, Badges), Running the village (Launch Plan, Treasury desk, Command Centre, Review, Village Settings).
- **New doors:** Become a partner, Propose a quest, How roles are going, the admin's Review page, and the footer's Library and hidden map.
- **The QA round (27 Nov 2026):** one folder open at a time; "Choose your path" open for a newcomer; folder rows and icon-less links keep the icon gutter; Escape returns focus; the footer says Govern, matches the menu's words and hides Village Health from a visitor; the phone sheet shows each page once.
- **Gated as before:** no gate was added. A newcomer meets none of a member's working areas.

## Folds to consider next (not done here)

1. **The two treasuries.** The Treasury desk (`/treasury`: mint and pay queues), `/cash-payouts` and `/pricing` could be sections of Govern's Treasury tab, shown to whoever holds the power.
2. **The season.** Season Plans, Join the Season and Agreed terms are three views of one season: one page with tabs.
3. **The village at a glance** (`/fleet`) overlaps the map and Govern's What's happening now.
4. **Pay** (`/pay`) has no menu entry, because its gate is the credits read (`shared/payGate.ts`): it is a phone tile and the treasury's Send. A `credits` gate in `nav.ts` would give it one.

## Not done here

- A village can rename a group and hide an entry in Admin (`shared/menuDoc.ts`, which carries a name given to Governance or Decide over to Govern), but it cannot rename a folder yet; folder names are the platform's words, translated (`client/src/config/navWords.ts`).
- The breadcrumb names the group and the page, not the folder between them.

## For the lead

1. **Good Neighbor Criteria on Amora.** The platform's menu name for the page is now "Good Neighbor Criteria", but Amora's stored site settings still say "Good Neighbor", so set Admin > Pages > Whole site > the menu name for /good-neighbor to "Good Neighbor Criteria". "How we co-create" is your word for How We Create; rename it the same way if you want it.
2. **Tools.** Village Tools (the village's grid of outside tools: chat, calendar, Hypha) sits in Community's Conversations, as where the village talks and meets. Village is the other choice.
3. **The portal's next moves.** On My work, the quest board summary (GameDashboard) repeats the village's Quests page; it could become one link to it. On My roles, Your roles and the player card could merge into one card per role.
4. **Spanish.** "Govern" is "Gobernar" and the portal tabs "Mi trabajo", "Mis roles", "Mi tesorería", "Ficha"; all marked for native review in `client/src/locales/es.d/menu-levels.po`.

