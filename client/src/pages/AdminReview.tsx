/**
 * /admin/review: everything waiting on the person reading it, in one list (docs/REVIEW_INBOX_PLAN.md, lane 4a).
 *
 * The lead could not find B-71 because they looked on /review and it was on /admin/proposals. This page answers it:
 * one find box that takes a code, and one list of what waits, from every queue.
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
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Plural, Trans, useLingui } from "@lingui/react/macro";
import { Link, useSearch } from "wouter";
import Layout from "@/components/Layout";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { authToken } from "@/lib/gameApi";
import { BTN_SECONDARY, CHIP_SOFT, DOOR, EYEBROW, FIELD, H1, H2, HINT, LABEL, LEDE, LINK, QUIET, WORLD } from "@/components/journey/look";
import type { InboxItem, SectionState } from "@shared/reviewInbox";
import { INBOX_ORDER as ORDER, type InboxSource } from "@shared/reviewInboxSources";
import { matchesFind } from "@shared/proposedChanges";
import { DecidedCard } from "@/components/proposals/ChangeCard";
import ConnectorWaiting from "@/components/reviewInbox/ConnectorWaiting";
import HeldList from "@/components/reviewInbox/HeldList";
import { useConnectorDesk } from "@/components/reviewInbox/useConnectorDesk";

type View = "waiting" | "held" | "decided";
const viewOf = (search: string): View => {
  const v = new URLSearchParams(search).get("view");
  return v === "held" || v === "decided" ? v : "waiting";
};
const TAB = "inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-medium";
const TAB_ON = `${TAB} bg-notice text-background`;
const TAB_OFF = `${TAB} border border-border bg-card text-foreground hover:bg-muted`;

interface InboxAnswer {
  sections: { source: InboxSource; state: SectionState; count: number }[];
  items: InboxItem[];
}

type Load = { phase: "loading" } | { phase: "failed" } | { phase: "ready"; answer: InboxAnswer };

function headers(): Record<string, string> {
  const t = authToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** Where a door goes: a connector change opens its own page already searched for its code. */
function doorOf(item: InboxItem): string {
  if (item.source === "connector" && item.code) return `${item.decideAt}?find=${encodeURIComponent(item.code)}`;
  return item.decideAt;
}

export default function AdminReview() {
  const { t, i18n } = useLingui();
  const auth = useOptionalAuth();
  const signedOut = !!auth && !auth.loading && !auth.user;
  const [load, setLoad] = useState<Load>({ phase: "loading" });
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ q: string; items: InboxItem[] | null; code: string | null; decided?: { code: string; at: string | null } } | null>(null);
  const view = viewOf(useSearch());

  const titles: Record<InboxSource, string> = {
    connector: t({ context: "review inbox: section", message: "Proposed changes" }),
    intake: t({ context: "review inbox: section", message: "From Sera and outside services" }),
    sera: t({ context: "review inbox: section", message: "Where Sera's memory differs" }),
    quest: t({ context: "review inbox: section", message: "Quest ideas" }),
    claim: t({ context: "review inbox: section", message: "Finished work to witness" }),
    approval: t({ context: "review inbox: section", message: "Approvals" }),
    agent: t({ context: "review inbox: section", message: "From agents" }),
    vote: t({ context: "review inbox: section", message: "Votes waiting on you" }),
    consent: t({ context: "review inbox: section", message: "Asked to consent" }),
    application: t({ context: "review inbox: section", message: "Applications for a role" }),
    open: t({ context: "review inbox: section", message: "Proposals from outside the village" }),
    structure: t({ context: "review inbox: section", message: "Drafts to publish" }),
    change: t({ context: "review inbox: section", message: "Change requests in review" }),
    suggestion: t({ context: "review inbox: section", message: "Suggested edits to what you hold" }),
    hand: t({ context: "review inbox: section", message: "Members asking to hold a power" }),
    tension: t({ context: "review inbox: section", message: "Tensions raised with your role" }),
    task: t({ context: "review inbox: section", message: "Done work to accept" }),
    handoff: t({ context: "review inbox: section", message: "Tasks handed to you" }),
    recap: t({ context: "review inbox: section", message: "Moon recaps to review" }),
    cash: t({ context: "review inbox: section", message: "Cash owed" }),
    owed: t({ context: "review inbox: section", message: "Postings owed" }),
    mint: t({ context: "review inbox: section", message: "Mint requests" }),
    cycle: t({ context: "review inbox: section", message: "Cycles to settle" }),
    cosign: t({ context: "review inbox: section", message: "Keys waiting for a co-sign" }),
    letter: t({ context: "review inbox: section", message: "Letters waiting to be read" }),
    assistant: t({ context: "review inbox: section", message: "Drafts from the assistant" }),
    feedback: t({ context: "review inbox: section", message: "Feedback to read" }),
    vouch: t({ context: "review inbox: section", message: "Places waiting for your vouch" }),
    erasure: t({ context: "review inbox: section", message: "Erasures to retry" }),
  };

  const read = useCallback(async () => {
    setLoad({ phase: "loading" });
    try {
      const r = await fetch("/api/admin/review/inbox", { headers: headers() });
      if (!r.ok) return setLoad({ phase: "failed" });
      setLoad({ phase: "ready", answer: (await r.json()) as InboxAnswer });
    } catch {
      setLoad({ phase: "failed" });
    }
  }, []);

  // Keyed on being signed in, never on the user object, which a context may hand out anew on every render.
  const signedIn = !!auth && !auth.loading && !!auth.user;
  useEffect(() => {
    if (signedIn) void read();
  }, [signedIn, read]);

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

  const answer = load.phase === "ready" ? load.answer : null;
  const bySource = useMemo(() => {
    const m = new Map<InboxSource, InboxItem[]>();
    for (const item of answer?.items ?? []) m.set(item.source, [...(m.get(item.source) ?? []), item]);
    return m;
  }, [answer]);
  const failed = (answer?.sections ?? []).filter((s) => s.state === "failed").map((s) => s.source);
  const readable = (answer?.sections ?? []).filter((s) => s.state === "ok" || s.state === "failed");
  const forbidden = !!answer && readable.length === 0;
  const waiting = answer?.items.length ?? 0;
  const heldCount = desk.heldState === "ok" ? desk.held.length : 0;
  const foundIds = useMemo(() => new Set((found?.items ?? []).filter((i) => i.source === "connector").map((i) => i.key.slice(i.key.lastIndexOf(":") + 1))), [found]);
  const foundCode = found?.code ?? null;

  const failedNames = failed.map((s) => titles[s]).join(", ");

  const row = (item: InboxItem) => {
    const sent = day(item.filedAt);
    return (
    <li key={item.key} className={`${QUIET} flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between`}>
      <div className="min-w-0 space-y-1">
        <p className="text-base text-foreground">
          {item.code ? <span className={`${CHIP_SOFT} mr-2 align-middle`}>{item.code}</span> : null}
          {item.summary}
        </p>
        {sent ? (
          <p className={HINT}>
            <Trans context="review inbox: item">Sent {sent}</Trans>
          </p>
        ) : null}
      </div>
      <Link href={doorOf(item)} className={`${DOOR} shrink-0 self-start sm:self-center`}>
        <Trans context="review inbox: open the page where it is decided">Open</Trans>
      </Link>
    </li>
    );
  };

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
              <Trans context="review inbox: lede">Everything waiting on you, from every queue, in one list. Open one to decide it where it lives today.</Trans>
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
              <Link href="/review" className={LINK}>
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
              {ORDER.filter((s) => bySource.get(s)?.length).map((s) =>
                s === "connector" && desk.state === "ok" ? (
                  <ConnectorWaiting key={s} desk={desk} title={titles[s]} found={foundIds} />
                ) : (
                <section key={s} className="space-y-3" aria-labelledby={`review-${s}`}>
                  <h2 id={`review-${s}`} className={H2}>
                    {titles[s]}
                  </h2>
                  <ul className="space-y-2">{bySource.get(s)!.map(row)}</ul>
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
