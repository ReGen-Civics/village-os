// @vitest-environment jsdom
/**
 * CONFIRMING ONE OF SERA'S PAY SUGGESTIONS: the pieces the row and the pay setter share.
 *
 * Nothing in Sera's list writes pay. Confirming opens the role's own pay setter under the row, as the person, behind
 * the pay route's own gate, with what Sera lists shown beside the engine's suggestion (Rye, 27 Nov 2026: "Sera, can
 * also make suggestions for pay and new roles, but with our confirmation."). These hold what the setter is handed
 * from the row, the estimate read for it, the read that says whether this reader may set pay at all, and the one
 * way the setter talks to the server.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/gameApi", () => ({ authToken: () => token }));
let token = "a-token";

import { forgetPayDoor, payCall, readPayDoor, readStoredEstimate, seraPayFromRow, storedEstimateOf } from "./seraPay";
import { listed } from "@/test/seraDifferences";

const pay = (ourId: string, params: Record<string, string | number | null> = { model: "Stipend", monthlyUsd: 1200, standing: "pending" }) =>
  listed({ kind: "pay", field: "pay", ours: "none", sera: "stipend|1200", bulkEligible: false, params, subject: { ourId, name: "Cook" } });
const SETTING = (over: Record<string, unknown> = {}) => ({
  id: "s-2", state: "set", createdAt: "2026-10-30T12:00:00.000Z",
  inputs: { kind: "role", lines: [{ band: "general", payee: "lead", estimatedHours: 40, estimateLow: 30, estimateHigh: 55 }], responsibility: "circle" },
  ...over,
});

type Answer = { status: number; body: unknown };
function serve(routes: Record<string, Answer>) {
  const asked: Array<{ url: string; auth: string | null }> = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: { headers?: Record<string, string> }) => {
    asked.push({ url: String(url), auth: init?.headers?.Authorization ?? null });
    const a = routes[String(url)] ?? { status: 404, body: {} };
    return { ok: a.status >= 200 && a.status < 300, status: a.status, json: async () => a.body };
  }));
  return asked;
}

beforeEach(() => {
  token = "a-token";
  forgetPayDoor();
});
afterEach(() => vi.unstubAllGlobals());

describe("what Sera lists for one role, from its row", () => {
  it("is the row's own sentence and figure, so nothing is read twice", () => {
    const d = pay("r-cook");
    expect(seraPayFromRow(d, "Sera")).toEqual({ agent: "Sera", sentence: d.words.sentence, monthlyUsd: 1200 });
  });

  it("has no figure when the row carries none, or one that is no amount", () => {
    expect(seraPayFromRow(pay("r-cook", { model: "Stipend", monthlyUsd: null, standing: null }), "Sera").monthlyUsd).toBeNull();
    expect(seraPayFromRow(pay("r-cook", { model: "Stipend", monthlyUsd: "about 1200", standing: null }), "Sera").monthlyUsd).toBeNull();
    expect(seraPayFromRow(pay("r-cook", { model: "Stipend", monthlyUsd: 0, standing: null }), "Sera").monthlyUsd).toBeNull();
  });
});

describe("the estimate stored with the role's last pay setting", () => {
  it("is the newest setting's effort line and responsibility", () => {
    expect(storedEstimateOf({ settings: [SETTING(), SETTING({ id: "s-1", createdAt: "2026-09-01T00:00:00.000Z" })] })).toEqual({
      band: "general", estimatedHours: 40, estimateLow: 30, estimateHigh: 55, responsibility: "circle", setAt: "2026-10-30T12:00:00.000Z",
    });
  });

  it("leaves out a low or a high that was never given, and is nothing when no setting holds a usable estimate", () => {
    const bare = SETTING({ inputs: { kind: "role", lines: [{ band: "general", payee: "lead", estimatedHours: 12 }] } });
    expect(storedEstimateOf({ settings: [bare] })).toEqual({ band: "general", estimatedHours: 12, estimateLow: null, estimateHigh: null, responsibility: null, setAt: "2026-10-30T12:00:00.000Z" });
    expect(storedEstimateOf({ settings: [] })).toBeNull();
    expect(storedEstimateOf({ settings: [SETTING({ inputs: { kind: "role", lines: [] } })] })).toBeNull();
    expect(storedEstimateOf({ settings: [SETTING({ inputs: { kind: "role", lines: [{ band: "", payee: "lead", estimatedHours: 0 }] } })] })).toBeNull();
    expect(storedEstimateOf({})).toBeNull();
    expect(storedEstimateOf(null)).toBeNull();
  });

  it("is read from the role's own settings route, and is nothing when it does not answer", async () => {
    const asked = serve({ "/api/org/roles/r-cook/pay/settings": { status: 200, body: { settings: [SETTING()] } } });
    expect((await readStoredEstimate("r-cook"))?.estimatedHours).toBe(40);
    expect(asked[0]).toEqual({ url: "/api/org/roles/r-cook/pay/settings", auth: "Bearer a-token" });
    serve({});
    expect(await readStoredEstimate("r-cook")).toBeNull();
  });
});

describe("may this reader set pay", () => {
  it("is what the pay settings read says about this reader, asked once however many rows ask", async () => {
    const asked = serve({ "/api/valuation/model": { status: 200, body: { model: {}, payDoor: "holder" } } });
    expect(await Promise.all([readPayDoor(), readPayDoor(), readPayDoor()])).toEqual(["holder", "holder", "holder"]);
    expect(asked).toHaveLength(1);
  });

  it("is no for a reader the read names no door for, for a refusal, and for a read that never arrives", async () => {
    serve({ "/api/valuation/model": { status: 200, body: { model: {}, payDoor: null } } });
    expect(await readPayDoor()).toBeNull();
    forgetPayDoor();
    serve({ "/api/valuation/model": { status: 401, body: { error: "auth_required" } } });
    expect(await readPayDoor()).toBeNull();
    forgetPayDoor();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await readPayDoor()).toBeNull();
    forgetPayDoor();
    // A word that is no door is no door.
    serve({ "/api/valuation/model": { status: 200, body: { payDoor: "everyone" } } });
    expect(await readPayDoor()).toBeNull();
  });

  it("is never one person's answer handed to the next person on this device", async () => {
    serve({ "/api/valuation/model": { status: 200, body: { payDoor: "holder" } } });
    expect(await readPayDoor()).toBe("holder");
    token = "another-token";
    const asked = serve({ "/api/valuation/model": { status: 200, body: { payDoor: null } } });
    expect(await readPayDoor()).toBeNull();
    expect(asked).toEqual([{ url: "/api/valuation/model", auth: "Bearer another-token" }]);
  });
});

describe("how the setter under a row talks to the server", () => {
  it("sends a write as the person and hands back the answer", async () => {
    const sent: Array<{ url: string; method?: string; body?: string; auth?: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: { method?: string; body?: string; headers?: Record<string, string> }) => {
      sent.push({ url: String(url), method: init?.method, body: init?.body, auth: init?.headers?.Authorization });
      return { ok: true, status: 200, json: async () => ({ state: "set" }) };
    }));
    expect(await payCall("/org/roles/r-cook/pay", { set: { totalMinor: 120000 } }, "PUT")).toEqual({ state: "set" });
    expect(sent).toEqual([{ url: "/api/org/roles/r-cook/pay", method: "PUT", body: '{"set":{"totalMinor":120000}}', auth: "Bearer a-token" }]);
  });

  it("a refused write says the server's own reason and answers nothing; a refused read is quiet", async () => {
    const said: string[] = [];
    serve({ "/api/org/roles/r-cook/pay": { status: 409, body: { error: "village_holds_it", message: "The village holds this power. It is decided by a vote." } } });
    expect(await payCall("/org/roles/r-cook/pay", {}, "PUT", (words) => said.push(words))).toBeNull();
    expect(said).toEqual(["The village holds this power. It is decided by a vote."]);
    serve({ "/api/valuation/model": { status: 401, body: { error: "auth_required" } } });
    expect(await payCall("/valuation/model", undefined, "GET", (words) => said.push(words))).toBeNull();
    expect(said).toHaveLength(1);
  });
});
