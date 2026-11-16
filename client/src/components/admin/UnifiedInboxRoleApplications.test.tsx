// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import UnifiedInbox from "./UnifiedInbox";

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, "", "/admin?tab=home");
});

describe("inbox role applications", () => {
  it("shows waiting role applications as an open section, whichever view is chosen", async () => {
    localStorage.setItem("admin.inboxView", "feedback");
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const u = String(url);
      if (u.endsWith("/admin/open-proposals")) return { ok: true, json: async () => ({ links: [], proposals: [{ id: "op1", name: "Graham", roles: [{ name: "Legal, Finance & Structure Steward (Anchor Circle)" }], confirmedAt: "2026-11-16T10:05:00Z" }] }) };
      if (u.endsWith("/submissions")) return { ok: true, json: async () => [] };
      return { ok: true, json: async () => ({}) };
    }));
    const { container } = render(<UnifiedInbox password="tok" onOpen={vi.fn()} />);
    expect(await screen.findByText("1 role application is waiting.")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Role applications" })).toBeTruthy();
    expect(screen.getByText("Graham").closest("a")?.getAttribute("href")).toBe("/open-proposals/op1");
    expect(container.querySelector("details")).toBeNull();
  });

  it("draws no section when nothing waits", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({}) })));
    render(<UnifiedInbox password="tok" onOpen={vi.fn()} />);
    expect(await screen.findByText("Nothing in this view.")).toBeTruthy();
    expect(screen.queryByText(/role application/)).toBeNull();
  });
});
