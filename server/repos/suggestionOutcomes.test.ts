/**
 * `recordOutcome` runs after a change has landed, so it must never turn an applied change into a
 * reported failure. No database here: a store that throws stands in for one that is down.
 */
import { describe, expect, it } from "vitest";
import { recordOutcome, type OutcomeInput } from "./suggestionOutcomes";

const outcome: OutcomeInput = {
  stream: "connector",
  sourceId: "sg_1",
  kind: "role_card",
  valueDigest: "0123456789abcdef",
  keys: [],
  proposerKind: "agent",
  outcome: "accepted",
  decidedByCapability: "story.tell",
  filedAt: "2026-11-25T10:00:00.000Z",
  decidedAt: "2026-11-25T10:05:00.000Z",
};

describe("recordOutcome", () => {
  it("answers false and logs, and never throws, when the store refuses the write", async () => {
    const said: string[] = [];
    const down = { query: async () => Promise.reject(new Error("connection lost")) } as never;
    await expect(recordOutcome(down, outcome, (m) => said.push(m))).resolves.toBe(false);
    expect(said).toHaveLength(1);
    expect(said[0]).toContain("was applied and its record was not written");
  });

  it("answers true when the store takes it, naming every column with a value", async () => {
    const calls: unknown[][] = [];
    const up = { query: async (sql: string, args: unknown[]) => (calls.push([sql, args]), [{ affectedRows: 1 }]) } as never;
    await expect(recordOutcome(up, outcome)).resolves.toBe(true);
    const [sql, args] = calls[0] as [string, unknown[]];
    expect((sql.match(/\?/g) ?? []).length).toBe(args.length);
    expect(args.every((a) => a !== undefined && a !== null)).toBe(true);
  });
});
