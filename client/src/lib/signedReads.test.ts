// @vitest-environment jsdom
/**
 * A bare read of the village's own API carries the stored sign-in, and nothing
 * else changes: other origins, deliberate anonymous reads, writes, and requests
 * that already name their own Authorization go as they were.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { installSignedReads, signInFor } from "./signedReads";

const O = "https://village.example";

describe("signInFor", () => {
  it("signs a bare read of the village's own API", () => {
    expect(signInFor("/api/season", undefined, "tok", O)).toBe("Bearer tok");
    expect(signInFor(`${O}/api/content/page-home`, { cache: "no-cache" }, "tok", O)).toBe("Bearer tok");
    expect(signInFor(new URL("/api/milestones", O), { method: "head" }, "tok", O)).toBe("Bearer tok");
    expect(signInFor(new Request(`${O}/api/archetypes`), undefined, "tok", O)).toBe("Bearer tok");
  });

  it("leaves everything else as it was", () => {
    expect(signInFor("/api/season", undefined, null, O)).toBeNull();
    expect(signInFor("https://elsewhere.example/api/season", undefined, "tok", O)).toBeNull();
    expect(signInFor("/roles", undefined, "tok", O)).toBeNull();
    expect(signInFor("/api/i18n/catalog/es", { credentials: "omit" }, "tok", O)).toBeNull();
    expect(signInFor("/api/nav/visit", { method: "POST" }, "tok", O)).toBeNull();
    expect(signInFor(new Request(`${O}/api/x`, { method: "DELETE" }), undefined, "tok", O)).toBeNull();
    expect(signInFor("/api/season", { headers: { Authorization: "Bearer other" } }, "tok", O)).toBeNull();
    expect(signInFor("/api/season", { headers: [["authorization", "Bearer other"]] }, "tok", O)).toBeNull();
  });
});

describe("installSignedReads", () => {
  let undo: () => void = () => {};
  afterEach(() => undo());

  it("adds the header on the way out and keeps the caller's own options", async () => {
    const seen = vi.fn(async (_i: RequestInfo | URL, _init?: RequestInit) => new Response("{}"));
    const real = window.fetch;
    window.fetch = seen as unknown as typeof fetch;
    undo = installSignedReads(() => "tok");
    await window.fetch("/api/season", { cache: "no-cache", headers: { Accept: "application/json" } });
    await window.fetch("/api/nav/visit", { method: "POST" });
    const [, first] = seen.mock.calls[0];
    expect(new Headers(first?.headers).get("authorization")).toBe("Bearer tok");
    expect(new Headers(first?.headers).get("accept")).toBe("application/json");
    expect(first?.cache).toBe("no-cache");
    expect(new Headers(seen.mock.calls[1][1]?.headers).get("authorization")).toBeNull();
    undo();
    expect(window.fetch).toBe(seen);
    window.fetch = real;
  });
});
