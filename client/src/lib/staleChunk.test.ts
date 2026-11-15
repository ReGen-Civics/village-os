/**
 * A page that outlived a deploy reloads ONCE, and never loops.
 */
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import {
  RELOAD_MARKER,
  RELOAD_WINDOW_MS,
  installStaleChunkRecovery,
  isChunkLoadError,
  reloadOnceForStaleChunk,
  resetStaleChunkStateForTests,
  type MarkerStore,
  type RecoveryEnv,
} from "./staleChunk";

function memoryStore(): MarkerStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

/** A clock that moves on every read, as Date.now() does, so a second read can never stand in for the first. */
function env(store: MarkerStore | null, start = 1_000_000): RecoveryEnv & { reload: Mock<() => void> } {
  let t = start;
  return { store: () => store, reload: vi.fn<() => void>(), now: () => t++ };
}

afterEach(() => resetStaleChunkStateForTests());

describe("isChunkLoadError", () => {
  it("knows each engine's words for a chunk that did not arrive", () => {
    expect(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: https://x/assets/Map-abc.js"))).toBe(true);
    expect(isChunkLoadError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isChunkLoadError(new TypeError("error loading dynamically imported module: https://x/a.js"))).toBe(true);
    expect(isChunkLoadError(new Error("Unable to preload CSS for /assets/Map-abc.css"))).toBe(true);
    expect(isChunkLoadError({ name: "ChunkLoadError", message: "" })).toBe(true);
  });

  it("leaves an ordinary bug to the ordinary error page", () => {
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'name')"))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});

describe("reloadOnceForStaleChunk", () => {
  it("reloads the first time and writes the marker", () => {
    const store = memoryStore();
    const e = env(store);
    expect(reloadOnceForStaleChunk(e)).toBe(true);
    expect(e.reload).toHaveBeenCalledTimes(1);
    expect(store.data.get(RELOAD_MARKER)).toBe("1000000");
  });

  it("does not reload again after the page came back with the marker (no loop)", () => {
    const store = memoryStore();
    store.setItem(RELOAD_MARKER, String(1_000_000 - 5_000));
    const e = env(store);
    expect(reloadOnceForStaleChunk(e)).toBe(false);
    expect(e.reload).not.toHaveBeenCalled();
  });

  it("reloads again for a later deploy, once the window has passed", () => {
    const store = memoryStore();
    store.setItem(RELOAD_MARKER, String(1_000_000 - RELOAD_WINDOW_MS - 1));
    const e = env(store);
    expect(reloadOnceForStaleChunk(e)).toBe(true);
    expect(e.reload).toHaveBeenCalledTimes(1);
  });

  it("asks for one reload per page however many chunks fail", () => {
    const e = env(memoryStore());
    reloadOnceForStaleChunk(e);
    expect(reloadOnceForStaleChunk(e)).toBe(true);
    expect(e.reload).toHaveBeenCalledTimes(1);
  });

  it("never reloads when storage is missing, throws, or keeps nothing", () => {
    const none = env(null);
    expect(reloadOnceForStaleChunk(none)).toBe(false);

    const throwing = env({ getItem: () => { throw new Error("SecurityError"); }, setItem: () => {} });
    expect(reloadOnceForStaleChunk(throwing)).toBe(false);

    const forgetful = env({ getItem: () => null, setItem: () => {} });
    expect(reloadOnceForStaleChunk(forgetful)).toBe(false);

    for (const e of [none, throwing, forgetful]) expect(e.reload).not.toHaveBeenCalled();
  });
});

describe("installStaleChunkRecovery", () => {
  it("reloads on Vite's preload error, once", () => {
    const target = new EventTarget();
    const e = env(memoryStore());
    installStaleChunkRecovery(target as unknown as Window, e);
    target.dispatchEvent(Object.assign(new Event("vite:preloadError", { cancelable: true }), { payload: new TypeError("Failed to fetch dynamically imported module") }));
    target.dispatchEvent(new Event("vite:preloadError", { cancelable: true }));
    expect(e.reload).toHaveBeenCalledTimes(1);
  });
});

describe("offline is not an old build (performance QA sweep, resilience P2-4)", () => {
  it("never reloads while the browser says it is offline, and leaves no marker", () => {
    const store = memoryStore();
    const e = { ...env(store), online: () => false };
    expect(reloadOnceForStaleChunk(e)).toBe(false);
    expect(e.reload).not.toHaveBeenCalled();
    expect(store.getItem(RELOAD_MARKER)).toBeNull();
  });

  it("reloads once the connection is back (control)", () => {
    const e = { ...env(memoryStore()), online: () => true };
    expect(reloadOnceForStaleChunk(e)).toBe(true);
    expect(e.reload).toHaveBeenCalledTimes(1);
  });
});
