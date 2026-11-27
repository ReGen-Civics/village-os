/**
 * THE SCREENSHOT'S MACHINERY: capturing the screen, drawing marks on it, and handing back a file the
 * shrink has already passed (the lead, 26 Nov 2026: "really easy to screenshot (make drawings on the
 * image) share with scarlet").
 *
 * No library. A page render to a canvas (html2canvas and its kind) is a large dependency, and on iOS
 * Safari a canvas that drew an SVG `foreignObject` is tainted and refuses to export, so the honest
 * captures are the two the browser does itself:
 *
 *   - a computer: `getDisplayMedia`, the browser's own "share this tab" picker. One frame is read and
 *     the stream is stopped at once; nothing is recorded and nothing leaves the page until Send.
 *   - a phone: the member takes the screenshot with their phone and picks it from their photos
 *     (`<input type="file" accept="image/*">`). iOS Safari has no `getDisplayMedia`.
 *
 * The marks are a pen and an arrow, kept as a list so Undo is a pop and Clear is an empty list. They
 * are drawn in the sheet's warning ink (`--color-destructive`) over a dark halo, so they read on a
 * light page and a dark one.
 *
 * It ships in the feedback form's lazy chunk (with ShotEditor), so no page pays for it until that door opens.
 */
import { fitWithin, prepareImageForUpload } from "@/lib/imagePrep";
import { FEEDBACK_SHOT_EDGE } from "@shared/feedbackItems";

/** A mark: a pen line, an arrow (start and end), or a ring the keyboard places round one spot. */
export type Mark = { tool: "pen" | "arrow" | "ring"; pts: Array<[number, number]> };

/** Read one frame of the screen the member picks in the browser's own picker, then stop sharing. */
export async function captureScreen(): Promise<Blob | null> {
  const options = { video: { displaySurface: "browser" }, audio: false, preferCurrentTab: true, selfBrowserSurface: "include" };
  const stream = await navigator.mediaDevices.getDisplayMedia(options as DisplayMediaStreamOptions);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();
    // The picker has just closed over the page: one beat for the page to paint without it.
    await new Promise((done) => setTimeout(done, 400));
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    return await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/png"));
  } finally {
    for (const track of stream.getTracks()) track.stop();
  }
}

/** Decode a picture the member chose or captured. */
export function loadPicture(source: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(source);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode failed"));
    };
    img.src = url;
  });
}

/** The size the editor draws at: the picture fitted inside the screenshot's longest edge, never enlarged. */
export function shotSize(img: HTMLImageElement): { width: number; height: number } {
  return fitWithin(img.naturalWidth || img.width, img.naturalHeight || img.height, FEEDBACK_SHOT_EDGE);
}

/** The pen's width for a picture this size, from its longer edge: readable on a tall phone screenshot and a wide monitor alike. */
export function penWidth(longEdge: number): number {
  return Math.max(4, Math.round(longEdge / 180));
}

function ink(canvas: HTMLCanvasElement): string {
  const fromSheet = getComputedStyle(canvas).getPropertyValue("--color-destructive").trim();
  return fromSheet || "#d94f3d";
}

/**
 * Where a pointer is on the picture, in the picture's own pixels. Pure.
 *
 * Mapped through the picture's visible rectangle, never the element's box (fold QA round 1: a phone
 * screenshot letterboxed in a wide box put a mark made 90% across at 72.5%). The editor sizes the canvas to
 * the picture's own shape, so the two are the same rectangle there; this keeps a mark under the finger even
 * if a stylesheet ever fits the picture inside a differently shaped box again.
 */
export function pictureXY(
  box: { left: number; top: number; width: number; height: number },
  picture: { width: number; height: number },
  clientX: number,
  clientY: number,
): [number, number] {
  const scale = Math.min(box.width / picture.width, box.height / picture.height) || 1;
  const left = box.left + (box.width - picture.width * scale) / 2;
  const top = box.top + (box.height - picture.height * scale) / 2;
  const clamp = (v: number, max: number) => Math.min(max, Math.max(0, v));
  return [clamp((clientX - left) / scale, picture.width), clamp((clientY - top) / scale, picture.height)];
}

/**
 * The keyboard's way to mark a spot (fold QA round 1: drawing was pointer-only). The arrow keys move a ring
 * by a twentieth of the picture, a hundredth with Shift, and never off it. Pure; null for any other key.
 */
export function moveRing(at: [number, number], key: string, fine: boolean, picture: { width: number; height: number }): [number, number] | null {
  const step = fine ? 0.01 : 0.05;
  const dx = key === "ArrowLeft" ? -1 : key === "ArrowRight" ? 1 : 0;
  const dy = key === "ArrowUp" ? -1 : key === "ArrowDown" ? 1 : 0;
  if (!dx && !dy) return null;
  const clamp = (v: number, max: number) => Math.min(max, Math.max(0, v));
  return [clamp(at[0] + dx * step * picture.width, picture.width), clamp(at[1] + dy * step * picture.height, picture.height)];
}

/** The ring the keyboard places: a circle round the spot, sized from the picture's longer edge. */
export function ringRadius(longEdge: number): number {
  return Math.max(18, Math.round(longEdge / 20));
}

function stroke(ctx: CanvasRenderingContext2D, m: Mark, w: number, longEdge: number) {
  const pts = m.pts;
  if (!pts.length) return;
  ctx.beginPath();
  if (m.tool === "ring") {
    ctx.arc(pts[0][0], pts[0][1], ringRadius(longEdge), 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  if (m.tool === "pen") {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y);
    if (pts.length === 1) ctx.lineTo(pts[0][0] + 0.1, pts[0][1]);
    ctx.stroke();
    return;
  }
  const [x0, y0] = pts[0];
  const [x1, y1] = pts[pts.length - 1];
  const angle = Math.atan2(y1 - y0, x1 - x0);
  const head = w * 4.5;
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1 - Math.cos(angle) * head * 0.6, y1 - Math.sin(angle) * head * 0.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - head * Math.cos(angle - 0.45), y1 - head * Math.sin(angle - 0.45));
  ctx.lineTo(x1 - head * Math.cos(angle + 0.45), y1 - head * Math.sin(angle + 0.45));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/** Draw the picture and every mark on it. */
export function paint(canvas: HTMLCanvasElement, img: HTMLImageElement, marks: readonly Mark[]): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const long = Math.max(canvas.width, canvas.height);
  const w = penWidth(long);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // A dark halo first, then the ink over it, so a mark reads on a white page and a night one.
  for (const [colour, width] of [["rgba(0,0,0,0.45)", w + 3], [ink(canvas), w]] as const) {
    ctx.strokeStyle = colour;
    ctx.fillStyle = colour;
    ctx.lineWidth = width;
    for (const m of marks) stroke(ctx, m, w, long);
  }
}

/** The finished picture as a file, through the browser's shrink (lib/imagePrep.ts): WebP where the browser can. */
export async function exportShot(canvas: HTMLCanvasElement): Promise<File | null> {
  const blob =
    (await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/webp", 0.86))) ??
    (await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/png")));
  if (!blob) return null;
  const name = blob.type === "image/webp" ? "screenshot.webp" : "screenshot.png";
  const prepared = await prepareImageForUpload(new File([blob], name, { type: blob.type }), { maxEdge: FEEDBACK_SHOT_EDGE });
  return prepared.file;
}
