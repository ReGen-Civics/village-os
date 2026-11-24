/**
 * The village's share card, over real HTTP against a real volume (the harness
 * server/routes/brandUploads.test.ts uses): the real `register()`, a real
 * Express on port 0, a temp directory as the uploads volume, and the card read
 * back with sharp so its size, format and metadata are measured, not assumed.
 */
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { LimitState } from "../repos/rateHits";
import { clearShareCards, localUploadName, shareCardSource } from "../lib/shareCard";
import { suppressUploads, unsuppressUploads } from "../lib/placePhotos";
import { register } from "./shareCard";

let uploadsDir = "";
let server: http.Server;
let base = "";
let picture = "";
let guard: LimitState = "under";
let guardAsked = 0;

beforeAll(async () => {
  uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), "share-card-"));
  const app = express();
  register(app, {
    uploadsDir,
    picture: () => picture,
    origin: () => "https://willow.example",
    limitState: async () => {
      guardAsked += 1;
      return guard;
    },
    clientIp: () => "203.0.113.9",
  });
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("the test server did not report a port");
  base = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  fs.rmSync(uploadsDir, { recursive: true, force: true });
});

beforeEach(() => {
  clearShareCards();
  guard = "under";
  guardAsked = 0;
});

const sharp = async () => (await import("sharp")).default;

/** A 1200x800 WebP like the ones the upload door writes, carrying EXIF so its absence on the card means something. */
async function writeWebp(name: string, colour: { r: number; g: number; b: number }, w = 1200, h = 800): Promise<void> {
  const s = await sharp();
  const bytes = await s({ create: { width: w, height: h, channels: 3, background: colour } })
    .withExif({ IFD0: { Copyright: "fixture-exif-marker", Artist: "Fixture" } })
    .webp()
    .toBuffer();
  fs.writeFileSync(path.join(uploadsDir, name), bytes);
}

const get = (p: string, headers: Record<string, string> = {}) => fetch(`${base}${p}`, { headers, redirect: "manual" }); // module-review-ok: the test's own server on 127.0.0.1, no outbound call

describe("GET /api/share-card.jpg", () => {
  it("renders the chosen upload as exactly 1200x630 JPEG with no metadata, cacheable for an hour with an ETag", async () => {
    await writeWebp("hero-a1.webp", { r: 40, g: 90, b: 80 });
    picture = "/api/uploads/hero-a1.webp";
    const res = await get("/api/share-card.jpg?v=anything");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
    const etag = res.headers.get("etag");
    expect(etag).toMatch(/^"[0-9a-f]{12}"$/);
    const card = Buffer.from(await res.arrayBuffer());
    const meta = await (await sharp())(card).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(630);
    expect(meta.exif).toBeUndefined();
    expect(meta.icc).toBeUndefined();
    expect(card.includes(Buffer.from("fixture-exif-marker"))).toBe(false);
    expect(guardAsked).toBe(1);

    // A second fetch is the held card: same ETag, and the guard is not asked again.
    const again = await get("/api/share-card.jpg");
    expect(again.headers.get("etag")).toBe(etag);
    expect(Buffer.from(await again.arrayBuffer()).equals(card)).toBe(true);
    expect(guardAsked).toBe(1);

    // And a previewer that kept it is told so.
    // fetch adds `Cache-Control: no-cache` beside a hand-set If-None-Match unless one is given,
    // and no-cache asks for a full answer, so the request says what a previewer's cache says.
    const kept = await get("/api/share-card.jpg", { "If-None-Match": etag!, "Cache-Control": "max-age=0" });
    expect(kept.status).toBe(304);
  });

  it("makes a new card, under a new ETag, when the picture changes on disk", async () => {
    await writeWebp("hero-b2.webp", { r: 200, g: 30, b: 30 });
    picture = "/api/uploads/hero-b2.webp";
    const first = await get("/api/share-card.jpg");
    const etag = first.headers.get("etag");
    await first.arrayBuffer();

    await writeWebp("hero-b2.webp", { r: 20, g: 30, b: 220 });
    const later = new Date(Date.now() + 60_000);
    fs.utimesSync(path.join(uploadsDir, "hero-b2.webp"), later, later);
    const second = await get("/api/share-card.jpg", { "If-None-Match": etag!, "Cache-Control": "max-age=0" });
    expect(second.status).toBe(200);
    expect(second.headers.get("etag")).not.toBe(etag);
    const { data } = await (await sharp())(Buffer.from(await second.arrayBuffer())).raw().toBuffer({ resolveWithObject: true });
    // The new picture is blue: its centre pixel says so.
    const at = (630 / 2) * 1200 * 3 + (1200 / 2) * 3;
    expect(data[at + 2]).toBeGreaterThan(150);
    expect(data[at]).toBeLessThan(80);
  });

  it("crops a picture of any shape to the share size, and gives a transparent one a white ground", async () => {
    const s = await sharp();
    const png = await s({ create: { width: 500, height: 900, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    fs.writeFileSync(path.join(uploadsDir, "tall-c3.png"), png);
    picture = "https://willow.example/api/uploads/tall-c3.png";
    const res = await get("/api/share-card.jpg");
    expect(res.status).toBe(200);
    const card = Buffer.from(await res.arrayBuffer());
    const meta = await s(card).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["jpeg", 1200, 630]);
    const { data } = await s(card).raw().toBuffer({ resolveWithObject: true });
    expect(data[0]).toBeGreaterThan(240);
  });

  it("404s for a picture on another host, a missing file, and an address that leaves the volume", async () => {
    fs.writeFileSync(path.join(path.dirname(uploadsDir), "outside-share-card.jpg"), "not yours");
    for (const p of [
      "https://cdn.example/valley.webp",
      "https://elsewhere.example/api/uploads/hero-a1.webp",
      "/api/uploads/never-uploaded.webp",
      "/api/uploads/../outside-share-card.jpg",
      "/api/uploads/..%2Foutside-share-card.jpg",
      "",
    ]) {
      picture = p;
      const res = await get("/api/share-card.jpg");
      expect(res.status, p).toBe(404);
      expect(res.headers.get("cache-control"), p).toBe("no-store");
    }
    expect(guardAsked).toBe(0);
    fs.rmSync(path.join(path.dirname(uploadsDir), "outside-share-card.jpg"), { force: true });
  });

  it("404s for a photograph that was taken down", async () => {
    await writeWebp("hidden-d4.webp", { r: 10, g: 10, b: 10 }, 300, 200);
    picture = "/api/uploads/hidden-d4.webp";
    suppressUploads(["hidden-d4.webp"]);
    try {
      expect((await get("/api/share-card.jpg")).status).toBe(404);
    } finally {
      unsuppressUploads(["hidden-d4.webp"]);
    }
    expect((await get("/api/share-card.jpg")).status).toBe(200);
  });

  it("refuses to render past the guard, and when the guard cannot check, but still serves a card it already holds", async () => {
    await writeWebp("hero-e5.webp", { r: 90, g: 90, b: 40 }, 600, 400);
    picture = "/api/uploads/hero-e5.webp";
    guard = "over";
    const over = await get("/api/share-card.jpg");
    expect(over.status).toBe(429);
    expect(over.headers.get("retry-after")).toBe("600");
    guard = "unavailable";
    expect((await get("/api/share-card.jpg")).status).toBe(503);
    guard = "under";
    expect((await get("/api/share-card.jpg")).status).toBe(200);
    guard = "over";
    expect((await get("/api/share-card.jpg")).status).toBe(200);
  });

  it("sends a previewer to the original picture when sharp cannot read the file, and lets no cache keep that answer", async () => {
    fs.writeFileSync(path.join(uploadsDir, "broken-f6.webp"), Buffer.from("RIFF0000WEBPnot really"));
    picture = "/api/uploads/broken-f6.webp";
    const res = await get("/api/share-card.jpg");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/api/uploads/broken-f6.webp");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("etag")).toBeNull();
  });
});

describe("which pictures are the village's own uploads", () => {
  it("takes a site path or a full address on this origin, one segment under /api/uploads/, a raster only", () => {
    const o = "https://willow.example";
    expect(localUploadName("/api/uploads/hero.webp", o)).toBe("hero.webp");
    expect(localUploadName(" /api/uploads/hero.webp?w=800 ", o)).toBe("hero.webp");
    expect(localUploadName("https://willow.example/api/uploads/hero.jpg", o)).toBe("hero.jpg");
    expect(localUploadName("https://other.example/api/uploads/hero.jpg", o)).toBeNull();
    expect(localUploadName("https://willow.example/api/uploads/hero.jpg", "")).toBeNull();
    expect(localUploadName("/api/uploads/sub/hero.webp", o)).toBeNull();
    expect(localUploadName("/api/uploads/..\\hero.webp", o)).toBeNull();
    expect(localUploadName("/api/uploads/guide.svg", o)).toBeNull();
    expect(localUploadName("/api/uploads/anim.gif", o)).toBeNull();
    expect(localUploadName("/uploads/hero.webp", o)).toBeNull();
    expect(localUploadName("javascript:alert(1)", o)).toBeNull();
  });

  it("gives no card for a member's own picture, which is served privately so erasure reaches it", async () => {
    await writeWebp("portrait-g7.webp", { r: 1, g: 2, b: 3 }, 100, 100);
    expect(shareCardSource("/api/uploads/portrait-g7.webp", "", uploadsDir)).toBeNull();
  });
});
