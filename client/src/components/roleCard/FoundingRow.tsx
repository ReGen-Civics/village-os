/**
 * ONE OPEN FOUNDING ROLE ON THE TEAM SHEET, CLOSED (FoundingLineup.tsx): its painting, "Open role", its name, its aim,
 * its kind and pay mix, the apply-by date and the facts, how full it is, the domains it holds and the related roles it
 * will onboard, with "Read the card". Opened, its card sits inside the same frame (the lead, 21 Nov 2026).
 *
 * PHASE 1 OF THE CARD LOOK PASS (the lead, 23 Nov 2026: "Can we make the image more prominent, give me a few
 * options"). Four looks of the same row, every piece of information in each, the frame the same
 * (rounded-2xl border-2 bg-card shadow-sm):
 *   - thumb     the row as it is: a small square of the painting at the left;
 *   - banner    (A) the painting as a band across the top, about 2:1 on a phone and 3:1 wide, text below;
 *   - side      (B) the painting down the left edge, full height, edge to edge, as the Upcoming roles cards draw it;
 *   - sideband  (B on a phone) the same, with the painting as a tall band on top below 640px;
 *   - portrait  (C) a framed 3:4 portrait, 140px on a phone and 200px wide, beside the name.
 * TEMPORARY: `shotLook` reads the look from the address (?cardlook=, ?cardpolish=) so one build can be
 * photographed every way. Phase 2 keeps the chosen look and removes the rest and the address switch.
 */
import type { ReactNode } from "react";
import { ArrowRight, CalendarClock, Clock, MapPin, Users } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import type { RoleFill } from "@shared/commitmentRange";
import ArtImage from "@/components/roleDraft/ArtImage";
import { Domains, FillMeter, NO_POLISH, OpenPill, ToBeAdded, type CardPolish } from "./lineupParts";

export type CardLook = "thumb" | "banner" | "side" | "sideband" | "portrait";
const LOOKS: readonly CardLook[] = ["thumb", "banner", "side", "sideband", "portrait"];

/** TEMPORARY (phase 1 screenshots): the look and polish named in the address, or the row as it is. */
export function shotLook(): { look: CardLook; polish: CardPolish; closed: boolean } {
  if (typeof window === "undefined") return { look: "thumb", polish: NO_POLISH, closed: false };
  const q = new URLSearchParams(window.location.search);
  const asked = q.get("cardlook") as CardLook | null;
  const look = asked && LOOKS.includes(asked) ? asked : "thumb";
  const polish = new Set((q.get("cardpolish") ?? "").split(",").filter((p): p is "b1" | "b2" | "b3" => p === "b1" || p === "b2" || p === "b3"));
  return { look, polish, closed: q.get("cardclosed") === "1" };
}

export interface FoundingRowProps {
  id: string;
  name: string;
  aim: string | null;
  art: string | null;
  kindLine: string | null;
  applyBy: string | null;
  circle: string | null;
  commitment: string | null;
  where: string | null;
  fill: RoleFill | null;
  seat: Record<string, any>;
  toBeAdded: ReadonlyArray<{ id: string; name: string }>;
  onOpenAdded?: (id: string) => void;
  here: boolean;
  cardSlot: ReactNode;
  onOpen: () => void;
  cardId: string;
  look?: CardLook;
  polish?: CardPolish;
}

/** The facts as they were: the apply-by chip, then circle, commitment and place as chips in one row. */
function FactsChips({ applyBy, facts }: { applyBy: string | null; facts: string[] }) {
  if (facts.length === 0 && !applyBy) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {applyBy && (
        <li className="inline-flex items-center gap-1 rounded-full border border-notice/50 px-2.5 py-0.5 text-xs font-semibold text-notice" data-front-apply-by="">
          <CalendarClock className="size-3" aria-hidden="true" />
          {applyBy}
        </li>
      )}
      {facts.map((f) => (
        <li key={f} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
          {f}
        </li>
      ))}
    </ul>
  );
}

/**
 * b2: the facts grouped. The apply-by date stands on its own line as the one gold tile, the time a reader has; circle,
 * commitment and place follow as one quiet line, each with its own sign, at 14px in the panel's ink.
 */
function FactsGrouped({ applyBy, circle, commitment, where }: { applyBy: string | null; circle: string | null; commitment: string | null; where: string | null }) {
  const facts = [
    [Users, circle],
    [Clock, commitment],
    [MapPin, where],
  ].filter((f): f is [typeof Users, string] => !!f[1]);
  if (facts.length === 0 && !applyBy) return null;
  return (
    <div className="mt-3 grid gap-2">
      {applyBy && (
        <p className="inline-flex w-fit items-center gap-2 rounded-lg border border-notice/60 bg-notice/10 px-3 py-1.5 text-sm font-semibold text-notice" data-front-apply-by="">
          <CalendarClock className="size-4" aria-hidden="true" />
          {applyBy}
        </p>
      )}
      {facts.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-card-foreground">
          {facts.map(([Icon, f]) => (
            <li key={f} className="inline-flex items-center gap-1.5">
              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              {f}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function FoundingRow(p: FoundingRowProps) {
  const { t } = useLingui();
  const look = p.look ?? "thumb";
  const polish = p.polish ?? NO_POLISH;
  const facts = [p.circle, p.commitment, p.where].filter((x): x is string => !!x);

  const aim = p.aim ? <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{p.aim}</p> : null;
  const head = (pill: boolean, big = false, withAim = true) => (
    <>
      {pill && <OpenPill />}
      <p className={`${pill ? "mt-1" : ""} font-display ${big ? "text-2xl sm:text-3xl" : "text-xl"} leading-snug text-card-foreground`}>{p.name}</p>
      {withAim && aim}
    </>
  );
  const rest = (
    <>
      {p.kindLine && (
        <p className="mt-1.5 text-sm font-semibold text-card-foreground" data-front-kind="">
          {p.kindLine}
        </p>
      )}
      {polish.has("b2") ? <FactsGrouped applyBy={p.applyBy} circle={p.circle} commitment={p.commitment} where={p.where} /> : <FactsChips applyBy={p.applyBy} facts={facts} />}
      {p.fill && <FillMeter f={p.fill} polish={polish} />}
      <Domains seat={p.seat} polish={polish} />
      <ToBeAdded roles={p.toBeAdded} onOpen={p.onOpenAdded} polish={polish} />
    </>
  );
  const button = (extra: string) => (
    <button
      type="button"
      onClick={p.onOpen}
      aria-expanded={p.here}
      aria-controls={p.cardId}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-notice bg-notice px-4 font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${extra}`}
      data-founding-role={p.id}
    >
      {t({ message: "Read the card", context: "team sheet: open this role's card" })}
      <span className="sr-only">{`: ${p.name}`}</span>
      <ArrowRight className="size-4" aria-hidden="true" />
    </button>
  );
  const frame = `rounded-2xl border-2 bg-card shadow-sm ${p.here && p.cardSlot ? "border-notice" : "border-notice/50"}`;
  const lit = p.here ? "bg-notice/10" : "";
  const slot = (pad: string) => (p.here && p.cardSlot ? <div className={pad} data-card-inline="">{p.cardSlot}</div> : null);

  if (look === "banner") {
    return (
      <li className={`overflow-hidden ${frame}`} data-role-frame={p.id} data-card-look="banner">
        <div className={lit}>
          <div className="relative aspect-[2/1] w-full border-b border-notice/30 sm:aspect-[3/1]">
            <ArtImage portrait src={p.art} className="absolute inset-0" imgClassName="object-[50%_38%]" />
            <span className="absolute left-3 top-3">
              <OpenPill />
            </span>
          </div>
          <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:p-6">
            <div className="min-w-0">
              {head(false, true)}
              {rest}
            </div>
            {button("w-full sm:w-auto")}
          </div>
        </div>
        {slot("p-2 sm:p-3")}
      </li>
    );
  }

  if (look === "side" || look === "sideband") {
    const band = look === "sideband";
    return (
      <li className={`overflow-hidden ${frame}`} data-role-frame={p.id} data-card-look={look}>
        <div className={`grid ${band ? "sm:grid-cols-[13rem_minmax(0,1fr)]" : "grid-cols-[7.5rem_minmax(0,1fr)] sm:grid-cols-[13rem_minmax(0,1fr)]"} ${lit}`}>
          <div className={`relative ${band ? "aspect-[4/3] border-b sm:aspect-auto sm:min-h-full sm:border-b-0 sm:border-r" : "min-h-full border-r"} border-notice/30`}>
            <ArtImage portrait src={p.art} className="absolute inset-0" imgClassName={band ? "object-[50%_35%]" : "object-center"} />
          </div>
          <div className="grid min-w-0 gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div className="min-w-0">
              {head(true, true)}
              {rest}
            </div>
            {button("w-full lg:w-auto")}
          </div>
        </div>
        {slot("p-2 sm:p-3")}
      </li>
    );
  }

  if (look === "portrait") {
    return (
      <li className={`${frame} p-2 sm:p-3`} data-role-frame={p.id} data-card-look="portrait">
        <div className={`grid grid-cols-[140px_minmax(0,1fr)] items-start gap-x-4 gap-y-3 rounded-xl p-2 sm:grid-cols-[200px_minmax(0,1fr)_auto] sm:gap-x-6 sm:p-3 ${lit}`}>
          <ArtImage portrait src={p.art} className="relative row-span-1 aspect-[3/4] w-full rounded-xl border border-notice/40 shadow-sm sm:row-span-2" imgClassName="object-top" />
          {/* Beside a 140px portrait a phone has about 180px for words, so the aim joins the full-width words below. */}
          <div className="min-w-0">{head(true, true, false)}</div>
          <div className="col-span-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:-mt-2">
            {aim}
            {rest}
          </div>
          <div className="col-span-2 sm:col-span-1 sm:col-start-3 sm:row-start-1">{button("w-full sm:w-auto")}</div>
        </div>
        {slot("mt-3")}
      </li>
    );
  }

  // thumb: the row as it is.
  return (
    <li className={`${frame} p-2 sm:p-3`} data-role-frame={p.id}>
      <div className={`grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3 rounded-xl p-1 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto] sm:gap-4 ${lit}`}>
        <ArtImage portrait src={p.art} className="relative size-14 rounded-xl border border-notice/40 sm:size-[4.5rem]" imgClassName="object-top" />
        <div className="min-w-0">
          {head(true)}
          {rest}
        </div>
        {button("col-span-2 sm:col-span-1")}
      </div>
      {slot("mt-3")}
    </li>
  );
}
