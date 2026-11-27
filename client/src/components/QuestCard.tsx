/**
 * The quest card: a poster, a promise, and nothing else to operate.
 *
 * Ported lesson from the sibling game's three quest-page redesigns: the card
 * is tier one of a disclosure ladder. It draws the eye and states the offer;
 * reading and doing happen on the quest's own page. So the whole card is one
 * link, there are no buttons on it, and the only numbers it shows are alive
 * (a zero renders as silence, never as "0 in the field").
 *
 * A quest with no poster image paints a scene from its circle via
 * questScene(), so the board is colorful on day one of a fork with zero
 * uploaded art, and re-themes itself when the village picks a brand seed.
 */
import { Link } from "wouter";
import { useState } from "react";
import {
  ArrowRight, Baby, BookOpen, Brush, Calendar, Camera, CheckCircle2, ChefHat,
  Clock, Compass, Home, Laptop, Leaf, Music,
  Sprout, TreePine,
} from "lucide-react";
import { Bloom, Canopy, MushroomNetwork, TendingHands } from "@/components/sacred/living";
import type { QuestClaim } from "@/lib/gameApi";
import WorkPayBlock from "@/components/WorkPayBlock";
import RootTags from "@/components/roots/RootTags";
import {
  gateLabel, questScene, sceneGradient, statusIs, type BoardQuest, type QuestSigns,
} from "@/lib/questBoard";
import { statusFor } from "@/lib/questStatus";
import { PlantGlyph } from "@/components/openWork/StatusMark";
import { useStatusWords } from "@/components/openWork/statusWords";
import { usePlaceWords } from "@/components/openWork/placeWords";
import { useLingui, Trans } from "@lingui/react/macro";
import { Gauge, MapPin, Target } from "lucide-react";
import { questFit, type QuestFit } from "@shared/commitment";
import ExampleStamp from "@/components/openWork/ExampleStamp";

export const QUEST_ICONS: Record<string, React.ElementType> = {
  Users: MushroomNetwork, Sprout, ChefHat, TreePine, BookOpen, Home, Camera, Baby, Laptop,
  Leaf, Hammer: TendingHands, Brush, Music, ShieldCheck: Canopy, Star: Bloom, Calendar, Compass,
};

export const iconFor = (name: string | null | undefined): React.ElementType =>
  QUEST_ICONS[String(name ?? "")] ?? Bloom;

/*
 * SEMANTIC TOKENS ONLY (night-contrast lane, 2026-11-11). The board stands in
 * the sheet's night world and the quest's own page does not, and these chips
 * are drawn on both. The brand and palette inks they used (`text-sage`,
 * `text-teal-700`, `text-teal-deep`) are dark by design: on the night card the
 * sage chip measured 2.52:1 and "See the quest" 1.58:1. `open`, `notice` and
 * `foreground` re-theme with the ground they land on and clear AA on both.
 */
export const difficultyColors: Record<string, string> = {
  Beginner: "bg-open/10 text-open",
  Intermediate: "bg-notice/10 text-notice",
  Advanced: "border border-border bg-muted text-foreground",
};

const CLAIM_CHIP: Record<string, { label: string; cls: string }> = {
  claimed: { label: "In progress", cls: "bg-notice text-background" },
  submitted: { label: "Turned in", cls: "bg-card text-foreground" },
  consented: { label: "Complete", cls: "bg-open text-background" },
};

export function QuestPoster({
  quest,
  className = "",
  children,
  priority = false,
}: {
  quest: BoardQuest;
  className?: string;
  children?: React.ReactNode;
  /** The one poster above the fold loads eagerly; the rest stay lazy. */
  priority?: boolean;
}) {
  const Icon = iconFor(quest.icon);
  const scene = questScene(quest.circle);
  // Poster art lives in the uploads volume, so a village that cloned a seed
  // without the files, or an admin who mistyped a path, has an image URL that
  // resolves to nothing. Falling back to the circle's scene means that reads
  // as a quest board with no art yet, which is the designed state, instead of
  // a broken image icon.
  const [broken, setBroken] = useState(false);
  const showImage = !!quest.imageUrl && !broken;
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {showImage ? (
        <img
          src={quest.imageUrl as string}
          alt=""
          loading={priority ? "eager" : "lazy"}
          onError={() => setBroken(true)}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 transition-transform duration-500 group-hover:scale-105"
          style={{ backgroundImage: sceneGradient(scene) }}
        />
      )}
      {!showImage && (
        <Icon
          aria-hidden="true"
          className="absolute -right-5 -bottom-6 w-32 h-32 text-white/15 rotate-6"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
      {children}
    </div>
  );
}

export default function QuestCard({
  quest,
  claim,
  signs,
  stages,
  goal = null,
  priority = false,
  memberPct = null,
}: {
  quest: BoardQuest;
  claim?: QuestClaim;
  signs?: QuestSigns;
  stages?: { id: string; name: string }[] | null;
  /** The season goal this quest grows, when the season still holds it (goal threads, decision 5). */
  goal?: { id: string; text: string } | null;
  priority?: boolean;
  /** What the reader says they can give now (0383), or null. The card says whether the quest fits it, for them alone. */
  memberPct?: number | null;
}) {
  const { t } = useLingui();
  const Icon = iconFor(quest.icon);
  // The status mark: seed (open), sprout (underway), flower (done this moon),
  // from the village's own life signs (lib/questStatus.ts). It describes the
  // work, and it is the only piece of the nature layer on the board.
  const status = statusFor(signs);
  const statusWords = useStatusWords();
  const goalText = goal?.text ?? "";
  const placeWords = usePlaceWords();
  const chip = claim && claim.status !== "declined" ? CLAIM_CHIP[claim.status] : null;
  const gate = gateLabel(quest, stages);
  const commitment = typeof quest.commitmentPct === "number" ? quest.commitmentPct : null;
  const fit = questFit(commitment, memberPct);
  const fitWords: Record<QuestFit, string> = {
    fits: t({ message: "Fits what you can give", context: "open work card: the quest's size beside the reader's own percent" }),
    easier: t({ message: "Easier", context: "open work card: the quest asks less than the reader can give" }),
    harder: t({ message: "Harder", context: "open work card: the quest asks more than the reader can give" }),
  };
  const active = signs?.active ?? 0;
  const done = signs?.done ?? 0;

  // A gated quest reads differently, so the gate belongs in the link's name: a
  // screen reader user should not have to open the card to learn the quest is
  // not open to them yet.
  // An example says so in the name too: the stamp's own words sit inside this
  // link, and a link's aria-label replaces what is inside it.
  const example = !!quest.isExample;
  const exampleWords = t({ message: "Example quest", context: "the example stamp, read aloud" });
  const linkLabel = [quest.title, example ? exampleWords : null, gate].filter(Boolean).join(", ");

  // A STRETCHED LINK (QA round 2, 27 Nov 2026). The whole card still opens the quest, through one link laid over it,
  // and the roots row sits above that layer, so a tap on a root opens what the root means instead of the quest. The
  // card used to be one link around everything, and a tip cannot live inside a link: on touch the tap is the link's,
  // so a phone reader never met a root's meaning anywhere on the board. (A line comment here, and not a block comment
  // inside the JSX, which the build keeps: it pushed this module over the small-group size and out into a chunk.)
  return (
    <article className="group relative h-full flex flex-col bg-card rounded-2xl border border-border shadow-sm overflow-hidden transition-shadow duration-300 hover:shadow-lg">
      <Link
        href={`/quests/${quest.id}`}
        className="absolute inset-0 z-[1] rounded-2xl focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        aria-label={linkLabel}
      />
      <QuestPoster quest={quest} className="aspect-[5/2]" priority={priority}>
        <div className="absolute top-3 left-3 w-9 h-9 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="absolute top-3 right-3 flex gap-1.5">
          {statusIs(quest, "seasonal") && !chip && (
            <span className="px-2 py-0.5 rounded-full bg-white/85 text-teal-deep text-[10px] font-bold uppercase tracking-wide">
              <Trans context="QuestCard, span">Seasonal
            </Trans></span>
          )}
          {chip && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${chip.cls}`}>
              {chip.label}
            </span>
          )}
        </div>
        {/* The example stamp (the lead, 24 Nov 2026), across the poster
            and clear of the icon, the chips and the title. */}
        {example && (
          <div className="absolute inset-x-0 top-1/3 flex -translate-y-1/2 justify-center">
            <ExampleStamp />
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="font-display text-lg font-bold text-white leading-snug drop-shadow-sm">
            {quest.title}
          </h3>
          {quest.circle && (
            <p className="text-white/80 text-xs mt-0.5">{quest.circle}</p>
          )}
        </div>
      </QuestPoster>

      <div className="p-4 flex-1 flex flex-col gap-2.5">
        {quest.subtitle ? (
          <p className="text-sm text-foreground/80 italic leading-relaxed">{quest.subtitle}</p>
        ) : (
          quest.description && (
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
              {quest.description}
            </p>
          )
        )}

        {/* The goal thread: which season goal this work grows. */}
        {goal && (
          <p className="inline-flex items-start gap-1.5 text-sm font-medium text-foreground" data-goal={goal.id}>
            <Target className="mt-0.5 w-4 h-4 shrink-0 text-open" aria-hidden="true" />
            <span>{t({ message: `Grows: ${goalText}`, context: "open work card: the season goal this quest grows" })}</span>
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* What the quest is worth and pays, or to inquire (0265). Never Gratitude, which pays no quest. */}
          <WorkPayBlock pay={quest.pay} />
          {quest.duration && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              {quest.duration}
            </span>
          )}
          {commitment !== null && (
            <span className="inline-flex items-center gap-1 text-muted-foreground" data-commitment-pct={commitment}>
              <Gauge className="w-3.5 h-3.5" aria-hidden="true" />
              {t({ message: `${commitment}% of you`, context: "open work card: how much of a person the quest asks" })}
            </span>
          )}
          {fit && (
            <span className={`px-2 py-0.5 rounded-full font-medium ${fit === "harder" ? "bg-muted text-muted-foreground" : "bg-open/15 text-open"}`} data-fit={fit}>
              {fitWords[fit]}
            </span>
          )}
          {quest.place && (
            <span className="inline-flex items-center gap-1 text-muted-foreground" data-place={quest.place}>
              <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
              {placeWords[quest.place]}
            </span>
          )}
          {quest.difficulty && (
            <span className={`px-2 py-0.5 rounded-full font-medium ${difficultyColors[quest.difficulty] ?? "bg-muted text-muted-foreground"}`}>
              {quest.difficulty}
            </span>
          )}
        </div>

        {/* The roots it grows from, drawn as small roots (shared/archetypeRoots.ts). */}
        {/* Above the card's link layer, so each root's meaning opens on a tap (RootTags, InfoTip). */}
        {quest.archetypes?.length ? <RootTags roots={quest.archetypes} size="sm" className="relative z-10 w-fit" /> : null}

        {(active > 0 || done > 0) && (
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {active > 0 && (
              <span className="inline-flex items-center gap-1 font-medium text-open">
                <MushroomNetwork className="w-3.5 h-3.5" />
                {active === 1
                  ? t({ message: "1 hand on this", context: "open work card: one person carries this quest now" })
                  : t({ message: `${active} hands on this`, context: "open work card: people carrying this quest now" })}
              </span>
            )}
            {done > 0 && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Trans context="QuestCard, span"><CheckCircle2 className="w-3.5 h-3.5" />
                {done} completed
              </Trans></span>
            )}
          </div>
        )}

        {gate && (
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-notice">
            <Sprout className="w-3.5 h-3.5" />
            {gate}
          </p>
        )}

        {/* "Open: nobody carries it yet" would promise work an example
            cannot give, so an example says what it is instead. */}
        {example ? (
          <p className="text-xs text-muted-foreground" data-status="example">
            {t({ message: "An example of the work to come. It cannot be taken yet.", context: "open work card: in place of the status mark on an example quest" })}
          </p>
        ) : (
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" data-status={status}>
            <PlantGlyph state={status} className="size-5" />
            {statusWords[status]}
          </p>
        )}

        <div className="mt-auto pt-2 flex items-center justify-between text-sm font-semibold text-notice">
          <span><Trans context="QuestCard, span">See the quest</Trans></span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </article>
  );
}
