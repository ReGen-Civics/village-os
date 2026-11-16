// @vitest-environment jsdom
/**
 * The shared offline queue: a request stays on the device until a server
 * that said yes takes it off. Every case reads BOTH sides: what went out (the
 * real gameFetch, so the headers are real) and what is left in storage.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TOKEN_KEY } from "./gameApi";
import { QUEUE_KEY_PREFIX, flushWhenOnline, offlineQueue, readSnapshot, tokenOwner, writeSnapshot } from "./offlineQueue";

const ME = "usr-wren";
const OTHER = "usr-fen";

function tokenFor(userId: string): string {
  const claims = JSON.stringify({ userId, timestamp: 1, v: 0 });
  return `${btoa(claims).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}.sig`;
}

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  };
}

let store: ReturnType<typeof memoryStorage>;
let fetchMock: ReturnType<typeof vi.fn>;
let n = 0;
/** A fresh queue name per test, so the per-name instances never share state. */
const fresh = (opts?: { ordered?: boolean }) => offlineQueue(`t${++n}`, opts);

const answer = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const sentPaths = () => fetchMock.mock.calls.map(([url]) => String(url));

beforeEach(() => {
  store = memoryStorage();
  vi.stubGlobal("localStorage", store);
  store.setItem(TOKEN_KEY, tokenFor(ME));
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("enqueue and pending", () => {
  it("keeps a request on the device under its owner and its name", () => {
    const q = fresh();
    expect(q.enqueue(ME, { id: "req-0001", path: "/api/x", body: { a: 1 }, group: "g1" })).toEqual({ stored: true });
    expect(q.pending(ME).map((r) => [r.id, r.group, r.method])).toEqual([["req-0001", "g1", "POST"]]);
    expect(q.pending(OTHER)).toEqual([]);
    expect(store.getItem(`${QUEUE_KEY_PREFIX}${q.name}`)).toContain("req-0001");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses to hold a path outside the API on reading back", () => {
    const q = fresh();
    store.setItem(`${QUEUE_KEY_PREFIX}${q.name}`, JSON.stringify([{ id: "x", owner: ME, method: "POST", path: "https://elsewhere", body: {} }]));
    expect(q.pending(ME)).toEqual([]);
  });
});

describe("flush", () => {
  it("sends oldest first with the owner's token and the id as Idempotency-Key, and removes what was taken", async () => {
    const q = fresh();
    q.enqueue(ME, { id: "a-000001", path: "/api/one", body: {} });
    q.enqueue(ME, { id: "b-000002", path: "/api/two", body: {} });
    fetchMock.mockResolvedValue(answer(201));
    const r = await q.flush(ME);
    expect(r.sent).toEqual(["a-000001", "b-000002"]);
    expect(sentPaths()).toEqual(["/api/one", "/api/two"]);
    const headers = fetchMock.mock.calls[0]![1].headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe("a-000001");
    expect(headers.Authorization).toBe(`Bearer ${tokenFor(ME)}`);
    expect(q.pending(ME)).toEqual([]);
  });

  it("stops at no connection and keeps everything", async () => {
    const q = fresh();
    q.enqueue(ME, { id: "a-000001", path: "/api/one", body: {} });
    q.enqueue(ME, { id: "b-000002", path: "/api/two", body: {} });
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const r = await q.flush(ME);
    expect(r.offline).toBe(true);
    expect(r.kept).toEqual(["a-000001", "b-000002"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(q.pending(ME).map((x) => x.id)).toEqual(["a-000001", "b-000002"]);
    expect(q.pending(ME)[0]!.lastError).toBe("No connection.");
  });

  it("marks a 422 refused with the server's sentence and carries on with the next", async () => {
    const q = fresh();
    q.enqueue(ME, { id: "a-000001", path: "/api/one", body: {} });
    q.enqueue(ME, { id: "b-000002", path: "/api/two", body: {} });
    fetchMock.mockResolvedValueOnce(answer(422, { error: "Only the Keyholder can tick that." })).mockResolvedValueOnce(answer(201));
    const r = await q.flush(ME);
    expect(r.refused).toEqual(["a-000001"]);
    expect(r.sent).toEqual(["b-000002"]);
    const left = q.pending(ME);
    expect(left.map((x) => [x.id, x.refused, x.lastError])).toEqual([["a-000001", true, "Only the Keyholder can tick that."]]);
    // A refused request is not sent again by a plain flush.
    fetchMock.mockClear();
    await q.flush(ME);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("in an ordered queue a 5xx stops the run, so nothing overtakes it", async () => {
    const q = fresh({ ordered: true });
    q.enqueue(ME, { id: "a-000001", path: "/api/start", body: {} });
    q.enqueue(ME, { id: "b-000002", path: "/api/tick", body: {} });
    fetchMock.mockResolvedValue(answer(503));
    const r = await q.flush(ME);
    expect(sentPaths()).toEqual(["/api/start"]);
    expect(r.kept).toEqual(["a-000001", "b-000002"]);
  });

  it("an unordered queue carries on past a 5xx", async () => {
    const q = fresh();
    q.enqueue(ME, { id: "a-000001", path: "/api/one", body: {} });
    q.enqueue(ME, { id: "b-000002", path: "/api/two", body: {} });
    fetchMock.mockResolvedValueOnce(answer(500)).mockResolvedValueOnce(answer(201));
    const r = await q.flush(ME);
    expect(r.sent).toEqual(["b-000002"]);
    expect(r.kept).toEqual(["a-000001"]);
  });

  it("a 404 stops the run and keeps it (the module may be off for now)", async () => {
    const q = fresh();
    q.enqueue(ME, { id: "a-000001", path: "/api/one", body: {} });
    fetchMock.mockResolvedValue(answer(404, { error: "module_disabled" }));
    const r = await q.flush(ME);
    expect(r.kept).toEqual(["a-000001"]);
    expect(q.pending(ME)[0]!.refused).toBe(false);
  });

  it("sends nothing of one member's under another member's session", async () => {
    const q = fresh();
    q.enqueue(OTHER, { id: "a-000001", path: "/api/one", body: {} });
    store.setItem(TOKEN_KEY, tokenFor(ME));
    const r = await q.flush(OTHER);
    expect(r.sessionEnded).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(q.pending(OTHER)).toHaveLength(1);
  });

  it("stops the moment the stored token changes mid-run", async () => {
    const q = fresh();
    q.enqueue(ME, { id: "a-000001", path: "/api/one", body: {} });
    q.enqueue(ME, { id: "b-000002", path: "/api/two", body: {} });
    fetchMock.mockImplementationOnce(async () => {
      store.setItem(TOKEN_KEY, tokenFor(OTHER));
      return answer(201);
    });
    const r = await q.flush(ME);
    expect(r.sent).toEqual(["a-000001"]);
    expect(r.sessionEnded).toBe(true);
    expect(q.pending(ME).map((x) => x.id)).toEqual(["b-000002"]);
  });

  it("a hung send ends at its time limit and counts as no connection", async () => {
    vi.useFakeTimers();
    const q = offlineQueue(`t${++n}`, { timeoutMs: 1000 });
    q.enqueue(ME, { id: "a-000001", path: "/api/one", body: {} });
    fetchMock.mockReturnValue(new Promise(() => {}));
    const running = q.flush(ME);
    await vi.advanceTimersByTimeAsync(1001);
    const r = await running;
    expect(r.offline).toBe(true);
    expect(q.pending(ME)).toHaveLength(1);
  });

  it("retry sends a refused one again", async () => {
    const q = fresh();
    q.enqueue(ME, { id: "a-000001", path: "/api/one", body: {} });
    fetchMock.mockResolvedValueOnce(answer(400, { error: "no" }));
    await q.flush(ME);
    fetchMock.mockResolvedValueOnce(answer(201));
    const r = await q.retry(ME, "a-000001");
    expect(r.sent).toEqual(["a-000001"]);
    expect(q.pending(ME)).toEqual([]);
  });
});

describe("subscribe and flushWhenOnline", () => {
  it("tells a listener about a change in this tab", () => {
    const q = fresh();
    const seen = vi.fn();
    const stop = q.subscribe(seen);
    q.enqueue(ME, { id: "a-000001", path: "/api/one", body: {} });
    expect(seen).toHaveBeenCalled();
    stop();
    seen.mockClear();
    q.remove("a-000001");
    expect(seen).not.toHaveBeenCalled();
  });

  it("flushes when the connection comes back", async () => {
    const q = fresh();
    q.enqueue(ME, { id: "a-000001", path: "/api/one", body: {} });
    fetchMock.mockResolvedValue(answer(201));
    const done = vi.fn();
    const stop = flushWhenOnline(q, () => ME, done);
    window.dispatchEvent(new Event("online"));
    await vi.waitFor(() => expect(done).toHaveBeenCalled());
    expect(q.pending(ME)).toEqual([]);
    stop();
  });
});

describe("snapshots and token owners", () => {
  it("keeps one copy per member", () => {
    writeSnapshot("things", ME, { a: 1 });
    expect(readSnapshot<{ a: number }>("things", ME)?.value).toEqual({ a: 1 });
    expect(readSnapshot("things", OTHER)).toBeNull();
  });

  it("reads the member a token names, and nothing from a malformed one", () => {
    expect(tokenOwner(tokenFor(ME))).toBe(ME);
    expect(tokenOwner("nope")).toBeNull();
  });
});
