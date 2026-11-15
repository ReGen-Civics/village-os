import { describe, expect, it } from "vitest";
// @ts-expect-error - scripts/ is untyped JavaScript, deliberately outside tsconfig
import { routes } from "../scripts/qa/routes.mjs";
import { clientRouteMatcher } from "./clientRoutes";

const derived = routes() as { concrete: string[]; parameterised: string[] };
const isPage = clientRouteMatcher([...derived.concrete, ...derived.parameterised]);

describe("which addresses a page draws, against the real router", () => {
  it("knows the key pages, a parameterised page, and a trailing slash", () => {
    for (const p of ["/", "/roles", "/roles/", "/propose-a-role", "/steward", "/quests/q-123", "/profile/some.one", "/ROLES", "/roles?from=home"]) {
      expect(isPage(p), p).toBe(true);
    }
  });

  it("knows no page for a mistyped or retired address", () => {
    for (const p of ["/no-such-page", "/rolez", "/roles/extra/segments", "/quests/a/b"]) {
      expect(isPage(p), p).toBe(false);
    }
  });

  it("treats a pattern's punctuation as text, never as a pattern", () => {
    const m = clientRouteMatcher(["/a.b", "/c+d"]);
    expect(m("/a.b")).toBe(true);
    expect(m("/axb")).toBe(false);
    expect(m("/ccd")).toBe(false);
  });
});
