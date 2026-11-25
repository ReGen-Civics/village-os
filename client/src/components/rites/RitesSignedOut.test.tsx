// @vitest-environment jsdom
/**
 * A rites page to a visitor (the every-page audit, 24 Nov 2026): never a bare "Sign in" button. While the village
 * has the module off, the visitor is told the room is not open yet; while it is on, they get the module's sign-in
 * page, which names it and comes back here after.
 */
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const state = vi.hoisted(() => ({
  modules: { loaded: true, failed: false, signInToSee: [] as string[], modules: [] as Array<{ id: string; lifecycle: string }> },
  auth: { user: null, loading: false },
}));
vi.mock("@/modules/ModuleProvider", () => ({ useModules: () => state.modules, useModule: (id: string) => state.modules.modules.find((m) => m.id === id) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => state.auth }));
vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/lib/gameApi", () => ({ useGameConfig: () => ({ project: { name: "Hollow Oak" } }), useVillageName: () => "Hollow Oak" }));
vi.mock("@/hooks/useVillageName", () => ({ useVillageName: () => "Hollow Oak" }));

import RitesSignedOut from "./RitesSignedOut";

afterEach(() => cleanup());

describe("a rites page to a visitor", () => {
  it("while the module is off, says the room is not open yet, under the module's name", () => {
    state.modules = { loaded: true, failed: false, signInToSee: [], modules: [{ id: "rites", lifecycle: "off" }] };
    render(<RitesSignedOut next="/card" />);
    expect(screen.getByRole("heading", { level: 1, name: "Rites" })).toBeTruthy();
    expect(document.body.textContent).toMatch(/hasn't opened this room yet/);
    expect(screen.queryByRole("link", { name: /^Sign in$/ })).toBeNull();
  });

  it("while the module is on for members, offers the module's sign-in page with a heading and the way back", () => {
    state.modules = { loaded: true, failed: false, signInToSee: ["rites"], modules: [{ id: "rites", lifecycle: "members" }] };
    render(<RitesSignedOut next="/card" />);
    expect(screen.getByRole("heading", { level: 1, name: "Rites" })).toBeTruthy();
    const signIn = Array.from(document.querySelectorAll("a[href]")).find((a) => (a.getAttribute("href") ?? "").startsWith("/login"));
    expect(signIn?.getAttribute("href")).toContain(encodeURIComponent("/card"));
  });
});
