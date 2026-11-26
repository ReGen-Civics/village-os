/**
 * FOUR WAYS TO BUILD THE VILLAGE (the lead, 23 Nov 2026), largest commitment first, with the same verbs wherever
 * they are offered: Join the team, Start a venture, Become a partner, Propose a quest (shared/contributorRoutes.ts).
 *
 * Each says, in one line, what it is; what you bring; and what you get back. No reply promise is made here (the lead,
 * 24 Nov 2026: "only at submission we want to be careful about overpromising"): a person is told when they will hear
 * back once they have sent, in the village's own moon cycles (useReplyPromise, `org.reply_window_moons`). Drawn at the top of the
 * roles page, at the end of its lists and in the application's role picker ("Don't see your gift in a role?",
 * the other three), on the home page under the hero, on the pages after an application or a waitlist sign-up, from
 * the footer's "Work with us", on the empty quest board and on a member's Start here card.
 *
 * Where each goes (the lead, 23 Nov 2026): a role to the founding team on the roles page, `/roles#founding-team`; a
 * venture to the open ventures there, `/roles#open-ventures` (on /roles itself both scroll down the page and focus the
 * section's heading, client/src/lib/sectionAnchor.ts); a partnership to /partner; a quest to /propose-quest. The Open
 * ventures group's own button pitches a venture on the village's general proposal form, /work-with-us (a village that
 * switched that page off gets the member's door for a new role, /role-proposals/new).
 *
 * START A VENTURE LANDS ON A VENTURE (the lead, 24 Nov 2026): every Start a venture link now goes to the proposal form
 * set up for a venture, `/work-with-us?kind=venture` (shared/contributorRoutes.ts), from the Open ventures button, the
 * cards at the end of /roles, the home page, the thank-you pages and the other lists. The one exception is the compact
 * tile at the top of /roles (`variant="tiles"`), which keeps scrolling to the open ventures on that page.
 */
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import { useGameConfig } from "@/lib/gameApi";
import { useStoryPageShown } from "@/lib/brochure";
import { useNewcomerOrVisitor } from "@/lib/newcomer";
import { BTN_NOTICE, BTN_PRIMARY, DOOR, EYEBROW, HINT, LABEL, TILE } from "@/components/journey/look";
import { replyMoonsOf, routesExcept, type ContributorRoute } from "@shared/contributorRoutes";
import { goToSection, ROLES_SECTIONS, samePageHash } from "@/lib/sectionAnchor";

/** The proposal page, as the village's story-page switch names it. */
export const VENTURE_PITCH_PAGE = "/work-with-us";
/** The proposal page set up for a venture (VENTURE_QUERY, shared/contributorRoutes.ts). */
export const VENTURE_PITCH_FORM = "/work-with-us?kind=venture";
export const VENTURE_PITCH_FALLBACK = "/role-proposals/new";
/**
 * Each route's own place. Written as doors (`href:`) so the route-reachability guard counts them. The venture's is the
 * top of /roles' compact tile only; everywhere else a venture goes to the proposal form (useVentureHref).
 */
const ROUTE_DOORS: Record<ContributorRoute, { href: string }> = {
  team: { href: `/roles#${ROLES_SECTIONS.team}` },
  venture: { href: `/roles#${ROLES_SECTIONS.venture}` },
  partner: { href: "/partner" },
  quest: { href: "/propose-quest" },
};

/**
 * Where a venture is started on this village, for this reader: the proposal form set up for a venture while the
 * village serves it, or else the member's door for a new role. Null for a newcomer when the form is off (the
 * five-reviewer QA pass, 25 Nov 2026): the member's door is closed to them, so a caller sends them to the open
 * ventures on /roles, or draws no pitch button at all.
 */
export function useVentureHref(): string | null {
  const shown = useStoryPageShown();
  const newcomer = useNewcomerOrVisitor();
  if (shown(VENTURE_PITCH_PAGE)) return VENTURE_PITCH_FORM;
  return newcomer ? null : VENTURE_PITCH_FALLBACK;
}

/** The open ventures on /roles: where a venture goes for a reader with no pitch form to open. */
export const OPEN_VENTURES_HREF = ROUTE_DOORS.venture.href;

/** The moon cycles a proposer is told they will hear back within, once they have sent (`org.reply_window_moons`). */
export function useReplyMoons(): number {
  return replyMoonsOf(useGameConfig()?.replyWindowMoons);
}

/** "You'll hear from us within one moon cycle.", said on a thank-you state only (the lead, 24 Nov 2026). */
export function useReplyPromise(): string {
  const { t } = useLingui();
  const moons = useReplyMoons();
  return moons === 1
    ? t({ message: "You'll hear from us within one moon cycle.", context: "after sending a proposal: when you hear back" })
    : t({ message: `You'll hear from us within ${moons} moon cycles.`, context: "after sending a proposal: when you hear back, more than one moon" });
}

interface RouteWords {
  verb: string;
  line: string;
  /** The few words a compact tile carries (the top of /roles). */
  short: string;
  bring: string;
  back: string;
  /** A sentence more, said on the full card only. */
  note?: string;
}

/**
 * `founding`: on the application page and its thank-you pages, which keep to the founding register (no game
 * words), the quest route is "Offer a one-off piece of work", with the same link (the lead, 23 Nov 2026; never
 * "contribution", which a reader can take for the contribution token).
 */
export function useRouteWords(register: "plain" | "founding" = "plain"): Record<ContributorRoute, RouteWords> {
  const { t } = useLingui();
  const questVerb = register === "founding" ? t({ message: "Offer a one-off piece of work", context: "four ways to build: a quest, on the application page and its thank-you pages" }) : t({ message: "Propose a quest", context: "four ways to build: a quest" });
  return {
    team: {
      verb: t({ message: "Join the team", context: "four ways to build: a role" }),
      line: t({ message: "Hold a role on the team, with its own accountabilities and terms.", context: "four ways to build: a role, in one line" }),
      short: t({ message: "A role on the team, with its own terms.", context: "four ways to build: a role, a compact tile" }),
      bring: t({ message: "Your time and skills, held in one role.", context: "four ways to build: a role, what you bring" }),
      // Compensation for a role's pay; "rewarded" is said of quests only (the lead, 23 Nov 2026).
      back: t({ message: "The compensation the role's terms set out, agreed together.", context: "four ways to build: a role, what you get back" }),
    },
    venture: {
      verb: t({ message: "Start a venture", context: "four ways to build: a venture" }),
      line: t({ message: "Build and own a business on the land. The village shares in it through a lease or a profit share.", context: "four ways to build: a venture, in one line" }),
      short: t({ message: "Your own business on the land.", context: "four ways to build: a venture, a compact tile" }),
      bring: t({ message: "Your business, your experience and what you invest in it.", context: "four ways to build: a venture, what you bring" }),
      back: t({ message: "A business of your own, on the land, with the village beside you.", context: "four ways to build: a venture, what you get back" }),
    },
    partner: {
      verb: t({ message: "Become a partner", context: "four ways to build: a partnership" }),
      line: t({ message: "You already run a project or business and want to help build the community, build the village, or help it thrive.", context: "four ways to build: a partnership, in one line" }),
      short: t({ message: "Partner with us, thrive together.", context: "four ways to build: a partnership, a compact tile" }),
      // The lead, 23 Nov 2026: what was the nonprofit partner venture is now a partnership.
      note: t({ message: "Local nonprofits can partner with the village too, including to share in its profits.", context: "four ways to build: a partnership, nonprofits" }),
      bring: t({ message: "Your project or business, and what you offer the village.", context: "four ways to build: a partnership, what you bring" }),
      back: t({ message: "A partnership shaped together, with no role on the team and no lease.", context: "four ways to build: a partnership, what you get back" }),
    },
    quest: {
      verb: questVerb,
      line: t({ message: "A one-off piece of value, rewarded when the work is accepted.", context: "four ways to build: a quest, in one line" }),
      short: t({ message: "A one-off piece of work, rewarded.", context: "four ways to build: a quest, a compact tile" }),
      bring: t({ message: "One piece of work you want to do.", context: "four ways to build: a quest, what you bring" }),
      back: t({ message: "A reward when the work is accepted.", context: "four ways to build: a quest, what you get back" }),
    },
  };
}

/** "Don't see your gift in a role? Consider these:", said where the other three sit beside a role. */
export function useGiftHeading(): string {
  const { t } = useLingui();
  return t({ message: "Don't see your gift in a role? Consider these:", context: "four ways to build: the other three, beside a role" });
}

/** "Four ways to build <the village>", the village's own name, or the plain words when it has none yet. */
export function useFourWaysHeading(): string {
  const { t } = useLingui();
  const name = useGameConfig()?.project?.name?.trim() ?? "";
  return name ? t({ message: `Four ways to build ${name}`, context: "four ways to build: the heading, with the village's name" }) : t({ message: "Four ways to build the village", context: "four ways to build: the heading, before the village has a name" });
}

export default function ContributorRoutes({
  variant = "cards",
  except = [],
  heading,
  headingId,
  headingAs = variant === "cards" ? "h2" : "p",
  hrefs = {},
  register = "plain",
  className = "",
}: {
  /**
   * `cards`: one card each, side by side on a desktop. `links`: a quiet list, for inside a form or beside a page.
   * `tiles`: the verb and a few words each, two by two on a phone and one row on a desktop (the top of /roles).
   */
  variant?: "cards" | "links" | "tiles";
  register?: "plain" | "founding";
  except?: ContributorRoute[];
  heading?: string | null;
  headingId?: string;
  headingAs?: "h2" | "h3" | "p";
  /** A page that holds one of the routes itself points its card there (the roles page's open roles). */
  /** A route's own address here; null leaves the route out (a door this reader cannot open). */
  hrefs?: Partial<Record<ContributorRoute, string | null>>;
  className?: string;
}) {
  const { t } = useLingui();
  const words = useRouteWords(register);
  const routes = routesExcept(except).filter((r) => hrefs[r] !== null);
  // The compact tiles sit at the top of /roles and scroll to its open ventures; every other Start a venture opens the
  // proposal form set up for a venture (the lead, 24 Nov 2026).
  const ventureForm = useVentureHref();
  const hrefOf = (r: ContributorRoute): string => hrefs[r] ?? (r === "venture" && variant !== "tiles" ? (ventureForm ?? ROUTE_DOORS.venture.href) : ROUTE_DOORS[r].href);
  const Heading = headingAs;
  const go = (r: ContributorRoute, cls: string, children: React.ReactNode) => {
    const href = hrefOf(r);
    // A section on this same page scrolls there and focuses its heading; the router would treat it as a new page.
    const hash = samePageHash(href);
    return hash ? (
      <a
        href={`#${hash}`}
        className={cls}
        data-route-door={r}
        onClick={(e) => {
          if (goToSection(hash)) e.preventDefault();
        }}
      >
        {children}
      </a>
    ) : (
      <Link href={href} className={cls} data-route-door={r}>{children}</Link>
    );
  };

  if (variant === "tiles") {
    return (
      <div className={className} data-contributor-routes="tiles">
        {heading ? <Heading id={headingId} className="mb-2 font-display text-lg leading-tight text-foreground sm:mb-3 sm:text-2xl">{heading}</Heading> : null}
      <ul className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {routes.map((r) => (
          <li key={r} className="m-germ min-w-0" data-route={r}>
            {go(
              r,
              "m-touch group flex h-full min-h-11 flex-col gap-0.5 rounded-xl border border-border bg-muted px-3 py-2 hover:border-notice focus-visible:outline-2 focus-visible:outline-ring sm:gap-1 sm:p-3",
              <>
                {/* The arrow sits on the verb's first line when a long verb wraps (QA, 23 Nov 2026). */}
                <span className="flex items-start justify-between gap-1 text-sm font-semibold text-foreground sm:text-base">
                  {words[r].verb}
                  <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground group-hover:text-notice sm:mt-1" aria-hidden="true" />
                </span>
                <span className="text-xs leading-snug text-muted-foreground">{words[r].short}</span>
              </>,
            )}
          </li>
        ))}
      </ul>
      </div>
    );
  }

  if (variant === "links") {
    return (
      <div className={`grid gap-2 ${className}`} data-contributor-routes="links">
        {heading ? <Heading id={headingId} className={headingAs === "h2" ? EYEBROW : LABEL}>{heading}</Heading> : null}
      <ul className="grid gap-3">
        {routes.map((r) => (
          <li key={r} className="m-germ" data-route={r}>
            {go(
              r,
              `jw-btn min-h-14 ${DOOR}`,
              <>
                <span className="grid min-w-0 flex-1">
                  <span>{words[r].verb}</span>
                  <span className="text-xs font-normal text-muted-foreground">{words[r].line}</span>
                </span>
                <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
              </>,
            )}
          </li>
        ))}
      </ul>
      </div>
    );
  }

  // A card's name sits one level under the section's heading, or is a paragraph when the section has none.
  const Title = heading && headingAs === "h2" ? "h3" : heading && headingAs === "h3" ? "h4" : "p";
  const cols = routes.length >= 4 ? "lg:grid-cols-4" : routes.length === 3 ? "lg:grid-cols-3" : "";
  return (
    <div className={className} data-contributor-routes="cards">
      {heading ? <Heading id={headingId} className="mb-4 font-display text-2xl leading-tight text-foreground sm:text-3xl">{heading}</Heading> : null}
    <ul className={`grid gap-4 sm:grid-cols-2 ${cols}`}>
      {routes.map((r) => (
        <li key={r} className={`m-germ ${TILE} flex flex-col gap-3`} data-route={r}>
          {/* The verb first, so a phone reader scanning four tall cards sees which is which. */}
          <Title className="font-display text-xl leading-tight text-foreground">{words[r].verb}</Title>
          <p className="text-base leading-relaxed text-foreground">{words[r].line}</p>
          {words[r].note ? <p className="text-sm leading-relaxed text-foreground" data-route-note="">{words[r].note}</p> : null}
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="font-semibold text-foreground">{t({ message: "You bring", context: "four ways to build: the label before what you bring" })}</dt>
              <dd className="text-muted-foreground">{words[r].bring}</dd>
            </div>
            <div>
              <dt className="font-semibold text-foreground">{t({ message: "You get back", context: "four ways to build: the label before what you get back" })}</dt>
              <dd className="text-muted-foreground">{words[r].back}</dd>
            </div>
          </dl>
          <div className="mt-auto pt-1">
            {go(
              r,
              `${BTN_NOTICE} w-full text-base`,
              <>
                {words[r].verb}
                <ArrowRight className="size-4" aria-hidden="true" />
              </>,
            )}
          </div>
        </li>
      ))}
    </ul>
    </div>
  );
}

/** The top of the roles page: the four ways, named as a region; its words a paragraph, so the page keeps one h1. */
export function FourWaysSection({ hrefs }: { hrefs?: Partial<Record<ContributorRoute, string | null>> }) {
  const heading = useFourWaysHeading();
  return (
    <section id="four-ways" aria-labelledby="four-ways-heading" className="mx-auto mb-6 max-w-4xl scroll-mt-24 sm:mb-8 lg:max-w-6xl" data-four-ways="">
      <ContributorRoutes variant="tiles" heading={heading} headingId="four-ways-heading" headingAs="p" hrefs={hrefs} />
    </section>
  );
}

/** "Don't see your gift in a role? Consider these:", the other three, at the end of the roles page's lists. */
export function GiftSection({ hrefs }: { hrefs?: Partial<Record<ContributorRoute, string | null>> }) {
  const heading = useGiftHeading();
  return (
    <section aria-labelledby="your-gift" className="mx-auto mb-14 max-w-4xl lg:max-w-6xl" data-your-gift="">
      <ContributorRoutes except={["team"]} heading={heading} headingId="your-gift" hrefs={hrefs} />
    </section>
  );
}

/** The Open ventures group's own door: Start a venture (the lead, 23 Nov 2026). */
export function StartVentureButton() {
  const href = useVentureHref();
  const verb = useRouteWords().venture.verb;
  // A newcomer with no form to open: the ventures listed right here are the way in, so no button.
  if (!href) return null;
  return (
    <Link href={href} className={`${BTN_PRIMARY} mb-6 min-h-12 px-6 text-base`} data-pitch-venture="">
      {verb}
      <ArrowRight className="h-5 w-5" aria-hidden="true" />
    </Link>
  );
}
