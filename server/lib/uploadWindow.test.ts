/**
 * The upload window, on a real HTTP server with a small requestTimeout: a slow upload on a lifted route arrives
 * whole long past it, the same upload on an ordinary route is answered 408 as Node answers it, and a lifted upload
 * past its own deadline is answered 408 too.
 */
import http from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { liftRequestTimeout } from "./uploadWindow";
import { NODE_REQUEST_TIMEOUT_MS, uploadWindowMs } from "../../shared/applyLimits";

const REQUEST_TIMEOUT = 400;
let server: http.Server;
let port = 0;

beforeAll(async () => {
  const app = express();
  const take = (req: express.Request, res: express.Response) => {
    let n = 0;
    req.on("data", (c: Buffer) => (n += c.length));
    req.on("end", () => res.json({ got: n }));
  };
  app.post("/lifted", (req, res) => {
    liftRequestTimeout(req, 5_000);
    take(req, res);
  });
  app.post("/lifted-short", (req, res) => {
    liftRequestTimeout(req, 600);
    take(req, res);
  });
  app.post("/plain", take);
  server = http.createServer({ requestTimeout: REQUEST_TIMEOUT, connectionsCheckingInterval: 50 }, app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as AddressInfo).port;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

/** Send `chunks` of 1 KB, one every `gapMs`, and resolve the status line and body, or "closed". */
function slowPost(path: string, chunks: number, gapMs: number): Promise<{ status: number; body: string } | "closed"> {
  return new Promise((resolve) => {
    const req = http.request({ host: "127.0.0.1", port, path, method: "POST", headers: { "Content-Length": String(chunks * 1024), Connection: "close" } }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on("error", () => resolve("closed"));
    let sent = 0;
    const tick = () => {
      if (req.destroyed) return;
      req.write(Buffer.alloc(1024, 1));
      sent += 1;
      if (sent < chunks) setTimeout(tick, gapMs);
      else req.end();
    };
    tick();
  });
}

describe("lifting Node's requestTimeout for one upload", () => {
  it("an upload that takes three times the requestTimeout arrives whole on a lifted route", async () => {
    const got = await slowPost("/lifted", 12, 100);
    expect(got).toEqual({ status: 200, body: JSON.stringify({ got: 12 * 1024 }) });
  });

  it("the same upload on an ordinary route meets Node's own 408: the rest of the server keeps its timeout", async () => {
    const got = await slowPost("/plain", 12, 100);
    expect(got === "closed" || got.status === 408).toBe(true);
  });

  it("a lifted upload past its own deadline is answered 408 too", async () => {
    const got = await slowPost("/lifted-short", 20, 100);
    expect(got === "closed" || got.status === 408).toBe(true);
  });

  it("the window is the upload's time on a slow line, half again, never under Node's five minutes", () => {
    expect(uploadWindowMs(0)).toBe(NODE_REQUEST_TIMEOUT_MS);
    // A 15-minute take at the largest phone rate (24 MB) on 1 Mbit/s: 192 s, half again 288 s, so the five minutes.
    expect(uploadWindowMs(24_000_000)).toBe(NODE_REQUEST_TIMEOUT_MS);
    // 100 MB: 800 s on the line, 1,200 s given.
    expect(uploadWindowMs(100_000_000)).toBe(1_200_000);
  });
});
