/**
 * One lens of the welcome (CompanionWelcome.tsx, beat 3): what it asks, what
 * it changes, who sees it, and the member's yes. Birth details for the Vedic
 * Moon stay in this component's memory and are never sent.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Trans, useLingui } from "@lingui/react/macro";
import MicButton from "@/components/MicButton";
import { BTN_GOLD, BTN_LINE } from "@/components/profileDash/dashUi";
import { BIG_FIVE, ENNEAGRAM, LENS_PRIVACY, NAKSHATRA, RASHI, lensNote, type LensId, type LensView, type WelcomePayload } from "@shared/companionPersona";
import { INPUT, MIC_CLASS, MIC_LINE, send } from "./welcomeKit";

// ── the lens sheet ──────────────────────────────────────────────────────────

const SMALL = "!min-h-9 !px-3.5 !py-1.5 !text-[13px]";

/** Each lens's round mark, as on the approved board. */
const GLYPH: Record<LensId | "gk", { color: string; mark: string }> = {
  gk: { color: "var(--color-dash-gold)", mark: "GK" },
  vedic: { color: "var(--color-dash-voice)", mark: "☾" },
  type: { color: "var(--color-dash-thanks)", mark: "◇" },
  own: { color: "var(--color-dash-cash)", mark: "✎" },
};

export type SheetId = LensId | "gk";

function zones(): string[] {
  try {
    const all = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone");
    if (all?.length) return all;
  } catch {
    /* an older browser: the member's own zone only */
  }
  return [Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"];
}

export function LensSheet({
  id,
  companionName,
  current,
  gk,
  onSaved,
  onClose,
}: {
  id: SheetId;
  companionName: string;
  current: LensView | null;
  gk: WelcomePayload["geneKeys"];
  onSaved: (lenses: LensView[] | null, gkUses?: boolean) => void;
  onClose: () => void;
}) {
  const { t } = useLingui();
  // Focus moves into the sheet as it opens; the welcome puts it back on the lens that opened it.
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => box.current?.focus(), []);
  const [yes, setYes] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Vedic: the birth details stay in this component's memory and are never sent.
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [zone, setZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [moon, setMoon] = useState<{ rashi: number | null; nakshatra: number | null } | null>(
    current?.lens === "vedic" ? (current.data as { rashi: number; nakshatra: number | null }) : null,
  );
  // Type.
  const t0 = current?.lens === "type" ? (current.data as { enneagram: number | null; four: string | null; bigFive: number[] | null }) : null;
  const [enneagram, setEnneagram] = useState<string>(t0?.enneagram ? String(t0.enneagram) : "");
  const [four, setFour] = useState(t0?.four ?? "");
  const [useFive, setUseFive] = useState(Boolean(t0?.bigFive));
  const [five, setFive] = useState<number[]>(t0?.bigFive ?? [50, 50, 50, 50, 50]);
  // Own words.
  const [own, setOwn] = useState(current?.lens === "own" ? (current.data as { text: string }).text : "");

  const title = id === "gk" ? t({ message: "Gene Keys and Human Design", context: "companion lens sheet" }) : id === "vedic" ? t({ message: "Vedic chart", context: "companion lens sheet" }) : id === "type" ? t({ message: "Personality type", context: "companion lens sheet" }) : t({ message: "In your own words", context: "companion lens sheet" });
  const added = id === "gk" ? Boolean(gk?.guideUses) : Boolean(current);

  const workOut = async () => {
    setError(null);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!m) return setError(t({ message: "Choose your birth date first.", context: "companion lens sheet" }));
    const sky = await import("@shared/geneKeysSky");
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const tm = /^(\d{2}):(\d{2})$/.exec(time);
    const instants = tm
      ? [sky.zonedToUtc(y, mo, d, Number(tm[1]), Number(tm[2]), zone)]
      : [sky.zonedToUtc(y, mo, d, 0, 0, zone), sky.zonedToUtc(y, mo, d, 23, 59, zone)];
    const v = sky.vedicMoon(instants);
    if (v.rashi === null) return setError(t({ message: "Your Moon changed sign that day. Add your birth time so I can tell which.", context: "companion lens sheet" }));
    setMoon(v);
  };

  const data = (): unknown => {
    if (id === "vedic") return moon;
    if (id === "type") return { enneagram: enneagram ? Number(enneagram) : null, four: four.trim() || null, bigFive: useFive ? five : null };
    return { text: own };
  };

  const preview = (): string | null => {
    if (id === "gk") return gk?.has ? `I'll let your lines (${gk.profile}) and your Human Design type (${gk.hdType}) shape how I put things, lightly, and I'll say so when I do.` : null;
    if (id === "vedic") return moon && moon.rashi !== null ? lensNote("vedic", { rashi: moon.rashi, nakshatra: moon.nakshatra }).replace("Their", "Your").replace("Keep your tone", "I'll keep my tone") : null;
    if (id === "type") {
      if (!enneagram && !four.trim() && !useFive) return null;
      const n = lensNote("type", { enneagram: enneagram ? Number(enneagram) : null, four: /^[EI][SN][TF][JP]$/i.test(four.trim()) ? four.trim().toUpperCase() : null, bigFive: useFive ? five : null });
      return n || null;
    }
    return own.trim() ? `I'll remember, in your words: "${own.trim()}"` : null;
  };

  const save = async () => {
    setError(null);
    if (!yes) return setError(t({ message: "Tick the box to say yes first.", context: "companion lens sheet" }));
    setBusy(true);
    if (id === "gk") {
      const r = await send("/api/gene-keys/me", "PATCH", { maia: true });
      setBusy(false);
      if (!r.ok) return setError(r.json?.error ?? t({ message: "That could not be saved just now.", context: "companion lens sheet" }));
      return onSaved(null, true);
    }
    const r = await send(`/api/me/companion-lenses/${id}`, "PUT", { consent: true, data: data() });
    setBusy(false);
    if (!r.ok) return setError(r.json?.error ?? t({ message: "That could not be saved just now.", context: "companion lens sheet" }));
    onSaved(r.json?.lenses ?? null);
  };

  const remove = async () => {
    setBusy(true);
    if (id === "gk") {
      const r = await send("/api/gene-keys/me", "PATCH", { maia: false });
      setBusy(false);
      if (!r.ok) return setError(r.json?.error ?? t({ message: "That could not be changed just now.", context: "companion lens sheet" }));
      return onSaved(null, false);
    }
    const r = await send(`/api/me/companion-lenses/${id}`, "DELETE");
    setBusy(false);
    if (!r.ok) return setError(r.json?.error ?? t({ message: "That could not be deleted just now.", context: "companion lens sheet" }));
    onSaved(r.json?.lenses ?? null);
  };

  const say = preview();
  const canSave = id === "gk" ? Boolean(gk?.has) : Boolean(say);
  const field = "flex flex-col gap-1 text-xs text-muted-foreground";

  return (
    <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="cw-up outline-none absolute inset-x-0 bottom-0 z-40 flex max-h-[86%] flex-col gap-2.5 overflow-y-auto rounded-t-[22px] border-t border-dash-gold-edge bg-card p-[18px] shadow-[0_-20px_40px_rgba(0,0,0,0.5)]">
      <div className="flex items-center gap-2.5">
        <span className="grid size-[34px] shrink-0 place-items-center rounded-full font-display text-[15px] text-dash-gold-ink" style={{ background: GLYPH[id].color }} aria-hidden="true">
          {id === "gk" ? (gk?.profile ?? "GK") : id === "type" ? (enneagram || "◇") : GLYPH[id].mark}
        </span>
        <h3 className="m-0 font-display text-[19px] text-foreground">{title}</h3>
      </div>

      {id === "gk" ? (
        gk?.has ? (
          <p className="m-0 rounded-xl border border-dashed border-dash-edge bg-background p-2.5 text-xs text-muted-foreground">
            <Trans context="companion welcome">
              I'll use the reading you already made: <b className="text-dash-cash">{gk.profile}</b>, {gk.hdType}.
            </Trans>
          </p>
        ) : (
          <p className="m-0 text-sm text-muted-foreground">
            <Trans context="companion welcome">Find your lines first, then come back here.</Trans>{" "}
            <Link href="/profile/gene-keys" className="text-dash-gold-lit underline underline-offset-2">
              <Trans context="companion welcome">Get your Gene Keys</Trans>
            </Link>
          </p>
        )
      ) : null}

      {id === "vedic" ? (
        <>
          <label className={field}>
            <Trans context="companion welcome">Birth date</Trans>
            <input type="date" className={INPUT} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className={field}>
            <Trans context="companion welcome">Birth time (if you know it)</Trans>
            <input type="time" className={INPUT} value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
          <label className={field}>
            <Trans context="companion welcome">Time zone where you were born</Trans>
            <select className={INPUT} value={zone} onChange={(e) => setZone(e.target.value)}>
              {zones().map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className={`${BTN_LINE} self-start`} onClick={() => void workOut()}>
            <Trans context="companion welcome">Work out my Moon</Trans>
          </button>
          {moon && moon.rashi !== null ? (
            <p className="m-0 text-sm text-dash-gold-lit">
              {moon.nakshatra !== null ? t({ message: `Moon in ${RASHI[moon.rashi]}, ${NAKSHATRA[moon.nakshatra]}`, context: "companion welcome" }) : t({ message: `Moon in ${RASHI[moon.rashi]} (add your birth time for your nakshatra)`, context: "companion welcome" })}
            </p>
          ) : null}
          <p className="m-0 text-xs text-muted-foreground">
            <Trans context="companion welcome">Worked out on this device. Your birth date, time and place are never sent or kept. Only your Moon sign and nakshatra are saved.</Trans>
          </p>
        </>
      ) : null}

      {id === "type" ? (
        <>
          <label className={field}>
            <Trans context="companion welcome">Enneagram</Trans>
            <select className={INPUT} value={enneagram} onChange={(e) => setEnneagram(e.target.value)}>
              <option value="">{t({ message: `Not sure`, context: "companion welcome" })}</option>
              {ENNEAGRAM.map((n, i) => (
                <option key={n} value={String(i + 1)}>
                  {t({ message: `Type ${i + 1}, ${n}`, context: "companion welcome" })}
                </option>
              ))}
            </select>
          </label>
          <label className={field}>
            <Trans context="companion welcome">Four-letter type (optional)</Trans>
            <input className={INPUT} value={four} maxLength={4} placeholder={t({ message: `INFP`, context: "companion welcome" })} onChange={(e) => setFour(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={useFive} onChange={(e) => setUseFive(e.target.checked)} /> <Trans context="companion welcome">Slide my Big Five too</Trans>
          </label>
          {useFive
            ? BIG_FIVE.map((b, i) => (
                <label key={b} className="grid grid-cols-[120px_1fr] items-center gap-2 text-xs text-muted-foreground">
                  {b}
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={five[i]}
                    className="accent-[var(--color-dash-gold)]"
                    onChange={(e) => setFive((f) => f.map((x, j) => (j === i ? Number(e.target.value) : x)))}
                  />
                </label>
              ))
            : null}
        </>
      ) : null}

      {id === "own" ? (
        <label className={field}>
          <Trans context="companion welcome">How do you like to be helped?</Trans>
          <span className="flex items-start gap-2">
            <textarea className={`${INPUT} min-h-20 py-2`} maxLength={400} value={own} placeholder={t({ message: `Night owl. Short messages. Love metaphors.`, context: "companion welcome" })} onChange={(e) => setOwn(e.target.value)} />
            <MicButton onText={(chunk) => setOwn((v) => `${v}${v && !v.endsWith(" ") ? " " : ""}${chunk}`.slice(0, 400))} className={MIC_CLASS} />
          </span>
          <span className="text-xs">{t(MIC_LINE)}</span>
        </label>
      ) : null}

      {say ? (
        <div className="rounded-[14px] border border-dash-edge bg-dash-raised px-3.5 py-3">
          <div className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-dash-gold">
            <Trans context="companion welcome">What {companionName} will do with it</Trans>
          </div>
          <p className="m-0 text-[15px] text-foreground">{say}</p>
        </div>
      ) : null}

      <p className="m-0 rounded-xl border border-dashed border-dash-edge bg-background p-2.5 text-xs text-muted-foreground">
        <Trans context="companion welcome">
          <b className="text-dash-cash">Private to you.</b> {LENS_PRIVACY} The AI that writes your companions' words gets only the note above, and only when you talk through this village's own guide.
        </Trans>
      </p>

      {canSave ? (
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input type="checkbox" className="mt-1" checked={yes} onChange={(e) => setYes(e.target.checked)} /> <Trans context="companion welcome">Yes, use this to shape how {companionName} talks to me.</Trans>
        </label>
      ) : null}

      {error ? (
        <p role="alert" className="m-0 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-2 pt-1.5">
        {added ? (
          <button type="button" className={`${BTN_LINE} ${SMALL}`} disabled={busy} onClick={() => void remove()}>
            <Trans context="companion welcome">Delete this lens</Trans>
          </button>
        ) : (
          <button type="button" className={`${BTN_LINE} ${SMALL}`} onClick={onClose}>
            <Trans context="companion welcome">Cancel</Trans>
          </button>
        )}
        {canSave ? (
          <button type="button" className={`${BTN_GOLD} ${SMALL}`} disabled={busy} onClick={() => void save()}>
            {added ? t({ message: `Done`, context: "companion welcome" }) : t({ message: `Add lens`, context: "companion welcome" })}
          </button>
        ) : null}
      </div>
    </div>
  );
}
