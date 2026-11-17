import { describe, expect, it } from "vitest";
import { roleApplicationRows, roleApplicationsSentence } from "./roleApplicationsWaiting";

const desk = {
  proposals: [
    { id: "op1", name: "Graham", roles: [{ name: "Legal, Finance & Structure Steward (Anchor Circle)" }], createdAt: "2026-11-16T10:00:00Z", confirmedAt: "2026-11-16T10:05:00Z" },
  ],
};
const members = {
  applications: [
    { id: "sa1", href: "/role-applications/sa1", status: "awaiting-holder", candidate: { name: "Ana" }, seats: [{ name: "Garden Steward" }], createdAt: "2026-11-14T09:00:00Z" },
    { id: "sa2", href: "/role-applications/sa2", status: "voting", candidate: { name: "Bo" }, seats: [{ name: "Kitchen Steward" }, { name: "Water Steward" }], createdAt: "2026-11-15T09:00:00Z" },
    { id: "sa3", status: "adopted", candidate: { name: "Done" }, seats: [{ name: "X" }], createdAt: "2026-11-01T09:00:00Z" },
    { id: "sa4", status: "withdrawn", candidate: { name: "Gone" }, seats: [{ name: "Y" }], createdAt: "2026-11-01T09:00:00Z" },
  ],
};

describe("role applications waiting", () => {
  it("lists both doors, open ones only, oldest first, each linking to its own page", () => {
    const rows = roleApplicationRows(desk, members);
    expect(rows.map((r) => r.id)).toEqual(["member:sa1", "member:sa2", "open:op1"]);
    expect(rows[2]).toMatchObject({ who: "Graham", role: "Legal, Finance & Structure Steward (Anchor Circle)", href: "/open-proposals/op1", kind: "no-account" });
    expect(rows[0]).toMatchObject({ who: "Ana", role: "Garden Steward", href: "/role-applications/sa1", status: "Waiting for a role holder" });
    expect(rows[1].role).toBe("Kitchen Steward, Water Steward");
    for (const row of rows) expect(row.when).not.toBe("Date not recorded");
  });

  it("reads a refused or broken source as nothing waiting there", () => {
    expect(roleApplicationRows(null, null)).toEqual([]);
    expect(roleApplicationRows({ error: "forbidden" } as never, members).map((r) => r.id)).toEqual(["member:sa1", "member:sa2"]);
    expect(roleApplicationRows(desk, { error: "members only" } as never).map((r) => r.id)).toEqual(["open:op1"]);
  });

  it("builds a member link from the id when the list carries no href", () => {
    const rows = roleApplicationRows(null, { applications: [{ id: "a b", status: "voting", seats: [] }] });
    expect(rows[0]).toMatchObject({ href: "/role-applications/a%20b", who: "A member", role: "A role", when: "Date not recorded" });
  });

  it("says the count in words", () => {
    expect(roleApplicationsSentence(1)).toBe("1 role application is waiting.");
    expect(roleApplicationsSentence(3)).toBe("3 role applications are waiting.");
  });
});
