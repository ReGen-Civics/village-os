/**
 * /reset clears workers, caches and storage, and keeps every draft and the
 * sign-in (a link anybody can send must not sign a member out).
 */
import { describe, expect, it, vi } from "vitest";
import { draftKey } from "@/components/fireflyPath/applyDraft";
import { LEGACY_TOKEN_KEY, TOKEN_KEY } from "./gameApi";
import { isKeptKey, isSignInKey, resetDevice } from "./deviceReset";

/** A Web Storage stand-in with the same key(i)/length walk the reset uses. */
function memoryStorage(entries: Record<string, string>): Storage {
  const data = new Map(Object.entries(entries));
  return {
    get length() {
      return data.size;
    },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  };
}

const keys = (s: Storage) => Array.from({ length: s.length }, (_, i) => s.key(i));

describe("isKeptKey", () => {
  it("keeps the application form's device drafts, by the key the form writes", () => {
    expect(isKeptKey(draftKey("role-1", ""))).toBe(true);
    expect(isKeptKey(draftKey("role-1", "tok123"))).toBe(true);
  });

  it("keeps a journal sitting and its outbox, and any other draft", () => {
    expect(isKeptKey("village.journal.draft.user-7")).toBe(true);
    expect(isKeptKey("village.journal.outbox")).toBe(true);
    expect(isKeptKey("amora-work-with-us-draft")).toBe(true); // brand-ok: the work-with-us form's real key
  });

  it("keeps the sign-in, under the key now and the key it is moved from", () => {
    expect(isSignInKey(TOKEN_KEY)).toBe(true);
    expect(isSignInKey(LEGACY_TOKEN_KEY)).toBe(true);
    expect(isKeptKey(TOKEN_KEY)).toBe(true);
    expect(isKeptKey(LEGACY_TOKEN_KEY)).toBe(true);
  });

  it("clears the rest", () => {
    expect(isKeptKey("authToken")).toBe(false);
    expect(isKeptKey("village.journal.tab")).toBe(false);
    expect(isKeptKey("village.stale-chunk-reload")).toBe(false);
  });
});

describe("resetDevice", () => {
  it("unregisters every worker, deletes every cache and clears storage but the drafts", async () => {
    const unregister = vi.fn().mockResolvedValue(true);
    const getRegistrations = vi.fn().mockResolvedValue([{ unregister }, { unregister }]);
    const names = ["grounds-v1", "grounds-assets-v1", "old-shell"];
    const del = vi.fn().mockResolvedValue(true);
    const local = memoryStorage({
      authToken: "t",
      [TOKEN_KEY]: "session-token",
      "village.journal.tab": "write",
      [draftKey("role-1", "")]: "{\"why\":\"words\"}",
      "village.journal.draft.u1": "{}",
      "village.journal.outbox": "[]",
    });
    const session = memoryStorage({ "village.stale-chunk-reload": "1", "seraDraft": "x" });

    const result = await resetDevice({
      serviceWorker: { getRegistrations } as unknown as ServiceWorkerContainer,
      caches: { keys: vi.fn().mockResolvedValue(names), delete: del } as unknown as CacheStorage,
      local: () => local,
      session: () => session,
    });

    expect(unregister).toHaveBeenCalledTimes(2);
    expect(del.mock.calls.map((c) => c[0])).toEqual(names);
    expect(keys(local).sort()).toEqual(
      [TOKEN_KEY, draftKey("role-1", ""), "village.journal.draft.u1", "village.journal.outbox"].sort(),
    );
    expect(local.getItem(TOKEN_KEY)).toBe("session-token");
    expect(keys(session)).toEqual(["seraDraft"]);
    expect(result).toEqual({ workers: 2, caches: 3, cleared: 3, kept: 4, signedIn: true });
  });

  it("carries on past an API that is missing or refuses", async () => {
    const local = memoryStorage({ authToken: "t" });
    const result = await resetDevice({
      serviceWorker: { getRegistrations: vi.fn().mockRejectedValue(new Error("SecurityError")) } as unknown as ServiceWorkerContainer,
      caches: null,
      local: () => local,
      session: () => {
        throw new Error("blocked");
      },
    });
    expect(keys(local)).toEqual([]);
    expect(result).toEqual({ workers: 0, caches: 0, cleared: 1, kept: 0, signedIn: false });
  });
});
