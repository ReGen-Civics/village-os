/**
 * THE FEEDBACK DOOR, AS THE GUIDE'S PANEL USES IT: the third kind, the guide's title when the member
 * left it empty, and a screenshot that goes through the strip into a private folder and comes back
 * out only to an admin.
 *
 * A real Express app on a real port, so multipart travels the way a browser sends it. The pool is a
 * stand-in that records each query, so no database is needed and the INSERT is read as it was sent.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import express from "express";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FEEDBACK_SHOT_DIRNAME, feedbackShotName, register } from "./feedback";
import { buildGeotaggedJpeg } from "../lib/exifFixture";

type Query = { sql: string; params: unknown[] };
const queries: Query[] = [];
let stored: Record<string, unknown> | null = null;
let admin = false;
let refuseInsert = false;
let overTheLimit = false;

const pool = {
  async query(sql: string, params: unknown[] = []) {
    queries.push({ sql, params });
    if (sql.startsWith("INSERT INTO feedback_items")) {
      if (refuseInsert) throw new Error("the database refused the row");
      stored = { id: params[0], screenshot_file: params[8] };
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith("SELECT screenshot_file")) return [[stored && params[0] === stored.id ? stored : undefined]];
    return [[]];
  },
};

let dataDir = "";
let base = "";
let server: ReturnType<express.Express["listen"]>;

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "feedback-route-"));
  const app = express();
  app.use(express.json());
  register(app, {
    isAdmin: async () => admin,
    authedUser: async () => ({ id: "m-ana" }) as never,
    getPool: () => pool as never,
    notify: async () => undefined as never,
    overLimit: async () => overTheLimit,
    clientIp: () => "203.0.113.9",
    projectName: () => "Hollow Oak",
    uploadsDir: path.join(dataDir, "uploads"),
  } as never);
  await new Promise<void>((done) => {
    server = app.listen(0, "127.0.0.1", () => done());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((done) => server.close(() => done()));
  fs.rmSync(dataDir, { recursive: true, force: true });
});

beforeEach(() => {
  queries.length = 0;
  stored = null;
  admin = false;
  refuseInsert = false;
  overTheLimit = false;
});

/** One door to the suite's own server, so the waiver below is said once. */
function call(p: string, init?: RequestInit): Promise<Response> {
  return fetch(`${base}${p}`, init); // module-review-ok: the suite's own in-process server on 127.0.0.1, never an outbound call, so there is no correlation id to carry
}

const insert = () => queries.find((q) => q.sql.startsWith("INSERT INTO feedback_items"))!;

describe("POST /api/feedback from the guide's panel", () => {
  it("takes the third kind, and the guide's title from the first line when the member left it empty", async () => {
    const r = await call(`/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "feedback", title: "", detail: "The calendar felt crowded. Too many colours at once.", pageUrl: "https://v.example/events?x=1" }),
    });
    expect(r.status).toBe(200);
    const [, kind, title, , pageUrl, submittedBy, , , shot] = insert().params;
    expect(kind).toBe("feedback");
    expect(title).toBe("The calendar felt crowded");
    expect(pageUrl).toBe("https://v.example/events");
    expect(submittedBy).toBe("m-ana");
    expect(shot).toBeNull();
  });

  it("still refuses an unknown kind and too little to act on", async () => {
    const bad = (body: object) =>
      call(`/api/feedback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.status);
    expect(await bad({ kind: "praise", title: "Nice work", detail: "Enough words to act on here." })).toBe(400);
    expect(await bad({ kind: "bug", title: "Blank", detail: "short" })).toBe(400);
    expect(insert()).toBeUndefined();
  });

  it("strips a screenshot, keeps it in the private folder, and shows it to an admin alone", async () => {
    const plain = await sharp({ create: { width: 60, height: 40, channels: 3, background: { r: 30, g: 90, b: 60 } } }).jpeg().toBuffer();
    const geotagged = buildGeotaggedJpeg(plain);
    const form = new FormData();
    form.append("kind", "bug");
    form.append("title", "Button under the tab bar");
    form.append("detail", "The send button sits under the tab bar on a phone.");
    form.append("screenshot", new Blob([new Uint8Array(geotagged)], { type: "image/jpeg" }), "IMG_0001.jpg");
    const r = await call(`/api/feedback`, { method: "POST", body: form });
    expect(r.status).toBe(200);

    const name = insert().params[8] as string;
    expect(feedbackShotName(name)).toBe(name);
    // Never on the public uploads volume.
    expect(fs.existsSync(path.join(dataDir, "uploads", name))).toBe(false);
    const onDisk = path.join(dataDir, FEEDBACK_SHOT_DIRNAME, name);
    expect(fs.existsSync(onDisk)).toBe(true);
    expect((await sharp(fs.readFileSync(onDisk)).metadata()).exif).toBeFalsy();

    const id = String(insert().params[0]);
    expect((await call(`/api/admin/feedback/${id}/screenshot`)).status).toBe(401);
    admin = true;
    const shot = await call(`/api/admin/feedback/${id}/screenshot`);
    expect(shot.status).toBe(200);
    expect(shot.headers.get("cache-control")).toBe("private, no-store");
    expect(shot.headers.get("x-content-type-options")).toBe("nosniff");
    expect(shot.headers.get("content-type")).toMatch(/^image\/jpeg/);
    expect((await call(`/api/admin/feedback/fb-nope/screenshot`)).status).toBe(404);
  });

  it("refuses a screenshot that is not a picture, and stores nothing", async () => {
    const form = new FormData();
    form.append("kind", "bug");
    form.append("detail", "Something is wrong with the page here.");
    form.append("screenshot", new Blob(["<html>not a picture</html>"], { type: "image/png" }), "shot.png");
    const r = await call(`/api/feedback`, { method: "POST", body: form });
    expect(r.status).toBe(400);
    expect(insert()).toBeUndefined();
  });
});

describe("the door's order (fold QA round 1)", () => {
  const picture = () => sharp({ create: { width: 40, height: 30, channels: 3, background: { r: 9, g: 9, b: 9 } } }).png().toBuffer();
  const shotForm = async () => {
    const form = new FormData();
    form.append("kind", "bug");
    form.append("detail", "The send button sits under the tab bar on a phone.");
    form.append("screenshot", new Blob([new Uint8Array(await picture())], { type: "image/png" }), "shot.png");
    return form;
  };
  const shotsOnDisk = () => {
    const dir = path.join(dataDir, FEEDBACK_SHOT_DIRNAME);
    return fs.existsSync(dir) ? fs.readdirSync(dir).length : 0;
  };

  it("writes no file when the row is refused, so no picture sits where nobody can find or erase it", async () => {
    const before = shotsOnDisk();
    refuseInsert = true;
    const r = await call(`/api/feedback`, { method: "POST", body: await shotForm() });
    expect(r.status).toBe(500);
    expect(shotsOnDisk()).toBe(before);
  });

  it("answers an address over its hourly limit before it reads a screenshot", async () => {
    overTheLimit = true;
    const r = await call(`/api/feedback`, { method: "POST", body: await shotForm() });
    expect(r.status).toBe(429);
    expect(insert()).toBeUndefined();
  });

  it("names who receives the copy by the host the relay sends to, and nobody when nothing is sent", async () => {
    const was = process.env.FEEDBACK_HUB_URL;
    try {
      delete process.env.FEEDBACK_HUB_URL;
      expect(await (await call(`/api/feedback/config`)).json()).toMatchObject({ relayOn: false, hubName: null, villageName: "Hollow Oak" });
      process.env.FEEDBACK_HUB_URL = "https://hub.example.org/api/feedback/ingest";
      expect(await (await call(`/api/feedback/config`)).json()).toMatchObject({ relayOn: true, hubName: "hub.example.org" });
    } finally {
      if (was === undefined) delete process.env.FEEDBACK_HUB_URL;
      else process.env.FEEDBACK_HUB_URL = was;
    }
  });
});

describe("feedbackShotName", () => {
  it("reads only names this door minted", () => {
    expect(feedbackShotName("feedbackshot-1764100000000-abc123de.webp")).toBe("feedbackshot-1764100000000-abc123de.webp");
    expect(feedbackShotName("../feedbackshot-1-a.png")).toBe("feedbackshot-1-a.png");
    expect(feedbackShotName("proposal-1-a.png")).toBeNull();
    expect(feedbackShotName("feedbackshot-1-a.svg")).toBeNull();
    expect(feedbackShotName(null)).toBeNull();
  });
});
