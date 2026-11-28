/**
 * THE DOCK'S OWN PIECES (GuideDock.tsx draws them): the card for a change the
 * guide drafted for the review page, her advice on a setting a person changes
 * by hand, the line that says who is answering and
 * the choice between the village's guide and Sera, what the launch and
 * organizing guides say they read, and her face. (How an address in a reply is
 * drawn is ./replyLinks.tsx.)
 *
 * The proposal card for a dial is the helper panel's own (../helperPieces).
 * Tokens only, so every piece follows the Admin palette and its night look.
 */
import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Trans, useLingui } from "@lingui/react/macro";
import type { HelperAdvice, HelperFiled, HelperFiling, HelperProvider } from "@shared/adminHelper";
import { GARDEN_GUIDE_URL } from "@shared/gardenArt";
import type { GuideConsulted } from "../adminHelperApi";
import { secondaryBtn, TakeMeThere } from "../helperPieces";

export const primaryBtn =
  "inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Where one drafted change stands. Absent: drawn, waiting on the person. */
export type FilingState =
  | { state: "sending" }
  | { state: "sent"; filed: HelperFiled }
  | { state: "failed"; error: string }
  | { state: "dropped" };

/**
 * A change the guide drafted that is not a dial: it cannot go on the save bar,
 * so the one press here sends it to the review page. Nothing is applied by the
 * press, and the card says so before and after.
 */
export function FilingCard({ filing, state, onSend, onDrop }: { filing: HelperFiling; state: FilingState | undefined; onSend: () => void; onDrop: () => void }) {
  if (state?.state === "dropped") {
    return <p className="mt-2 text-xs text-muted-foreground"><Trans context="admin helper, proposal">Left as it was.</Trans></p>;
  }
  const sent = state?.state === "sent" ? state.filed : null;
  const code = sent?.code ?? "";
  return (
    <div data-testid="guide-filing" className="mt-2 rounded-xl border border-border bg-card p-3 text-sm">
      <p className="text-xs uppercase tracking-wider text-muted-foreground"><Trans context="guide dock, a change drafted for the review page">Drafted for review</Trans></p>
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
            <span>
              {sent.state === "held" ? (
                sent.words || <Trans context="guide dock, a drafted change was held before review">Held before review. It waits under Held on the review page.</Trans>
              ) : sent.state === "waiting" ? (
                code ? (
                  <Trans context="guide dock, the same drafted change already waits">The same change already waits on the review page, as {code}.</Trans>
                ) : (
                  <Trans context="guide dock, the same drafted change already waits">The same change already waits on the review page.</Trans>
                )
              ) : code ? (
                <Trans context="guide dock, a drafted change was sent to review">Sent to review as {code}. Nothing changes until a person accepts it there.</Trans>
              ) : (
                <Trans context="guide dock, a drafted change was sent to review">Sent to review. Nothing changes until a person accepts it there.</Trans>
              )}
            </span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={sent.reviewAt} className={secondaryBtn}>
              <Trans context="guide dock, opens the review page">Open the review page</Trans>
            </a>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-muted-foreground">
            <Trans context="guide dock, what Send to review does">This goes to the review page. Nothing changes until a person accepts it there.</Trans>
          </p>
          {state?.state === "failed" && <p role="alert" className="mt-2 text-destructive">{state.error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={onSend} disabled={state?.state === "sending"} className={primaryBtn}>
              {state?.state === "sending" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              <Trans context="guide dock, files the drafted change into the review queue">Send to review</Trans>
            </button>
            <button type="button" onClick={onDrop} disabled={state?.state === "sending"} className={secondaryBtn}>
              <Trans context="admin helper, declines the proposed change">Not now</Trans>
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
 * What the setting holds now, the value she would set when she named one, and
 * her reason. It prepares nothing: there is no apply, no save and nothing for
 * the save bar, and the one button takes the person to the setting's own
 * place, reached from its key the way a prepared change's "Take me there" is.
 * Every field but the reason and the suggested value was read by the server
 * from the setting itself (shared/adminHelper.ts, `buildAdvice`), and the
 * reason is drawn as plain words, never as a link.
 */
export function AdviceCard({ advice }: { advice: HelperAdvice }) {
  const { t } = useLingui();
  const blank = t({ message: "(blank)", context: "admin helper, proposal: an empty value" });
  return (
    <div data-testid="guide-advice" className="mt-2 rounded-xl border border-border bg-card p-3 text-sm">
      <p className="text-xs uppercase tracking-wider text-muted-foreground"><Trans context="guide dock, the guide's advice on a setting a person changes">My advice</Trans></p>
      <p className="mt-1 break-words font-semibold text-foreground">{advice.label}</p>
      <p className="text-xs text-muted-foreground">{advice.category}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-muted-foreground"><Trans context="admin helper, proposal: current value">Now</Trans></dt>
        <dd className="break-words font-mono text-foreground">{advice.now || blank}</dd>
        {advice.suggested !== null && (
          <>
            <dt className="text-muted-foreground"><Trans context="guide dock, advice: the value the guide would set">I would set</Trans></dt>
            <dd className="break-words font-mono font-semibold text-foreground">{advice.suggested || blank}</dd>
          </>
        )}
      </dl>
      {advice.why && <p className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">{advice.why}</p>}
      <p className="mt-2 text-foreground">
        <Trans context="guide dock, advice: nothing was prepared and the person makes the change">I have prepared nothing here, and nothing has changed. If you agree, you make this change yourself.</Trans>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <TakeMeThere proposal={advice} />
      </div>
    </div>
  );
}

/**
 * Who is answering, said once under the heading, so an admin knows where
 * their words go (shared/guideChoice.ts: the page always says who is
 * answering). A key the platform lends is never called the village's own.
 */
export function WhoAnswers({ provider, name, lent }: { provider: HelperProvider; name: string; lent: boolean }) {
  return (
    <p className="text-xs text-muted-foreground" data-testid="guide-who-answers">
      {provider === "sera" ? (
        <Trans context="guide dock, who answers">{name} is answering, through your village's org memory connection.</Trans>
      ) : lent ? (
        <Trans context="guide dock, who answers">{name} is answering, on Claude with a key the platform lends for now.</Trans>
      ) : (
        <Trans context="guide dock, who answers">{name} is answering, on Claude with your village's own Anthropic key.</Trans>
      )}
    </p>
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
