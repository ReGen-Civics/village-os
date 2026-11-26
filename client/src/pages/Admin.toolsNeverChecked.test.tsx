// @vitest-environment jsdom
/**
 * A TOOL THAT HAS NEVER BEEN CHECKED DRAWS ITS ROW, AND THE TAB DOES NOT CRASH.
 *
 * The Tools tab's status dot took the tool as a parameter named `t`, which hid
 * lingui's `t` inside it. A tool with no `lastCheckedAt` then called the tool
 * object as a function for the "never checked" title, and the whole tab fell to
 * "This page didn't load". Found by the live-pass QA lane's admin walk.
 *
 * The positive is paired: a checked tool and a never-checked tool both draw
 * their names, so a tab that failed to render cannot pass this.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ToolsAdminTab } from "./Admin";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const TOOLS = {
  tools: [
    { id: "t1", name: "Seed Ledger", purpose: "Keeps seed records", url: "https://example.test/a", lastCheckedAt: null, lastCheckStatus: null },
    { id: "t2", name: "Water Board", purpose: "Shared water notes", url: "https://example.test/b", lastCheckedAt: "2026-11-20T10:00:00Z", lastCheckStatus: 200 },
  ],
};

describe("the Tools tab", () => {
  it("draws a tool that has never been checked, beside one that has", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.includes("/admin/tools")) return { status: 200, ok: true, json: async () => TOOLS };
        if (u.includes("/roles")) return { status: 200, ok: true, json: async () => [] };
        return { status: 404, ok: false, json: async () => ({}) };
      }),
    );
    render(<ToolsAdminTab password="pw" />);
    expect(await screen.findByText("Seed Ledger")).toBeTruthy();
    expect(screen.getByText("Water Board")).toBeTruthy();
    expect(screen.getByTitle("never checked")).toBeTruthy();
    expect(screen.getByTitle("HTTP 200")).toBeTruthy();
  });
});
