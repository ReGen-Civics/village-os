import { Toaster } from "@/components/ui/sonner";
import BreakGlass from "@/components/BreakGlass";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import QuietLoading from "@/components/natural/QuietLoading";
import Layout from "@/components/Layout";
import { useLingui } from "@lingui/react/macro";
import { Redirect, Route, Switch, useLocation } from "wouter";
import { LazyMotion, MotionConfig } from "framer-motion";
import { LucideProvider } from "lucide-react";
import { LIVING_STROKE } from "@/components/sacred/livingCore";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import ScrollToTop from "./components/ScrollToTop";
import EntranceGate from "./components/EntranceGate";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { ModuleProvider } from "./modules/ModuleProvider";
import { chooseLanding, getPreference, recordVisit, wasMapAvailable } from "./lib/landing";
import { brochurePage, storyPageShown, useBrochurePages } from "./lib/brochure";
import { useConfigFailed, useGameConfig } from "./lib/gameApi";
import ConfigUnavailable from "./components/ConfigUnavailable";
import { LocaleRoot } from "@/i18n/LocaleRoot";

/**
 * "/" means the welcome page, for everyone, every time. The map was going to
 * take over on the third visit and that promotion is TURNED OFF
 * (AUTO_LANDING_ENABLED in client/src/lib/landing.ts, which has the rules),
 * and no surface writes a landing preference while it is off, so nothing
 * reaches the redirect below today. The machinery stays because the map
 * becoming home is still where this is going.
 *
 * When it comes back: the redirect happens here, synchronously, before Home
 * renders — deciding after the module catalogue loads would flash the welcome
 * page and then yank it away. The price of deciding early is that map
 * availability is one visit stale (cached by the map page itself); the safe
 * direction is built in, because a stale "not available" just means the
 * welcome page.
 *
 * `useState` initialiser, not `useEffect`: the visit must be counted exactly
 * once per page load, before first paint, and effects run twice in dev
 * StrictMode.
 */
function useLanding(): "home" | "map" {
  const [landing] = useState(() => {
    const visits = recordVisit();
    return chooseLanding({ visits, preference: getPreference(), mapAvailable: wasMapAvailable() });
  });
  return landing;
}

/**
 * The brochure home belongs to the brochure pages (shared/brochure.ts): a
 * village that serves them gets it, and every other village gets the neutral
 * welcome page. Nothing renders until the switch is known, so neither one
 * flashes on the other's village, and when the config could not be read at
 * all the "try again" card stands in for the blank (resilience P1-1).
 */
function LandingRoute() {
  const landing = useLanding();
  const brochure = useBrochurePages();
  const configFailed = useConfigFailed();
  const [, navigate] = useLocation();
  useEffect(() => {
    if (landing === "map") navigate("/map", { replace: true });
  }, [landing, navigate]);
  if (landing !== "home") return null;
  if (brochure === null) return configFailed ? <ConfigUnavailable /> : null;
  return brochure ? <Home /> : <VillageWelcome />;
}


/**
 * The old spelling of /role-applications/:id (Rye, 2026-10-21: members say role,
 * never seat). Emails and notices already sent carry it, so it stays mounted and
 * moves the visitor to the new address, keeping the query and the hash.
 */
function SeatApplicationsAlias() {
  const [location, setLocation] = useLocation();
  useEffect(() => {
    const to = location.replace(/^\/seat-applications\//, "/role-applications/");
    setLocation(to + window.location.search + window.location.hash, { replace: true });
  }, [location, setLocation]);
  return null;
}

function PageTitle() {
  const [location] = useLocation();
  // The one cached config every page reads, so a save in Admin that calls
  // refreshGameConfig() renames the tab too, with no reload (audit item 24).
  const config = useGameConfig();
  const village = config?.project?.name ?? "";
  const commitment = config?.project?.commitmentName ?? "";
  const favicon = String(config?.images?.favicon ?? "").trim();
  // Each story page's own switch rides the same config (Admin, Pages).
  const switches = useMemo(() => (config ? { brochurePages: config.brochurePages, brochureHidden: config.brochureHidden, brochureOpen: config.brochureOpen } : null), [config]);

  // The tab ICON is identity too. index.html ships a neutral platform favicon
  // (a static file cannot know which village it serves); this swaps in the
  // village's own the moment config arrives, same pattern as the title below.
  useEffect(() => {
    if (!favicon) return;
    // The tab icon only: the home-screen icon is /api/brand/touch-icon.png, a PNG the server draws from
    // this same favicon, because iOS ignores an SVG there (server/lib/touchIcon.ts).
    for (const rel of ["icon"]) {
      let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
      if (!link) {
        link = document.createElement("link");
        link.rel = rel;
        document.head.appendChild(link);
      }
      link.href = favicon;
    }
  }, [favicon]);

  useEffect(() => {
    if (!village) return;
    // A story page this village does not serve answers not found, so its tab
    // names the village alone, the same as its share card (server/lib/pageMeta.ts).
    // The title table is fetched, never in the first page's scripts: the tab
    // already waits on config, the server has written the same title into the
    // HTML (server/lib/pageMeta.ts), and every route's first view is at its
    // budget (scripts/route-first-view.json). A failed fetch keeps that title.
    let live = true;
    import("@shared/pageTitles").then(
      ({ documentTitle }) => {
        if (live) document.title = documentTitle(storyPageShown(switches, location) ? location : "/", village, { commitment });
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [location, village, commitment, switches]);

  return null;
}
/**
 * ROUTE SPLITTING — the rule for anyone adding a page.
 *
 * The main bundle sat at 1382 KB against CI's 1400 KB ceiling: 18 KB of
 * headroom for a platform about to add a design system, an identity intake
 * and an art review queue. The CI gate says the right thing already — "split
 * a route rather than raising the budget" — so every page below the eager set
 * is `lazy()`.
 *
 * EAGER = what an arriving human sees before they choose anything: the home
 * page, the sign-in page a deep link bounces them to, and the 404. Everything
 * else is a chunk fetched on navigation and cached from then on.
 *
 * That trade is strictly good on the ~50 KB/s links this platform is built
 * for: today a visitor downloads all 26,000 lines of every page — including
 * Admin's 6,980 and Project History's 2,870, which most members never open —
 * before anything renders. After this they download the shell plus the one
 * page they asked for.
 *
 * New page? Add it to the lazy list. Only add to the eager set if it renders
 * on first paint for a signed-out visitor.
 */
/*
 * Home is the brochure landing page, and it only renders once the brochure
 * switch has loaded (LandingRoute above), so it never paints before an async
 * step anyway. It is lazy to keep its ~17 KB out of the main chunk, and the
 * fetch starts at boot on "/" so it runs in parallel with that config request.
 */
const loadHome = () => import("./pages/Home");
if (typeof window !== "undefined" && window.location.pathname === "/") void loadHome();
const Home = lazy(loadHome);
import Login from "./pages/Login";

// The animation engine, after the first page: see lib/motionFeatures.ts.
const loadMotionFeatures = () => import("./lib/motionFeatures").then((mod) => mod.default);

const lazyPage = (loader: () => Promise<{ default: React.ComponentType<any> }>) => lazy(loader);
const VillageWelcome = lazyPage(() => import("./pages/VillageWelcome"));

const InvestorJourney = brochurePage(() => import("./pages/InvestorJourney"));
const StewardJourney = brochurePage(() => import("./pages/StewardJourney"));
const ResidentJourney = brochurePage(() => import("./pages/ResidentJourney"));
const ProsperityJourney = brochurePage(() => import("./pages/ProsperityJourney"));
const LoveLetter = brochurePage(() => import("./pages/LoveLetter"));
const Circles = lazyPage(() => import("./pages/Circles"));
const OAuthAuthorize = lazyPage(() => import("./pages/OAuthAuthorize"));
const CircleCardPage = lazyPage(() => import("./pages/CircleCardPage"));
// Places and their photos, one page (the fold, 26 Nov 2026): the shelf, one place, and every photo as a view.
const Places = lazyPage(() => import("./pages/Places"));
const Quests = lazyPage(() => import("./pages/Quests"));
const QuestDetail = lazyPage(() => import("./pages/QuestDetail"));
const ProposeQuest = lazyPage(() => import("./pages/ProposeQuest"));
const Partner = lazyPage(() => import("./pages/Partner"));
const Roles = lazyPage(() => import("./pages/Roles"));
const RoleDraft = lazyPage(() => import("./pages/RoleDraft"));
const RoleShare = lazyPage(() => import("./pages/RoleShare"));
const HowWeCreate = brochurePage(() => import("./pages/HowWeCreate"));
const CoCreatorsGuide = brochurePage(() => import("./pages/CoCreatorsGuide"));
const Housing = brochurePage(() => import("./pages/Housing"));
const ReserveHome = lazyPage(() => import("./pages/ReserveHome"));
const Opportunities = brochurePage(() => import("./pages/Opportunities"));
const MasterPlan = brochurePage(() => import("./pages/MasterPlan"));
const Team = brochurePage(() => import("./pages/Team"));
const Admin = lazyPage(() => import("./pages/Admin"));
const Profile = lazyPage(() => import("./pages/Profile"));
const ProfileSettings = lazyPage(() => import("./pages/ProfileSettings"));
const Characters = lazyPage(() => import("./pages/Characters"));
const GeneKeys = lazyPage(() => import("./pages/GeneKeys"));
// Rites and invitations (module `rites`): the joining flow's screens, drawn in the village's own look.
const RitesWelcome = lazyPage(() => import("./pages/rites/Welcome"));
const RitesComeAboard = lazyPage(() => import("./pages/rites/ComeAboard"));
const RitesArrived = lazyPage(() => import("./pages/rites/Arrived"));
const RitesCeremony = lazyPage(() => import("./pages/rites/Ceremony"));
const RitesCard = lazyPage(() => import("./pages/rites/Card"));
const RitesFleet = lazyPage(() => import("./pages/rites/Fleet"));
const RitesHub = lazyPage(() => import("./pages/rites/RitesHub"));
const RitesDoor = lazyPage(() => import("./pages/rites/Door").then((m) => ({ default: m.Door })));
const RitesPacket = lazyPage(() => import("./pages/rites/Door").then((m) => ({ default: m.Packet })));
const Mint = lazyPage(() => import("./pages/Mint"));
const ProposedChanges = lazyPage(() => import("./pages/ProposedChanges"));
// The deciders' one list, each queue read as the person (docs/REVIEW_INBOX_PLAN.md, lane 4a).
const AdminReview = lazyPage(() => import("./pages/AdminReview"));
const PublicProfile = lazyPage(() => import("./pages/PublicProfile"));
const Register = lazyPage(() => import("./pages/Register"));
const SetPassword = lazyPage(() => import("./pages/SetPassword"));
const VerifyEmail = lazyPage(() => import("./pages/VerifyEmail"));
// Three pages an email links to, from ONE module: the bundler keeps one chunk.
const EmailPreferences = lazyPage(() => import("./pages/EmailPages").then((m) => ({ default: m.EmailPreferences })));
const EmailUnsubscribe = lazyPage(() => import("./pages/EmailPages").then((m) => ({ default: m.EmailUnsubscribe })));
const EmailAction = lazyPage(() => import("./pages/EmailPages").then((m) => ({ default: m.EmailAction })));
const ForgotPassword = lazyPage(() => import("./pages/ForgotPassword"));
const GameMechanics = lazyPage(() => import("./pages/GameMechanics"));
const ChangeRequests = lazyPage(() => import("./pages/ChangeRequests"));
const VillageEmail = lazyPage(() => import("./pages/VillageEmail"));
const GoodNeighbor = brochurePage(() => import("./pages/GoodNeighbor"));
const JourneyToLaunch = lazyPage(() => import("./pages/JourneyToLaunch"));
const SetupGame = lazyPage(() => import("./pages/SetupGame"));
const CanvasWorkbook = lazyPage(() => import("./pages/CanvasWorkbook"));
const ProjectHistory = brochurePage(() => import("./pages/ProjectHistory"));
const Bootstrap = lazyPage(() => import("./pages/Bootstrap"));
const Feedback = lazyPage(() => import("./pages/Feedback"));
const Network = lazyPage(() => import("./pages/Network"));
const Contribute = lazyPage(() => import("./pages/Contribute"));
const SeasonalFestivals = lazyPage(() => import("./pages/SeasonalFestivals"));
const StewardRights = brochurePage(() => import("./pages/StewardRights"));
const ResidentRights = brochurePage(() => import("./pages/ResidentRights"));
const Training = lazyPage(() => import("./pages/Training"));
const Governance = lazyPage(() => import("./pages/Governance"));
const GovernanceNow = lazyPage(() => import("./pages/GovernanceNow"));
const Decisions = lazyPage(() => import("./pages/Decisions"));
const Decision = lazyPage(() => import("./pages/Decision"));
const OrgDraft = lazyPage(() => import("./pages/OrgDraft"));
const Propose = lazyPage(() => import("./pages/Propose"));
const SeatApplication = lazyPage(() => import("./pages/SeatApplication"));
// One chunk for the three role proposal routes (role proposals PR C).
const RoleProposal = lazyPage(() => import("./pages/RoleProposal"));
const NewRoleProposal = lazyPage(() => import("./pages/RoleProposal").then((m) => ({ default: m.NewRoleProposal })));
const SharedRoleProposal = lazyPage(() => import("./pages/RoleProposal").then((m) => ({ default: m.SharedRoleProposal })));
const SeasonPlans = lazyPage(() => import("./pages/SeasonPlans"));
// Season places (module season-places): join the season, the season's circles, a role's path. Lazy: none touch the first page.
const SeasonPlaces = lazyPage(() => import("./pages/SeasonPlaces"));
const SeasonCircles = lazyPage(() => import("./pages/SeasonCircles"));
const RolePath = lazyPage(() => import("./pages/RolePath"));
const Aligned = lazyPage(() => import("./pages/Aligned"));
const MySeason = lazyPage(() => import("./pages/MySeason"));
const Visit = brochurePage(() => import("./pages/Visit"));
const GratitudeWall = lazyPage(() => import("./pages/GratitudeWall"));
const WorkWithUs = brochurePage(() => import("./pages/WorkWithUs"));
const ToolsHub = lazyPage(() => import("./pages/ToolsHub"));
const VillageMap = lazyPage(() => import("./pages/VillageMapForMembers"));
const LivingMap = lazyPage(() => import("./pages/LivingMapForMembers"));
const Events = lazyPage(() => import("./pages/Events"));
const FirstWalk = lazyPage(() => import("./pages/FirstWalk"));
const Forum = lazyPage(() => import("./pages/Forum"));
const Messages = lazyPage(() => import("./pages/Messages"));
const Introductions = lazyPage(() => import("./pages/Introductions"));
const RequestMembership = lazyPage(() => import("./pages/RequestMembership"));
const ProposeARole = lazyPage(() => import("./pages/ProposeARole"));
const ConfirmProposal = lazyPage(() => import("./pages/ProposeARole").then((m) => ({ default: m.ConfirmProposal })));
const OpenProposal = lazyPage(() => import("./pages/OpenProposal"));
const RoleMeasures = lazyPage(() => import("./pages/RoleMeasures"));
const ApplicationStatus = lazyPage(() => import("./pages/ApplicationStatus"));
const YourPath = lazyPage(() => import("./pages/YourPath")); // the whole path, unrolled (the Root)
const Feed = lazyPage(() => import("./pages/Feed"));
const Stay = lazyPage(() => import("./pages/Stay"));
const Wallet = lazyPage(() => import("./pages/Wallet"));
const Pay = lazyPage(() => import("./pages/Pay"));
const Badges = lazyPage(() => import("./pages/Badges"));
const Powers = lazyPage(() => import("./pages/Powers"));
// The Treasurer's pricing desk (quest re-price Q3, 2026-11-09).
const PricingDeskPage = lazyPage(() => import("./pages/PricingDesk"));
// The cash budget every member reads, and the holder of role.pay changes (budgets spec R23).
const BudgetPage = lazyPage(() => import("./pages/Budget"));
const Review = lazyPage(() => import("./pages/Review"));
const Approvals = lazyPage(() => import("./pages/Approvals"));
const CashPayouts = lazyPage(() => import("./pages/CashPayouts"));
const Treasury = lazyPage(() => import("./pages/Treasury"));
const StructureReview = lazyPage(() => import("./pages/StructureReview"));
const Library = lazyPage(() => import("./pages/Library"));
const VillageHealth = lazyPage(() => import("./pages/VillageHealth"));
const ExitPolicy = lazyPage(() => import("./pages/ExitPolicy"));
const Modules = lazyPage(() => import("./pages/Modules"));
const ModuleDetail = lazyPage(() => import("./pages/ModuleDetail"));
const Crowdpool = lazyPage(() => import("./pages/Crowdpool"));
const CrowdpoolCampaign = lazyPage(() => import("./pages/CrowdpoolCampaign"));
const Journal = lazyPage(() => import("./pages/Journal"));
const Protocols = lazyPage(() => import("./pages/Protocols"));
const HiddenMap = lazyPage(() => import("./pages/HiddenMap"));
const FundingRounds = lazyPage(() => import("./pages/FundingRounds"));
const Sessions = lazyPage(() => import("./pages/Sessions"));
const SessionRoom = lazyPage(() => import("./pages/SessionRoom"));
const SessionSeason = lazyPage(() => import("./pages/SessionSeason"));
// A fresh start for one device, by a link we hand to a stuck member (lib/deviceReset.ts).
const Reset = lazyPage(() => import("./pages/Reset"));
const VisitorProfile = lazyPage(() => import("./pages/VisitorProfile"));
const VisitorSignIn = lazyPage(() => import("./pages/VisitorSignIn"));

/**
 * Shown while a page chunk arrives: the breathing leaf and a few words
 * (components/natural/QuietLoading), never a spinning ring. Deliberately
 * quiet: on a slow link this appears for a second or two. `min-h` holds the
 * viewport so the footer does not jump up and back down as the chunk lands.
 *
 * It stands on the night ground (`world`), where nearly every member page
 * now arrives, so a page does not flash light and then go dark as it lands.
 *
 * Two forms, because the first one shows BEFORE the language is known
 * (LocaleRoot's own fallback, where no catalog is loaded and useLingui has no
 * provider): that one says "Loading page" in the source language, as the old
 * ring's hidden label did. Every later wait is inside the provider and speaks
 * the visitor's language.
 */
export function PageLoading() {
  const { t } = useLingui();
  const [location] = useLocation();
  const quiet = <QuietLoading world label={t({ message: "Gathering your page", context: "loading: a page is on its way" })} />;
  // THE SHELL STAYS UP (the five-reviewer QA pass, 25 Nov 2026). Every page draws its own Layout, so this fallback
  // used to stand in for the header and the bar too, and the first tap to a page not yet loaded blanked the whole
  // screen. It draws the same shell now, with the quiet wait in the content area only. Layout ships in the boot set
  // (Login and NotFound import it), so this costs the first page nothing. The few pages that draw no shell of their
  // own wait without one, so a shell does not flash up and vanish.
  if (SHELL_LESS.test(location)) return quiet;
  return <Layout>{quiet}</Layout>;
}

/** The pages that draw without the site's header and bar (Admin, OAuthAuthorize, ChangeRequests, Reset). */
const SHELL_LESS = /^\/(?:admin|oauth\/authorize|changes|reset)(?:\/|$)/;

/**
 * The responsive bottom bar's visit count (client/src/lib/navVisits.ts): after a
 * signed-in member's page settles, its address is counted once per session, and
 * nothing about the member leaves the phone. Loaded on its own, after the paint.
 */
function NavVisits() {
  const [location] = useLocation();
  useEffect(() => {
    // The lazy module reads the session itself: signed out, it sends nothing.
    const id = window.setTimeout(() => void import("@/lib/navVisits").then((m) => m.visitedNow(location)).catch(() => undefined), 1500);
    return () => window.clearTimeout(id);
  }, [location]);
  return null;
}

function Router() {
  const [location] = useLocation();
  return (
    <>
    <ScrollToTop />
      <PageTitle />
      <NavVisits />
    <ErrorBoundary key={location}>
    <Suspense fallback={<PageLoading />}>
    <EntranceGate waiting={<PageLoading />}>
    <Switch>
      <Route path="/" component={LandingRoute} />
      <Route path="/journey-to-launch" component={JourneyToLaunch} />
      <Route path="/setup-game" component={SetupGame} />
      {/* The Governance Canvas on paper. Public and read-only: it shows the
          village's name and nothing else the village holds. */}
      <Route path="/canvas/workbook" component={CanvasWorkbook} />
      <Route path="/project-history" component={ProjectHistory} />
      <Route path="/claim" component={Bootstrap} />
      <Route path="/feedback" component={Feedback} />
      <Route path="/network" component={Network} />
      <Route path="/contribute" component={Contribute} />
      <Route path="/seasonal-festivals" component={SeasonalFestivals} />
      <Route path="/investor" component={InvestorJourney} />
      <Route path="/steward" component={StewardJourney} />
      <Route path="/resident" component={ResidentJourney} />
      <Route path="/prosperity" component={ProsperityJourney} />
      <Route path="/love-letter" component={LoveLetter} />
      <Route path="/circles" component={Circles} />
      {/* One circle's card, its home page (server/routes/circleCard.ts). */}
      <Route path="/circles/:id" component={CircleCardPage} />
      <Route path="/quests" component={Quests} />
      <Route path="/quests/:id" component={QuestDetail} />
      <Route path="/tools" component={ToolsHub} />
      {/* The Module Library: public, read-only, the whole platform on five
          shelves. The Material Library keeps /library; the two never trade
          names. */}
      <Route path="/modules" component={Modules} />
      <Route path="/modules/:id" component={ModuleDetail} />
      {/* The crowdpool bridge: the list of raisings, then one campaign told
          in the map's language. Both behind ModuleGate("crowdpool"). */}
      <Route path="/campaigns" component={Crowdpool} />
      <Route path="/campaign/:slug" component={CrowdpoolCampaign} />
      {/* The geographic map is what /map means now. The nested-circles org
          view keeps its own address: it holds the concierge, the contact
          relay and raise-your-hand, which read live data behind the
          capability gate and have no equivalent in the artifact. */}
      <Route path="/map" component={LivingMap} />
      {/* The photographs of the land, beside the map rather than inside it:
          one page for the shelf of places, one place (its own shareable
          address) and every photo (the #photos view). The list route is
          declared before the detail route for the reason /decisions gives:
          wouter takes the first match. /photographs was its own page until
          the fold (26 Nov 2026) and now opens the All photos view. */}
      <Route path="/places" component={Places} />
      <Route path="/places/:key" component={Places} />
      <Route path="/photographs">{() => <Redirect to="/places#photos" replace />}</Route>
      <Route path="/map/circles" component={VillageMap} />
      <Route path="/events" component={Events} />
      <Route path="/first-walk" component={FirstWalk} />
      <Route path="/feed" component={Feed} />
      <Route path="/stay" component={Stay} />
      {/* The Exchange's old address: one page called Wallet now (the lead, 25 Nov 2026). The query and hash ride along. */}
      <Route path="/tokens">{() => <Redirect to={`/wallet${window.location.search}${window.location.hash}`} replace />}</Route>
      <Route path="/wallet" component={Wallet} />
      <Route path="/pay" component={Pay} />
      <Route path="/badges" component={Badges} />
      <Route path="/powers" component={Powers} />
      <Route path="/pricing" component={PricingDeskPage} />
      <Route path="/budget" component={BudgetPage} />
      <Route path="/review/structure/:batchId" component={StructureReview} />
      <Route path="/approvals" component={Approvals} />
      {/* Governance (the lead, 26 Nov 2026: "Don't call it review, call it governance"). The deciders' queue is Your work
          under /governance; the old address keeps working, with its query and anchor (#witness). */}
      <Route path="/governance/work" component={Review} />
      <Route path="/review">{() => <Redirect to={`/governance/work${window.location.search}${window.location.hash}`} replace />}</Route>
      {/* The treasurer's payout list, for a finance role holding cash.pay without admin */}
      <Route path="/cash-payouts" component={CashPayouts} />
      {/* The hand mint and the pay queues for a holder of token.mint, cash.pay or moon.approve_alone, admin or not */}
      <Route path="/treasury" component={Treasury} />
      <Route path="/library" component={Library} />
      {/* /village-health, not /health: the server owns /health as the ops probe */}
      <Route path="/village-health" component={VillageHealth} />
      <Route path="/exit-policy" component={ExitPolicy} />
      <Route path="/forum" component={Forum} />
      <Route path="/forum/:id" component={Forum} />
      <Route path="/messages" component={Messages} />
      <Route path="/messages/:id" component={Messages} />
      <Route path="/introductions" component={Introductions} />
      <Route path="/propose-quest" component={ProposeQuest} />
      <Route path="/partner" component={Partner} />
      <Route path="/roles/select" component={RoleDraft} />
      {/* The old address, kept so every shared link and bookmark still lands (the board was called a draft until 9 Nov 2026). */}
      <Route path="/roles/draft">{() => <Redirect to="/roles/select" replace />}</Route>
      <Route path="/roles" component={Roles} />
      {/* One role's own page and share link (the lead, 20 Nov 2026), after /roles/select and /roles/draft, which it must not take. */}
      <Route path="/roles/:slug" component={RoleShare} />
      {/* /join and /apply were 404s that people guessed at. There is one front door now. */}
      <Route path="/join">{() => <Redirect to="/roles" replace />}</Route>
      <Route path="/apply">{() => <Redirect to="/roles" replace />}</Route>
      <Route path="/how-we-create" component={HowWeCreate} />
      <Route path="/co-creators-guide" component={CoCreatorsGuide} />
      <Route path="/housing" component={Housing} />
      <Route path="/reserve" component={ReserveHome} />
      <Route path="/opportunities" component={Opportunities} />
      <Route path="/master-plan" component={MasterPlan} />
      <Route path="/team" component={Team} />
      <Route path="/admin" component={Admin} />
      {/* The Mint has its own route rather than a tab inside Admin: that file
          is 5,000 lines and shared, and this surface reads in one screen. */}
      <Route path="/admin/mint" component={Mint} />
      {/* Every change an agent proposed, reviewed, edited and accepted on one page. */}
      <Route path="/admin/proposals" component={ProposedChanges} />
      <Route path="/admin/review" component={AdminReview} />
      <Route path="/profile" component={Profile} />
      {/* The class select. Under /profile because a party is part of who you
          are here, not a separate account setting. */}
      <Route path="/profile/characters" component={Characters} />
      <Route path="/profile/gene-keys" component={GeneKeys} />
      {/* Profile settings (Direction D). Before /profile/:handle, which would otherwise take "settings" as a handle. */}
      <Route path="/profile/settings" component={ProfileSettings} />
      <Route path="/welcome" component={RitesWelcome} />
      <Route path="/aboard" component={RitesComeAboard} />
      <Route path="/aboard/welcome" component={RitesArrived} />
      <Route path="/rites" component={RitesHub} />
      <Route path="/rites/ceremony/:id" component={RitesCeremony} />
      <Route path="/rites/packet" component={RitesPacket} />
      <Route path="/card" component={RitesCard} />
      <Route path="/fleet" component={RitesFleet} />
      <Route path="/door/:code" component={RitesDoor} />
      {/* AFTER /profile/characters, and that order is the whole point: wouter
          takes the first match, so a :handle route above it would turn the
          class select into a lookup for a member called "characters". */}
      <Route path="/profile/:handle" component={PublicProfile} />
      <Route path="/login" component={Login} />
      {/* A visitor's own profile and their way back in (shared/visitorProfile.ts). The sign-in is open; the profile stands behind the entrance. */}
      <Route path="/visitor/sign-in" component={VisitorSignIn} />
      <Route path="/visitor" component={VisitorProfile} />
      {/* A connector's sign-in (addendum v6, B4): the member allows or refuses. */}
      <Route path="/oauth/authorize" component={OAuthAuthorize} />
      <Route path="/register" component={Register} />
      <Route path="/request-membership" component={RequestMembership} />
      {/* Confirm before :token, so the email's link is never read as a link made for one person. */}
      <Route path="/propose-a-role/confirm" component={ConfirmProposal} />
      <Route path="/propose-a-role/:token" component={ProposeARole} />
      <Route path="/propose-a-role" component={ProposeARole} />
      <Route path="/set-password" component={SetPassword} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/email/preferences" component={EmailPreferences} />
      <Route path="/email/unsubscribe" component={EmailUnsubscribe} />
      <Route path="/email/a" component={EmailAction} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/game-mechanics" component={GameMechanics} />
      <Route path="/changes" component={ChangeRequests} />
      <Route path="/changes/:id" component={ChangeRequests} />
      <Route path="/village-email" component={VillageEmail} />
      <Route path="/good-neighbor" component={GoodNeighbor} />
      <Route path="/steward-rights" component={StewardRights} />
      <Route path="/resident-rights" component={ResidentRights} />
      {/* One training page per track, each with its own words in Admin, Pages; /training chooses between them. */}
      <Route path="/training/steward">{() => <Training track="steward" />}</Route>
      <Route path="/training/resident">{() => <Training track="resident" />}</Route>
      <Route path="/training" component={Training} />
      {/* The Governance page (the brief, approved 26 Nov 2026): Now at /governance, How we decide at /governance/how. */}
      <Route path="/governance" component={GovernanceNow} />
      <Route path="/governance/how" component={Governance} />
      {/* The live surfaces sit BESIDE the explainer, never inside it: /governance
          says how the village decides, /decisions shows what it is deciding.
          The list route is declared before the detail route for the same reason
          /profile/characters precedes /profile/:handle — wouter takes the first
          match, and a :id above the list would swallow it. */}
      <Route path="/governance/decisions" component={Decisions} />
      {/* One org chart draft, before and after, with its revisions and the acts its decide answer allows. */}
      <Route path="/governance/decisions/drafts/:draftId" component={OrgDraft} />
      <Route path="/governance/decisions/:id" component={Decision} />
      {/* The old addresses, in links already sent (notifications, emails), keep working. */}
      <Route path="/decisions">{() => <Redirect to={`/governance/decisions${window.location.search}${window.location.hash}`} replace />}</Route>
      <Route path="/decisions/:id">{(p) => <Redirect to={`/governance/decisions/${encodeURIComponent(p.id)}${window.location.search}${window.location.hash}`} replace />}</Route>
      <Route path="/propose" component={Propose} />
      {/* One application to hold roles, on terms. Members only, behind terms.read. */}
      <Route path="/role-applications/:id" component={SeatApplication} />
      <Route path="/open-proposals/:id" component={OpenProposal} />
      <Route path="/role-measures" component={RoleMeasures} />
      <Route path="/application-status/:ref" component={ApplicationStatus} />
      <Route path="/path" component={YourPath} />
      <Route path="/seat-applications/:id" component={SeatApplicationsAlias} />
      {/* Propose my roles for next season. /new and /shared/:token before /:id, which would take them. */}
      <Route path="/role-proposals/new" component={NewRoleProposal} />
      <Route path="/role-proposals/shared/:token" component={SharedRoleProposal} />
      <Route path="/role-proposals/:id" component={RoleProposal} />
      {/* Your season: your own plan, then the village's page of everyone's, by name. */}
      <Route path="/season-plans/mine" component={MySeason} />
      <Route path="/season-plans" component={SeasonPlans} />
      <Route path="/season-places/circles" component={SeasonCircles} />
      <Route path="/season-places" component={SeasonPlaces} />
      <Route path="/role-path/:roleId" component={RolePath} />
      <Route path="/aligned" component={Aligned} />
      <Route path="/visit" component={Visit} />
      <Route path="/gratitude" component={GratitudeWall} />
      {/* A member's own practice, behind ModuleGate("journal") and sign-in. */}
      <Route path="/journal" component={Journal} />
      <Route path="/protocols/practice/:protocolId" component={Protocols} />
      <Route path="/protocols/run/:id" component={Protocols} />
      <Route path="/protocols" component={Protocols} />
      {/* The members-only map of logged places, behind ModuleGate("hidden-map") and sign-in. */}
      <Route path="/hidden-map" component={HiddenMap} />
      {/* The village chooses which quests to fund, within a pot. Behind
          ModuleGate("funding-rounds") and sign-in. */}
      <Route path="/funding-rounds" component={FundingRounds} />
      <Route path="/funding-rounds/:id" component={FundingRounds} />
      {/* A circle's live calls: the list, then one room. Both behind
          ModuleGate("sessions") and sign-in; members only, no guests. The
          list is declared before the room for the reason /decisions gives. */}
      <Route path="/sessions" component={Sessions} />
      <Route path="/sessions/season" component={SessionSeason} />
      <Route path="/sessions/:id" component={SessionRoom} />
      <Route path="/work-with-us" component={WorkWithUs} />
      <Route path="/reset" component={Reset} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
    </EntranceGate>
    </Suspense>
    </ErrorBoundary>
    </>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light">
      {/*
       * "reduce" has to be honoured HERE, not only in CSS. index.css already
       * carries a prefers-reduced-motion block and it was measured doing nothing
       * on 19 routes: it caps animation-duration and transition-duration, and
       * Framer Motion does not use either. It drives inline transform and
       * opacity from JS, frame by frame, so a CSS rule has nothing to bite on.
       *
       * `reducedMotion="user"` makes every motion component in the tree read the
       * OS setting: transform, layout and scroll animations stop, opacity and
       * colour still cross-fade because neither triggers vestibular symptoms.
       * That keeps the reveals from stranding an element at opacity 0, which is
       * the failure mode the CSS block's 1ms transition was written to avoid.
       *
       * The two Level A cases this closes are the loops rather than the reveals:
       * the scroll dot on Home and the rotating tile on the investor journey both
       * run `repeat: Infinity` and never stopped for anyone.
       */}
      <MotionConfig reducedMotion="user">
      {/* One line weight for every icon: the stock ones drawn at the living glyphs' line
          (LIVING_STROKE, components/sacred/livingCore.tsx), so a row of the two reads as one
          family. An icon that names its own strokeWidth keeps it. */}
      <LucideProvider strokeWidth={LIVING_STROKE}>
      <LazyMotion features={loadMotionFeatures}>
        <AuthProvider>
        {/* The visitor's language, before any page renders (internal spec i18n, US1). */}
        <LocaleRoot fallback={<QuietLoading world />}>
        <ModuleProvider>
          <TooltipProvider>
            <Toaster />
            {/*
              * The handle on the break-glass. Draws nothing until a route
              * answers 409 with a power this village holds, and then asks
              * before anything is sent a second time.
              */}
            <BreakGlass />
            <Router />
          </TooltipProvider>

        </ModuleProvider>
        </LocaleRoot>
        </AuthProvider>
      </LazyMotion>
      </LucideProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}

export default App;
