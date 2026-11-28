/**
 * THE DOCK'S OWN PIECES (GuideDock.tsx draws them): a change the guide
 * prepared for the page's Save, a change she drafted for the review page, her
 * advice on a setting a person changes by hand, the
 * choice between the village's guide and Sera, what the launch and organizing
 * guides say they read, and her face. (How an address in a reply is drawn is
 * ./replyLinks.tsx.)
 *
 * Every word on them comes from ./dockWords.tsx, in the person's own setting
 * (warm and plain, or brief and quiet). The helper panel keeps its own card
 * and its own words (../helperPieces.tsx): with the village's dock off,
 * nothing a person reads has changed.
 *
 * Tokens only, on the garden's night.
 */
import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Trans, useLingui } from "@lingui/react/macro";
import type { HelperAdvice, HelperFiled, HelperFiling, HelperProposal, HelperProvider } from "@shared/adminHelper";
import { GARDEN_GUIDE_URL } from "@shared/gardenArt";
import type { GuideConsulted } from "../adminHelperApi";
import { proposalHref, secondaryBtn, type ProposalState } from "../helperPieces";
import { goTo } from "../search/adminSearchModel";
import type { DockWords } from "./dockWords";

export const primaryBtn =
  "inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * A CHANGE SHE PREPARED: one dial, with what it is now and what it would
 * become. She prepared it and nothing more: "Review and save" puts it ready
 * at the bottom of the page, and only a person's Save there writes it. The
 * words say so in that order (what she did, what she left).
 */
export function PreparedCard({
  proposal,
  state,
  words,
  onReview,
  onUnreview,
  onDrop,
}: {
  proposal: HelperProposal;
  /** waiting: ready at the bottom of the page for a person's Save; saved: a person saved it. */
  state: ProposalState;
  words: DockWords["card"];
  onReview: () => void;
  onUnreview: () => void;
  onDrop: () => void;
}) {
  if (state === "dropped") return <p className="mt-2 text-xs text-muted-foreground">{words.left}</p>;
  const href = proposalHref(proposal);
  const there = (
    <a
      href={href}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        goTo(href);
      }}
      className={secondaryBtn}
    >
      {words.open}
    </a>
  );
  return (
    <div data-testid="helper-proposal" className="mt-2 rounded-xl border border-border bg-card p-3 text-sm">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{words.eyebrow}</p>
      <p className="mt-1 font-semibold text-foreground">{proposal.label}</p>
      <p className="text-xs text-muted-foreground">{proposal.category}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-muted-foreground">{words.now}</dt>
        <dd className="break-words font-mono text-foreground line-through decoration-muted-foreground">{proposal.from || words.blank}</dd>
        <dt className="text-muted-foreground">{words.becomes}</dt>
        <dd className="break-words font-mono font-semibold text-foreground">{proposal.to || words.blank}</dd>
      </dl>
      {proposal.why && <p className="mt-2 text-muted-foreground">{proposal.why}</p>}
      {state === "saved" ? (
        <p className="mt-2 flex items-center gap-1 font-medium text-open">
          <Check className="h-4 w-4" aria-hidden="true" />
          {words.saved}
        </p>
      ) : state === "waiting" ? (
        <>
          <p role="status" className="mt-2 text-foreground">
            {words.waiting}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={onUnreview} className={secondaryBtn}>
              {words.setAside}
            </button>
            {there}
          </div>
        </>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={onReview} className={primaryBtn}>
            {words.review}
          </button>
          <button type="button" onClick={onDrop} className={secondaryBtn}>
            {words.notNow}
          </button>
          {there}
        </div>
      )}
    </div>
  );
}

/** Where one drafted change stands. Absent: drawn, waiting on the person. */
export type FilingState =
  | { state: "sending" }
  | { state: "sent"; filed: HelperFiled }
  | { state: "failed"; error: string }
  | { state: "dropped" };

/**
 * A CHANGE SHE DRAFTED FOR REVIEW: it is not a dial, so the one press here
 * sends it to the review page, where a person accepts it. Nothing is applied
 * by the press, and the words say so before and after.
 */
export function FilingCard({
  filing,
  state,
  words,
  left,
  notNow,
  onSend,
  onDrop,
}: {
  filing: HelperFiling;
  state: FilingState | undefined;
  words: DockWords["draft"];
  /** Said where the draft was declined, and on the button that declines it: the prepared change's own words. */
  left: string;
  notNow: string;
  onSend: () => void;
  onDrop: () => void;
}) {
  if (state?.state === "dropped") return <p className="mt-2 text-xs text-muted-foreground">{left}</p>;
  const sent = state?.state === "sent" ? state.filed : null;
  const code = sent?.code ?? "";
  return (
    <div data-testid="guide-filing" className="mt-2 rounded-xl border border-border bg-card p-3 text-sm">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{words.eyebrow}</p>
      <p className="mt-1 break-words font-semibold text-foreground">{filing.summary}</p>
      <p className="text-xs text-muted-foreground">{filing.where}</p>
      {filing.fields.length > 0 && (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {filing.fields.map((f, i) => (
            <div key={i} className="contents">
              <dt className="text-muted-foreground">{f.label}</dt>
              <dd className="whitespace-pre-wrap break-words text-foreground">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {sent ? (
        <>
          <p role="status" className={`mt-2 flex items-start gap-1 font-medium ${sent.state === "filed" ? "text-open" : "text-foreground"}`}>
            {sent.state === "filed" && <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
            {/* Held: the review page's own reason where it gave one. */}
            <span>{sent.state === "held" ? sent.words || words.held : sent.state === "waiting" ? words.already(code) : words.sent(code)}</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={sent.reviewAt} className={secondaryBtn}>
              {words.openReview}
            </a>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-muted-foreground">{words.note}</p>
          {state?.state === "failed" && <p role="alert" className="mt-2 text-destructive">{state.error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={onSend} disabled={state?.state === "sending"} className={primaryBtn}>
              {state?.state === "sending" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {words.send}
            </button>
            <button type="button" onClick={onDrop} disabled={state?.state === "sending"} className={secondaryBtn}>
              {notNow}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * HER ADVICE ON ONE SETTING (the founder, 27 Nov 2026: she may advise and
 * suggest on money, pay, votes and signatures; the act stays a person's).
 * What the setting holds now, the value she would set when the server kept
 * one, and her reason. It prepares nothing: there is no apply, no save and
 * nothing waiting, and the one control takes the person to the setting's own
 * place, reached from its key the way a prepared change's is. Every field but
 * the reason and the value was read by the server from the setting itself
 * (shared/adminHelper.ts, `buildAdvice`). The reason is the model's text, so
 * it is drawn as plain words and never as a link.
 */
export function AdviceCard({
  advice,
  words,
  card,
}: {
  advice: HelperAdvice;
  words: DockWords["advice"];
  /** The prepared change's own words for what a setting holds, an empty value, and the way to its place. */
  card: Pick<DockWords["card"], "now" | "blank" | "open">;
}) {
  const href = proposalHref(advice);
  return (
    <div data-testid="guide-advice" className="mt-2 rounded-xl border border-border bg-card p-3 text-sm">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{words.eyebrow}</p>
      <p className="mt-1 break-words font-semibold text-foreground">{advice.label}</p>
      <p className="text-xs text-muted-foreground">{advice.category}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-muted-foreground">{card.now}</dt>
        <dd className="break-words font-mono text-foreground">{advice.now || card.blank}</dd>
        {advice.suggested !== null && (
          <>
            <dt className="text-muted-foreground">{words.wouldSet}</dt>
            <dd className="break-words font-mono font-semibold text-foreground">{advice.suggested || card.blank}</dd>
          </>
        )}
      </dl>
      {advice.why && <p className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">{advice.why}</p>}
      <p className="mt-2 text-foreground">{words.nothing}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={href}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            goTo(href);
          }}
          className={secondaryBtn}
        >
          {card.open}
        </a>
      </div>
    </div>
  );
}

/**
 * The village's guide or Sera, when both can answer, each under the name the
 * village knows it by. Switching mid-conversation is fine: the next answer
 * comes from the pick.
 */
export function GuideChoice({
  available,
  names,
  chosen,
  onPick,
}: {
  available: readonly HelperProvider[];
  /** The name each answers under, already in the reader's language. */
  names: Record<HelperProvider, string>;
  chosen: HelperProvider | null;
  onPick: (p: HelperProvider) => void;
}) {
  const { t } = useLingui();
  return (
    <div
      role="radiogroup"
      aria-label={t({ message: "Who you're talking to", context: "guide dock, the choice between the village's guide and Sera" })}
      className="inline-flex max-w-full flex-wrap rounded-3xl border border-border p-0.5"
    >
      {available.map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={chosen === p}
          onClick={() => onPick(p)}
          className={`min-h-11 max-w-full truncate rounded-full px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${chosen === p ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}
        >
          {names[p]}
        </button>
      ))}
    </div>
  );
}

/** What the launch or organizing guide read for an answer, in the words its own panel always used. */
export function ConsultedLine({ consulted }: { consulted: GuideConsulted | undefined }) {
  const c = consulted;
  if (!c) return null;
  const any = (c.brief?.length ?? 0) + (c.ownRecord?.length ?? 0) + (c.readers?.length ?? 0) + (c.references?.length ?? 0) > 0;
  if (!any) return null;
  return (
    <p className="mt-1.5 border-t border-border pt-1 text-xs text-muted-foreground">
      {(c.brief?.length ?? 0) > 0 && <><Trans context="what the launch guide read">Your brief: {(c.brief ?? []).join("; ")}.</Trans>{" "}</>}
      {(c.ownRecord?.length ?? 0) > 0 && <><Trans context="what the launch guide read">Your calls: {(c.ownRecord ?? []).join("; ")}.</Trans>{" "}</>}
      {(c.readers?.length ?? 0) > 0 && <><Trans>Read from the village record: {(c.readers ?? []).join("; ")}.</Trans>{" "}</>}
      {(c.references?.length ?? 0) > 0 && <Trans context="what the launch guide read">References: {(c.references ?? []).join("; ")}.</Trans>}
    </p>
  );
}

/**
 * HER FACE: the guide's portrait in a round frame with the garden's gold ring
 * (`.gd-ring`, garden.css). Decoration, since her name stands beside it. Where
 * the painting cannot be shown (it failed to load, or the one answering is not
 * the village's own guide), the ring holds the first letter of the name.
 */
export function GuideFace({ name, portrait }: { name: string; portrait: boolean }) {
  const [failed, setFailed] = useState(false);
  const letter = name.trim().charAt(0).toUpperCase();
  return (
    <span className="gd-ring size-12 shrink-0" data-testid="guide-face">
      {portrait && !failed ? (
        <img src={GARDEN_GUIDE_URL} alt="" width={96} height={96} decoding="async" draggable={false} onError={() => setFailed(true)} />
      ) : (
        <span aria-hidden="true" className="font-display text-lg leading-none">
          {letter}
        </span>
      )}
    </span>
  );
}
