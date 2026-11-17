/**
 * A BATCH, AS A CARD (the lead, 16 Nov 2026: "show more like role cards in that design to make it easier for me to
 * understand the batching"). The role card's shape: on the left, the batch as a seat (its title, who proposed it,
 * when, how many changes, where they land, the kinds as small tiles, and the two batch acts); on the right, its
 * changes. Laid out by the card's own width (container queries), so a phone reads it top to bottom.
 *
 * Folded, the right side lists each change in one line, and a press opens them all. "Accept all" and "Discard all"
 * ask once on the card itself before anything moves: no browser dialog, and the question names the count.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Plural, Trans, useLingui } from "@lingui/react/macro";
import { BTN_PRIMARY, BTN_SECONDARY, EYEBROW, HINT } from "@/components/journey/look";
import { faceOf, type ChangeFace } from "@shared/proposalReview";
import { ByWho, FaceTile, dayWords, faceWords } from "./ChangeCard";
import type { Batch, Decided, Proposal } from "./reviewTypes";

function joinWords(words: string[], locale: string): string {
  try {
    return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(words);
  } catch {
    return words.join(", ");
  }
}

/** The kinds in a batch, each with how many. */
function kindsOf(items: Array<{ kind: Proposal["kind"]; route: { method: string; path: string } }>): Array<{ face: ChangeFace; n: number }> {
  const out = new Map<ChangeFace, number>();
  for (const c of items) {
    const f = faceOf(c.kind, c.route);
    out.set(f, (out.get(f) ?? 0) + 1);
  }
  return Array.from(out.entries()).map(([face, n]) => ({ face, n }));
}

function Fact({ label, children, wide = false }: { label: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`min-w-0 rounded-xl bg-card px-3 py-2.5 ${wide ? "col-span-2" : ""}`}>
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-semibold leading-snug text-card-foreground">{children}</dd>
    </div>
  );
}

function KindTiles({ kinds }: { kinds: Array<{ face: ChangeFace; n: number }> }) {
  const { i18n } = useLingui();
  return (
    <ul className="flex flex-wrap gap-1.5" data-testid="batch-kinds">
      {kinds.map(({ face, n }) => (
        <li key={face} className="inline-flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3 text-sm text-card-foreground">
          <FaceTile face={face} size="sm" />
          {faceWords(i18n, face)}
          {n > 1 && <span className="text-muted-foreground">{n}</span>}
        </li>
      ))}
    </ul>
  );
}

type Confirming = "accept" | "discard" | null;

export interface BatchCardProps {
  batch: Batch;
  items: Proposal[];
  zone: string;
  expanded: boolean;
  onToggle: () => void;
  busy: boolean;
  onAcceptAll: () => void;
  onDiscardAll: () => void;
  renderChange: (c: Proposal) => ReactNode;
  /** How many of its changes a later waiting change also writes; the batch's one question says so. */
  laterConflicts?: number;
}

export default function BatchCard({ batch, items, zone, expanded, onToggle, busy, onAcceptAll, onDiscardAll, renderChange, laterConflicts = 0 }: BatchCardProps) {
  const { i18n, t } = useLingui();
  const [confirming, setConfirming] = useState<Confirming>(null);
  const yes = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirming) yes.current?.focus();
  }, [confirming]);
  const n = items.length;
  const places = Array.from(new Set(items.map((c) => c.where?.label ?? c.targetLabel).filter(Boolean)));
  const kinds = kindsOf(items);
  const listId = `batch-changes-${batch.id}`;
  const headingId = `batch-${batch.id}`;
  // A batch that waits on a check can still be put aside; accepting it whole waits for that check, on its card.
  const waitsOnCheck = items.some((c) => c.status === "unknown");

  return (
    <article className="sheet-night overflow-clip rounded-2xl border border-notice/40 bg-card shadow-sm" aria-labelledby={headingId} data-testid={`batch-${batch.id}`}>
      <div className="@container">
        <div className="grid @4xl:grid-cols-[19rem_minmax(0,1fr)]">
          <header className="min-w-0 border-b border-border bg-muted/40 p-5 @lg:p-6 @4xl:border-b-0 @4xl:border-r">
            {/* On a wide card the batch and its two acts stay in view while its changes are read. */}
            <div className="flex min-w-0 flex-col gap-4 @4xl:sticky @4xl:top-28">
            <div className="space-y-2">
              <p className={EYEBROW}>
                <Trans context="proposed changes: a batch">Waiting for you</Trans>
              </p>
              <h2 id={headingId} className="break-words font-display text-2xl leading-tight text-card-foreground @md:text-3xl">
                {batch.title}
              </h2>
              <p className="text-base leading-relaxed text-muted-foreground" data-testid="batch-summary">
                <Plural context="proposed changes: a batch" value={n} one="One change" other="# changes" />
                {places.length > 0 && (
                  <>
                    {", "}
                    <Trans context="proposed changes: a batch">landing on {joinWords(places, i18n.locale)}.</Trans>
                  </>
                )}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-2" data-testid="batch-facts">
              <Fact wide label={<Trans context="proposed changes: a batch fact">From</Trans>}>
                <ByWho name={batch.by} kind={batch.byKind} />
              </Fact>
              <Fact wide label={<Trans context="proposed changes: a batch fact">When</Trans>}>{dayWords(batch.at, zone, i18n.locale)}</Fact>
            </dl>
            <KindTiles kinds={kinds} />

            {confirming ? (
              <div className="space-y-3 rounded-xl border border-notice/60 bg-card p-4" role="group" aria-label={confirming === "accept" ? t({ message: "Confirm accepting the batch", context: "proposed changes" }) : t({ message: "Confirm discarding the batch", context: "proposed changes" })} data-testid="batch-confirm">
                <p className="font-semibold text-card-foreground">
                  {confirming === "accept" ? (
                    <Plural context="proposed changes: confirm a batch" value={n} one="Accept this change? It goes live now, as you." other="Accept all # changes? Each goes live now, one by one, as you." />
                  ) : (
                    <Plural context="proposed changes: confirm a batch" value={n} one="Discard this change? Nothing goes live." other="Discard all # changes? Nothing goes live." />
                  )}
                </p>
                {confirming === "accept" && laterConflicts > 0 && (
                  <p className="text-sm text-foreground" data-testid="batch-confirm-conflict">
                    <Plural context="proposed changes: confirm a batch" value={laterConflicts} one="A later change also edits one of these." other="A later change also edits # of these." />
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    ref={yes}
                    type="button"
                    className={confirming === "accept" ? BTN_PRIMARY : BTN_SECONDARY}
                    disabled={busy}
                    onClick={() => {
                      const act = confirming;
                      setConfirming(null);
                      if (act === "accept") onAcceptAll();
                      else onDiscardAll();
                    }}
                    data-testid="batch-confirm-yes"
                  >
                    {confirming === "accept" ? <Trans context="proposed changes: confirm a batch">Yes, accept</Trans> : <Trans context="proposed changes: confirm a batch">Yes, discard</Trans>}
                  </button>
                  <button type="button" className={BTN_SECONDARY} onClick={() => setConfirming(null)} data-testid="batch-confirm-no">
                    <Trans context="proposed changes: confirm a batch">Not yet</Trans>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <button type="button" className={`w-full ${BTN_PRIMARY}`} disabled={busy || waitsOnCheck} onClick={() => setConfirming("accept")} data-testid="batch-accept-all">
                  <Check className="size-4" aria-hidden="true" />
                  <Trans context="proposed changes: a batch">Accept all</Trans>
                </button>
                <button type="button" className={`w-full ${BTN_SECONDARY}`} disabled={busy} onClick={() => setConfirming("discard")} data-testid="batch-discard-all">
                  <X className="size-4" aria-hidden="true" />
                  <Trans context="proposed changes: a batch">Discard all</Trans>
                </button>
                {waitsOnCheck && (
                  <p className={HINT}>
                    <Trans context="proposed changes: a batch">One change waits on a check. Accept it on its own card first.</Trans>
                  </p>
                )}
              </div>
            )}
            </div>
          </header>

          <div className="min-w-0 space-y-4 p-4 @lg:p-6">
            <button type="button" className={`${BTN_SECONDARY} w-full justify-between @lg:w-auto`} onClick={onToggle} aria-expanded={expanded} aria-controls={listId} data-testid={`batch-toggle-${batch.id}`}>
              {expanded ? <Trans context="proposed changes: a batch">Fold the changes</Trans> : <Trans context="proposed changes: a batch">Open the changes</Trans>}
              <ChevronDown className={`size-4 motion-safe:transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            <div id={listId}>
              {expanded ? (
                <div className="space-y-4">{items.map((c) => renderChange(c))}</div>
              ) : (
                <ul className="grid gap-2">
                  {items.map((c) => {
                    const face = faceOf(c.kind, c.route);
                    return (
                      <li key={c.id}>
                        <button type="button" onClick={onToggle} className="flex min-h-11 w-full min-w-0 items-center gap-3 rounded-xl border border-border bg-muted p-3 text-left hover:border-notice focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" data-testid={`row-${c.id}`}>
                          <FaceTile face={face} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block break-words font-semibold text-card-foreground">{c.summary}</span>
                            <span className="block text-sm text-muted-foreground">
                              {faceWords(i18n, face)}
                              {c.where ? ` · ${c.where.label}` : ""}
                              {c.status === "failed" ? (
                                <span className="text-destructive">
                                  {" · "}
                                  <Trans context="proposed changes">Did not land</Trans>
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

/** A batch in the history: its decided changes, newest first. */
export function HistoryBatch({ title, by, byKind, items, zone, renderDecided }: { title: string; by?: string; byKind?: "agent" | "person"; items: Decided[]; zone: string; renderDecided: (d: Decided) => ReactNode }) {
  const { i18n } = useLingui();
  const took = items.filter((d) => d.status === "accepted").length;
  const kinds = kindsOf(items.map((d) => ({ kind: d.kind ?? "setting", route: d.route ?? { method: "PUT", path: "" } })));
  return (
    <article className="sheet-night overflow-hidden rounded-2xl border border-border bg-card shadow-sm" data-testid="history-batch">
      <div className="@container">
        <div className="grid @4xl:grid-cols-[19rem_minmax(0,1fr)]">
          <header className="flex min-w-0 flex-col gap-3 border-b border-border bg-muted/40 p-5 @lg:p-6 @4xl:border-b-0 @4xl:border-r">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <Trans context="proposed changes: a batch">Decided</Trans>
            </p>
            <h3 className="break-words font-display text-xl leading-tight text-card-foreground @md:text-2xl">{title || <Trans context="proposed changes">A batch</Trans>}</h3>
            <p className="text-sm text-muted-foreground">
              <Trans context="proposed changes: a batch">
                {took} accepted, {items.length - took} discarded
              </Trans>
            </p>
            {by && (
              <dl className="grid grid-cols-2 gap-2">
                <Fact wide label={<Trans context="proposed changes: a batch fact">From</Trans>}>
                  <ByWho name={by} kind={byKind} />
                </Fact>
                <Fact wide label={<Trans context="proposed changes: a batch fact">Last decided</Trans>}>{dayWords(items[0]?.at, zone, i18n.locale)}</Fact>
              </dl>
            )}
            <KindTiles kinds={kinds} />
          </header>
          <div className="min-w-0 space-y-4 p-4 @lg:p-6">{items.map((d) => renderDecided(d))}</div>
        </div>
      </div>
    </article>
  );
}
