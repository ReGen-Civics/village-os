// @vitest-environment jsdom
/**
 * Arrival highlight: the section an address lands on glows for ARRIVAL_MS and fades, or under reduced motion holds a
 * still outline for ARRIVAL_MS; nothing moves and focus is never touched.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ARRIVAL_CSS, ARRIVAL_MS, ARRIVED_ATTR, FADE_MS, FIND_FOR_MS, arrivalTarget, arrive, highlight } from "./arrivalHighlight";

function motion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: reduce && q.includes("reduce"), media: q, addEventListener: () => {}, removeEventListener: () => {} }));
}

/** jsdom lays nothing out; an element counts as drawn unless it (or a parent) carries the `hidden` class. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Element.prototype, "getClientRects").mockImplementation(function (this: Element) {
    return (this.closest(".hidden") ? [] : [{}]) as unknown as DOMRectList;
  });
  motion(false);
});

afterEach(() => {
  arrive("", "/"); // ends any arrival still running
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  document.getElementById("arrival-highlight")?.remove();
});

const section = (id: string, extra = "") => {
  document.body.insertAdjacentHTML("beforeend", `<section id="${id}" ${extra}>words</section>`);
  return document.getElementById(id)!;
};

describe("highlight", () => {
  it("glows, holds for ARRIVAL_MS, fades, and clears itself", () => {
    const el = section("cash");
    highlight(el);
    expect(el.getAttribute(ARRIVED_ATTR)).toBe("glow");
    vi.advanceTimersByTime(ARRIVAL_MS);
    expect(el.getAttribute(ARRIVED_ATTR), "still fading").toBe("glow");
    vi.advanceTimersByTime(FADE_MS);
    expect(el.hasAttribute(ARRIVED_ATTR)).toBe(false);
  });

  it("under reduced motion holds a still outline for ARRIVAL_MS and no animation", () => {
    motion(true);
    const el = section("prices");
    highlight(el);
    expect(el.getAttribute(ARRIVED_ATTR)).toBe("still");
    vi.advanceTimersByTime(ARRIVAL_MS - 1);
    expect(el.getAttribute(ARRIVED_ATTR)).toBe("still");
    vi.advanceTimersByTime(1);
    expect(el.hasAttribute(ARRIVED_ATTR)).toBe(false);
    // The still rule animates nothing, and the glow itself stands still for a browser that asks for less motion.
    const still = ARRIVAL_CSS.match(/\[data-arrived="still"\]\{[^}]*\}/)![0];
    expect(still).not.toMatch(/animation|transition/);
    expect(ARRIVAL_CSS).toMatch(/@media \(prefers-reduced-motion: reduce\)\{\[data-arrived="glow"\]\{animation:none/);
  });

  it("takes no room: only a shadow and an outline, in the page's own ring colour", () => {
    for (const prop of ["margin", "padding", "border-width", "width", "height", "transform", "top", "left", "position"]) {
      expect(ARRIVAL_CSS, prop).not.toMatch(new RegExp(`[{;]${prop}\\s*:`));
    }
    expect(ARRIVAL_CSS).toContain("var(--ring");
    // No colour literal beyond the transparent no-shadow: each world's own token draws it.
    expect(ARRIVAL_CSS.replace(/0 0 #0000/g, "")).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
  });

  it("never touches focus", () => {
    const field = document.createElement("input");
    document.body.appendChild(field);
    field.focus();
    const el = section("desks");
    highlight(el);
    vi.advanceTimersByTime(ARRIVAL_MS + FADE_MS);
    expect(document.activeElement).toBe(field);
    expect(el.hasAttribute("tabindex")).toBe(false);
  });

  it("keeps the section's own shadow under the ring, and gives it back after", () => {
    const el = section("photos");
    vi.spyOn(window, "getComputedStyle").mockReturnValue({ boxShadow: "0 1px 2px black" } as CSSStyleDeclaration);
    highlight(el);
    expect(el.style.getPropertyValue("--arrival-own-shadow")).toBe("0 1px 2px black");
    vi.advanceTimersByTime(ARRIVAL_MS + FADE_MS);
    expect(el.style.getPropertyValue("--arrival-own-shadow")).toBe("");
  });

  it("writes its rules into the head once", () => {
    highlight(section("a1"));
    highlight(section("a2"));
    expect(document.querySelectorAll("style#arrival-highlight")).toHaveLength(1);
  });
});

describe("arrivalTarget", () => {
  it("finds a section by id, and a tabbed page's panel for its hash", () => {
    const desks = section("desks");
    expect(arrivalTarget("#desks")).toBe(desks);
    const panel = section("places-panel-photos", 'role="tabpanel"');
    expect(arrivalTarget("#photos")).toBe(panel);
  });

  it("does not land on a hidden chapter or an unchosen tab", () => {
    section("leaving-well", 'class="hidden"');
    expect(arrivalTarget("#leaving-well")).toBeNull();
    section("season-panel-plan", 'role="tabpanel" hidden');
    expect(arrivalTarget("#plan")).toBeNull();
  });

  it("reads the map's addresses and malformed hashes as nothing", () => {
    expect(arrivalTarget("#/place/greenhouse")).toBeNull();
    expect(arrivalTarget("#%E0%A4%A")).toBeNull();
    expect(arrivalTarget("#hud=pocket")).toBeNull();
  });
});

describe("arrive", () => {
  it("waits for a lazy page to draw its section, then lights it", () => {
    arrive("#changes", "/governance/decisions");
    vi.advanceTimersByTime(800);
    const el = section("changes");
    vi.advanceTimersByTime(400);
    expect(el.getAttribute(ARRIVED_ATTR)).toBe("glow");
  });

  it("gives up quietly when the section never comes", () => {
    arrive("#nowhere", "/rights");
    vi.advanceTimersByTime(FIND_FOR_MS + 1000);
    const late = section("nowhere");
    vi.advanceTimersByTime(1000);
    expect(late.hasAttribute(ARRIVED_ATTR)).toBe(false);
  });

  it("leaves the Living Map's hash alone", () => {
    const el = section("greenhouse");
    arrive("#greenhouse", "/map");
    vi.advanceTimersByTime(1000);
    expect(el.hasAttribute(ARRIVED_ATTR)).toBe(false);
  });

  it("ends the last arrival when a new one starts, so two taps never leave two rings", () => {
    const a = section("cash");
    const b = section("prices");
    arrive("#cash", "/governance/treasury");
    vi.advanceTimersByTime(300);
    expect(a.getAttribute(ARRIVED_ATTR)).toBe("glow");
    arrive("#prices", "/governance/treasury");
    expect(a.hasAttribute(ARRIVED_ATTR)).toBe(false);
    vi.advanceTimersByTime(300);
    expect(b.getAttribute(ARRIVED_ATTR)).toBe("glow");
  });

  it("covers the main fold anchors by id or by tab panel", () => {
    const byId = ["desks", "cash", "prices", "changes", "approvals", "game-mechanics", "good-neighbor", "leaving-well"];
    const byPanel = { photos: "places", reports: "places", plan: "season", join: "season", aligned: "season" };
    for (const id of byId) section(id);
    for (const [hash, prefix] of Object.entries(byPanel)) section(`${prefix}-panel-${hash}`, 'role="tabpanel"');
    for (const hash of [...byId, ...Object.keys(byPanel)]) expect(arrivalTarget(`#${hash}`), hash).not.toBeNull();
  });
});
