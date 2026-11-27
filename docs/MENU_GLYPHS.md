# Menu glyphs

One glyph per menu entry and group (the lead, 27 Nov 2026). The drawings live in
`client/src/components/sacred/menuGlyphs.tsx` (new) and `living.tsx` / `livingCore.tsx` (already shipped),
all exported from `living.tsx`. The design page with every glyph at real size, in dark and light:
https://claude.ai/artifact/1XZVf5VkY1gCNNPVWxxv1A

When a nav entry gains its `icon`, take the first choice. The alternative is the fallback if the lead prefers it.

| Group | Entry | Route | First choice | Alternative | Note |
|---|---|---|---|---|---|
| Groups | Join | `group` | OpenGate (new) | Sprout (living) | First for visitors and newcomers |
| Groups | Village | `group` | SeedOfLife (living) | EarthshipDome (living) |  |
| Groups | Community | `group` | MushroomNetwork (living) | Gathering (living) |  |
| Groups | Governance | `group` | CouncilCircle (living) | Triad (living) | Its Now view, decisions and treasury live under it |
| Groups | Guides | `group` | Lantern (new) | LeafBook (new) |  |
| Groups | About | `group` | Taproot (living) | Labyrinth (living) |  |
| Top level | Living Map | `/map` | MapLeaf (new) | SeedPin (living) |  |
| Top level | Module Library | `/modules` | SeedJars (new) | WovenBasket (living) | Last in the menu |
| Join | Investor | `/investor` | SeedHand (living) | Pines (living) | Kept: already the path's glyph |
| Join | Village Steward | `/steward` | TreeCrown (living) | Canopy (living) | Kept: already the path's glyph |
| Join | Resident | `/resident` | SeedPodHome (living) | EarthshipDome (living) | Kept: already the path's glyph |
| Join | Prosperity Creator | `/prosperity` | SunLeaf (living) | WovenBasket (living) | Kept: already the path's glyph |
| Join | Business Opportunities | `/opportunities` | WovenBasket (living) | SunLeaf (living) |  |
| Join | Plan a Visit | `/visit` | Footprints (new) | SteppingStones (living) |  |
| Join | Sign the Love Letter | `/love-letter` | SealedLetter (new) | HeartLeaf (living) |  |
| Join | Work With Us | `/work-with-us` | OfferingHands (living) | TendingHands (living) |  |
| Join | Contribute | `/contribute` | SeedGlint (living) | OfferingHands (living) |  |
| Join | Crowd pooling | `/campaigns` | PoolDrops (new) | Gourd (living) |  |
| Village | Quests | `/quests` | LeafCompass (living) | SteppingStones (living) | Kept: the tab bar's glyph |
| Village | Circles | `/circles` | CellRing (living) | SeedOfLife (living) |  |
| Village | Roles | `/roles` | Cell (living) | CellRing (living) | Kept: the tab bar's glyph |
| Village | Places | `/places` | SeedPin (living) | MapLeaf (new) |  |
| Village | Photographs | `/photographs` | LeafLens (new) | SeedEye (living) |  |
| Village | Hidden map | `/hidden-map` | TreasureMap (new) | MapLeaf (new) |  |
| Village | Stay | `/stay` | Hammock (new) | SeedPodHome (living) |  |
| Village | Housing | `/housing` | EarthshipDome (living) | SeedPodHome (living) | The Home tab's dome |
| Village | Library | `/library` | LeafBook (new) | SeedJars (new) |  |
| Village | Tools | `/tools` | Trowel (new) | TendingHands (living) |  |
| Village | Wallet | `/wallet` | SeedPod (living) | SeedHand (living) |  |
| Village | Health | `/village-health` | HealingLeaf (new) | Gourd (living) |  |
| Community | Feed | `/feed` | Splash (living) | Songbird (living) |  |
| Community | Forum | `/forum` | LeafSpeech (new) | Firefly (living) |  |
| Community | Messages | `/messages` | LeafLetter (new) | Songbird (living) |  |
| Community | Rites | `/rites` | Lotus (living) | Sunrise (living) |  |
| Community | Introductions | `/introductions` | PairedBirds (new) | OfferingHands (living) |  |
| Community | Events | `/events` | Gathering (living) | Sunrise (living) |  |
| Community | Live Sessions | `/sessions` | HandDrum (new) | Firefly (living) |  |
| Community | Gratitude | `/gratitude` | HeartLeaf (living) | Bloom (living) |  |
| Community | Seasonal Festivals | `/seasonal-festivals` | Sunrise (living) | MoonArc (new) |  |
| Community | Share Feedback | `/feedback` | Songbird (living) | Feather (living) |  |
| Governance | Decisions | `/governance/decisions` | SettledStone (new) | CouncilCircle (living) |  |
| Governance | Treasury | `/governance (treasury)` | Gourd (living) | SeedPod (living) | Where the Cash Budget folds in |
| Governance | Funding Rounds | `/funding-rounds` | Pines (living) | SeedHand (living) |  |
| Governance | Season Plans | `/season-plans` | MoonArc (new) | GrowthRings (living) |  |
| Governance | Join the Season | `/season-places` | Sprout (living) | Vesica (living) |  |
| Governance | Aligned | `/aligned` | Triad (living) | GoldenSpiral (living) |  |
| Governance | Make a Proposal | `/propose` | Seed (living) | Feather (living) |  |
| Governance | Change Requests | `/changes` | Graft (new) | Feather (living) |  |
| Governance | Your work | `/governance/work` | TendingHands (living) | SproutRow (new) |  |
| Governance | What We Look After | `/powers` | Nest (new) | Held (living) |  |
| Governance | Launch Plan | `/journey-to-launch` | GrowthRings (living) | Pines (living) | Replaces the tree emoji |
| Governance | Command Centre | `/project-history` | Firefly (living) | SeedEye (living) | Replaces the tool emoji |
| Guides | Co-Creators Guide | `/co-creators-guide` | SeedEye (living) | Splash (living) |  |
| Guides | Game Mechanics | `/game-mechanics` | Labyrinth (living) | GoldenSpiral (living) |  |
| Guides | Village Email | `/village-email` | WingedLetter (new) | LeafLetter (new) | Moving out of Guides |
| Guides | Good Neighbor | `/good-neighbor` | Canopy (living) | HeartLeaf (living) |  |
| Guides | Training | `/training` | Sapling (new) | Sprout (living) |  |
| Guides | Resident Rights | `/resident-rights` | SeedPodHome (living) | Held (living) |  |
| Guides | Steward Rights | `/steward-rights` | Held (living) | TreeCrown (living) |  |
| Guides | Leaving Well | `/exit-policy` | FallingLeaf (new) | Sunrise (living) |  |
| About | How We Create | `/how-we-create` | GoldenSpiral (living) | Sprout (living) |  |
| About | How we work together | `/governance/how` | Vesica (living) | Triad (living) |  |
| About | Master Plan | `/master-plan` | Terraces (new) | MapLeaf (new) |  |
| About | Our Team | `/team` | Flock (new) | MushroomNetwork (living) |  |
| About | Village Network | `/network` | Constellation (new) | MushroomNetwork (living) |  |
| Your account | My Profile | `/profile` | SeedPerson (new) | Bloom (living) |  |
| Your account | Journal | `/journal` | Feather (living) | LeafBook (new) |  |
| Your account | Protocols | `/protocols` | KnotCord (new) | Labyrinth (living) |  |
| Your account | Tasks | `/tasks` | SproutRow (new) | TendingHands (living) |  |
| Your account | Badges | `/badges` | Bloom (living) | SeedGlint (living) |  |
| Your account | Village Settings | `/admin` | Settings2 (lucide) | SeedOfLife (living) | A plain gear: Admin is plumbing |
