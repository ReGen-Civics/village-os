/**
 * NEEDS YOU NOW, on Today (Admin evolution).
 *
 * The lead: Today's "Needs you now" is the review lane's list, never a second
 * list built beside it. So this reads `useReviewInbox`, the one read of
 * everything waiting on this person (`GET /api/admin/review/inbox`), and draws
 * a short view of it:
 *
 *   - each kind with something waiting, in the list's own order, by its own
 *     title and count;
 *   - the first few items of each kind as they come (oldest first, the
 *     server's order), drawn by the list's own rows: an org chart draft can be
 *     published here (OrgDraftRow), every other row is a door to the page it is
 *     decided on (InboxRow);
 *   - "See all" to /admin/review?kind=<kind> when a kind holds more.
 *
 * A queue that failed is named, so a failure never reads as nothing waiting.
 * Nothing here ranks or judges: the rows are the list's rows.
 *
 * ONE READ, ONE COUNT (27 Nov 2026). Home hands this the read it already made (`inbox`), so opening Home reads the
 * list once, and the number Home says (DecisionsLine, in Home's own card) is the one this list is counted by. This
 * box says no second total.
 */
import { useState } from "react";
import { Link } from "wouter";
import { Trans, useLingui } from "@lingui/react/macro";
import InboxRow from "@/components/reviewInbox/InboxRow";
import OrgDraftRow from "@/components/reviewInbox/OrgDraftRow";
import { sourceText } from "@/components/reviewInbox/sourceWords";
import { useReviewInbox } from "@/components/reviewInbox/useReviewInbox";
import type { InboxItem } from "@shared/reviewInbox";

/** How many rows of one kind Today shows before "See all". */
export const ROWS_PER_KIND = 3;

const linkCls =
  "inline-flex min-h-[44px] items-center rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring";

export type Inbox = ReturnType<typeof useReviewInbox>;

/** Reads the list itself, for a page that has no read of its own to hand over. */
export function NeedsYouNowAlone() {
  return <NeedsYouNow inbox={useReviewInbox(true)} />;
}

export default function NeedsYouNow({ inbox }: { inbox: Inbox }) {
  const { t, i18n } = useLingui();
  const { load, sections, groups: kinds, total, read, refresh } = inbox;
  const [notice, setNotice] = useState<string | null>(null);

  if (load.phase === "loading") {
    return (
      <p className="text-sm text-muted-foreground">
        <Trans context="Admin Today, needs you now">Reading what is waiting on you...</Trans>
      </p>
    );
  }
  if (load.phase === "failed") {
    return (
      <section role="alert" className="rounded-xl border border-border bg-card p-4">
        <p className="text-base text-foreground">
          <Trans context="Admin Today, needs you now">The review list did not load, so this cannot say what is waiting.</Trans>
        </p>
        <button type="button" onClick={() => void read()} className={`${linkCls} mt-3`}>
          <Trans context="Admin Today, needs you now">Try again</Trans>
        </button>
      </section>
    );
  }

  // The kinds with rows to show. The number of each, and the total, are the server's (a kind is sent its first rows
  // only); a kind whose queue did not load has no number and is named below as not counted.
  const groups = kinds.filter((g) => g.items.length > 0);
  const failed = sections.filter((s) => s.state === "failed").map((s) => sourceText(s.source, i18n).title);
  const row = (item: InboxItem) =>
    item.source === "structure" ? (
      <OrgDraftRow key={item.key} item={item} onDone={(said) => { setNotice(said); void refresh(); }} />
    ) : (
      <InboxRow key={item.key} item={item} />
    );

  return (
    <section aria-labelledby="needs-you-now" className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="needs-you-now" className="text-lg font-semibold text-foreground">
          <Trans context="Admin Today, needs you now heading">Needs you now</Trans>
        </h3>
        {total > 0 && (
          <Link href="/admin/review" className="text-sm font-medium text-primary underline underline-offset-2">
            <Trans context="Admin Today, needs you now">Open the whole review list</Trans>
          </Link>
        )}
      </div>

      {notice && <p role="status" className="text-sm text-foreground">{notice}</p>}

      {/* Never "nothing" while a queue did not load: it may hold something (QA, 28 Nov 2026). The line below names it. */}
      {total === 0 && failed.length === 0 ? (
        <p className="text-base text-foreground">
          <Trans context="Admin Today, needs you now">Nothing on the review list is waiting on you.</Trans>
        </p>
      ) : null}

      {groups.map((g) => {
        const title = sourceText(g.source, i18n).title;
        const id = `needs-${g.source}`;
        // What this kind holds: the server's number, or what did load when its queue failed in part.
        const n = g.count ?? g.atLeast;
        return (
          <div key={g.source} className="space-y-2">
            <h4 id={id} className="text-sm font-semibold text-foreground">
              {title} <span className="font-normal text-muted-foreground">({g.count === null ? t({ message: "unknown", context: "Admin Today, needs you now: a queue that did not load has no number" }) : g.count})</span>
            </h4>
            <ul aria-labelledby={id} className="space-y-2 list-none p-0 m-0">
              {g.items.slice(0, ROWS_PER_KIND).map(row)}
            </ul>
            {n > ROWS_PER_KIND && (
              <Link href={`/admin/review?kind=${g.source}`} className={linkCls}>
                {g.count === null
                  ? t({ message: "See all of them", context: "Admin Today, needs you now: open one kind on the review list" })
                  : t({ message: `See all ${g.count}`, context: "Admin Today, needs you now: open one kind on the review list" })}
              </Link>
            )}
          </div>
        );
      })}

      {failed.length > 0 && (
        <p className="text-sm text-foreground">
          {t({ message: `Could not be read just now, so not counted: ${failed.join(", ")}.`, context: "Admin Today, needs you now" })}
        </p>
      )}
    </section>
  );
}
