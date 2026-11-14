/**
 * SHAPE THE ROLE, inside the application (Rye, 14 Nov 2026; approved mockup B,
 * https://claude.ai/artifact/NaavCsufyAEHKowgEdKFAX).
 *
 * The role's card, piece by piece, with three ways to answer each piece: "I'd change this",
 * "Something's missing" and "I'd deliver this as…". What the applicant writes travels with the
 * application (`pieceSuggestions`, shared/pieceSuggestions.ts), and the people who decide read it
 * beside the piece it is about. Optional: the application goes without it.
 *
 * Lives in its own file so ProposeARole.tsx only mounts it (coordinator, 14 Nov: that page sits at the
 * file-lines gate).
 */
import { lazy, Suspense, useId, useState } from "react";
import { ChevronDown, PencilLine, Plus, Sprout, X } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import { SUGGESTION_KINDS, SUGGESTION_LIMITS, SUGGESTION_WORDS, type PieceKey, type PieceSuggestion, type SuggestionKind } from "@shared/pieceSuggestions";
import { useOrgSeats } from "./useOrgSeat";

// The card loads only when it is opened, so the pages that mount this keep their own chunks and the
// first page never gains the card's imports (guard-boot-set, 14 Nov).
const FullRoleCard = lazy(() => import("./FullRoleCard"));

export type { PieceSuggestion };

const KIND_ICON: Record<SuggestionKind, typeof PencilLine> = { change: PencilLine, missing: Plus, deliver: Sprout };

/** One suggestion, as an applicant or a decider reads it. */
export function SuggestionLine({ s, onRemove }: { s: Pick<PieceSuggestion, "kind" | "text">; onRemove?: () => void }) {
  const { t } = useLingui();
  const Icon = KIND_ICON[s.kind];
  return (
    <li className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-start gap-2.5 rounded-r-xl border-l-4 border-notice bg-muted px-3 py-2.5" data-piece-suggestion={s.kind}>
      <Icon className="mt-0.5 size-4 text-notice" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block text-xs font-bold uppercase tracking-widest text-notice">{SUGGESTION_WORDS.kind[s.kind]}</span>
        <span className="mt-0.5 block whitespace-pre-wrap break-words text-card-foreground">{s.text}</span>
      </span>
      {onRemove ? (
        <button type="button" onClick={onRemove} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:text-card-foreground focus-visible:outline-2 focus-visible:outline-ring" aria-label={t({ message: "Remove this suggestion", context: "shape the role" })}>
          <X className="size-4" aria-hidden="true" />
        </button>
      ) : (
        <span />
      )}
    </li>
  );
}

function PieceBar({ roleId, piece, value, onChange }: { roleId: string; piece: PieceKey; value: PieceSuggestion[]; onChange: (next: PieceSuggestion[]) => void }) {
  const { t } = useLingui();
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [open, setOpen] = useState<SuggestionKind | null>(null);
  const [draft, setDraft] = useState("");
  const mine = value.filter((s) => s.roleId === roleId && s.piece === piece);
  const full = value.length >= SUGGESTION_LIMITS.total;
  const prompt: Record<SuggestionKind, string> = {
    change: t({ message: "What would you change, and why?", context: "shape the role prompt" }),
    missing: t({ message: "What is missing from this piece?", context: "shape the role prompt" }),
    deliver: t({ message: "How would you deliver this piece? What, and by when.", context: "shape the role prompt" }),
  };
  const add = () => {
    const text = draft.trim();
    if (!open || !text || full) return;
    onChange([...value, { roleId, piece, kind: open, text: text.slice(0, SUGGESTION_LIMITS.text) }]);
    setDraft("");
    setOpen(null);
  };
  return (
    <div className="flex flex-col gap-3 border-t border-dashed border-notice/50 pt-3" data-piece-bar={piece}>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t({ message: "Shape this piece", context: "shape the role" })}</p>
      <div className="flex flex-wrap gap-2">
        {SUGGESTION_KINDS.map((k) => {
          const Icon = KIND_ICON[k];
          return (
            <button
              key={k}
              type="button"
              disabled={full && open !== k}
              aria-expanded={open === k}
              aria-controls={`${id}-composer`}
              onClick={() => setOpen(open === k ? null : k)}
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-40 ${open === k ? "border-notice bg-notice text-background" : "border-notice/50 bg-muted text-notice hover:border-notice"}`}
            >
              <Icon className="size-4" aria-hidden="true" />
              {SUGGESTION_WORDS.kind[k]}
            </button>
          );
        })}
      </div>
      {open && (
        <div id={`${id}-composer`} className="grid gap-2 rounded-xl border border-notice/50 bg-muted p-3">
          <label htmlFor={`${id}-text`} className="text-sm font-semibold text-card-foreground">
            {prompt[open]}
          </label>
          <textarea id={`${id}-text`} rows={3} maxLength={SUGGESTION_LIMITS.text} value={draft} onChange={(e) => setDraft(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus-visible:outline-2 focus-visible:outline-ring" />
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setOpen(null)} className="min-h-10 rounded-lg px-3 text-sm text-muted-foreground hover:text-card-foreground">
              {t({ message: "Cancel", context: "shape the role" })}
            </button>
            <button type="button" onClick={add} disabled={!draft.trim()} className="min-h-10 rounded-lg border border-notice bg-notice px-4 text-sm font-semibold text-background disabled:opacity-40">
              {t({ message: "Add to my application", context: "shape the role" })}
            </button>
          </div>
        </div>
      )}
      {mine.length > 0 && (
        <ul className="grid gap-2">
          {mine.map((s) => (
            <SuggestionLine key={`${s.kind}-${s.text}`} s={s} onRemove={() => onChange(value.filter((x) => x !== s))} />
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ShapeTheRole({ roleId, value, onChange }: { roleId: string; value: PieceSuggestion[]; onChange: (next: PieceSuggestion[]) => void }) {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  const seats = useOrgSeats(open && roleId ? [roleId] : []);
  const found = seats[roleId];
  const count = value.filter((s) => s.roleId === roleId).length;
  if (!roleId) return null;
  return (
    <section className="rounded-2xl border border-notice/40 bg-card p-4 sm:p-5" aria-labelledby="shape-role-h" data-shape-the-role="">
      <h3 id="shape-role-h" className="font-display text-xl text-card-foreground">
        {t({ message: "Shape the role (optional)", context: "shape the role heading" })}
      </h3>
      <p className="mt-1 max-w-prose text-muted-foreground">
        {t({ message: "Read the role piece by piece. On any piece, say what you'd change, what's missing, or how you'd deliver it. It travels with your application, and the people who decide read it beside that piece.", context: "shape the role lede" })}
      </p>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-notice px-4 font-semibold text-card-foreground hover:bg-notice/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {open ? t({ message: "Close the role card", context: "shape the role" }) : t({ message: "Open the role card", context: "shape the role" })}
        <ChevronDown className={`size-4 motion-safe:transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {count > 0 && (
        <p className="mt-2 text-sm text-notice" role="status">
          {count === 1
            ? t({ message: "1 suggestion travels with your application.", context: "shape the role count, one" })
            : t({ message: `${count} suggestions travel with your application.`, context: "shape the role count, several" })}
        </p>
      )}
      {open && (
        <div className="mt-4">
          {found && found !== "missing" ? (
            <Suspense fallback={<p className="text-muted-foreground" role="status">{t({ message: "Opening the role card…", context: "shape the role" })}</p>}>
              <FullRoleCard seat={found.seat} circleName={found.circleName} register="founding" noAct after={(piece) => <PieceBar roleId={roleId} piece={piece as PieceKey} value={value} onChange={onChange} />} />
            </Suspense>
          ) : found === "missing" ? (
            <p className="text-muted-foreground">{t({ message: "The role card could not be read just now. Your application still goes without it.", context: "shape the role" })}</p>
          ) : (
            <p className="text-muted-foreground" role="status">{t({ message: "Opening the role card…", context: "shape the role" })}</p>
          )}
        </div>
      )}
    </section>
  );
}
