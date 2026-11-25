import { describe, expect, it } from "vitest";
import { namedSetters, UNNAMED_SETTER } from "./secretSetters";

describe("namedSetters", () => {
  const nameOf = async (id: string) => (id === "usr-abc" ? "Ana Steward" : null);

  it("shows a member's display name in place of their account id", async () => {
    const [s] = await namedSetters([{ key: "brevo_api_key", setBy: "usr-abc" }], nameOf);
    expect(s.setBy).toBe("Ana Steward");
  });

  it("falls back to an admin when no account answers", async () => {
    const [s] = await namedSetters([{ key: "k", setBy: "usr-gone" }], nameOf);
    expect(s.setBy).toBe(UNNAMED_SETTER);
  });

  it("falls back to an admin when the lookup throws", async () => {
    const [s] = await namedSetters([{ key: "k", setBy: "usr-abc" }], async () => {
      throw new Error("down");
    });
    expect(s.setBy).toBe(UNNAMED_SETTER);
  });

  it("leaves the store's own notes and an empty setter alone", async () => {
    const out = await namedSetters(
      [{ key: "a", setBy: "migration:entrance.x" }, { key: "b", setBy: "the old game variable x" }, { key: "c", setBy: null }],
      nameOf,
    );
    expect(out.map((s) => s.setBy)).toEqual(["migration:entrance.x", "the old game variable x", null]);
  });
});
