/**
 * DRAW ON THE SCREENSHOT: a pen and an arrow over the picture, Undo and Clear (the lead, 26 Nov 2026:
 * "make drawings on the image"). The picture is the editor: there is no separate "done" step, and Send
 * reads the canvas as it stands (`exportRef`).
 *
 * The canvas holds the picture at its sent size (shotKit.ts) and the page scales it to the panel's
 * width, so a pointer's place is mapped back through the canvas's own box. `touch-action: none` keeps a
 * finger drawing from scrolling the panel.
 *
 * Loaded only when a member adds a picture (GuideFeedback.tsx), with its machinery beside it.
 */
import { useEffect, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent } from "react";
import { useLingui } from "@lingui/react/macro";
import { MoveUpRight, PenLine, Trash2, Undo2 } from "lucide-react";
import { exportShot, loadPicture, paint, shotSize, type Mark } from "./shotKit";

export { captureScreen } from "./shotKit";

const TOOL =
  "jw-btn inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium disabled:opacity-50";

export default function ShotEditor({
  source,
  exportRef,
  onMarks,
  onRemove,
}: {
  source: Blob;
  /** Set to a function that returns the picture with its marks, shrunk, for Send. */
  exportRef: MutableRefObject<(() => Promise<File | null>) | null>;
  /** How many marks are on it, for the guide's read-back. */
  onMarks: (n: number) => void;
  onRemove: () => void;
}) {
  const { t } = useLingui();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [broken, setBroken] = useState(false);
  const [tool, setTool] = useState<Mark["tool"]>("arrow");
  const [marks, setMarks] = useState<Mark[]>([]);
  const drawing = useRef<Mark | null>(null);

  useEffect(() => {
    let live = true;
    let url = "";
    loadPicture(source)
      .then((picture) => {
        url = picture.src;
        if (live) setImg(picture);
      })
      .catch(() => live && setBroken(true));
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [source]);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !img) return;
    const size = shotSize(img);
    if (c.width !== size.width || c.height !== size.height) {
      c.width = size.width;
      c.height = size.height;
    }
    paint(c, img, drawing.current ? [...marks, drawing.current] : marks);
    onMarks(marks.length);
  }, [img, marks, onMarks]);

  useEffect(() => {
    exportRef.current = () => (canvas.current && img ? exportShot(canvas.current) : Promise.resolve(null));
    return () => {
      exportRef.current = null;
    };
  }, [exportRef, img]);

  const at = (e: ReactPointerEvent<HTMLCanvasElement>): [number, number] => {
    const c = e.currentTarget;
    const box = c.getBoundingClientRect();
    return [((e.clientX - box.left) / box.width) * c.width, ((e.clientY - box.top) / box.height) * c.height];
  };
  const down = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!img) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drawing.current = { tool, pts: [at(e)] };
  };
  const move = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const m = drawing.current;
    if (!m || !img || !canvas.current) return;
    if (m.tool === "pen") m.pts.push(at(e));
    else m.pts = [m.pts[0], at(e)];
    paint(canvas.current, img, [...marks, m]);
  };
  const up = () => {
    const m = drawing.current;
    drawing.current = null;
    if (m) setMarks((all) => [...all, m]);
  };

  if (broken) {
    return (
      <p role="alert" className="rounded-lg border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {t({ message: "That picture could not be opened. Try another one.", context: "guide feedback: a screenshot that does not decode" })}
      </p>
    );
  }

  const markCount = marks.length;
  const pick = (k: Mark["tool"]) =>
    `${TOOL} ${tool === k ? "border-notice bg-notice/10 text-notice" : "border-border text-foreground hover:bg-muted"}`;

  return (
    <div className="space-y-2" data-shot-editor="">
      <canvas
        ref={canvas}
        role="img"
        aria-label={t({ message: `Your screenshot. Marks on it: ${markCount}`, context: "guide feedback: the screenshot, read aloud" })}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        className="block h-auto max-h-[46vh] w-full cursor-crosshair touch-none rounded-xl border border-border bg-muted object-contain"
      />
      <div className="flex flex-wrap gap-2" role="toolbar" aria-label={t({ message: "Draw on your screenshot", context: "guide feedback: the drawing tools, read aloud" })}>
        <button type="button" aria-pressed={tool === "arrow"} onClick={() => setTool("arrow")} className={pick("arrow")}>
          <MoveUpRight className="size-4" aria-hidden="true" /> {t({ message: "Arrow", context: "guide feedback: drawing tool" })}
        </button>
        <button type="button" aria-pressed={tool === "pen"} onClick={() => setTool("pen")} className={pick("pen")}>
          <PenLine className="size-4" aria-hidden="true" /> {t({ message: "Pen", context: "guide feedback: drawing tool" })}
        </button>
        <button type="button" disabled={!marks.length} onClick={() => setMarks((all) => all.slice(0, -1))} className={`${TOOL} border-border text-foreground hover:bg-muted`}>
          <Undo2 className="size-4" aria-hidden="true" /> {t({ message: "Undo", context: "guide feedback: drawing tool" })}
        </button>
        <button type="button" disabled={!marks.length} onClick={() => setMarks([])} className={`${TOOL} border-border text-foreground hover:bg-muted`}>
          {t({ message: "Clear", context: "guide feedback: drawing tool, removes every mark" })}
        </button>
        <button type="button" onClick={onRemove} className={`${TOOL} ml-auto border-border text-muted-foreground hover:bg-muted`}>
          <Trash2 className="size-4" aria-hidden="true" /> {t({ message: "Remove", context: "guide feedback: takes the screenshot off" })}
        </button>
      </div>
    </div>
  );
}
