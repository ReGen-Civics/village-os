/**
 * The old global assistant day (server/lib/assistantDayCap.ts) fails closed
 * (security audit, 15 Nov 2026): a limiter that cannot be read refuses the
 * Synthesize button with "try again shortly" and stops the batch tick.
 */
import { describe, expect, it } from "vitest";
import {
  ASSISTANT_DAY_MS,
  ASSISTANT_DAY_SPENT,
  ASSISTANT_DAY_UNREADABLE,
  assistantDayBucket,
  assistantDayCapPeek,
  assistantDayCapState,
  assistantDayRefusal,
} from "./assistantDayCap";

const NOW = new Date("2026-11-15T12:00:00Z");

describe("the global assistant day", () => {
  it("counts on the day's bucket, at the cap it is given", async () => {
    const asked: Array<[string, number, number]> = [];
    const state = await assistantDayCapState(async (b, m, w) => (asked.push([b, m, w]), "under"), 600, NOW);
    expect(state).toBe("under");
    expect(asked).toEqual([["assistant-day:2026-11-15", 600, ASSISTANT_DAY_MS]]);
    expect(assistantDayBucket(NOW)).toBe("assistant-day:2026-11-15");
  });

  it("passes the limiter's unavailable through, never reading it as room", async () => {
    expect(await assistantDayCapState(async () => "unavailable", 600, NOW)).toBe("unavailable");
  });

  it("the check-only peek reads a count it could not take as unavailable", async () => {
    expect(await assistantDayCapPeek(async () => null, 600, NOW)).toBe("unavailable");
    expect(await assistantDayCapPeek(async () => 600, 600, NOW)).toBe("over");
    expect(await assistantDayCapPeek(async () => 599, 600, NOW)).toBe("under");
  });

  it("the button refuses with try again shortly when unreadable, and with the spent day when over", () => {
    expect(assistantDayRefusal("unavailable")).toEqual({ status: 503, error: ASSISTANT_DAY_UNREADABLE });
    expect(ASSISTANT_DAY_UNREADABLE).toMatch(/Try again shortly/);
    expect(assistantDayRefusal("over")).toEqual({ status: 429, error: ASSISTANT_DAY_SPENT });
    expect(assistantDayRefusal("under")).toBeNull();
  });
});
