/**
 * Cover faces, number plates and anything that says who was there, before a
 * photo leaves the phone.
 *
 * No on-device face detector is reliable in the browsers members carry, and a
 * detector that misses a face while saying "blurred" teaches people to stop
 * looking. So the member looks, and this makes covering cheap: drag a box over
 * what should not be seen. The box is pixelated in large blocks and the photo
 * re-encoded (`makeSafe`), so what leaves the device never held it. A crop
 * trims the edges the same way.
 *
 * The preview is the original file, shown from memory on this device only.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { EyeOff, Frame, Trash2 } from "lucide-react";
import { Trans, useLingui } from "@lingui/react/macro";
import { plural } from "@lingui/core/macro";
import type { CoverBox } from "@/lib/hiddenMapPhoto";
import { BTN_SECONDARY, HINT } from "@/components/journey/look";

export interface CoverChoice {
  covers: CoverBox[];
  crop: CoverBox | null;
}

type Mode = "cover" | "crop";

const norm = (a: { x: number; y: number }, b: { x: number; y: number }): CoverBox => ({
  x: Math.max(0, Math.min(a.x, b.x)),
  y: Math.max(0, Math.min(a.y, b.y)),
  w: Math.min(1, Math.abs(b.x - a.x)),
  h: Math.min(1, Math.abs(b.y - a.y)),
});

export default function CoverTool({ file, value, onChange }: { file: Blob; value: CoverChoice; onChange: (v: CoverChoice) => void }) {
  const { t } = useLingui();
  const [drawn, setDrawn] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>("cover");
  const [live, setLive] = useState<CoverBox | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // The photo is painted onto a canvas from its pixels, never handed to the page as an address,
  // so nothing the member picked is ever read back as markup (CodeQL js/xss-through-dom).
  useEffect(() => {
    let gone = false;
    setDrawn(false);
    if (typeof createImageBitmap !== "function") return;
    void createImageBitmap(file)
      .then((bmp) => {
        const c = canvas.current;
        if (gone || !c) return bmp.close();
        c.width = bmp.width;
        c.height = bmp.height;
        c.getContext("2d")?.drawImage(bmp, 0, 0);
        bmp.close();
        setDrawn(true);
      })
      .catch(() => undefined);
    return () => {
      gone = true;
    };
  }, [file]);

  const at = (e: ReactPointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) };
  };
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    start.current = at(e);
    setLive(null);
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (start.current) setLive(norm(start.current, at(e)));
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const b = norm(start.current, at(e));
    start.current = null;
    setLive(null);
    if (b.w < 0.02 || b.h < 0.02) return;
    if (mode === "crop") onChange({ ...value, crop: b });
    else onChange({ ...value, covers: [...value.covers, b] });
  };

  const pct = (b: CoverBox) => ({ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` });

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-notice/60 bg-muted px-4 py-3">
        <p className="text-sm font-semibold text-foreground"><Trans>Faces, number plates or anything that says who was there?</Trans></p>
        <p className={HINT}><Trans>Cover them before this goes up. Drag a box over each one. Everything else hidden in the photo is removed for you.</Trans></p>
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t`What a drag does`}>
        <button type="button" role="radio" aria-checked={mode === "cover"} onClick={() => setMode("cover")} className={`${BTN_SECONDARY} ${mode === "cover" ? "border-notice" : ""}`}>
          <EyeOff className="size-4" aria-hidden="true" /> <Trans context="hidden map, covering faces in a photo">Cover</Trans>
        </button>
        <button type="button" role="radio" aria-checked={mode === "crop"} onClick={() => setMode("crop")} className={`${BTN_SECONDARY} ${mode === "crop" ? "border-notice" : ""}`}>
          <Frame className="size-4" aria-hidden="true" /> <Trans context="hidden map, covering faces in a photo">Crop</Trans>
        </button>
        {(value.covers.length > 0 || value.crop) && (
          <button type="button" onClick={() => onChange({ covers: [], crop: null })} className={BTN_SECONDARY}>
            <Trash2 className="size-4" aria-hidden="true" /> <Trans context="hidden map, covering faces in a photo">Start again</Trans>
          </button>
        )}
      </div>
      <div
        ref={box}
        className="relative w-full touch-none select-none overflow-hidden rounded-lg border border-border"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => { start.current = null; setLive(null); }}
      >
        <canvas
          ref={canvas}
          role="img"
          aria-label={t`The photo you are about to add`}
          className={`pointer-events-none block h-auto w-full ${drawn ? "" : "hidden"}`}
        />
        {value.crop && (
          <div className="pointer-events-none absolute border-2 border-dashed border-notice" style={pct(value.crop)} aria-hidden="true" />
        )}
        {value.covers.map((c, i) => (
          <div key={i} className="pointer-events-none absolute bg-foreground/90" style={pct(c)} aria-hidden="true" />
        ))}
        {live && (
          <div className={`pointer-events-none absolute border-2 ${mode === "crop" ? "border-dashed border-notice" : "border-foreground bg-foreground/60"}`} style={pct(live)} aria-hidden="true" />
        )}
      </div>
      <p className={HINT} aria-live="polite">
        {value.covers.length === 0
          ? t({ message: `Nothing covered yet.`, context: "hidden map, covering faces in a photo" })
          : t`${plural(value.covers.length, { one: "# area covered.", other: "# areas covered." })}`}
        {value.crop ? ` ${t`Cropped to the dashed box.`}` : ""}
      </p>
    </div>
  );
}
