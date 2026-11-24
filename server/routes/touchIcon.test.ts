/**
 * The home-screen icon is a 180px PNG drawn from the village's own favicon,
 * and the route always answers with an image (server/lib/touchIcon.ts).
 */
import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchableIconSource, iconBackground, renderTouchIcon, TOUCH_ICON_PX } from "../lib/touchIcon";
import { register } from "./touchIcon";

const SVG = (fill: string) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="${fill}"/></svg>`);

const servers: Array<{ close: () => void }> = [];
afterEach(() => {
  for (const s of servers.splice(0)) s.close();
});

async function serve(deps: Partial<Parameters<typeof register>[1]> & { favicon: () => string }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "touch-icon-"));
  const platformIconFile = path.join(dir, "platform.svg");
  fs.writeFileSync(platformIconFile, SVG("#123456"));
  const app = express();
  register(app, { background: () => "#ffffff", platformIconFile, overLimit: async () => false, ...deps });
  const server = app.listen(0);
  servers.push(server);
  await new Promise((r) => server.once("listening", r));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const pixel = async (png: Buffer, x: number, y: number) => {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * info.channels;
  return [data[i], data[i + 1], data[i + 2]];
};

describe("renderTouchIcon", () => {
  it("draws an SVG as a 180px square PNG, the mark centred on a solid ground", async () => {
    const png = await renderTouchIcon(SVG("#ff0000"), "#00ff00");
    const meta = await sharp(png).metadata();
    expect(meta.format).toBe("png");
    expect([meta.width, meta.height]).toEqual([TOUCH_ICON_PX, TOUCH_ICON_PX]);
    expect(meta.hasAlpha).toBe(false);
    expect(await pixel(png, 2, 2)).toEqual([0, 255, 0]);
    expect(await pixel(png, 90, 90)).toEqual([255, 0, 0]);
  });

  it("takes a raster source too", async () => {
    const raster = await sharp(SVG("#0000ff")).png().toBuffer();
    const meta = await sharp(await renderTouchIcon(raster, "#ffffff")).metadata();
    expect([meta.width, meta.height]).toEqual([TOUCH_ICON_PX, TOUCH_ICON_PX]);
  });

  it("reads only a plain hex ground, and fetches only a site path or http(s)", () => {
    expect(iconBackground("#16342a")).toBe("#16342a");
    expect(iconBackground("url(evil)")).toBe("#ffffff");
    expect(fetchableIconSource("/api/uploads/mark.svg")).toBe("path");
    expect(fetchableIconSource("https://example.org/favicon.svg")).toBe("url");
    expect(fetchableIconSource("//example.org/x.svg")).toBeNull();
    expect(fetchableIconSource("file:///etc/passwd")).toBeNull();
    expect(fetchableIconSource("data:image/svg+xml,<svg/>")).toBeNull();
  });
});

describe("GET /api/brand/touch-icon.png", () => {
  it("renders the village's favicon, and renders it once however many ask", async () => {
    const fetchImpl = vi.fn(async () => new Response(SVG("#ff0000"), { status: 200 }));
    const base = await serve({ favicon: () => "https://village.example/favicon.svg", fetchImpl: fetchImpl as unknown as (url: string) => Promise<Response> });
    for (let i = 0; i < 3; i++) {
      const res = await fetch(`${base}/api/brand/touch-icon.png`); // module-review-ok: the test client dialling its own in-process server on localhost
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/png");
      expect(await pixel(Buffer.from(await res.arrayBuffer()), 90, 90)).toEqual([255, 0, 0]);
    }
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("draws the platform's mark when no favicon is set, without fetching anything", async () => {
    const fetchImpl = vi.fn();
    const base = await serve({ favicon: () => "", fetchImpl: fetchImpl as unknown as (url: string) => Promise<Response> });
    const res = await fetch(`${base}/api/brand/touch-icon.png`); // module-review-ok: the test client dialling its own in-process server on localhost
    expect(res.status).toBe(200);
    expect(await pixel(Buffer.from(await res.arrayBuffer()), 90, 90)).toEqual([0x12, 0x34, 0x56]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("falls back to the platform's mark when the favicon cannot be read, and when the bound is reached", async () => {
    const broken = await serve({ favicon: () => "https://village.example/gone.svg", fetchImpl: (async () => new Response("", { status: 404 })) as (url: string) => Promise<Response> });
    expect(await pixel(Buffer.from(await (await fetch(`${broken}/api/brand/touch-icon.png`)).arrayBuffer()), 90, 90)).toEqual([0x12, 0x34, 0x56]); // module-review-ok: the test client dialling its own in-process server on localhost
    const fetchImpl = vi.fn();
    const bounded = await serve({ favicon: () => "https://village.example/favicon.svg", overLimit: async () => true, fetchImpl: fetchImpl as unknown as (url: string) => Promise<Response> });
    expect((await fetch(`${bounded}/api/brand/touch-icon.png`)).status).toBe(200); // module-review-ok: the test client dialling its own in-process server on localhost
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
