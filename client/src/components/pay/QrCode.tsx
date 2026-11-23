/**
 * A QR code for a request link, drawn as one SVG path.
 *
 * `lean-qr/nano` encodes (about 4 KB, no dependencies, CJS and ESM both); the
 * drawing is ours, so no canvas and no image file: the code scales with its
 * box and stays sharp at any size. It sits on the sheet's light ink with dark
 * modules, because a camera reads a dark code on a light ground, and the night
 * ground's own colours would invert it. Four modules of quiet margin all round,
 * as the standard asks.
 */
import { useMemo } from "react";
import { correction, generate } from "lean-qr/nano";

/** One path for every dark module, runs along each row merged into one rect. */
export function qrPath(text: string): { size: number; d: string } | null {
  let code: { size: number; get(x: number, y: number): boolean };
  try {
    code = generate(text, { minCorrectionLevel: correction.M });
  } catch {
    return null;
  }
  const quiet = 4;
  const parts: string[] = [];
  for (let y = 0; y < code.size; y++) {
    let x = 0;
    while (x < code.size) {
      if (!code.get(x, y)) {
        x++;
        continue;
      }
      const start = x;
      while (x < code.size && code.get(x, y)) x++;
      parts.push(`M${start + quiet} ${y + quiet}h${x - start}v1h${start - x}z`);
    }
  }
  return { size: code.size + quiet * 2, d: parts.join("") };
}

export default function QrCode({ text, label }: { text: string; label: string }) {
  const drawn = useMemo(() => qrPath(text), [text]);
  if (!drawn) return null;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${drawn.size} ${drawn.size}`}
      shapeRendering="crispEdges"
      className="block h-auto w-full rounded-xl bg-foreground text-background"
    >
      <path d={drawn.d} fill="currentColor" />
    </svg>
  );
}
