// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HomeBase from "./HomeBase";
import type { NavGroup } from "./adminNavGroups";

const groups = [{ title: "Day to day", items: [{ key: "submissions", label: "All Forms", icon: (() => null) as unknown as NavGroup["items"][number]["icon"] }] }] as NavGroup[];

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (String(url).endsWith("/submissions")) return { ok: true, json: async () => [{ id: "1" }, { id: "2" }, { id: "3" }] };
    return { ok: true, json: async () => ({ blockingOpen: 1 }) };
  }));
});

describe("home", () => {
  it("says what is waiting, in words, and can open the form list", async () => {
    const onOpenTab = vi.fn();
    render(<HomeBase password="tok" onOpenTab={onOpenTab} groups={groups} />);
    expect(await screen.findByText("3 requests are waiting.")).toBeTruthy();
    expect(screen.getByText("Waiting")).toBeTruthy();
    expect(await screen.findByText(/Updated /)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Inbox/ }));
    await userEvent.click(screen.getByRole("button", { name: /All forms/ }));
    expect(onOpenTab).toHaveBeenCalledWith("submissions");
    await userEvent.click(screen.getByRole("checkbox", { name: "Start on the form list instead" }));
    expect(localStorage.getItem("admin.homeBase")).toBe("0");
    expect(onOpenTab).toHaveBeenCalledWith("submissions");
  });

  it("does not count a form that has already been accepted", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).endsWith("/submissions")) {
        return { ok: true, json: async () => [{ id: "1", status: "new" }, { id: "2", status: "accepted" }, { id: "3", status: "declined" }] };
      }
      return { ok: true, json: async () => ({}) };
    }));
    render(<HomeBase password="tok" onOpenTab={vi.fn()} groups={groups} />);
    expect(await screen.findByText("1 request is waiting.")).toBeTruthy();
  });

  it("counts and lists waiting role applications from both doors, each linking to its page", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const u = String(url);
      if (u.endsWith("/submissions")) return { ok: true, json: async () => [{ id: "1", status: "new" }] };
      if (u.endsWith("/admin/open-proposals")) {
        return { ok: true, json: async () => ({ links: [], proposals: [{ id: "op1", name: "Graham", roles: [{ name: "Legal, Finance & Structure Steward (Anchor Circle)" }], confirmedAt: "2026-11-16T10:05:00Z" }] }) };
      }
      if (u.endsWith("/governance/role-applications")) {
        return { ok: true, json: async () => ({ applications: [
          { id: "sa1", href: "/role-applications/sa1", status: "awaiting-holder", candidate: { name: "Ana" }, seats: [{ name: "Garden Steward" }], createdAt: "2026-11-14T09:00:00Z" },
          { id: "sa2", href: "/role-applications/sa2", status: "adopted", candidate: { name: "Done" }, seats: [{ name: "X" }], createdAt: "2026-11-01T09:00:00Z" },
        ] }) };
      }
      return { ok: true, json: async () => ({}) };
    }));
    render(<HomeBase password="tok" onOpenTab={vi.fn()} groups={groups} />);
    expect(await screen.findByText("3 requests are waiting, 2 of them role applications.")).toBeTruthy();
    expect(screen.getByText("2 role applications are waiting.")).toBeTruthy();
    expect(screen.getByText(/^3 requests,/)).toBeTruthy();
    const graham = screen.getByText("Graham").closest("a");
    expect(graham?.getAttribute("href")).toBe("/open-proposals/op1");
    expect(graham?.textContent).toContain("Legal, Finance & Structure Steward (Anchor Circle)");
    expect(screen.getByText("Ana").closest("a")?.getAttribute("href")).toBe("/role-applications/sa1");
    expect(screen.queryByText("Done")).toBeNull();
  });

  it("still loads when the role application reads are refused", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const u = String(url);
      if (u.endsWith("/submissions")) return { ok: true, json: async () => [] };
      if (u.includes("open-proposals") || u.includes("role-applications")) return { ok: false, json: async () => ({ error: "forbidden" }) };
      return { ok: true, json: async () => ({}) };
    }));
    render(<HomeBase password="tok" onOpenTab={vi.fn()} groups={groups} />);
    expect(await screen.findByText("Nothing is waiting on you.")).toBeTruthy();
    expect(screen.queryByText(/role application/)).toBeNull();
  });

  it("names a single role application as one", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const u = String(url);
      if (u.endsWith("/submissions")) return { ok: true, json: async () => [] };
      if (u.endsWith("/admin/open-proposals")) return { ok: true, json: async () => ({ links: [], proposals: [{ id: "op1", name: "Graham", roles: [{ name: "Steward" }] }] }) };
      return { ok: true, json: async () => ({}) };
    }));
    render(<HomeBase password="tok" onOpenTab={vi.fn()} groups={groups} />);
    expect(await screen.findByText("1 request is waiting, a role application.")).toBeTruthy();
  });
});
