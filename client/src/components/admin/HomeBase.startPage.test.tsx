// @vitest-environment jsdom
/**
 * Two broken things on Admin Home (the running garden, 27 Nov 2026):
 *   - the start-page box never showed the saved choice;
 *   - "Mail settings" was listed twice.
 * A file of its own, so it holds whatever else Home's own suite is testing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { NavGroup } from "./adminNavGroups";

vi.mock("@/contexts/AuthContext", () => ({ useOptionalAuth: () => ({ loading: false, user: { id: "u1" } }) }));

import HomeBase from "./HomeBase";

const icon = (() => null) as unknown as NavGroup["items"][number]["icon"];
const groups = [{ title: "Day to day", items: [{ key: "submissions", label: "All Forms", icon }] }] as NavGroup[];

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("home: the start page box, and Mail settings listed once", () => {
  it("shows the start page this device saved: the box is ticked when the form list is the start page", async () => {
    // It drew unticked whatever was saved, so a person who had chosen the form list was shown the opposite.
    localStorage.setItem("admin.homeBase", "0");
    render(<HomeBase password="tok" onOpenTab={vi.fn()} groups={groups} />);
    const box = screen.getByRole("checkbox", { name: "Start on the form list instead" }) as HTMLInputElement;
    expect(box.checked).toBe(true);
    await userEvent.click(box);
    expect(box.checked).toBe(false);
    expect(localStorage.getItem("admin.homeBase")).toBe("1");
  });

  it("draws the box unticked when Home is the start page, and ticked once it is chosen", async () => {
    render(<HomeBase password="tok" onOpenTab={vi.fn()} groups={groups} />);
    const box = screen.getByRole("checkbox", { name: "Start on the form list instead" }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    await userEvent.click(box);
    expect(box.checked).toBe(true);
  });

  it("lists Mail settings once, with the mail tabs in the menu", async () => {
    const mail = [{ title: "Comms", items: [{ key: "comms-sent", label: "Sent mail", icon }, { key: "comms-settings", label: "Settings", icon }] }] as NavGroup[];
    const onOpenTab = vi.fn();
    render(<HomeBase password="tok" onOpenTab={onOpenTab} groups={mail} />);
    await userEvent.click(screen.getByRole("button", { name: /Events and messages/ }));
    const rows = screen.getAllByRole("button", { name: /Mail settings/ });
    expect(rows).toHaveLength(1);
    await userEvent.click(rows[0]);
    expect(onOpenTab).toHaveBeenCalledWith("comms-settings");
  });
});
