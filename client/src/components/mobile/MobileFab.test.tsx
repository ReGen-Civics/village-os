// @vitest-environment jsdom
/**
 * THE CORNER (phone doors v4): your companions, and help. One element at the
 * bottom right, where the lotus of shortcuts and the profile's companions
 * corner (#1646) used to be two.
 *
 * The row list is pure (`cornerRows`), so who sees what is pinned without a
 * page; the rendered cases open the menu the way a member does and read the
 * rows a person can tap. The last cases carry over what the lotus had already
 * paid for: Escape spent on the menu, and a shut menu that takes no room.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import type { CompanionView } from "@shared/companionItems";

const session = vi.hoisted(() => ({
  user: null as null | { id: string; name: string; role?: string },
  admin: false,
  companions: null as null | unknown[],
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: session.user, loading: false }),
}));
vi.mock("@/hooks/useGuideName", () => ({ useGuideName: () => ({ name: "Ceiba", named: true, loaded: true, audience: "member" }) }));
vi.mock("@/lib/haptics", () => ({ haptic: () => false }));
vi.mock("@/lib/gameApi", () => ({
  gameFetch: vi.fn(async () =>
    session.companions ? new Response(JSON.stringify({ companions: session.companions }), { status: 200 }) : new Response("{}", { status: 403 }),
  ),
}));
vi.mock("@/components/profileDash/YourCompanions", () => ({ default: () => <p>the companions panel</p> }));

import MobileFab, { ADMIN_HELPER_HREF, ASK_GUIDE_HREF, cornerRows } from "./MobileFab";

const t = ({ message }: { message: string }) => message;
const companion = (id: string, name: string, open = 0) =>
  ({
    id,
    name,
    status: "active",
    sortOrder: Number(id),
    look: { source: "nature", art: "scarlet-macaw" },
    lookUrl: null,
    drafts: Array.from({ length: open }, (_, i) => ({ id: `${id}-${i}`, status: "open" })),
  }) as unknown as CompanionView;

async function renderAt(path = "/") {
  const { hook } = memoryLocation({ path });
  const r = render(
    <Router hook={hook}>
      <MobileFab />
    </Router>,
  );
  // The companions are read after the first paint.
  await act(async () => {
    await new Promise((done) => setTimeout(done, 0));
  });
  return r;
}

const row = (name: RegExp | string) => screen.queryByRole("menuitem", { name });
const menu = () => screen.getByRole("menu", { hidden: true });

beforeEach(() => {
  session.user = null;
  session.admin = false;
  session.companions = null;
});
afterEach(cleanup);

describe("cornerRows", () => {
  it("is the companions first, then the guide, for a member", () => {
    const rows = cornerRows({ signedIn: true, admin: false, army: [companion("1", "Scarlet", 2), companion("2", "Morpho")], guide: "Ceiba", t });
    expect(rows.map((r) => r.key)).toEqual(["companion-1", "companion-2", "ask-guide"]);
    expect(rows[0].sub).toBe("2 drafts wait for your yes");
    expect(rows[1].sub).toBeUndefined();
    expect(rows[2]).toMatchObject({ label: "Ask Ceiba", href: ASK_GUIDE_HREF });
  });

  it("adds the Admin helper for an admin, tagged, by the address that opens it inside Admin", () => {
    const rows = cornerRows({ signedIn: true, admin: true, army: null, guide: "Ceiba", t });
    expect(rows.at(-1)).toMatchObject({ key: "ask-admin", label: "Ask Ceiba about Admin", href: ADMIN_HELPER_HREF, admin: true });
    expect(ADMIN_HELPER_HREF).toBe("/admin?helper=open");
  });

  it("sends a visitor's question to the guide on Work with us, and offers sign in", () => {
    const rows = cornerRows({ signedIn: false, admin: false, army: null, guide: "the village guide", t });
    expect(rows.map((r) => [r.key, r.href])).toEqual([
      ["ask-guide", "/work-with-us"],
      ["signin", "/login"],
    ]);
  });
});

describe("the corner, drawn", () => {
  it("is the guide's spiral for a visitor, opening help", async () => {
    await renderAt();
    fireEvent.click(screen.getByRole("button", { name: "Open help" }));
    expect(row(/Ask Ceiba/)).not.toBeNull();
    expect(row(/Sign in/)).not.toBeNull();
    expect(row(/about Admin/)).toBeNull();
  });

  it("centres the macaw in the circle, and stands companions on its floor: one alignment each (the lead, 26 Nov 2026)", async () => {
    // Both alignments on one button let the stylesheet's order choose, and it chose the floor: the bird sat 12px low.
    await renderAt();
    const visitor = screen.getByRole("button", { name: "Open help" }).className.split(/\s+/);
    expect(visitor).toContain("items-center");
    expect(visitor).not.toContain("items-end");
    expect(screen.getByRole("button", { name: "Open help" }).querySelector("svg.living-scarlet-macaw")).not.toBeNull();
    cleanup();
    session.user = { id: "u1", name: "Ana" };
    session.companions = [companion("1", "Scarlet")];
    await renderAt();
    const member = screen.getByRole("button", { name: /Your companions: Scarlet/ }).className.split(/\s+/);
    expect(member).toContain("items-end");
    expect(member).not.toContain("items-center");
  });

  it("is the companions standing for a member who has them, with what waits, and carries the tour's id", async () => {
    session.user = { id: "u1", name: "Ana" };
    session.companions = [companion("1", "Scarlet", 2), companion("2", "Morpho")];
    await renderAt();
    const trigger = screen.getByRole("button", { name: /Your companions: Scarlet, Morpho\. 2 waiting/ });
    expect(trigger.id).toBe("companions");
    fireEvent.click(trigger);
    expect(row(/Scarlet/)).not.toBeNull();
    expect(row(/Ask Ceiba/)).toHaveAttribute("href", ASK_GUIDE_HREF);
  });

  it("opens the companions panel from a companion's row", async () => {
    session.user = { id: "u1", name: "Ana" };
    session.companions = [companion("1", "Scarlet")];
    await renderAt();
    fireEvent.click(screen.getByRole("button", { name: /Your companions: Scarlet/ }));
    fireEvent.click(row(/Scarlet/)!);
    expect(await screen.findByRole("dialog", { name: "Your companions" })).toBeInTheDocument();
    expect(await screen.findByText("the companions panel")).toBeInTheDocument();
  });

  it("shows an admin the Admin helper's row, by the address that opens it", async () => {
    session.user = { id: "u1", name: "Ana", role: "admin" };
    session.admin = true;
    await renderAt();
    fireEvent.click(screen.getByRole("button", { name: "Open help" }));
    expect(row(/Ask Ceiba about Admin/)).toHaveAttribute("href", "/admin?helper=open");
  });

  it("draws nothing inside Admin, where Admin's own Ask holds the corner", async () => {
    session.user = { id: "u1", name: "Ana", role: "admin" };
    session.admin = true;
    const { container } = await renderAt("/admin");
    expect(container.querySelector("[data-mobile-fab]")).toBeNull();
    cleanup();
    const again = await renderAt("/admin/settings");
    expect(again.container.querySelector("[data-mobile-fab]")).toBeNull();
  });

  it("stays at every width", async () => {
    const { container } = await renderAt();
    expect(container.querySelector("[data-mobile-fab]")!.className).not.toMatch(/\bmd:hidden\b/);
  });

  it("closes on Escape and hands focus back to the trigger, and the arrows walk the rows", async () => {
    await renderAt();
    const trigger = screen.getByRole("button", { name: "Open help" });
    fireEvent.click(trigger, { detail: 0 }); // detail 0 is a keyboard's Enter
    expect(document.activeElement).toBe(row(/Sign in/));
    fireEvent.keyDown(document.activeElement!, { key: "ArrowUp" });
    expect(document.activeElement).toBe(row(/Ask Ceiba/));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(trigger);
  });

  /* The Escape that closes the menu is spent there: BreakGlass listens on `window`, and the same
     press used to decline the override the member was being asked about. */
  it("keeps the Escape that closes it from reaching a listener on window", async () => {
    const onWindowKey = vi.fn();
    window.addEventListener("keydown", onWindowKey);
    try {
      await renderAt();
      fireEvent.click(screen.getByRole("button", { name: "Open help" }));
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onWindowKey).not.toHaveBeenCalled();
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onWindowKey).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener("keydown", onWindowKey);
    }
  });

  it("takes no room and is not drawn while shut, and is drawn the moment it opens", async () => {
    await renderAt();
    expect(menu().className).toMatch(/\babsolute\b/);
    expect(menu().className).toMatch(/\binvisible\b/);
    fireEvent.click(screen.getByRole("button", { name: "Open help" }));
    expect(menu().className).toMatch(/\bvisible\b/);
    expect(menu().style.transitionDelay).toBe("0s");
    fireEvent.click(screen.getByRole("button", { name: "Close your companions and help" }));
    expect(menu().style.transitionDelay).toBe("400ms");
  });
});
