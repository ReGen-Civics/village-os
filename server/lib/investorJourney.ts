/**
 * THE INVESTOR PAGE'S SPEC AND ITS DEFAULT WORDS, ON THE SERVER ONLY (the lead, 27 Nov 2026: "Yes I want to hide the
 * generic text right now and going forward it should be screened to show investment details").
 *
 * This was `INVESTOR_JOURNEY` in shared/pageContent/journeys.ts, where every reader's browser downloaded it. It now
 * lives here, so its words reach a browser only through `GET /api/investor/page`, which answers the readers the team
 * let in (server/routes/investorAccess.ts) and nobody else. Admin, Pages reads it from `GET /api/admin/page-specs/kept`.
 * `keepPageSpec` puts it in the server's registry beside the public pages, so a save, a translation and a proposed
 * change still find it. Nothing under client/ may import this file; server/investorBundle.test.ts reads the
 * built bundle for its words.
 */
import { JOURNEY_TARGETS, TARGET_HELP, buildJourney, closingBand, faqSection, long, target, text, type StepDefault } from "../../shared/pageContent/journeys";
import { INVESTOR_FIGURE_IDS } from "../../shared/pageContent/journeys";
import { keepPageSpec } from "../../shared/pageContent";
import type { PageSpec } from "../../shared/pageContent/types";

const INVESTOR_TARGET_HELP = `${TARGET_HELP} #pack-form and #call-form open this page's two forms.`;

const INVESTOR_STEPS: StepDefault[] = [
  {
    legacyId: "discover",
    stage: "Curious",
    title: "Discover {village}",
    description: "Learn what {village} is building, what it values, and how it makes decisions.",
    bullets: ["Read the village's story and values", "Learn about the place", "Meet the people behind it", "Ask your questions at an event"],
    label: "See Upcoming Events",
    target: JOURNEY_TARGETS.events,
  },
  {
    legacyId: "request",
    stage: "Interested",
    title: "Request Investor Pack",
    description: "Ask for the investor pack: the documents {village} shares with people considering an investment.",
    bullets: ["The plan and its phases", "The financial picture", "How investments are structured", "The legal structure"],
    label: "Request Pack",
    target: JOURNEY_TARGETS.packForm,
  },
  {
    legacyId: "call",
    stage: "Exploring",
    title: "Schedule Investment Call",
    description: "Talk one-on-one with the {village} team about your goals and how they fit the village.",
    bullets: ["Discuss investment options", "Review the financial picture", "Understand how investments are structured", "Ask about living here too"],
    label: "Schedule Call",
    target: JOURNEY_TARGETS.callForm,
  },
  {
    legacyId: "commit",
    stage: "Committed",
    title: "Make Your Commitment",
    description: "Choose how you invest, and put your commitment in writing with {village}.",
    bullets: ["Choose how you invest", "Review and sign agreements", "Complete the transfer", "Stay in touch as the village grows"],
    label: "Contact Team",
    target: JOURNEY_TARGETS.contact,
  },
];


export const INVESTOR_JOURNEY: PageSpec = buildJourney({
  id: "investor",
  label: "Investor journey",
  path: "/investor",
  targetHelp: INVESTOR_TARGET_HELP,
  hero: {
    eyebrow: "Capital Contributor Journey",
    headline: "Invest in {village}",
    highlight: "{village}",
    intro:
      "Capital Contributors bring money, credit or other resources to help {village} grow. Read what the village has published, ask your questions, and decide whether it fits your goals.",
    primary: ["Request Investor Pack", JOURNEY_TARGETS.packForm],
    secondary: ["See Upcoming Events", JOURNEY_TARGETS.events],
    contactSubject: "Investment Commitment",
  },
  beforeSteps: [
    /*
     * THE CASE, THE NOTICE AND THE RISKS (investor remake, 24 Nov 2026). An
     * investor page that invites people to talk about money needs three things
     * the page did not have: the reasons in the village's own words, a plain
     * line that the page is no offer of investment, and the risks said out loud.
     * The case and the risk list start EMPTY and are not drawn until a village
     * writes them: a reason nobody typed is a claim nobody made. The notice and
     * the opening sentence on risk are true of every village still being built,
     * so they start written, and a village rewrites them with its own counsel.
     */
    {
      id: "case",
      label: "Why this village",
      shows: "Short points under the top of the page: what a capital partner should know first. Not drawn until you add a point.",
      hideable: true,
      fields: [
        text("heading", "Heading", 40, "Why This Village"),
        long("intro", "Sentence under the heading", 200, "What a capital partner should know about {village}, in plain words.", {
          optional: true,
          help: "Leave blank for none.",
        }),
      ],
      lists: [
        {
          key: "points",
          label: "Points",
          help: "Up to six. Say only what is true today, and keep figures out unless your counsel agrees.",
          itemLabel: "Point",
          titleKey: "title",
          maxItems: 6,
          fields: [text("title", "Point", 48, ""), long("detail", "A line or two under it", 240, "")],
          default: [],
        },
      ],
    },
    {
      id: "notice",
      label: "Not an offer",
      shows: "A short line under the buttons at the top of the page and in both forms. Ask your counsel what yours should say.",
      hideable: true,
      fields: [
        long(
          "body",
          "The line",
          280,
          "This page shares information and invites a conversation. It is not an offer to sell, or a request to buy, any investment or security. Any investment would be made only through formal documents, to people who qualify, where the law allows.",
        ),
      ],
    },
    {
      id: "figures",
      label: "Key numbers",
      shows: "Tiles for the land and money figures you set in Admin, Settings. A tile shows only when its figure is set.",
      hideable: true,
      fields: [
        text("heading", "Heading", 40, "Key Numbers"),
        long("intro", "Sentence when figures are set", 160, "The figures this village has stated about its own land and its own raise."),
        long("empty", "Sentence when no figure is set", 160, "This village has not published any figures yet."),
        long("disclaimer", "Small print under the sentence", 140, "Past performance and projections are not guarantees of future results.", {
          optional: true,
          help: "Shown only when figures are set. Leave blank for none.",
        }),
      ],
      lists: [
        {
          key: "tiles",
          label: "Tiles",
          help: "One per figure, in this order. The figure and its small note come from Admin, Settings.",
          itemLabel: "Tile",
          titleKey: "title",
          fixed: INVESTOR_FIGURE_IDS,
          maxItems: INVESTOR_FIGURE_IDS.length,
          fields: [
            text("title", "Title", 24, ""),
            text("detail", "What the figure means", 80, ""),
          ],
          default: [
            { title: "Land Value", detail: "Change in the value of this village's land." },
            { title: "Appraisal", detail: "Current property valuation." },
            { title: "Projected Return", detail: "Based on phased development." },
            { title: "Target Raise", detail: "What this phase is raising." },
          ],
        },
      ],
    },
    {
      id: "personas",
      label: "Who invests",
      shows: "Coloured cards for the kinds of people who invest here.",
      hideable: true,
      fields: [
        text("heading", "Heading", 40, "Why People Invest"),
        long("intro", "Sentence under the heading", 140, "People back a village for different reasons. See if yours is here."),
      ],
      lists: [
        {
          key: "items",
          label: "People",
          help: "Up to nine. Each gets the next icon and colour in a fixed set.",
          itemLabel: "Person",
          titleKey: "title",
          maxItems: 9,
          fields: [text("title", "Who they are", 32, ""), text("subtitle", "Line under it", 80, "")],
          default: [
            { title: "Future Residents", subtitle: "Invest in the place you plan to call home" },
            { title: "Impact Investors", subtitle: "Back a village whose work you believe in" },
            { title: "Neighbors and Locals", subtitle: "Invest in the future of your own region" },
            { title: "Families", subtitle: "Build something lasting for the next generation" },
            { title: "Lenders", subtitle: "Offer credit on terms that work for both sides" },
            { title: "Friends of the Village", subtitle: "Support a place you care about, near or far" },
          ],
        },
      ],
    },
  ],
  steps: {
    heading: "Your Investment Journey",
    intro: "Track your progress as you explore investment opportunities at {village}.",
    items: INVESTOR_STEPS,
  },
  afterSteps: [
    {
      id: "phases",
      label: "Development phases",
      shows: "The dark band listing what gets built, each with a status and a progress bar. It is not drawn until you list a phase.",
      hideable: true,
      fields: [
        text("heading", "Heading", 40, "Development Phases"),
        long("intro", "Sentence under the heading", 160, "What {village} plans to build, and how far along each part is."),
        text("activeStatus", "Status drawn in gold", 16, "Planning", {
          help: "A phase whose status reads exactly this gets the gold label; any other status gets a pale one.",
        }),
      ],
      lists: [
        {
          key: "items",
          label: "Phases",
          help: "Up to eight, top to bottom. None until you add one.",
          itemLabel: "Phase",
          titleKey: "name",
          maxItems: 8,
          fields: [
            text("name", "Name", 32, ""),
            text("units", "Size (keys, homes, lots)", 16, ""),
            text("status", "Status", 16, ""),
            text("progress", "Progress, 0 to 100", 5, "", { help: "A whole number. The bar fills this far." }),
          ],
          default: [],
        },
      ],
    },
    {
      id: "risks",
      label: "Risks",
      shows: "What could go wrong, said plainly, before the questions. Drawn while it has a sentence or a risk.",
      hideable: true,
      fields: [
        text("heading", "Heading", 40, "What Could Go Wrong"),
        long(
          "intro",
          "Sentence under the heading",
          240,
          "Every investment in a village that is still being built carries risk. You could lose some or all of the money you put in.",
          { optional: true, help: "Leave blank for none." },
        ),
      ],
      lists: [
        {
          key: "items",
          label: "Risks",
          help: "Up to eight. Name each one plainly.",
          itemLabel: "Risk",
          titleKey: "title",
          maxItems: 8,
          fields: [text("title", "Risk", 48, ""), long("detail", "What it means", 240, "")],
          default: [],
        },
      ],
    },
    faqSection("Investor FAQs"),
    closingBand({
      heading: "Ready to Explore?",
      body: "Connect with our team to discuss how {village} fits your investment goals.",
      primary: ["Request Investor Pack", JOURNEY_TARGETS.packForm],
      secondary: ["View the Master Plan", "/master-plan"],
      targetHelp: INVESTOR_TARGET_HELP,
    }),
    {
      id: "packForm",
      label: "Investor pack form",
      shows: "The form #pack-form opens.",
      fields: [
        text("rangeHint", "Hint inside the investment range box", 32, "The range you have in mind", {
          optional: true,
          help: "Grey example text. Leave blank for none.",
        }),
      ],
    },
    {
      id: "accreditation",
      label: "Accredited investor check",
      shows: "A box in the investor pack form a visitor must tick before it sends. Switch it off where your law has no such test.",
      hideable: true,
      fields: [
        long("statement", "What the visitor confirms", 140, "I confirm I am an accredited investor."),
        text("reminder", "Note when they send without ticking it", 80, "Please confirm you are an accredited investor."),
      ],
    },
    {
      id: "callForm",
      label: "Investment call form",
      shows: "The form #call-form opens, and the note shown once it is sent.",
      fields: [
        text("timeHint", "Hint inside the preferred time box", 32, "e.g., weekday mornings", {
          optional: true,
          help: "Grey example text. Leave blank for none.",
        }),
        text("thanks", "Note once it is sent", 80, "Thank you! The team will be in touch soon.", {
          help: "A promise to the visitor: say only what your team will keep.",
        }),
      ],
    },
  ],
});

// ── /steward ─────────────────────────────────────────────────────────────

/**
 * ONE FLOW, TWO PATHS (build list section 8, 11 Nov 2026). The page used to
 * carry "Getting to know us" and an eleven-step journey that overlapped. It is
 * now one flow: the first steps everyone takes, then the path divides into
 * the steward path (hold a role) and the resident path (live here), and the
 * steward path ends by inviting a role holder onto the resident path too.
 *
 * EXPAND ONLY. The section ids a village has already saved keep their meaning
 * and are still read: `getToKnow` is the shared first steps (with a new
 * `exceptions` line), `steps` is the steward path. The new sections (`tracks`,
 * `crossover`, `foundingTeam`, `extras`) start from their defaults,
 * so a village that saved the old page keeps its words and gains the new parts.
 *
 * SHARED WITH /resident. `getToKnow` and `tracks` are read by the resident page
 * as well, so the first steps and the fork are written once, here.
 */

/** The stage labels the steward path uses, so the page can tell whose move a step is. */

keepPageSpec(INVESTOR_JOURNEY);
