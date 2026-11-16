/**
 * /admin/proposals: every change an agent proposed, on one page (the lead, 11 Nov 2026), as cards (16 Nov 2026:
 * "show more like role cards in that design to make it easier for me to understand the batching, what's
 * changing, what's being proposed").
 *
 * Each batch is a card in the role card's shape (BatchCard): its title, who proposed it, when, how many changes,
 * where they land, and Accept all or Discard all, asked once on the card. Inside, each change is a card of its own
 * (ChangeCard): its kind in plain words with an icon, where it lands with a door to see that page live, plain
 * flags, and the change as before and after, word by word. Accept, Edit words and Discard act on that one change.
 *
 * ACCEPTING IS UNCHANGED. Whatever is accepted (one change or a whole batch) is read first by each change's own
 * validator (the dry run), and a problem shows on its own field with nothing accepted. Then each change runs
 * through its own route as this person, in order; one that fails keeps its reason on its card and the rest land.
 * Edits save to the server as they type, so leaving and coming back keeps them.
 *
 * The filter row narrows by waiting or decided, by kind, by page and by who proposed. Waiting comes first, newest
 * batch first. "Recently decided" is a history of the same cards: what went live (and what the reader changed
 * first), or what was put aside, who decided and when, and the reason a change did not land.
 *
 * PROPOSE PUTTING IT BACK. An accepted change keeps what was live just before it (0398). Its history card offers
 * "Propose putting it back", which files a NEW proposal carrying that value; it waits here like any other and moves
 * nothing until a person accepts it. A change accepted before that release, or one of a kind that is never put back,
 * says why in one plain line (shared/proposalPutBack.ts).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { Trans, useLingui } from "@lingui/react/macro";
import Layout from "@/components/Layout";
import { authToken } from "@/lib/gameApi";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { CARD, EYEBROW, FIELD, H1, HINT, LABEL, LEDE, LINK, WORLD } from "@/components/journey/look";
import { CHANGE_FACES, faceOf, type ChangeFace } from "@shared/proposalReview";
import BatchCard, { HistoryBatch } from "@/components/proposals/BatchCard";
import ChangeCard, { DecidedCard, faceWords } from "@/components/proposals/ChangeCard";
import { setAt } from "@/components/proposals/ProposalEditor";
import type { Batch, Decided, Problem, Proposal, ReviewPayload } from "@/components/proposals/reviewTypes";

const headers = (): Record<string, string> => {
  const t = authToken();
  return t ? { Authorization: `Bearer ${t}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
};

type StatusFilter = "all" | "waiting" | "decided";
type Result = { id: string; ok: boolean; error?: string; field?: string | null };

const faceOfDecided = (d: Decided) => faceOf(d.kind ?? "setting", d.route ?? { method: "PUT", path: "" });

export default function ProposedChanges() {
  const { t, i18n } = useLingui();
  const auth = useOptionalAuth();
  const signedOut = !!auth && !auth.loading && !auth.user;
  const [state, setState] = useState<"loading" | "ok" | "refused" | "failed">("loading");
  const [zone, setZone] = useState("UTC");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [changes, setChanges] = useState<Proposal[]>([]);
  const [decided, setDecided] = useState<Decided[]>([]);
  const [edits, setEdits] = useState<Record<string, Record<string, unknown>>>({});
  // A change whose last try may have landed is tried again only once the person ticks that they checked its page.
  const [checkedPage, setCheckedPage] = useState<Record<string, boolean>>({});
  const [problems, setProblems] = useState<Record<string, Problem[]>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<Record<string, "saving" | "saved" | "failed">>({});
  const [outcome, setOutcome] = useState<{ landed: string[]; failed: number } | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<StatusFilter>("all");
  const [kind, setKind] = useState<ChangeFace | "">("");
  const [page, setPage] = useState("");
  const [who, setWho] = useState("");
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/proposals", { headers: headers() });
      if (r.status === 401 || r.status === 403) return setState("refused");
      if (!r.ok) throw new Error("read failed");
      const d = (await r.json()) as ReviewPayload;
      setZone(d.timezone || "UTC");
      setBatches(d.batches);
      setChanges(d.changes);
      setDecided(d.decided ?? []);
      setEdits(Object.fromEntries(d.changes.map((c) => [c.id, c.draft ?? c.body])));
      setState("ok");
    } catch {
      setState("failed");
    }
  }, []);

  useEffect(() => {
    if (auth?.loading || signedOut) return;
    void load();
  }, [auth?.loading, signedOut, load]);

  /** Save one proposal's edits as a draft, a moment after the last keystroke. */
  const saveDraft = useCallback((id: string, body: Record<string, unknown>) => {
    clearTimeout(timers.current[id]);
    setSaved((s) => ({ ...s, [id]: "saving" }));
    timers.current[id] = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/proposals/${encodeURIComponent(id)}/draft`, { method: "PUT", headers: headers(), body: JSON.stringify({ body }) });
        setSaved((s) => ({ ...s, [id]: r.ok ? "saved" : "failed" }));
      } catch {
        setSaved((s) => ({ ...s, [id]: "failed" }));
      }
    }, 700);
  }, []);

  const edit = (id: string, path: string, next: unknown) => {
    setEdits((all) => {
      const body = setAt(all[id] ?? {}, path ? path.split(".") : [], next) as Record<string, unknown>;
      saveDraft(id, body);
      return { ...all, [id]: body };
    });
    setProblems((p) => ({ ...p, [id]: [] }));
  };

  /** File a new proposal that puts an accepted change back. Nothing is applied: it joins the waiting list. */
  const putBack = async (d: Decided): Promise<string | null> => {
    try {
      const r = await fetch(`/api/admin/proposals/${encodeURIComponent(d.id)}/put-back`, { method: "POST", headers: headers() });
      const body = (await r.json().catch(() => ({}))) as { message?: string };
      if (!r.ok) return body.message || t({ message: "That could not be filed. Reload and try again.", context: "proposed changes" });
      await load();
      return null;
    } catch {
      return t({ message: "That could not be filed. Reload and try again.", context: "proposed changes" });
    }
  };

  /** Accept these changes: the dry run first, then each through its own route as this person, in order. */
  const accept = async (list: Proposal[]) => {
    if (!list.length) return;
    setBusy(true);
    setOutcome(null);
    try {
      const items = list.map((c) => ({ id: c.id, body: edits[c.id] ?? c.body, ...(c.status === "unknown" && checkedPage[c.id] ? { checked: true } : {}) }));
      const check = await fetch("/api/admin/proposals/check", { method: "POST", headers: headers(), body: JSON.stringify({ items }) });
      const cd = (await check.json().catch(() => ({}))) as { results?: Result[] };
      if (!check.ok) {
        setProblems({ _page: [{ error: t({ message: "The check could not run. Reload and try again.", context: "proposed changes" }), field: null }] });
        return;
      }
      const bad = (cd.results ?? []).filter((r) => !r.ok);
      if (bad.length) {
        setProblems(Object.fromEntries(bad.map((r) => [r.id, [{ error: r.error ?? "", field: r.field ?? null }]])));
        // A problem is on a change's own card, so the card is open to show it.
        setOpen((o) => ({ ...o, ...Object.fromEntries(list.map((c) => [c.batchId, true])) }));
        return;
      }
      const r = await fetch("/api/admin/proposals/accept", { method: "POST", headers: headers(), body: JSON.stringify({ items }) });
      const d = (await r.json().catch(() => ({}))) as { results?: Result[] };
      // An answer with no results is not "none landed": it is an accept that did not run. Say so, and reload what stands.
      if (!r.ok || !Array.isArray(d.results)) {
        setProblems({ _page: [{ error: t({ message: "The accept did not finish. Reload to see which changes landed, then try the rest again.", context: "proposed changes" }), field: null }] });
        await load();
        return;
      }
      const landed = d.results.filter((x) => x.ok).map((x) => changes.find((c) => c.id === x.id)?.summary ?? x.id);
      const failed = d.results.filter((x) => !x.ok);
      setOutcome({ landed, failed: failed.length });
      setProblems(Object.fromEntries(failed.map((x) => [x.id, [{ error: x.error ?? "", field: x.field ?? null }]])));
      if (failed.length) setOpen((o) => ({ ...o, ...Object.fromEntries(list.map((c) => [c.batchId, true])) }));
      await load();
    } finally {
      setBusy(false);
    }
  };

  const discard = async (list: Proposal[]) => {
    if (!list.length) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/proposals/discard", { method: "POST", headers: headers(), body: JSON.stringify({ ids: list.map((c) => c.id) }) });
      if (!r.ok) {
        setProblems({ _page: [{ error: t({ message: "Those could not be discarded. Reload and try again.", context: "proposed changes" }), field: null }] });
        return;
      }
      setOutcome(null);
      setProblems({});
      await load();
    } finally {
      setBusy(false);
    }
  };

  // ── What the filters offer, from what is on the page ─────────────────────
  const facesHere = useMemo(() => {
    const here = new Set<ChangeFace>([...changes.map((c) => faceOf(c.kind, c.route)), ...decided.map(faceOfDecided)]);
    return CHANGE_FACES.filter((f) => here.has(f));
  }, [changes, decided]);
  const pagesHere = useMemo(() => Array.from(new Set([...changes, ...decided].map((c) => c.where?.label ?? "").filter(Boolean))).sort(), [changes, decided]);
  const whoHere = useMemo(() => Array.from(new Set([...batches.map((b) => b.by), ...decided.map((d) => d.proposedBy ?? "")].filter(Boolean))).sort(), [batches, decided]);

  const keep = (c: { kind?: Proposal["kind"]; route?: { method: string; path: string }; where?: { label: string } }, by: string) =>
    (!kind || faceOf(c.kind ?? "setting", c.route ?? { method: "PUT", path: "" }) === kind) && (!page || c.where?.label === page) && (!who || by === who);

  // Waiting first, newest batch first.
  const waiting = useMemo(
    () =>
      [...batches]
        .sort((a, b) => b.at.localeCompare(a.at))
        .map((b) => ({ batch: b, items: changes.filter((c) => c.batchId === b.id && keep(c, b.by)) }))
        .filter((g) => g.items.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [batches, changes, kind, page, who],
  );

  // The history, by batch, the batch decided most recently first.
  const history = useMemo(() => {
    const groups = new Map<string, Decided[]>();
    for (const d of decided) {
      if (!keep(d, d.proposedBy ?? "")) continue;
      const key = d.batchId ?? d.id;
      groups.set(key, [...(groups.get(key) ?? []), d]);
    }
    return Array.from(groups.entries()).map(([key, items]) => ({ key, items }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decided, kind, page, who]);

  // The newest waiting batch opens by itself; the rest fold until asked.
  const firstWaiting = waiting[0]?.batch.id;
  const isOpen = (id: string) => open[id] ?? id === firstWaiting;

  const showWaiting = status !== "decided";
  const showDecided = status !== "waiting";
  const filtered = !!(kind || page || who);

  return (
    <Layout>
      <div className={`${WORLD} pb-16 pt-8 sm:pt-12`}>
        <div className="mx-auto max-w-6xl space-y-6 px-4">
          <header className="space-y-3">
            <p className={EYEBROW}>
              <Trans context="proposed changes">Review</Trans>
            </p>
            <h1 className={H1}>
              <Trans context="proposed changes">Proposed changes</Trans>
            </h1>
            <p className={LEDE}>
              <Trans context="proposed changes">Nothing here is live until you accept it. Each batch shows what changes and where it lands. Edit any words first; your edits save as you type.</Trans>
            </p>
          </header>

          {signedOut && (
            <p className={HINT}>
              <Link href="/login" className={LINK}>
                <Trans context="proposed changes">Sign in to review proposed changes</Trans>
              </Link>
            </p>
          )}
          {state === "refused" && (
            <p className={HINT} data-testid="proposals-refused">
              <Trans context="proposed changes">This page is for admins and for the people who hold the powers these changes need.</Trans>
            </p>
          )}
          {state === "failed" && (
            <p className={HINT}>
              <Trans context="proposed changes">The proposed changes could not be read. Reload to try again.</Trans>
            </p>
          )}

          {state === "ok" && (changes.length > 0 || decided.length > 0) && (
            <section aria-label={t({ message: "Filter the changes", context: "proposed changes" })} className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-4" data-testid="filters">
              <label className="flex min-w-0 flex-col gap-1">
                <span className={LABEL}>
                  <Trans context="proposed changes: filter">Show</Trans>
                </span>
                <select className={`${FIELD} min-h-11`} value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} data-testid="filter-status">
                  <option value="all">{t({ message: "Waiting and decided", context: "proposed changes: filter" })}</option>
                  <option value="waiting">{t({ message: "Waiting", context: "proposed changes: filter" })}</option>
                  <option value="decided">{t({ message: "Decided", context: "proposed changes: filter" })}</option>
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1">
                <span className={LABEL}>
                  <Trans context="proposed changes: filter">Kind</Trans>
                </span>
                <select className={`${FIELD} min-h-11`} value={kind} onChange={(e) => setKind(e.target.value as ChangeFace | "")} data-testid="filter-kind">
                  <option value="">{t({ message: "Every kind", context: "proposed changes: filter" })}</option>
                  {facesHere.map((f) => (
                    <option key={f} value={f}>
                      {faceWords(i18n, f)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1">
                <span className={LABEL}>
                  <Trans context="proposed changes: filter">Page</Trans>
                </span>
                <select className={`${FIELD} min-h-11`} value={page} onChange={(e) => setPage(e.target.value)} data-testid="filter-page">
                  <option value="">{t({ message: "Every page", context: "proposed changes: filter" })}</option>
                  {pagesHere.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1">
                <span className={LABEL}>
                  <Trans context="proposed changes: filter">From</Trans>
                </span>
                <select className={`${FIELD} min-h-11`} value={who} onChange={(e) => setWho(e.target.value)} data-testid="filter-who">
                  <option value="">{t({ message: "Anyone", context: "proposed changes: filter" })}</option>
                  {whoHere.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </label>
            </section>
          )}

          {outcome && (
            <div className={`${CARD} space-y-2`} role="status" data-testid="accept-outcome">
              <p className="font-display text-xl font-bold text-card-foreground">
                {outcome.failed ? (
                  <Trans context="proposed changes">{outcome.landed.length} accepted, {outcome.failed} did not land</Trans>
                ) : (
                  <Trans context="proposed changes">{outcome.landed.length} accepted</Trans>
                )}
              </p>
              {outcome.landed.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-sm text-foreground marker:text-notice">
                  {outcome.landed.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              )}
              {outcome.failed > 0 && (
                <p className={HINT}>
                  <Trans context="proposed changes">The ones that did not land are still below, each with its reason. Fix them and accept again.</Trans>
                </p>
              )}
            </div>
          )}
          {(problems._page ?? []).map((p, i) => (
            <p key={i} role="alert" className="rounded-xl border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {p.error}
            </p>
          ))}

          {showWaiting && state === "ok" && (
            <section className="space-y-5" aria-labelledby="waiting-heading">
              <h2 id="waiting-heading" className="sr-only">
                <Trans context="proposed changes">Waiting</Trans>
              </h2>
              {waiting.length === 0 && (
                <div className={CARD}>
                  <p className={HINT}>
                    {filtered ? (
                      <Trans context="proposed changes">Nothing waiting matches these filters.</Trans>
                    ) : (
                      <Trans context="proposed changes">Nothing is waiting. When an agent proposes a change, it appears here.</Trans>
                    )}
                  </p>
                </div>
              )}
              {waiting.map(({ batch, items }) => (
                <BatchCard
                  key={batch.id}
                  batch={batch}
                  items={items}
                  zone={zone}
                  expanded={isOpen(batch.id)}
                  onToggle={() => setOpen((o) => ({ ...o, [batch.id]: !isOpen(batch.id) }))}
                  busy={busy}
                  onAcceptAll={() => void accept(items)}
                  onDiscardAll={() => void discard(items)}
                  renderChange={(c) => (
                    <ChangeCard
                      key={c.id}
                      change={c}
                      body={edits[c.id] ?? c.body}
                      zone={zone}
                      problems={problems[c.id] ?? []}
                      saved={saved[c.id]}
                      busy={busy}
                      checkedPage={!!checkedPage[c.id]}
                      onCheckedPage={(v) => setCheckedPage((p) => ({ ...p, [c.id]: v }))}
                      onEdit={(path, next) => edit(c.id, path, next)}
                      onAccept={() => void accept([c])}
                      onDiscard={() => void discard([c])}
                    />
                  )}
                />
              ))}
            </section>
          )}

          {showDecided && state === "ok" && (decided.length > 0 || status === "decided") && (
            <section className="space-y-5 pt-4" aria-labelledby="decided-heading">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  <Trans context="proposed changes">History</Trans>
                </p>
                <h2 id="decided-heading" className="font-display text-2xl text-foreground">
                  <Trans context="proposed changes">Recently decided</Trans>
                </h2>
              </div>
              {history.length === 0 && (
                <p className={HINT}>
                  <Trans context="proposed changes">Nothing decided matches these filters.</Trans>
                </p>
              )}
              {history.map(({ key, items }) => (
                <HistoryBatch
                  key={key}
                  title={items[0]?.batchTitle ?? ""}
                  by={items[0]?.proposedBy}
                  byKind={items[0]?.proposedByKind}
                  items={items}
                  zone={zone}
                  renderDecided={(d) => <DecidedCard key={d.id} d={d} zone={zone} onPutBack={putBack} />}
                />
              ))}
            </section>
          )}
        </div>
      </div>
    </Layout>
  );
}
