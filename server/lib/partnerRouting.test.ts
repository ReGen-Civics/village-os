import { describe, expect, it } from "vitest";
import { partnerRecipients } from "./partnerRouting";

const pool = {} as never;
const emails: Record<string, string> = { u1: "one@example.org", u2: "two@example.org", u3: "not an address" };
const base = {
  pool,
  emailOf: async (id: string) => emails[id] ?? null,
  fallback: () => ["business@example.org"],
};

describe("where a partner proposal goes (the lead, 23 Nov 2026)", () => {
  it("goes to the live holders of the role the village named, each address once", async () => {
    const holdersOf = async (_p: unknown, roleId: string) => (roleId === "r-partners" ? ["u1", "u2", "u2", "u3"] : []);
    expect(await partnerRecipients({ ...base, roleId: " r-partners ", holdersOf })).toEqual(["one@example.org", "two@example.org"]);
  });

  it("goes to the fallback with no role named, nobody holding it, or no address for any holder", async () => {
    const asked: string[] = [];
    const holdersOf = async (_p: unknown, roleId: string) => {
      asked.push(roleId);
      return roleId === "r-nobody-reachable" ? ["u3", "u9"] : [];
    };
    expect(await partnerRecipients({ ...base, roleId: "", holdersOf })).toEqual(["business@example.org"]);
    expect(asked).toEqual([]);
    expect(await partnerRecipients({ ...base, roleId: "r-empty", holdersOf })).toEqual(["business@example.org"]);
    expect(await partnerRecipients({ ...base, roleId: "r-nobody-reachable", holdersOf })).toEqual(["business@example.org"]);
  });
});
