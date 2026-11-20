/**
 * THE CRASH-REPORT ROUTE (server/routes/clientCrash.ts), driven against a fake
 * Express. It stores only the named fields, scrubbed again; it holds to its
 * per-address and per-instance limits; and it hands each kept report to the
 * error reporter (which owns the webhook) without ever answering anything
 * but 204.
 */
import { describe, expect, it, vi } from "vitest";
import { CLIENT_CRASH_PATH, PER_ADDRESS, crashLine, register, sanitizeCrash } from "./clientCrash";

type Handler = (req: any, res: any) => Promise<unknown> | unknown;

function harness(opts: { admin?: boolean } = {}) {
  const handlers = new Map<string, Handler>();
  const app = { post: (p: string, h: Handler) => handlers.set(`POST ${p}`, h), get: (p: string, h: Handler) => handlers.set(`GET ${p}`, h) } as any;
  const inserts: unknown[][] = [];
  const pool = {
    query: vi.fn(async (sql: string, params: unknown[]) => {
      if (/^INSERT INTO health_events/.test(sql)) inserts.push(params);
      return [[], []];
    }),
  } as any;
  const hits = new Map<string, number>();
  const overLimit = vi.fn(async (bucket: string, max: number) => {
    const n = (hits.get(bucket) ?? 0) + 1;
    hits.set(bucket, n);
    return n > max;
  });
  const report = vi.fn(async () => ({ suppressed: false, admins: "sent" as const, webhook: "sent" as const }));
  register(app, { getPool: () => pool, overLimit, clientIp: (req: any) => req.ip, isAdmin: async () => !!opts.admin, buildMarker: "2026-11-19 abc1234", report });
  const post = async (body: unknown, ip = "203.0.113.9") => {
    const res: any = { code: 0, status(c: number) { res.code = c; return res; }, end() { return res; } };
    await handlers.get(`POST ${CLIENT_CRASH_PATH}`)!({ body, ip }, res);
    return res.code;
  };
  return { post, inserts, report, overLimit, handlers };
}

const GOOD = {
  source: "boundary",
  message: "Cannot access uninitialized variable.",
  name: "ReferenceError",
  frames: ["getSnapshot@/assets/VoiceStepMore-C1.js:1:2345"],
  route: "/propose-a-role",
  bundle: "index-B6yHa53f",
  browser: "Safari 17 iOS",
  at: new Date().toISOString(),
};

describe("sanitizeCrash", () => {
  it("keeps only the named fields, stamps the server's build, and drops everything else", () => {
    const c = sanitizeCrash({ ...GOOD, form: { why: "my private answer" }, localStorage: { token: "x" }, email: "ana@example.org", cookie: "sid=1" }, "build-1")!;
    expect(Object.keys(c).sort()).toEqual(["at", "browser", "build", "bundle", "frames", "message", "name", "route", "source"]);
    expect(JSON.stringify(c)).not.toMatch(/private answer|ana@example|sid=1/);
    expect(c.build).toBe("build-1");
  });

  it("scrubs personal shapes a client left in, and strips a query from the route", () => {
    const c = sanitizeCrash({ ...GOOD, message: "Saving ana@example.org failed for +506 8888 1234", route: "/apply?email=ana@example.org", frames: ["at f (/a.js?u=12345678:1:2)"] }, "b")!;
    expect(c.message).toBe("Saving <email> failed for <number>");
    expect(c.route).toBe("/apply");
    expect(c.frames[0]).not.toContain("12345678");
  });

  it("refuses a body that is not a crash report", () => {
    expect(sanitizeCrash(null, "b")).toBeNull();
    expect(sanitizeCrash([GOOD], "b")).toBeNull();
    expect(sanitizeCrash({ ...GOOD, source: "made-up" }, "b")).toBeNull();
    expect(sanitizeCrash({ ...GOOD, message: "" }, "b")).toBeNull();
  });

  it("keeps the server's clock when the device's is far off", () => {
    const now = new Date("2026-11-19T10:00:00Z");
    expect(sanitizeCrash({ ...GOOD, at: "1999-01-01T00:00:00Z" }, "b", now)!.at).toBe(now.toISOString());
  });
});

describe("POST /api/client-crash", () => {
  it("records an admin event and hands the crash to the error reporter", async () => {
    const h = harness();
    expect(await h.post(GOOD)).toBe(204);
    expect(h.inserts).toHaveLength(1);
    const [, kind, text, , actorKind, , entityType, entityRef, audience] = h.inserts[0] as string[];
    expect([kind, actorKind, entityType, entityRef, audience]).toEqual(["client_crash", "system", "route", "/propose-a-role", "admin"]);
    expect(text).toBe(crashLine(sanitizeCrash(GOOD, "2026-11-19 abc1234")!));
    expect(h.report).toHaveBeenCalledTimes(1);
    const [err, ctx] = h.report.mock.calls[0] as unknown as [Error, { where: string; detail: Record<string, unknown> }];
    expect(err.message).toBe(GOOD.message);
    expect(ctx.where).toBe("browser on /propose-a-role");
    expect(ctx.detail).toMatchObject({ browser: "Safari 17 iOS", build: "2026-11-19 abc1234" });
  });

  it("holds the per-address limit, and another address still gets through", async () => {
    const h = harness();
    for (let i = 0; i < PER_ADDRESS + 5; i++) expect(await h.post(GOOD)).toBe(204);
    expect(h.inserts).toHaveLength(PER_ADDRESS);
    await h.post(GOOD, "198.51.100.7");
    expect(h.inserts).toHaveLength(PER_ADDRESS + 1);
  });

  it("answers 204 and stores nothing for junk, without spending a limit", async () => {
    const h = harness();
    expect(await h.post("not json")).toBe(204);
    expect(h.inserts).toHaveLength(0);
    expect(h.overLimit).not.toHaveBeenCalled();
  });

  it("lets only an admin read the latest crashes", async () => {
    const res = () => {
      const r: any = { code: 200, body: null, status(c: number) { r.code = c; return r; }, json(b: unknown) { r.body = b; return r; }, setHeader() {} };
      return r;
    };
    const anon = res();
    await harness().handlers.get("GET /api/admin/client-crashes")!({}, anon);
    expect(anon.code).toBe(401);
    const admin = res();
    await harness({ admin: true }).handlers.get("GET /api/admin/client-crashes")!({}, admin);
    expect(admin.code).toBe(200);
    expect(admin.body).toEqual({ crashes: [] });
  });
});
