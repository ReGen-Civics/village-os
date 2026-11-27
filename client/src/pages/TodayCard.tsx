/**
 * /profile/today-card: PULL A CARD (the lead, 27 Nov 2026; shared/myCard.ts says what the card is).
 *
 * One card a day, drawn from the member's own chart. It waits face down on a back of sacred geometry until
 * they draw it; then it turns over, the seed of life behind it opens its petals once, focus moves to the day's
 * focus line, and the reading sits beside it:
 *
 *   1. the card: the sphere drawn with its glyph, its gate and line, the line's word, and how today's sky
 *      touches it;
 *   2. today's focus, in a line written for the day;
 *   3. the reading, three labelled rows of two sentences at most (the lead: bullets, not paragraphs): the sky
 *      and your card, your design today, what waits on you. In the platform's plain words, or the village
 *      guide's once the member has said yes;
 *   4. today in the village: decisions, quests in hand, tasks, asks, sessions and gatherings, each a door;
 *   5. the moon and the season, and the day's sky in a fold.
 *
 * The draw waits for what is going on today to be read (a few seconds at most), so the card is never drawn
 * saying nothing waits on a member who has work waiting; a plain card opened again later picks up the day's
 * counts as they are then.
 *
 * Opened again the same day, the card is already face up: the same card. A new one at midnight.
 *
 * A member with no lines yet sees the deck face down and dimmed, with the door to find their lines.
 *
 * The guide's one tap sits under the reading when the member has not said yes, naming who runs the model and
 * who holds the key (server/lib/companionConsent.ts `cardDisclosure`); until they tap it nothing of theirs is
 * sent anywhere. Keep in my journal saves the day's card to their private journal; Share sends only the
 * card's name and focus, never a gate or anything else of the chart.
 *
 * Phone first: the card, then the words, one column. From `md` the card stands on the left and the words read
 * beside it. Reduced motion lands the card face up with the petals already open.
 */
import { useEffect, useId, useRef, useState, type ComponentType } from "react";
import { Link } from "wouter";
import { Trans, useLingui } from "@lingui/react/macro";
import { CalendarClock, Compass, HandHelping, ListChecks, NotebookPen, RotateCcw, Scale, Share2, Sparkles, Users } from "lucide-react";
import Layout from "@/components/Layout";
import BreathingLoader from "@/components/natural/BreathingLoader";
import ModuleGate, { SignInToSee } from "@/components/modules/ModuleGate";
import { useAuth } from "@/contexts/AuthContext";
import { moduleIsOn, useModules } from "@/modules/ModuleProvider";
import { useReducedMotion } from "@/components/natural/useReducedMotion";
import { Fireflies, MoonPhase, SeedOfLife } from "@/components/journey/nature";
import { DaySun, GoldenSpiral, Labyrinth, Lotus, NightMoon, SeedOfLife as SeedGlyph, Tripoint, Triad, Vesica, type GlyphProps } from "@/components/sacred/glyphs";
import LineBars from "@/components/sessionCard/LineBars";
import { BTN_NOTICE, BTN_PRIMARY, BTN_SECONDARY, CARD, CHIP, CHIP_SOFT, EYEBROW, H1, H2, HINT, LINK, NOTE, STATEMENT, TILE, WORLD } from "@/components/journey/look";
import { useGuideName } from "@/hooks/useGuideName";
import { gameFetch } from "@/lib/gameApi";
import { consentToCard, localDate, pullTodayCard, readTodayCard, TodayCardRefusal } from "@/lib/todayCardApi";
import { useTodayFacts, type TodayRow, type TodayRowKind } from "@/components/todayCard/useTodayFacts";
import { READING_ROWS, timeLine, type CardConsent, type DrawnCard, type MyCard, type ReadingRow } from "@shared/myCard";
import type { Sphere } from "@shared/geneKeys";

type Phase = { kind: "reading" } | { kind: "no-lines" } | { kind: "down" } | { kind: "drawing" } | { kind: "up"; fresh: boolean };

/** How long the draw waits for the day's doors before it goes without them. */
export const FACTS_WAIT_MS = 4000;

/** Each sphere's glyph from the sacred set (components/sacred/glyphs.tsx): eleven spheres, nine shapes. */
const SPHERE_GLYPH: Record<Sphere, ComponentType<GlyphProps>> = {
  lifesWork: DaySun,
  evolution: GoldenSpiral,
  radiance: Lotus,
  purpose: Tripoint,
  attraction: NightMoon,
  iq: Triad,
  eq: Vesica,
  sq: Lotus,
  core: Labyrinth,
  culture: SeedGlyph,
  pearl: GoldenSpiral,
};

/** The card itself: a back of sacred geometry, and a face that turns over when it is drawn. */
function TheCard({ card, up, drawing, dim = false, onDraw, dateWords }: { card: DrawnCard | null; up: boolean; drawing: boolean; dim?: boolean; onDraw?: () => void; dateWords: string }) {
  const { t } = useLingui();
  const touchWords: Record<Exclude<DrawnCard["touch"], null> | "none", string> = {
    sun: t({ message: "Sun-lit", context: "today's card: the chip on the card, today's Sun stands in its gate" }),
    earth: t({ message: "Earth-held", context: "today's card: the chip on the card, today's Earth stands in its gate" }),
    moon: t({ message: "Moon-lit", context: "today's card: the chip on the card, the Moon passes its gate today" }),
    channel: t({ message: "Sky-linked", context: "today's card: the chip on the card, today's sky completes a channel from it" }),
    none: t({ message: "Steady", context: "today's card: the chip on the card, today's sky leaves it alone" }),
  };
  const lit = !!card?.touch;
  const Glyph = card ? SPHERE_GLYPH[card.sphere] : null;
  const back = (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border-2 border-notice/60 bg-muted p-4 shadow-sm [backface-visibility:hidden]">
      <span aria-hidden="true" className="pointer-events-none absolute inset-2 rounded-xl border border-notice/30" />
      <SeedOfLife total={7} walked={7} label="" size="md" className={drawing ? "motion-safe:animate-pulse" : ""} />
      <span className="text-xs font-semibold uppercase tracking-widest text-notice">
        <Trans context="today's card: the back of the card">Today's card</Trans>
      </span>
    </div>
  );
  const face =
    card && Glyph ? (
      <div
        className={`absolute inset-0 isolate flex flex-col overflow-hidden rounded-2xl border-2 p-4 text-card-foreground shadow-sm [backface-visibility:hidden] [transform:rotateY(180deg)] ${lit ? "border-notice" : "border-notice/60"}`}
        data-today-card-face={card.sphere}
      >
        {/* An opaque ground under the face, so the bloom behind the card never shows through it in light mode. */}
        <span aria-hidden="true" className="absolute inset-0 -z-10 rounded-2xl bg-background" />
        <span aria-hidden="true" className="absolute inset-0 -z-10 rounded-2xl bg-card" />
        <span aria-hidden="true" className="pointer-events-none absolute inset-2 rounded-xl border border-notice/30" />
        <div className="relative flex items-center justify-between gap-2">
          <span className={lit ? CHIP : CHIP_SOFT}>{touchWords[card.touch ?? "none"]}</span>
          <span className="font-display text-sm lining-nums text-muted-foreground">
            {card.gate}.{card.line}
          </span>
        </div>
        <div className="relative flex flex-1 flex-col items-center justify-center gap-1 text-center">
          <Glyph className="size-11 text-notice" />
          <span className="font-display text-6xl leading-none lining-nums text-notice">{card.gate}</span>
          <LineBars line={card.line} className="h-10 w-9" label={t({ message: `Line ${card.line} of 6`, context: "today's card: the line bars on the card, read aloud" })} />
          <span className="font-display text-3xl leading-tight text-foreground">{card.name}</span>
          {card.word ? <span className="text-sm italic text-muted-foreground">{card.word}</span> : null}
        </div>
        <p className="relative text-center text-xs uppercase tracking-widest text-muted-foreground">{dateWords}</p>
      </div>
    ) : null;

  const body = (
    <div className={`mx-auto w-60 [perspective:1000px] sm:w-64 ${dim ? "opacity-60" : ""}`}>
      <div
        className={`relative aspect-[5/7] w-full [transform-style:preserve-3d] motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-out ${up ? "[transform:rotateY(180deg)]" : drawing ? "motion-safe:-translate-y-2" : ""}`}
      >
        {back}
        {face}
      </div>
    </div>
  );
  if (up || !onDraw) return <div aria-hidden={up ? undefined : "true"}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onDraw}
      disabled={drawing}
      className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring disabled:cursor-wait"
      aria-label={t({ message: "Draw today's card", context: "today's card: the face down card, read aloud" })}
    >
      {body}
    </button>
  );
}

const ROW_ICONS: Record<TodayRowKind, ComponentType<{ className?: string }>> = {
  decision: Scale,
  quest: Compass,
  task: ListChecks,
  ask: HandHelping,
  session: CalendarClock,
  gathering: Users,
};

function timeWords(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  } catch {
    return "";
  }
}

function TodayRows({ rows }: { rows: TodayRow[] }) {
  const { t } = useLingui();
  const words = (r: TodayRow): { kicker: string; title: string } => {
    const at = timeWords(r.at);
    switch (r.kind) {
      case "decision":
        return {
          kicker: t({ message: "Waiting on you", context: "today's card: in the village today, a decision" }),
          title: r.count === 1 ? t({ message: "A decision waits on you", context: "today's card: in the village today" }) : t({ message: "Decisions wait on you", context: "today's card: in the village today" }),
        };
      case "quest":
        return { kicker: t({ message: "Quest in hand", context: "today's card: in the village today" }), title: r.title ?? "" };
      case "task":
        return {
          kicker: t({ message: "From your sessions", context: "today's card: in the village today, tasks" }),
          title: r.count === 1 ? t({ message: "One task waiting", context: "today's card: in the village today" }) : t({ message: `${r.count} tasks waiting`, context: "today's card: in the village today" }),
        };
      case "ask":
        return {
          kicker: t({ message: "Asked of you", context: "today's card: in the village today, asks" }),
          title: r.count === 1 ? t({ message: "One ask from another member", context: "today's card: in the village today" }) : t({ message: `${r.count} asks from other members`, context: "today's card: in the village today" }),
        };
      case "session":
        return {
          kicker: at ? t({ message: `Session today · ${at}`, context: "today's card: in the village today" }) : t({ message: "Session open now", context: "today's card: in the village today" }),
          title: r.title ?? "",
        };
      case "gathering":
        return { kicker: at ? t({ message: `Gathering today · ${at}`, context: "today's card: in the village today" }) : t({ message: "Gathering today", context: "today's card: in the village today" }), title: r.title ?? "" };
    }
  };
  return (
    <ul className="grid gap-2">
      {rows.map((r) => {
        const Icon = ROW_ICONS[r.kind];
        const w = words(r);
        return (
          <li key={r.key}>
            <Link href={r.href} className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-muted px-3 py-2 text-foreground hover:border-notice focus-visible:outline-2 focus-visible:outline-ring">
              <Icon aria-hidden="true" className="size-5 shrink-0 text-notice" />
              <span className="min-w-0">
                <span className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground">{w.kicker}</span>
                <span className="block break-words text-sm font-medium">{w.title}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** The reading: three labelled rows, each two sentences at most. */
function Reading({ card, guide, headingId }: { card: MyCard; guide: string; headingId: string }) {
  const { t } = useLingui();
  const labels: Record<ReadingRow, string> = {
    sky: t({ message: "The sky and your card", context: "today's card: the reading's first row" }),
    design: t({ message: "Your design today", context: "today's card: the reading's second row" }),
    waits: t({ message: "What waits on you", context: "today's card: the reading's third row" }),
  };
  return (
    <>
      <p className={EYEBROW}>
        {card.reading.source === "guide"
          ? t({ message: `Read by ${guide}`, context: "today's card: the reading's eyebrow, woven by the village guide" })
          : t({ message: "Your chart today", context: "today's card: the reading's eyebrow, in plain words" })}
      </p>
      <h2 id={headingId} className={`mt-1 ${H2}`}>
        <Trans context="today's card: the reading's heading">Your day, read</Trans>
      </h2>
      <ul className="mt-4 grid gap-3" data-today-card-reading={card.reading.source}>
        {READING_ROWS.map((k) => (
          <li key={k} className="border-l-2 border-notice/60 pl-3">
            <span className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground">{labels[k]}</span>
            <span className="mt-0.5 block text-base leading-relaxed text-foreground">{card.reading[k]}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** The one tap: the guide may read the member's lines, and the provider line, together. */
function GuideAsk({ line, guide, onYes, busy }: { line: Extract<CardConsent, { state: "ask" }>; guide: string; onYes: () => void; busy: boolean }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <section className={TILE} aria-labelledby="today-card-ask" data-today-card-ask="">
      <h3 id="today-card-ask" className="font-display text-xl text-foreground">
        <Trans context="today's card: the guide's ask, heading; {guide} is the village guide's name">Let {guide} read your card</Trans>
      </h3>
      <p className={`mt-1 ${NOTE}`}>{line.sentence}</p>
      <p className={`mt-1 ${HINT}`}>
        <Trans context="today's card: the guide's ask; {guide} is the village guide's name">
          This also lets {guide} use your lines, the same yes as in your Gene Keys controls, where you can take it back.
        </Trans>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={BTN_NOTICE} disabled={busy} onClick={onYes}>
          <Sparkles aria-hidden="true" className="size-4" />
          <Trans context="today's card: the guide's ask, the yes">Yes, read my card</Trans>
        </button>
        <button type="button" className={BTN_SECONDARY} onClick={() => setHidden(true)}>
          <Trans context="today's card: the guide's ask, the no">Not now</Trans>
        </button>
      </div>
    </section>
  );
}

export default function TodayCardPage() {
  const { t, i18n } = useLingui();
  const base = useId();
  const { user } = useAuth();
  const modules = useModules();
  const on = moduleIsOn(modules, "gene-keys") && modules.loaded;
  const journalOn = moduleIsOn(modules, "journal");
  const still = useReducedMotion();
  const guide = useGuideName().name;
  const [date] = useState(() => localDate());
  const [phase, setPhase] = useState<Phase>({ kind: "reading" });
  const [card, setCard] = useState<MyCard | null>(null);
  const [consent, setConsent] = useState<CardConsent>({ state: "none" });
  const [problem, setProblem] = useState<{ words: string; retry: "draw" | "reread" | "keep" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [kept, setKept] = useState<"no" | "saving" | "yes">("no");
  const [shared, setShared] = useState(false);
  const [waited, setWaited] = useState(false);
  const focusRef = useRef<HTMLHeadingElement>(null);
  const refreshed = useRef(false);
  const today = useTodayFacts(on && !!user);

  const signedIn = !!user;
  useEffect(() => {
    if (!on || !signedIn) return;
    let live = true;
    readTodayCard(date)
      .then((a) => {
        if (!live) return;
        setConsent(a.consent);
        setCard(a.card);
        setPhase(a.card ? { kind: "up", fresh: false } : { kind: "down" });
      })
      .catch((e) => {
        if (!live) return;
        if (e instanceof TodayCardRefusal && e.status === 404) setPhase({ kind: "no-lines" });
        else setPhase({ kind: "down" });
      });
    return () => {
      live = false;
    };
  }, [on, signedIn, date]);

  // The draw waits for the day's doors, a few seconds at most.
  useEffect(() => {
    const id = window.setTimeout(() => setWaited(true), FACTS_WAIT_MS);
    return () => window.clearTimeout(id);
  }, []);
  const factsReady = today.ready || waited;

  // After the card turns over, the reader lands on the day's focus.
  useEffect(() => {
    if (phase.kind === "up" && phase.fresh) focusRef.current?.focus();
  }, [phase]);

  const failed = (e: unknown, retry: "draw" | "reread") =>
    setProblem({ words: e instanceof TodayCardRefusal && e.message ? e.message : t({ message: "The card did not turn. Try again.", context: "today's card: a pull that failed" }), retry });

  const take = async () => {
    const a = await pullTodayCard(date, today.ready ? today.facts : null);
    setConsent(a.consent);
    setCard(a.card);
    return a;
  };

  // A plain card kept from earlier today picks up the day's counts once they are read, so its last row is current.
  useEffect(() => {
    if (refreshed.current || phase.kind !== "up" || phase.fresh || !today.ready || card?.reading.source !== "plain") return;
    refreshed.current = true;
    void take().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, today.ready, card]);

  const dateWords = (() => {
    try {
      return new Intl.DateTimeFormat(i18n.locale || undefined, { weekday: "long", day: "numeric", month: "long" }).format(new Date());
    } catch {
      return date;
    }
  })();

  if (!modules.loaded) {
    return (
      <Layout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <BreathingLoader label={t({ message: "Opening today's card", context: "today's card: loading" })} />
        </div>
      </Layout>
    );
  }
  if (!moduleIsOn(modules, "gene-keys")) return <ModuleGate moduleId="gene-keys" name="Gene Keys" />;
  if (!user) return <SignInToSee moduleId="gene-keys" name="Gene Keys" />;

  const draw = async () => {
    if (!factsReady) return;
    setProblem(null);
    setPhase({ kind: "drawing" });
    try {
      refreshed.current = true;
      await take();
      setPhase({ kind: "up", fresh: true });
    } catch (e) {
      setPhase({ kind: "down" });
      failed(e, "draw");
    }
  };

  const reread = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await take();
    } catch (e) {
      failed(e, "reread");
    } finally {
      setBusy(false);
    }
  };

  const yes = async () => {
    if (consent.state !== "ask") return;
    setBusy(true);
    setProblem(null);
    try {
      const out = await consentToCard(consent);
      setConsent(out.consent);
      await take();
    } catch (e) {
      failed(e, "reread");
    } finally {
      setBusy(false);
    }
  };

  const keepInJournal = async () => {
    if (!card) return;
    setKept("saving");
    setProblem(null);
    const text = [`${card.reading.focus}.`, ...READING_ROWS.map((k) => card.reading[k])].join("\n\n");
    const fail = () => {
      setKept("no");
      setProblem({ words: t({ message: "The card did not save to your journal. Try again.", context: "today's card: keeping it failed" }), retry: "keep" });
    };
    try {
      const res = await gameFetch("/api/journal/entries", {
        method: "POST",
        body: JSON.stringify({
          clientId: `today-card-${card.date}`,
          practice: "free",
          privacy: "private",
          answers: [{ questionKey: "today-card", prompt: t({ message: `Today's card: ${card.card.name}`, context: "today's card: the journal entry's heading" }), text }],
        }),
      });
      if (res.ok) setKept("yes");
      else fail();
    } catch {
      fail();
    }
  };

  const share = async () => {
    if (!card) return;
    // The card's name and focus, and nothing else: no gate, no line, nothing of the chart.
    const text = t({ message: `My card today: ${card.card.name}. ${card.reading.focus}.`, context: "today's card: the words a share sends" });
    try {
      if (typeof navigator.share === "function") await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
      setShared(true);
    } catch {
      // A share the member closed is not a failure.
    }
  };

  const retry = () => {
    if (!problem) return;
    if (problem.retry === "draw") void draw();
    else if (problem.retry === "keep") void keepInJournal();
    else void reread();
  };

  const up = phase.kind === "up";
  const fresh = up && phase.fresh && !still;
  const time = card ? timeLine(card.facts) : today.ready ? timeLine(today.facts) : "";
  const noLines = phase.kind === "no-lines";
  const waitingForDay = !factsReady && phase.kind === "down";

  const problemTile = problem ? (
    <div role="alert" className={`${TILE} flex flex-wrap items-center justify-between gap-3`}>
      <p className="text-base text-foreground">{problem.words}</p>
      <button type="button" className={BTN_SECONDARY} onClick={retry}>
        <RotateCcw aria-hidden="true" className="size-4" />
        <Trans context="today's card: try a failed step again">Try again</Trans>
      </button>
    </div>
  ) : null;

  return (
    <Layout>
      <div className={`${WORLD} pb-32 pt-8 text-foreground`} data-today-card-page={phase.kind}>
        <div className="container max-w-4xl">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className={EYEBROW}>
                <Trans context="today's card: the page's eyebrow">Pull a card</Trans>
              </p>
              <h1 id={`${base}-h`} className={`mt-1 ${H1}`}>
                <Trans context="today's card: the page's heading">Today's card</Trans>
              </h1>
              <p className={`mt-1 ${HINT}`}>{dateWords}</p>
            </div>
            <div className="flex items-center gap-3">
              <MoonPhase size="sm" />
              {time ? <p className="text-sm text-muted-foreground">{time}</p> : null}
            </div>
          </header>

          {phase.kind === "reading" ? (
            <div className="flex min-h-[40vh] items-center justify-center">
              <BreathingLoader label={t({ message: "Opening today's card", context: "today's card: loading" })} />
            </div>
          ) : (
            <div className="mt-6 grid gap-8 md:grid-cols-[18rem_minmax(0,1fr)] md:items-start">
              {/* The card, and its draw. */}
              <div className="relative isolate flex flex-col items-center gap-5 md:sticky md:top-24">
                {fresh ? (
                  // A circle of light gathering behind the card, once, as it lands: a bloom, never a burst.
                  <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-6 -z-10 flex justify-center opacity-40">
                    <SeedOfLife total={7} walked={7} label="" bloom size="lg" />
                  </div>
                ) : null}
                <TheCard
                  card={card?.card ?? null}
                  up={up}
                  drawing={phase.kind === "drawing"}
                  dim={noLines}
                  onDraw={up || noLines || waitingForDay ? undefined : () => void draw()}
                  dateWords={dateWords}
                />
                {noLines ? (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <p className={`max-w-[18rem] ${NOTE}`}>
                      <Trans context="today's card: a member with no lines yet">Find your lines to open your deck.</Trans>
                    </p>
                    <Fireflies>
                      <Link href="/profile/gene-keys" className={BTN_PRIMARY}>
                        <Trans context="today's card: a member with no lines yet, the door">Find your lines</Trans>
                      </Link>
                    </Fireflies>
                  </div>
                ) : !up ? (
                  <div className="flex flex-col items-center gap-2">
                    <Fireflies>
                      <button type="button" className={BTN_PRIMARY} disabled={phase.kind === "drawing" || waitingForDay} onClick={() => void draw()}>
                        <Sparkles aria-hidden="true" className="size-4" />
                        {phase.kind === "drawing"
                          ? t({ message: "Reading the sky", context: "today's card: the draw button while it pulls" })
                          : waitingForDay
                            ? t({ message: "Reading your day", context: "today's card: the draw button while the day's doors are read" })
                            : t({ message: "Draw today's card", context: "today's card: the draw button" })}
                      </button>
                    </Fireflies>
                    <p className={`max-w-[18rem] text-center ${HINT}`}>
                      <Trans context="today's card: under the draw button">One card a day, from your own lines and today's sky. The same card all day.</Trans>
                    </p>
                  </div>
                ) : null}
              </div>

              {/* The reading. */}
              <div className="grid gap-5">
                {problemTile}
                {up && card ? (
                  <>
                    <section aria-labelledby={`${base}-focus`}>
                      {/* The eyebrow's look on a span: the sheet's own h2 rule would otherwise set the face. */}
                      <h2 id={`${base}-focus`} ref={focusRef} tabIndex={-1} className="focus:outline-none">
                        <span className={EYEBROW}>
                          <Trans context="today's card: the focus line's eyebrow">Today's focus</Trans>
                        </span>
                      </h2>
                      <p className={`mt-1 ${STATEMENT}`} data-today-card-focus="" aria-live="polite">
                        {card.reading.focus}
                      </p>
                    </section>

                    <section className={CARD} aria-labelledby={`${base}-reading`}>
                      <Reading card={card} guide={guide} headingId={`${base}-reading`} />
                      <p className={`mt-4 ${HINT}`}>
                        {card.design.type} · {card.design.profile} · {t({ message: `${card.design.authority} authority`, context: "today's card: the member's design under the reading" })}
                      </p>
                      {consent.state === "given" && card.reading.source === "plain" ? (
                        <button type="button" className={`mt-3 ${BTN_SECONDARY}`} disabled={busy} onClick={() => void reread()}>
                          <RotateCcw aria-hidden="true" className="size-4" />
                          {t({ message: `Ask ${guide} to read it`, context: "today's card: weave the reading now" })}
                        </button>
                      ) : null}
                    </section>

                    {consent.state === "ask" ? <GuideAsk line={consent} guide={guide} busy={busy} onYes={() => void yes()} /> : null}

                    <section aria-labelledby={`${base}-village`}>
                      <h2 id={`${base}-village`}>
                        <span className={EYEBROW}>
                          <Trans context="today's card: what waits on the member, heading">Today in the village</Trans>
                        </span>
                      </h2>
                      <div className="mt-2">
                        {today.rows.length ? (
                          <TodayRows rows={today.rows} />
                        ) : (
                          <p className={NOTE}>
                            {today.ready
                              ? t({ message: "Nothing waits on you today. The day is yours to shape.", context: "today's card: in the village today, empty" })
                              : t({ message: "Reading what waits on you", context: "today's card: in the village today, loading" })}
                          </p>
                        )}
                      </div>
                    </section>

                    <details className="rounded-xl border border-border/60 px-4 py-2">
                      <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-foreground">
                        <Trans context="today's card: the fold with the day's sky">Today's sky</Trans>
                      </summary>
                      <p className={`mt-1 ${HINT}`}>{card.lean}</p>
                      <p className={`mt-1 ${HINT}`}>{card.skyLines["human-design"]}</p>
                      <p className={`mt-1 ${HINT}`}>{card.skyLines.western}</p>
                    </details>

                    <div className="flex flex-wrap items-center gap-2">
                      {journalOn ? (
                        kept === "yes" ? (
                          <Link href="/journal" className={LINK}>
                            <Trans context="today's card: after keeping it">Kept in your journal</Trans>
                          </Link>
                        ) : (
                          <button type="button" className={BTN_SECONDARY} disabled={kept === "saving"} onClick={() => void keepInJournal()}>
                            <NotebookPen aria-hidden="true" className="size-4" />
                            <Trans context="today's card: save the day's card to the private journal">Keep in my journal</Trans>
                          </button>
                        )
                      ) : null}
                      <button type="button" className={BTN_SECONDARY} onClick={() => void share()}>
                        <Share2 aria-hidden="true" className="size-4" />
                        {shared
                          ? t({ message: "Shared", context: "today's card: after sharing" })
                          : t({ message: "Share the card", context: "today's card: share only the card's name and focus" })}
                      </button>
                    </div>
                    <p className={HINT}>
                      <Trans context="today's card: under the card">A lens, never a forecast. A new card at midnight.</Trans>
                    </p>
                  </>
                ) : (
                  <section className={CARD}>
                    <p className={NOTE}>
                      <Trans context="today's card: before the draw">
                        Your eleven spheres are your deck. Each day one is drawn, weighed by today's sky, and read against your whole design and what waits on you in the village.
                      </Trans>
                    </p>
                  </section>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
