// @vitest-environment jsdom
/**
 * WHAT YOU HAVE READ, on the member's own profile: How we work together, the day it was read, and the way back in.
 * Drawn only once there is a read; the read is asked for with the member's session.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Router } from "wouter";
import { TOKEN_KEY } from "@/lib/gameApi";
import HowWeWorkReadCard from "./HowWeWorkReadCard";

let readAt: string | null;
let auths: Array<string | null>;
beforeEach(() => {
  readAt = null;
  auths = [];
  window.localStorage.setItem(TOKEN_KEY, "t");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url) !== "/api/profile/how-we-work-read") return new Response("null", { status: 404 });
      auths.push(new Headers(init?.headers).get("authorization"));
      return new Response(JSON.stringify({ readAt }), { status: 200 });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.removeItem(TOKEN_KEY);
});

const draw = () =>
  render(
    <Router>
      <HowWeWorkReadCard />
    </Router>,
  );

describe("what you have read, on your profile", () => {
  it("lists How we work together as read, with the day and a link to read it again", async () => {
    readAt = "2026-11-27T10:00:00.000Z";
    draw();
    const row = await screen.findByTestId("read-how-we-work");
    expect(row).toHaveTextContent("How we work together");
    expect(row).toHaveTextContent(/Read on .*2026/);
    expect(screen.getByRole("link", { name: /Read it again/ }).getAttribute("href")).toBe("/governance/how#how-we-work");
    expect(auths).toEqual(["Bearer t"]);
  });

  it("draws nothing before the member has read it", async () => {
    const { container } = draw();
    await waitFor(() => expect(auths.length).toBe(1));
    expect(container.innerHTML).toBe("");
  });
});
