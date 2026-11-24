/**
 * THE FOUNDING SECTIONS IN THE ROLE EDITOR (phase A, lane A3): Ideal
 * background, Qualities we're looking for, the Digital Companion and its animal, the
 * paid-role line, and How rewards work as shares of the whole. Every field the
 * full card draws (client/src/components/roleCard/FullRoleCard.tsx) is written
 * here, so the full card shows exactly what the editor holds.
 *
 * The related roles a lead role will onboard (the lead, 24 Nov 2026) are chosen here from the village's roles, in the
 * order the card shows them; left empty, /roles keeps the list it derives from the circles the role leads.
 *
 * Fills the form only. The editor's one SAVE sends the whole set, the server
 * reads it with `readSections` (shared/roleCardSections.ts) and refuses an
 * amount or a range in words.
 */
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Trans, useLingui } from "@lingui/react/macro";
import { FOCUS_TOKEN } from "@shared/focusLine";
import { CEILING_PERIODS, EMPTY_SECTIONS, PAY_VISIBILITIES, PAY_WORDINGS, SECTION_LIMITS, SECTION_WORDS, type PayVisibility, type PayWording, type RoleCardSections } from "@shared/roleCardSections";
import { INPUT, LEDE, PANEL, SECONDARY } from "@/components/roleProposal/parts";
import { deliverableLine, deliverablesFromText } from "@shared/roleDeliverablesText";

export interface SectionsForm {
  idealBackground: string;
  qualities: string;
  aiSupport: string;
  aiCompanion: string;
  paid: boolean;
  payShape: Array<{ label: string; pct: string }>;
  payNote: string;
  ceilingAmount: string;
  ceilingCurrency: string;
  ceilingPer: string;
  paySplitNote: string;
  /** Who sees the listed price: the village's switch, everyone, or only the card's editors. */
  payVisibility: PayVisibility;
  /** How the listed price reads: the village's switch, one figure, or each share's amount. */
  payWording: PayWording;
  /** The dated deliverables, one per line: start | end | title | workstream | feeds. */
  deliverables: string;
  /** "Once you're selected", one step per line. */
  onboarding: string;
  /** Where the role is worked, in the card's own words. */
  where: string;
  /** The last day to apply, YYYY-MM-DD, or empty. */
  applyBy: string;
  /** The related roles a lead role will onboard, by id, in the card's order. Empty: /roles derives them. */
  relatedRoles: string[];
}

export function sectionsFormOf(s: RoleCardSections | undefined | null): SectionsForm {
  const v = s ?? EMPTY_SECTIONS;
  return {
    idealBackground: v.idealBackground.join("\n"),
    qualities: v.qualities.join("\n"),
    aiSupport: v.aiSupport,
    aiCompanion: v.aiCompanion,
    paid: v.paid,
    payShape: v.payShape.map((x) => ({ label: x.label, pct: String(x.pct) })),
    payNote: v.payNote,
    ceilingAmount: v.payCeiling ? String(v.payCeiling.amount) : "",
    ceilingCurrency: v.payCeiling?.currency ?? "USD",
    ceilingPer: v.payCeiling?.per ?? "month",
    paySplitNote: v.paySplitNote,
    payVisibility: v.payVisibility ?? "village",
    payWording: v.payWording ?? "village",
    deliverables: (v.deliverables ?? []).map(deliverableLine).join("\n"),
    onboarding: (v.onboarding ?? []).join("\n"),
    where: v.where ?? "",
    applyBy: v.applyBy ?? "",
    relatedRoles: [...(v.relatedRoles ?? [])],
  };
}

const lines = (t: string): string[] => t.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

/** The save body's sections. Percent stays as typed, so the server's sentence names a bad one. */
export function sectionsOf(f: SectionsForm): Record<string, unknown> {
  return {
    idealBackground: lines(f.idealBackground),
    qualities: lines(f.qualities),
    aiSupport: f.aiSupport.trim(),
    aiCompanion: f.aiCompanion.trim(),
    paid: f.paid,
    payShape: f.payShape.filter((x) => x.label.trim() || x.pct.trim()).map((x) => ({ label: x.label.trim(), pct: x.pct.trim() })),
    payNote: f.payNote.trim(),
    // Blank leaves the card with no ceiling, and only the split line shows.
    payCeiling: f.ceilingAmount.trim() ? { amount: f.ceilingAmount.trim().replace(/[,\s]/g, ""), currency: f.ceilingCurrency.trim().toUpperCase(), per: f.ceilingPer } : null,
    paySplitNote: f.paySplitNote.trim(),
    // "village" is sent as it is and stored as nothing: the card follows the village again.
    payVisibility: f.payVisibility,
    payWording: f.payWording,
    // Read into rows here; text that does not read is sent as it is, and the server refuses it in words.
    deliverables: ((r) => (r.ok ? r.value : f.deliverables))(deliverablesFromText(f.deliverables)),
    onboarding: lines(f.onboarding),
    where: f.where.trim(),
    applyBy: f.applyBy.trim(),
    relatedRoles: f.relatedRoles,
  };
}

const AREA = `${INPUT} min-h-[96px] resize-y`;

function Field({ label, changed, children }: { label: string; changed: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded-lg border p-3 ${changed ? "border-dash-gold bg-dash-gold/10" : "border-border"}`} data-changed={changed ? "true" : "false"}>
      <p className="mb-1 flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
        <span>{label}</span>
        {changed && (
          <span className="rounded bg-dash-gold px-1.5 text-xs font-semibold text-dash-gold-ink">
            <Trans context="role editor, a field that differs from the role as it stands">Changed</Trans>
          </span>
        )}
      </p>
      {children}
    </div>
  );
}

/**
 * "Related roles this role will onboard": a list of the village's roles, in order, each moved or taken out, and one
 * picker that adds the next. A role the list names that is no longer offered (removed since) shows its id, to take out.
 */
function RelatedRolesField({ value, roles, onChange }: { value: string[]; roles: ReadonlyArray<{ id: string; name: string }>; onChange: (v: string[]) => void }) {
  const { t } = useLingui();
  const nameOf = (id: string) => roles.find((r) => r.id === id)?.name ?? id;
  const left = roles.filter((r) => !value.includes(r.id));
  const most = SECTION_LIMITS.relatedRoles;
  const full = value.length >= most;
  const move = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const addLabel = t({ message: "Add a related role", context: "role editor: choose a role to add to the related roles" });
  return (
    <div data-editor-related-roles="">
      {value.length > 0 && (
        <ol className="mb-2 space-y-2">
          {value.map((id, i) => {
            const role = nameOf(id);
            return (
              <li key={id} className="flex flex-wrap items-center gap-2" data-editor-related-role={id}>
                {/* The name keeps a readable width; on a phone the three buttons wrap under it. */}
                <span className="flex min-w-0 grow basis-48 items-center gap-2">
                  <span className="w-6 shrink-0 text-sm text-muted-foreground">{i + 1}</span>
                  <span className="min-w-0 break-words text-sm text-foreground">{role}</span>
                </span>
                <span className="flex gap-2">
                  <button type="button" className={SECONDARY} aria-label={t({ message: `Move ${role} up`, context: "role editor: related roles" })} disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp className="size-4" />
                  </button>
                  <button type="button" className={SECONDARY} aria-label={t({ message: `Move ${role} down`, context: "role editor: related roles" })} disabled={i === value.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown className="size-4" />
                  </button>
                  <button type="button" className={SECONDARY} aria-label={t({ message: `Remove ${role}`, context: "role editor: related roles" })} onClick={() => onChange(value.filter((x) => x !== id))}>
                    <Trash2 className="size-4" />
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <select
        className={INPUT}
        value=""
        disabled={full || left.length === 0}
        aria-label={addLabel}
        onChange={(e) => {
          if (e.target.value) onChange([...value, e.target.value]);
        }}
        data-editor-related-add=""
      >
        <option value="">{full ? t({ message: `The list holds ${most}, the most it takes`, context: "role editor: related roles, the list is full" }) : addLabel}</option>
        {left.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function SectionsFields({ value, start, onChange, roles = [] }: { value: SectionsForm; start: SectionsForm; onChange: (v: SectionsForm) => void; roles?: ReadonlyArray<{ id: string; name: string }> }) {
  const { t } = useLingui();
  const set = <K extends keyof SectionsForm>(k: K, v: SectionsForm[K]) => onChange({ ...value, [k]: v });
  const same = (k: keyof SectionsForm) => JSON.stringify(value[k]) === JSON.stringify(start[k]);
  const total = value.payShape.reduce((n, x) => n + (Number(x.pct) || 0), 0);
  const relatedMost = SECTION_LIMITS.relatedRoles;

  return (
    <section className={`${PANEL} space-y-3`} aria-labelledby="re-sections" data-editor-sections="">
      <h3 id="re-sections" className="font-display text-lg">{SECTION_WORDS.editorHeading}</h3>
      <p className={LEDE}>{SECTION_WORDS.editorLede}</p>

      <Field label={SECTION_WORDS.paid} changed={!same("paid")}>
        <label className="flex min-h-[44px] items-center gap-2">
          <input type="checkbox" className="size-5 accent-dash-gold" checked={value.paid} onChange={(e) => set("paid", e.target.checked)} />
          <span>{SECTION_WORDS.paidToggle}</span>
        </label>
      </Field>

      <Field label={t({ message: "Deliverables", context: "role editor: the dated outcomes" })} changed={!same("deliverables")}>
        <p className={LEDE}>{t({ message: "One per line: start | end | title | workstream | what it feeds, with dates as year-month-day. A milestone has one date, or the same date twice; one that several roles share is drawn as a gate on the team's timeline. What it feeds, up to 80 characters, shows when someone taps the bar.", context: "role editor: how to write the deliverables" })}</p>
        <textarea className={AREA} value={value.deliverables} onChange={(e) => set("deliverables", e.target.value)} aria-label={t({ message: "Deliverables", context: "role editor: the dated outcomes" })} placeholder="2027-01-15 | 2027-03-01 | ... | ..." data-editor-deliverables="" />
        {((r) => (r.ok ? null : <p className="mt-1 text-sm text-destructive">{t({ message: `Line ${r.line}: ${r.problem}`, context: "role editor: a deliverable line that does not read" })}</p>))(deliverablesFromText(value.deliverables))}
      </Field>
      <Field label={SECTION_WORDS.where} changed={!same("where")}>
        <input className={INPUT} value={value.where} maxLength={SECTION_LIMITS.whereChars} onChange={(e) => set("where", e.target.value)} aria-label={SECTION_WORDS.where} data-editor-where="" />
      </Field>
      <Field label={SECTION_WORDS.applyBy} changed={!same("applyBy")}>
        <input type="date" className={INPUT} value={value.applyBy} onChange={(e) => set("applyBy", e.target.value)} aria-label={SECTION_WORDS.applyBy} data-editor-apply-by="" />
      </Field>
      <Field label={SECTION_WORDS.onboarding} changed={!same("onboarding")}>
        <p className={LEDE}>{t({ message: "The first steps once someone is chosen, one per line. Empty: the village's own steps show.", context: "role editor: how to write the onboarding steps" })}</p>
        <textarea className={AREA} value={value.onboarding} onChange={(e) => set("onboarding", e.target.value)} aria-label={SECTION_WORDS.onboarding} data-editor-onboarding="" />
      </Field>
      <Field label={t({ message: "Related roles this role will onboard", context: "role editor: the related roles a lead role names" })} changed={!same("relatedRoles")}>
        <p className={LEDE}>{t({ message: `The roles this role brings in, in the order the card shows them, up to ${relatedMost}. Open, upcoming and held roles from any circle can be named. Empty: the card shows the upcoming roles of the circles this role leads.`, context: "role editor: how the related roles work" })}</p>
        <RelatedRolesField value={value.relatedRoles} roles={roles} onChange={(v) => set("relatedRoles", v)} />
      </Field>
      <Field label={SECTION_WORDS.idealBackground} changed={!same("idealBackground")}>
        <textarea className={AREA} value={value.idealBackground} onChange={(e) => set("idealBackground", e.target.value)} aria-label={SECTION_WORDS.idealBackground} />
        <p className="mt-1 text-xs text-muted-foreground">
          <Trans context="role editor, ideal background hint">One line each, written openly: ideally, or experience we'd love to see. Up to {SECTION_LIMITS.lines} lines.</Trans>
        </p>
      </Field>

      <Field label={SECTION_WORDS.qualities} changed={!same("qualities")}>
        <textarea className={AREA} value={value.qualities} onChange={(e) => set("qualities", e.target.value)} aria-label={SECTION_WORDS.qualities} />
        <p className="mt-1 text-xs text-muted-foreground">
          <Trans context="role editor, qualities hint">One quality per line. Up to {SECTION_LIMITS.lines} lines.</Trans>
          {" "}
          <Trans context="role editor, qualities hint, the focus line">Write {FOCUS_TOKEN} on a line of its own for how focused the role asks someone to be: the card picks the words for the commitment it shows, in steps from 10% to 100%.</Trans>
        </p>
      </Field>

      <Field label={SECTION_WORDS.aiSupport} changed={!same("aiSupport") || !same("aiCompanion")}>
        <input
          className={INPUT}
          value={value.aiCompanion}
          maxLength={SECTION_LIMITS.companionChars}
          onChange={(e) => set("aiCompanion", e.target.value)}
          aria-label={t({ message: "The companion's animal", context: "role editor" })}
          placeholder={t({ message: "The companion's animal", context: "role editor" })}
        />
        <textarea
          className={`${AREA} mt-2`}
          value={value.aiSupport}
          maxLength={SECTION_LIMITS.aiSupportChars}
          onChange={(e) => set("aiSupport", e.target.value)}
          aria-label={t({ message: "What the Digital Companion does for this role", context: "role editor" })}
        />
      </Field>

      <Field label={SECTION_WORDS.ceilingLabel} changed={!same("ceilingAmount") || !same("ceilingCurrency") || !same("ceilingPer")}>
        <div className="grid gap-2 sm:grid-cols-3">
          <input className={INPUT} inputMode="numeric" value={value.ceilingAmount} onChange={(e) => set("ceilingAmount", e.target.value)} aria-label={t({ message: "Ceiling amount", context: "role editor" })} placeholder={t({ message: "Empty: no ceiling line", context: "role editor" })} />
          <input className={INPUT} maxLength={3} value={value.ceilingCurrency} onChange={(e) => set("ceilingCurrency", e.target.value.toUpperCase())} aria-label={t({ message: "Currency", context: "role editor" })} />
          <select className={INPUT} value={value.ceilingPer} onChange={(e) => set("ceilingPer", e.target.value)} aria-label={t({ message: "Per", context: "role editor" })}>
            {CEILING_PERIODS.map((p) => (
              <option key={p} value={p}>{p === "month" ? t({ message: "a month", context: "role editor" }) : p === "moon" ? t({ message: "a moon", context: "role editor" }) : t({ message: "a year", context: "role editor" })}</option>
            ))}
          </select>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          <Trans context="role editor, ceiling hint">The card reads: Total compensation up to this figure. Ranges and minimums stay off the card.</Trans>
        </p>
      </Field>

      <Field label={SECTION_WORDS.priceOnCard} changed={!same("payVisibility") || !same("payWording")}>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-sm text-foreground">
            {SECTION_WORDS.visibilityLabel}
            <select className={`${INPUT} mt-1`} value={value.payVisibility} onChange={(e) => set("payVisibility", e.target.value as PayVisibility)} data-pay-visibility="">
              {PAY_VISIBILITIES.map((v) => (
                <option key={v} value={v}>{SECTION_WORDS.visibility[v]}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-foreground">
            {SECTION_WORDS.wordingLabel}
            <select className={`${INPUT} mt-1`} value={value.payWording} onChange={(e) => set("payWording", e.target.value as PayWording)} data-pay-wording="">
              {PAY_WORDINGS.map((v) => (
                <option key={v} value={v}>{SECTION_WORDS.wording[v]}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          <Trans context="role editor, who sees the listed price hint">The village setting is Show pay ranges on role cards: while it is off, only people who read terms see the figure. Everyone: this card, the founding team and the application form show the figure to all. Only the people who edit this card: nobody else sees it.</Trans>
          {" "}
          <Trans context="role editor, how the listed price reads hint">Each share as its own amount names what each share below comes to, in cash, equity or credits, for the full role.</Trans>
        </p>
      </Field>

      <Field label={SECTION_WORDS.payShape} changed={!same("payShape") || !same("payNote") || !same("paySplitNote")}>
        <ol className="space-y-2">
          {value.payShape.map((x, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <input
                className={`${INPUT} flex-1`}
                value={x.label}
                aria-label={SECTION_WORDS.shareLabel}
                onChange={(e) => set("payShape", value.payShape.map((y, n) => (n === i ? { ...y, label: e.target.value } : y)))}
              />
              <input
                className={`${INPUT} w-24`}
                inputMode="numeric"
                value={x.pct}
                aria-label={SECTION_WORDS.sharePct}
                onChange={(e) => set("payShape", value.payShape.map((y, n) => (n === i ? { ...y, pct: e.target.value } : y)))}
              />
              <span aria-hidden="true">%</span>
              <button type="button" className={SECONDARY} aria-label={t({ message: "Remove", context: "role editor" })} onClick={() => set("payShape", value.payShape.filter((_, n) => n !== i))}>
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ol>
        <button
          type="button"
          className={`${SECONDARY} mt-2`}
          disabled={value.payShape.length >= SECTION_LIMITS.shares}
          onClick={() => set("payShape", [...value.payShape, { label: "", pct: "" }])}
        >
          <Plus className="size-4" /> {SECTION_WORDS.addShare}
        </button>
        <p className="mt-1 text-xs text-muted-foreground" role="status">
          <Trans context="role editor, pay shape total">The shares add up to {total}%.</Trans>
        </p>
        <label className="mt-3 block text-sm font-semibold text-foreground">
          {SECTION_WORDS.splitNoteLabel}
          <input className={`${INPUT} mt-1 font-normal`} value={value.paySplitNote} maxLength={SECTION_LIMITS.payNoteChars} onChange={(e) => set("paySplitNote", e.target.value)} />
        </label>
        <label className="mt-3 block text-sm font-semibold text-foreground">
          {SECTION_WORDS.payNoteLabel}
          <textarea className={`${AREA} mt-1 font-normal`} value={value.payNote} maxLength={SECTION_LIMITS.payNoteChars} onChange={(e) => set("payNote", e.target.value)} />
        </label>
      </Field>
    </section>
  );
}
