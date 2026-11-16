/**
 * The hidden map's outbox: a place or a return visit logged with no signal
 * waits on this phone, photos and all, and goes up once there is signal.
 *
 * ── WHY ITS OWN STORE ─────────────────────────────────────────────────────
 *
 * The shared offline queue (`offlineQueue`, the protocols module) keeps JSON
 * in localStorage, which cannot hold photos: a handful of phone pictures is
 * more than the whole site's localStorage. So the hidden map keeps its
 * captures in IndexedDB, which holds Blobs. Only the SAFE copies are ever
 * stored: `makeSafe` has already re-encoded every photo before it reaches
 * here, so nothing on the phone's outbox carries a location in its metadata.
 *
 * ── WHAT A RESEND CAN AND CANNOT DUPLICATE ───────────────────────────────
 *
 * A pin carries the device's `clientId`, and the server writes a pin once per
 * client id, so a resend after a lost answer writes nothing twice. A visit is
 * the same. A pin's photos go up ONE AT A TIME after the pin exists, and each
 * leaves the outbox as soon as the server takes it, so a lost answer can
 * repeat at most the one photo that was in flight.
 *
 * ── WHO SEES IT ───────────────────────────────────────────────────────────
 *
 * Every item is filed under the member who made it. Another account signed in
 * on the same phone neither sees nor sends it. The member can see what is
 * waiting and discard any of it.
 *
 * No service worker is involved: the outbox sends from the open page, on
 * load, when the phone comes back online, when the tab returns, and on "Send
 * now". Opening the page itself with no signal is the offline shell's job.
 */
import type { PinDraft } from "./hiddenMapApi";
import type { Stage } from "@shared/hiddenMap";

export interface PinItem {
  kind: "pin";
  clientId: string;
  owner: string;
  createdAt: string;
  draft: PinDraft;
  photos: Blob[];
  /** Set once the server has the pin; the photos then follow it. */
  pinId?: string;
  /** The server's sentence when it refused this one. Kept for the member to read and discard. */
  refused?: string;
}

export interface VisitItem {
  kind: "visit";
  clientId: string;
  owner: string;
  createdAt: string;
  pinId: string;
  stageSeen: Stage | null;
  note: string;
  photos: Blob[];
  refused?: string;
}

export type OutboxItem = PinItem | VisitItem;

/** Where items live. IndexedDB in the browser; a Map in the tests. */
export interface OutboxStore {
  all(): Promise<OutboxItem[]>;
  put(item: OutboxItem): Promise<void>;
  remove(clientId: string): Promise<void>;
}

/** What the outbox calls to send. The page passes the real API; the tests pass fakes. */
export interface OutboxSender {
  createPin(draft: PinDraft): Promise<{ pin: { id: string } }>;
  addPhotos(pinId: string, photos: Blob[]): Promise<unknown>;
  addVisit(pinId: string, visit: { clientId: string; stageSeen: Stage | null; note: string }, photos: Blob[]): Promise<unknown>;
}

export interface FlushResult {
  sent: number;
  refused: number;
  waiting: number;
  /** True when the run stopped because the phone is offline or the server is unwell. */
  stopped: boolean;
}

/** A refusal the phone should not retry: the server said no to this item. */
function isRefusal(e: unknown): e is { status: number; message: string } {
  const s = (e as any)?.status;
  return typeof s === "number" && (s === 400 || s === 404 || s === 409 || s === 413 || s === 422);
}

export function outbox(store: OutboxStore) {
  const mine = async (owner: string) =>
    (await store.all()).filter((i) => i.owner === owner).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return {
    async add(item: OutboxItem): Promise<void> {
      await store.put(item);
    },
    pending: mine,
    async discard(owner: string, clientId: string): Promise<void> {
      const item = (await store.all()).find((i) => i.clientId === clientId);
      if (item && item.owner === owner) await store.remove(clientId);
    },
    /**
     * Send everything this member has waiting, oldest first. Stops at the first
     * failure that is not a refusal (no signal, the server unwell, signed out)
     * and keeps everything from there on.
     */
    async flush(owner: string, send: OutboxSender): Promise<FlushResult> {
      const out: FlushResult = { sent: 0, refused: 0, waiting: 0, stopped: false };
      const items = await mine(owner);
      for (let i = 0; i < items.length; i++) {
        const item = items[i]!;
        if (item.refused) {
          out.refused++;
          continue;
        }
        try {
          if (item.kind === "pin") {
            if (!item.pinId) {
              const made = await send.createPin(item.draft);
              item.pinId = made.pin.id;
              await store.put(item);
            }
            while (item.photos.length) {
              await send.addPhotos(item.pinId!, [item.photos[0]!]);
              item.photos = item.photos.slice(1);
              await store.put(item);
            }
          } else {
            await send.addVisit(item.pinId, { clientId: item.clientId, stageSeen: item.stageSeen, note: item.note }, item.photos);
          }
          await store.remove(item.clientId);
          out.sent++;
        } catch (e) {
          if (isRefusal(e)) {
            item.refused = (e as any).message || "This one was not accepted.";
            await store.put(item);
            out.refused++;
            continue;
          }
          // No signal, the server unwell, or the session ended (401): keep
          // this one and everything after it for the next run.
          out.stopped = true;
          out.waiting = items.length - i;
          break;
        }
      }
      if (!out.stopped) out.waiting = 0;
      return out;
    },
  };
}

// ── The IndexedDB store ───────────────────────────────────────────────────

const DB = "village-hidden-map";
const STORE = "outbox";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "clientId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => {
          db.close();
          resolve(req.result);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      }),
  );
}

/** The browser's store. Null where IndexedDB is missing or refused (some private windows): capture then needs signal. */
export function indexedDbStore(): OutboxStore | null {
  if (typeof indexedDB === "undefined") return null;
  return {
    all: () => run<OutboxItem[]>("readonly", (s) => s.getAll() as IDBRequest<OutboxItem[]>),
    put: (item) => run("readwrite", (s) => s.put(item)).then(() => undefined),
    remove: (clientId) => run("readwrite", (s) => s.delete(clientId)).then(() => undefined),
  };
}

/** An in-memory store, for tests and for a phone with no IndexedDB. */
export function memoryStore(): OutboxStore {
  const m = new Map<string, OutboxItem>();
  return {
    all: async () => Array.from(m.values()).map((i) => ({ ...i, photos: i.photos.slice() })),
    put: async (item) => { m.set(item.clientId, { ...item, photos: item.photos.slice() }); },
    remove: async (clientId) => { m.delete(clientId); },
  };
}

/** Whether an error means "no signal" rather than "the server said no". */
export function looksOffline(e: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  return e instanceof TypeError || (typeof (e as any)?.status === "number" && (e as any).status >= 500);
}
