// @vitest-environment jsdom
/**
 * /messages TO A NEWCOMER (the lead, 25 Nov 2026). Someone signed in whom the village has not admitted is told on
 * the page itself that messages are for members, and is never offered "New" or "message anyone here". A member's
 * inbox is unchanged, and a visitor still gets the sign-in card. Every name is made up.
 */
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

const STAGES = [{ id: "visitor" }, { id: "applicant" }, { id: "member" }];
const state = vi.hoisted(() => ({
  user: null as null | Record<string, unknown>,
  config: null as null | Record<string, unknown>,
}));
const messagingOn = { id: "messaging", lifecycle: "members" };
const modulesState = { loaded: true, failed: false, signInToSee: ["messaging"], modules: [messagingOn] };
vi.mock("@/modules/ModuleProvider", () => ({ useModules: () => modulesState, useModule: (id: string) => (id === "messaging" ? messagingOn : undefined) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: state.user, loading: false }) }));
vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/voice/VoiceArea", () => ({ default: () => null }));
vi.mock("@/lib/gameApi", () => ({
  authToken: () => (state.user ? "token" : null),
  useGameConfig: () => state.config,
  useVillageName: () => "Hollow Oak",
}));
vi.mock("@/hooks/useVillageName", () => ({ useVillageName: () => "Hollow Oak" }));

import Messages from "./Messages";

const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ conversations: [] }) }));

beforeEach(() => {
  state.config = { project: { name: "Hollow Oak" }, stages: STAGES };
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderAt = (path: string) => {
  const { hook } = memoryLocation({ path });
  return render(
    <Router hook={hook}>
      <Messages />
    </Router>,
  );
};

describe("/messages to a newcomer", () => {
  it("refuses on the page with the member-only words, and offers no way to start a message", async () => {
    state.user = { id: "u-new", name: "Wren", role: "user", membershipGranted: false, stageGranted: "applicant" };
    renderAt("/messages");
    expect(await screen.findByText("Messages are for members")).toBeTruthy();
    expect(document.querySelector("[data-messages-members-only]")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/message anyone here/);
    expect(screen.queryByRole("button", { name: /New/ })).toBeNull();
    expect(screen.getByRole("link", { name: "See my path" }).getAttribute("href")).toBe("/path");
    // The inbox is never asked for.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a thread address too", async () => {
    state.user = { id: "u-new", name: "Wren", role: "user", membershipGranted: false };
    renderAt("/messages/c-1");
    expect(await screen.findByText("Messages are for members")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("waits for the ladder before deciding, so a member admitted by stage never sees the refusal flash", () => {
    state.config = null;
    state.user = { id: "u-stage", name: "Ash", role: "user", stageGranted: "member" };
    renderAt("/messages");
    expect(screen.queryByText("Messages are for members")).toBeNull();
  });
});

describe("/messages to a member is unchanged", () => {
  it("draws the inbox with New, for a membership granted", async () => {
    state.user = { id: "u-mem", name: "Juno", role: "user", membershipGranted: true };
    renderAt("/messages");
    expect(await screen.findByRole("button", { name: /New/ })).toBeTruthy();
    expect(screen.queryByText("Messages are for members")).toBeNull();
    expect(fetchMock).toHaveBeenCalled();
  });

  it("draws the inbox for a member admitted by stage", async () => {
    state.user = { id: "u-stage", name: "Ash", role: "user", stageGranted: "member" };
    renderAt("/messages");
    expect(await screen.findByRole("button", { name: /New/ })).toBeTruthy();
    expect(screen.queryByText("Messages are for members")).toBeNull();
  });
});

describe("/messages to a visitor is unchanged", () => {
  it("offers the sign-in card, not the refusal", async () => {
    state.user = null;
    renderAt("/messages");
    expect(screen.queryByText("Messages are for members")).toBeNull();
    const signIn = Array.from(document.querySelectorAll("a[href]")).find((a) => (a.getAttribute("href") ?? "").startsWith("/login"));
    expect(signIn).toBeTruthy();
  });
});
