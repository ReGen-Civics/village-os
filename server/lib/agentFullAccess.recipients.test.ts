/**
 * WHO AN EMAIL SEND REACHES (the lead, 24 Nov 2026; server/lib/agentFullAccess.ts), for the branches that need no
 * database, and the record's mark. The letter, journey, message and waitlist branches read the comms tables; the
 * connector tests (server/lib/agentMcp.connectorPowers.test.ts) pin what the tool does with every answer they give.
 *
 *   holder    a test to the holder names their own address, and with no address there is no send
 *   waitlist  a waitlist letter with no role names nobody, so it is refused upstream
 *   mask      an address the platform has no name for is shown as its first letter and its domain
 *   record    every full-access write is recorded through recordEvent, marked as an agent's act on its holder's yes,
 *             with a send's recipients
 */
import type { Pool } from "mysql2/promise";
import { describe, expect, it } from "vitest";
import { FULL_ACCESS_MARK, fullAccessRecipients, maskAddress, recordFullAccessWrite } from "./agentFullAccess";

const NO_DB = { query: async () => { throw new Error("no database in this test"); } } as unknown as Pool;

describe("fullAccessRecipients, without a database", () => {
  it("names the holder's own address for a test to themselves", async () => {
    expect(await fullAccessRecipients(NO_DB, { name: "Fern Oak", email: "fern@example.test" }, { kind: "holder", params: {} }, undefined)).toEqual({
      to: "you, at fern@example.test",
      count: 1,
      names: ["Fern Oak"],
    });
  });

  it("names nobody when the holder has no address, or a waitlist letter has no role", async () => {
    expect(await fullAccessRecipients(NO_DB, { name: "Fern", email: " " }, { kind: "holder", params: {} }, undefined)).toBeNull();
    expect(await fullAccessRecipients(NO_DB, { name: "Fern", email: "fern@example.test" }, { kind: "waitlist", params: {} }, {})).toBeNull();
  });

  it("masks an address it has no name for", () => {
    expect(maskAddress("ana@example.test")).toBe("a...@example.test");
    expect(maskAddress("nobody")).toBe("an address without a name");
  });
});

describe("recordFullAccessWrite", () => {
  it("records through recordEvent as the agent, marked as made on its holder's yes, with the recipients", async () => {
    const seen: unknown[][] = [];
    const pool = { query: async (_sql: string, params: unknown[]) => { seen.push(params); return [[], []]; } } as unknown as Pool;
    await recordFullAccessWrite(pool, {
      agentUserId: "u-lead",
      tokenPrefix: "vat_abc",
      method: "POST",
      path: "/api/admin/comms/letters/l-1/send",
      summary: "Send the November letter.",
      approvedBy: "The lead",
      approvalNote: "Yes, send it.",
      recipients: { to: "the 12 people in this letter's audience", count: 12, names: [] },
    });
    expect(seen).toHaveLength(1);
    const [, kind, text, actor, actorKind] = seen[0] as string[];
    expect(kind).toBe("audit");
    expect(text).toContain(FULL_ACCESS_MARK);
    expect(text).toContain("Sent to the 12 people in this letter's audience (12).");
    expect(text).toContain('Approved by The lead: "Yes, send it."');
    expect(actor).toBe("u-lead");
    expect(actorKind).toBe("agent");
  });
});
