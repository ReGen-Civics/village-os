/**
 * GATHER: the three ways work reaches My moon, and adding an item by hand.
 *
 *   Bring in my tasks   `POST .../gather`: the task board first, then the rooms.
 *   Ask Sera            `POST .../ask-sera`, then the page polls `GET /api/me/moon`
 *                       while the recap's `sera.state` reads `running`, for at
 *                       most `SERA_TIMEOUT_MS`. A door that answers
 *                       `not_offered` says so in a sentence.
 *   Import from Claude  `POST .../import` twice (A2): the pasted pack is
 *                       previewed with its add, merge and skip counts and a
 *                       reason per skip, and only Import writes, with the
 *                       preview's hash.
 */
import { useLingui } from "@lingui/react/macro";
import { useEffect, useRef, useState } from "react";
import {
  SERA_TIMEOUT_MS,
  type PackPreview,
  type SeraState,
} from "@shared/moonRecap";
import * as api from "./moonApi";
import { ERROR, INPUT, LABEL, MUTED, SMALL_BTN, Section } from "./moonUi";
import { useMoonWords } from "@/components/myMoon/moonWords";

export interface GatherPanelProps {
  cycleId: string;
  editable: boolean;
  sera: SeraState | null;
  /** Read the moon again; resolves to its Sera state. */
  reload: () => Promise<SeraState | null>;
}

const POLL_MS = 3000;

export default function GatherPanel({ cycleId, editable, sera, reload }: GatherPanelProps) {
  const MW = useMoonWords();
  const [line, setLine] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"gather" | "sera" | "import" | "add" | null>(null);
  const [polling, setPolling] = useState(false);
  const [seraNow, setSeraNow] = useState<SeraState | null>(sera);
  const [pasting, setPasting] = useState(false);
  const [pack, setPack] = useState("");
  const [preview, setPreview] = useState<{ preview: PackPreview; hash: string; parsed: unknown } | null>(null);
  const [newText, setNewText] = useState("");
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => setSeraNow(sera), [sera]);

  const bringIn = async () => {
    setBusy("gather");
    setError(null);
    const r = await api.gather(cycleId);
    setBusy(null);
    if (!r.ok) return setError(r.error);
    setLine(MW.myMoon.gathered(r.data.added));
    await reload();
  };

  const poll = async (startedAt: number) => {
    setPolling(true);
    while (alive.current && Date.now() - startedAt < SERA_TIMEOUT_MS) {
      await new Promise((ok) => setTimeout(ok, POLL_MS));
      if (!alive.current) return;
      const s = await reload();
      setSeraNow(s);
      if (!s || s.state !== "running") break;
    }
    if (alive.current) setPolling(false);
  };

  const ask = async () => {
    setBusy("sera");
    setError(null);
    setLine(null);
    const r = await api.askSera(cycleId);
    setBusy(null);
    if (!r.ok) {
      setError(r.code === "not_offered" || r.status === 404 ? MW.myMoon.askSeraNotOffered : r.error);
      return;
    }
    setSeraNow(r.data.sera);
    if (r.data.sera.state === "running") void poll(Date.now());
    else await reload();
  };

  const previewPack = async () => {
    setError(null);
    setPreview(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(pack);
    } catch {
      return setError(api.refusalWords({ error: "not_a_pack" }));
    }
    setBusy("import");
    const r = await api.importPack(cycleId, parsed);
    setBusy(null);
    if (!r.ok) return setError(r.error);
    if (r.data.written) return;
    setPreview({ preview: r.data.preview, hash: r.data.previewHash, parsed });
  };

  const confirmImport = async () => {
    if (!preview) return;
    setBusy("import");
    setError(null);
    const r = await api.importPack(cycleId, preview.parsed, { previewHash: preview.hash });
    setBusy(null);
    if (!r.ok) return setError(r.error);
    if (r.data.written) setLine(MW.myMoon.imported(r.data.added, r.data.merged, r.data.skipped));
    setPreview(null);
    setPack("");
    setPasting(false);
    await reload();
  };

  const addByHand = async () => {
    if (!newText.trim()) return;
    setBusy("add");
    setError(null);
    const r = await api.addItem(cycleId, newText.trim());
    setBusy(null);
    if (!r.ok) return setError(r.error);
    setNewText("");
    await reload();
  };

  const s = seraNow;
  return (
    <Section title={MW.myMoon.gatherHeading}>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={SMALL_BTN} disabled={!editable || busy !== null} onClick={bringIn}>{MW.moon.gather}</button>
        <button type="button" className={SMALL_BTN} disabled={!editable || busy !== null || polling} onClick={ask}>{MW.moon.askSera}</button>
        <button type="button" className={SMALL_BTN} disabled={!editable || busy !== null} aria-expanded={pasting} onClick={() => setPasting((v) => !v)}>{MW.pack.button}</button>
      </div>
      <AskSeraDataLine />

      {s && s.state !== "idle" ? (
        <p className={MUTED} aria-live="polite" data-testid="sera-progress">
          {MW.seraState[s.state]}
          {s.state === "running" || s.added > 0 ? ` ${MW.myMoon.seraAdded(s.added)}` : ""}
          {s.line && s.line !== MW.seraState[s.state] ? ` ${s.line}` : ""}
        </p>
      ) : null}

      {pasting ? (
        <div className="flex flex-col gap-2">
          <label className={LABEL}>
            {MW.myMoon.pastePack}
            <textarea value={pack} rows={6} onChange={(e) => { setPack(e.target.value); setPreview(null); }} className={`${INPUT} font-mono text-xs`} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={SMALL_BTN} disabled={!pack.trim() || busy !== null} onClick={previewPack}>{MW.pack.preview}</button>
            <button type="button" className={SMALL_BTN} onClick={() => { setPasting(false); setPreview(null); }}>{MW.myMoon.cancel}</button>
          </div>
          {preview ? (
            <div className="flex flex-col gap-2 rounded-lg border border-border p-3" data-testid="pack-preview">
              <ul className="m-0 list-none p-0 text-sm text-foreground">
                <li>{MW.pack.added(preview.preview.add.length)}</li>
                <li>{MW.pack.merged(preview.preview.merge.length)}</li>
                <li>{MW.pack.skipped(preview.preview.skip.length)}</li>
              </ul>
              {preview.preview.skip.length > 0 ? (
                <ul className="m-0 list-disc pl-5 text-xs text-muted-foreground">
                  {preview.preview.skip.map((k) => <li key={k.index}>{MW.myMoon.skippedItem(k.index)}: {MW.packSkip[k.reason]}</li>)}
                </ul>
              ) : null}
              <button type="button" className={SMALL_BTN} disabled={busy !== null} onClick={confirmImport}>{MW.pack.confirm}</button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className={`${LABEL} flex-1`}>
          {MW.moon.addItem}
          <input value={newText} disabled={!editable} placeholder={MW.myMoon.newItemPlaceholder} onChange={(e) => setNewText(e.target.value)} className={INPUT} />
        </label>
        <button type="button" className={SMALL_BTN} disabled={!editable || !newText.trim() || busy !== null} onClick={addByHand}>{MW.moon.addItem}</button>
      </div>

      {line ? <p className={MUTED} aria-live="polite">{line}</p> : null}
      {error ? <p role="alert" className={ERROR}>{error}</p> : null}
    </Section>
  );
}

/** Where Ask Sera's words go, beside the button (the coordinator, 2026-11-09). */
function AskSeraDataLine() {
  const { t } = useLingui();
  return (
    <p className="mt-2 text-xs text-muted-foreground" data-testid="guide-data-line">
      {t({ message: "Asking sends your name and this moon's dates to Sera, only to gather what you took part in. Nothing is used to choose people for roles. Your journal never goes with it.", context: "my moon: where Ask Sera's words go" })}
    </p>
  );
}
