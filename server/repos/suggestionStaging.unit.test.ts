/**
 * A re-send of an open filing must be answered as the row already there. mysql2 connects with
 * CLIENT_FOUND_ROWS, so `INSERT ... ON DUPLICATE KEY UPDATE id = id` reports one affected row for a
 * duplicate as well as for an insert; the answer has to come from the row that holds the key.
 * No database: a store that behaves the way MySQL answers mysql2 stands in for one.
 */
import { describe, expect, it } from "vitest";
import { stageSuggestion, type StageInput } from "./suggestionStaging";

const input: StageInput = {
  stream: "connector",
  streamRef: "pc_1",
  filer: "agent-1",
  filerKind: "agent",
  kind: "role_card",
  target: { roleId: "water" },
  body: { words: { purpose: "Tends the springs." } },
  now: new Date("2026-11-25T10:00:00.000Z"),
};

/** One unique key, (stream, dedupe_key); every INSERT reports affectedRows 1, as CLIENT_FOUND_ROWS does. */
function store() {
  const byKey = new Map<string, string>();
  return {
    query: async (sql: string, args: unknown[]) => {
      if (sql.startsWith("INSERT INTO suggestion_staging")) {
        const key = `${args[1]}|${args[16]}`;
        if (!byKey.has(key)) byKey.set(key, String(args[0]));
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith("SELECT id FROM suggestion_staging")) {
        const id = byKey.get(`${args[0]}|${args[1]}`);
        return [id ? [{ id }] : []];
      }
      throw new Error(`unexpected query: ${sql}`);
    },
  };
}

describe("stageSuggestion", () => {
  it("answers a re-send as the row already there, even when the store reports a row affected", async () => {
    const db = store() as never;
    const first = await stageSuggestion(db, input);
    const again = await stageSuggestion(db, { ...input, streamRef: "pc_2" });
    expect(first.duplicate).toBe(false);
    expect(again).toEqual({ id: first.id, duplicate: true });
  });

  it("answers a different filer's identical value as a new row", async () => {
    const db = store() as never;
    const first = await stageSuggestion(db, input);
    const other = await stageSuggestion(db, { ...input, filer: "agent-2" });
    expect(other.duplicate).toBe(false);
    expect(other.id).not.toBe(first.id);
  });
});
