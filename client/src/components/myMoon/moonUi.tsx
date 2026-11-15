/**
 * My moon's shared pieces: the class strings (tokens only, from the profile
 * dashboard's set, so the light sheet and the night sheet both hold), the
 * Room view switch's context, and the one component that prints an amount.
 *
 * ROOM VIEW IS ONE SWITCH READ IN ONE PLACE PER KIND. Every amount on My moon
 * goes through `<Amount>`, and the score and the moon load are wrapped in
 * `<MemberOnly>`, so turning Room view on cannot miss one: a new amount that
 * skipped `<Amount>` would print `formatMoney` by hand, which is the thing a
 * reviewer looks for.
 */
import { createContext, useContext, type ReactNode } from "react";
import { formatMoney } from "@shared/money";
import { MY_MOON_WORDS, SPLIT_PAY_WORDS, type LineSplit } from "@shared/moonRecap";

export { BTN_GOLD, BTN_LINE, CHIP, H2, KICKER, LINK, PANEL, RAISED } from "@/components/profileDash/dashUi";

export const H3 = "m-0 text-lg font-semibold text-foreground";
export const LABEL = "block text-xs font-medium text-muted-foreground";
export const INPUT =
  "mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
export const SMALL_BTN =
  "inline-flex min-h-11 items-center justify-center rounded-lg sm:min-h-9 border border-border bg-transparent px-3 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
export const SMALL_BTN_ON = "inline-flex min-h-11 items-center justify-center rounded-lg sm:min-h-9 border border-transparent bg-teal-deep px-3 text-sm font-medium text-white hover:bg-teal-deep-dark";
export const MUTED = "text-sm text-muted-foreground";
export const ERROR = "text-sm text-destructive";

/** Room view: true hides every amount, the score and the moon load. */
export const RoomViewContext = createContext(false);
export const useRoomView = () => useContext(RoomViewContext);

/** An amount, or the hidden line while Room view is on. */
export function Amount({ minor, currency }: { minor: number | null; currency: string | null }) {
  const room = useRoomView();
  if (room) return <span data-hidden-amount="">{MY_MOON_WORDS.hiddenInRoom}</span>;
  if (minor === null || !currency) return <span>{MY_MOON_WORDS.none}</span>;
  return <span data-amount="">{formatMoney(minor, currency)}</span>;
}

/** Whatever only the member reads: the score and the moon load. Nothing renders in Room view. */
export function MemberOnly({ children }: { children: ReactNode }) {
  return useRoomView() ? null : <>{children}</>;
}

/** A section of My moon: a heading and its body, phone-first in one column. */
export function Section({ title, kicker, children, id }: { title: string; kicker?: string; children: ReactNode; id?: string }) {
  return (
    <section aria-label={title} id={id} className="flex scroll-mt-28 flex-col gap-3 rounded-[18px] border border-dash-edge bg-dash-raised p-4 sm:p-5">
      {kicker ? <p className="m-0 text-xs uppercase tracking-[0.17em] text-dash-gold-lit">{kicker}</p> : null}
      <h3 className={H3}>{title}</h3>
      {children}
    </section>
  );
}

/**
 * A LINE SCALED BY THE MEMBER'S SPLIT (Rye, 14 Nov 2026): the base pay, the
 * share of time and the scaled amount, then whether a Treasurer has
 * confirmed it. The member and Finance read the same three numbers.
 */
export function SplitBreakdown({ split, currency }: { split: LineSplit; currency: string | null }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-muted/60 px-2 py-1.5 text-xs text-muted-foreground" data-testid="line-split">
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        <dt>{SPLIT_PAY_WORDS.base}</dt>
        <dd className="m-0 text-right text-foreground"><Amount minor={split.baseMinor} currency={currency} /></dd>
        <dt>{SPLIT_PAY_WORDS.share}</dt>
        <dd className="m-0 text-right text-foreground">{split.sharePct}%</dd>
        <dt>{SPLIT_PAY_WORDS.scaled}</dt>
        <dd className="m-0 text-right font-semibold text-foreground"><Amount minor={split.scaledMinor} currency={currency} /></dd>
      </dl>
      <p className="m-0">{split.confirmedAt ? SPLIT_PAY_WORDS.confirmed : SPLIT_PAY_WORDS.waiting}</p>
    </div>
  );
}
