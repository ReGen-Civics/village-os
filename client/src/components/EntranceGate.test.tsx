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
vi.mock("@/pages/Entrance", () => ({
  default: ({ next, siteKey }: { next: string; siteKey: string | null }) => <p data-testid="entrance">{`entrance:${next}:${siteKey ?? "none"}`}</p>,
  KeepInTouch: ({ goTo }: { goTo: string }) => <p data-testid="keep-in-touch">{`keep:${goTo}`}</p>,
}));
vi.mock("@/pages/EntranceCode", () => ({ default: ({ sentTo, next }: { sentTo: string; next: string }) => <p data-testid="code">{`code:${sentTo}:${next}`}</p> }));
vi.mock("@/hooks/useVillageName", () => ({ useVillageName: () => "Village" }));

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

  it("never asks on an open page: signing in, the legal pages", async () => {
    for (const p of ["/login", "/privacy"]) {
      at(p);
      expect(screen.getByTestId("page")).toBeInTheDocument();
      cleanup();
    }
    expect(asked).toBe(0);
  });

  it("stands in front of the home page too, and sends the visitor back to it", async () => {
    at("/");
    expect(await screen.findByTestId("entrance")).toHaveTextContent("entrance:/:none");
  });

  it("notes the pages an entered visitor opens, and never a member's", async () => {
    const posted: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/entrance/view") posted.push(JSON.parse(String(init?.body)).path);
      return { ok: true, json: async () => ({ required: true, entered: true, siteKey: null, visitor: true }) } as Response;
    }));
    at("/roles/community-steward");
    expect(await screen.findByTestId("page")).toBeInTheDocument();
    await waitFor(() => expect(posted).toEqual(["/roles/community-steward"]));
    cleanup();
    forgetEntranceStatus();
    posted.length = 0;
    auth.user = { id: "u1" };
    at("/roles");
    expect(screen.getByTestId("page")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 20));
    expect(posted).toEqual([]);
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

  it("lets a visitor with a code waiting look at pages until the look is spent, then asks on the next page", async () => {
    const look = { needsCode: true, startedAt: Date.now(), pages: 2, lookMs: 3 * 60 * 1000, lookPages: 3, sentTo: "ana@example.org" };
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ required: true, entered: true, siteKey: null, visitor: true, look }) }) as Response));
    const { hook, navigate } = memoryLocation({ path: "/roles", record: true });
    render(
      <Router hook={hook}>
        <EntranceGate waiting={<p data-testid="waiting">waiting</p>}>
          <p data-testid="page">page</p>
        </EntranceGate>
      </Router>,
    );
    // The third page of three: still open.
    expect(await screen.findByTestId("page")).toBeInTheDocument();
    // The fourth: the code, in place of the page, with the page kept to go back to.
    navigate("/circles");
    expect(await screen.findByTestId("code")).toHaveTextContent("code:ana@example.org:/circles");
  });

  it("asks for the code at once when the minutes ran out before this page", async () => {
    const look = { needsCode: true, startedAt: Date.now() - 4 * 60 * 1000, pages: 0, lookMs: 3 * 60 * 1000, lookPages: 3, sentTo: "ana@example.org" };
    status = { required: true, entered: true, siteKey: null, visitor: true, look };
    at("/roles");
    expect(await screen.findByTestId("code")).toBeInTheDocument();
  });

  it("asks the keep-in-touch question on the page a Google visitor lands on", async () => {
    status = { required: true, entered: true, siteKey: null, visitor: true, look: null };
    window.history.replaceState(null, "", "/roles?x=1&keep-in-touch=1");
    at("/roles");
    expect(await screen.findByTestId("keep-in-touch")).toHaveTextContent("keep:/roles?x=1");
    window.history.replaceState(null, "", "/");
  });
});
