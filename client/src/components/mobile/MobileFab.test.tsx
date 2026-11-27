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
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import type { CompanionView } from "@shared/companionItems";

const session = vi.hoisted(() => ({
  user: null as null | { id: string; name: string; role?: string },
  admin: false,
  companions: null as null | unknown[],
  entrance: false,
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
vi.mock("@/lib/entranceStatus", () => ({ useEntranceStands: () => session.entrance }));
vi.mock("@/components/profileDash/YourCompanions", () => ({ default: () => <p>the companions panel</p> }));
vi.mock("@/components/feedback/GuideFeedback", () => ({
  default: ({ guide }: { guide: string }) => <p>the feedback form for {guide}</p>,
}));

import MobileFab, { ADMIN_HELPER_HREF, ASK_GUIDE_HREF, cornerRows, guideDoors } from "./MobileFab";
import { openGuideFeedback, releaseFeedback } from "@/lib/guideFeedback";

const t = ({ message }: { message: string }) => message;
/** A companion; the first a member has is their personal one, which the guide's row stands for. */
const companion = (id: string, name: string, open = 0, scope: "personal" | "role" = "role", art = "scarlet-macaw") =>
  ({
    id,
    name,
    scope,
    status: "active",
    sortOrder: Number(id),
    look: { source: "nature", art },
    lookUrl: null,
    drafts: Array.from({ length: open }, (_, i) => ({ id: `${id}-${i}`, status: "open" })),
  }) as unknown as CompanionView;
const personal = (open = 0) => companion("1", "Scarlet", open, "personal");

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
  session.entrance = false;
});
afterEach(() => {
  cleanup();
  // The open form is held per page across corners (lib/guideFeedback.ts); a case starts with nothing held.
  releaseFeedback();
});

/*
 * ONE GUIDE ROW (the lead, 27 Nov 2026): "Scarlet is Maia and Maia admin all 3 can be scarlet ... So I should only
 * see (4 my companions + scarlet) and members without Companions would only see Scarlet."
 */
describe("cornerRows", () => {
  it("is the member's other companions, then ONE guide row that stands for the personal companion", () => {
    const army = [personal(2), companion("2", "Morpho", 0, "role", "blue-morpho"), companion("3", "Kinkajou", 1, "role", "kinkajou")];
    const rows = cornerRows({ signedIn: true, admin: false, army, guide: "Ceiba", t });
    expect(rows.map((r) => r.key)).toEqual(["companion-2", "companion-3", "guide"]);
    expect(rows[1].sub).toBe("One draft waits for your yes");
    // The guide is named by the village's guide setting, never by the companion, and wears the personal companion's face.
    expect(rows[2]).toMatchObject({ label: "Ceiba", sub: "2 drafts wait for your yes", guidePanel: true, face: { look: { art: "scarlet-macaw" } } });
    expect(rows[2].href).toBeUndefined();
    // The personal companion is never drawn twice.
    expect(rows.filter((r) => r.label === "Scarlet")).toHaveLength(0);
    // No "Ask ... about Admin", no "Ask ..." row: one guide.
    expect(rows.some((r) => /^Ask /.test(r.label))).toBe(false);
  });

  it("is the guide alone for a member with no companions, opening its panel (help and feedback), in the village's macaw", () => {
    const rows = cornerRows({ signedIn: true, admin: false, army: [], guide: "Ceiba", t });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ key: "guide", label: "Ceiba", sub: "Help, and a place to share feedback", guidePanel: true, face: { look: { source: "nature", art: "scarlet-macaw" } } });
    expect(rows[0].href).toBeUndefined();
  });

  it("is one guide row for an admin too, and Admin's helper is a door inside the guide's panel", () => {
    const rows = cornerRows({ signedIn: true, admin: true, army: null, guide: "Ceiba", t });
    expect(rows.map((r) => r.key)).toEqual(["guide"]);
    expect(rows[0].guidePanel).toBe(true);
    expect(guideDoors({ admin: true, t }).map((d) => [d.key, d.href, !!d.admin])).toEqual([
      ["ask", ASK_GUIDE_HREF, false],
      ["feedback", undefined, false],
      ["admin", ADMIN_HELPER_HREF, true],
    ]);
    expect(guideDoors({ admin: false, t }).map((d) => d.key)).toEqual(["ask", "feedback"]);
    // Share feedback opens inside the panel; it is never a page of its own again.
    expect(guideDoors({ admin: false, t })[1]).toMatchObject({ opens: "feedback", label: "Share feedback" });
    expect(ADMIN_HELPER_HREF).toBe("/admin?helper=open");
  });

  it("opens the guide's panel for a visitor too, its help door on Work with us, and offers sign in", () => {
    const rows = cornerRows({ signedIn: false, admin: false, army: null, guide: "the village guide", t });
    expect(rows.map((r) => [r.key, r.href, !!r.guidePanel])).toEqual([
      ["guide", undefined, true],
      ["signin", "/login", false],
    ]);
    expect(guideDoors({ admin: false, signedIn: false, t }).map((d) => [d.key, d.href])).toEqual([
      ["ask", "/work-with-us"],
      ["feedback", undefined],
    ]);
  });
});

describe("the corner, drawn", () => {
  it("is the guide's spiral for a visitor, opening help", async () => {
    await renderAt();
    fireEvent.click(screen.getByRole("button", { name: "Open help" }));
    expect(row(/Sign in/)).not.toBeNull();
    expect(row(/Admin/)).toBeNull();
    fireEvent.click(row(/Ceiba/)!);
    expect(await screen.findByRole("dialog", { name: "Ceiba" })).toBeInTheDocument();
    expect(document.querySelector('[data-guide-door="ask"]')).toHaveAttribute("href", "/work-with-us");
    expect(document.querySelector('[data-guide-door="feedback"]')).not.toBeNull();
  });

  it("centres the macaw in the circle, and stands companions on its floor: one alignment each (the lead, 26 Nov 2026)", async () => {
    // Both alignments on one button let the stylesheet's order choose, and it chose the floor: the bird sat 12px low.
    await renderAt();
    const visitor = screen.getByRole("button", { name: "Open help" }).className.split(/\s+/);
    expect(visitor).toContain("items-center");
    expect(visitor).not.toContain("items-end");
    const bird = screen.getByRole("button", { name: "Open help" }).querySelector("svg.living-scarlet-macaw");
    expect(bird).not.toBeNull();
    // A bit bigger in its circle (the lead, 26 Nov 2026): 40px of the 56.
    expect(bird?.getAttribute("class")).toContain("size-10");
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
    session.companions = [personal(2), companion("2", "Morpho")];
    await renderAt();
    const trigger = screen.getByRole("button", { name: /Your companions: Scarlet, Morpho\. 2 waiting/ });
    expect(trigger.id).toBe("companions");
    fireEvent.click(trigger);
    // Morpho, then the guide standing for Scarlet: two rows, never three.
    expect(screen.getAllByRole("menuitem").map((m) => m.textContent)).toEqual(["Morpho", "Ceiba2 drafts wait for your yes"]);
  });

  it("opens the companions panel from a companion's row", async () => {
    session.user = { id: "u1", name: "Ana" };
    session.companions = [personal(), companion("2", "Morpho")];
    await renderAt();
    fireEvent.click(screen.getByRole("button", { name: /Your companions: Scarlet/ }));
    fireEvent.click(row(/Morpho/)!);
    expect(await screen.findByRole("dialog", { name: "Your companions" })).toBeInTheDocument();
    expect(await screen.findByText("the companions panel")).toBeInTheDocument();
  });

  it("opens the guide's panel from the guide's row: the chat and the guide's help, no Admin door for a member", async () => {
    session.user = { id: "u1", name: "Ana" };
    session.companions = [personal()];
    await renderAt();
    fireEvent.click(screen.getByRole("button", { name: /Your companions: Scarlet/ }));
    fireEvent.click(row(/Ceiba/)!);
    expect(await screen.findByRole("dialog", { name: "Ceiba" })).toBeInTheDocument();
    expect(await screen.findByText("the companions panel")).toBeInTheDocument();
    expect(document.querySelector('[data-guide-door="ask"]')).toHaveAttribute("href", ASK_GUIDE_HREF);
    expect(document.querySelector('[data-guide-door="admin"]')).toBeNull();
  });

  it("gives an admin with no companions the guide's panel, with Admin's helper inside it", async () => {
    session.user = { id: "u1", name: "Ana", role: "admin" };
    session.admin = true;
    await renderAt();
    fireEvent.click(screen.getByRole("button", { name: "Open help" }));
    expect(screen.getAllByRole("menuitem")).toHaveLength(1);
    fireEvent.click(row(/Ceiba/)!);
    expect(await screen.findByRole("dialog", { name: "Ceiba" })).toBeInTheDocument();
    expect(document.querySelector('[data-guide-door="admin"]')).toHaveAttribute("href", "/admin?helper=open");
    // No chats to show: the panel is the guide's doors alone.
    expect(screen.queryByText("the companions panel")).toBeNull();
  });

  it("draws every animal as a circle, in the menu and standing beside the button (the lead, 27 Nov 2026)", async () => {
    session.user = { id: "u1", name: "Ana" };
    session.companions = [personal(), companion("2", "Morpho")];
    await renderAt();
    fireEvent.click(screen.getByRole("button", { name: /Your companions: Scarlet/ }));
    const faces = Array.from(document.querySelectorAll("[data-companion-face]"));
    // Two standing beside the button and two in the menu.
    expect(faces.length).toBe(4);
    for (const f of faces) {
      expect(f.className).toContain("rounded-full");
      expect(f.className).not.toMatch(/rounded-t-full|rounded-b-xl/);
      expect(f.querySelector("img")?.className).toContain("object-cover");
    }
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
    expect(document.activeElement).toBe(row(/Ceiba/));
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

/*
 * SHARE FEEDBACK MOVED INTO THE GUIDE'S PANEL (the fold of /feedback, 26 Nov 2026): a door inside the
 * panel, and three ways to open the panel straight on the form, on the page the member is looking at.
 */
describe("Share feedback, in the guide's panel", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("opens the form inside the panel from its door, and goes back to the doors", async () => {
    session.user = { id: "u1", name: "Ana" };
    await renderAt();
    fireEvent.click(screen.getByRole("button", { name: "Open help" }));
    fireEvent.click(row(/Ceiba/)!);
    fireEvent.click(document.querySelector('[data-guide-door="feedback"]')!);
    expect(await screen.findByText("the feedback form for Ceiba")).toBeInTheDocument();
    expect(document.querySelector("[data-guide-doors]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(document.querySelector('[data-guide-door="feedback"]')).not.toBeNull();
  });

  it("opens straight on the form for the footer's door, an event any page can send", async () => {
    await renderAt("/quests");
    act(() => openGuideFeedback());
    expect(await screen.findByRole("dialog", { name: "Ceiba" })).toBeInTheDocument();
    expect(await screen.findByText("the feedback form for Ceiba")).toBeInTheDocument();
  });

  it("opens on #feedback, which is where /feedback sends a member, and takes the hash off", async () => {
    window.history.replaceState(null, "", "/quests#feedback");
    await renderAt("/quests");
    expect(await screen.findByText("the feedback form for Ceiba")).toBeInTheDocument();
    expect(window.location.hash).toBe("");
  });

  /*
   * A COLD /feedback LOST THE FORM 12 TIMES IN 16 (fold QA round 1). The loading screen drew a corner of its
   * own, which read the hash, took it off and opened the form, and was then unmounted. The request is held
   * outside the corner now, so the corner that replaces it opens on the form from its first render.
   */
  it("keeps the form open across a corner that unmounts and a new one that mounts, and lets it go on close", async () => {
    window.history.replaceState(null, "", "/#feedback");
    const first = await renderAt("/");
    expect(await screen.findByText("the feedback form for Ceiba")).toBeInTheDocument();
    expect(window.location.hash).toBe("");
    first.unmount();
    await renderAt("/");
    expect(await screen.findByText("the feedback form for Ceiba")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close your companions" }));
    cleanup();
    await renderAt("/");
    expect(screen.queryByText("the feedback form for Ceiba")).toBeNull();
  });

  it("opens the form behind the portal entrance when the footer asks, and draws no corner there", async () => {
    session.entrance = true;
    const { container } = await renderAt("/gratitude");
    expect(container.querySelector("[data-mobile-fab]")).toBeNull();
    act(() => openGuideFeedback());
    expect(await screen.findByText("the feedback form for Ceiba")).toBeInTheDocument();
  });

  it("keeps Tab inside the panel, and keeps the night in dark mode (a scene, not a dialog of words)", async () => {
    session.user = { id: "u1", name: "Ana" };
    await renderAt();
    fireEvent.click(screen.getByRole("button", { name: "Open help" }));
    fireEvent.click(row(/Ceiba/)!);
    const dialog = await screen.findByRole("dialog", { name: "Ceiba" });
    expect(dialog).toHaveAttribute("data-scene");
    // The doors open the way every section does: a kicker, then the guide's name.
    expect(within(dialog).getByRole("heading", { name: "Ceiba" })).toBeInTheDocument();
    const doors = Array.from(dialog.querySelectorAll<HTMLElement>("[data-guide-door]"));
    const last = doors[doors.length - 1];
    last.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Close your companions" }));
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("opens the panel on a page that draws no corner, a founding page", async () => {
    const { container } = await renderAt("/roles");
    expect(container.querySelector("[data-mobile-fab]")).toBeNull();
    act(() => openGuideFeedback());
    expect(await screen.findByText("the feedback form for Ceiba")).toBeInTheDocument();
  });
});
