/**
 * The module card art answers at the URL `ModuleArt` computes, from the
 * server, with no volume involved.
 *
 * The drawings left `client/public` (2026-11-16) so they stop counting against
 * the client budget, the same move the stock character art made on
 * 2026-10-13. What the move must not do is change a URL: `bundledArtPath`
 * builds `/images/modules/<file>` from the generated map, and pages already in
 * browsers ask for exactly that. So every URL here comes from the real helper,
 * and every one is asked of the real directory.
 */
import express from "express";
import fs from "node:fs";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MODULE_ART_DIR, MODULE_ART_MAX_AGE_SECONDS, register } from "./moduleArt";
import { BUNDLED_MODULE_ART } from "../../client/src/components/modules/bundledModuleArt";

const ROOT = process.cwd();
const DIR = path.resolve(ROOT, MODULE_ART_DIR);

async function serve(dir: string): Promise<{ base: string; server: Server }> {
  const app = express();
  register(app, { dir });
  app.use((_req, res) => res.status(404).type("text/plain").send("Not found"));
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, server };
}

let base = "";
let server: Server | undefined;

beforeAll(async () => {
  ({ base, server } = await serve(DIR));
});

afterAll(async () => {
  await new Promise((r) => server?.close(r));
});

describe("module card art", () => {
  it("lives outside the client bundle, so dist/public no longer pays for it", () => {
    expect(fs.existsSync(path.join(ROOT, "client/public/images/modules"))).toBe(false);
    const files = fs.readdirSync(DIR);
    expect(files.filter((f) => f.endsWith(".webp")).length).toBeGreaterThanOrEqual(30);
    expect(files).toContain("manifest.json");
  });

  it("serves every file the client map names, as webp, cached a day", async () => {
    const names = Object.values(BUNDLED_MODULE_ART);
    expect(names.length).toBeGreaterThan(10);
    for (const name of names) {
      const res = await fetch(`${base}/images/modules/${name}`); // module-review-ok: the test client dialling its own in-process server on localhost
      expect(res.status, name).toBe(200);
      expect(res.headers.get("content-type"), name).toMatch(/image\/webp/);
      expect(res.headers.get("cache-control"), name).toBe(`public, max-age=${MODULE_ART_MAX_AGE_SECONDS}`);
    }
    const manifest = await fetch(`${base}/images/modules/manifest.json`); // module-review-ok: the test client dialling its own in-process server on localhost
    expect(manifest.status).toBe(200);
  });

  it("a missing drawing is a plain 404, never the app's page", async () => {
    const res = await fetch(`${base}/images/modules/zzz-does-not-exist.webp`); // module-review-ok: the test client dialling its own in-process server on localhost
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toMatch(/text\/plain/);
  });

  it("refuses a path that climbs out of its directory", async () => {
    const res = await fetch(`${base}/images/modules/..%2f..%2fpackage.json`); // module-review-ok: the test client dialling its own in-process server on localhost
    expect(res.status).toBe(404);
  });
});
