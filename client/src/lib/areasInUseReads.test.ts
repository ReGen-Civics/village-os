// @vitest-environment jsdom
/**
 * The front door's "in use" reads ask only what the server would answer (the live probe, 25 Nov 2026). Every page
 * used to ask all four, and a visitor read four 401s in the console on every page: the portal entrance refuses a
 * device that has not entered, and a module kept for members refuses a read with no token.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetAreasInUse, readAreas } from "./areasInUseReads";
import { forgetEntranceStatusRead } from "./entranceStatus";

let asked: string[] = [];
let status: unknown = { required: true, entered: false, siteKey: null };
const ALL_PUBLIC = new Set(["map", "crowdpool", "events"]);

beforeEach(() => {
  asked = [];
  forgetAreasInUse();
  forgetEntranceStatusRead();
  document.cookie = "vos_gate=; path=/; max-age=0";
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    asked.push(url);
    if (url === "/api/entrance") return { ok: true, json: async () => status } as Response;
    if (url === "/api/places") return { ok: true, json: async () => ({ places: [{ id: "p1" }] }) } as Response;
    return { ok: true, json: async () => ({ modules: [], campaigns: [], events: [] }) } as Response;
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("the front door's reads", () => {
  it("a village with no entrance: every read whose module is public, and the entrance is never asked", async () => {
    const a = await readAreas(ALL_PUBLIC);
    expect(asked.sort()).toEqual(["/api/crowdpool/campaigns", "/api/events", "/api/examples", "/api/places"]);
    expect(a.places).toBe(true);
  });

  it("a village with an entrance this device has not passed: nothing past the entrance is asked, and nothing is in use", async () => {
    document.cookie = "vos_gate=1; path=/";
    const a = await readAreas(ALL_PUBLIC);
    expect(asked).toEqual(["/api/entrance"]);
    expect(a).toEqual({ exampleModules: null, places: false, campaigns: false, events: false });
  });

  it("a device that has entered reads as before", async () => {
    document.cookie = "vos_gate=1; path=/";
    status = { required: true, entered: true, siteKey: null };
    await readAreas(ALL_PUBLIC);
    expect(asked).toContain("/api/places");
    expect(asked).toHaveLength(5);
  });

  it("an entrance whose status cannot be read asks nothing past it", async () => {
    document.cookie = "vos_gate=1; path=/";
    status = null;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      asked.push(url);
      return { ok: false, json: async () => null } as Response;
    }));
    await readAreas(ALL_PUBLIC);
    expect(asked).toEqual(["/api/entrance"]);
  });

  it("a module kept for members is not asked, and reads as not in use", async () => {
    const a = await readAreas(new Set(["crowdpool", "events"]));
    expect(asked).not.toContain("/api/places");
    expect(a.places).toBe(false);
  });
});
