/**
 * THE FIELDS OF ONE SETTINGS GROUP, for SeatSettingsEditor.
 *
 * Each group of a seat's terms (shared/seatSettings.ts) is a handful of
 * ordinary inputs. They write straight into the group's object and hand the
 * whole settings back up; `parseSeatSettings` judges the result, so a field
 * here never invents a rule of its own. Absent stays absent: clearing a box
 * removes the key, and an empty choice says the operations role will fill it.
 *
 * AMOUNTS ARE TYPED WHOLE, in the currency's own units, and stored as whole
 * minor units. A decimal typed here is kept as typed so the parser can say
 * "Whole numbers only" where the member is looking.
 */
import { useId, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { honestyLine, OPS_FALLBACK } from "@shared/roleProposalHonesty";
import {
  ALLOWANCE_KINDS,
  BONUS_KINDS,
  GATHERING_EVERY,
  LIMITS,
  MONEY_PER,
  PAY_CLOCKS,
  PAY_KINDS,
  WORK_CLOCKS,
  minorDigits,
  type SeatSettings,
  type SettingsGroup,
} from "@shared/seatSettings";
import { Trans, useLingui } from "@lingui/react/macro";

const input =
  "w-full min-h-[44px] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const labelClass = "block text-xs font-semibold text-foreground";
const smallButton =
  "inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const WORDS: Record<string, string> = {
  "calendar-month": "Calendar month",
  moon: "Moon",
  week: "Week",
  fortnight: "Fortnight",
  month: "Month",
  none: "None",
  fixed: "Fixed amount",
  range: "A range",
  honorary: "Honorary",
  "in-kind": "In kind",
  deferred: "Deferred",
  tbd: "To be determined",
  flat: "Flat amount",
  reimbursed: "Costs reimbursed",
  equity: "Equity, in words",
};

type Obj = Record<string, any>;

/** Set or remove one key, returning a new object. */
const put = (obj: Obj | undefined, key: string, v: unknown): Obj => {
  const next: Obj = { ...(obj ?? {}) };
  if (v === undefined || v === "") delete next[key];
  else next[key] = v;
  return next;
};

/** A whole-number box: empty removes the key, anything else is kept as a number. */
const wholeFrom = (raw: string): number | undefined => (raw.trim() === "" ? undefined : Number(raw));

function Field({ label, children, wide = false }: { label: string; children: (id: string) => ReactNode; wide?: boolean }) {
  const id = useId();
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="mt-1">{children(id)}</div>
    </div>
  );
}

function Choice({
  label,
  value,
  options,
  onChange,
  blank = honestyLine({ set: false, presetLabel: null, customised: false, partner: OPS_FALLBACK, money: false }),
}: {
  label: string;
  value: unknown;
  options: readonly string[];
  onChange: (v: string | undefined) => void;
  blank?: string | null;
}) {
  return (
    <Field label={label}>
      {(id) => (
        <select id={id} className={input} value={String(value ?? "")} onChange={(e) => onChange(e.target.value || undefined)}>
          {blank !== null && <option value="">{blank}</option>}
          {options.map((o) => (
            <option key={o} value={o}>
              {WORDS[o] ?? o}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

function Whole({ label, value, onChange, min = 0, max }: { label: string; value: unknown; onChange: (v: number | undefined) => void; min?: number; max?: number }) {
  return (
    <Field label={label}>
      {(id) => (
        <input
          id={id}
          className={input}
          type="number"
          inputMode="numeric"
          step={1}
          min={min}
          max={max}
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => onChange(wholeFrom(e.target.value))}
        />
      )}
    </Field>
  );
}

function Words({ label, value, onChange, max, wide = true, area = false, placeholder }: { label: string; value: unknown; onChange: (v: string | undefined) => void; max: number; wide?: boolean; area?: boolean; placeholder?: string }) {
  return (
    <Field label={label} wide={wide}>
      {(id) =>
        area ? (
          <textarea id={id} className={input} rows={2} maxLength={max} placeholder={placeholder} value={String(value ?? "")} onChange={(e) => onChange(e.target.value || undefined)} />
        ) : (
          <input id={id} className={input} type="text" maxLength={max} placeholder={placeholder} value={String(value ?? "")} onChange={(e) => onChange(e.target.value || undefined)} />
        )
      }
    </Field>
  );
}

function DateBox({ label, value, onChange }: { label: string; value: unknown; onChange: (v: string | undefined) => void }) {
  return (
    <Field label={label}>
      {(id) => <input id={id} className={input} type="date" value={String(value ?? "")} onChange={(e) => onChange(e.target.value || undefined)} />}
    </Field>
  );
}

/**
 * An amount typed in whole units of the currency, stored as whole minor units.
 *
 * Only digits are ever scaled. Anything else ("12.5", "1e3") is stored as the
 * exact text typed, so the box keeps showing it, the parser refuses it with
 * "Whole numbers only.", and no headline ever shows a rescaled figure.
 */
function Amount({ label, minor, currency, onChange }: { label: string; minor: unknown; currency: string | undefined; onChange: (v: number | string | undefined) => void }) {
  const { t } = useLingui();
  const digits = minorDigits(currency);
  const shown =
    typeof minor === "string"
      ? minor
      : typeof minor === "number" && Number.isInteger(minor)
        ? String(minor / 10 ** digits)
        : "";
  return (
    <Field label={currency ? t({ message: `${label}, in ${currency}`, context: "SeatSettingsFields, label" }) : label}>
      {(id) => (
        <input
          id={id}
          className={input}
          type="number"
          inputMode="numeric"
          step={1}
          min={0}
          value={shown}
          onChange={(e) => {
            const typed = e.target.value.trim();
            if (typed === "") return onChange(undefined);
            onChange(/^\d+$/.test(typed) ? Number(typed) * 10 ** digits : typed);
          }}
        />
      )}
    </Field>
  );
}

function TermFields({ g, set, openLabel }: { g: Obj; set: (next: Obj) => void; openLabel: string }) {
  const { t } = useLingui();
  const mode = g.endsOn === null ? "season" : typeof g.endsOn === "string" ? "date" : g.lengthMoons !== undefined ? "moons" : "";
  return (
    <>
      <Field label={t({ message: "How it ends", context: "SeatSettingsFields, label" })}>
        {(id) => (
          <select
            id={id}
            className={input}
            value={mode}
            onChange={(e) => {
              const v = e.target.value;
              let next = put(put(g, "endsOn", undefined), "lengthMoons", undefined);
              if (v === "season") next = { ...next, endsOn: null };
              if (v === "date") next = { ...next, endsOn: "" };
              if (v === "moons") next = { ...next, lengthMoons: 3 };
              set(next);
            }}
          >
            <option value="">{openLabel}</option>
            <option value="season">When the season ends</option>
            <option value="date">On a date</option>
            <option value="moons">After a number of moons</option>
          </select>
        )}
      </Field>
      {mode === "date" && <DateBox label={t({ message: "Ends on", context: "SeatSettingsFields, label" })} value={g.endsOn} onChange={(v) => set({ ...g, endsOn: v ?? "" })} />}
      {mode === "moons" && <Whole label={t({ message: "Moons from seating", context: "SeatSettingsFields, label" })} min={1} max={LIMITS.lengthMoons} value={g.lengthMoons} onChange={(v) => set(put(g, "lengthMoons", v))} />}
      <Whole label={t({ message: "Notice, in days", context: "SeatSettingsFields, label" })} max={LIMITS.noticeDays} value={g.noticeDays} onChange={(v) => set(put(g, "noticeDays", v))} />
      <DateBox label={t({ message: "Review on", context: "SeatSettingsFields, label" })} value={g.reviewOn} onChange={(v) => set(put(g, "reviewOn", v))} />
      <DateBox label={t({ message: "Renewal on", context: "SeatSettingsFields, label" })} value={g.renewalOn} onChange={(v) => set(put(g, "renewalOn", v))} />
    </>
  );
}

function RhythmFields({ g, set }: { g: Obj; set: (next: Obj) => void }) {
  const { t } = useLingui();
  const gatherings: Obj[] = Array.isArray(g.gatherings) ? g.gatherings : [];
  const quiet: number[] = Array.isArray(g.quietDays) ? g.quietDays : [];
  const setRow = (i: number, row: Obj) => set({ ...g, gatherings: gatherings.map((x, j) => (j === i ? row : x)) });
  return (
    <>
      <div className="space-y-3 sm:col-span-2">
        {gatherings.map((row, i) => (
          <fieldset key={i} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2">
            <legend className="px-1 text-xs font-semibold text-foreground"><Trans context="SeatSettingsFields, legend">Gathering {i + 1}</Trans></legend>
            <Words label={t({ message: "Name", context: "SeatSettingsFields, label" })} max={LIMITS.labelChars} wide={false} value={row.label} onChange={(v) => setRow(i, put(row, "label", v))} />
            <Field label={t({ message: "Day", context: "SeatSettingsFields, label" })}>
              {(id) => (
                <select id={id} className={input} value={row.weekday === undefined ? "" : String(row.weekday)} onChange={(e) => setRow(i, put(row, "weekday", wholeFrom(e.target.value)))}>
                  <option value="">Pick a day</option>
                  {WEEKDAYS.map((d, n) => (
                    <option key={d} value={n}>
                      {d}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={t({ message: "Time", context: "SeatSettingsFields, label" })}>
              {(id) => <input id={id} className={input} type="time" value={String(row.time ?? "")} onChange={(e) => setRow(i, put(row, "time", e.target.value))} />}
            </Field>
            <Choice label={t({ message: "How often", context: "SeatSettingsFields, label" })} value={row.every} options={GATHERING_EVERY} blank={null} onChange={(v) => setRow(i, put(row, "every", v))} />
            <div className="sm:col-span-2">
              <button type="button" className={smallButton} onClick={() => set({ ...g, gatherings: gatherings.filter((_, j) => j !== i) })}>
                <Trans context="SeatSettingsFields, button"><X className="size-4" aria-hidden="true" />
                Remove this gathering
              </Trans></button>
            </div>
          </fieldset>
        ))}
        <button
          type="button"
          className={smallButton}
          disabled={gatherings.length >= LIMITS.gatherings}
          onClick={() => set({ ...g, gatherings: [...gatherings, { label: "", weekday: 1, time: "10:00", every: "week" }] })}
        >
          <Trans context="SeatSettingsFields, button"><Plus className="size-4" aria-hidden="true" />
          Add a gathering
        </Trans></button>
      </div>
      <fieldset className="sm:col-span-2">
        <legend className={labelClass}><Trans context="SeatSettingsFields, legend">Quiet days</Trans></legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {WEEKDAYS.map((d, n) => (
            <label key={d} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border px-3 text-sm text-foreground">
              <input
                type="checkbox"
                checked={quiet.includes(n)}
                onChange={(e) => {
                  const days = e.target.checked ? [...quiet, n] : quiet.filter((x) => x !== n);
                  set(put(g, "quietDays", days.length > 0 ? days.sort((a, b) => a - b) : undefined));
                }}
              />
              {d}
            </label>
          ))}
        </div>
      </fieldset>
      <Words label={t({ message: "Time zone (leave empty for the season's own)", context: "SeatSettingsFields, label" })} max={64} value={g.tz} onChange={(v) => set(put(g, "tz", v))} />
    </>
  );
}

function MoneyFields({ group, g, set, openLabel }: { group: "pay" | "allowance"; g: Obj; set: (next: Obj) => void; openLabel: string }) {
  const { t } = useLingui();
  const kinds = group === "pay" ? PAY_KINDS : ALLOWANCE_KINDS;
  const kind = String(g.kind ?? "");
  const amountKinds = group === "pay" ? ["fixed", "in-kind", "deferred"] : ["flat"];
  return (
    <>
      <Choice
        label={t({ message: "Kind", context: "SeatSettingsFields, label" })}
        value={g.kind}
        options={kinds}
        blank={openLabel}
        // Pay to be determined records no amount, so choosing it clears any figure already typed.
        onChange={(v) => set(v === "tbd" ? put(put(put(put(g, "kind", v), "amountMinor", undefined), "minMinor", undefined), "maxMinor", undefined) : put(g, "kind", v))}
      />
      <Words
        label={t({ message: "Currency code", context: "SeatSettingsFields, label" })}
        max={3}
        wide={false}
        value={g.currency}
        onChange={(v) => set(put(g, "currency", v ? v.toUpperCase() : undefined))}
      />
      {amountKinds.includes(kind) && <Amount label={t({ message: "Amount", context: "SeatSettingsFields, label" })} minor={g.amountMinor} currency={g.currency} onChange={(v) => set(put(g, "amountMinor", v))} />}
      {group === "pay" && kind === "range" && (
        <>
          <Amount label={t({ message: "Lowest", context: "SeatSettingsFields, label" })} minor={g.minMinor} currency={g.currency} onChange={(v) => set(put(g, "minMinor", v))} />
          <Amount label={t({ message: "Highest", context: "SeatSettingsFields, label" })} minor={g.maxMinor} currency={g.currency} onChange={(v) => set(put(g, "maxMinor", v))} />
        </>
      )}
      {kind !== "none" && kind !== "honorary" && kind !== "reimbursed" && kind !== "tbd" && (
        <Choice label={t({ message: "Each", context: "SeatSettingsFields, label" })} value={g.per} options={MONEY_PER} blank={openLabel} onChange={(v) => set(put(g, "per", v))} />
      )}
      <Words label={t({ message: "Note", context: "SeatSettingsFields, label" })} area max={LIMITS.noteChars} value={g.note} onChange={(v) => set(put(g, "note", v))} />
    </>
  );
}

function BonusFields({ g, set, openLabel }: { g: Obj; set: (next: Obj) => void; openLabel: string }) {
  const { t } = useLingui();
  return (
    <>
      <Choice label={t({ message: "Kind", context: "SeatSettingsFields, label" })} value={g.kind} options={BONUS_KINDS} blank={openLabel} onChange={(v) => set(put(g, "kind", v))} />
      {g.kind === "equity" && (
        <>
          <Words label={t({ message: "The cap, in words", context: "SeatSettingsFields, label" })} max={LIMITS.wordsChars} placeholder={t({ message: "Up to a set share, written here in words", context: "SeatSettingsFields, placeholder" })} value={g.capWords} onChange={(v) => set(put(g, "capWords", v))} />
          <Words label={t({ message: "Rated by", context: "SeatSettingsFields, label" })} max={LIMITS.wordsChars} value={g.ratedBy} onChange={(v) => set(put(g, "ratedBy", v))} />
          <Words label={t({ message: "How often it is rated", context: "SeatSettingsFields, label" })} max={LIMITS.wordsChars} value={g.cadence} onChange={(v) => set(put(g, "cadence", v))} />
        </>
      )}
    </>
  );
}

function QuestFields({ g, set }: { g: Obj; set: (next: Obj) => void }) {
  const { t } = useLingui();
  return (
    <>
      <Whole label={t({ message: "Fewest quests a moon", context: "SeatSettingsFields, label" })} min={1} max={LIMITS.questsPerMoon} value={g.perMoonMin} onChange={(v) => set({ ...put(g, "perMoonMin", v), doneWhenRequired: true })} />
      <Whole label={t({ message: "Most quests a moon", context: "SeatSettingsFields, label" })} min={1} max={LIMITS.questsPerMoon} value={g.perMoonMax} onChange={(v) => set({ ...put(g, "perMoonMax", v), doneWhenRequired: true })} />
      <Words label={t({ message: "How quests are agreed", context: "SeatSettingsFields, label" })} max={LIMITS.wordsChars} value={g.agreedHow} onChange={(v) => set({ ...put(g, "agreedHow", v), doneWhenRequired: true })} />
      <p className="text-xs text-muted-foreground sm:col-span-2"><Trans context="SeatSettingsFields, p">Every quest has a done when. That part is always on.</Trans></p>
    </>
  );
}

function ScoreboardFields({ g, set }: { g: Obj; set: (next: Obj) => void }) {
  const { t } = useLingui();
  const measures: Obj[] = Array.isArray(g.measures) ? g.measures : [];
  const setRow = (i: number, row: Obj) => set({ ...g, measures: measures.map((x, j) => (j === i ? row : x)) });
  return (
    <div className="space-y-3 sm:col-span-2">
      <p className="text-xs text-muted-foreground"><Trans context="SeatSettingsFields, p">A scoreboard measures the work. It never ranks people.</Trans></p>
      {measures.map((row, i) => (
        <fieldset key={i} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2">
          <legend className="px-1 text-xs font-semibold text-foreground"><Trans context="SeatSettingsFields, legend">Measure {i + 1}</Trans></legend>
          <Words label={t({ message: "What is measured", context: "SeatSettingsFields, label" })} max={LIMITS.measureChars} value={row.measure} onChange={(v) => setRow(i, put(row, "measure", v))} />
          <Words label={t({ message: "Target, in words", context: "SeatSettingsFields, label" })} max={LIMITS.measureChars} wide={false} value={row.target} onChange={(v) => setRow(i, put(row, "target", v))} />
          <Words label={t({ message: "Read from", context: "SeatSettingsFields, label" })} max={LIMITS.measureChars} wide={false} value={row.readFrom} onChange={(v) => setRow(i, put(row, "readFrom", v))} />
          <div className="sm:col-span-2">
            <button type="button" className={smallButton} onClick={() => set({ ...g, measures: measures.filter((_, j) => j !== i) })}>
              <Trans context="SeatSettingsFields, button"><X className="size-4" aria-hidden="true" />
              Remove this measure
            </Trans></button>
          </div>
        </fieldset>
      ))}
      <button
        type="button"
        className={smallButton}
        disabled={measures.length >= LIMITS.scoreMeasures}
        onClick={() => set({ ...g, measures: [...measures, { measure: "" }] })}
      >
        <Trans context="SeatSettingsFields, button"><Plus className="size-4" aria-hidden="true" />
        Add a measure
      </Trans></button>
    </div>
  );
}

function EndingFields({ g, set }: { g: Obj; set: (next: Obj) => void }) {
  const { t } = useLingui();
  const id = useId();
  return (
    <>
      <Whole label={t({ message: "Notice, in days", context: "SeatSettingsFields, label" })} max={LIMITS.noticeDays} value={g.noticeDays} onChange={(v) => set(put(g, "noticeDays", v))} />
      <div className="flex items-end">
        <label htmlFor={id} className="inline-flex min-h-[44px] items-center gap-2 text-sm text-foreground">
          <input id={id} type="checkbox" checked={g.payThroughNotice === true} onChange={(e) => set({ ...g, payThroughNotice: e.target.checked })} />
          Pay runs through the notice
        </label>
      </div>
    </>
  );
}

export default function SeatSettingsFields({
  group,
  settings,
  onChange,
  openLabel = honestyLine({ set: false, presetLabel: null, customised: false, partner: OPS_FALLBACK, money: false }),
}: {
  group: SettingsGroup;
  settings: SeatSettings;
  onChange: (next: SeatSettings) => void;
  /** The blank choice, when a field has no value yet. */
  openLabel?: string;
}) {
  const { t } = useLingui();
  const g: Obj = ((settings as Obj)[group] as Obj | undefined) ?? (group === "scoreboard" ? { measures: [] } : group === "quests" ? { doneWhenRequired: true } : {});
  const set = (next: Obj) => onChange({ ...settings, [group]: next } as SeatSettings);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {group === "term" && <TermFields g={g} set={set} openLabel={openLabel} />}
      {group === "clocks" && (
        <>
          <Choice label={t({ message: "Money keeps", context: "SeatSettingsFields, label" })} value={g.pay} options={PAY_CLOCKS} blank={openLabel} onChange={(v) => set(put(g, "pay", v))} />
          <Choice label={t({ message: "The work keeps", context: "SeatSettingsFields, label" })} value={g.work} options={WORK_CLOCKS} blank={openLabel} onChange={(v) => set(put(g, "work", v))} />
        </>
      )}
      {group === "rhythm" && <RhythmFields g={g} set={set} />}
      {(group === "pay" || group === "allowance") && <MoneyFields group={group} g={g} set={set} openLabel={openLabel} />}
      {group === "bonus" && <BonusFields g={g} set={set} openLabel={openLabel} />}
      {group === "quests" && <QuestFields g={g} set={set} />}
      {group === "scoreboard" && <ScoreboardFields g={g} set={set} />}
      {group === "ending" && <EndingFields g={g} set={set} />}
    </div>
  );
}
