/**
 * THE FOUNDING ROLE CARD, PIECE BY PIECE (Rye, 14 Nov 2026: "the role cards look more like
 * interactive role artifacts ... with image, animations and a way of piece by piece showing the
 * information in the role"; approved mockup A, https://claude.ai/artifact/NaavCsufyAEHKowgEdKFAX).
 *
 * Left, the role as a seat: its art (the role's own image, else its first character's art), its
 * circle, its name, its roots, "This role is rewarded", four quick facts and the one act, "Apply for
 * this role". Right, the role's words as pieces (RolePieces), each with an icon, its lines split
 * into short tiles (shared/rolePieces.ts) and never rewritten.
 *
 * Every word is the role editor's, read live; a piece the card has not written is not drawn. Each
 * concept once (QA2-16): the facts say the commitment, track, place and languages, so the details
 * under "How you're chosen" leave them out.
 */
import { lazy, Suspense, type ReactNode } from "react";
import { BadgeCheck, CalendarDays, Clock, Coins, Compass, Globe2, Handshake, KeyRound, Layers, Map, MapPin, ShieldCheck, Sprout, UserRound } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import { CARD_WORDS as W } from "@shared/playerCardWords";
import { SECTION_WORDS, type RoleCardSections } from "@shared/roleCardSections";
import { roleCardView } from "@shared/roleCardView";
import { roleArtFor } from "@shared/roleDraft";
import { splitDomain, splitLine } from "@shared/rolePieces";
import { commitmentRowWords } from "./rewardWords";
import { paidRoleLine, trackWords } from "./cardWordsT";
import { EYEBROW, HINT } from "@/components/journey/look";
import ArtImage from "@/components/roleDraft/ArtImage";
import RoleCardParams from "@/components/power/RoleCardParams";
import RootsSlot from "./RootsSlot";
import RolePieces, { type RolePiece } from "./RolePieces";
import { NO_SHARED, onboardingFor, type RoleCardShared } from "@shared/roleCardShared";

// The timeline loads when a card has dated deliverables, off the first view of /roles (route-first-view.json).
const DeliverablesGantt = lazy(() => import("./DeliverablesGantt"));
// The rhythm and the onboarding steps sit in pieces a reader opens, so they load with the card's lists, off the first view.
const Rhythm = lazy(() => import("./CardLists").then((m) => ({ default: m.Rhythm })));
const OnboardingSteps = lazy(() => import("./CardLists").then((m) => ({ default: m.OnboardingSteps })));

/** Lines as bullets, each "Label: words" line with its label in bold (the lead, 19 Nov 2026: bullets over paragraphs). */
export function LabelledBullets({ lines }: { lines: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 leading-relaxed marker:text-notice">
      {lines.map((l, k) => {
        const s = splitLine(l);
        return (
          <li key={k} className="text-card-foreground">
            {s.title ? (
              <>
                <span className="font-semibold">{s.title}:</span> {s.body}
              </>
            ) : (
              s.body
            )}
          </li>
        );
      })}
    </ul>
  );
}

type LucideIcon = typeof Compass;

/** Lines as tiles: a "Lead: rest" line gets its lead as the tile's title. */
function Tiles({ lines, icon: Icon }: { lines: string[]; icon: LucideIcon }) {
  return (
    <ul className="grid gap-2.5 @2xl:grid-cols-2">
      {lines.map((l, k) => {
        const s = splitLine(l);
        return (
          <li key={k} className="flex min-w-0 gap-3 rounded-xl border border-border bg-muted p-3.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-card text-notice" aria-hidden="true">
              <Icon className="size-4" />
            </span>
            <span className="min-w-0 leading-snug">
              {s.title ? (
                <>
                  <span className="block font-semibold text-card-foreground">{s.title}</span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">{s.body}</span>
                </>
              ) : (
                <span className="block text-card-foreground">{s.body}</span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Sub({ as: As, children }: { as: "h3" | "h4" | "h5"; children: ReactNode }) {
  return <As className="mb-2 text-xs font-semibold uppercase tracking-widest text-notice">{children}</As>;
}

export interface FoundingRoleCardProps {
  seat: Record<string, any>;
  circleName: string | null;
  sections: RoleCardSections | null;
  /** The seat with any hidden range already taken out. */
  params: Record<string, any>;
  lifted: boolean;
  aim: string;
  existsWhile: string;
  words: Array<{ key: string; heading: string; lines: string[] }>;
  bringMe: string[];
  notMine: string[];
  holding: Array<{ key: string; heading: string; text: string }>;
  commitmentPct: number | null;
  commitment: string | null;
  /** The pay block, already drawn (testids pay-shape and the rest). */
  pay: ReactNode;
  companion: ReactNode;
  /** The one act, or null when this reader may not apply. */
  act: ReactNode;
  wide: boolean;
  /** Something under each piece (the applicant's suggestions). */
  after?: (key: string) => ReactNode;
  /** Open every piece at once. */
  allPieces?: boolean;
  /** How many suggestions each piece carries, for the dot on its rail chip. */
  marks?: (key: string) => number;
  /** The words every card shares (shared/roleCardShared.ts). */
  shared?: RoleCardShared;
}

export default function FoundingRoleCard(p: FoundingRoleCardProps) {
  const { t, i18n } = useLingui();
  const { seat, lifted } = p;
  const Title = lifted ? "h2" : "h3";
  const SubH = lifted ? "h4" : "h5";
  const roots = Array.isArray(seat.archetypes) ? seat.archetypes.map(String) : [];
  const art = roleArtFor({ archetypes: roots, raw: seat });
  const open = seat.state !== "filled";

  // The four quick facts, from the same view model every card host reads.
  // Read from the params, which carry the card's own words for where (sections.where) when it has them.
  const rows = roleCardView(p.params ?? seat).rows;
  const row = (id: string) => rows.find((r) => r.id === id)?.lines.join(", ") ?? "";
  const facts: Array<{ icon: LucideIcon; label: string; value: string }> = [
    // A role that can be shared says its range (Rye, 14 Nov 2026); a whole role says what it says today.
    { icon: Clock, label: W.timeCommitment, value: typeof seat?.card?.commitmentMin === "number" ? commitmentRowWords(i18n, seat.card.commitmentMin) : p.commitmentPct !== null ? `${p.commitmentPct}%` : (p.commitment ?? "") },
    { icon: Layers, label: t({ message: "Track", context: "founding card fact" }), value: row("track") ? trackWords(i18n, row("track")) : "" },
    { icon: MapPin, label: t({ message: "Where", context: "founding card fact" }), value: row("where") },
    { icon: Globe2, label: t({ message: "Languages", context: "founding card fact" }), value: row("languages") },
  ].filter((f) => f.value);

  // The details under "How you're chosen" leave out what the facts already say.
  const card = p.params?.card && typeof p.params.card === "object" ? p.params.card : null;
  // The pay is said once, on the Rewards piece (the lead, 19 Nov 2026), so "What it pays" is not said again here.
  const chosenSeat = card ? { ...p.params, card: { ...card, commitmentPct: undefined, track: undefined, whereWorked: undefined, whereText: undefined, languages: undefined, ...(p.pay ? { publicPay: undefined } : {}) } } : p.params;
  const shared = p.shared ?? NO_SHARED;


  const why = p.words.find((w) => w.key === "whyItMatters");
  const word = (key: string) => p.words.find((w) => w.key === key);
  const domain = word("domain");
  const pieces: RolePiece[] = [];
  // What the village needs: the lines every card shares, then the role's own, each a bullet.
  // The host already put the village's shared lines first and split the role's own into one line each.
  const needs = why?.lines ?? [];
  if (p.aim || needs.length) {
    pieces.push({
      key: "purpose",
      tab: W.purpose,
      icon: Compass,
      title: W.purpose,
      body: (
        <div className="flex flex-col gap-4">
          {p.aim && (
            <div data-testid="purpose">
              <p className="max-w-[46ch] font-display text-xl leading-snug text-card-foreground sm:text-2xl">{p.aim}</p>
              {p.existsWhile && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {W.existsWhile} {p.existsWhile}
                </p>
              )}
            </div>
          )}
          {needs.length > 0 && (
            <div data-testid="words-whyItMatters" className="rounded-xl border border-border bg-muted p-3.5">
              <Sub as={SubH}>{why?.heading}</Sub>
              <LabelledBullets lines={needs} />
            </div>
          )}
        </div>
      ),
    });
  }
  if (domain) {
    const all = domain.lines.join(" ");
    const d = splitDomain(all);
    pieces.push({
      key: "domain",
      tab: t({ message: "Looks after", context: "founding card piece, short" }),
      icon: Map,
      title: domain.heading,
      body: (
        <div className="flex flex-col gap-3" data-testid="words-domain">
          <p className="max-w-prose leading-relaxed text-card-foreground">{d.lead}</p>
          {d.parts.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {d.parts.map((part, k) => (
                <li key={k} className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5 text-sm text-card-foreground">
                  <Sprout className="size-3.5 shrink-0 text-notice" aria-hidden="true" />
                  {part}
                </li>
              ))}
            </ul>
          )}
        </div>
      ),
    });
  }
  // DELIVERABLES (the lead, 19 Nov 2026): the dated outcomes as a timeline, and what the role answers for beside it.
  // "Looks after" above stays the day-to-day. With no dated deliverables the list reads as it did.
  const count = word("accountabilities");
  const dated = p.sections?.deliverables ?? [];
  const deliverablesTitle = t({ message: "Deliverables", context: "role card: the dated outcomes" });
  if (count || dated.length) {
    pieces.push({
      key: "accountabilities",
      tab: t({ message: "Deliverables", context: "role card: the dated outcomes" }),
      icon: Handshake,
      title: dated.length ? deliverablesTitle : (count?.heading ?? deliverablesTitle),
      body: (
        <div className="flex flex-col gap-5">
          {dated.length > 0 && (
            <Suspense fallback={null}>
              <DeliverablesGantt rows={dated} label={deliverablesTitle} />
            </Suspense>
          )}
          {count && (
            <div data-testid="words-accountabilities">
              {dated.length > 0 && <Sub as={SubH}>{count.heading}</Sub>}
              <Tiles lines={count.lines} icon={Handshake} />
            </div>
          )}
        </div>
      ),
    });
  }
  const auth = word("authorities");
  if (auth) pieces.push({ key: "authorities", tab: t({ message: "Decides", context: "founding card piece, short" }), icon: KeyRound, title: auth.heading, body: <div data-testid="words-authorities"><Tiles lines={auth.lines} icon={KeyRound} /></div> });
  // Bring me sits beside Decides and Deliverables (the lead, 19 Nov 2026): what is expected of whoever holds it.
  if (p.bringMe.length) pieces.push({ key: "bringMe", tab: t({ message: "Bring me", context: "founding card piece, short" }), icon: Handshake, title: W.bringMe, body: <div data-testid="words-bringMe"><Tiles lines={p.bringMe} icon={Handshake} /></div> });
  // Rhythm: the sessions everyone attends first (`org.role_card_rhythm`), then the role's own.
  const resp = word("responsibilities");
  if (resp || shared.rhythm.length) {
    pieces.push({
      key: "responsibilities",
      tab: t({ message: "Rhythm", context: "founding card piece, short" }),
      icon: CalendarDays,
      title: t({ message: "Rhythm", context: "founding card piece heading" }),
      body: (
        <div className="flex flex-col gap-5">
          {shared.rhythm.length > 0 && (
            <div data-testid="shared-rhythm">
              <Sub as={SubH}>{t({ message: "Sessions everyone attends", context: "role card: the village's shared sessions" })}</Sub>
              <Suspense fallback={null}>
                <Rhythm lines={shared.rhythm} />
              </Suspense>
            </div>
          )}
          {resp && (
            <div data-testid="words-responsibilities">
              {shared.rhythm.length > 0 && <Sub as={SubH}>{resp.heading}</Sub>}
              <Suspense fallback={null}>
                <Rhythm lines={resp.lines} />
              </Suspense>
            </div>
          )}
        </div>
      ),
    });
  }

  const bg = p.sections?.idealBackground ?? [];
  const qualities = p.sections?.qualities ?? [];
  if (bg.length || qualities.length) {
    pieces.push({
      key: "who",
      tab: t({ message: "Who we hope for", context: "founding card piece, short" }),
      icon: UserRound,
      title: t({ message: "Who we hope for", context: "founding card piece heading" }),
      body: (
        <div className="grid gap-5 @4xl:grid-cols-2">
          {bg.length > 0 && (
            <div data-testid="ideal-background">
              <Sub as={SubH}>{SECTION_WORDS.idealBackground}</Sub>
              <Tiles lines={bg} icon={BadgeCheck} />
            </div>
          )}
          {qualities.length > 0 && (
            <div data-testid="qualities">
              <Sub as={SubH}>{SECTION_WORDS.qualities}</Sub>
              <Tiles lines={qualities} icon={Sprout} />
            </div>
          )}
        </div>
      ),
    });
  }
  if (p.pay) pieces.push({ key: "rewards", tab: t({ message: "Rewards", context: "founding card piece, short" }), icon: Coins, title: SECTION_WORDS.payShape, body: p.pay });
  pieces.push({
    key: "chosen",
    tab: t({ message: "How you're chosen", context: "founding card piece, short" }),
    icon: Sprout,
    title: t({ message: "How you're chosen", context: "founding card piece heading" }),
    sub: t({ message: "The goals it moves and the conversations on the way in", context: "founding card piece, under the heading" }),
    body: <RoleCardParams seat={chosenSeat} />,
  });
  // What the role proposes and its circle consents to (the lead, 19 Nov 2026), named by the circle.
  const goesToHeading = p.circleName
    ? t({ message: `Goes to the ${p.circleName}`, context: "role card: what goes to the circle for consent" })
    : t({ message: "Goes to the circle", context: "role card: what goes to the circle for consent" });
  if (p.holding.length || p.companion || p.notMine.length) {
    pieces.push({
      key: "holding",
      tab: t({ message: "Holding it well", context: "founding card piece, short" }),
      icon: ShieldCheck,
      title: W.holdingWell,
      body: (
        <div className="flex flex-col gap-5">
          {p.holding.length > 0 && (
            <dl className="grid gap-3 @2xl:grid-cols-3" data-testid="holding-well">
              {p.holding.map((h) => (
                <div key={h.key} className="rounded-xl border border-border bg-muted p-3.5">
                  <dt className="text-sm font-semibold text-notice">{h.heading}</dt>
                  <dd className="mt-1 leading-relaxed text-card-foreground">{h.text}</dd>
                </div>
              ))}
            </dl>
          )}
          {p.companion}
          {p.notMine.length > 0 && (
            <div data-testid="words-notMine">
              <Sub as={SubH}>{goesToHeading}</Sub>
              <Tiles lines={p.notMine} icon={ShieldCheck} />
            </div>
          )}
        </div>
      ),
    });
  }

  // "Once you're selected" (the lead, 19 Nov 2026): the card's own onboarding steps, else the village's.
  const onboarding = onboardingFor(p.sections?.onboarding, shared);
  if (onboarding.length) {
    pieces.push({
      key: "onboarding",
      tab: t({ message: "Once you're selected", context: "role card: the onboarding steps" }),
      icon: BadgeCheck,
      title: t({ message: "Once you're selected", context: "role card: the onboarding steps" }),
      body: (
        <Suspense fallback={null}>
          <OnboardingSteps lines={onboarding} />
        </Suspense>
      ),
    });
  }

  return (
    // Laid out by the CARD's width, never the screen's (container queries): the same card sits across
    // the page on /roles, in an application's narrow column and on a decider's page.
    <div className="@container">
    <div className="grid @4xl:grid-cols-[19rem_minmax(0,1fr)]">
      <header className="flex flex-col gap-4 border-b border-border bg-muted/40 p-5 @lg:p-6 @4xl:border-b-0 @4xl:border-r">
        <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-3 @md:grid-cols-[7.5rem_minmax(0,1fr)] @md:gap-4 @4xl:grid-cols-1">
          <div className="relative aspect-[4/5] max-w-full overflow-hidden rounded-2xl border border-notice/40">
            <ArtImage portrait src={art} className="absolute inset-0" imgClassName="object-top motion-safe:transition-transform motion-safe:duration-[2000ms] motion-safe:hover:scale-105" />
            {open && (
              <span className="absolute left-2.5 top-2.5 hidden items-center gap-1.5 rounded-full border border-notice bg-background/80 @md:inline-flex px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-widest text-notice" data-testid="open-seat">
                <span className="size-1.5 rounded-full bg-notice motion-safe:animate-pulse" aria-hidden="true" />
                {t({ message: "Open role", context: "founding card: nobody holds this role yet" })}
              </span>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            {p.circleName && <p className={EYEBROW}>{p.circleName}</p>}
            <Title className="font-display text-xl leading-tight text-card-foreground @md:text-2xl @lg:text-3xl">{String(seat?.name ?? "")}</Title>
            <RootsSlot roots={roots} />
            {p.sections?.paid && <p className="font-semibold text-notice" data-testid="paid-role-line">{paidRoleLine(i18n)}</p>}
          </div>
        </div>
        {facts.length > 0 && (
          <dl className="grid grid-cols-2 gap-2" data-testid="card-facts">
            {facts.map((f) => (
              <div key={f.label} className="min-w-0 rounded-xl bg-card px-3 py-2.5">
                <dt className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                  <f.icon className="size-3.5 text-notice" aria-hidden="true" />
                  {f.label}
                </dt>
                <dd className="mt-0.5 break-words text-sm font-semibold leading-snug text-card-foreground">{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {p.wide && p.act && (
          <div className="mt-auto">
            {p.act}
            <p className={`mt-2 text-center ${HINT}`}>{t({ message: "No account needed.", context: "full role card, under the one act" })}</p>
          </div>
        )}
      </header>
      <div className="min-w-0 p-5 @lg:p-7">
        <RolePieces pieces={pieces} level={lifted ? 3 : 4} after={p.after} initialAll={p.allPieces} marks={p.marks} />
      </div>
    </div>
    </div>
  );
}
