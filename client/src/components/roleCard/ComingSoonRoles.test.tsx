// @vitest-environment jsdom
/**
 * "Hear when a role opens" (the lead, 19 Nov 2026): each coming-soon card has its anchor and the approved notice,
 * "Notify me" opens the form, and `#waitlist-<id>` opens that role's form on arrival.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ComingSoonRoles from "./ComingSoonRoles";

const ROLES = [{ id: "garden", name: "Garden Steward", aim: "Grow food" }, { id: "kitchen", name: "Kitchen Steward" }];

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/roles");
  vi.unstubAllGlobals();
});

describe("the coming-soon roles", () => {
  it("draws each card with its anchor and the notice, and opens the form on Notify me", async () => {
    render(<ComingSoonRoles roles={ROLES} />);
    expect(screen.getByText("Hear when a role opens")).toBeTruthy();
    expect(document.getElementById("role-garden")?.textContent).toContain("This role is not open yet, and the card may change before it opens.");
    expect(document.querySelector("[data-waitlist-form]")).toBeNull();
    fireEvent.click(document.querySelector('[data-waitlist-open="kitchen"]') as HTMLElement);
    await waitFor(() => expect(document.querySelector("[data-waitlist-form]")).toBeTruthy());
    expect((screen.getByLabelText("Kitchen Steward") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Garden Steward") as HTMLInputElement).checked).toBe(false);
  });

  it("opens the named role's form from the hash, and says thank you once saved", async () => {
    window.history.replaceState(null, "", "/roles#waitlist-garden");
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ComingSoonRoles roles={ROLES} />);
    await waitFor(() => expect(document.querySelector("[data-waitlist-form]")).toBeTruthy());
    expect((screen.getByLabelText("Garden Steward") as HTMLInputElement).checked).toBe(true);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ana@example.org" } });
    fireEvent.click(screen.getByRole("button", { name: "Notify me" }));
    await waitFor(() => expect(document.querySelector("[data-waitlist-done]")?.textContent).toBe("Thank you. Your details are saved. We will write when the role opens."));
    const body = JSON.parse(String((fetchMock.mock.calls[0] as any)[1].body));
    expect(body).toEqual({ email: "ana@example.org", whatsapp: "", roleIds: ["garden"] });
  });
});
