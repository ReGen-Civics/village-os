// @vitest-environment jsdom
/**
 * "Hear when a role opens" (the lead, 19 Nov 2026): each coming-soon card has its anchor and the approved notice,
 * "Notify me" opens the form, and `#waitlist-<id>` opens that role's form on arrival.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ComingSoonRoles from "./ComingSoonRoles";

const ROLES = [
  { id: "garden", name: "Garden Steward", seat: { id: "garden", name: "Garden Steward", aim: "Grow food", comingSoon: true, state: "forming" }, path: "/roles/garden-steward" },
  { id: "kitchen", name: "Kitchen Steward", seat: { id: "kitchen", name: "Kitchen Steward", comingSoon: true, state: "forming" }, path: "/roles/kitchen-steward" },
];

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/roles");
  vi.unstubAllGlobals();
});

describe("the coming-soon roles", () => {
  it("draws each card with its anchor, the notice once above them, and opens the form on Notify me", async () => {
    render(<ComingSoonRoles roles={ROLES} />);
    expect(screen.getByRole("heading", { name: "Coming soon (2)" })).toBeTruthy();
    // The approved notice is said once for the group, above the cards (20 Nov 2026: one card per role).
    expect(document.querySelectorAll("[data-coming-soon-note]").length).toBe(1);
    expect(document.querySelector("[data-coming-soon-note]")?.textContent).toContain("This role is not open yet, and the card may change before it opens.");
    expect(document.getElementById("role-garden")?.getAttribute("data-role-card")).toBe("garden");
    expect(document.getElementById("role-garden")?.querySelector('[data-apply-early="garden"]')?.getAttribute("href")).toBe("/propose-a-role?role=garden&early=1");
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
