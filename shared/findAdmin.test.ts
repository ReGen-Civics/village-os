/**
 * People and codes for an admin's search (shared/findAdmin.ts): a code reads the way the review page reads one, and
 * the roster joins the index without changing where an admitted member already lands. Invented people only.
 */
import { describe, expect, it } from "vitest";
import { FIND_ROSTER_URL, findCode, findCodePath, withRoster, type RosterPerson } from "./findAdmin";
import { rankFind, type FindEntry } from "./findAnything";
import { normalizeCode } from "./proposedChanges";

describe("a review code", () => {
  it("reads exactly as the review page reads it", () => {
    for (const raw of ["b27", "B 27", "b-27.2", "B-27.2", " B-71 ", "b 3 . 4", "B-0007", "b", "27", "B-27.", "bee", "B-27.2.1", "review", "", "B-1234567"]) {
      expect(findCode(raw), JSON.stringify(raw)).toBe(normalizeCode(raw));
    }
    expect(findCode("b27")).toBe("B-27");
    expect(findCode("b-27.2")).toBe("B-27.2");
    expect(findCode("garden")).toBeNull();
  });

  it("opens the review page's own lookup", () => {
    expect(findCodePath("B-27.2")).toBe("/admin/review?find=B-27.2");
  });
});

describe("the roster in an admin's search", () => {
  const index: FindEntry[] = [
    { id: "page:/quests", kind: "page", title: "Quests", help: "Work the village needs done.", path: "/quests" },
    { id: "person:ana-example", kind: "person", title: "Ana Example", help: "", path: "/profile/ana-example" },
  ];
  const roster: RosterPerson[] = [
    { id: "u1", name: "Ana Example", email: "ana@example.org", handle: "ana-example" },
    { id: "u2", name: "Ben Example", email: "ben@example.org", handle: null },
    { id: "u3", name: "  ", email: "nameless@example.org", handle: null },
  ];
  const out = withRoster(index, roster, "/admin?tab=players", "On the Players page");

  it("reads the Players page's own route, and no other", () => {
    expect(FIND_ROSTER_URL).toBe("/api/admin/players");
  });

  it("keeps an admitted member where they were and lets their address find them", () => {
    const ana = out.find((e) => e.id === "person:ana-example")!;
    expect(ana.path).toBe("/profile/ana-example");
    expect(rankFind("ana@example.org", out, 5)[0].entry.id).toBe("person:ana-example");
    expect(out.filter((e) => e.title === "Ana Example")).toHaveLength(1);
  });

  it("adds everybody else on the roster, landing on the Players page, and nobody without a name", () => {
    const ben = out.find((e) => e.id === "person:player:u2")!;
    expect(ben).toMatchObject({ kind: "person", title: "Ben Example", path: "/admin?tab=players", help: "On the Players page" });
    expect(rankFind("ben", out, 5)[0].entry.id).toBe("person:player:u2");
    expect(rankFind("ben@example.org", out, 5)[0].entry.id).toBe("person:player:u2");
    expect(out.some((e) => e.id === "person:player:u3")).toBe(false);
  });

  it("leaves the index it was given untouched, and every other entry as it was", () => {
    expect(index[1].synonyms).toBeUndefined();
    expect(out[0]).toBe(index[0]);
  });
});
