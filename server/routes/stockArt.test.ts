/**
 * A VILLAGE'S OWN STOCK CAST (gap G10): loaded in Admin, served at the URLs
 * every caller already computes, and nothing outside the closed set of thirty
 * ever read from or written to the volume.
 *
 * No database: the cast lives in the uploads volume, which here is a temp dir.
 */
import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { register as registerStock, STOCK_AVATAR_DIR, STOCK_AVATAR_URL, STOCK_ART_SUBDIR } from "./stockAvatars";
import { register as registerStockArt } from "./stockArt";
import { STOCK_SLOTS } from "../lib/characters";
import { STOCK_ART_HEIGHT, STOCK_ART_WIDTH } from "../lib/characterPortraits";
import { readMetadataMarkers } from "../lib/uploads";
import { VARIABLES } from "../../shared/gameVariables";

const PLATFORM = path.resolve(process.cwd(), STOCK_AVATAR_DIR);
const uploads = fs.mkdtempSync(path.join(os.tmpdir(), "stock-art-"));
const castDir = path.join(uploads, STOCK_ART_SUBDIR);

/** Who may write: a header the fake gate reads. */
let canTell = true;
let base = "";
let server: Server | undefined;

async function picture(w = 600, h = 600, exif = true): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  let img = sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 150, b: 60 } } }).jpeg();
  if (exif) img = img.withMetadata({ exif: { IFD0: { Copyright: "someone", Artist: "someone" } } });
  return img.toBuffer();
}

beforeAll(async () => {
  const app = express();
  registerStockArt(app, {
    isAdmin: async () => true,
    guardCapability: (async (_req: unknown, res: express.Response) => {
      if (canTell) return true;
      res.status(403).json({ error: "forbidden", message: "Saying what the village is belongs to whoever holds story.tell." });
      return false;
    }) as never,
    uploadsDir: uploads,
  });
  registerStock(app, { dir: PLATFORM, overrideDir: castDir });
  app.use((_req, res) => res.status(404).type("text/plain").send("Not found"));
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((r) => server?.close(r));
  fs.rmSync(uploads, { recursive: true, force: true });
});

const put = async (slot: string, bytes: Buffer) => {
  const form = new FormData();
  form.append("art", new Blob([bytes], { type: "image/jpeg" }), "face.jpg");
  return fetch(`${base}/api/admin/characters/stock-art/${slot}`, { method: "PUT", body: form }); // module-review-ok: the test client dialling its own in-process server on localhost
};
const get = (u: string) => fetch(base + u); // module-review-ok: the test client dialling its own in-process server on localhost

describe("a village's own stock cast", () => {
  it("serves the platform's drawing while the village has loaded none", async () => {
    const res = await get(`${STOCK_AVATAR_URL}/building-f-deep.webp`);
    expect(res.status).toBe(200);
    expect(Buffer.from(await res.arrayBuffer()).equals(fs.readFileSync(path.join(PLATFORM, "building-f-deep.webp")))).toBe(true);
  });

  it("loads a face: cropped to 3:4 at the stock size, stripped, and served at the same URL", async () => {
    const res = await put("building-f-deep", await picture());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ success: true, slot: "building-f-deep", width: STOCK_ART_WIDTH, height: STOCK_ART_HEIGHT });
    const stored = fs.readFileSync(path.join(castDir, "building-f-deep.webp"));
    expect(await readMetadataMarkers(stored)).toEqual([]);
    const served = await get(`${STOCK_AVATAR_URL}/building-f-deep.webp`);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/webp");
    expect(served.headers.get("cache-control")).toBe("public, max-age=86400");
    expect(Buffer.from(await served.arrayBuffer()).equals(stored)).toBe(true);
    // A slot the village did not replace is still the platform's.
    const other = await get(`${STOCK_AVATAR_URL}/building-m-deep.webp`);
    expect(Buffer.from(await other.arrayBuffer()).equals(fs.readFileSync(path.join(PLATFORM, "building-m-deep.webp")))).toBe(true);
  });

  it("lists what the village replaced", async () => {
    const res = await get("/api/admin/characters/stock-art");
    const body = await res.json();
    expect(body.slots).toEqual(STOCK_SLOTS);
    expect(body.slots).toHaveLength(30);
    expect(body.replaced).toEqual(["building-f-deep"]);
  });

  it("never reads the volume for a name outside the thirty", async () => {
    fs.writeFileSync(path.join(castDir, "evil.webp"), "not served");
    fs.writeFileSync(path.join(castDir, "manifest.json"), '{"village":"x"}');
    expect((await get(`${STOCK_AVATAR_URL}/evil.webp`)).status).toBe(404);
    for (const u of [`${STOCK_AVATAR_URL}/..%2fevil.webp`, `${STOCK_AVATAR_URL}/%2e%2e%2f${STOCK_ART_SUBDIR}%2fevil.webp`]) {
      expect(await (await get(u)).text(), u).toBe("Not found");
    }
    // The manifest is the platform's, never the volume's copy.
    const m = await get(`${STOCK_AVATAR_URL}/manifest.json`);
    expect(await m.text()).toBe(fs.readFileSync(path.join(PLATFORM, "manifest.json"), "utf8"));
  });

  it("refuses a write to a name outside the set, and writes nothing", async () => {
    for (const slot of ["evil", "..%2f..%2fpackage", "building-x-deep"]) {
      const res = await put(slot, await picture());
      expect(res.status, slot).toBe(404);
    }
    expect(fs.readdirSync(castDir).sort()).toEqual(["building-f-deep.webp", "evil.webp", "manifest.json"]);
  });

  it("refuses a member without story.tell", async () => {
    canTell = false;
    try {
      expect((await put("building-m-deep", await picture())).status).toBe(403);
      const del = await fetch(`${base}/api/admin/characters/stock-art/building-f-deep`, { method: "DELETE" }); // module-review-ok: the test client dialling its own in-process server on localhost
      expect(del.status).toBe(403);
      expect(fs.existsSync(path.join(castDir, "building-f-deep.webp"))).toBe(true);
    } finally {
      canTell = true;
    }
  });

  it("goes back to the platform's drawing when the village removes its own", async () => {
    const del = await fetch(`${base}/api/admin/characters/stock-art/building-f-deep`, { method: "DELETE" }); // module-review-ok: the test client dialling its own in-process server on localhost
    expect((await del.json()).replaced).toEqual([]);
    const res = await get(`${STOCK_AVATAR_URL}/building-f-deep.webp`);
    expect(Buffer.from(await res.arrayBuffer()).equals(fs.readFileSync(path.join(PLATFORM, "building-f-deep.webp")))).toBe(true);
  });

  it("refuses a file that is not a picture", async () => {
    const form = new FormData();
    form.append("art", new Blob(["hello"], { type: "text/plain" }), "x.txt");
    const res = await fetch(`${base}/api/admin/characters/stock-art/building-m-deep`, { method: "PUT", body: form }); // module-review-ok: the test client dialling its own in-process server on localhost
    expect(res.status).toBe(400);
  });
});

describe("the village's forge style", () => {
  it("is a village setting, empty by default", () => {
    const def = VARIABLES.find((v) => v.key === "characters.forge_style");
    expect(def?.type).toBe("longtext");
    expect(def?.default).toBe("");
  });
});
