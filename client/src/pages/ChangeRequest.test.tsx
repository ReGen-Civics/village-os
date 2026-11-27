// @vitest-environment jsdom
/**
 * ONE CHANGE REQUEST, under Decisions (the lead, 27 Nov 2026). Pinned: it reads its own change request from its
 * address, draws the Governance views with Decisions lit, shows the step it stands on, and the way back is the
 * Change requests section of Decisions. Signed out, it asks nothing.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import type { ReactNode } from "react";

const token = vi.hoisted(() => ({ value: "a-token" }));
vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/lib/gameApi", () => ({ authToken: () => token.value }));
vi.mock("@/components/voice/VoiceArea", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));

import ChangeRequestPage from "./ChangeRequest";

const CR = {
  id: "cr1",
  title: "Shorter quiet hours",
  why: "People sleep.",
  state: "in_review",
  revision: 2,
  relation: null,
  relatesTo: null,
  yours: false,
  author: "Ana",
  cap: 22,
  changes: [{ position: 0, key: "governance.vote_days", kind: "dial", label: "How long a ballot stays open", withheld: false, before: "7", after: "9", change: { key: "governance.vote_days", to: "9" } }],
  review: { endsAt: "2026-12-01T10:00:00.000Z", ready: false, checklist: [{ key: "changes", done: true, words: "1 change" }], consents: 1, notes: [] },
};

function show(path = "/governance/decisions/changes/cr1") {
  const { hook } = memoryLocation({ path });
  return render(
    <Router hook={hook}>
      <ChangeRequestPage />
    </Router>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  token.value = "a-token";
});

describe("one change request, under Decisions", () => {
  it("reads it from its address and shows where it stands, with Decisions lit", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(String(url));
        return { ok: true, status: 200, json: async () => CR };
      }),
    );
    show();
    expect(await screen.findByRole("heading", { level: 1, name: "Shorter quiet hours" })).toBeTruthy();
    expect(calls).toEqual(["/api/change-requests/cr1"]);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("2");
    expect(screen.getByRole("link", { name: "Decisions" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: /All change requests/ }).getAttribute("href")).toBe("/governance/decisions#changes");
    // The review is open to this reader: every way to take part is offered.
    expect(screen.getByRole("button", { name: "I can live with this" })).toBeTruthy();
  });

  it("asks nothing signed out, and offers the way in", () => {
    token.value = "";
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    show();
    expect(f).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login");
  });
});
