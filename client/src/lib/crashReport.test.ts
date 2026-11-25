/**
 * The crash report a page sends (lib/crashReport.ts): exactly its named
 * fields, nothing personal in them, and a hard ceiling on how many one page
 * can send.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CRASH_REPORT_FIELDS,
  MAX_PER_PAGE,
  MESSAGE_MAX,
  MIN_GAP_MS,
  browserFamily,
  buildCrashReport,
  installCrashReporting,
  reportCrash,
  resetCrashReportsForTests,
  type CrashReport,
} from "./crashReport";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

function senderAt(start = 1_000_000) {
  const sent: CrashReport[] = [];
  let t = start;
  return { sent, sender: { send: (r: CrashReport) => sent.push(r), now: () => t }, advance: (ms: number) => (t += ms) };
}

afterEach(() => resetCrashReportsForTests());

describe("buildCrashReport", () => {
  const env = { path: "/apply/role-7?email=ana@example.org&token=abc#step-2", ua: IPHONE, now: new Date("2026-11-19T10:00:00Z"), bundle: "index-B6yHa53f" };

  it("holds exactly the named fields and nothing else", () => {
    const r = buildCrashReport(new TypeError("x is undefined"), "boundary", env);
    expect(Object.keys(r).sort()).toEqual([...CRASH_REPORT_FIELDS].sort());
    for (const banned of ["form", "body", "storage", "localStorage", "cookie", "query", "search", "hash", "email", "user", "userId", "name_of_person"]) {
      expect(Object.keys(r)).not.toContain(banned);
    }
  });

  it("keeps the route path and drops the query string and the hash", () => {
    const r = buildCrashReport(new Error("boom"), "error", env);
    expect(r.route).toBe("/apply/role-7");
    expect(JSON.stringify(r)).not.toContain("ana@example.org");
    expect(JSON.stringify(r)).not.toContain("token=abc");
    expect(JSON.stringify(r)).not.toContain("step-2");
  });

  it("scrubs anything shaped like an address, a phone number, a long number or a token", () => {
    const err = new Error("Could not save ana.lopez@example.org, phone +506 8888 1234, card 4111111111111111, key abcd1234efgh5678ijkl9012mnop3456");
    const r = buildCrashReport(err, "rejection", env);
    expect(r.message).not.toMatch(/ana\.lopez|8888|4111|abcd1234/);
    expect(r.message).toContain("<email>");
  });

  it("reduces stack frame URLs to their path, with no origin or query", () => {
    const err = new Error("Cannot access uninitialized variable.");
    err.stack = "getSnapshot@https://village.example/assets/VoiceStepMore-C1.js?v=2:1:2345\nmountSyncExternalStore@https://village.example/assets/index-B6.js:9:88\n" + "x@https://v.example/a.js:1:1\n".repeat(10);
    const r = buildCrashReport(err, "boundary", env);
    expect(r.frames[0]).toBe("getSnapshot@/assets/VoiceStepMore-C1.js:1:2345");
    expect(r.frames.length).toBe(5);
    expect(r.frames.join("\n")).not.toContain("village.example");
  });

  it("caps the message", () => {
    expect(buildCrashReport(new Error("a ".repeat(500)), "error", env).message.length).toBeLessThanOrEqual(MESSAGE_MAX);
  });

  it("names the browser family and major version only", () => {
    expect(browserFamily(IPHONE)).toBe("Safari 17 iOS");
    expect(browserFamily("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.39 Mobile Safari/537.36")).toBe("Chrome 131 Android");
    expect(browserFamily("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0")).toBe("Firefox 132 Windows");
  });
});

describe("reportCrash rate limit", () => {
  it("sends the same error once per page", () => {
    const s = senderAt();
    const err = new Error("same thing");
    expect(reportCrash(err, "error", s.sender)).toBe(true);
    s.advance(MIN_GAP_MS * 2);
    expect(reportCrash(err, "error", s.sender)).toBe(false);
    expect(s.sent).toHaveLength(1);
  });

  it("waits MIN_GAP_MS between reports and stops at MAX_PER_PAGE", () => {
    const s = senderAt();
    expect(reportCrash(new Error("first"), "error", s.sender)).toBe(true);
    expect(reportCrash(new Error("too soon"), "error", s.sender)).toBe(false);
    for (let i = 0; i < 50; i++) {
      s.advance(MIN_GAP_MS);
      reportCrash(new Error(`distinct ${String.fromCharCode(97 + (i % 26))}${i}`), "error", s.sender);
    }
    expect(s.sent).toHaveLength(MAX_PER_PAGE);
  });

  it("never throws, even when sending does", () => {
    expect(reportCrash(new Error("x"), "error", { now: () => 5, send: () => { throw new Error("offline"); } })).toBe(false);
  });
});

describe("installCrashReporting", () => {
  it("tells neither a chunk that did not arrive (the page reloads for it) nor a fetch the network dropped", () => {
    const listeners = new Map<string, (ev: Event) => void>();
    const target = { addEventListener: (type: string, fn: (ev: Event) => void) => listeners.set(type, fn) } as unknown as Window;
    const s = senderAt();
    installCrashReporting(target, s.sender);
    const stale = new TypeError("Failed to fetch dynamically imported module: https://village.example/assets/Quests-abc123.js");
    listeners.get("unhandledrejection")!({ reason: stale } as unknown as Event);
    listeners.get("error")!({ message: stale.message, error: stale } as unknown as Event);
    listeners.get("unhandledrejection")!({ reason: new Error("copy part a1b2c3d4e5f6: 404") } as unknown as Event);
    listeners.get("unhandledrejection")!({ reason: new TypeError("Failed to fetch") } as unknown as Event);
    listeners.get("unhandledrejection")!({ reason: new TypeError("Load failed") } as unknown as Event);
    listeners.get("unhandledrejection")!({ reason: new TypeError("NetworkError when attempting to fetch resource.") } as unknown as Event);
    expect(s.sent).toHaveLength(0);
    // A real error that only mentions a fetch is still told.
    listeners.get("unhandledrejection")!({ reason: new Error("Failed to fetch the quest list: 500") } as unknown as Event);
    expect(s.sent.map((r) => r.message)).toEqual(["Failed to fetch the quest list: 500"]);
  });

  it("reports a window error and an unhandled rejection, and ignores noise", () => {
    const listeners = new Map<string, (ev: Event) => void>();
    const target = { addEventListener: (type: string, fn: (ev: Event) => void) => listeners.set(type, fn) } as unknown as Window;
    const s = senderAt();
    installCrashReporting(target, s.sender);
    listeners.get("error")!({ message: "Script error.", error: null } as unknown as Event);
    listeners.get("error")!({ message: "ResizeObserver loop completed with undelivered notifications.", error: null } as unknown as Event);
    listeners.get("error")!({ type: "error" } as unknown as Event);
    expect(s.sent).toHaveLength(0);
    listeners.get("error")!({ message: "boom", error: new TypeError("boom") } as unknown as Event);
    s.advance(MIN_GAP_MS);
    listeners.get("unhandledrejection")!({ reason: new Error("lost promise") } as unknown as Event);
    expect(s.sent.map((r) => [r.source, r.message])).toEqual([
      ["error", "boom"],
      ["rejection", "lost promise"],
    ]);
  });
});

it("sends with no credentials when it falls back to fetch", () => {
  const fetchSpy = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchSpy);
  vi.stubGlobal("navigator", { userAgent: IPHONE });
  try {
    expect(reportCrash(new Error("via fetch"), "error")).toBe(true);
    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.credentials).toBe("omit");
    const body = JSON.parse(String(init.body));
    expect(Object.keys(body).sort()).toEqual([...CRASH_REPORT_FIELDS].sort());
  } finally {
    vi.unstubAllGlobals();
  }
});

describe("noise is never told, from any path (crash-alert sweep, 25 Nov 2026)", () => {
  const withStack = (message: string, stack: string) => Object.assign(new TypeError(message), { stack });

  it("the boundary's own path drops Safari's network drop, as the window listeners already did", () => {
    const s = senderAt();
    expect(reportCrash(new TypeError("Load failed"), "boundary", s.sender)).toBe(false);
    expect(reportCrash(new TypeError("Failed to fetch"), "boundary", s.sender)).toBe(false);
    expect(s.sent).toHaveLength(0);
  });

  it("drops an in-app browser's injected global failing in its own script", () => {
    const s = senderAt();
    const foreign = "@user-script:1:12\nglobal code@user-script:3:1";
    for (const message of [
      "undefined is not an object (evaluating 'window.ethereum.selectedAddress = undefined')",
      "Can't find variable: __firefox__",
      "undefined is not an object (evaluating 'window.__firefox__.reader')",
    ]) {
      expect(reportCrash(withStack(message, foreign), "error", s.sender), message).toBe(false);
      s.advance(MIN_GAP_MS);
    }
    expect(s.sent).toHaveLength(0);
  });

  it("CONTROL: the same global named from our own bundle is still told, and so is a real error", () => {
    const s = senderAt();
    const ours = "connectWallet@https://village.example.test/assets/Roles-B6yHa53f.js:4:2201";
    expect(reportCrash(withStack("undefined is not an object (evaluating 'window.ethereum.request')", ours), "boundary", s.sender)).toBe(true);
    s.advance(MIN_GAP_MS);
    expect(reportCrash(new ReferenceError("Cannot access uninitialized variable."), "boundary", s.sender)).toBe(true);
    s.advance(MIN_GAP_MS);
    // A real error that merely mentions a fetch is not the network drop.
    expect(reportCrash(new Error("Failed to fetch the roles: missing id"), "boundary", s.sender)).toBe(true);
    expect(s.sent.map((r) => r.message)).toEqual([
      "undefined is not an object (evaluating 'window.ethereum.request')",
      "Cannot access uninitialized variable.",
      "Failed to fetch the roles: missing id",
    ]);
  });
});
