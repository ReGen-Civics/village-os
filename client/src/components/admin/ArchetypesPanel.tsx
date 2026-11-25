/**
 * The village's own words for its character classes.
 *
 * ── WHAT THIS EDITS ───────────────────────────────────────────────────────
 *
 * A member picks one of these when they make their character, and the words on
 * this panel are the words they read while choosing. The platform ships five
 * defaults (`shared/archetypes.ts`) and every village rewrites them. Once a
 * class is edited here the row's `customized` flag is set and the boot seed
 * stops overwriting it, so a copy improvement written for every village
 * reaches the villages still on the default wording and leaves this one alone.
 * The panel says that in plain words beside the flag, because a founder who
 * cannot see the flag has no way to know why their edit survived a deploy.
 *
 * ── THE KEY IS AN IDENTIFIER AND IS UNREACHABLE FROM THE EDIT PATH ────────
 *
 * `openPathsFor` (server/lib/characters.ts) joins on it, the per-power
 * affinity map keys on it, and every character row a member has ever chosen
 * stores it. A renamed key does not fail loudly. It matches nothing, and a
 * member's chosen class quietly stops resolving.
 *
 * "The form has no key box" is not a mechanism, so this file does not rely on
 * one. Three things make the key unreachable, and a reader checking the claim
 * can stop after them:
 *
 *   1. `Words` is the only shape the edit path holds, and it declares
 *      `key?: never`. That is a compile-time bar, not a convention: an
 *      `ArchetypeRow` (whose `key` is a `string`) cannot be assigned to it or
 *      spread into it, so the usual accident, widening an edit payload by
 *      spreading the row it came from, is a type error rather than a silent
 *      rename.
 *   2. `wordsOf` is the only constructor of a `Words`, and it names the five
 *      columns one at a time. Nothing in this file builds one from data.
 *   3. The PUT body is written out field by field at the call site, and the
 *      key travels in the URL PATH, where it selects a row. It is never a
 *      value in a body.
 *
 * The key is written in exactly one request in this file, the POST that adds a
 * class, because a class nobody has chosen yet has nothing pointing at it. The
 * add form says so where the founder types it.
 *
 * ── A REFUSAL SHOWS THE SERVER'S SENTENCE ─────────────────────────────────
 *
 * `sentenceFor` below, and the reason it refuses to print a body it could not
 * parse: this repo has already shipped a form that put the text of a 404 page
 * in front of a founder as if it were the reason their save failed.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ARCHETYPES, type ArchetypeSeed } from "@shared/archetypes";
import { API_BASE, authHeaders, refusal } from "./adminApi";
import PowerAffinityPanel from "./PowerAffinityPanel";
import SaveBar, { saveEach, type SaveResult } from "@/components/SaveBar";
import { Trans, useLingui } from "@lingui/react/macro";

/** One class as `GET /api/admin/archetypes` sends it. */
interface ArchetypeRow {
  key: string;
  name: string;
  subtitle: string;
  blurb: string;
  examples: string[];
  sigil: string;
  sortOrder?: number;
  customized?: boolean;
}

/**
 * The village's own words for one class. There is deliberately no key.
 *
 * `key?: never` is point 1 of the guarantee in the header. Without it this
 * type would accept an `ArchetypeRow` structurally, and `JSON.stringify` of
 * that value would put a key on the wire. With it, the assignment does not
 * compile.
 */
interface Words {
  name: string;
  subtitle: string;
  blurb: string;
  examples: string[];
  sigil: string;
  key?: never;
}

/** How many example boxes a class always offers. */
const EXAMPLE_SLOTS = 4;

/**
 * The sigils the platform ships, offered as suggestions.
 *
 * Read from the seed rather than typed out here, so a sixth glyph added to
 * `shared/archetypes.ts` appears in this list instead of leaving the hint
 * quietly describing a library that has moved on. The box stays free text: the
 * glyph library is not this panel's to police.
 */
const SEED_SIGILS = Array.from(new Set(ARCHETYPES.map((a) => a.sigil))).sort();

const inputCls =
  "border border-gray-200 rounded-lg px-2 py-1.5 text-sm min-h-[44px] w-full focus:outline-none focus:ring-2 focus:ring-teal-deep";
const areaCls =
  "border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-teal-deep";
const btnCls =
  "min-h-[44px] px-3 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-deep disabled:opacity-40";
const moveCls =
  "min-h-[44px] px-2.5 text-xs rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-deep disabled:opacity-40";
const primaryCls =
  "min-h-[44px] px-4 text-sm rounded-lg bg-teal-deep text-white font-medium focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-teal-deep disabled:opacity-40";

/** A blank class for the add form. A function, so no caller can edit a shared object. */
const blankSeed = (): ArchetypeSeed => ({
  key: "",
  name: "",
  subtitle: "",
  blurb: "",
  examples: Array.from({ length: EXAMPLE_SLOTS }, () => ""),
  sigil: "",
});

/**
 * Always at least four boxes, and never fewer boxes than the class has words.
 *
 * Padding to exactly four would drop a fifth example the moment the form
 * loaded, and the founder would not be told. Growing the list instead means
 * what is on screen is what the class holds.
 */
const exampleSlots = (list: unknown): string[] => {
  const src = Array.isArray(list) ? list.map((s) => String(s ?? "")) : [];
  while (src.length < EXAMPLE_SLOTS) src.push("");
  return src;
};

/** The only constructor of a `Words`. Five columns, named one at a time. */
const wordsOf = (row: ArchetypeRow): Words => ({
  name: String(row.name ?? ""),
  subtitle: String(row.subtitle ?? ""),
  blurb: String(row.blurb ?? ""),
  examples: exampleSlots(row.examples),
  sigil: String(row.sigil ?? ""),
});

/** What actually goes to the server: trimmed, with the blank boxes dropped. */
const keptExamples = (examples: string[]): string[] =>
  examples.map((s) => s.trim()).filter(Boolean);

/** True while this card holds words the server has not been told about. */
const isDirty = (row: ArchetypeRow, w: Words): boolean =>
  w.name.trim() !== String(row.name ?? "").trim() ||
  w.subtitle.trim() !== String(row.subtitle ?? "").trim() ||
  w.blurb.trim() !== String(row.blurb ?? "").trim() ||
  w.sigil.trim() !== String(row.sigil ?? "").trim() ||
  keptExamples(w.examples).join("\n") !== keptExamples(exampleSlots(row.examples)).join("\n");

/**
 * The server's sentence, or an honest line naming the status.
 *
 * A refusal that is not JSON at all is the case this guards. The SPA fallback
 * answers an unknown path with an HTML document, and a handler that printed
 * `await res.text()` would show a founder the page source and call it the
 * reason. `res.json()` throws on that body, and the catch turns the failure
 * into a sentence that at least says what happened.
 */
async function sentenceFor(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  if (body && typeof body === "object") return refusal(body, `${fallback} (status ${res.status})`);
  return `${fallback} (status ${res.status})`;
}

/**
 * An id a label can point at, from a key this panel does not get to choose.
 *
 * The row's position is in there because the sanitiser is lossy: two villages'
 * keys of `a.b` and `a-b` would both flatten to `a-b` and put two controls on
 * one id, which is a label pointing at the wrong box. The position is unique
 * by construction, so the pair cannot collide.
 */
const idFor = (index: number, key: string): string =>
  `arch-${index}-${key.replace(/[^A-Za-z0-9_-]/g, "-")}`;

/**
 * One labelled box.
 *
 * A real `<label htmlFor>` rather than a wrapping label, because a wrapping
 * label names its control with every string inside it, and the hints under
 * these boxes would then be read out as part of the field name on every focus.
 * The hint is joined on with `aria-describedby`, where it belongs.
 */
function Field({
  id,
  label,
  value,
  onChange,
  hint,
  rows,
  list,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  hint?: string;
  rows?: number;
  list?: string;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-gray-700">
        {label}
      </label>
      {rows ? (
        <textarea
          id={id}
          rows={rows}
          value={value}
          aria-describedby={hintId}
          onChange={(e) => onChange(e.target.value)}
          className={`${areaCls} mt-1`}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          list={list}
          aria-describedby={hintId}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} mt-1`}
        />
      )}
      {hint ? (
        <p id={hintId} className="mt-0.5 text-[11px] text-gray-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** The five example boxes, grouped and each one named. */
function ExampleBoxes({
  idBase,
  examples,
  onChange,
}: {
  idBase: string;
  examples: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <fieldset className="border-0 p-0 m-0">
      <legend className="text-xs font-medium text-gray-700"><Trans context="ArchetypesPanel, legend">What this looks like</Trans></legend>
      <p className="text-[11px] text-gray-400 mb-1">
        <Trans context="ArchetypesPanel, p">Four short lines a member reads while choosing. A blank line is dropped when you save.
      </Trans></p>
      <div className="grid sm:grid-cols-2 gap-2">
        {examples.map((value, i) => (
          <Field
            key={i}
            id={`${idBase}-example-${i + 1}`}
            label={`Example ${i + 1}`}
            value={value}
            onChange={(next) => onChange(examples.map((v, j) => (j === i ? next : v)))}
          />
        ))}
      </div>
    </fieldset>
  );
}

export default function ArchetypesPanel({ password }: { password: string }) {
  const { t } = useLingui();
  const [rows, setRows] = useState<ArchetypeRow[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Words>>({});
  const [loadError, setLoadError] = useState("");
  const [reordering, setReordering] = useState(false);
  const [moveNote, setMoveNote] = useState("");
  const [adding, setAdding] = useState(false);
  const [newClass, setNewClass] = useState<ArchetypeSeed>(blankSeed);
  const [addingNow, setAddingNow] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/archetypes`, { headers: authHeaders(password) });
      if (!res.ok) {
        setLoadError(await sentenceFor(res, "The classes did not load"));
        setRows([]);
        return;
      }
      const d = await res.json().catch(() => null);
      const list: ArchetypeRow[] = Array.isArray(d?.archetypes)
        ? d.archetypes
        : Array.isArray(d)
          ? d
          : [];
      setLoadError("");
      setRows(list);
      setDrafts(Object.fromEntries(list.map((r) => [r.key, wordsOf(r)])));
    } catch {
      setLoadError("The classes did not load. The server did not answer.");
      setRows([]);
    }
  }, [password]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Save one class. Null when it landed, the server's reason when it did not:
   * the page's one save bar (components/SaveBar.tsx) runs this for every class
   * holding changes and keeps the ones that failed.
   *
   * The key rides in the path and selects the row. The body is five named
   * fields, written out here rather than handed a variable, so a reader can
   * see the whole of what an edit can say without leaving this function.
   */
  const save = async (key: string): Promise<string | null> => {
    const words = drafts[key];
    if (!words) return null;
    try {
      const res = await fetch(`${API_BASE}/admin/archetypes/${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: authHeaders(password, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          name: words.name.trim(),
          subtitle: words.subtitle.trim(),
          blurb: words.blurb.trim(),
          examples: keptExamples(words.examples),
          sigil: words.sigil.trim(),
        }),
      });
      if (!res.ok) return await sentenceFor(res, "That did not save");
      const d = await res.json().catch(() => null);
      const saved: ArchetypeRow | null = d?.archetype ?? null;
      // `key: r.key` LAST, after the echo is spread. A response body cannot
      // move a card onto another class's identity even by accident.
      setRows((prev) =>
        (prev ?? []).map((r) =>
          r.key === key ? { ...r, ...(saved ?? {}), key: r.key, customized: true } : r,
        ),
      );
      if (saved) setDrafts((prev) => ({ ...prev, [key]: wordsOf(saved) }));
      return null;
    } catch {
      return t({ message: "That did not save. The server did not answer.", context: "ArchetypesPanel, toast" });
    }
  };

  /**
   * Move one class up or down, and tell the server straight away.
   *
   * The list moves first so the screen answers the click, and it moves BACK if
   * the server refuses, so what is on screen is only ever the order the server
   * holds. Buttons, not drag handles: a founder on a keyboard gets the same
   * control as one with a mouse, with no second implementation to keep honest.
   *
   * A REF HOLDS OFF THE SECOND CLICK, AND `disabled` DOES NOT. Disabling these
   * buttons while the request is in flight would take focus off the button the
   * founder had just pressed, because a browser moves focus to the body when
   * the focused element is disabled. On a keyboard that is the reorder control
   * vanishing from under them after every single move. The ref refuses a
   * re-entrant call without touching the DOM, so focus stays where it was.
   */
  const orderBusy = useRef(false);
  const move = async (index: number, delta: number) => {
    if (orderBusy.current) return;
    const before = rows ?? [];
    const target = index + delta;
    if (target < 0 || target >= before.length) return;
    orderBusy.current = true;
    const next = before.slice();
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    setRows(next);
    setReordering(true);
    try {
      const res = await fetch(`${API_BASE}/admin/archetypes/order`, {
        method: "PUT",
        headers: authHeaders(password, { "Content-Type": "application/json" }),
        body: JSON.stringify({ keys: next.map((r) => r.key) }),
      });
      if (!res.ok) {
        setRows(before);
        toast.error(await sentenceFor(res, "The order did not save"));
        return;
      }
      setMoveNote(`${moved.name || moved.key} is now number ${target + 1} of ${next.length}`);
    } catch {
      setRows(before);
      toast.error(t({ message: "The order did not save. The server did not answer.", context: "ArchetypesPanel, toast" }));
    } finally {
      orderBusy.current = false;
      setReordering(false);
    }
  };

  const trimmedNewKey = newClass.key.trim();
  const keyTaken = (rows ?? []).some((r) => r.key === trimmedNewKey);
  const canAdd = Boolean(trimmedNewKey) && Boolean(newClass.name.trim()) && !keyTaken;

  /** The only request in this file that puts a key in a body. */
  const add = async () => {
    if (!canAdd) return;
    setAddingNow(true);
    try {
      const res = await fetch(`${API_BASE}/admin/archetypes`, {
        method: "POST",
        headers: authHeaders(password, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          key: trimmedNewKey,
          name: newClass.name.trim(),
          subtitle: newClass.subtitle.trim(),
          blurb: newClass.blurb.trim(),
          examples: keptExamples(newClass.examples),
          sigil: newClass.sigil.trim(),
        }),
      });
      if (!res.ok) {
        toast.error(await sentenceFor(res, "The class was not added"));
        return;
      }
      const d = await res.json().catch(() => null);
      const created: ArchetypeRow | null = d?.archetype ?? null;
      if (created) {
        // Appended rather than reloaded, so unsaved words in another card
        // survive somebody adding a class.
        setRows((prev) => [...(prev ?? []), created]);
        setDrafts((prev) => ({ ...prev, [created.key]: wordsOf(created) }));
      } else {
        await load();
      }
      setNewClass(blankSeed());
      setAdding(false);
      toast.success(`"${newClass.name.trim()}" added. Its key is fixed from now on`);
    } catch {
      toast.error(t({ message: "The class was not added. The server did not answer.", context: "ArchetypesPanel, toast" }));
    } finally {
      setAddingNow(false);
    }
  };

  if (rows === null && !loadError) return null;
  const list = rows ?? [];
  const dirtyRows = list.filter((r) => drafts[r.key] && isDirty(r, drafts[r.key]));
  const saveAll = async (): Promise<SaveResult> => (await saveEach(dirtyRows.map((r) => ({
    key: r.key, label: drafts[r.key]?.name.trim() || r.name || r.key, run: () => save(r.key),
  })))).result;

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 mt-4">
      <h3 className="font-semibold text-gray-900 mb-1"><Trans context="ArchetypesPanel, h3">Character classes</Trans></h3>
      <p className="text-xs text-gray-500 mb-2">
        <Trans context="ArchetypesPanel, p">A member picks one of these when they make their character, and these are the words they
        read while choosing. The platform ships five. Rewrite any of them in your village's own
        language, reorder them, or add one of your own.
      </Trans></p>
      <p className="text-[11px] text-gray-400 mb-4">
        <Trans context="ArchetypesPanel, p">The name you give a class is <span className="font-medium text-gray-500">always</span>{" "}
        yours: it is never replaced, marked or not. A class marked{" "}
        <span className="font-medium text-gray-500">Your words</span> keeps everything else you
        wrote here too, through every deploy. On a class with no mark, the subtitle, description,
        examples and sigil are still refreshed from the platform when this village is redeployed,
        so an improvement to the shipped wording reaches you.
      </Trans></p>

      {loadError ? (
        <p role="alert" className="text-sm text-red-600 border border-red-200 rounded-lg p-3 mb-4">
          {loadError}
        </p>
      ) : null}

      <p aria-live="polite" className="sr-only">
        {moveNote}
      </p>

      <datalist id="arch-sigil-options">
        {SEED_SIGILS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      {reordering ? (
        <p className="text-[11px] text-gray-500 mb-2"><Trans context="ArchetypesPanel, p">Saving the order…</Trans></p>
      ) : null}

      <ol className="space-y-4">
        {list.map((row, i) => {
          const words = drafts[row.key] ?? wordsOf(row);
          const base = idFor(i, row.key);
          const label = words.name.trim() || row.name || row.key;
          const dirty = isDirty(row, words);
          // Patched off the LATEST draft, not off the one this render closed
          // over. Two keystrokes in two boxes inside one frame both land.
          const setWords = (patch: Partial<Words>) =>
            setDrafts((prev) => ({
              ...prev,
              [row.key]: { ...(prev[row.key] ?? wordsOf(row)), ...patch },
            }));
          return (
            <li key={row.key} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-gray-900">{label}</h4>
                  {/*
                    Text, not a disabled input. A disabled box says a person
                    with more permission could change this, and the truth is
                    that nothing may change it ever.
                  */}
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Identifier{" "}
                    <code className="font-mono text-gray-700 bg-gray-50 px-1 rounded">
                      {row.key}
                    </code>
                    . Fixed for good. Every member who has chosen this class has it stored against
                    this word, so a new one would match nobody.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {row.customized ? (
                    <span className="text-[11px] font-medium text-teal-deep border border-gray-200 rounded-full px-2 py-0.5">
                      <Trans context="ArchetypesPanel, span">Your words
                    </Trans></span>
                  ) : null}
                  <button
                    type="button"
                    className={moveCls}
                    aria-label={`Move ${label} up`}
                    disabled={i === 0}
                    onClick={() => void move(i, -1)}
                  >
                    <Trans context="ArchetypesPanel, button">Up
                  </Trans></button>
                  <button
                    type="button"
                    className={moveCls}
                    aria-label={`Move ${label} down`}
                    disabled={i === list.length - 1}
                    onClick={() => void move(i, 1)}
                  >
                    <Trans context="ArchetypesPanel, button">Down
                  </Trans></button>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <Field
                  id={`${base}-name`}
                  label={t({ message: "Name", context: "ArchetypesPanel, label" })}
                  value={words.name}
                  onChange={(v) => setWords({ name: v })}
                  hint="What this class is called, for example The Builder."
                />
                <Field
                  id={`${base}-subtitle`}
                  label={t({ message: "Subtitle", context: "ArchetypesPanel, label" })}
                  value={words.subtitle}
                  onChange={(v) => setWords({ subtitle: v })}
                  hint="The kind of contribution, in a few words."
                />
              </div>

              <div className="mt-3">
                <Field
                  id={`${base}-blurb`}
                  label={t({ message: "Description", context: "ArchetypesPanel, label" })}
                  rows={3}
                  value={words.blurb}
                  onChange={(v) => setWords({ blurb: v })}
                  hint="One or two sentences on what this class does here."
                />
              </div>

              <div className="mt-3">
                <ExampleBoxes
                  idBase={base}
                  examples={words.examples}
                  onChange={(next) => setWords({ examples: next })}
                />
              </div>

              <div className="mt-3 sm:max-w-xs">
                <Field
                  id={`${base}-sigil`}
                  label={t({ message: "Sigil", context: "ArchetypesPanel, label" })}
                  value={words.sigil}
                  list="arch-sigil-options"
                  onChange={(v) => setWords({ sigil: v })}
                  hint="The name of a glyph in the shared library. A name, never a file path."
                />
              </div>

              {dirty ? (
                <p className="mt-3 text-[11px] text-gray-500">
                  <Trans context="ArchetypesPanel, span">Unsaved changes on this class.
                </Trans></p>
              ) : null}
            </li>
          );
        })}
      </ol>

      <SaveBar
        count={dirtyRows.length}
        onSave={saveAll}
        onDiscard={() => setDrafts(Object.fromEntries(list.map((r) => [r.key, wordsOf(r)])))}
        what={t({ message: "the character classes", context: "ArchetypesPanel, what the save bar saves" })}
      />

      <div className="mt-5 border-t border-gray-100 pt-4">
        <button
          type="button"
          className={btnCls}
          aria-expanded={adding}
          onClick={() => setAdding(!adding)}
        >
          {adding ? "Close" : "Add a class"}
        </button>

        {adding ? (
          <div className="mt-3 space-y-3">
            <Field
              id="arch-new-key"
              label={t({ message: "Identifier", context: "ArchetypesPanel, label" })}
              value={newClass.key}
              onChange={(v) => setNewClass({ ...newClass, key: v })}
              hint="One lowercase word, no spaces, for example gardening. This is the only moment it can be set. From the first member who picks this class, their character is stored against this word and it can never be changed."
            />
            {keyTaken ? (
              <p role="alert" className="text-[11px] text-red-600">
                <Trans context="ArchetypesPanel, p">This village already has a class with the identifier {trimmedNewKey}.
              </Trans></p>
            ) : null}
            <div className="grid sm:grid-cols-2 gap-3">
              <Field
                id="arch-new-name"
                label={t({ message: "Name", context: "ArchetypesPanel, label" })}
                value={newClass.name}
                onChange={(v) => setNewClass({ ...newClass, name: v })}
                hint="What members see. This one you can change later."
              />
              <Field
                id="arch-new-subtitle"
                label={t({ message: "Subtitle", context: "ArchetypesPanel, label" })}
                value={newClass.subtitle}
                onChange={(v) => setNewClass({ ...newClass, subtitle: v })}
              />
            </div>
            <Field
              id="arch-new-blurb"
              label={t({ message: "Description", context: "ArchetypesPanel, label" })}
              rows={3}
              value={newClass.blurb}
              onChange={(v) => setNewClass({ ...newClass, blurb: v })}
            />
            <ExampleBoxes
              idBase="arch-new"
              examples={newClass.examples}
              onChange={(next) => setNewClass({ ...newClass, examples: next })}
            />
            <div className="sm:max-w-xs">
              <Field
                id="arch-new-sigil"
                label={t({ message: "Sigil", context: "ArchetypesPanel, label" })}
                value={newClass.sigil}
                list="arch-sigil-options"
                onChange={(v) => setNewClass({ ...newClass, sigil: v })}
                hint="The name of a glyph in the shared library."
              />
            </div>
            <button
              type="button"
              className={primaryCls}
              disabled={!canAdd || addingNow}
              onClick={() => void add()}
            >
              {addingNow ? "Adding…" : "Add this class"}
            </button>
          </div>
        ) : null}
      </div>

      {/* Which powers suit each class, keyed by the same identifiers this panel
          keeps out of reach. `castKey` moves when a class is added or renamed
          here, so the table's columns follow the cast. */}
      <StockFaces password={password} names={Object.fromEntries(list.map((r) => [r.key, r.name]))} />

      <PowerAffinityPanel
        password={password}
        castKey={list.map((r) => `${r.key}:${r.name}`).join("|")}
        castOrder={list.map((r) => r.key)}
      />
    </div>
  );
}

/**
 * THE VILLAGE'S OWN FACES (gap G10). The thirty stock drawings a member picks
 * from, by class, two presentations and three skin tones. A village may
 * replace any of them (server/routes/stockArt.ts): each picture is cropped to
 * 3:4, stripped and served at the same address, so every page shows it. "Load
 * a set" takes many files at once and matches them by file name
 * (`building-f-deep.webp` and so on), refusing any name outside the thirty.
 */
function StockFaces({ password, names }: { password: string; names: Record<string, string> }) {
  const { t } = useLingui();
  const [slots, setSlots] = useState<string[]>([]);
  const [replaced, setReplaced] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");
  const [bust, setBust] = useState(() => Date.now());

  const load = useCallback(async () => {
    const res = await fetch(`${API_BASE}/admin/characters/stock-art`, { headers: authHeaders(password) }).catch(() => null);
    const d = res?.ok ? await res.json().catch(() => null) : null;
    if (d) {
      setSlots(Array.isArray(d.slots) ? d.slots : []);
      setReplaced(Array.isArray(d.replaced) ? d.replaced : []);
    }
  }, [password]);
  useEffect(() => {
    void load();
  }, [load]);

  const upload = async (slot: string, file: File): Promise<boolean> => {
    const form = new FormData();
    form.append("art", file);
    const res = await fetch(`${API_BASE}/admin/characters/stock-art/${encodeURIComponent(slot)}`, {
      method: "PUT",
      headers: authHeaders(password),
      body: form,
    }).catch(() => null);
    if (!res?.ok) {
      toast.error(refusal(await res?.json().catch(() => null), t`That face did not save.`));
      return false;
    }
    return true;
  };

  const loadSet = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    let done = 0;
    const refused: string[] = [];
    for (const f of Array.from(files)) {
      const slot = f.name.replace(/\.[a-z0-9]+$/i, "");
      if (!slots.includes(slot)) {
        refused.push(f.name);
        continue;
      }
      if (await upload(slot, f)) done += 1;
    }
    setBusy(false);
    setBust(Date.now());
    await load();
    setSaid(
      refused.length
        ? t`Loaded ${done} faces. Not part of the cast, so left out: ${refused.join(", ")}.`
        : t({ message: `Loaded ${done} faces.`, context: "admin character classes: after loading a set of stock portraits" }),
    );
  };

  const reset = async (slot: string) => {
    const res = await fetch(`${API_BASE}/admin/characters/stock-art/${encodeURIComponent(slot)}`, {
      method: "DELETE",
      headers: authHeaders(password),
    }).catch(() => null);
    if (!res?.ok) toast.error(refusal(await res?.json().catch(() => null), t`That face did not reset.`));
    setBust(Date.now());
    await load();
  };

  if (!slots.length) return null;
  const byClass = new Map<string, string[]>();
  for (const s of slots) {
    const key = s.split("-")[0];
    byClass.set(key, [...(byClass.get(key) ?? []), s]);
  }

  return (
    <section className="mt-6" aria-labelledby="stock-faces-h">
      <h4 id="stock-faces-h" className="font-semibold text-foreground mb-1">
        <Trans context="admin character classes: the stock portraits heading">Faces</Trans>
      </h4>
      <p className="text-xs text-muted-foreground mb-3 max-w-prose">
        <Trans>
          The pictures a member picks from when they make their character: two for each class, in three skin tones.
          Replace any of them with your village's own. They are cropped to 3:4 and every page shows them.
        </Trans>
      </p>
      <label className={`${btnCls} inline-flex items-center mb-3 cursor-pointer`}>
        <input type="file" accept="image/*" multiple className="sr-only" disabled={busy} onChange={(e) => void loadSet(e.target.files)} />
        {busy ? <Trans context="admin character classes: while a set of stock portraits uploads">Loading the set…</Trans> : <Trans context="admin character classes: upload many stock portraits at once">Load a set</Trans>}
      </label>
      <p aria-live="polite" className="text-xs text-muted-foreground mb-3">{said}</p>
      {Array.from(byClass.entries()).map(([key, faces]) => (
        <div key={key} className="mb-4">
          <p className="text-sm font-medium text-foreground mb-1.5">{names[key] ?? key}</p>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {faces.map((slot) => {
              const own = replaced.includes(slot);
              return (
                <li key={slot} className="flex flex-col gap-1">
                  <img src={`/images/avatars/${slot}.webp?v=${bust}`} alt={slot} className="aspect-[3/4] w-full rounded-lg object-cover" loading="lazy" />
                  <label className={`${moveCls} inline-flex items-center justify-center cursor-pointer`}>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f && (await upload(slot, f))) {
                          setBust(Date.now());
                          await load();
                        }
                      }}
                    />
                    <Trans context="admin character classes: replace one stock portrait">Replace</Trans>
                  </label>
                  {own ? (
                    <button type="button" className={moveCls} onClick={() => void reset(slot)}>
                      <Trans context="admin character classes: go back to the platform's stock portrait">Use the platform's</Trans>
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
