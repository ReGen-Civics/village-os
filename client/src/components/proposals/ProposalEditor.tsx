/**
 * Editing a proposed change in place (the lead, 11 Nov 2026): the change field by field, what is live now beside
 * the proposed words, each word field a box the reader types in. Never raw JSON: words are boxes, lists are rows.
 * Moved here whole from the review page when the page became cards (16 Nov 2026); what it does is unchanged.
 */
import { Trans, useLingui } from "@lingui/react/macro";
import { BTN_SECONDARY, CHIP_SOFT, FIELD, LABEL } from "@/components/journey/look";
import { fieldLabel, valueAt } from "@shared/proposedChanges";
import type { Problem } from "./reviewTypes";

export const isWordList = (v: unknown): v is Array<string | number | boolean | null> => Array.isArray(v) && v.every((x) => x === null || typeof x !== "object");
export const asText = (v: unknown): string => (v === null || v === undefined ? "" : typeof v === "string" ? v : typeof v === "object" ? JSON.stringify(v) : String(v));

/** A copy of `value` with `path` set to `next`. */
export function setAt(value: unknown, path: string[], next: unknown): unknown {
  if (!path.length) return next;
  const [head, ...rest] = path;
  if (Array.isArray(value)) {
    const copy = [...value];
    copy[Number(head)] = setAt(copy[Number(head)], rest, next);
    return copy;
  }
  const o = value && typeof value === "object" ? { ...(value as Record<string, unknown>) } : {};
  o[head] = setAt(o[head], rest, next);
  return o;
}

/** A blank row shaped like the list's first row, for "Add". */
function blankLike(v: unknown): unknown {
  if (typeof v === "string") return "";
  if (typeof v === "number") return 0;
  if (typeof v === "boolean") return false;
  if (Array.isArray(v)) return [];
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, k === "id" ? undefined : blankLike(x)]));
  return "";
}

/** Every path the editor draws a field or a group for, so a problem on one of them shows there and any other shows on top. */
export function nodePaths(value: unknown, prefix = "", out: Set<string> = new Set()): Set<string> {
  if (prefix) out.add(prefix);
  if (value && typeof value === "object" && !isWordList(value)) {
    const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v] as const) : Object.entries(value as Record<string, unknown>);
    for (const [k, v] of entries) nodePaths(v, prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}

const rowsFor = (s: string) => Math.min(18, Math.max(2, s.split("\n").length + Math.floor(s.length / 70)));

/** What is live now, as plain reading text. */
export function LiveText({ value }: { value: unknown }) {
  if (value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length)) {
    return (
      <p className="text-sm italic text-muted-foreground">
        <Trans context="proposed changes">Nothing set yet</Trans>
      </p>
    );
  }
  if (isWordList(value)) {
    return (
      <ul className="max-w-prose list-disc space-y-1 pl-5 text-base leading-relaxed text-foreground">
        {value.map((x, i) => (
          <li key={i} className="whitespace-pre-wrap break-words">{asText(x)}</li>
        ))}
      </ul>
    );
  }
  return <p className="max-w-prose whitespace-pre-wrap break-words text-base leading-relaxed text-foreground">{asText(value)}</p>;
}

interface FieldProps {
  path: string;
  value: unknown;
  proposed: unknown;
  live: unknown;
  labels: Record<string, string>;
  problems: Problem[];
  onChange: (path: string, next: unknown) => void;
  depth: number;
  idPrefix: string;
}

/** One field, or a group of fields, of a proposal's body. */
export function Field({ path, value, proposed, live, labels, problems, onChange, depth, idPrefix }: FieldProps) {
  const { t } = useLingui();
  const label = labels[path] ?? fieldLabel(path.split(".").slice(-2).join("."));
  const mine = problems.filter((p) => p.field === path && path !== "");
  const id = `${idPrefix}-f-${path.replace(/[^A-Za-z0-9]/g, "-")}`;

  // A group: an object, or a list of objects. Its children each get their own row.
  if (value && typeof value === "object" && !isWordList(value)) {
    const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v] as const) : Object.entries(value as Record<string, unknown>).filter(([k]) => k !== "id");
    return (
      <fieldset className={depth > 0 ? "min-w-0 space-y-4 rounded-xl border border-border/60 p-3 sm:p-4" : "min-w-0 space-y-5"}>
        {depth > 0 && <legend className={`${LABEL} px-1`}>{label}</legend>}
        {mine.map((p, i) => (
          <p key={i} role="alert" className="text-sm font-medium text-destructive">
            {p.error}
          </p>
        ))}
        {entries.map(([k, v]) => (
          <div key={k} className="space-y-2">
            <Field
              path={path ? `${path}.${k}` : k}
              value={v}
              proposed={valueAt(proposed, k)}
              live={valueAt(live, k)}
              labels={labels}
              problems={problems}
              onChange={onChange}
              depth={depth + 1}
              idPrefix={idPrefix}
            />
            {Array.isArray(value) && (
              <button type="button" className={`${BTN_SECONDARY} min-h-9`} onClick={() => onChange(path, value.filter((_, i) => String(i) !== k))}>
                <Trans context="proposed changes">Remove this one</Trans>
              </button>
            )}
          </div>
        ))}
        {Array.isArray(value) && (
          <button type="button" className={BTN_SECONDARY} onClick={() => onChange(path, [...value, blankLike(value[0] ?? "")])}>
            <Trans context="proposed changes">Add one</Trans>
          </button>
        )}
      </fieldset>
    );
  }

  const edited = JSON.stringify(value ?? null) !== JSON.stringify(proposed ?? null);
  let editor: React.ReactNode;
  if (typeof value === "boolean") {
    editor = (
      <label className="flex min-h-11 items-center gap-3 text-foreground">
        <input id={id} type="checkbox" className="size-5 accent-notice" checked={value} onChange={(e) => onChange(path, e.target.checked)} />
        {value ? <Trans context="proposed changes">On</Trans> : <Trans context="proposed changes">Off</Trans>}
      </label>
    );
  } else if (typeof value === "number") {
    editor = <input id={id} type="number" className={FIELD} value={String(value)} onChange={(e) => onChange(path, e.target.value === "" ? 0 : Number(e.target.value))} />;
  } else if (isWordList(value)) {
    editor = (
      <div className="space-y-2">
        {value.map((x, i) => (
          <div key={i} className="flex items-start gap-2">
            <textarea
              aria-label={t({ message: `${label}, line ${i + 1}`, context: "proposed changes" })}
              className={`${FIELD} leading-relaxed [field-sizing:content] min-h-20`}
              rows={rowsFor(asText(x))}
              value={asText(x)}
              onChange={(e) => onChange(path, value.map((y, j) => (j === i ? e.target.value : y)))}
            />
            <button
              type="button"
              className={`${BTN_SECONDARY} shrink-0`}
              aria-label={t({ message: `Remove line ${i + 1}`, context: "proposed changes" })}
              onClick={() => onChange(path, value.filter((_, j) => j !== i))}
            >
              <Trans context="proposed changes">Remove</Trans>
            </button>
          </div>
        ))}
        <button type="button" className={BTN_SECONDARY} onClick={() => onChange(path, [...value, ""])}>
          <Trans context="proposed changes">Add a line</Trans>
        </button>
      </div>
    );
  } else {
    const text = asText(value);
    editor = <textarea id={id} className={`${FIELD} leading-relaxed [field-sizing:content] min-h-20`} rows={rowsFor(text)} value={text} onChange={(e) => onChange(path, e.target.value)} />;
  }

  return (
    <div className="min-w-0 space-y-2" data-field={path}>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={id} className={LABEL}>{label}</label>
        {edited && (
          <span className={CHIP_SOFT}>
            <Trans context="proposed changes">Edited</Trans>
          </span>
        )}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-border bg-muted p-3 sm:p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Trans context="proposed changes">Live now</Trans>
          </p>
          <LiveText value={live} />
        </div>
        <div className="min-w-0 rounded-xl border border-notice/60 p-3 sm:p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-notice">
            <Trans context="proposed changes">Proposed</Trans>
          </p>
          {editor}
        </div>
      </div>
      {mine.map((p, i) => (
        <p key={i} role="alert" className="text-sm font-medium text-destructive">
          {p.error}
        </p>
      ))}
    </div>
  );
}
