/**
 * ONE FIELD, BEFORE AND AFTER (the draft page, PR B). Drawn from the server's runs, never diffed here.
 *
 * Words: a Before line with what goes struck through, and an After line with what comes underlined. Lists: one row per
 * line, marked + or − with the words "Added" and "Removed" for a screen reader. Never colour alone: the strike, the
 * underline, the symbol and the label each say it without colour.
 */
import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import type { DiffRun } from "@shared/orgDraftDiff";
import type { DraftFieldView } from "@shared/orgDraftView";

/** The card's own words for the fields a draft most often changes. Anything else shows the server's label. */
const FIELD: Record<string, MessageDescriptor> = {
  name: msg({ context: "draft page: a field", message: "Role title" }),
  aim: msg({ context: "draft page: a field", message: "Purpose" }),
  domain: msg({ context: "draft page: a field", message: "What it looks after" }),
  accountabilities: msg({ context: "draft page: a field", message: "What you can count on me for" }),
  whyItMatters: msg({ context: "draft page: a field", message: "Why it matters" }),
  circleId: msg({ context: "draft page: a field", message: "Circle" }),
  termsOffer: msg({ context: "draft page: a field", message: "Pay and terms" }),
  authorities: msg({ context: "draft page: a field", message: "What I decide on my own" }),
  responsibilities: msg({ context: "draft page: a field", message: "What I do regularly" }),
  existsWhile: msg({ context: "draft page: a field", message: "This role exists while" }),
  timeCommitment: msg({ context: "draft page: a field", message: "Time it takes" }),
  bringMe: msg({ context: "draft page: a field", message: "Bring me" }),
  notMine: msg({ context: "draft page: a field", message: "Not mine to hold" }),
};

export function useFieldLabel() {
  const { i18n } = useLingui();
  return (field: string, fallback: string) => (FIELD[field] ? i18n._(FIELD[field]) : fallback);
}

const LABEL = "text-xs font-semibold uppercase tracking-widest text-muted-foreground";
const DEL = "rounded bg-destructive/15 px-0.5 text-foreground line-through decoration-2";
const INS = "rounded bg-open/20 px-0.5 text-foreground underline decoration-2 underline-offset-2";

function WordLine({ runs, side }: { runs: DiffRun[]; side: "del" | "add" }) {
  const { t } = useLingui();
  const gone = t({ context: "draft page: read aloud before removed words", message: "removed:" });
  const came = t({ context: "draft page: read aloud before added words", message: "added:" });
  return (
    <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground">
      {runs
        .filter((r) => r.op === "same" || r.op === side)
        .map((r, i) =>
          r.op === "same" ? (
            <span key={i}>{r.text}</span>
          ) : side === "del" ? (
            <del key={i} className={DEL}>
              <span className="sr-only">{gone} </span>
              {r.text}
            </del>
          ) : (
            <ins key={i} className={INS}>
              <span className="sr-only">{came} </span>
              {r.text}
            </ins>
          ),
        )}
    </p>
  );
}

function Lines({ runs }: { runs: DiffRun[] }) {
  return (
    <ul className="space-y-1">
      {runs.map((r, i) => (
        <li
          key={i}
          className={`flex gap-3 rounded-lg px-3 py-2 text-base ${r.op === "add" ? "bg-open/15 text-foreground" : r.op === "del" ? "bg-destructive/10 text-foreground" : "text-muted-foreground"}`}
        >
          <span aria-hidden="true" className="w-3 shrink-0 font-bold">
            {r.op === "add" ? "+" : r.op === "del" ? "−" : ""}
          </span>
          <span className={r.op === "del" ? "line-through decoration-2" : undefined}>
            {r.op === "add" ? (
              <span className="sr-only">
                <Trans context="draft page: a list line, read aloud">Added:</Trans>{" "}
              </span>
            ) : r.op === "del" ? (
              <span className="sr-only">
                <Trans context="draft page: a list line, read aloud">Removed:</Trans>{" "}
              </span>
            ) : null}
            {r.text}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Before and after of one field. `fresh` draws a new role's field as its words alone. */
export default function FieldDiff({ field, fresh = false }: { field: DraftFieldView; fresh?: boolean }) {
  if (field.hidden) {
    return (
      <p className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground">
        <Trans context="draft page">The terms on offer change in this draft. Only people who may read a role's terms see how.</Trans>
      </p>
    );
  }
  if (field.shape === "list") {
    if (fresh) {
      return (
        <ul className="list-disc space-y-1 pl-5 text-base text-foreground">
          {(Array.isArray(field.after) ? field.after : field.after ? [field.after] : []).map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      );
    }
    return <Lines runs={field.runs} />;
  }
  if (fresh) return <p className="whitespace-pre-wrap text-base text-foreground">{String(field.after ?? "")}</p>;
  const hadBefore = field.before !== null && field.before !== "";
  const hasAfter = field.after !== null && field.after !== "";
  return (
    <div className="space-y-2">
      <div>
        <p className={LABEL}>
          <Trans context="draft page: a field's old words">Before</Trans>
        </p>
        {hadBefore ? (
          <WordLine runs={field.runs} side="del" />
        ) : (
          <p className="text-base italic text-muted-foreground">
            <Trans context="draft page">Empty</Trans>
          </p>
        )}
      </div>
      <div>
        <p className={LABEL}>
          <Trans context="draft page: a field's new words">After</Trans>
        </p>
        {hasAfter ? (
          <WordLine runs={field.runs} side="add" />
        ) : (
          <p className="text-base italic text-muted-foreground">
            <Trans context="draft page">Empty</Trans>
          </p>
        )}
      </div>
    </div>
  );
}

/** How the live card moved on this field since the draft was written (0436), base to live now. */
export function MovedNote({ field }: { field: DraftFieldView }) {
  if (!field.moved) return null;
  return (
    <div className="space-y-2 rounded-lg border-2 border-notice/60 p-3" role="note">
      <p className="text-sm font-semibold text-foreground">
        <Trans context="draft page">The live card changed here after this draft was written. Publishing writes the draft's words over these newer ones.</Trans>
      </p>
      {field.hidden ? null : field.shape === "list" ? <Lines runs={field.movedRuns} /> : <WordLine runs={field.movedRuns} side="add" />}
    </div>
  );
}
