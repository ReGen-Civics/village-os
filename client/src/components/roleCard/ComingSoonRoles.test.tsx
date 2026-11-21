// @vitest-environment jsdom
/**
 * "Hear when a role opens" (the lead, 19 Nov 2026): each coming-soon card has its anchor and the approved notice,
 * "Join the waitlist" opens the form, and `#waitlist-<id>` opens that role's form on arrival. Since 21 Nov 2026 the
 * group is "Upcoming roles", the third on /roles, each card its own framed panel.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import ComingSoonRoles from "./ComingSoonRoles";

const ROLES = [{ id: "garden", name: "Garden Steward", aim: "Grow food" }, { id: "kitchen", name: "Kitchen Steward" }];

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/roles");
  vi.unstubAllGlobals();
});

describe("the coming-soon roles", () => {
  it("draws each card with its anchor and the notice, in its own frame, and opens the form on Join the waitlist", async () => {
    render(<ComingSoonRoles roles={ROLES} />);
    expect(screen.getByRole("heading", { level: 2, name: "Upcoming roles (2)" })).toBeTruthy();
    const garden = document.getElementById("role-garden") as HTMLElement;
    expect(garden.textContent).toContain("This role is not open yet, and the card may change before it opens.");
    // One framed panel per role (the lead, 21 Nov 2026).
    expect(garden.className).toContain("rounded-2xl");
    expect(garden.className).toContain("border");
    expect(garden.className).toContain("shadow-sm");
    expect(garden.querySelector('[data-apply-early="garden"]')?.getAttribute("href")).toBe("/propose-a-role?role=garden&early=1");
    expect(within(document.getElementById("role-kitchen") as HTMLElement).getByRole("button", { name: "Join the waitlist: Kitchen Steward" })).toBeTruthy();
    expect(document.querySelector("[data-waitlist-form]")).toBeNull();
    fireEvent.click(document.querySelector('[data-waitlist-open="kitchen"]') as HTMLElement);
    await waitFor(() => expect(document.querySelector("[data-waitlist-form]")).toBeTruthy());
    expect((screen.getByLabelText("Kitchen Steward") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Garden Steward") as HTMLInputElement).checked).toBe(false);
  });

  it("opens the named role's form from the hash, leaves the consent tick unticked, and says thank you once saved", async () => {
    window.history.replaceState(null, "", "/roles#waitlist-garden");
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ComingSoonRoles roles={ROLES} />);
    await waitFor(() => expect(document.querySelector("[data-waitlist-form]")).toBeTruthy());
    expect((screen.getByLabelText("Garden Steward") as HTMLInputElement).checked).toBe(true);
    // The tick is unticked by default.
    const tick = screen.getByLabelText(/Yes, write to me about this role/) as HTMLInputElement;
    expect(tick.checked).toBe(false);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ana@example.org" } });
    fireEvent.click(screen.getByRole("button", { name: "Notify me" }));
    await waitFor(() => expect(document.querySelector("[data-waitlist-done]")).toBeTruthy());
    // Signing up without the tick works, sends consent false, and promises no letters.
    expect(document.querySelector("[data-waitlist-done]")?.textContent).toContain("We will not write to you");
    expect(JSON.parse(String((fetchMock.mock.calls[0] as any)[1].body))).toEqual({ email: "ana@example.org", whatsapp: "", roleIds: ["garden"], consent: false });
  });

  it("sends consent true only when the person ticks, and then promises a letter", async () => {
    window.history.replaceState(null, "", "/roles#waitlist-garden");
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ComingSoonRoles roles={ROLES} />);
    await waitFor(() => expect(document.querySelector("[data-waitlist-form]")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ben@example.org" } });
    fireEvent.click(screen.getByLabelText(/Yes, write to me about this role/));
    fireEvent.click(screen.getByRole("button", { name: "Notify me" }));
    await waitFor(() => expect(document.querySelector("[data-waitlist-done]")?.textContent).toBe("Thank you. Your details are saved. We will write when the role opens."));
    expect(JSON.parse(String((fetchMock.mock.calls[0] as any)[1].body)).consent).toBe(true);
  });
});
