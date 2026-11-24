// @vitest-environment jsdom
/**
 * /sessions/season to someone the village has not admitted (the every-page audit, 24 Nov 2026): the season read
 * answers 403, and the page says live sessions are for members, as /sessions does. It said "The season did not load.
 * Try again in a moment." before, which sent a newcomer back to retry something that would never open for them.
 */
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SESSION_REFUSALS } from "@shared/sessions";

const state = vi.hoisted(() => ({ status: 403, auth: { user: { id: "usr-new", name: "New" }, loading: false }, modules: { loaded: true, failed: false, modules: [{ id: "sessions", lifecycle: "members" }] } }));
vi.mock("@/lib/gameApi", () => ({
  gameFetch: async () => new Response(JSON.stringify(state.status === 200 ? { view: null } : { error: "members only" }), { status: state.status, headers: { "Content-Type": "application/json" } }),
}));
vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => state.auth }));
vi.mock("@/modules/ModuleProvider", () => ({ useModules: () => state.modules, useModule: () => null }));
vi.mock("@/components/modules/ModuleGate", () => ({ default: () => <p>Module gate</p>, SignInToSee: () => <p>Sign in to see</p> }));
vi.mock("@/components/priorities/TeamWeek", () => ({ default: () => null }));
vi.mock("@/components/priorities/PriorityBoard", () => ({ default: () => null }));

import SessionSeason from "./SessionSeason";

describe("the season page to a newcomer", () => {
  beforeEach(() => cleanup());

  it("says live sessions are for members when the season read refuses, and never asks them to try again", async () => {
    state.status = 403;
    render(<SessionSeason />);
    expect(await screen.findByText(SESSION_REFUSALS.membersOnly)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("CONTROL: a server that fails still says the season did not load", async () => {
    state.status = 500;
    render(<SessionSeason />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText(SESSION_REFUSALS.membersOnly)).toBeNull();
  });
});
