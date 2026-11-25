/**
 * THE LIVING NETWORK (LIVING MOTION, motion lane): the village's real shape,
 * grown as mycelium behind the circles.
 *
 * Every circle the village runs is a node on a ring around a shared heart.
 * Threads grow from the heart to each circle and between neighbouring circles,
 * branching as they go, and every seat somebody holds puts a small gold knot
 * on its circle's thread. On launch day it is sparse; as people take seats it
 * thickens. Nothing here is decorative data: the counts are the page's own.
 *
 * Care:
 *   - Circles.tsx loads this lazily once the org has arrived.
 *   - It grows for about three seconds and then draws NO frames at all.
 *   - With "reduce motion", or on a device airWelcome would not give the air
 *     to, the finished network is drawn once, still.
 *   - A radial mask keeps the threads out from behind the words in the middle.
 *   - Decorative: aria-hidden. Colours come from the semantic tokens.
 *
 * growNetwork() is pure (a seeded walk, so the same village draws the same
 * network every visit) and is tested on its own.
 */
import { useEffect, useRef } from "react";
import { airWelcomeHere } from "@/lib/airWelcome";
import "./motion.css";

export interface NetworkCircle {
  id: string;
  /** Seats somebody holds in this circle. */
  held: number;
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** 0 a main thread, 1 between circles, 2 a branchlet. */
  kind: 0 | 1 | 2;
  /** The step it grew on, for drawing it in order. */
  at: number;
}

export interface Network {
  heart: { x: number; y: number };
  nodes: { x: number; y: number; held: number }[];
  knots: { x: number; y: number; at: number }[];
  segments: Segment[];
  steps: number;
}

function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** The whole network for a box of width w and height h. Pure and seeded. */
export function growNetwork(circles: NetworkCircle[], w: number, h: number, seed = 7): Network {
  const rand = rng(seed + circles.length * 31);
  const heart = { x: w / 2, y: h * 0.48 };
  const n = Math.max(circles.length, 0);
  const rx = w * 0.42;
  const ry = h * 0.36;
  const nodes = circles.map((c, i) => {
    // Start beside the heading, not above it, and go round.
    const a = -Math.PI + (i + 0.5) * ((Math.PI * 2) / Math.max(n, 1));
    return { x: heart.x + Math.cos(a) * rx, y: heart.y + Math.sin(a) * ry, held: Math.max(0, Math.floor(c.held)) };
  });

  type Tip = { x: number; y: number; a: number; tx: number; ty: number; kind: 0 | 1 | 2; life: number };
  const tips: Tip[] = [];
  const toward = (x: number, y: number, tx: number, ty: number, kind: 0 | 1 | 2) =>
    tips.push({ x, y, a: Math.atan2(ty - y, tx - x), tx, ty, kind, life: 0 });
  nodes.forEach((p) => toward(heart.x, heart.y, p.x, p.y, 0));
  if (n > 2) nodes.forEach((p, i) => {
    const q = nodes[(i + 1) % n];
    toward(p.x, p.y, q.x, q.y, 1);
  });

  const segments: Segment[] = [];
  const speed = Math.max(2, Math.min(w, h) / 120);
  let step = 0;
  let live = tips;
  while (live.length && step < 600) {
    step++;
    const next: Tip[] = [];
    for (const t of live) {
      const dx = t.tx - t.x;
      const dy = t.ty - t.y;
      if (Math.hypot(dx, dy) < speed * 1.5 || t.life > 400) continue;
      const want = Math.atan2(dy, dx);
      t.a += Math.atan2(Math.sin(want - t.a), Math.cos(want - t.a)) * 0.18 + (rand() - 0.5) * 0.3;
      const nx = t.x + Math.cos(t.a) * speed;
      const ny = t.y + Math.sin(t.a) * speed;
      segments.push({ x1: t.x, y1: t.y, x2: nx, y2: ny, kind: t.kind, at: step });
      t.x = nx;
      t.y = ny;
      t.life++;
      if (t.kind !== 2 && t.life % 14 === 0 && rand() < 0.5) {
        const ba = t.a + (rand() < 0.5 ? -1 : 1) * (0.6 + rand() * 0.5);
        const len = speed * (6 + rand() * 8);
        next.push({ x: t.x, y: t.y, a: ba, tx: t.x + Math.cos(ba) * len, ty: t.y + Math.sin(ba) * len, kind: 2, life: 0 });
      }
      next.push(t);
    }
    live = next;
  }

  // A knot for every held seat, spaced along the last stretch of its circle's main thread.
  const knots: Network["knots"] = [];
  nodes.forEach((p) => {
    for (let k = 0; k < Math.min(p.held, 12); k++) {
      const ang = rand() * Math.PI * 2;
      const r = 10 + k * 3 + rand() * 6;
      knots.push({ x: p.x + Math.cos(ang) * r, y: p.y + Math.sin(ang) * r, at: step + k * 4 });
    }
  });
  return { heart, nodes, knots, segments, steps: step + 12 * 4 };
}

function tokens(el: Element) {
  const cs = getComputedStyle(el);
  // No literal colours: anything missing falls back to the canvas's own ink, which the page themes.
  const ink = cs.color;
  const pick = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    thread: pick("--border", ink),
    gold: pick("--sheet-notice", pick("--ring", ink)),
    ground: pick("--card", pick("--background", "transparent")),
  };
}

export default function LivingNetwork({ circles }: { circles: NetworkCircle[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const key = circles.map((c) => `${c.id}:${c.held}`).join("|");

  useEffect(() => {
    const cv = canvas.current;
    if (!cv || !circles.length) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let grown = false;

    // Threads in the order they grew, painted from `from` to `upTo`. While it grows, each frame paints only
    // the new pieces on top of the last frame, so a frame costs the same at the end as at the start.
    const threads = (net: Network, from: number, upTo: number) => {
      const c = tokens(cv);
      ctx.lineCap = "round";
      for (const s of net.segments) {
        if (s.at <= from || s.at > upTo) continue;
        ctx.strokeStyle = s.kind === 1 ? c.gold : c.thread;
        ctx.globalAlpha = s.kind === 2 ? 0.45 : s.kind === 1 ? 0.5 : 0.8;
        ctx.lineWidth = s.kind === 2 ? 0.8 : 1.4;
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };
    // The circles and the held seats, drawn over the threads.
    const nodes = (net: Network, upTo: number) => {
      const c = tokens(cv);
      for (const p of net.nodes) {
        ctx.fillStyle = c.ground;
        ctx.strokeStyle = c.gold;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = c.gold;
      for (const k of net.knots) {
        if (k.at > upTo) continue;
        ctx.beginPath();
        ctx.arc(k.x, k.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    const draw = (net: Network) => {
      ctx.clearRect(0, 0, cv.clientWidth, cv.clientHeight);
      threads(net, -Infinity, Infinity);
      nodes(net, Infinity);
    };

    const layout = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = cv.clientWidth;
      const h = cv.clientHeight;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return growNetwork(circles, w, h);
    };

    let net = layout();
    if (!airWelcomeHere()) {
      grown = true;
      draw(net);
    } else {
      // About three seconds whatever the size: the walk's steps spread over ~180 frames.
      const perFrame = Math.max(1, net.steps / 180);
      let upTo = 0;
      ctx.clearRect(0, 0, cv.clientWidth, cv.clientHeight);
      const frame = () => {
        const from = upTo;
        upTo += perFrame;
        threads(net, from, upTo);
        if (upTo < net.steps) raf = requestAnimationFrame(frame);
        else {
          grown = true;
          draw(net);
        }
      };
      raf = requestAnimationFrame(frame);
    }

    // A new size redraws the finished network, still: it never grows twice.
    let resizeFrame = 0;
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => {
      if (!grown || resizeFrame) return;
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = 0;
        net = layout();
        draw(net);
      });
    });
    ro?.observe(cv);
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(resizeFrame);
      ro?.disconnect();
    };
    // `key` stands for the circles: a new count regrows, a new array with the same counts does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return <canvas ref={canvas} className="m-network" aria-hidden="true" data-motion="network" />;
}
