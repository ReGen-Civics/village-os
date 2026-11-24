/**
 * The living map is for members (server/routes/mapView.ts): every read under `/api/map` asks the
 * one gate for `map.view`, refuses with a sentence below the rung, and leaves writes and a
 * member's own light setting to their own keys.
 */
import http from "node:http";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hasCapability, STAGE_UNLOCKS } from "../../shared/capabilities";
import { MAP_MEMBERS_ONLY, register } from "./mapView";

describe("the living map, members only", () => {
  let server: http.Server;
  let base = "";
  let allowed = false;
  const asked: string[] = [];

  beforeAll(async () => {
    const app = express();
    register(app, {
      guardCapability: async (_req, res, cap, refusal) => {
        asked.push(cap);
        if (allowed) return true;
        res.status(refusal?.status ?? 401).json(refusal?.body ?? { error: "auth_required" });
        return false;
      },
    });
    app.get("/api/map/config", (_req, res) => res.json({ map: true }));
    app.get("/api/map/my-light", (_req, res) => res.json({ light: "dawn" }));
    app.post("/api/map/roles/x/raise-hand", (_req, res) => res.json({ ok: true }));
    app.get("/api/circles", (_req, res) => res.json({ circles: [] }));
    server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
  });

  const call = (p: string, init?: RequestInit) => fetch(base + p, init); // module-review-ok: the test's own loopback server, not an outbound call

  it("refuses a reader below the rung with a sentence, and asks map.view", async () => {
    allowed = false;
    asked.length = 0;
    const res = await call("/api/map/config");
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual(MAP_MEMBERS_ONLY);
    expect(asked).toEqual(["map.view"]);
  });

  it("opens the map to a reader who holds it", async () => {
    allowed = true;
    expect((await call("/api/map/config")).status).toBe(200);
  });

  it("leaves writes, the light setting and the circles' words alone", async () => {
    allowed = false;
    asked.length = 0;
    expect((await call("/api/map/roles/x/raise-hand", { method: "POST" })).status).toBe(200);
    expect((await call("/api/map/my-light")).status).toBe(200);
    expect((await call("/api/circles")).status).toBe(200);
    expect(asked).toEqual([]);
  });

  it("opens at the member rung by default, and a guest is below it", () => {
    expect(STAGE_UNLOCKS["map.view"]).toBe("member");
    const ladder = ["visitor", "guest", "member"];
    const at = (stage: string) => hasCapability("map.view", { stageIndex: ladder.indexOf(stage), stageIndexOf: (id: string) => ladder.indexOf(id), roleCapabilities: [] });
    expect(at("visitor")).toBe(false);
    expect(at("guest")).toBe(false);
    expect(at("member")).toBe(true);
  });
});
