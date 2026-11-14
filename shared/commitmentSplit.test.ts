/**
 * One total across all of a member's roles, and the optional split of it
 * (Rye, 14 Nov 2026): shares of the total that add up to 100, kept only while
 * they name the roles held now, and how those roles are paid, read off the
 * agreements they came through.
 */
import { describe, expect, it } from "vitest";
import { evenSplit, readCommitmentInput, readCommitmentSplit, rolePayFold, shareOfYou, splitForRoles, storedCommitmentSplit } from "./commitment";

describe("reading a split", () => {
  it("reads shares that add up to 100, from a body or a stored string", () => {
    const split = [{ roleId: "a", share: 70 }, { roleId: "b", share: 30 }];
    expect(readCommitmentSplit(split)).toEqual({ ok: true, value: split });
    expect(readCommitmentSplit(JSON.stringify(split))).toEqual({ ok: true, value: split });
    expect(readCommitmentSplit([{ roleId: " a ", share: 100 }])).toEqual({ ok: true, value: [{ roleId: "a", share: 100 }] });
  });

  it("reads nothing said, and an empty list, as not split", () => {
    for (const raw of [null, undefined, "", []]) expect(readCommitmentSplit(raw)).toEqual({ ok: true, value: null });
  });

  it("refuses a split that misses the whole, repeats a role, or carries a part that is not a whole percent", () => {
    for (const raw of [
      [{ roleId: "a", share: 50 }],
      [{ roleId: "a", share: 60 }, { roleId: "b", share: 60 }],
      [{ roleId: "a", share: 50 }, { roleId: "a", share: 50 }],
      [{ roleId: "a", share: 99.5 }, { roleId: "b", share: 0.5 }],
      [{ roleId: "a", share: -10 }, { roleId: "b", share: 110 }],
      [{ share: 100 }],
      [{ roleId: "x".repeat(65), share: 100 }],
      Array.from({ length: 13 }, (_, i) => ({ roleId: `r${i}`, share: i === 0 ? 100 : 0 })),
      "{not json",
      { a: 100 },
    ]) {
      expect(readCommitmentSplit(raw).ok, JSON.stringify(raw)).toBe(false);
    }
  });

  it("a stored split that cannot be read is not split, never an error", () => {
    expect(storedCommitmentSplit("[{\"roleId\":\"a\",\"share\":40}]")).toBeNull();
    expect(storedCommitmentSplit("garbage")).toBeNull();
  });

  it("a member's word carries its split, and a bad split refuses the whole word", () => {
    const ok = readCommitmentInput({ pct: 50, split: [{ roleId: "a", share: 100 }] }, "2026-11-14");
    expect(ok.ok && ok.value.split).toEqual([{ roleId: "a", share: 100 }]);
    expect(readCommitmentInput({ pct: 50, split: [{ roleId: "a", share: 90 }] }, "2026-11-14").ok).toBe(false);
    const none = readCommitmentInput({ pct: 50 }, "2026-11-14");
    expect(none.ok && (none.value.split ?? null)).toBeNull();
  });
});

describe("the split, as the page shows it", () => {
  it("says a share as a part of the whole person: 60% of 50% is 30", () => {
    expect(shareOfYou(50, 60)).toBe(30);
    expect(shareOfYou(50, 33)).toBe(17);
    expect(shareOfYou(100, 25)).toBe(25);
  });

  it("splits evenly in whole percents that add to 100", () => {
    expect(evenSplit(["a", "b", "c"]).map((s) => s.share)).toEqual([34, 33, 33]);
    expect(evenSplit(["a", "b"]).map((s) => s.share)).toEqual([50, 50]);
    expect(evenSplit([])).toEqual([]);
    for (let n = 1; n <= 12; n++) expect(evenSplit(Array.from({ length: n }, (_, i) => `r${i}`)).reduce((s, x) => s + x.share, 0)).toBe(100);
  });

  it("keeps a saved split only while it names exactly the roles held, in the order they are listed", () => {
    const saved = [{ roleId: "b", share: 30 }, { roleId: "a", share: 70 }];
    expect(splitForRoles(saved, ["a", "b"])).toEqual([{ roleId: "a", share: 70 }, { roleId: "b", share: 30 }]);
    expect(splitForRoles(saved, ["a"])).toBeNull();
    expect(splitForRoles(saved, ["a", "b", "c"])).toBeNull();
    expect(splitForRoles(saved, ["a", "c"])).toBeNull();
    expect(splitForRoles(null, ["a"])).toBeNull();
  });
});

describe("how a member's roles are paid", () => {
  it("is one pay when every role came through the same agreement (Rye's case)", () => {
    expect(rolePayFold([{ heldThrough: "app-1" }, { heldThrough: "app-1" }, { heldThrough: "app-1" }])).toBe("together");
  });

  it("is apart when the roles came through two or more agreements", () => {
    expect(rolePayFold([{ heldThrough: "app-1" }, { heldThrough: "app-2" }])).toBe("apart");
  });

  it("is none when no agreement covers any role, and one agreement among direct seats is still one pay", () => {
    expect(rolePayFold([{ heldThrough: null }, {}])).toBe("none");
    expect(rolePayFold([])).toBe("none");
    expect(rolePayFold([{ heldThrough: "app-1" }, { heldThrough: null }])).toBe("together");
  });
});
