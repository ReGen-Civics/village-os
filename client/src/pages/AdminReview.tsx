/**
 * /admin/review: everything waiting on the person reading it, in one list (docs/REVIEW_INBOX_PLAN.md, lane 4a).
 *
 * The lead could not find B-71 because they looked on /review and it was on /admin/proposals. This page answers it:
 * one find box that takes a code, and one list of what waits, from every queue.
 *
 * EVERY ROW SAYS WHAT IT IS AND WHAT DECIDING IT DOES (lane 4c, client/src/components/reviewInbox/sourceWords.ts), the
 * rows are grouped by kind with their counts, and a row that can be decided here carries its decision: the connector's
 * cards, and an org chart draft's Publish (OrgDraftRow). Every other row's door is named by its verb.
 *
 * THREE VIEWS (lane 4b), as links (`?view=`): Waiting, Held and Decided. Under Waiting the connector's changes are
 * decided here, on the same cards /admin/proposals draws, and changes that write the same thing are one card with
 * options (conflicts block, the lead, 25 Nov 2026). Every other queue keeps its door to the page it is decided on.
 * Held is what the engine held back, with its reason and its age; Decided is the connector's history, newest first.
 * Find also finds a decided code and says which view holds it.
 *
 * WHO SEES WHAT is the server's (server/routes/reviewInbox.ts): each section is that queue's own read, made as this
 * person, so the page can never show more than the queue's own page does. The `/admin/` path names the page and gates
 * nothing: a steward who is not an admin opens it.
 *
 * A failed read is never an empty one: a queue that did not load says so, by name, with a way to try again.
 */
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plural, Trans, useLingui } from "@lingui/react/macro";
import { Link, useSearch } from "wouter";
import Layout from "@/components/Layout";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { BTN_SECONDARY, CHIP_SOFT, EYEBROW, FIELD, H1, H2, HINT, LABEL, LEDE, LINK, QUIET, WORLD } from "@/components/journey/look";
import type { InboxItem } from "@shared/reviewInbox";
import { INBOX_SOURCES, type InboxSource } from "@shared/reviewInboxSources";
import { sourceText } from "@/components/reviewInbox/sourceWords";
import { matchesFind } from "@shared/proposedChanges";
import { DecidedCard } from "@/components/proposals/ChangeCard";
import ConnectorWaiting from "@/components/reviewInbox/ConnectorWaiting";
import HeldList from "@/components/reviewInbox/HeldList";
import { useConnectorDesk } from "@/components/reviewInbox/useConnectorDesk";
import InboxRow from "@/components/reviewInbox/InboxRow";
import OrgDraftRow from "@/components/reviewInbox/OrgDraftRow";
import { inboxHeaders as headers, kindOf, useReviewInbox } from "@/components/reviewInbox/useReviewInbox";

type View = "waiting" | "held" | "decided";
const viewOf = (search: string): View => {
  const v = new URLSearchParams(search).get("view");
  return v === "held" || v === "decided" ? v : "waiting";
};
const TAB = "inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-medium";
const TAB_ON = `${TAB} bg-notice text-background`;
const TAB_OFF = `${TAB} border border-border bg-card text-foreground hover:bg-muted`;


export default function AdminReview() {
  const { t, i18n } = useLingui();
  const auth = useOptionalAuth();
  const signedOut = !!auth && !auth.loading && !auth.user;
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ q: string; items: InboxItem[] | null; code: string | null; decided?: { code: string; at: string | null } } | null>(null);
  const search = useSearch();
  const view = viewOf(search);
  // `?kind=structure` shows one kind: the door a count elsewhere (Admin's Today) lands through.
  const onlyKind = kindOf(search);

  const titles = Object.fromEntries(INBOX_SOURCES.map((s) => [s, sourceText(s, i18n).title])) as Record<InboxSource, string>;

  // Keyed on being signed in, never on the user object, which a context may hand out anew on every render.
  const signedIn = !!auth && !auth.loading && !!auth.user;
  const { load, answer, groups, read } = useReviewInbox(signedIn);
  // What the last decision made on a row said, read out once: the row itself leaves the list when it is decided.
  const [notice, setNotice] = useState<string | null>(null);

  // The connector's own read, made only when the inbox says this person may read it: the page never asks for more.
  const desk = useConnectorDesk(() => void read());
  const connectorState = load.phase === "ready" ? load.answer.sections.find((s) => s.source === "connector")?.state : undefined;
  const mayDecide = connectorState === "ok" || connectorState === "failed";
  useEffect(() => {
    if (mayDecide) void desk.loadAll();
  }, [mayDecide]); // eslint-disable-line react-hooks/exhaustive-deps

  const find = async (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return setFound(null);
    try {
      const r = await fetch(`/api/admin/review/find?q=${encodeURIComponent(q)}`, { headers: headers() });
      const body = (await r.json().catch(() => ({}))) as { items?: InboxItem[]; code?: string | null };
      const items = r.ok ? body.items ?? [] : [];
      // Nothing waiting has it: it may have been decided. Only the history this person was already sent is searched.
      const done = items.length ? undefined : desk.decided.find((d) => d.code && matchesFind(q, { id: d.id, code: d.code, batchId: d.batchId, batchCode: d.batchCode }));
      setFound({ q, items, code: body.code ?? null, ...(done ? { decided: { code: body.code ?? done.code!, at: done.at } } : {}) });
    } catch {
      setFound({ q, items: null, code: null });
    }
  };

  const day = (iso: string | null) => (iso ? i18n.date(new Date(iso), { day: "numeric", month: "short" }) : null);

  const failed = (answer?.sections ?? []).filter((s) => s.state === "failed").map((s) => s.source);
  const readable = (answer?.sections ?? []).filter((s) => s.state === "ok" || s.state === "failed");
  const forbidden = !!answer && readable.length === 0;
  const waiting = answer?.items.length ?? 0;
  const heldCount = desk.heldState === "ok" ? desk.held.length : 0;
  const foundIds = useMemo(() => new Set((found?.items ?? []).filter((i) => i.source === "connector").map((i) => i.key.slice(i.key.lastIndexOf(":") + 1))), [found]);
  const foundCode = found?.code ?? null;

  const failedNames = failed.map((s) => titles[s]).join(", ");

  const row = (item: InboxItem) =>
    item.source === "structure" ? (
      <OrgDraftRow
        key={item.key}
        item={item}
        onDone={(said) => {
          setNotice(said);
          void read();
        }}
      />
    ) : (
      <InboxRow key={item.key} item={item} />
    );

  return (
    <Layout>
      <div className={`${WORLD} py-8 sm:py-12`}>
        <div className="mx-auto max-w-2xl space-y-8 px-4">
          <header className="space-y-2">
            <p className={EYEBROW}>
              <Trans context="review inbox: eyebrow">Waiting on the people who decide</Trans>
            </p>
            <h1 className={H1}>
              <Trans context="review inbox: h1">Review</Trans>
            </h1>
            <p className={LEDE}>
              <Trans context="review inbox: lede">Everything waiting on you, from every queue, in one list. Decide what you can on its row. The rest opens where it is decided.</Trans>
            </p>
            {answer && !forbidden ? (
              <p className={HINT} role="status" aria-live="polite">
                <Plural value={waiting} one="# waiting on you." other="# waiting on you." />
                {heldCount ? (
                  <>
                    {" "}
                    <Plural context="review inbox: header" value={heldCount} one="# held." other="# held." />
                  </>
                ) : null}
              </p>
            ) : null}
          </header>

          {signedOut ? (
            <p className={HINT}>
              <Trans context="review inbox">This page is for people who decide suggestions here.</Trans>{" "}
              <Link href="/login" className={LINK}>
                <Trans context="review inbox">Sign in to see it</Trans>
              </Link>
            </p>
          ) : null}

          {!signedOut && !forbidden ? (
            <form onSubmit={find} className="space-y-2" role="search">
              <label htmlFor="review-find" className={LABEL}>
                <Trans context="review inbox: find">Find by code</Trans>
              </label>
              <div className="flex gap-2">
                <input
                  id="review-find"
                  className={`${FIELD} min-w-0 flex-1`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t({ context: "review inbox: find, an example code", message: "B-71" })}
                  autoCapitalize="characters"
                  autoComplete="off"
                />
                <button type="submit" className={BTN_SECONDARY}>
                  <Trans context="review inbox: find button">Find</Trans>
                </button>
              </div>
              {found ? (
                <div aria-live="polite" className="space-y-2">
                  {found.items === null ? (
                    <p className={HINT}>
                      <Trans context="review inbox: find failed">The search did not run. Try again.</Trans>
                    </p>
                  ) : found.items.length === 0 && found.decided ? (
                    <p className={HINT} data-testid="found-decided">
                      <FoundDecided code={found.decided.code} day={day(found.decided.at)} />{" "}
                      <Link href="/admin/review?view=decided" className={LINK}>
                        <Trans context="review inbox: find">Open Decided</Trans>
                      </Link>
                    </p>
                  ) : found.items.length === 0 ? (
                    <p className={HINT}>
                      {foundCode ? (
                        <Trans context="review inbox: nothing found for a code">Nothing waiting is called {foundCode}, among what you may see.</Trans>
                      ) : (
                        <Trans context="review inbox: nothing found">Nothing waiting matches that.</Trans>
                      )}
                    </p>
                  ) : (
                    <ul className="space-y-2">{found.items.map(row)}</ul>
                  )}
                </div>
              ) : null}
            </form>
          ) : null}

          {!signedOut && load.phase === "loading" ? (
            <p className={HINT}>
              <Trans context="review inbox: loading">Reading what is waiting.</Trans>
            </p>
          ) : null}

          {!signedOut && load.phase === "failed" ? (
            <div className={`${QUIET} space-y-2`}>
              <p className="text-base text-foreground">
                <Trans context="review inbox: failed">This list did not load. Suggestions may be waiting.</Trans>
              </p>
              <button type="button" className={BTN_SECONDARY} onClick={() => void read()}>
                <Trans context="review inbox: try again">Try again</Trans>
              </button>
            </div>
          ) : null}

          {forbidden ? (
            <p className={HINT}>
              <Trans context="review inbox: forbidden">This page is for people who decide suggestions. What you sent waits on</Trans>{" "}
              <Link href="/governance/work" className={LINK}>
                <Trans context="review inbox: forbidden link">Review</Trans>
              </Link>
              .
            </p>
          ) : null}

          {answer && !forbidden ? (
            <nav aria-label={t({ context: "review inbox: views", message: "Views" })} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              <Link href="/admin/review" className={view === "waiting" ? TAB_ON : TAB_OFF} aria-current={view === "waiting" ? "page" : undefined}>
                <Trans context="review inbox: views">Waiting</Trans>
              </Link>
              {mayDecide ? (
                <>
                  <Link href="/admin/review?view=held" className={view === "held" ? TAB_ON : TAB_OFF} aria-current={view === "held" ? "page" : undefined} data-testid="tab-held">
                    {heldCount ? <Trans context="review inbox: views">Held {heldCount}</Trans> : <Trans context="review inbox: views">Held</Trans>}
                  </Link>
                  <Link href="/admin/review?view=decided" className={view === "decided" ? TAB_ON : TAB_OFF} aria-current={view === "decided" ? "page" : undefined} data-testid="tab-decided">
                    <Trans context="review inbox: views">Decided</Trans>
                  </Link>
                </>
              ) : null}
            </nav>
          ) : null}

          {answer && !forbidden && view === "held" && mayDecide ? <HeldList desk={desk} /> : null}

          {answer && !forbidden && view === "decided" && mayDecide ? (
            desk.state === "ok" && desk.decided.length ? (
              <section className="space-y-4" aria-labelledby="review-decided">
                <h2 id="review-decided" className={H2}>
                  <Trans context="review inbox: decided">Decided, newest first</Trans>
                </h2>
                {desk.decided.map((d) => (
                  <DecidedCard key={d.id} d={d} zone={desk.zone} onPutBack={desk.putBack} found={!!found?.decided && matchesFind(found.q, { id: d.id, code: d.code, batchId: d.batchId, batchCode: d.batchCode })} />
                ))}
              </section>
            ) : desk.state === "failed" ? (
              <p className={HINT} role="alert">
                <Trans context="review inbox: decided">Decided did not load. Try again.</Trans>
              </p>
            ) : desk.state === "ok" ? (
              <p className={HINT}>
                <Trans context="review inbox: decided">Nothing has been decided here yet.</Trans>
              </p>
            ) : null
          ) : null}

          {answer && !forbidden && (view === "waiting" || !mayDecide) ? (
            <div className="space-y-8">
              {failed.length ? (
                <div className={`${QUIET} space-y-2`} role="alert">
                  <p className="text-base text-foreground">
                    <Trans context="review inbox: part failed">Some of what waits did not load: {failedNames}. Suggestions may be waiting there.</Trans>
                  </p>
                  <button type="button" className={BTN_SECONDARY} onClick={() => void read()}>
                    <Trans context="review inbox: try again">Try again</Trans>
                  </button>
                </div>
              ) : null}
              {waiting === 0 && !failed.length ? (
                <p className={HINT}>
                  <Trans context="review inbox: empty">Nothing is waiting on you.</Trans>
                </p>
              ) : null}
              {onlyKind ? (
                <p className={HINT} data-testid="only-kind">
                  <OnlyKind title={titles[onlyKind]} />{" "}
                  <Link href="/admin/review" className={LINK}>
                    <Trans context="review inbox: one kind">Show everything</Trans>
                  </Link>
                </p>
              ) : null}
              {!onlyKind && groups.length > 1 ? (
                <nav aria-label={t({ context: "review inbox: kinds", message: "What is waiting, by kind" })} className="flex flex-wrap gap-2" data-testid="kinds">
                  {groups.map((g) => (
                    <a key={g.source} href={`#review-${g.source}`} className={`${CHIP_SOFT} min-h-9 px-3 text-sm`}>
                      {titles[g.source]} <span aria-hidden="true">·</span> {g.count}
                    </a>
                  ))}
                </nav>
              ) : null}
              {notice ? (
                <p className="text-sm text-foreground" role="status" data-testid="row-notice">
                  {notice}
                </p>
              ) : null}
              {groups.filter((g) => !onlyKind || g.source === onlyKind).map(({ source: s, items, count }) =>
                s === "connector" && desk.state === "ok" ? (
                  <ConnectorWaiting key={s} desk={desk} title={titles[s]} count={count} found={foundIds} />
                ) : (
                <section key={s} className="space-y-3" aria-labelledby={`review-${s}`}>
                  <h2 id={`review-${s}`} className={H2}>
                    {titles[s]}
                    {" "}
                    <span className={`${CHIP_SOFT} ml-1 align-middle`}>{count}</span>
                  </h2>
                  <ul className="space-y-2">{items.map(row)}</ul>
                </section>
                ),
              )}
            </div>
          ) : null}
        </div>
      </div>
    </Layout>
  );
}

/** "B-71 was decided on 20 Nov. It is under Decided." A code decided on no known day says so without the day. */
function FoundDecided({ code, day }: { code: string; day: string | null }) {
  return day ? (
    <Trans context="review inbox: find a decided code">{code} was decided on {day}. It is under Decided.</Trans>
  ) : (
    <Trans context="review inbox: find a decided code">{code} was decided. It is under Decided.</Trans>
  );
}

/** "Showing only Org chart drafts." */
function OnlyKind({ title }: { title: string }) {
  return <Trans context="review inbox: one kind">Showing only {title}.</Trans>;
}
