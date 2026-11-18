/**
 * `guardedFetch`, the SSRF-guarded fetch in fetch's own shape (R169 / R111).
 *
 * The Saberra sync used to hand its client the global `fetch`, which checks
 * no address and follows every redirect. These pin what replaced it: every
 * hop is re-resolved and range checked BEFORE it is dialled, the connection
 * is pinned to the vetted address, 307/308 keep the method and body, 301-303
 * become a GET, and the bearer token never crosses to another origin.
 *
 * No network: DNS is mocked, and `https.request` is replaced with a scripted
 * fake that records every dial and answers from a queue.
 */
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

const lookupMock = vi.hoisted(() => vi.fn());
vi.mock("dns/promises", async (importOriginal) => {
  const real = (await importOriginal()) as any;
  const mod = real.default ?? real;
  return { ...real, default: { ...mod, lookup: (...a: any[]) => lookupMock(...a) } };
});

interface Dial {
  opts: any;
  body: string;
  pinned: unknown;
}
const state = vi.hoisted(() => ({
  dials: [] as any[],
  answers: [] as Array<{ status: number; headers?: Record<string, string>; body?: string }>,
}));
vi.mock("https", async (importOriginal) => {
  const real = (await importOriginal()) as any;
  const mod = real.default ?? real;
  const request = (opts: any, cb: (r: any) => void) => {
    const req = new EventEmitter() as any;
    const dial: Dial = { opts, body: "", pinned: null };
    opts.lookup?.(opts.hostname, { all: true }, (_e: unknown, a: unknown) => { dial.pinned = a; });
    state.dials.push(dial);
    req.write = (c: string | Uint8Array) => {
      (dial as any).raw = [...((dial as any).raw ?? []), c];
      dial.body += c;
    };
    req.destroy = () => undefined;
    req.end = () => {
      const next = state.answers.shift() ?? { status: 200, body: "{}" };
      const res = Readable.from([Buffer.from(next.body ?? "")]) as any;
      res.statusCode = next.status;
      res.headers = next.headers ?? {};
      queueMicrotask(() => cb(res));
    };
    return req;
  };
  return { ...real, default: { ...mod, request }, request };
});

import { guardedFetch } from "./toolcheck";

/** DNS for the test: each name answers the addresses given. */
function resolveAs(map: Record<string, string[]>) {
  lookupMock.mockImplementation(async (host: string) => {
    const addrs = map[host];
    if (!addrs) throw new Error(`ENOTFOUND ${host}`);
    return addrs.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));
  });
}

beforeEach(() => {
  state.dials = [];
  state.answers = [];
  lookupMock.mockReset();
  resolveAs({
    "service.example": ["93.184.216.34"],
    "other.example": ["8.8.4.4"],
    "rebind.example": ["127.0.0.1"],
    "metadata.example": ["169.254.169.254"],
    "nat64.example": ["64:ff9b::a9fe:a9fe"],
    "sixto4.example": ["2002:7f00:1::"],
    "mixed.example": ["93.184.216.34", "10.0.0.5"],
  });
});

const POST = { method: "POST", headers: { Authorization: "Bearer t0ken", "Content-Type": "application/json" }, body: '{"a":1}' };

describe("guardedFetch refuses a private address on every hop", () => {
  it.each(["rebind.example", "metadata.example", "nat64.example", "sixto4.example", "mixed.example"])(
    "refuses a first hop that resolves privately (%s), dialling nothing",
    async (host) => {
      await expect(guardedFetch(`https://${host}/mcp`, POST)).rejects.toThrow(/private address/);
      expect(state.dials).toHaveLength(0);
    },
  );

  it.each([
    "https://rebind.example/x",
    "https://169.254.169.254/latest/meta-data/",
    "https://[::ffff:7f00:1]/",
    "https://[64:ff9b::7f00:1]/",
    "https://[2002:a9fe:a9fe::]/",
  ])("follows no redirect to %s: the hop is refused before it is dialled", async (target) => {
    state.answers.push({ status: 307, headers: { location: target } });
    await expect(guardedFetch("https://service.example/mcp", POST)).rejects.toThrow(/private address/);
    expect(state.dials).toHaveLength(1);
    expect(state.dials[0].opts.hostname).toBe("service.example");
  });

  it("refuses plain http, first hop or redirected", async () => {
    await expect(guardedFetch("http://service.example/mcp", POST)).rejects.toThrow(/https only/);
    state.answers.push({ status: 302, headers: { location: "http://service.example/x" } });
    await expect(guardedFetch("https://service.example/mcp", POST)).rejects.toThrow(/https only/);
    expect(state.dials).toHaveLength(1);
  });

  it("stops after five redirects", async () => {
    for (let i = 0; i < 7; i++) state.answers.push({ status: 302, headers: { location: `/hop${i}` } });
    await expect(guardedFetch("https://service.example/", {})).rejects.toThrow(/too many redirects/);
    expect(state.dials).toHaveLength(6);
  });
});

describe("guardedFetch dials like fetch, pinned", () => {
  it("hands Node only the vetted address and keeps the name for SNI", async () => {
    state.answers.push({ status: 200, headers: { "mcp-session-id": "s1" }, body: "ok" });
    const res = await guardedFetch("https://service.example/mcp", POST);
    expect(res.status).toBe(200);
    expect(res.headers.get("mcp-session-id")).toBe("s1");
    expect(await res.text()).toBe("ok");
    const d = state.dials[0];
    expect(d.pinned).toEqual([{ address: "93.184.216.34", family: 4 }]);
    expect(d.opts.servername).toBe("service.example");
    expect(d.opts.method).toBe("POST");
    expect(d.body).toBe('{"a":1}');
    expect(d.opts.headers.authorization).toBe("Bearer t0ken");
  });

  it("sends a byte body exactly as given, with its byte length (a voice take's multipart upload)", async () => {
    const bytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x00, 0xff, 0xfe, 0x80, 0x0d, 0x0a]);
    state.answers.push({ status: 200, body: '{"text":"ok"}' });
    await guardedFetch("https://service.example/v1/audio/transcriptions", { method: "POST", headers: { "Content-Type": "multipart/form-data; boundary=x" }, body: bytes });
    const d = state.dials[0] as any;
    expect(d.opts.headers["content-length"]).toBe(String(bytes.length));
    expect(Buffer.concat(d.raw.map((c: any) => Buffer.from(c))).equals(Buffer.from(bytes))).toBe(true);
    // Anything else is still refused before a dial.
    await expect(guardedFetch("https://service.example/x", { method: "POST", body: new Blob(["x"]) as any })).rejects.toThrow(/string or byte bodies only/);
  });

  it("passes the caller's signal to the dial, so the 60 s deadline still cuts it", async () => {
    const ac = new AbortController();
    state.answers.push({ status: 200, body: "" });
    await guardedFetch("https://service.example/mcp", { ...POST, signal: ac.signal });
    expect(state.dials[0].opts.signal).toBe(ac.signal);
    ac.abort();
    await expect(guardedFetch("https://service.example/mcp", { ...POST, signal: ac.signal })).rejects.toThrow();
  });

  it("307 resends the method and body; the token stays on the same origin", async () => {
    state.answers.push({ status: 307, headers: { location: "/v2/mcp" } }, { status: 200, body: "{}" });
    await guardedFetch("https://service.example/mcp", POST);
    expect(state.dials[1].opts.method).toBe("POST");
    expect(state.dials[1].opts.path).toBe("/v2/mcp");
    expect(state.dials[1].body).toBe('{"a":1}');
    expect(state.dials[1].opts.headers.authorization).toBe("Bearer t0ken");
  });

  it("drops the bearer token the moment a redirect leaves the origin", async () => {
    state.answers.push({ status: 308, headers: { location: "https://other.example/mcp" } }, { status: 200, body: "{}" });
    await guardedFetch("https://service.example/mcp", POST);
    expect(state.dials[1].opts.hostname).toBe("other.example");
    expect(state.dials[1].opts.headers.authorization).toBeUndefined();
  });

  it("302 becomes a GET with no body, as fetch does", async () => {
    state.answers.push({ status: 302, headers: { location: "/moved" } }, { status: 200, body: "{}" });
    await guardedFetch("https://service.example/mcp", POST);
    expect(state.dials[1].opts.method).toBe("GET");
    expect(state.dials[1].body).toBe("");
    expect(state.dials[1].opts.headers["content-type"]).toBeUndefined();
  });

  it("streams the body back unread, so the caller's byte ceiling counts it", async () => {
    state.answers.push({ status: 200, body: "x".repeat(1000) });
    const res = await guardedFetch("https://service.example/mcp", POST);
    expect(res.body).not.toBeNull();
    const reader = res.body!.getReader();
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
    }
    expect(total).toBe(1000);
  });
});
