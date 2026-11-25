/**
 * THE CRASH-REPORT ROUTE (server/routes/clientCrash.ts), driven against a fake
 * Express. It stores only the named fields, scrubbed again; it holds to its
 * per-address and per-instance limits; and it hands each kept report to the
 * error reporter (which owns the webhook) without ever answering anything
 * but 204.
 */
import { describe, expect, it, vi } from "vitest";
import { CLIENT_CRASH_PATH, PER_ADDRESS, crashLine, entryBundleOf, isStaleBuildMiss, register, sanitizeCrash, sendCrashDigest } from "./clientCrash";

type Handler = (req: any, res: any) => Promise<unknown> | unknown;

/**
 * The two crash tables (drizzle/0433), in memory: exactly the statements server/repos/clientCrashes.ts sends. The SQL
 * itself is run against MySQL in server/repos/clientCrashes.db.test.ts.
 */
export function crashTables() {
  const sigs = new Map<string, any>();
  const sightings: any[] = [];
  const query = (sql: string, p: any[]): any => {
    if (/^INSERT INTO client_crash_signatures/.test(sql)) {
      const [id, message, top, ours, first, , last2, ours2] = p;
      const had = sigs.get(id);
      if (had) Object.assign(had, { last_seen_at: last2, seen_count: had.seen_count + 1, ours: Math.max(had.ours, ours2) });
      else sigs.set(id, { id, message, top_frame: top, ours, first_seen_at: first, last_seen_at: first, seen_count: 1, emailed_at: null, emails_sent: 0 });
      return [{ affectedRows: 1 }];
    }
    if (/^INSERT INTO client_crash_sightings/.test(sql)) {
      const [id, signature_id, visitor, browser, route, at] = p;
      sightings.push({ id, signature_id, visitor, browser, route, at, emailed: 0, digested_at: null });
      return [{ affectedRows: 1 }];
    }
    if (/^SELECT message, top_frame/.test(sql)) return [[sigs.get(p[0])].filter(Boolean)];
    if (/^SELECT COUNT\(DISTINCT visitor\)/.test(sql)) {
      const seen = new Set(sightings.filter((x) => x.signature_id === p[0] && x.at >= p[1]).map((x) => x.visitor));
      return [[{ n: seen.size }]];
    }
    if (/^UPDATE client_crash_signatures SET emailed_at/.test(sql)) {
      const [now, id, before] = p;
      const g = sigs.get(id);
      if (!g || (g.emailed_at && g.emailed_at > before)) return [{ affectedRows: 0 }];
      g.emailed_at = now;
      g.emails_sent++;
      return [{ affectedRows: 1 }];
    }
    if (/^UPDATE client_crash_sightings SET emailed = 1/.test(sql)) {
      for (const x of sightings) if (x.id === p[0]) x.emailed = 1;
      return [{ affectedRows: 1 }];
    }
    if (/^SELECT s\.id, s\.signature_id/.test(sql)) {
      const [since, now] = p;
      return [sightings.filter((x) => x.emailed === 0 && !x.digested_at && x.at >= since && x.at <= now).map((x) => ({ ...x, message: sigs.get(x.signature_id)?.message }))];
    }
    if (/^UPDATE client_crash_sightings SET digested_at/.test(sql)) {
      const [now, ...ids] = p;
      for (const x of sightings) if (ids.includes(x.id)) x.digested_at = now;
      return [{ affectedRows: ids.length }];
    }
    if (/^SELECT id, message, top_frame, ours, first_seen_at/.test(sql)) return [Array.from(sigs.values()).sort((a, b) => b.last_seen_at - a.last_seen_at)];
    if (/^SELECT DISTINCT signature_id/.test(sql)) return [sightings.filter((x) => p.includes(x.signature_id))];
    return null;
  };
  return { sigs, sightings, query };
}

function harness(opts: { admin?: boolean; currentBundle?: string | null; now?: () => Date } = {}) {
  const handlers = new Map<string, Handler>();
  const app = { post: (p: string, h: Handler) => handlers.set(`POST ${p}`, h), get: (p: string, h: Handler) => handlers.set(`GET ${p}`, h) } as any;
  const inserts: unknown[][] = [];
  const tables = crashTables();
  const pool = {
    query: vi.fn(async (sql: string, params: unknown[]) => {
      if (/^INSERT INTO health_events/.test(sql)) inserts.push(params);
      return tables.query(sql, params as any[]) ?? [[], []];
    }),
  } as any;
  const hits = new Map<string, number>();
  const overLimit = vi.fn(async (bucket: string, max: number) => {
    const n = (hits.get(bucket) ?? 0) + 1;
    hits.set(bucket, n);
    return n > max;
  });
  const report = vi.fn(async () => ({ suppressed: false, admins: "sent" as const, webhook: "sent" as const }));
  register(app, { getPool: () => pool, overLimit, clientIp: (req: any) => req.ip, isAdmin: async () => !!opts.admin, buildMarker: "2026-11-19 abc1234", report, currentBundle: () => (opts.currentBundle === undefined ? null : opts.currentBundle), visitorSalt: () => "test-salt", ...(opts.now ? { now: opts.now } : {}) });
  const post = async (body: unknown, ip = "203.0.113.9") => {
    const res: any = { code: 0, status(c: number) { res.code = c; return res; }, end() { return res; } };
    await handlers.get(`POST ${CLIENT_CRASH_PATH}`)!({ body, ip }, res);
    return res.code;
  };
  return { post, inserts, report, overLimit, handlers, tables, pool };
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
    expect(admin.body).toEqual({ crashes: [], signatures: [] });
  });
});

/*
 * A PAGE THAT OUTLIVED A DEPLOY (2026-11-24). The report that started this:
 * "Something broke in browser on /roles: copy part kxi1ofHr6p0P: 404", one
 * email per admin per open tab, after every release.
 */
describe("a stale-build miss from an older bundle", () => {
  const STALE = { ...GOOD, source: "boundary", name: "Error", message: "copy part kxi1ofHr6p0P: 404", frames: [], route: "/roles", bundle: "index-OLDbuild1" };

  it("is a log line: no event, no alert", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const h = harness({ currentBundle: "index-NEWbuild2" });
    expect(await h.post(STALE)).toBe(204);
    expect(h.report).not.toHaveBeenCalled();
    expect(h.inserts).toHaveLength(0);
    expect(log).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });

  it("a missing chunk from an older bundle is the same case", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const h = harness({ currentBundle: "index-NEWbuild2" });
    await h.post({ ...STALE, message: "Importing a module script failed." });
    expect(h.report).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("the same miss from the bundle this server serves is recorded, and emails once it reaches three visitors (25 Nov 2026)", async () => {
    // During a deploy a tab can load the new entry and miss a part on the old server, so one report proves nothing;
    // a build that really broke its own rule reaches everyone within the hour.
    const h = harness({ currentBundle: "index-OLDbuild1" });
    await h.post(STALE);
    expect(h.inserts).toHaveLength(1);
    expect(h.report).not.toHaveBeenCalled();
    await h.post(STALE, "198.51.100.1");
    await h.post(STALE, "198.51.100.2");
    expect(h.report).toHaveBeenCalledTimes(1);
  });

  it("a chunk that did not arrive is never ours by its frames, which are Vite's preload helper in our bundle", async () => {
    const h = harness({ currentBundle: "index-OLDbuild1" });
    await h.post({ ...STALE, message: "Failed to fetch dynamically imported module: https://village.example/assets/Home-CDRldjDs.js", frames: ["preload@/assets/index-OLDbuild1.js:1:200"] });
    expect(h.report).not.toHaveBeenCalled();
    expect(Array.from(h.tables.sigs.values())[0].ours).toBe(0);
  });

  it("is recorded when the served bundle cannot be read, or the page sent none, and emails once it spreads (25 Nov 2026)", async () => {
    // Unknown is not proof the build broke, so one visitor is a record on Village Health and three are an email.
    const unknown = harness({ currentBundle: null });
    await unknown.post(STALE);
    expect(unknown.inserts).toHaveLength(1);
    expect(unknown.report).not.toHaveBeenCalled();
    await unknown.post(STALE, "198.51.100.1");
    await unknown.post(STALE, "198.51.100.2");
    expect(unknown.report).toHaveBeenCalledTimes(1);
    const noBundle = harness({ currentBundle: "index-NEWbuild2" });
    await noBundle.post({ ...STALE, bundle: "" });
    expect(noBundle.inserts).toHaveLength(1);
    expect(noBundle.report).not.toHaveBeenCalled();
  });

  it("an ordinary crash from an older bundle is still a crash", async () => {
    const h = harness({ currentBundle: "index-NEWbuild2" });
    await h.post({ ...GOOD, bundle: "index-OLDbuild1" });
    expect(h.report).toHaveBeenCalledTimes(1);
  });

  it("isStaleBuildMiss needs both: the words and a different bundle", () => {
    expect(isStaleBuildMiss({ message: "copy part kxi1ofHr6p0P: 404", bundle: "index-a" }, "index-b")).toBe(true);
    expect(isStaleBuildMiss({ message: "copy part kxi1ofHr6p0P: 500", bundle: "index-a" }, "index-b")).toBe(false);
    expect(isStaleBuildMiss({ message: "copy part kxi1ofHr6p0P: 404", bundle: "index-a" }, "index-a")).toBe(false);
  });
});

describe("entryBundleOf", () => {
  it("reads the entry the way the browser names it, skipping scripts that are not the module entry", () => {
    const html = '<head><script async fetchpriority="high" src="/assets/route-preload-Ab12.js"></script><script type="module" crossorigin src="/assets/index-B6yHa53f.js"></script></head>';
    expect(entryBundleOf(html)).toBe("index-B6yHa53f");
    expect(entryBundleOf('<script type="module" src="/src/main.tsx"></script>')).toBeNull();
    expect(entryBundleOf(null)).toBeNull();
  });
});

/*
 * NOISE, AND WHAT EMAILS (the lead, 25 Nov 2026: "fix that so we're not bogged down in noise"). The page's filter
 * cannot reach a tab still running the bundle from before a deploy, so the route drops the same noise, and of what
 * it keeps only a crash in our own code, or one that reached several visitors, emails; once a day at most.
 */
describe("noise from any page, old bundle or new, is dropped by the server", () => {
  const OLD_PAGE = { ...GOOD, bundle: "index-OLDbuild1", frames: [] as string[] };
  const cases: Array<[string, Record<string, unknown>]> = [
    ["a wallet extension's global", { ...OLD_PAGE, message: "Cannot read properties of undefined (reading 'ethereum')" }],
    ["an in-app browser's bridge", { ...OLD_PAGE, message: "undefined is not an object (evaluating 'window.webkit.messageHandlers')" }],
    ["Firefox iOS's own global", { ...OLD_PAGE, message: "Can't find variable: __firefox__" }],
    ["a dropped connection", { ...OLD_PAGE, message: "Load failed" }],
    ["an opaque cross-origin error", { ...OLD_PAGE, message: "Script error." }],
    ["a frame from an extension", { ...OLD_PAGE, message: "x is not a function", frames: ["run@chrome-extension://abcdef/content.js:1:2"] }],
  ];
  for (const [what, body] of cases) {
    it(`${what}: a log line, no event, no record, no email`, async () => {
      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      const h = harness({ currentBundle: "index-NEWbuild2" });
      await h.post(body);
      expect(h.inserts).toHaveLength(0);
      expect(h.tables.sightings).toHaveLength(0);
      expect(h.report).not.toHaveBeenCalled();
      log.mockRestore();
    });
  }

  it("an injected global our own code reached for is ours, and emails", async () => {
    const h = harness();
    await h.post({ ...GOOD, message: "window.ethereum is undefined", frames: ["connect@/assets/wallet-Ab12Cd34.js:1:9"] });
    expect(h.report).toHaveBeenCalledTimes(1);
  });
});

describe("what emails: ours, or spread; once a day", () => {
  const NOT_OURS = { ...GOOD, message: "undefined is not an object (evaluating 'n.foo')", frames: ["@https://cdn.example.test/widget.js:3:4"], browser: "WebKit iOS", route: "/apply" };

  it("a crash in our own code emails the first time, with words to triage from and a link to its signature", async () => {
    const h = harness();
    await h.post(GOOD);
    expect(h.report).toHaveBeenCalledTimes(1);
    const [, ctx] = h.report.mock.calls[0] as unknown as [Error, { alert: { title: string; body: string; link: string; dedupeKey: string } }];
    const id = Array.from(h.tables.sigs.keys())[0];
    expect(ctx.alert.title).toBe("Crash on /propose-a-role: Cannot access uninitialized variable.");
    expect(ctx.alert.link).toBe(`/village-health#crash-${id}`);
    expect(ctx.alert.dedupeKey).toBe(`client-crash:${id}:1`);
    expect(ctx.alert.body).toContain("Page: /propose-a-role.");
    expect(ctx.alert.body).toContain("Browser: Safari iOS (Safari 17 iOS).");
    expect(ctx.alert.body).toContain("Seen once, first ");
    expect(ctx.alert.body).toMatch(/Our code: yes, getSnapshot@\/assets\/VoiceStepMore[\w-]*\.js\./);
  });

  it("not ours: one visitor, or one visitor three times, is recorded and not emailed", async () => {
    const h = harness();
    for (let i = 0; i < 3; i++) await h.post(NOT_OURS);
    expect(h.inserts).toHaveLength(3);
    expect(h.tables.sightings).toHaveLength(3);
    expect(h.report).not.toHaveBeenCalled();
  });

  it("not ours: the third different visitor within the hour emails, once, with the running count and why", async () => {
    const h = harness();
    await h.post(NOT_OURS, "198.51.100.1");
    await h.post(NOT_OURS, "198.51.100.2");
    expect(h.report).not.toHaveBeenCalled();
    await h.post(NOT_OURS, "198.51.100.3");
    await h.post(NOT_OURS, "198.51.100.4");
    expect(h.report).toHaveBeenCalledTimes(1);
    const [, ctx] = h.report.mock.calls[0] as unknown as [Error, { alert: { body: string } }];
    expect(ctx.alert.body).toContain("Browser: in-app browser (iOS) (WebKit iOS).");
    expect(ctx.alert.body).toContain("Seen 3 times");
    expect(ctx.alert.body).toContain("Our code: no frame from our bundle.");
    expect(ctx.alert.body).toContain("3 different visitors hit it within the hour");
  });

  it("three visitors spread over more than the window do not email", async () => {
    let t = Date.parse("2026-11-25T01:00:00Z");
    const h = harness({ now: () => new Date(t) });
    for (const ip of ["198.51.100.1", "198.51.100.2", "198.51.100.3"]) {
      await h.post(NOT_OURS, ip);
      t += 40 * 60_000;
    }
    expect(h.report).not.toHaveBeenCalled();
  });

  it("one email per signature per day: the next day's says how many times it has happened since", async () => {
    let t = Date.parse("2026-11-25T01:00:00Z");
    const h = harness({ now: () => new Date(t) });
    await h.post(GOOD);
    for (let i = 0; i < 5; i++) {
      t += 60 * 60_000;
      await h.post(GOOD, `198.51.100.${i}`);
    }
    expect(h.report).toHaveBeenCalledTimes(1);
    t += 24 * 60 * 60_000;
    await h.post(GOOD, "198.51.100.99");
    expect(h.report).toHaveBeenCalledTimes(2);
    const [, ctx] = h.report.mock.calls[1] as unknown as [Error, { alert: { body: string; dedupeKey: string } }];
    expect(ctx.alert.body).toContain("Seen 7 times");
    expect(ctx.alert.dedupeKey).toMatch(/:2$/);
  });

  it("one bug keeps one signature across a deploy: the chunk's hash and the line move, the email does not repeat", async () => {
    const h = harness();
    await h.post({ ...GOOD, frames: ["getSnapshot@/assets/VoiceStepMore-C1d2E3f4.js:1:2345"] });
    await h.post({ ...GOOD, frames: ["getSnapshot@/assets/VoiceStepMore-Zz98Yy76.js:1:9999"], bundle: "index-NEWbuild2" }, "198.51.100.5");
    expect(Array.from(h.tables.sigs.values())[0].top_frame).toBe("getSnapshot@/assets/VoiceStepMore.js");
    expect(h.tables.sigs.size).toBe(1);
    expect(h.report).toHaveBeenCalledTimes(1);
  });

  it("Village Health reads each signature with its count, browsers and pages", async () => {
    const h = harness({ admin: true });
    await h.post(NOT_OURS);
    const r: any = { code: 200, body: null, status(c: number) { r.code = c; return r; }, json(b: unknown) { r.body = b; return r; }, setHeader() {} };
    await h.handlers.get("GET /api/admin/client-crashes")!({}, r);
    expect(r.body.signatures).toHaveLength(1);
    expect(r.body.signatures[0]).toMatchObject({ seenCount: 1, ours: false, browsers: ["in-app browser (iOS)"], routes: ["/apply"], emailedAt: null });
  });
});

describe("the daily digest", () => {
  it("counts what was recorded and not emailed, by signature, browser and page, once", async () => {
    const h = harness();
    const NOT_OURS = { ...GOOD, message: "n is null", frames: [], browser: "Chrome 131 Android", route: "/roles" };
    await h.post(NOT_OURS, "198.51.100.1");
    await h.post(NOT_OURS, "198.51.100.1");
    await h.post({ ...NOT_OURS, route: "/team" }, "198.51.100.2");
    await h.post(GOOD); // emailed on its own, so not in the digest
    const alert = vi.fn(async () => {});
    const result = await sendCrashDigest(h.pool, alert, new Date(Date.now() + 1000));
    expect(result).toBe("3 report(s) in 2 line(s)");
    expect(alert).toHaveBeenCalledTimes(1);
    const [title, key, extras] = alert.mock.calls[0] as unknown as [string, string, { body: string; link: string }];
    expect(title).toBe("Crash digest: 3 reports recorded, none emailed");
    expect(key).toMatch(/^client-crash-digest:\d{4}-\d{2}-\d{2}$/);
    expect(extras.body).toContain("2 x n is null (/roles, Chrome Android)");
    expect(extras.body).toContain("1 x n is null (/team, Chrome Android)");
    expect(extras.body).not.toContain("uninitialized");
    expect(extras.link).toBe("/village-health");
    // Counted once: the next run has nothing to tell and sends nothing.
    expect(await sendCrashDigest(h.pool, alert, new Date(Date.now() + 2000))).toBe("nothing to tell");
    expect(alert).toHaveBeenCalledTimes(1);
  });
});
