/**
 * ONE CHANGE IN A DRAFT (the draft page, PR B): what it does, before and after field by field, and what can be done
 * about it here. An edit of a role shows only the fields it changes, the rest folded behind "N fields unchanged". A
 * new role shows its words as new. A retired role shows what it held and how many hold it.
 *
 * A change that cannot be applied says why, in the preview's own words, and offers to leave it out so the rest can
 * publish (the lead, 26 Nov 2026: one taken id held back four good roles). Edits and leaving out are revisions of the
 * draft (`POST /api/org/drafts/:id/revise`); the live card is never touched here.
 */
import { useState } from "react";
import { Plural, Trans, useLingui } from "@lingui/react/macro";
import { BTN_PRIMARY, BTN_SECONDARY, CHIP_SOFT, FIELD, HINT, LABEL, QUIET } from "@/components/journey/look";
import type { DraftChangeView, DraftFieldView } from "@shared/orgDraftView";
import FieldDiff, { MovedNote, useFieldLabel } from "./FieldDiff";

type Act = (changeId: string, ...rest: any[]) => Promise<{ ok: boolean; message: string | null }>;

function asText(v: string | string[] | null): string {
  return v === null ? "" : Array.isArray(v) ? v.join("\n") : v;
}

/** The edit box for one field: the words as the draft proposes them, saved as a new revision with a note. */
function FieldEdit({ change, field, revise, onClose }: { change: DraftChangeView; field: DraftFieldView; revise: Act; onClose: () => void }) {
  const { t } = useLingui();
  const label = useFieldLabel()(field.field, field.label);
  const [value, setValue] = useState(asText(field.after));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = `edit-${change.id}-${field.field}`;
  const save = async () => {
    setBusy(true);
    setError(null);
    const words = field.shape === "list" ? value.split("\n").map((l) => l.trim()).filter(Boolean) : value.trim() === "" ? null : value.trim();
    const r = await revise(change.id, { [field.field]: words }, note);
    setBusy(false);
    if (r.ok) onClose();
    else setError(r.message ?? t({ context: "draft page", message: "That did not save. Try again." }));
  };
  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-4">
      <label htmlFor={id} className={LABEL}>
        <Trans context="draft page: editing a field">New words for {label}</Trans>
      </label>
      {field.shape === "list" ? (
        <p className={HINT}>
          <Trans context="draft page: editing a list">One line for each item.</Trans>
        </p>
      ) : null}
      <textarea id={id} className={`${FIELD} min-h-28`} value={value} onChange={(e) => setValue(e.target.value)} />
      <label htmlFor={`${id}-note`} className={LABEL}>
        <Trans context="draft page: editing a field">A short note on why (shown in the draft's history)</Trans>
      </label>
      <input id={`${id}-note`} className={FIELD} maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={() => void save()}>
          <Trans context="draft page: editing a field">Save as a new revision</Trans>
        </button>
        <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={onClose}>
          <Trans context="draft page: editing a field">Cancel</Trans>
        </button>
      </div>
      <p className={HINT}>
        <Trans context="draft page: editing a field">This changes the draft only. The live role card changes when the draft is published.</Trans>
      </p>
    </div>
  );
}

/** Leave this one out: confirmed on the page, with an optional note. */
function LeaveOut({ change, leaveOut, onDone }: { change: DraftChangeView; leaveOut: Act; onDone: (text: string) => void }) {
  const { t } = useLingui();
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!asking) {
    return (
      <button type="button" className={BTN_SECONDARY} onClick={() => setAsking(true)} data-testid={`leave-out-${change.id}`}>
        <Trans context="draft page">Leave this one out</Trans>
      </button>
    );
  }
  const target = change.target;
  return (
    <div className="space-y-3 rounded-xl border border-notice/60 bg-card p-4" role="group" aria-label={t({ context: "draft page", message: "Leave this change out" })}>
      <p className="font-semibold text-card-foreground">
        <Trans context="draft page">Leave "{target}" out of this draft? The rest stays, and can be published without it. Its words are kept in the draft's history.</Trans>
      </p>
      <label htmlFor={`leave-${change.id}`} className={LABEL}>
        <Trans context="draft page">A short note on why (optional)</Trans>
      </label>
      <input id={`leave-${change.id}`} className={FIELD} maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={BTN_PRIMARY}
          disabled={busy}
          data-testid={`leave-out-yes-${change.id}`}
          onClick={async () => {
            setBusy(true);
            const r = await leaveOut(change.id, note);
            setBusy(false);
            if (r.ok) onDone(t({ context: "draft page", message: `"${target}" is out of this draft.` }));
            else setError(r.message ?? t({ context: "draft page", message: "That did not go through. Try again." }));
          }}
        >
          <Trans context="draft page">Yes, leave it out</Trans>
        </button>
        <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={() => setAsking(false)}>
          <Trans context="draft page">Not yet</Trans>
        </button>
      </div>
    </div>
  );
}

export default function DraftChangeCard({ change, mayEdit, last, acts, onSaid }: { change: DraftChangeView; mayEdit: boolean; last: boolean; acts: { revise: Act; leaveOut: Act }; onSaid: (text: string) => void }) {
  const label = useFieldLabel();
  const [editing, setEditing] = useState<string | null>(null);
  const editable = mayEdit && (change.kind === "edit" || change.kind === "new");
  const retiredId = !!change.blocked && change.blocked.includes("(a retired role)");
  return (
    <li className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6" data-testid={`draft-change-${change.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={CHIP_SOFT}>
          {change.kind === "new" ? (
            <Trans context="draft page: a change's kind">New</Trans>
          ) : change.kind === "edit" ? (
            <Trans context="draft page: a change's kind">Changed</Trans>
          ) : change.kind === "removed" ? (
            <Trans context="draft page: a change's kind">Removed</Trans>
          ) : (
            <Trans context="draft page: a change's kind">Change</Trans>
          )}
        </span>
        <h3 className="font-display text-xl font-bold text-card-foreground">{change.target}</h3>
      </div>
      {change.reads ? <p className="text-base text-foreground">{change.reads}</p> : null}

      {change.blocked ? (
        <div className="space-y-3 rounded-xl border-2 border-destructive/50 p-4" role="alert">
          <p className="text-base font-semibold text-foreground">
            <Trans context="draft page">This change cannot be applied as the village stands.</Trans>
          </p>
          <p className="text-base text-foreground">{change.blocked}</p>
          {retiredId ? (
            <p className={HINT}>
              <Trans context="draft page">A retired role keeps its id, and the chart only lists live roles, which is why nothing with this name shows there. Leave this one out to publish the rest, then add the role again under a new id.</Trans>
            </p>
          ) : (
            <p className={HINT}>
              <Trans context="draft page">Until it is fixed or left out, the whole draft waits. Leave it out to publish the rest.</Trans>
            </p>
          )}
          {mayEdit && !last ? <LeaveOut change={change} leaveOut={acts.leaveOut} onDone={onSaid} /> : null}
        </div>
      ) : null}

      {change.kind === "removed" && change.holders !== null ? (
        <p className={QUIET}>
          <Plural
            context="draft page: a role being retired"
            value={change.holders}
            _0="Nobody holds this role now."
            one="One person holds this role now. Retiring it ends their holding."
            other="# people hold this role now. Retiring it ends their holdings."
          />
        </p>
      ) : null}

      {/* A new role whose only words are its title says nothing the heading has not said. */}
      {change.fields.length && !(change.kind === "new" && change.fields.every((f) => f.field === "name")) ? (
        <div className="divide-y divide-border">
          {change.fields.map((f) => (
            <section key={f.field} className="space-y-2 py-4 first:pt-0" aria-label={label(f.field, f.label)}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-base font-semibold text-foreground">{label(f.field, f.label)}</h4>
                {editable && !f.hidden && editing !== f.field ? (
                  <button type="button" className="min-h-11 text-sm font-medium text-notice underline underline-offset-2" onClick={() => setEditing(f.field)}>
                    <Trans context="draft page">Edit</Trans>
                  </button>
                ) : null}
              </div>
              {editing === f.field ? (
                <FieldEdit change={change} field={f} revise={acts.revise} onClose={() => setEditing(null)} />
              ) : (
                <>
                  <FieldDiff field={f} fresh={change.kind === "new"} />
                  <MovedNote field={f} />
                </>
              )}
            </section>
          ))}
        </div>
      ) : null}

      {change.unchanged.length ? (
        <details className="rounded-xl border border-dashed border-border px-4 py-3">
          <summary className="min-h-11 cursor-pointer py-2 text-base font-semibold text-foreground">
            <Plural context="draft page: the fold" value={change.unchanged.length} one="# field unchanged" other="# fields unchanged" />
          </summary>
          <p className={HINT}>{change.unchanged.map((k) => label(k, k)).join(", ")}</p>
        </details>
      ) : null}
    </li>
  );
}
