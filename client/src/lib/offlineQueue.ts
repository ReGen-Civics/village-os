/**
 * THE OFFLINE QUEUE: a request that has to reach the server, kept on this
 * device until it does.
 *
 * A small shared piece for any page a member uses where the signal comes and
 * goes: the protocols module first, other field modules after it. It is the
 * journal's outbox (lib/journalOutbox.ts) with the journal taken out, and it
 * keeps every rule that outbox paid for:
 *
 *  - ON THE DEVICE FIRST. `enqueue` writes the request to storage, and only a
 *    server that answered yes takes it off again. A tab closed mid-send, a
 *    phone out of signal, a server down: the request is still here.
 *  - SAFE TO SEND TWICE. Every request carries an id the device made, and the
 *    server endpoint behind a queue MUST treat a repeat of that id as a no-op.
 *    That is what makes "try again" the safe default.
 *  - WHOSE IT IS. Each request names the member who made it, and a flush sends
 *    only the signed-in member's own, with a token it proved is theirs, and
 *    stops the moment the stored token changes. A shared phone never posts
 *    one person's offline work under whoever signs in next.
 *  - A SEND THAT HANGS ENDS. A time limit per request; running out counts as
 *    no connection.
 *  - A REFUSAL IS NOT A RETRY. A 400 or 422 the server would give again marks
 *    the request refused, with the server's own sentence, and later requests
 *    carry on. A 401, 403, 404, 408, 409 or 429 stops the run and keeps
 *    everything for later. A 5xx keeps the request; in an `ordered` queue it
 *    also stops the run, so a later request never overtakes an earlier one.
 *  - IN ORDER. Oldest first, always.
 *
 * WHAT IT HOLDS. JSON bodies in localStorage, through safeStorage, under
 * `village.queue.<name>`. Keep bodies small: localStorage is a few megabytes
 * for the whole site, and a photo does not belong here. /reset keeps these
 * keys (lib/deviceReset.ts), because they are a member's unsent work.
 *
 * THE API, in full:
 *
 *   const q = offlineQueue("protocols", { ordered: true });
 *   q.enqueue(ownerId, { id, path: "/api/x", body: {...} })  -> { stored }
 *   q.pending(ownerId)                                        -> QueuedRequest[]
 *   q.flush(ownerId)                                          -> Promise<FlushResult>
 *   q.retry(ownerId, id)    // send a refused one again
 *   q.remove(id)            // drop one from the device
 *   q.subscribe(fn)         // re-read on any change, this tab or another
 *   flushWhenOnline(q, () => ownerId)   // flush on `online` and on return to the tab
 */
import { authToken, gameFetch } from "./gameApi";
import { readStoredJson, writeStoredJson } from "./safeStorage";

export const QUEUE_KEY_PREFIX = "village.queue.";
export const QUEUE_EVENT = "village-queue-changed";
export const QUEUE_SEND_TIMEOUT_MS = 20_000;

export interface QueuedRequest {
  /** Made on the device; the server's idempotency key. */
  id: string;
  /** The member who made it. Only their session ever sends it. */
  owner: string;
  method: "POST" | "PUT";
  path: string;
  body: unknown;
  /** Free label a page can filter by (a run id, say). */
  group: string | null;
  queuedAt: string;
  attempts: number;
  lastError: string | null;
  refused: boolean;
}

export interface FlushResult {
  sent: string[];
  kept: string[];
  refused: string[];
  /** The network failed, so the rest were not tried. */
  offline: boolean;
  /** The session ended or changed hands mid-run. */
  sessionEnded: boolean;
}

export interface EnqueueInput {
  id: string;
  path: string;
  body: unknown;
  method?: "POST" | "PUT";
  group?: string | null;
}

export interface OfflineQueue {
  readonly name: string;
  enqueue(owner: string, req: EnqueueInput): { stored: boolean };
  pending(owner: string): QueuedRequest[];
  flush(owner: string): Promise<FlushResult>;
  retry(owner: string, id: string): Promise<FlushResult>;
  remove(id: string): void;
  subscribe(listener: () => void): () => void;
}

export interface QueueOptions {
  /** A 5xx stops the run too, so later requests never overtake an earlier one. */
  ordered?: boolean;
  timeoutMs?: number;
}

function isRequest(v: unknown): v is QueuedRequest {
  if (!v || typeof v !== "object") return false;
  const r = v as Partial<QueuedRequest>;
  return (
    typeof r.id === "string" &&
    typeof r.owner === "string" &&
    typeof r.path === "string" &&
    r.path.startsWith("/api/") &&
    (r.method === "POST" || r.method === "PUT")
  );
}

/**
 * Whose session a token is. The token's own payload names its member; the
 * server checks the signature, and this only has to tell two members apart.
 * The same reading as the journal's outbox (`claimedUserId` there), kept here
 * so a page using the queue does not load the journal to send a request.
 */
export function tokenOwner(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  try {
    const b64 = token.slice(0, dot).replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as { userId?: unknown };
    const id = claims?.userId;
    return typeof id === "string" || typeof id === "number" ? String(id) : null;
  } catch {
    return null;
  }
}

/** A fresh id. Random enough that two devices never collide. */
export function newRequestId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `q-${Date.now().toString(36)}-${rand()}${rand()}`;
}

async function timed(send: (signal: AbortSignal) => Promise<Response>, ms: number): Promise<Response> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("timed out"));
    }, ms);
  });
  try {
    return await Promise.race([send(controller.signal), expired]);
  } finally {
    clearTimeout(timer);
  }
}

type Answer = { ok: true } | { ok: false; why: string; kind: "network" | "stop" | "retry" | "refused" | "session" };

function kindOf(status: number): Exclude<Answer, { ok: true }>["kind"] {
  if (status === 401) return "session";
  if (status === 403 || status === 404 || status === 408 || status === 409 || status === 429) return "stop";
  if (status >= 500) return "retry";
  return "refused";
}

/** The sentence a refusal carries: `{ error }` or `{ message }`, else the status. */
async function sentenceOf(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown; message?: unknown } | null;
    const s = typeof body?.error === "string" ? body.error : typeof body?.message === "string" ? body.message : "";
    if (s) return s;
  } catch {
    /* the status line is the whole answer */
  }
  return res.status === 401 ? "Sign in again to send it." : `The server answered ${res.status}.`;
}

const queues = new Map<string, OfflineQueue>();

/** The queue by name. One instance per name per page, so flushes never race each other. */
export function offlineQueue(name: string, opts: QueueOptions = {}): OfflineQueue {
  const existing = queues.get(name);
  if (existing) return existing;
  const q = createQueue(name, opts);
  queues.set(name, q);
  return q;
}

function createQueue(name: string, opts: QueueOptions): OfflineQueue {
  const key = QUEUE_KEY_PREFIX + name;
  const timeoutMs = opts.timeoutMs ?? QUEUE_SEND_TIMEOUT_MS;
  const inflight = new Map<string, Promise<FlushResult>>();

  const readAll = (): QueuedRequest[] => {
    const read = readStoredJson("local", key);
    if (read.status !== "value" || !Array.isArray(read.value)) return [];
    return read.value.filter(isRequest);
  };
  const writeAll = (items: QueuedRequest[]): boolean => {
    const ok = writeStoredJson("local", key, items).status === "saved";
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new CustomEvent(QUEUE_EVENT, { detail: { name } }));
    }
    return ok;
  };
  const update = (id: string, change: (r: QueuedRequest) => QueuedRequest) => {
    const all = readAll();
    let touched = false;
    const next = all.map((r) => {
      if (r.id !== id) return r;
      touched = true;
      return change(r);
    });
    if (touched) writeAll(next);
  };

  async function send(r: QueuedRequest, token: string): Promise<Answer> {
    let res: Response;
    try {
      res = await timed(
        (signal) =>
          gameFetch(r.path, {
            method: r.method,
            body: JSON.stringify(r.body ?? {}),
            headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": r.id },
            signal,
          }),
        timeoutMs,
      );
    } catch {
      return { ok: false, why: "No connection.", kind: "network" };
    }
    if (res.ok) return { ok: true };
    return { ok: false, why: await sentenceOf(res), kind: kindOf(res.status) };
  }

  async function runFlush(owner: string): Promise<FlushResult> {
    const result: FlushResult = { sent: [], kept: [], refused: [], offline: false, sessionEnded: false };
    const items = readAll().filter((r) => r.owner === owner && !r.refused);
    if (items.length === 0) return result;
    const keepFrom = (i: number) => {
      for (const later of items.slice(i)) result.kept.push(later.id);
    };
    const token = authToken();
    if (!token || tokenOwner(token) !== owner) {
      result.sessionEnded = true;
      keepFrom(0);
      return result;
    }
    for (let i = 0; i < items.length; i++) {
      if (authToken() !== token) {
        result.sessionEnded = true;
        keepFrom(i);
        break;
      }
      const id = items[i]!.id;
      const item = readAll().find((r) => r.id === id && !r.refused);
      if (!item) continue;
      const answer = await send(item, token);
      if (answer.ok) {
        writeAll(readAll().filter((r) => r.id !== id));
        result.sent.push(id);
        continue;
      }
      update(id, (r) => ({ ...r, attempts: r.attempts + 1, lastError: answer.why, refused: answer.kind === "refused" }));
      if (answer.kind === "refused") {
        result.refused.push(id);
        continue;
      }
      result.kept.push(id);
      if (answer.kind === "retry" && !opts.ordered) continue;
      if (answer.kind === "network") result.offline = true;
      if (answer.kind === "session") result.sessionEnded = true;
      keepFrom(i + 1);
      break;
    }
    return result;
  }

  function flush(owner: string): Promise<FlushResult> {
    const running = inflight.get(owner);
    if (running) return running;
    const run = runFlush(owner);
    inflight.set(owner, run);
    const clear = () => {
      if (inflight.get(owner) === run) inflight.delete(owner);
    };
    run.then(clear, clear);
    return run;
  }

  return {
    name,
    enqueue(owner, req) {
      const rest = readAll().filter((r) => r.id !== req.id);
      const item: QueuedRequest = {
        id: req.id,
        owner,
        method: req.method ?? "POST",
        path: req.path,
        body: req.body,
        group: req.group ?? null,
        queuedAt: new Date().toISOString(),
        attempts: 0,
        lastError: null,
        refused: false,
      };
      return { stored: writeAll([...rest, item]) };
    },
    pending(owner) {
      return readAll().filter((r) => r.owner === owner);
    },
    flush,
    async retry(owner, id) {
      update(id, (r) => (r.owner === owner ? { ...r, refused: false } : r));
      const first = await flush(owner);
      // A run already going when this was un-refused read the queue before it.
      if (readAll().some((r) => r.id === id && !r.refused) && !first.sent.includes(id) && !first.kept.includes(id)) {
        return flush(owner);
      }
      return first;
    },
    remove(id) {
      const all = readAll();
      const rest = all.filter((r) => r.id !== id);
      if (rest.length !== all.length) writeAll(rest);
    },
    subscribe(listener) {
      if (typeof window === "undefined") return () => {};
      const onChange = (e: Event) => {
        const detail = (e as CustomEvent<{ name?: string }>).detail;
        if (!detail || detail.name === name) listener();
      };
      const onStorage = (e: StorageEvent) => {
        if (e.key === null || e.key === key) listener();
      };
      window.addEventListener(QUEUE_EVENT, onChange);
      window.addEventListener("storage", onStorage);
      return () => {
        window.removeEventListener(QUEUE_EVENT, onChange);
        window.removeEventListener("storage", onStorage);
      };
    },
  };
}

/**
 * Flush whenever the connection comes back or the member returns to the tab.
 * `owner` is asked each time, so a sign-in change is honoured. Returns the
 * unsubscribe.
 */
export function flushWhenOnline(q: OfflineQueue, owner: () => string | null, onResult?: (r: FlushResult) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const go = () => {
    const who = owner();
    if (!who) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    void q.flush(who).then((r) => onResult?.(r), () => {});
  };
  const onVisible = () => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") go();
  };
  window.addEventListener("online", go);
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    window.removeEventListener("online", go);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

// ── Snapshots: what a page last read, kept per member for when there is no signal ──

export const SNAPSHOT_KEY_PREFIX = "village.offline.";

/** The last copy of `name` this member read, or null. */
export function readSnapshot<T>(name: string, owner: string): { savedAt: string; value: T } | null {
  const read = readStoredJson("local", `${SNAPSHOT_KEY_PREFIX}${name}.${owner}`);
  if (read.status !== "value" || !read.value || typeof read.value !== "object") return null;
  const v = read.value as { savedAt?: unknown; value?: unknown };
  return typeof v.savedAt === "string" ? { savedAt: v.savedAt, value: v.value as T } : null;
}

/** Keep a copy of `name` for this member. Returns whether the device kept it. */
export function writeSnapshot(name: string, owner: string, value: unknown): boolean {
  return writeStoredJson("local", `${SNAPSHOT_KEY_PREFIX}${name}.${owner}`, { savedAt: new Date().toISOString(), value }).status === "saved";
}
