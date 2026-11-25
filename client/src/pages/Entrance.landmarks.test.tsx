// @vitest-environment jsdom
/**
 * The portal's screens draw inside the page's one <main> (the live probe, 25 Nov 2026): each used to render its own
 * <main> inside Layout's <main id="main">, which every gated page then reported as a nested and duplicate main
 * landmark. Layout is drawn here as the real one draws its landmark, so the count is the page's.
 */
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Router } from "wouter";

vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: ReactNode }) => <main id="main">{children}</main> }));
vi.mock("@/hooks/useVillageName", () => ({ useVillageName: () => "Hollow Oak" }));
vi.mock("@/lib/gameApi", () => ({ useVillageLinks: () => ({ siteUrl: "", eventsUrl: "", contactEmail: "", mailTo: () => "" }), TOKEN_KEY: "village-auth-token" }));
vi.mock("@/components/auth/GoogleSignInButton", () => ({ default: () => null }));

import Entrance, { KeepInTouch } from "./Entrance";
import EntranceCode from "./EntranceCode";

afterEach(() => cleanup());

describe("the portal's landmarks", () => {
  for (const [what, el] of [
    ["the entrance", <Entrance key="e" next="/roles" siteKey={null} />],
    ["the keep-in-touch question", <KeepInTouch key="k" village="Hollow Oak" goTo="/roles" />],
    ["the code step", <EntranceCode key="c" sentTo="wren@example.test" next="/roles" onChangeEmail={() => {}} />],
  ] as const) {
    it(`${what} draws one main landmark, the page's own`, () => {
      render(<Router>{el}</Router>);
      expect(document.querySelectorAll("main")).toHaveLength(1);
      expect(document.querySelector("main")?.id).toBe("main");
    });
  }
});
