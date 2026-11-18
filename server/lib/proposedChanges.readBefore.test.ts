/**
 * What an accept keeps as "live before" (readBefore, server/lib/proposedChanges.ts): the page's own read, null when
 * that read fails, and nothing at all for a kind that is never put back. No database: the routes are a fake `run`.
 */
import { describe, expect, it } from "vitest";
import type { Pool } from "mysql2/promise";
import { liveOf, readBefore, type KindDeps, type Run } from "./proposedChanges";

const deps = (): KindDeps => ({
  pool: {} as Pool,
  content: () => ({ "page-home": { hero: { headline: "Welcome home", badge: "Open" } } }),
  faqs: () => ({ steward: [{ id: "ste-1", question: "Who decides?", answer: "The circle." }] }),
  seasons: () => [],
  routeExists: () => true,
});

const reads: string[] = [];
const run =
  (status: number, body: unknown = { tagline: "Old words" }): Run =>
  async (method, path) => {
    reads.push(`${method} ${path}`);
    return { status, body };
  };

describe("readBefore", () => {
  it("keeps the same value the page shows as live", async () => {
    const page = await readBefore(deps(), run(200), "page_content", { section: "page-home" }, { hero: { headline: "New" } });
    expect(page).toEqual({ keep: true, value: { hero: { headline: "Welcome home", badge: "Open" } } });
    expect(page).toEqual({ keep: true, value: await liveOf(deps(), run(200), "page_content", { section: "page-home" }, { hero: { headline: "New" } }) });
    expect(await readBefore(deps(), run(200), "faq_edit", { pathway: "steward", id: "ste-1" }, { question: "q" })).toEqual({ keep: true, value: { question: "Who decides?", answer: "The circle." } });
  });

  it("a setting reads its route as the person, and keeps what it answered", async () => {
    reads.length = 0;
    expect(await readBefore(deps(), run(200), "setting", { method: "PUT", path: "/api/admin/brand" }, { tagline: "x" })).toEqual({ keep: true, value: { tagline: "Old words" } });
    expect(reads).toEqual(["GET /api/admin/brand"]);
  });

  it("a read that fails keeps null, and a read that throws keeps null without throwing", async () => {
    expect(await readBefore(deps(), run(500), "setting", { method: "PUT", path: "/api/admin/brand" }, {})).toEqual({ keep: true, value: null });
    const throws: Run = async () => {
      throw new Error("loopback down");
    };
    expect(await readBefore(deps(), throws, "setting", { method: "PUT", path: "/api/admin/brand" }, {})).toEqual({ keep: true, value: null });
    const broken: KindDeps = { ...deps(), content: () => { throw new Error("store down"); } };
    expect(await readBefore(broken, run(200), "page_content", { section: "page-home" }, {})).toEqual({ keep: true, value: null });
  });

  it("a kind that is never put back reads nothing at all", async () => {
    reads.length = 0;
    expect(await readBefore(deps(), run(200, [{ id: "e1" }]), "setting", { method: "POST", path: "/api/admin/events" }, { title: "Potluck" })).toEqual({ keep: false });
    expect(await readBefore(deps(), run(200), "faq_add", { pathway: "steward" }, { question: "q" })).toEqual({ keep: false });
    expect(await readBefore(deps(), run(200), "faq_remove", { pathway: "steward", id: "ste-1" }, {})).toEqual({ keep: false });
    expect(await readBefore(deps(), run(200), "season_goals", { seasonId: "s1" }, { goals: [] })).toEqual({ keep: false });
    expect(reads).toEqual([]);
  });
});
