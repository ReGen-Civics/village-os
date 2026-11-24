/**
 * Open somebody's request link: scan their code, or paste their link.
 *
 * Scanning uses the browser's own `BarcodeDetector` where it has one (Chrome
 * and Edge on Android, most desktop Chrome), so no decoder library ships to
 * anybody. Where it has none (Safari, Firefox) the sheet says to point the
 * phone's own camera at the code, which opens this page with the link already
 * read, and offers the paste field. Every link goes through `parsePayLink`, the
 * same parser the page reads its own address with.
 */
import { useEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { parsePayLink, type PayRequest } from "@shared/payLink";
import { BTN_PRIMARY, BTN_SECONDARY, FIELD, HINT, LABEL, TILE } from "@/components/journey/look";

interface DetectorLike {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue?: string }>>;
}

/** The browser's QR reader, or null where there is none. */
function qrDetector(): DetectorLike | null {
  const Ctor = (globalThis as { BarcodeDetector?: new (o: { formats: string[] }) => DetectorLike }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    return new Ctor({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}

export default function ScanLink({ onFound, onClose }: { onFound: (req: PayRequest) => void; onClose: () => void }) {
  const { t } = useLingui();
  const [pasted, setPasted] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const video = useRef<HTMLVideoElement | null>(null);
  const canScan = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && qrDetector() !== null;

  useEffect(() => {
    if (!scanning) return;
    const detector = qrDetector();
    if (!detector) return;
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let alive = true;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (!alive || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const look = async () => {
          if (!alive || !video.current) return;
          try {
            const found = await detector.detect(video.current);
            const req = found.map((f) => parsePayLink(f.rawValue ?? "")).find((r) => r.to);
            if (req) {
              onFound(req);
              return;
            }
          } catch {
            /* a frame that could not be read; the next one may */
          }
          timer = window.setTimeout(look, 300);
        };
        void look();
      } catch {
        if (alive) {
          setScanning(false);
          setProblem(t({ context: "pay page, scanning a code", message: "The camera did not open. Paste their link below." }));
        }
      }
    })();
    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [scanning, onFound, t]);

  const open = (e: React.FormEvent) => {
    e.preventDefault();
    const req = parsePayLink(pasted);
    if (!req.to) {
      setProblem(t({ context: "pay page, opening a link", message: "That is not a request link. Ask them to share it again." }));
      return;
    }
    onFound(req);
  };

  return (
    <div className={`${TILE} space-y-4`}>
      {canScan ? (
        scanning ? (
          <video ref={video} muted playsInline className="aspect-square w-full rounded-xl bg-background object-cover" />
        ) : (
          <button type="button" className={`${BTN_PRIMARY} w-full`} onClick={() => setScanning(true)}>
            {t({ context: "pay page, button", message: "Scan their code" })}
          </button>
        )
      ) : (
        <p className={HINT}>
          {t({ context: "pay page, scanning a code", message: "Point your phone's camera at their code. It opens this page with their name filled in." })}
        </p>
      )}
      <form onSubmit={open} className="space-y-2">
        <label className="block space-y-1">
          <span className={LABEL}>{t({ context: "pay page, opening a link", message: "Or paste their link" })}</span>
          <input
            className={FIELD}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            inputMode="url"
            autoComplete="off"
            placeholder={t({ context: "pay page, example request link in the paste field", message: "https://…/pay?to=@name" })}
          />
        </label>
        {problem && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {problem}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={BTN_SECONDARY} disabled={!pasted.trim()}>
            {t({ context: "pay page, button", message: "Open link" })}
          </button>
          <button type="button" className={BTN_SECONDARY} onClick={onClose}>
            {t({ context: "pay page, button", message: "Close" })}
          </button>
        </div>
      </form>
    </div>
  );
}
