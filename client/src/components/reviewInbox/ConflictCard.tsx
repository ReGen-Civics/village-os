/**
 * ONE CARD FOR SEVERAL SUGGESTIONS FOR ONE THING (docs/REVIEW_INBOX_PLAN.md, "A conflict card"; the lead, 25 Nov 2026:
 * conflicts block, one card, one accept).
 *
 * Each option is drawn against what is live now and credited to who proposed it. Nothing is preselected: the person
 * picks one, Accept asks once, and the options it collides with are set aside by the server, recorded as another
 * option chosen. A stale option shows See what is live now first. Editing an option's words stays on its own page.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Check, Eye, X } from "lucide-react";
import { Plural, Trans, useLingui } from "@lingui/react/macro";
import { BTN_PRIMARY, BTN_SECONDARY, CHIP_SOFT, HINT, LINK } from "@/components/journey/look";
import { ByWho, ChangeBody, ConflictFlags, dayWords } from "@/components/proposals/ChangeCard";
import CodeChip from "@/components/proposals/CodeChip";
import type { Proposal } from "@/components/proposals/reviewTypes";
import { faceOf, flagsOf } from "@shared/proposalReview";
import type { ConflictWith } from "@shared/proposalConflicts";
import type { ConnectorDesk } from "./useConnectorDesk";

export default function ConflictCard({ options, links, desk }: { options: Proposal[]; links: Record<string, ConflictWith[]>; desk: ConnectorDesk }) {
  const { t, i18n } = useLingui();
  const [chosen, setChosen] = useState<string | null>(null);
  const [asking, setAsking] = useState<"accept" | "discard" | null>(null);
  const yes = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (asking) yes.current?.focus();
  }, [asking]);
  const first = options[0]!;
  const pick = options.find((o) => o.id === chosen) ?? null;
  const pickNumber = pick ? options.indexOf(pick) + 1 : 0;
  const over = pick ? (links[pick.id] ?? []).map((o) => o.id) : [];
  const mustLook = !!pick && (pick.stale ?? []).length > 0 && !desk.seenNow(pick);
  const total = options.length;
  const others = over.length;
  const name = `choose-${first.id}`;
  const where = first.where?.label || first.targetLabel;
  const problems = options.flatMap((o) => desk.problems[o.id] ?? []);

  return (
    <article className="min-w-0 space-y-4 rounded-2xl border border-notice/60 bg-card p-4 shadow-sm sm:p-5" data-testid={`conflict-card-${first.id}`} aria-labelledby={`${name}-title`}>
      <header className="space-y-1">
        <p className={`${CHIP_SOFT} inline-flex`}>
          <Trans context="review inbox: a conflict card">Choose one</Trans>
        </p>
        <h3 id={`${name}-title`} className="font-display text-xl text-card-foreground">
          <Plural context="review inbox: a conflict card" value={total} one="# suggestion for one thing" other="# suggestions for one thing" />
        </h3>
        <p className={HINT}>
          <Trans context="review inbox: a conflict card">Each one is drawn against what is live now on {where}. Accepting one sets the others aside.</Trans>
        </p>
      </header>

      <fieldset className="space-y-3">
        <legend className="sr-only">
          <Trans context="review inbox: a conflict card">The options</Trans>
        </legend>
        {options.map((o, i) => {
          const n = i + 1;
          const body = desk.edits[o.id] ?? o.body;
          const face = faceOf(o.kind, o.route);
          const whole = flagsOf(o.kind, o.route, o.target, body).includes("whole_document");
          const on = chosen === o.id;
          return (
            <div key={o.id} className={`space-y-3 rounded-xl border p-3 sm:p-4 ${on ? "border-notice ring-2 ring-notice" : "border-border"}`} data-testid={`option-${o.id}`}>
              <label className="flex min-h-11 cursor-pointer items-start gap-3">
                <input type="radio" name={name} value={o.id} checked={on} onChange={() => (setChosen(o.id), setAsking(null))} className="mt-1 size-5 accent-notice" />
                <span className="min-w-0 space-y-1">
                  <span className="block text-sm text-muted-foreground">
                    <Trans context="review inbox: a conflict card">Option {n} of {total}</Trans>
                    {o.code ? <CodeChip code={o.code} className="ml-2 align-middle" /> : null}
                  </span>
                  <span className="block font-semibold text-card-foreground">{o.summary}</span>
                  <span className="block text-sm text-muted-foreground">
                    <ByWho name={o.by} kind={o.byKind} /> · {dayWords(o.at, desk.zone, i18n.locale)}
                  </span>
                </span>
              </label>
              <ConflictFlags conflicts={[]} stale={o.stale ?? []} />
              <ChangeBody face={face} kind={o.kind} before={o.live} after={body} labels={o.labels} zone={desk.zone} whole={whole} />
              {o.code ? (
                <p className={HINT}>
                  <Link href={`/admin/proposals?find=${encodeURIComponent(o.code)}`} className={LINK}>
                    <Trans context="review inbox: a conflict card">Edit its words on its own page</Trans>
                  </Link>
                </p>
              ) : null}
            </div>
          );
        })}
      </fieldset>

      {problems.map((p, i) => (
        <p key={i} role="alert" className="rounded-xl border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {p.error}
        </p>
      ))}

      {asking ? (
        <div className="space-y-3 rounded-xl border border-notice/60 bg-card p-4" role="group" aria-label={t({ context: "review inbox: a conflict card", message: "Confirm your choice" })} data-testid={`conflict-ask-${first.id}`}>
          <p className="font-semibold text-card-foreground">
            {asking === "accept" ? (
              <>
                <Trans context="review inbox: a conflict card">Accept option {pickNumber}.</Trans>{" "}
                <Plural context="review inbox: a conflict card" value={others} one="The other option is recorded as another option chosen." other="The # other options are recorded as another option chosen." />
              </>
            ) : (
              <Plural context="review inbox: a conflict card" value={total} one="Discard this option? Nothing goes live." other="Discard all # options? Nothing goes live." />
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              ref={yes}
              type="button"
              className={asking === "accept" ? BTN_PRIMARY : BTN_SECONDARY}
              disabled={desk.busy}
              data-testid={`conflict-yes-${first.id}`}
              onClick={() => {
                const act = asking;
                setAsking(null);
                if (act === "accept" && pick) void desk.accept(pick, { over });
                else if (act === "discard") void desk.discard(options.map((o) => o.id));
              }}
            >
              {asking === "accept" ? <Trans context="review inbox: a conflict card">Yes, accept it</Trans> : <Trans context="review inbox: a conflict card">Yes, discard</Trans>}
            </button>
            <button type="button" className={BTN_SECONDARY} onClick={() => setAsking(null)}>
              <Trans context="review inbox: a conflict card">Not yet</Trans>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          {mustLook ? (
            <button type="button" className={BTN_PRIMARY} disabled={desk.busy} onClick={() => void desk.seeLive(pick!.id)} data-testid={`conflict-see-live-${first.id}`}>
              <Eye className="size-4" aria-hidden="true" />
              <Trans context="proposed changes: conflict">See what is live now</Trans>
            </button>
          ) : (
            <button type="button" className={BTN_PRIMARY} disabled={desk.busy || !pick} onClick={() => setAsking("accept")} data-testid={`conflict-accept-${first.id}`}>
              <Check className="size-4" aria-hidden="true" />
              <Trans context="review inbox: a conflict card">Accept this option</Trans>
            </button>
          )}
          <button type="button" className={BTN_SECONDARY} disabled={desk.busy} onClick={() => setAsking("discard")} data-testid={`conflict-discard-${first.id}`}>
            <X className="size-4" aria-hidden="true" />
            <Trans context="review inbox: a conflict card">Discard all options</Trans>
          </button>
          {!pick ? (
            <p className={`${HINT} w-full`}>
              <Trans context="review inbox: a conflict card">Pick an option to accept it.</Trans>
            </p>
          ) : null}
        </div>
      )}
    </article>
  );
}
