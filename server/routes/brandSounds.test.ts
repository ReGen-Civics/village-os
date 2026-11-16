/**
 * A VILLAGE'S OWN SOUNDS (gap G8): uploaded per moment, checked by their
 * bytes, kept in the brand document, served to the audio layer. No database:
 * the brand document is an in-memory stand-in and the volume a temp dir.
 */
import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { register, soundKindOf, soundsOf } from "./brandSounds";

const uploads = fs.mkdtempSync(path.join(os.tmpdir(), "brand-sounds-"));
let brand: any = { project: { name: "Harbour" }, theme: { seed: "#0b1a1e" } };
let admin = true;
let base = "";
let server: Server | undefined;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  register(app, {
    isAdmin: async () => admin,
    brandRepo: { put: async (next: any) => { brand = next; }, get: () => brand } as any,
    uploadsDir: uploads,
    getBrand: () => brand,
  });
  server = await new Promise<Server>((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise((r) => server?.close(r));
  fs.rmSync(uploads, { recursive: true, force: true });
});

const OGG = Buffer.concat([Buffer.from("OggS"), Buffer.alloc(200, 1)]);
const post = (moment: string, bytes: Buffer, name = "bell.ogg") => {
  const form = new FormData();
  form.append("moment", moment);
  form.append("file", new Blob([bytes]), name);
  return fetch(`${base}/api/admin/brand/sound`, { method: "POST", body: form }); // module-review-ok: the test client dialling its own in-process server on localhost
};

describe("village sounds", () => {
  it("answers no files for a village that loaded none", async () => {
    const d = await (await fetch(`${base}/api/brand/sounds`)).json(); // module-review-ok: the test client dialling its own in-process server on localhost
    expect(d).toEqual({ volume: 0.5, files: {} });
  });

  it("stores a sound for a moment, by its bytes, and serves the map", async () => {
    const res = await post("stage_advance", OGG);
    expect(res.status).toBe(200);
    const d = await (await fetch(`${base}/api/brand/sounds`)).json(); // module-review-ok: the test client dialling its own in-process server on localhost
    expect(Object.keys(d.files)).toEqual(["stage_advance"]);
    const file = d.files.stage_advance.ogg;
    expect(fs.readFileSync(path.join(uploads, file)).equals(OGG)).toBe(true);
    // The rest of the brand is untouched.
    expect(brand.theme.seed).toBe("#0b1a1e");
  });

  it("refuses a file that is not a sound, a moment that does not exist, and a non-admin", async () => {
    expect((await post("stage_advance", Buffer.from("<html>"))).status).toBe(400);
    expect((await post("fanfare", OGG)).status).toBe(400);
    admin = false;
    try {
      expect((await post("stamp", OGG)).status).toBe(401);
    } finally {
      admin = true;
    }
  });

  it("sets the volume and silences a moment again", async () => {
    const v = await fetch(`${base}/api/admin/brand/sounds`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ volume: 0.3 }) }); // module-review-ok: the test client dialling its own in-process server on localhost
    expect((await v.json()).sounds.volume).toBe(0.3);
    const bad = await fetch(`${base}/api/admin/brand/sounds`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ volume: 7 }) }); // module-review-ok: the test client dialling its own in-process server on localhost
    expect(bad.status).toBe(400);
    const del = await fetch(`${base}/api/admin/brand/sound/stage_advance`, { method: "DELETE" }); // module-review-ok: the test client dialling its own in-process server on localhost
    expect((await del.json()).sounds.files).toEqual({});
  });

  it("reads the bytes and cleans the stored map", () => {
    expect(soundKindOf(OGG)).toBe("ogg");
    expect(soundKindOf(Buffer.from("ID3\u0004\u0000"))).toBe("mp3");
    expect(soundKindOf(Buffer.from([0xff, 0xfb, 0x90, 0x00]))).toBe("mp3");
    expect(soundKindOf(Buffer.from("RIFF"))).toBeNull();
    expect(soundsOf({ sounds: { volume: 9, files: { stamp: { ogg: "../x.ogg" }, nope: { ogg: "brand-sound-nope-1.ogg" } } } })).toEqual({ volume: 0.5, files: {} });
  });
});
