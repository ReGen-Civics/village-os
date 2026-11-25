/**
 * Today's card for one member (shared/myCard.ts): the browser's sky checked as a session pull checks it, the
 * member's own chart, and the session card's plain reading, for one person. Invented birth, real arithmetic.
 */
import { describe, expect, it, vi } from "vitest";
import { chartAt, skyAt, zonedToUtc } from "../../shared/geneKeysSky";
import { MY_CARD_REFUSALS } from "../../shared/myCard";

const chart = vi.fn();
vi.mock("./geneKeys", () => ({ ownChartOf: (...a: unknown[]) => chart(...a) }));

import { readMyCard } from "./myCard";

const WREN = chartAt(zonedToUtc(1990, 6, 15, 14, 30, "America/New_York"));
const SKY = skyAt(new Date("2024-08-05T17:00:00Z"));
const NOW = Date.parse(SKY.at);
const pool = {} as never;

describe("readMyCard", () => {
  it("reads the day and the member's own line, from their own chart only", async () => {
    chart.mockResolvedValueOnce(WREN);
    const out = await readMyCard(pool, "7", { sky: JSON.parse(JSON.stringify(SKY)) }, NOW);
    expect(chart).toHaveBeenCalledWith(pool, "7");
    if (!out.ok) throw new Error(out.error);
    expect(out.value.sky).toEqual(SKY);
    expect(out.value.day).toMatch(/^The day /);
    expect(out.value.line.length).toBeGreaterThan(20);
    expect(out.value.line).not.toMatch(/\byou two\b|\bWith \w+ you make/);
    expect(out.value.skyLines.western.length).toBeGreaterThan(0);
  });

  it("refuses a sky that was not read from the sky, before reading any chart", async () => {
    chart.mockClear();
    const out = await readMyCard(pool, "7", { sky: { ...SKY, moonPhase: 1.5 } }, NOW);
    expect(out).toEqual({ ok: false, status: 400, error: MY_CARD_REFUSALS.badSky });
    expect(chart).not.toHaveBeenCalled();
  });

  it("asks a member with no lines to find them first", async () => {
    chart.mockResolvedValueOnce(null);
    expect(await readMyCard(pool, "7", { sky: SKY }, NOW)).toEqual({ ok: false, status: 404, error: MY_CARD_REFUSALS.noLines });
  });
});
