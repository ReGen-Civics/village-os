/**
 * SERA'S DIFFERENCES AS ONE ROW (the hall relief, 27 Nov 2026).
 *
 * The live list drew 185 rows and 159 of them were these, each a door to another page. Now they are one row that says
 * how many wait and opens the list where a person ticks and takes them together, in place (SeraSheet). The number is
 * the server's (`holds`: what waits for a person by the list's own rule). Sera's suggestions for pay and for new roles
 * are in that list like any other (Rye, 27 Nov 2026: "Sera, can also make suggestions for pay and new roles, but with
 * our confirmation"), and the row says which ones a person confirms one at a time, as the list has always had it.
 *
 * NO NEW ACT. The row opens and closes a list. Every decision is made inside it, by the controls it already has.
 */
import { lazy, Suspense, useId, useState } from "react";
import { Plural, Trans, useLingui } from "@lingui/react/macro";
import { BTN_SECONDARY, CHIP_SOFT, HINT, QUIET } from "@/components/journey/look";
import type { InboxItem } from "@shared/reviewInbox";
import { sourceText } from "./sourceWords";

const SeraSheet = lazy(() => import("./SeraSheet"));

/** As wide as /review draws the list (its two panes need the room from 1280 px), centred on the page's column. */
const WIDE = "relative left-1/2 w-[min(56rem,calc(100vw-2rem))] -translate-x-1/2 xl:w-[min(1200px,calc(100vw-2rem))]";

export default function SeraListRow({ item, onChanged }: { item: InboxItem; onChanged: () => void }) {
  const { i18n } = useLingui();
  const words = sourceText("sera", i18n);
  const [open, setOpen] = useState(false);
  const panel = useId();
  const n = item.holds ?? 1;
  const since = item.filedAt ? i18n.date(new Date(item.filedAt), { day: "numeric", month: "short" }) : null;
  return (
    <>
      <li className={`${QUIET} flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between`} data-testid={`row-${item.key}`}>
        <div className="min-w-0 space-y-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className={CHIP_SOFT}>{words.what}</span>
          </p>
          <p className="text-base text-foreground" data-testid="sera-holds">
            <Plural context="review inbox: Sera's one row" value={n} one="# difference waits." other="# differences wait, as one list." />
          </p>
          <p className="text-sm text-foreground">{words.does}</p>
          <p className={HINT}>
            <Trans context="review inbox: Sera's one row">Tick the ones to take and take them together. Sera's suggestions for pay and for new roles are in the list too. A new role apart from its circle, and anything marked Check first, are each taken on their own. Pay is shown here and set where pay is set, by the people who set pay.</Trans>
          </p>
          {since ? (
            <p className={HINT}>
              <Trans context="review inbox: Sera's one row">The oldest has waited since {since}</Trans>
            </p>
          ) : null}
        </div>
        <button type="button" className={`${BTN_SECONDARY} shrink-0 self-start whitespace-nowrap`} aria-expanded={open} aria-controls={panel} onClick={() => setOpen((o) => !o)} data-testid="sera-open">
          {open ? <Trans context="review inbox: Sera's one row">Close the list</Trans> : <Trans context="review inbox: Sera's one row">Go through them</Trans>}
        </button>
      </li>
      {open ? (
        <li id={panel} className={WIDE} data-testid="sera-list">
          <Suspense
            fallback={
              <p className={HINT}>
                <Trans context="review inbox: Sera's list">Reading the list.</Trans>
              </p>
            }
          >
            <SeraSheet onChanged={onChanged} />
          </Suspense>
        </li>
      ) : null}
    </>
  );
}
