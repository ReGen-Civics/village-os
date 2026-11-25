// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { sameSitePath } from "./VisitorSignIn";

describe("sameSitePath", () => {
  it("keeps a path on this site", () => {
    expect(sameSitePath("/visitor")).toBe("/visitor");
    expect(sameSitePath("/roles/gate-keeper?x=1#a")).toBe("/roles/gate-keeper?x=1#a");
  });

  it("never names another site", () => {
    expect(sameSitePath("//evil.example/x")).toBe("/visitor");
    expect(sameSitePath("https://evil.example/x")).toBe("/visitor");
    // A browser reads "/\\" as "//", another site, so it falls back to the visit.
    expect(sameSitePath("/\\evil.example")).toBe("/visitor");
  });
});
