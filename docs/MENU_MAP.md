# The menu by membership

The lead, 27 Nov 2026:

- "Let's rethink this menu from the different levels of membership (visitor, member, role holder, admin, investor, etc) and what we prioritize (like having join be first, and module library at the bottom)."
- "Let's map EVERY page in the site, determine where in the menu to show and make use of nesting to not overwhelm so we're never showing more than ~5 options while still being able to nest all pages into the menu."
- "While we're mapping all the unique pages let's consider which ones we can fold their features into existing pages in a good way and also consider if we need the pages at all."

This file is the map. `client/src/config/nav.ts` is the menu it describes, and `client/src/config/navNest.test.ts` holds the menu to it for every audience.

## The rules

1. **Five groups on the bar.** Village, Community, Governance, Join, About. No page takes a bar slot of its own: the Living Map is Village's first row and the Module Library is About's last.
2. **Five rows at most in a group, and five links at most in a folder.** A row is a link or a folder. Links that share a `sub` in `nav.ts` draw as one folder (`client/src/config/navNest.ts`). A folder left with one link for a reader draws as that link.
3. **Join first for a newcomer.** A visitor, and someone signed in whom the village has not admitted, meet Join first (`leads: "newcomers"`). A member meets the village first and Join fourth.
4. **The Module Library at the bottom,** the last entry of the last group, for every reader.
5. **Each page in one place.** Messages and Wallet each had two menu doors; each has one now.
6. **The same rows everywhere.** The desktop dropdowns, the drawer, the account menu and the phone's More sheet all draw through `client/src/components/nav/MenuRows.tsx`, so a folder opens the same way on each.
7. **Built on where Governance is going.** `/governance` is the hub, and its views are Now, Decisions, Your work, Treasury and How we decide (`client/src/components/governance/now/GovernanceTabs.tsx`; the Treasury tab comes with #1843). The group leads with Now, Decisions and Treasury, and puts the season's pages in one folder and the other views in a second.

Audiences, as the gates see them: **V** visitor, **N** newcomer (signed in, not admitted), **M** member, **R** role holder (a seat or a power, such as a treasury power), **I** investor (the investor tag from #1837, which unlocks `/investor`; their menu is a member's or a visitor's), **A** admin or founder. The gates are the existing ones: `roles`, `newcomers`, `module`, `door`, `brochure` and `signedIn` in `nav.ts`.

## The menu each audience sees

Every optional module on and every story page served: the most any reader can be shown. A village with a module off loses that entry, and a folder left with one entry draws as that entry.

### Visitor (signed out), and a newcomer signed in but not admitted

```
Join
  Choose your path ▸
    Investor  `/investor`
    Village Steward  `/steward`
    Resident  `/resident`
    Prosperity Creator  `/prosperity`
  Open Roles  `/roles`
  Come and see ▸
    Plan a Visit  `/visit`
    Sign the Love Letter  `/love-letter`
  Build with us ▸
    Become a partner  `/partner`
    Propose a quest  `/propose-quest`
    Business Opportunities  `/opportunities`
    Work With Us  `/work-with-us`
  Contribute  `/contribute`
Village
  Living Map  `/map`
  Quests  `/quests`
  Circles & Roles  `/map/circles`
  Places and homes ▸
    Housing  `/housing`
    Stay  `/stay`
  Shared things ▸
    Library  `/library`
    Wallet  `/wallet`
    Health  `/village-health`
Community
  Gratitude  `/gratitude`
Governance
  Now  `/governance`
  More in Governance ▸
    How we work together  `/governance/how`
    What We Look After  `/powers`
About
  Our story ▸
    How We Create  `/how-we-create`
    Master Plan  `/master-plan`
    Our Team  `/team`
  How we work ▸
    Game Mechanics  `/game-mechanics`
    Village Email  `/village-email`
    Good Neighbor  `/good-neighbor`
  Guides ▸
    Co-Creators Guide  `/co-creators-guide`
    Training  `/training`
    Resident Rights  `/resident-rights`
    Steward Rights  `/steward-rights`
    Leaving Well  `/exit-policy`
  Share Feedback  `/feedback`
  Module Library  `/modules`
```

### Member

```
Village
  Living Map  `/map`
  Quests  `/quests`
  Circles & Roles  `/map/circles`
  Places and homes ▸
    Places  `/places`
    Photographs  `/photographs`
    Hidden map  `/hidden-map`
    Housing  `/housing`
    Stay  `/stay`
  Shared things ▸
    Library  `/library`
    Tools  `/tools`
    Wallet  `/wallet`
    Health  `/village-health`
Community
  Feed  `/feed`
  Forum  `/forum`
  Gratitude  `/gratitude`
  Gatherings ▸
    Events  `/events`
    Live Sessions  `/sessions`
    Seasonal Festivals  `/seasonal-festivals`
  Welcoming ▸
    Rites  `/rites`
    Introductions  `/introductions`
Governance
  Now  `/governance`
  Decisions  `/governance/decisions`
  Treasury  `/governance/treasury`
  This season ▸
    Season Plans  `/season-plans`
    Join the Season  `/season-places`
    Funding Rounds  `/funding-rounds`
    Aligned  `/aligned`
  More in Governance ▸
    Your work  `/governance/work`
    How we work together  `/governance/how`
    Make a Proposal  `/propose`
    Change Requests  `/changes`
    What We Look After  `/powers`
Join
  Choose your path ▸
    Investor  `/investor`
    Village Steward  `/steward`
    Resident  `/resident`
    Prosperity Creator  `/prosperity`
  Open Roles  `/roles`
  Come and see ▸
    Plan a Visit  `/visit`
    Sign the Love Letter  `/love-letter`
  Build with us ▸
    Become a partner  `/partner`
    Propose a quest  `/propose-quest`
    Business Opportunities  `/opportunities`
    Work With Us  `/work-with-us`
  Fund the village ▸
    Contribute  `/contribute`
    Crowd pooling  `/campaigns`
About
  Our story ▸
    How We Create  `/how-we-create`
    Master Plan  `/master-plan`
    Our Team  `/team`
    Village Network  `/network`
  How we work ▸
    Game Mechanics  `/game-mechanics`
    Village Email  `/village-email`
    Good Neighbor  `/good-neighbor`
  Guides ▸
    Co-Creators Guide  `/co-creators-guide`
    Training  `/training`
    Resident Rights  `/resident-rights`
    Steward Rights  `/steward-rights`
    Leaving Well  `/exit-policy`
  Share Feedback  `/feedback`
  Module Library  `/modules`
Account menu (your name)
  My Profile  `/profile`
  Messages  `/messages`
  My tasks  `/profile#my-tasks`
  Your things ▸
    Journal  `/journal`
    Protocols  `/protocols`
    Badges  `/badges`
    Settings  `/profile/settings`
  🌳 Launch Plan  `/journey-to-launch`
```

### Role holder with a treasury power

```
Village
  Living Map  `/map`
  Quests  `/quests`
  Circles & Roles  `/map/circles`
  Places and homes ▸
    Places  `/places`
    Photographs  `/photographs`
    Hidden map  `/hidden-map`
    Housing  `/housing`
    Stay  `/stay`
  Shared things ▸
    Library  `/library`
    Tools  `/tools`
    Wallet  `/wallet`
    Health  `/village-health`
Community
  Feed  `/feed`
  Forum  `/forum`
  Gratitude  `/gratitude`
  Gatherings ▸
    Events  `/events`
    Live Sessions  `/sessions`
    Seasonal Festivals  `/seasonal-festivals`
  Welcoming ▸
    Rites  `/rites`
    Introductions  `/introductions`
Governance
  Now  `/governance`
  Decisions  `/governance/decisions`
  Treasury  `/governance/treasury`
  This season ▸
    Season Plans  `/season-plans`
    Join the Season  `/season-places`
    Funding Rounds  `/funding-rounds`
    Aligned  `/aligned`
  More in Governance ▸
    Your work  `/governance/work`
    How we work together  `/governance/how`
    Make a Proposal  `/propose`
    Change Requests  `/changes`
    What We Look After  `/powers`
Join
  Choose your path ▸
    Investor  `/investor`
    Village Steward  `/steward`
    Resident  `/resident`
    Prosperity Creator  `/prosperity`
  Open Roles  `/roles`
  Come and see ▸
    Plan a Visit  `/visit`
    Sign the Love Letter  `/love-letter`
  Build with us ▸
    Become a partner  `/partner`
    Propose a quest  `/propose-quest`
    Business Opportunities  `/opportunities`
    Work With Us  `/work-with-us`
  Fund the village ▸
    Contribute  `/contribute`
    Crowd pooling  `/campaigns`
About
  Our story ▸
    How We Create  `/how-we-create`
    Master Plan  `/master-plan`
    Our Team  `/team`
    Village Network  `/network`
  How we work ▸
    Game Mechanics  `/game-mechanics`
    Village Email  `/village-email`
    Good Neighbor  `/good-neighbor`
  Guides ▸
    Co-Creators Guide  `/co-creators-guide`
    Training  `/training`
    Resident Rights  `/resident-rights`
    Steward Rights  `/steward-rights`
    Leaving Well  `/exit-policy`
  Share Feedback  `/feedback`
  Module Library  `/modules`
Account menu (your name)
  My Profile  `/profile`
  Messages  `/messages`
  My tasks  `/profile#my-tasks`
  Your things ▸
    Journal  `/journal`
    Protocols  `/protocols`
    Badges  `/badges`
    Settings  `/profile/settings`
  Running the village ▸
    🌳 Launch Plan  `/journey-to-launch`
    Treasury  `/treasury`
```

### Admin or founder

```
Village
  Living Map  `/map`
  Quests  `/quests`
  Circles & Roles  `/map/circles`
  Places and homes ▸
    Places  `/places`
    Photographs  `/photographs`
    Hidden map  `/hidden-map`
    Housing  `/housing`
    Stay  `/stay`
  Shared things ▸
    Library  `/library`
    Tools  `/tools`
    Wallet  `/wallet`
    Health  `/village-health`
Community
  Feed  `/feed`
  Forum  `/forum`
  Gratitude  `/gratitude`
  Gatherings ▸
    Events  `/events`
    Live Sessions  `/sessions`
    Seasonal Festivals  `/seasonal-festivals`
  Welcoming ▸
    Rites  `/rites`
    Introductions  `/introductions`
Governance
  Now  `/governance`
  Decisions  `/governance/decisions`
  Treasury  `/governance/treasury`
  This season ▸
    Season Plans  `/season-plans`
    Join the Season  `/season-places`
    Funding Rounds  `/funding-rounds`
    Aligned  `/aligned`
  More in Governance ▸
    Your work  `/governance/work`
    How we work together  `/governance/how`
    Make a Proposal  `/propose`
    Change Requests  `/changes`
    What We Look After  `/powers`
Join
  Choose your path ▸
    Investor  `/investor`
    Village Steward  `/steward`
    Resident  `/resident`
    Prosperity Creator  `/prosperity`
  Open Roles  `/roles`
  Come and see ▸
    Plan a Visit  `/visit`
    Sign the Love Letter  `/love-letter`
  Build with us ▸
    Become a partner  `/partner`
    Propose a quest  `/propose-quest`
    Business Opportunities  `/opportunities`
    Work With Us  `/work-with-us`
  Fund the village ▸
    Contribute  `/contribute`
    Crowd pooling  `/campaigns`
About
  Our story ▸
    How We Create  `/how-we-create`
    Master Plan  `/master-plan`
    Our Team  `/team`
    Village Network  `/network`
  How we work ▸
    Game Mechanics  `/game-mechanics`
    Village Email  `/village-email`
    Good Neighbor  `/good-neighbor`
  Guides ▸
    Co-Creators Guide  `/co-creators-guide`
    Training  `/training`
    Resident Rights  `/resident-rights`
    Steward Rights  `/steward-rights`
    Leaving Well  `/exit-policy`
  Share Feedback  `/feedback`
  Module Library  `/modules`
Account menu (your name)
  My Profile  `/profile`
  Messages  `/messages`
  My tasks  `/profile#my-tasks`
  Your things ▸
    Journal  `/journal`
    Protocols  `/protocols`
    Badges  `/badges`
    Settings  `/profile/settings`
  Running the village ▸
    🌳 Launch Plan  `/journey-to-launch`
    Treasury  `/treasury`
    🛠 Command Centre  `/project-history`
    Review  `/admin/review`
    Village Settings  `/admin`
```

## Every page

Every route in `client/src/App.tsx`, 150 of them, plus the Treasury tab #1843 adds. "Menu on main" is where `nav.ts` had it before this change, and "Menu now" is where it is after. A page with no menu entry is reached from the page in the last column. Decisions: **STAY**; **FOLD?** a candidate to fold into another page (listed below, not done here); **FOLDED** or **FOLDING** done or under way in another lane; **REMOVED**.

| Route | Page | Who | Menu on main | Menu now | Decision | Note |
|---|---|---|---|---|---|---|
| `/` |  | V N M R I A | - | - | STAY | Home: the logo and the phone's Home tab |
| `/journey-to-launch` | Journey to launch | M R A | Governance / 🌳 Launch Plan | Account menu / Running the village / 🌳 Launch Plan | STAY | the village test run |
| `/setup-game` | The Setup Game | A | - | - | STAY | the Setup Game (Rye, 2026-10-31), reached from Village Settings |
| `/canvas/workbook` | Canvas workbook | A | - | - | STAY | reached from the Governance canvas |
| `/project-history` | Command Centre | A | Governance / 🛠 Command Centre | Account menu / Running the village / 🛠 Command Centre | STAY | the first village's build history |
| `/claim` | Claim this village | A | - | - | STAY | a new village's first step, reached by link |
| `/feedback` | Feedback | V N M R I A | Community / Share Feedback | About / Share Feedback | FOLD? | could become a row in the guide's corner panel (Scarlet) |
| `/network` | Village network | V N M R I A | About / Village Network | About / Our story / Village Network | STAY |  |
| `/contribute` | Contribute | V N M R I A | Join / Contribute | Join / Fund the village / Contribute | STAY |  |
| `/seasonal-festivals` | Seasonal festivals | V N M R I A | Community / Seasonal Festivals | Community / Gatherings / Seasonal Festivals | STAY |  |
| `/investor` | Investor journey | V N M R I A | Join / Investor | Join / Choose your path / Investor | STAY | gated to accepted investors by #1837 |
| `/steward` | Steward journey | V N M R I A | Join / Village Steward | Join / Choose your path / Village Steward | STAY |  |
| `/resident` | Resident journey | V N M R I A | Join / Resident | Join / Choose your path / Resident | STAY |  |
| `/prosperity` | Prosperity journey | V N M R I A | Join / Prosperity Creator | Join / Choose your path / Prosperity Creator | STAY |  |
| `/love-letter` | {commitment} | V N M R I A | Join / Sign the Love Letter | Join / Come and see / Sign the Love Letter | STAY |  |
| `/circles` | Circles | V N M R I A | Village / Circles | Village / Circles | STAY | folds into Circles & Roles where the map runs (unlessModule) |
| `/circles/:id` |  | V N M R I A | - | - | STAY | reached from Circles & Roles |
| `/quests` | Quests | V N M R I A | Village / Quests | Village / Quests | STAY | also a phone tab |
| `/quests/:id` |  | V N M R I A | - | - | STAY | reached from Quests, the treasury and the profile |
| `/tools` | Tools | M R A | Village / Tools | Village / Shared things / Tools | STAY |  |
| `/modules` | Module Library | V N M R I A | the bar / Module Library; About / Module Library | About / Module Library | STAY | last of all, under About |
| `/modules/:id` |  | V N M R I A | - | - | STAY | reached from the Module Library |
| `/campaigns` | Crowd pooling | V N M R I A | Join / Crowd pooling | Join / Fund the village / Crowd pooling | STAY |  |
| `/campaign/:slug` |  | V N M R I A | - | - | STAY | reached from Crowd pooling |
| `/map` | Village map | V N M R I A | the bar / Living Map | Village / Living Map | STAY | Village's first row |
| `/places` | Places, photographed | M R A | Village / Places | Village / Places and homes / Places | FOLD? | Places and Photographs are two photo listings; one page with two views |
| `/places/:key` |  | M R A | - | - | STAY | reached from Places and the map |
| `/photographs` | Every photograph | M R A | Village / Photographs | Village / Places and homes / Photographs | FOLD? | see Places |
| `/map/circles` | Circles and roles | V N M R I A | Village / Circles & Roles | Village / Circles & Roles | STAY |  |
| `/events` | Village Calendar | V N M R I A | Community / Events | Community / Gatherings / Events | STAY |  |
| `/first-walk` | redirects to `/` | - | Guides / Your First Walk | - | REMOVED | the lead, 27 Nov 2026: "Let's get rid of this"; redirects home |
| `/feed` | Village feed | V N M R I A | Community / Feed | Community / Feed | STAY |  |
| `/stay` | Stays | V N M R I A | Village / Stay | Village / Places and homes / Stay | STAY |  |
| `/tokens` | redirects to `/wallet` | - | - | - | STAY | old address, redirects to Wallet |
| `/wallet` | Wallet | M R A | Village / Wallet; Account menu / Wallet | Village / Shared things / Wallet | STAY | one menu door now (it was in Village and the account menu) |
| `/pay` | Pay and receive | M R A | - | - | STAY | a phone tile once credits are in use, and the treasury's Send; no menu entry, because its gate is the credits read |
| `/badges` | Badges & skills | M R A | Account menu / Badges | Account menu / Your things / Badges | STAY |  |
| `/powers` | What this village looks after | V N M R I A | Governance / What We Look After | Governance / More in Governance / What We Look After | STAY |  |
| `/pricing` | Pricing desk | R A | - | - | FOLD? | the pricing desk: could be a section of the Treasury |
| `/budget` | Cash budget | - | Account menu / Cash Budget | - | FOLDED | into Governance's Treasury tab by #1843; redirects there |
| `/review/structure/:batchId` |  | A | - | - | STAY | reached from Review |
| `/approvals` | Approvals | R A | - | - | FOLD? | the one-tap approval inbox, built for a phone and shared with Admin: could be a view of Your work, the other queue that waits on the reader |
| `/governance/work` |  | M R A | Governance / Your work | Governance / More in Governance / Your work | STAY | a Governance view |
| `/review` | redirects to `/governance/work` | - | - | - | STAY | old address, redirects to Your work |
| `/cash-payouts` | Cash to pay out | R A | - | - | FOLD? | the cash pay queue: a section of the Treasury desk |
| `/treasury` | Treasury | R A | Account menu / Treasury | Account menu / Running the village / Treasury | FOLD? | the treasurer's desk (mint and pay queues). With the Treasury tab at /governance/treasury there are two treasuries: one page with the desk shown to power holders |
| `/library` | Material library | M R A | Village / Library | Village / Shared things / Library | STAY | and the footer, beside the tools (its other way in was Your First Walk) |
| `/village-health` | Village health | M R A | Village / Health | Village / Shared things / Health | STAY |  |
| `/exit-policy` | Leaving well | V N M R I A | Guides / Leaving Well | About / Guides / Leaving Well | FOLD? | one Rights and agreements page with Resident Rights, Steward Rights, Good Neighbor and Leaving Well as sections |
| `/forum` | Forum | M R A | Community / Forum | Community / Forum | STAY |  |
| `/forum/:id` |  | M R A | - | - | STAY | reached from the Forum |
| `/messages` | Messages | M R A | Community / Messages; Account menu / Messages | Account menu / Messages | STAY | one menu door now, with its count (it was in Community and the account menu) |
| `/messages/:id` |  | M R A | - | - | STAY | reached from Messages |
| `/introductions` | Introductions | M R A | Community / Introductions | Community / Welcoming / Introductions | STAY |  |
| `/propose-quest` | Propose a quest | V N M R I A | - | Join / Build with us / Propose a quest | STAY | new menu door (27 Nov 2026); also the four ways to build |
| `/partner` | Become a partner | V N M R I A | - | Join / Build with us / Become a partner | STAY | new menu door (27 Nov 2026); also the four ways to build |
| `/roles/select` | Find your roles | V N M R | - | - | STAY | reached from Open Roles (Apply) |
| `/roles/draft` | redirects to `/roles/select` | - | - | - | STAY | old address, redirects |
| `/roles` | Roles | V N M R I A | Village / Roles | Join / Open Roles | STAY | Open Roles under Join, and a phone tab |
| `/roles/:slug` |  | V N M R I A | - | - | STAY | reached from Open Roles |
| `/join` | redirects to `/roles` | - | - | - | STAY | old address, redirects to Open Roles |
| `/apply` | redirects to `/roles` | - | - | - | STAY | old address, redirects to Open Roles |
| `/how-we-create` | How we create | V N M R I A | About / How We Create | About / Our story / How We Create | STAY |  |
| `/co-creators-guide` | Co-creators guide | V N M R I A | Guides / Co-Creators Guide | About / Guides / Co-Creators Guide | STAY |  |
| `/housing` | Housing | V N M R I A | Village / Housing | Village / Places and homes / Housing | STAY |  |
| `/reserve` | Reserve your home | M R | - | - | STAY | reached from Housing |
| `/opportunities` | Opportunities | V N M R I A | Join / Business Opportunities | Join / Build with us / Business Opportunities | STAY |  |
| `/master-plan` | Master plan | V N M R I A | About / Master Plan | About / Our story / Master Plan | STAY |  |
| `/team` | Team | V N M R I A | About / Our Team | About / Our story / Our Team | STAY |  |
| `/admin` | Village settings | A | Account menu / Village Settings | Account menu / Running the village / Village Settings | STAY |  |
| `/admin/mint` |  | R A | - | - | STAY | reached from the Treasury desk |
| `/admin/proposals` |  | A | - | - | FOLDING | the Governance lane folds it into /admin/review |
| `/admin/review` |  | A | - | Account menu / Running the village / Review | STAY | new menu door (27 Nov 2026): the admin's one review page |
| `/profile` | My profile | N M R I A | Account menu / My Profile | Account menu / My Profile | STAY |  |
| `/profile/characters` |  | M R A | - | - | STAY | reached from the profile |
| `/profile/gene-keys` |  | M R A | - | - | STAY | reached from the profile |
| `/profile/settings` |  | N M R I A | - | Account menu / Your things / Settings | STAY | new menu door (27 Nov 2026) |
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
| `/game-mechanics` | Game Mechanics | V N M R I A | Guides / Game Mechanics | About / How we work / Game Mechanics | FOLD? | overlaps How we work together: one page for how the village and its game work |
| `/changes` | Change requests | M R A | Governance / Change Requests | Governance / More in Governance / Change Requests | FOLD? | a change request is several changes sent to one vote: could be a kind of decision under Decisions |
| `/changes/:id` |  | M R A | - | - | STAY | reached from Change Requests |
| `/village-email` | How the village emails | V N M R I A | Guides / Village Email | About / How we work / Village Email | STAY | moved out of Guides (the lead: "the village emails can be nested somewhere else") |
| `/good-neighbor` | Good neighbor | V N M R I A | Guides / Good Neighbor | About / How we work / Good Neighbor | FOLD? | see Leaving Well |
| `/steward-rights` | Steward rights | V N M R I A | Guides / Steward Rights | About / Guides / Steward Rights | FOLD? | see Leaving Well |
| `/resident-rights` | Resident rights | V N M R I A | Guides / Resident Rights | About / Guides / Resident Rights | FOLD? | see Leaving Well |
| `/training/steward` | Steward training | M R | - | - | STAY | reached from Training |
| `/training/resident` | Resident training | M R | - | - | STAY | reached from Training |
| `/training` | Training | V N M R I A | Guides / Training | About / Guides / Training | STAY |  |
| `/governance` | Governance | V N M R I A | - | Governance; Governance / Now | STAY | Governance's hub and its group page |
| `/governance/how` |  | V N M R I A | About / How we work together | Governance / More in Governance / How we work together | STAY | moved from About to Governance, beside the other views |
| `/governance/decisions` |  | M R A | Governance / Decisions | Governance / Decisions | STAY |  |
| `/governance/decisions/drafts/:draftId` |  | M R A | - | - | STAY | a draft's page (#1806), reached from Decisions and Review |
| `/governance/decisions/:id` |  | M R A | - | - | STAY | reached from Decisions |
| `/decisions` | redirects to `/governance/decisions` | - | - | - | STAY | old address, redirects |
| `/decisions/:id` | redirects to `/governance/decisions/` | - | - | - | STAY | old address, redirects |
| `/propose` | Start a proposal | M R A | Governance / Make a Proposal | Governance / More in Governance / Make a Proposal | STAY |  |
| `/role-applications/:id` |  | N M A | - | - | STAY | an application's page |
| `/open-proposals/:id` |  | V N M A | - | - | STAY | a proposal's page |
| `/role-measures` | How roles are going | M R A | - | - | FOLD? | how roles are going: could be a view of Circles & Roles |
| `/application-status/:ref` |  | V N | - | - | STAY | an applicant's own status link |
| `/path` | Your path | V N M R I A | - | - | STAY | the phone tab Your path |
| `/seat-applications/:id` |  | - | - | - | STAY | old address |
| `/role-proposals/new` |  | M R A | - | - | STAY | reached from Open Roles and Make a Proposal |
| `/role-proposals/shared/:token` |  | V N M | - | - | STAY | a shared draft link |
| `/role-proposals/:id` |  | M R A | - | - | STAY | reached from Your work |
| `/season-plans/mine` | Your season | M R | - | - | STAY | reached from Season Plans and the profile |
| `/season-plans` | The village's season | M R A | Governance / Season Plans | Governance / This season / Season Plans | FOLD? | Season Plans, Join the Season and Aligned are three views of one season: one page with tabs |
| `/season-places/circles` | The season's circles | M R A | - | - | STAY | reached from Join the Season |
| `/season-places` | Join the season | M R A | Governance / Join the Season | Governance / This season / Join the Season | FOLD? | see Season Plans |
| `/role-path/:roleId` |  | M R | - | - | STAY | a role's path, reached from the role |
| `/aligned` | Aligned | M R A | Governance / Aligned | Governance / This season / Aligned | FOLD? | see Season Plans |
| `/visit` | Visit | V N M R I A | Join / Plan a Visit | Join / Come and see / Plan a Visit | STAY |  |
| `/gratitude` | Gratitude | V N M R I A | Community / Gratitude | Community / Gratitude | STAY |  |
| `/journal` | Journal | M R A | Account menu / Journal | Account menu / Your things / Journal | STAY |  |
| `/protocols/practice/:protocolId` |  | M R A | - | - | STAY | reached from Protocols |
| `/protocols/run/:id` |  | M R A | - | - | STAY | reached from Protocols |
| `/protocols` | Protocols | M R A | Account menu / Protocols | Account menu / Your things / Protocols | STAY |  |
| `/hidden-map` | Hidden map | M R A | Village / Hidden map | Village / Places and homes / Hidden map | STAY |  |
| `/funding-rounds` | Funding rounds | M R A | Governance / Funding Rounds | Governance / This season / Funding Rounds | STAY |  |
| `/funding-rounds/:id` |  | M R A | - | - | STAY | reached from Funding Rounds |
| `/sessions` | Live sessions | M R A | Community / Live Sessions | Community / Gatherings / Live Sessions | STAY |  |
| `/sessions/season` |  | M R A | - | - | STAY | reached from Live Sessions |
| `/sessions/:id` |  | M R A | - | - | STAY | reached from Live Sessions |
| `/work-with-us` | Work with us | V N M R I A | Join / Work With Us | Join / Build with us / Work With Us | STAY |  |
| `/reset` | A fresh start | V N M | - | - | STAY | a fresh start for a phone stuck on an old version, handed over as a link |
| `/404` | Page not found | V N M R I A | - | - | STAY | the not-found page |
| `/governance/treasury` | Governance's Treasury tab (#1843) | M R A | - | Governance / Treasury | STAY | the Cash Budget folded in; lands with #1843 |

## What changed, in short

- **Gone:** Your First Walk (`/first-walk` redirects home). The bar's separate Living Map and Module Library entries.
- **Moved:** Village Email out of Guides, into About > How we work. How we work together from About into Governance. The Launch Plan and the Command Centre from Governance into the account menu, under Running the village. The Cash Budget from the account menu into Governance as the Treasury tab (#1843). Share Feedback from Community into About. Open Roles from Village into Join, on every village.
- **One door each:** Messages (account menu, with its count) and Wallet (Village > Shared things).
- **New doors:** Become a partner, Propose a quest, Settings, and the admin's Review page, which had no menu entry.
- **Gated as before:** no gate was added. A newcomer still meets none of a member's working areas.

## Folds to consider next (not done here)

Each is a page whose work could live inside another. None is small and safe enough to do inside a menu change.

1. **The two treasuries.** `/treasury` (the treasurer's desk: mint and pay queues), `/cash-payouts` and `/pricing` could be sections of Governance's Treasury tab, shown to whoever holds the power. One Treasury, not two.
2. **The season.** Season Plans, Join the Season and Aligned are three views of one season: one page with tabs.
3. **Rights and agreements.** Resident Rights, Steward Rights, Good Neighbor and Leaving Well could be one page with four sections. They are binding texts, so the lead and counsel decide.
4. **How it works.** Game Mechanics and How we work together overlap: one page for how the village and its game work.
5. **Places and Photographs:** two photo listings, one page with two views.
6. **The queues that wait on you.** `/approvals` (the one-tap approval inbox) could be a view of Your work.
7. **Change Requests** could be a kind of decision under Decisions.
8. **How roles are going** (`/role-measures`) could be a view of Circles & Roles.
9. **The village at a glance** (`/fleet`) overlaps the map and Governance's Now.
10. **Share Feedback** could be a row in the guide's corner panel.
11. **Pay** (`/pay`) has no menu entry, because its gate is the credits read (`shared/payGate.ts`): it is a phone tile and the treasury's Send. A `credits` gate in `nav.ts` would give it one.

## Not done here

- A village can rename a group and hide an entry in Admin (`shared/menuDoc.ts`), but it cannot rename a folder yet; folder names are the platform's words, translated (`client/src/config/navWords.ts`).
- The breadcrumb names the group and the page, not the folder between them.
