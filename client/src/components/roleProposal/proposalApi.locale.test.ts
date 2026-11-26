/**
 * The two role-proposal reads that carry a player card name the reader's language (X-Village-Locale), so the
 * server says the card in it (server/lib/platformSpeech.ts, through `cardOf`). English asks nothing, and no other
 * call names a language: an editor's own words are never read in another language.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchProposalCard, fetchShared, fetchMine } from "./proposalApi";

const calls: { url: string; headers: Record<string, string> }[] = [];
afterEach(() => {
  calls.length = 0;
  vi.unstubAllGlobals();
});

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    }),
  );
}

describe("the role-proposal reads that carry a card", () => {
  it("name a Spanish reader's language", async () => {
    stubFetch();
    await fetchShared("tok", "es");
    await fetchProposalCard("p-1", "es");
    expect(calls.map((c) => c.headers["X-Village-Locale"])).toEqual(["es", "es"]);
  });

  it("ask nothing for English, or with no language", async () => {
    stubFetch();
    await fetchShared("tok", "en");
    await fetchProposalCard("p-1");
    expect(calls.map((c) => c.headers["X-Village-Locale"])).toEqual([undefined, undefined]);
  });

  it("and no other call names one", async () => {
    stubFetch();
    await fetchMine();
    expect(calls[0].headers["X-Village-Locale"]).toBeUndefined();
  });
});
