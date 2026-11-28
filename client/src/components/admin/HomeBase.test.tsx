// @vitest-environment jsdom
/**
 * Admin Home says ONE count (the Admin Garden plan, 27 Nov 2026): decisions waiting on you, as the server defines it
 * for the person reading, in the sentence /admin/review also says. Until then Home said "23 requests" in its card and
 * "184 things" in its list. Role applications are listed and never counted; a count that did not load says so.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import type { NavGroup } from "./adminNavGroups";

let me: { id: string } | null = { id: "u1" };
vi.mock("@/contexts/AuthContext", () => ({ useOptionalAuth: () => ({ loading: false, user: me }) }));

import HomeBase from "./HomeBase";

const groups = [{ title: "Day to day", items: [{ key: "submissions", label: "All Forms", icon: (() => null) as unknown as NavGroup["items"][number]["icon"] }] }] as NavGroup[];

const form = (n: number) => ({ key: `form:${n}`, source: "form", kind: "form_visit", code: null, summary: "Visit", filedAt: `2026-11-${String(10 + n).padStart(2, "0")}T10:00:00Z`, batch: null, decideAt: "/admin?tab=submissions", touchesPerson: true });

/** The list's answer as the server sends it: each kind's number, the rows, and the one count. */
function listAnswer(counts: { decisions: number; applications?: number; blocked?: number; unknown?: string[] }, items: { source: string }[] = []) {
  const sources = Array.from(new Set(items.map((i) => i.source)));
  return {
    sections: sources.map((source) => ({ source, state: "ok", count: items.filter((i) => i.source === source).length, atLeast: items.filter((i) => i.source === source).length, blocked: 0, more: false })),
    items,
    counts: { applications: 0, blocked: 0, unknown: [], waiting: items.length, ...counts },
  };
}

type Answers = { inbox?: unknown | null; launch?: unknown; openProposals?: unknown; roleApplications?: unknown };
let inboxReads = 0;
function serve(a: Answers = {}) {
  inboxReads = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const u = String(url);
    if (u.startsWith("/api/admin/review/inbox")) {
      inboxReads += 1;
      return a.inbox === null ? { ok: false, status: 500, json: async () => ({ error: "boom" }) } : { ok: true, status: 200, json: async () => a.inbox ?? listAnswer({ decisions: 0 }) };
    }
    if (u.endsWith("/admin/open-proposals")) return a.openProposals ? { ok: true, json: async () => a.openProposals } : { ok: false, json: async () => ({ error: "forbidden" }) };
    if (u.endsWith("/governance/role-applications")) return a.roleApplications ? { ok: true, json: async () => a.roleApplications } : { ok: false, json: async () => ({ error: "forbidden" }) };
    if (u.endsWith("/admin/launch")) return { ok: true, json: async () => a.launch ?? {} };
    return { ok: true, json: async () => ({}) };
  }));
}

const show = (onOpenTab = vi.fn()) => {
  render(<I18nProvider i18n={i18n}><HomeBase password="tok" onOpenTab={onOpenTab} groups={groups} /></I18nProvider>);
  return onOpenTab;
};
const count = () => document.querySelector("[data-home-count]")?.textContent;

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  localStorage.clear();
  me = { id: "u1" };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("home", () => {
  it("says the one count in the review page's own sentence, reads the list once, and can open the form list", async () => {
    serve({ inbox: listAnswer({ decisions: 3 }, [form(1), form(2), form(3)]) });
    const onOpenTab = show();
    await waitFor(() => expect(count()).toBe("3 decisions waiting on you."));
    expect(screen.getByText("Waiting")).toBeTruthy();
    // The sentence at the top says the same number, in the same word.
    expect(screen.getByText(/^3 decisions, /)).toBeTruthy();
    expect(await screen.findByText(/Updated /)).toBeTruthy();
    // Forms are on the list, so they are in the count and drawn as the list draws them.
    expect(screen.getByRole("heading", { name: "Forms to answer (3)" })).toBeTruthy();
    // One read of the list for the whole of Home: the card, the top sentence and the list below share it.
    expect(inboxReads).toBe(1);
    await userEvent.click(screen.getByRole("button", { name: /Inbox/ }));
    await userEvent.click(screen.getByRole("button", { name: /All forms/ }));
    expect(onOpenTab).toHaveBeenCalledWith("submissions");
    await userEvent.click(screen.getByRole("checkbox", { name: "Start on the form list instead" }));
    expect(localStorage.getItem("admin.homeBase")).toBe("0");
    expect(onOpenTab).toHaveBeenCalledWith("submissions");
  });

  it("says no second total: the old 'requests' and 'things' sentences are gone", async () => {
    serve({ inbox: listAnswer({ decisions: 2 }, [form(1), form(2)]) });
    show();
    await waitFor(() => expect(count()).toBe("2 decisions waiting on you."));
    expect(screen.queryByText(/requests? (is|are) waiting/)).toBeNull();
    expect(screen.queryByText(/things? (is|are) waiting on you/)).toBeNull();
  });

  it("lists waiting role applications from both doors, each linking to its page, and never counts them", async () => {
    serve({
      inbox: listAnswer({ decisions: 1, applications: 2 }, [form(1)]),
      openProposals: { links: [], proposals: [{ id: "op1", name: "Graham", roles: [{ name: "Legal, Finance & Structure Steward (Anchor Circle)" }], confirmedAt: "2026-11-16T10:05:00Z" }] },
      roleApplications: { applications: [
        { id: "sa1", href: "/role-applications/sa1", status: "awaiting-holder", candidate: { name: "Ana" }, seats: [{ name: "Garden Steward" }], createdAt: "2026-11-14T09:00:00Z" },
        { id: "sa2", href: "/role-applications/sa2", status: "adopted", candidate: { name: "Done" }, seats: [{ name: "X" }], createdAt: "2026-11-01T09:00:00Z" },
      ] },
    });
    show();
    await waitFor(() => expect(count()).toBe("1 decision waiting on you. 2 applications are listed, and are not counted."));
    expect(screen.getByText("2 role applications are waiting.")).toBeTruthy();
    expect(screen.getByText(/^1 decision, /)).toBeTruthy();
    const graham = screen.getByText("Graham").closest("a");
    expect(graham?.getAttribute("href")).toBe("/open-proposals/op1");
    expect(graham?.textContent).toContain("Legal, Finance & Structure Steward (Anchor Circle)");
    expect(screen.getByText("Ana").closest("a")?.getAttribute("href")).toBe("/role-applications/sa1");
    expect(screen.queryByText("Done")).toBeNull();
  });

  it("a count that did not load says so, never nothing waiting, and can be read again", async () => {
    serve({ inbox: null });
    show();
    await waitFor(() => expect(count()).toBe("The count of what is waiting on you did not load."));
    expect(screen.getByText("Waiting")).toBeTruthy();
    expect(screen.getByText(/^The count of decisions did not load, /)).toBeTruthy();
    expect(screen.queryByText("Nothing is waiting on you.")).toBeNull();
    expect(screen.queryByText("All clear")).toBeNull();
    serve({ inbox: listAnswer({ decisions: 1 }, [form(1)]) });
    await userEvent.click(screen.getAllByRole("button", { name: "Try again" })[0]);
    await waitFor(() => expect(count()).toBe("1 decision waiting on you."));
  });

  it("with a queue that did not load the number is a floor, and says so", async () => {
    const answer = listAnswer({ decisions: 1, unknown: ["quest"] }, [form(1)]);
    answer.sections.push({ source: "quest", state: "failed", count: null as unknown as number, atLeast: 0, blocked: 0, more: false });
    serve({ inbox: answer });
    show();
    await waitFor(() => expect(count()).toBe("At least 1 decision waiting on you. 1 queue did not load, so its number is unknown."));
  });

  it("still loads when the role application reads are refused, and says nothing is waiting only when the list is empty", async () => {
    serve();
    show();
    await waitFor(() => expect(count()).toBe("Nothing is waiting on you."));
    expect(screen.getByText("All clear")).toBeTruthy();
    expect(screen.queryByText(/role application/)).toBeNull();
  });

  it("no decisions and a blocked row: it is said beside the count, and all clear is not", async () => {
    serve({ inbox: listAnswer({ decisions: 0, blocked: 1 }, [{ ...form(1), source: "letter" }]) });
    show();
    await waitFor(() => expect(count()).toBe("0 decisions waiting on you. 1 blocked."));
    expect(screen.queryByText("All clear")).toBeNull();
    expect(screen.getByText(/^0 decisions, /)).toBeTruthy();
  });

  it("with nothing on the list, says what the village needs before it can open", async () => {
    serve({ launch: { blockingOpen: 1 } });
    show();
    await waitFor(() => expect(count()).toBe("1 thing needs you before the village can open."));
    expect(screen.getByText("Needs you")).toBeTruthy();
  });

  it("remembers this look with whose it was, and a second person on the device starts fresh", async () => {
    serve({ inbox: listAnswer({ decisions: 3 }, [form(1), form(2), form(3)]) });
    show();
    expect(await screen.findByText("First look on this device.")).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("admin.lastGlance") ?? "{}")).toMatchObject({ decisions: 3, who: "u1" });
    cleanup();
    // The same person again: the look is theirs to compare with.
    serve({ inbox: listAnswer({ decisions: 5 }, [form(1), form(2), form(3), form(4), form(5)]) });
    show();
    expect(await screen.findByText(/^2 more decisions since /)).toBeTruthy();
    cleanup();
    // Somebody else on the same device is never shown the first person's count.
    me = { id: "u2" };
    serve({ inbox: listAnswer({ decisions: 1 }, [form(1)]) });
    show();
    expect(await screen.findByText("First look on this device.")).toBeTruthy();
    expect(screen.queryByText(/since/)).toBeNull();
  });

  it("offers the role progress page right under the waiting role applications, even when none wait", async () => {
    serve();
    show();
    await waitFor(() => expect(count()).toBe("Nothing is waiting on you."));
    const door = screen.getByRole("link", { name: /See how roles are going/ });
    expect(door.getAttribute("href")).toBe("/admin/role-progress");
  });
});
