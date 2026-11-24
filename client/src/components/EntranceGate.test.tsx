// @vitest-environment jsdom
/**
 * When the portal entrance stands in front of a page (components/EntranceGate.tsx): only on a path
 * behind it, only for a visitor who is not signed in and has not entered, and only while the
 * village keeps an entrance. The screen itself is stubbed; this is about the decision.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

const auth = vi.hoisted(() => ({ user: null as unknown, loading: false }));
vi.mock("@/contexts/AuthContext", () => ({ useOptionalAuth: () => auth }));
vi.mock("@/pages/Entrance", () => ({ default: ({ next, siteKey }: { next: string; siteKey: string | null }) => <p data-testid="entrance">{`entrance:${next}:${siteKey ?? "none"}`}</p> }));

import EntranceGate, { forgetEntranceStatus } from "./EntranceGate";

let status: unknown = { required: true, entered: false, siteKey: null };
let asked = 0;

beforeEach(() => {
  forgetEntranceStatus();
  auth.user = null;
  auth.loading = false;
  status = { required: true, entered: false, siteKey: null };
  asked = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url === "/api/entrance") asked += 1;
    return { ok: status !== null, json: async () => status } as Response;
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function at(path: string) {
  const { hook } = memoryLocation({ path });
  return render(
    <Router hook={hook}>
      <EntranceGate waiting={<p data-testid="waiting">waiting</p>}>
        <p data-testid="page">page</p>
      </EntranceGate>
    </Router>,
  );
}

describe("the entrance gate", () => {
  it("stands in front of a role for a visitor who has not entered, and remembers where they were going", async () => {
    at("/roles/community-steward");
    expect(await screen.findByTestId("entrance")).toHaveTextContent("entrance:/roles/community-steward:none");
    expect(screen.queryByTestId("page")).toBeNull();
  });

  it("never asks on a brochure page", async () => {
    at("/investor");
    expect(screen.getByTestId("page")).toBeInTheDocument();
    expect(asked).toBe(0);
  });

  it("lets a signed-in member straight through without asking", () => {
    auth.user = { id: "u1" };
    at("/roles");
    expect(screen.getByTestId("page")).toBeInTheDocument();
    expect(asked).toBe(0);
  });

  it("lets a visitor who has entered through", async () => {
    status = { required: true, entered: true, siteKey: null };
    at("/quests");
    expect(await screen.findByTestId("page")).toBeInTheDocument();
  });

  it("stands nowhere while the village keeps no entrance", async () => {
    status = { required: false, entered: true, siteKey: null };
    at("/roles");
    expect(await screen.findByTestId("page")).toBeInTheDocument();
  });

  it("falls through to the page when the status cannot be read, where the server's own refusal stands", async () => {
    status = null;
    at("/roles");
    await waitFor(() => expect(screen.getByTestId("page")).toBeInTheDocument());
  });

  it("waits while the session is still being read", () => {
    auth.loading = true;
    at("/roles");
    expect(screen.getByTestId("waiting")).toBeInTheDocument();
  });

  it("lets an invited guest onto the calendar with their gathering's pass, and nowhere else", async () => {
    status = { required: true, entered: false, siteKey: null, eventPass: "ev-1" };
    at("/events");
    expect(await screen.findByTestId("page")).toBeInTheDocument();
    cleanup();
    forgetEntranceStatus();
    at("/roles");
    expect(await screen.findByTestId("entrance")).toBeInTheDocument();
  });

  it("hands the Turnstile site key to the screen when the village has one", async () => {
    status = { required: true, entered: false, siteKey: "0x4AAA" };
    at("/circles");
    expect(await screen.findByTestId("entrance")).toHaveTextContent("entrance:/circles:0x4AAA");
  });
});
