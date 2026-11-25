// @vitest-environment jsdom
/**
 * A VISITOR READS WHAT THE VILLAGE LOOKS AFTER (the lead, 24 Nov 2026: a public /powers, first names only).
 * Signed out, the page asks the server without a token and draws every power, the role holding it and the
 * holders' first names, which is all a row carries. The raised hands and the suggestion line stay with members.
 * Every name and role here is invented.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
const auth = vi.hoisted(() => ({ user: null as null | { id: string; name: string }, token: "" }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock("@/lib/gameApi", () => ({
  authToken: () => auth.token,
  useCatalyst: () => ({ aNameCap: "A catalyst" }),
}));

import Powers from "./Powers";

const ROWS = {
  families: [{ id: "care", title: "Care of the commons" }],
  guidance: {},
  powers: [
    {
      capability: "story.tell", title: "Tell the village's story", surface: "", consequence: "change the public pages",
      movable: true, family: "care", guidance: null,
      heldBy: { roleName: "Story Keeper", byBallot: true, movedAt: "2026-11-01", people: ["Wren"] },
      heldToday: [], stage: null, suggestionsGoTo: "holders",
    },
  ],
};

const asked: Array<{ url: string; init?: RequestInit }> = [];
function serve() {
  asked.length = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    asked.push({ url, init });
    const body = url === "/api/village/powers" ? ROWS : { hands: [] };
    return { ok: true, json: async () => body } as Response;
  }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  auth.user = null;
  auth.token = "";
});

describe("the powers page", () => {
  it("draws every power, its role and the holders' first names for a visitor, with no token sent", async () => {
    serve();
    render(<Powers />);
    expect(await screen.findByText("Tell the village's story")).toBeTruthy();
    // A visitor reads the plain sentence (visitorHolderSentence), never "the admin panel".
    expect(screen.getByText("Story Keeper (Wren) looks after this.")).toBeTruthy();
    expect(screen.getByText("The village voted this one across.")).toBeTruthy();
    expect(screen.queryByText(/Sign in to see who looks after what/)).toBeNull();
    // Members' doors stay with members.
    expect(screen.queryByText(/A suggested change to this goes to/)).toBeNull();
    expect(asked.map((a) => a.url)).toEqual(["/api/village/powers"]);
    expect(asked[0].init).toBeUndefined();
  });

  it("CONTROL: a member still reads the suggestion line and asks with a token", async () => {
    auth.user = { id: "u1", name: "Wren Example" };
    auth.token = "tok";
    serve();
    render(<Powers />);
    expect(await screen.findByText("A suggested change to this goes to its holders to review.")).toBeTruthy();
    const read = asked.find((a) => a.url === "/api/village/powers");
    expect((read?.init?.headers as Record<string, string>)?.Authorization).toBe("Bearer tok");
  });
});

describe("the powers page is calm for a visitor (public launch, 24 Nov 2026)", () => {
  it("folds each theme shut for a visitor and opens it for a member", async () => {
    serve();
    const { container } = render(<Powers />);
    await screen.findByText("Tell the village's story");
    expect(container.querySelector("details")?.open).toBe(false);
    cleanup();
    auth.user = { id: "u1", name: "Wren Example" };
    auth.token = "tok";
    serve();
    const member = render(<Powers />);
    await screen.findByText("Tell the village's story");
    expect(member.container.querySelector("details")?.open).toBe(true);
  });

  it("keeps the handover mechanics and the admin panel's name off a visitor's page", async () => {
    serve();
    render(<Powers />);
    await screen.findByText("Tell the village's story");
    expect(screen.queryByText(/How a power moves/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/admin panel/i);
  });
});

/*
 * A FAILED READ IS SAID AS ONE (whole-app QA, 25 Nov 2026). The page used to set an empty list on a failed
 * read, so the reader met no powers and no sentence at all. It now says the page did not load and offers to
 * ask again, and never draws the list.
 */
describe("a powers list that could not be read", () => {
  it("says the page did not load, offers to try again, and draws no list", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }) as Response));
    render(<Powers />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("didn't load");
    expect(screen.getByRole("button", { name: /try again/i })).toBeTruthy();
    expect(screen.queryByTestId("powers-list")).toBeNull();
  });
});
