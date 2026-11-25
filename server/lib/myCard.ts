/**
 * Today's card for one member (shared/myCard.ts says what it is). The sky comes from the browser and is
 * checked as a session pull checks it; the chart is the member's own; the reading is the session card's plain
 * builder. No row is written.
 */
import type { Pool } from "mysql2/promise";
import { parseSky, plainReading, readRoom, skyLines } from "../../shared/sessionCard";
import { MY_CARD_REFUSALS, type MyCard } from "../../shared/myCard";
import { ownChartOf } from "./geneKeys";

export type MyCardOutcome = { ok: true; value: MyCard } | { ok: false; status: number; error: string };

export async function readMyCard(pool: Pool, userId: string, body: unknown, now: number): Promise<MyCardOutcome> {
  const sky = parseSky((body as { sky?: unknown } | null)?.sky, now);
  if (!sky) return { ok: false, status: 400, error: MY_CARD_REFUSALS.badSky };
  const chart = await ownChartOf(pool, userId);
  if (!chart) return { ok: false, status: 404, error: MY_CARD_REFUSALS.noLines };
  const facts = readRoom([{ userId, name: "you", chart }], sky);
  const reading = plainReading(facts);
  const line = reading.lines[userId];
  if (!line) return { ok: false, status: 404, error: MY_CARD_REFUSALS.noLines };
  return {
    ok: true,
    value: {
      sky,
      day: reading.collective.find((c) => c.system === "western")?.text ?? "",
      line,
      skyLines: skyLines(facts),
    },
  };
}
