// @vitest-environment jsdom
/**
 * THE GARDEN'S PIECES, RENDERED: each one's accessible name and its states.
 *
 * What these hold, piece by piece: a place says the whole of itself to a screen
 * reader ("The Hall, 3 waiting") and its lantern follows what waits; the
 * stepping stones are an ordered list with exactly one current step; fireflies
 * are decoration, around one child, and only where the caller asks; the circle
 * keeps the caller's order; the seed says its count in words and never as a
 * meter; the Grounds draw every place by percentage on the village's own land
 * art or the painted ground the person picked, over colours that are always
 * there; a real lantern is never mistaken for a painted one.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import type { ReactElement } from "react";
import { DEFAULT_GARDEN_GROUND, GARDEN_GROUND_KEYS, GARDEN_PLACE_KEYS, gardenGroundUrl, gardenSpriteUrl, type GardenGroundKey } from "@shared/gardenArt";
import {
  Circle,
  Desk,
  Fireflies,
  Garden,
  GARDEN_GROUND_PICK_KEY,
  GardenFrame,
  GroundPicker,
  Grounds,
  Lantern,
  LensToggle,
  Place,
  SeedOfLife,
  StatusBand,
  SteppingStones,
  useGardenDock,
  useGardenGround,
  useGardenLens,
  ViewSwitch,
  type GardenPlaceState,
  type Stone,
} from "./index";
import { cssUrl, groundsPaths } from "./Grounds";
import { dayPartOf, DEFAULT_GUIDE_SPEAKING, GARDEN_SPEAKING_KEY, GUIDE_SPEAKING, readGuideSpeaking, useGardenWords, useGuideSpeaking } from "./speaking";
import { forgetPageCopy } from "./gardenMemory";
import { GARDEN_PLACES } from "./places";

/** The elements a place's description points at, in order. A dark lantern adds its own words after what the place holds. */
const describedBy = (el: Element): HTMLElement[] =>
  (el.getAttribute("aria-describedby") ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id))
    .filter((node): node is HTMLElement => node !== null);

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  localStorage.clear();
  forgetPageCopy();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const show = (ui: ReactElement) =>
  render(
    <I18nProvider i18n={i18n}>
      <Garden>{ui}</Garden>
    </I18nProvider>,
  );

describe("Garden", () => {
  it("puts the night-first scope on an element of its own", () => {
    const { container } = show(<p>inside</p>);
    const scope = container.querySelector(".garden");
    expect(scope).toBeTruthy();
    expect(scope?.textContent).toBe("inside");
  });
});

describe("StatusBand", () => {
  it("says the village's state in the caller's words, with one door", () => {
    show(<StatusBand label="Tokens issuing, launch vote not yet held" sentence="Four stones stand before the vote." action={{ label: "See the road to launch", href: "/admin?tab=launch" }} />);
    const band = screen.getByRole("region", { name: "Where the village stands" });
    expect(within(band).getByText("Tokens issuing, launch vote not yet held")).toBeTruthy();
    expect(within(band).getByText("Four stones stand before the vote.")).toBeTruthy();
    expect(within(band).getByRole("link", { name: "See the road to launch" }).getAttribute("href")).toBe("/admin?tab=launch");
  });

  it("stands with a label alone, and its door may be a button", () => {
    const onPress = vi.fn();
    const { rerender } = show(<StatusBand label="Running" />);
    expect(screen.getByText("Running")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    rerender(
      <I18nProvider i18n={i18n}>
        <Garden>
          <StatusBand label="Vote open" action={{ label: "See the roll", onPress }} />
        </Garden>
      </I18nProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "See the roll" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe("Place and its lantern", () => {
  it("is a link whose name says the place and what waits, with its lantern lit", () => {
    show(<Place place="hall" waiting={3} href="/admin/review" />);
    const link = screen.getByRole("link", { name: "The Hall, 3 waiting" });
    expect(link.getAttribute("href")).toBe("/admin/review");
    expect(link.getAttribute("data-lit")).toBe("true");
    expect(link.querySelector(".gd-lantern")?.getAttribute("data-lit")).toBe("true");
    expect(link.querySelector(".gd-lantern")?.getAttribute("aria-hidden")).toBe("true");
    expect(within(link).getByText("3 waiting")).toBeTruthy();
    expect(link.querySelector("img")?.getAttribute("src")).toBe(gardenSpriteUrl("hall"));
    expect(link.querySelector("img")?.getAttribute("alt")).toBe("");
  });

  it("says one thing waiting as plainly as many", () => {
    show(<Place place="gate" waiting={1} href="/x" />);
    expect(screen.getByRole("link", { name: "The Gate, 1 waiting" })).toBeTruthy();
  });

  it("is dark when nothing waits, and says what the place holds", () => {
    show(<Place place="library" href="/x" />);
    const link = screen.getByRole("link", { name: "The Library" });
    expect(link.getAttribute("data-lit")).toBe("false");
    expect(link.querySelector(".gd-lantern")?.getAttribute("data-lit")).toBe("false");
    // What the place holds, then its dark lantern in words.
    expect(describedBy(link).map((node) => node.textContent)).toEqual(["Words and agreements", "Nothing waiting."]);
    expect(link).toHaveAccessibleDescription("Words and agreements Nothing waiting.");
  });

  it("treats a count that is no number as nothing waiting", () => {
    show(<Place place="store" waiting={Number.NaN} href="/x" />);
    expect(screen.getByRole("link", { name: "The Store" }).getAttribute("data-lit")).toBe("false");
  });

  it("stands under scaffolding when it is not built yet: its own painting, no lantern, and it says so", () => {
    show(<Place place="stage" scaffolding waiting={4} href="/x" />);
    const link = screen.getByRole("link", { name: "The Stage, not built yet" });
    expect(link.getAttribute("data-scaffolding")).toBe("true");
    expect(link.querySelector("img")?.getAttribute("src")).toBe(gardenSpriteUrl("stage", true));
    expect(link.querySelector(".gd-lantern")).toBeNull();
    expect(link.getAttribute("data-lit")).toBe("false");
    expect(within(link).getByText("Not built yet")).toBeTruthy();
  });

  it("is a button when it opens something in place, and the same component is the Desk's row", () => {
    const onOpen = vi.fn();
    show(<Place place="fire" lens="desk" waiting={2} note="Three steps for you" onOpen={onOpen} current />);
    const button = screen.getByRole("button", { name: "The Fire, 2 waiting" });
    expect(button.getAttribute("data-lens")).toBe("desk");
    expect(button.getAttribute("aria-current")).toBe("page");
    expect(document.getElementById(button.getAttribute("aria-describedby")!)?.textContent).toBe("Three steps for you");
    fireEvent.click(button);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("takes the caller's name for it, and draws without its building when the painting is missing", () => {
    show(<Place place="tower" name="The Lookout" href="/x" />);
    const link = screen.getByRole("link", { name: "The Lookout" });
    fireEvent.error(link.querySelector("img")!);
    expect(link.querySelector("img")).toBeNull();
    expect(within(link).getByText("The Lookout")).toBeTruthy();
  });

  it("a lantern standing alone can carry its own words", () => {
    show(<Lantern lit label="A lit lantern needs you" />);
    expect(screen.getByRole("img", { name: "A lit lantern needs you" }).getAttribute("data-lit")).toBe("true");
  });
});

const STONES: Stone[] = [
  { id: "host", label: "Host", state: "walked" },
  { id: "claim", label: "Claim the village", state: "walked", href: "/claim" },
  { id: "purpose", label: "Say what it is for", state: "current", detail: "The vote waits for it", href: "/admin?tab=purpose" },
  { id: "money", label: "Set the money", state: "ahead" },
  { id: "vote", label: "The vote", state: "ahead" },
];

describe("SteppingStones", () => {
  it("is an ordered list, in the caller's order, with exactly one current step", () => {
    const { container } = show(<SteppingStones stones={STONES} label="The road to launch" />);
    const list = screen.getByRole("list", { name: "The road to launch" });
    expect(list.tagName).toBe("OL");
    expect(within(list).getAllByRole("listitem").map((li) => li.querySelector(".gd-stone-row")?.getAttribute("data-state"))).toEqual(["walked", "walked", "current", "ahead", "ahead"]);
    const current = container.querySelectorAll('[aria-current="step"]');
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toContain("Say what it is for");
    expect(current[0].textContent).toContain("The vote waits for it");
  });

  it("keeps one current step even when a caller marks two", () => {
    const two: Stone[] = [...STONES.slice(0, 3), { id: "money", label: "Set the money", state: "current" }, STONES[4]];
    const { container } = show(<SteppingStones stones={two} label="The road to launch" />);
    expect(container.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-state="current"]')).toHaveLength(1);
    expect(container.querySelector('[aria-current="step"]')?.textContent).toContain("Say what it is for");
  });

  it("makes a stone a link or a button when it leads somewhere, and says a walked stone is walked", () => {
    const onPress = vi.fn();
    show(<SteppingStones stones={[...STONES.slice(0, 3), { id: "money", label: "Set the money", state: "ahead", onPress }]} label="The road" />);
    expect(screen.getByRole("link", { name: /Claim the village/ }).getAttribute("href")).toBe("/claim");
    expect(screen.getByRole("link", { name: /Claim the village/ }).textContent).toContain("Walked");
    fireEvent.click(screen.getByRole("button", { name: /Set the money/ }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("draws no fireflies unless asked, and then only around the stone you stand on", () => {
    const { container, unmount } = show(<SteppingStones stones={STONES} label="The road" />);
    expect(container.querySelector('[data-testid="fireflies"]')).toBeNull();
    unmount();
    const lit = show(<SteppingStones stones={STONES} label="The road" fireflies />);
    const layers = lit.container.querySelectorAll('[data-testid="fireflies"]');
    expect(layers).toHaveLength(1);
    expect(layers[0].getAttribute("aria-hidden")).toBe("true");
    expect(layers[0].parentElement?.querySelector('[aria-current="step"]')).toBeTruthy();
  });
});

describe("Fireflies", () => {
  it("wraps the one next act in lights a screen reader never meets", () => {
    show(
      <Fireflies>
        <button type="button">Take this step</button>
      </Fireflies>,
    );
    const layer = screen.getByTestId("fireflies");
    expect(layer.getAttribute("aria-hidden")).toBe("true");
    expect(layer.querySelectorAll("button, a, [tabindex]")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Take this step" })).toBeTruthy();
    expect(layer.closest(".nk")?.contains(screen.getByRole("button"))).toBe(true);
  });

  it("is a still drawing of the same lights under reduced motion", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener: () => {}, removeEventListener: () => {} }));
    show(
      <Fireflies>
        <button type="button">Take this step</button>
      </Fireflies>,
    );
    const host = screen.getByTestId("fireflies").closest(".nk")!;
    expect(host.getAttribute("data-motion")).toBe("still");
    expect(screen.getByTestId("fireflies").querySelectorAll(".nk-ff").length).toBeGreaterThan(0);
  });

  it("refuses a second child: the lights belong to one act", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      show(
        // @ts-expect-error two children is the mistake this type exists to stop
        <Fireflies>
          <button type="button">One</button>
          <button type="button">Two</button>
        </Fireflies>,
      ),
    ).toThrow();
    quiet.mockRestore();
  });
});

describe("Circle", () => {
  const PEOPLE = [
    { id: "3", name: "Zinnia Okafor", state: "waiting" },
    { id: "1", name: "Ansel Reyes", state: "answered" },
    { id: "2", name: "  mira   Solberg", portraitUrl: "/uploads/mira.webp" },
  ];

  it("keeps the caller's order, shows first names and the caller's state words", () => {
    show(<Circle people={PEOPLE} note="Nothing waits on a second signature." />);
    const items = within(screen.getByRole("list", { name: "The circle" })).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual(["ZZinniawaiting", "AAnselanswered", "mira"]);
    expect(screen.getByText("Nothing waits on a second signature.")).toBeTruthy();
  });

  it("draws an initial where there is no portrait, a portrait where there is, and the initial again if the portrait fails", () => {
    show(<Circle people={PEOPLE} label="The roll" />);
    const items = within(screen.getByRole("list", { name: "The roll" })).getAllByRole("listitem");
    expect(items[0].querySelector(".gd-ring")?.getAttribute("aria-hidden")).toBe("true");
    expect(items[0].querySelector(".gd-ring")?.textContent).toBe("Z");
    const portrait = items[2].querySelector("img")!;
    expect(portrait.getAttribute("src")).toBe("/uploads/mira.webp");
    expect(portrait.getAttribute("alt")).toBe("");
    fireEvent.error(portrait);
    expect(items[2].querySelector("img")).toBeNull();
    expect(items[2].querySelector(".gd-ring")?.textContent).toBe("M");
  });

  it("carries no number, rank or order of its own", () => {
    const { container } = show(<Circle people={PEOPLE} />);
    expect(container.textContent).not.toMatch(/\d/);
    expect(container.querySelector("ol")).toBeNull();
  });
});

describe("SeedOfLife", () => {
  it("says the count in words and grows one circle per stone walked", () => {
    const { container } = show(<SeedOfLife walked={3} total={14} />);
    expect(screen.getByRole("img", { name: "3 of 14 stones walked" })).toBeTruthy();
    expect(container.querySelectorAll('circle[data-state="closed"]')).toHaveLength(3);
    expect(container.querySelectorAll("circle[data-state]")).toHaveLength(14);
    expect(container.querySelector(".nk-life")?.getAttribute("data-shape")).toBe("flower");
  });

  it("is the seed itself up to seven, and reads one stone as one", () => {
    const { container } = show(<SeedOfLife walked={1} total={1} />);
    expect(screen.getByRole("img", { name: "1 of 1 stone walked" })).toBeTruthy();
    expect(container.querySelector(".nk-life")?.getAttribute("data-shape")).toBe("seed");
  });

  it("past the flower's nineteen circles it shows the count in words, and only reads as whole when the road is", () => {
    const { container, unmount } = show(<SeedOfLife walked={22} total={25} />);
    expect(screen.getByText("22 of 25 stones walked")).toBeTruthy();
    expect(container.querySelectorAll("circle[data-state]")).toHaveLength(19);
    expect(container.querySelectorAll('circle[data-state="closed"]')).toHaveLength(18);
    unmount();
    const whole = show(<SeedOfLife walked={25} total={25} />);
    expect(whole.container.querySelectorAll('circle[data-state="closed"]')).toHaveLength(19);
  });

  it("is never a meter: no progressbar, no percentage", () => {
    const { container } = show(<SeedOfLife walked={5} total={10} words />);
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(container.querySelector("progress, meter")).toBeNull();
    expect(container.textContent).not.toContain("%");
    expect(screen.getByText("5 of 10 stones walked")).toBeTruthy();
  });
});

describe("LensToggle", () => {
  it("names both lenses, marks the one showing, and reports the one picked", () => {
    const onChange = vi.fn();
    show(<LensToggle lens="grounds" onChange={onChange} />);
    const group = screen.getByRole("group", { name: "How you see the garden" });
    expect(within(group).getByRole("button", { name: "The Grounds" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(group).getByRole("button", { name: "The Desk" }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(within(group).getByRole("button", { name: "The Desk" }));
    expect(onChange).toHaveBeenCalledWith("desk");
  });
});

const ALL: GardenPlaceState[] = GARDEN_PLACE_KEYS.map((place) => ({ place, href: `/admin/${place}`, waiting: place === "hall" ? 3 : 0, scaffolding: place === "stage" }));

describe("Grounds", () => {
  it("draws every place the caller names, each where the table puts it, by percentage", () => {
    show(<Grounds places={ALL} />);
    const map = screen.getByRole("navigation", { name: "The grounds" });
    const items = within(map).getAllByRole("listitem");
    expect(items).toHaveLength(10);
    for (const li of items) {
      const place = li.querySelector(".gd-place")?.getAttribute("data-place") as keyof typeof GARDEN_PLACES;
      expect(li.style.getPropertyValue("--gd-x")).toBe(String(GARDEN_PLACES[place].x));
      expect(li.style.getPropertyValue("--gd-y")).toBe(String(GARDEN_PLACES[place].y));
      expect(li.style.getPropertyValue("--gd-w")).toBe(String(GARDEN_PLACES[place].w));
      // Nothing is sized in pixels inline, so the map can never be wider than the room it is given.
      expect(li.getAttribute("style")).not.toMatch(/\d+px/);
    }
    expect(within(map).getByRole("link", { name: "The Hall, 3 waiting" })).toBeTruthy();
    expect(within(map).getByRole("link", { name: "The Stage, not built yet" })).toBeTruthy();
    expect(within(map).getAllByRole("link").every((a) => a.getAttribute("data-lens") === "grounds")).toBe(true);
  });

  it("stands on a painted ground, forest first, until the village has land art of its own", () => {
    const { container, unmount } = show(<Grounds places={ALL} />);
    const painted = container.querySelector(".gd-land") as HTMLElement;
    expect(painted.getAttribute("data-land")).toBe("ground");
    expect(painted.getAttribute("data-ground")).toBe("forest");
    expect(painted.style.getPropertyValue("--gd-land-image")).toBe('url("/images/garden/ground-forest.webp")');
    unmount();
    const own = show(<Grounds places={ALL} landImageUrl="/uploads/land/our-land.webp" />);
    const land = own.container.querySelector(".gd-land") as HTMLElement;
    expect(land.getAttribute("data-land")).toBe("own");
    expect(land.hasAttribute("data-ground")).toBe(false);
    expect(land.style.getPropertyValue("--gd-land-image")).toBe('url("/uploads/land/our-land.webp")');
  });

  it("draws a new village as bare land and one fire, and each place once", () => {
    show(<Grounds places={[{ place: "fire", onOpen: () => {} }, { place: "fire", href: "/again" }]} label="Your land" />);
    const map = screen.getByRole("navigation", { name: "Your land" });
    expect(within(map).getAllByRole("listitem")).toHaveLength(1);
    expect(within(map).getByRole("button", { name: "The Fire" })).toBeTruthy();
    expect(map.querySelectorAll(".gd-paths path")).toHaveLength(0);
  });

  it("lays a stepping-stone path from the fire to every other place, as decoration", () => {
    const { container } = show(<Grounds places={ALL} />);
    const paths = container.querySelector(".gd-paths")!;
    expect(paths.getAttribute("aria-hidden")).toBe("true");
    expect(paths.querySelectorAll("path")).toHaveLength(9);
    expect(groundsPaths(["hall", "gate"])).toEqual([]);
    for (const d of groundsPaths([...GARDEN_PLACE_KEYS])) {
      for (const n of d.match(/-?\d+(?:\.\d+)?/g) ?? []) {
        expect(Number(n)).toBeGreaterThanOrEqual(0);
        expect(Number(n)).toBeLessThanOrEqual(100);
      }
    }
  });

  it("keeps a land image's URL inside its own quotes", () => {
    expect(cssUrl('/a"b\\c\nd.webp')).toBe('url("/a%22b%5Cc%0Ad.webp")');
  });

  it("COMPACT: the same places on the same spots, asked for by hand, and a plain map when it is not", () => {
    const plain = show(<Grounds places={ALL} />);
    expect(screen.getByRole("navigation", { name: "The grounds" }).hasAttribute("data-compact")).toBe(false);
    plain.unmount();

    show(<Grounds places={ALL} compact />);
    const map = screen.getByRole("navigation", { name: "The grounds" });
    expect(map.getAttribute("data-compact")).toBe("true");
    const items = within(map).getAllByRole("listitem");
    expect(items).toHaveLength(10);
    for (const li of items) {
      const place = li.querySelector(".gd-place")?.getAttribute("data-place") as keyof typeof GARDEN_PLACES;
      expect(li.style.getPropertyValue("--gd-x")).toBe(String(GARDEN_PLACES[place].x));
      expect(li.style.getPropertyValue("--gd-y")).toBe(String(GARDEN_PLACES[place].y));
    }
    // The plaque shows less, and the place still says all of it: what waits, and that a place is not built yet.
    expect(within(map).getByRole("link", { name: "The Hall, 3 waiting" })).toBeTruthy();
    const unbuilt = within(map).getByRole("link", { name: "The Stage, not built yet" });
    expect(unbuilt.getAttribute("data-scaffolding")).toBe("true");
    expect(unbuilt.querySelector("img")?.getAttribute("src")).toBe(gardenSpriteUrl("stage", true));
    expect(unbuilt.querySelector(".gd-lantern")).toBeNull();
    // A lit place keeps its lantern, which is all the compact plaque shows beside the name.
    expect(within(map).getByRole("link", { name: "The Hall, 3 waiting" }).querySelector('.gd-lantern[data-lit="true"]')).toBeTruthy();
  });

  it("COMPACT: inside the frame with the dock expanded, the Grounds needs no prop: the frame's own state asks", () => {
    show(
      <GardenFrame dock={<p>the conversation</p>} dockState="expanded">
        <Grounds places={ALL} />
      </GardenFrame>,
    );
    const map = screen.getByRole("navigation", { name: "The grounds" });
    // Nothing is set on the Grounds: the stylesheet reads the frame (gardenTokens.test.ts holds the rule).
    expect(map.hasAttribute("data-compact")).toBe(false);
    expect(map.closest(".gd-frame")?.getAttribute("data-dock")).toBe("expanded");
    expect(map.closest(".gd-frame-main")).toBeTruthy();
  });
});

describe("Desk", () => {
  it("lists the same places as dense rows, and marks the one the person is in", () => {
    show(<Desk places={ALL} current="hall" />);
    const desk = screen.getByRole("navigation", { name: "Places" });
    const rows = within(desk).getAllByRole("link");
    expect(rows).toHaveLength(10);
    expect(rows.every((a) => a.getAttribute("data-lens") === "desk")).toBe(true);
    expect(rows.map((a) => a.getAttribute("data-place"))).toEqual([...GARDEN_PLACE_KEYS]);
    expect(within(desk).getByRole("link", { name: "The Hall, 3 waiting" }).getAttribute("aria-current")).toBe("page");
    expect(rows.filter((a) => a.getAttribute("aria-current") === "page")).toHaveLength(1);
  });
});

describe("StatusBand: the season and the moon", () => {
  it("says the season and the moon in the caller's words, with the moon drawing as decoration", () => {
    show(<StatusBand label="Setup" season="Season of Foundations" moon="Moon 3, waxing" moonGlyph={<svg data-testid="moon" />} />);
    const cycle = screen.getByTestId("garden-band-cycle");
    expect(cycle.textContent).toBe("Season of Foundations · Moon 3, waxing");
    expect(screen.getByTestId("moon").parentElement?.getAttribute("aria-hidden")).toBe("true");
  });

  it("says one of them alone, and draws nothing when given neither", () => {
    const first = show(<StatusBand label="Setup" moon="Moon 3" />);
    expect(screen.getByTestId("garden-band-cycle").textContent).toBe("Moon 3");
    first.unmount();
    show(<StatusBand label="Setup" season="  " />);
    expect(screen.queryByTestId("garden-band-cycle")).toBeNull();
  });
});

describe("GardenFrame: one place for the guide's dock", () => {
  const frame = (state: "closed" | "docked" | "expanded" | undefined, dock: ReactElement | undefined = <p>the guide</p>) =>
    show(
      <GardenFrame band={<StatusBand label="Setup" />} dock={dock} dockState={state}>
        <p>the grounds</p>
      </GardenFrame>,
    );

  it("draws the dock in a named region beside what you see, and says which state it is in", () => {
    const { container } = frame("docked");
    expect(container.querySelector(".gd-frame")?.getAttribute("data-dock")).toBe("docked");
    const dock = screen.getByRole("complementary", { name: "Your guide" });
    expect(within(dock).getByText("the guide")).toBeTruthy();
    expect(screen.getByText("the grounds")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Where the village stands" })).toBeTruthy();
  });

  it("keeps what you see on the page when she is expanded: the conversation leads, the grounds stay", () => {
    const { container } = frame("expanded");
    expect(container.querySelector(".gd-frame")?.getAttribute("data-dock")).toBe("expanded");
    expect(screen.getByText("the guide")).toBeTruthy();
    expect(screen.getByText("the grounds")).toBeTruthy();
  });

  it("does not draw the dock at all when it is closed, or when no dock is given", () => {
    const closed = frame("closed");
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.queryByText("the guide")).toBeNull();
    expect(screen.getByText("the grounds")).toBeTruthy();
    closed.unmount();
    const { container } = show(
      <GardenFrame dockState="docked">
        <p>the grounds</p>
      </GardenFrame>,
    );
    expect(container.querySelector(".gd-frame")?.getAttribute("data-dock")).toBe("closed");
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("puts the dock before what you see in the document, so reading and tab order match what the eye meets", () => {
    frame("docked");
    const dock = screen.getByRole("complementary", { name: "Your guide" });
    const main = screen.getByText("the grounds");
    // DOCUMENT_POSITION_FOLLOWING: what you see comes after the dock.
    expect(dock.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("takes the caller's own name for the dock", () => {
    show(
      <GardenFrame dock={<p>the guide</p>} dockLabel="Sol, your guide">
        <p>the grounds</p>
      </GardenFrame>,
    );
    expect(screen.getByRole("complementary", { name: "Sol, your guide" })).toBeTruthy();
  });
});

function DockProbe({ firstEvening }: { firstEvening?: boolean }) {
  const dock = useGardenDock({ firstEvening });
  return (
    <div>
      <p data-testid="dock-state">{dock.state}</p>
      <button type="button" onClick={() => dock.setState("expanded")}>
        expand
      </button>
      <button type="button" onClick={() => dock.setState("closed")}>
        close
      </button>
    </div>
  );
}

function DockEcho() {
  return <p data-testid="dock-echo">{useGardenDock().state}</p>;
}

describe("useGardenDock: where a person left the guide", () => {
  it("opens docked for a running admin, and expanded on a new village's first evening", () => {
    const running = show(<DockProbe />);
    expect(screen.getByTestId("dock-state").textContent).toBe("docked");
    running.unmount();
    show(<DockProbe firstEvening />);
    expect(screen.getByTestId("dock-state").textContent).toBe("expanded");
  });

  it("remembers the person's last choice over the default, in their own browser", () => {
    const first = show(<DockProbe firstEvening />);
    fireEvent.click(screen.getByRole("button", { name: "close" }));
    expect(screen.getByTestId("dock-state").textContent).toBe("closed");
    first.unmount();
    forgetPageCopy();
    show(<DockProbe firstEvening />);
    expect(screen.getByTestId("dock-state").textContent).toBe("closed");
  });

  it("keeps two callers on one page in step", () => {
    show(
      <>
        <DockProbe />
        <DockEcho />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "expand" }));
    expect(screen.getByTestId("dock-echo").textContent).toBe("expanded");
  });
});

describe("the lens toggle steps back where there is no map to choose", () => {
  it("is hidden below the map's width and drawn from it up, by the same breakpoint the lens uses", () => {
    show(<LensToggle lens="grounds" onChange={() => undefined} />);
    const toggle = screen.getByRole("group", { name: "How you see the garden" });
    const classes = toggle.className.split(/\s+/);
    expect(classes).toContain("hidden");
    expect(classes).toContain("lg:flex");
    // Drawn or not is the screen's: nothing draws it at every width.
    expect(classes.filter((c) => c === "flex" || c === "inline-flex")).toEqual([]);
  });
});

describe("a place always says what it holds", () => {
  const described = (el: HTMLElement) => document.getElementById(el.getAttribute("aria-describedby") ?? "")?.textContent ?? null;

  it("keeps what it holds as the description when the count takes the plaque's one line", () => {
    show(<Place place="hall" waiting={3} href="/admin?tab=review" />);
    const hall = screen.getByRole("link", { name: "The Hall, 3 waiting" });
    expect(described(hall)).toBe(i18n._(GARDEN_PLACES.hall.holds));
    // Said to a screen reader, not drawn a second time on the plaque.
    expect(document.getElementById(hall.getAttribute("aria-describedby")!)?.className).toContain("sr-only");
  });

  it("keeps it for a place under scaffolding too", () => {
    show(<Place place="stage" scaffolding href="/admin?tab=milestones" />);
    expect(described(screen.getByRole("link", { name: "The Stage, not built yet" }))).toBe(i18n._(GARDEN_PLACES.stage.holds));
  });

  it("shows it in sight on a quiet place, and on the Desk beside the count", () => {
    show(
      <>
        <Place place="library" href="/a" />
        <Place place="gate" lens="desk" waiting={2} href="/b" />
      </>,
    );
    const library = screen.getByRole("link", { name: "The Library" });
    // What it holds is the first thing its description points at, and it is drawn.
    const [holds] = describedBy(library);
    expect(holds.textContent).toBe(i18n._(GARDEN_PLACES.library.holds));
    expect(holds.className).not.toContain("sr-only");
    expect(holds.hidden).toBe(false);
    const gate = screen.getByRole("link", { name: "The Gate, 2 waiting" });
    expect(document.getElementById(gate.getAttribute("aria-describedby")!)?.className ?? "").not.toContain("sr-only");
    expect(described(gate)).toBe(i18n._(GARDEN_PLACES.gate.holds));
  });
});

/**
 * THE BAND'S TWO SWITCHES (the founder, on the first photographs: "I don't see the toggle to switch from AI first to
 * the other dashboard"). One labelled, two-sided control for which leads the page, beside the lens toggle, in the
 * band in every dock state.
 */
describe("the band's two switches: what leads the page, and the lens", () => {
  function Page({ firstEvening = false, bare = false }: { firstEvening?: boolean; bare?: boolean }) {
    const dock = useGardenDock({ firstEvening });
    const lens = useGardenLens();
    const switches = (
      <>
        <ViewSwitch dock={dock} />
        <LensToggle lens={lens.lens} onChange={lens.setLens} />
      </>
    );
    return (
      <GardenFrame band={<StatusBand label="The Game is running" switches={bare ? undefined : switches} />} dock={<p>the conversation</p>} dockState={dock.state}>
        <button type="button" onClick={() => dock.setState("closed")}>
          close her
        </button>
        {bare ? <LensToggle lens={lens.lens} onChange={lens.setLens} /> : null}
      </GardenFrame>
    );
  }
  const band = () => screen.getByRole("region", { name: "Where the village stands" });
  const view = () => screen.getByRole("group", { name: "What leads this page" });
  const side = (name: string) => within(view()).getByRole("button", { name });
  const pressed = () => ({ guide: side("Guide first").getAttribute("aria-pressed"), dashboard: side("Dashboard").getAttribute("aria-pressed") });
  const frameState = () => document.querySelector(".gd-frame")?.getAttribute("data-dock");

  it("is one named group of two real buttons, each a finger tall, with the side you are on marked", () => {
    show(<Page />);
    expect(within(view()).getAllByRole("button").map((b) => b.textContent)).toEqual(["Guide first", "Dashboard"]);
    for (const b of within(view()).getAllByRole("button")) {
      expect(b.className.split(/\s+/)).toContain("min-h-11");
      expect(b.hasAttribute("aria-pressed")).toBe(true);
    }
    // The lens toggle's own look, so the two read as a pair.
    expect(view().className.split(/\s+/)).toEqual(expect.arrayContaining(["gd-lens", "gd-view"]));
  });

  it("marks the current side in each of the three dock states: docked, expanded and closed", () => {
    const docked = show(<Page />);
    expect(frameState()).toBe("docked");
    expect(pressed()).toEqual({ guide: "false", dashboard: "true" });
    docked.unmount();
    localStorage.clear();
    forgetPageCopy();

    show(<Page firstEvening />);
    expect(frameState()).toBe("expanded");
    expect(pressed()).toEqual({ guide: "true", dashboard: "false" });

    // Closed: the dashboard has the whole page, so Dashboard is the marked side.
    fireEvent.click(screen.getByRole("button", { name: "close her" }));
    expect(frameState()).toBe("closed");
    expect(pressed()).toEqual({ guide: "false", dashboard: "true" });
  });

  it("moves the dock's state and the frame with it when a side is pressed, and the side you are on changes nothing", () => {
    show(<Page />);
    fireEvent.click(side("Guide first"));
    expect(frameState()).toBe("expanded");
    expect(pressed()).toEqual({ guide: "true", dashboard: "false" });
    fireEvent.click(side("Guide first"));
    expect(frameState()).toBe("expanded");

    fireEvent.click(side("Dashboard"));
    expect(frameState()).toBe("docked");
    expect(pressed()).toEqual({ guide: "false", dashboard: "true" });
    fireEvent.click(side("Dashboard"));
    expect(frameState()).toBe("docked");

    // With her closed, Dashboard is where you already are: it does not open her again. Guide first does.
    fireEvent.click(screen.getByRole("button", { name: "close her" }));
    fireEvent.click(side("Dashboard"));
    expect(frameState()).toBe("closed");
    fireEvent.click(side("Guide first"));
    expect(frameState()).toBe("expanded");
  });

  it("sets the one value the dock's own buttons set, so the two never disagree", () => {
    show(
      <>
        <Page />
        <DockProbe />
      </>,
    );
    fireEvent.click(side("Guide first"));
    expect(screen.getByTestId("dock-state").textContent).toBe("expanded");
    // And the other way: the dock's own contract button moves the switch.
    fireEvent.click(screen.getByRole("button", { name: "close" }));
    expect(pressed()).toEqual({ guide: "false", dashboard: "true" });
  });

  it("draws both switches in the band, side by side, in the docked and in the expanded state", () => {
    show(<Page />);
    for (const state of ["docked", "expanded"]) {
      if (state === "expanded") fireEvent.click(side("Guide first"));
      expect(frameState()).toBe(state);
      expect(within(band()).getByRole("group", { name: "What leads this page" })).toBeTruthy();
      expect(within(band()).getByRole("group", { name: "How you see the garden" })).toBeTruthy();
      // Each is the band's own item: one that steps back on a narrow screen leaves no gap behind it.
      expect(screen.getByTestId("garden-band-switches").className).toBe("contents");
      expect(Array.from(screen.getByTestId("garden-band-switches").children).map((c) => c.getAttribute("aria-label"))).toEqual(["What leads this page", "How you see the garden"]);
    }
    // The lens toggle is drawn once, in the band and nowhere else.
    expect(screen.getAllByRole("group", { name: "How you see the garden" })).toHaveLength(1);
  });

  it("leaves a caller that passes nothing as it was: no switch in the band, and its lens toggle in its own place", () => {
    show(<Page bare />);
    expect(screen.queryByTestId("garden-band-switches")).toBeNull();
    expect(within(band()).queryByRole("group")).toBeNull();
    expect(screen.queryByRole("group", { name: "What leads this page" })).toBeNull();
    const lens = screen.getByRole("group", { name: "How you see the garden" });
    expect(lens.closest(".gd-frame-main")).toBeTruthy();
    expect(lens.className.split(/\s+/)).toEqual(expect.arrayContaining(["hidden", "w-fit", "lg:flex"]));
  });
});

/**
 * HOW THE GARDEN SPEAKS (the founder, 28 Nov 2026: "Go with warm and plain with the brief and quiet toggle"). Warm
 * and plain everywhere; brief and quiet is the `quiet` setting of each person's speaking dial: the same facts in the
 * fewest words.
 */
describe("the speaking dial, and the garden's own lines in both forms", () => {
  function Probe({ village = "North Wind", needing = 4, hour = 20 }: { village?: string; needing?: number; hour?: number }) {
    const dial = useGuideSpeaking();
    const words = useGardenWords({ now: new Date(2026, 10, 28, hour) });
    return (
      <div>
        <p data-testid="setting">{dial.speaking}</p>
        <p data-testid="band">{words.band({ village, needing })}</p>
        <p data-testid="legend">{words.legend}</p>
        <p data-testid="unbuilt">{words.unbuilt}</p>
        <button type="button" aria-pressed={dial.quiet} onClick={() => dial.setQuiet(!dial.quiet)}>
          Brief and quiet
        </button>
        <button type="button" onClick={() => dial.setSpeaking("walk")}>
          walk with me
        </button>
      </div>
    );
  }
  const text = (id: string) => screen.getByTestId(id).textContent;
  const toggle = () => fireEvent.click(screen.getByRole("button", { name: "Brief and quiet" }));

  it("holds the three settings the founder named, opens on speaking at decisions, and reads anything else as that", () => {
    expect(GUIDE_SPEAKING).toEqual(["quiet", "decisions", "walk"]);
    expect(DEFAULT_GUIDE_SPEAKING).toBe("decisions");
    for (const junk of [undefined, null, "", "QUIET", "loud", 3, {}]) expect(readGuideSpeaking(junk)).toBe("decisions");
    show(<Probe />);
    expect(text("setting")).toBe("decisions");
  });

  it("WARM AND PLAIN: the band names the village, the part of the day and how many places need the person", () => {
    show(<Probe />);
    expect(text("band")).toBe("North Wind tonight: four places need you.");
    expect(text("legend")).toBe("A lit lantern marks a place that needs you.");
    expect(text("unbuilt")).toBe("A place under scaffolding is not set up yet.");
  });

  it("takes the part of the day from the clock: morning from five, afternoon from noon, evening from five", () => {
    expect([4, 5, 11, 12, 16, 17, 23, 0].map(dayPartOf)).toEqual(["evening", "morning", "morning", "afternoon", "afternoon", "evening", "evening", "evening"]);
    const morning = show(<Probe hour={8} />);
    expect(text("band")).toBe("North Wind this morning: four places need you.");
    morning.unmount();
    const afternoon = show(<Probe hour={14} />);
    expect(text("band")).toBe("North Wind this afternoon: four places need you.");
    afternoon.unmount();
    show(<Probe hour={8} needing={0} />);
    expect(text("band")).toBe("The village is quiet this morning. Nothing needs you.");
  });

  it("says one place as one, a count past ten as a number, and nothing waiting as steady", () => {
    const one = show(<Probe needing={1} />);
    expect(text("band")).toBe("North Wind tonight: one place needs you.");
    one.unmount();
    const many = show(<Probe needing={12} />);
    expect(text("band")).toBe("North Wind tonight: 12 places need you.");
    many.unmount();
    const none = show(<Probe needing={0} />);
    expect(text("band")).toBe("The village is quiet tonight. Nothing needs you.");
    none.unmount();
    // A count that is no count is nothing waiting, never a line with NaN in it.
    show(<Probe needing={Number.NaN} />);
    expect(text("band")).toBe("The village is quiet tonight. Nothing needs you.");
  });

  it("uses the village's own name, and a plain one while it has none: no village's name is written into the platform", () => {
    show(<Probe village="  " />);
    expect(text("band")).toBe("The village tonight: four places need you.");
  });

  it("BRIEF AND QUIET: the one toggle turns every line to its brief form, and back again", () => {
    show(<Probe />);
    toggle();
    expect(text("setting")).toBe("quiet");
    expect(screen.getByRole("button", { name: "Brief and quiet" }).getAttribute("aria-pressed")).toBe("true");
    expect(text("band")).toBe("4 places need you.");
    expect(text("legend")).toBe("Lit: needs you.");
    expect(text("unbuilt")).toBe("Scaffolding: not set up.");
    toggle();
    expect(text("setting")).toBe("decisions");
    expect(text("band")).toBe("North Wind tonight: four places need you.");
  });

  it("BRIEF AND QUIET: one place, and nothing waiting", () => {
    const one = show(<Probe needing={1} />);
    toggle();
    expect(text("band")).toBe("1 place needs you.");
    one.unmount();
    show(<Probe needing={0} />);
    expect(text("band")).toBe("All clear.");
  });

  it("is remembered in the person's own browser, and a person who never chose leaves no trace", () => {
    const first = show(<Probe />);
    expect(localStorage.getItem(GARDEN_SPEAKING_KEY)).toBeNull();
    toggle();
    expect(localStorage.getItem(GARDEN_SPEAKING_KEY)).toBe("quiet");
    first.unmount();
    forgetPageCopy();
    const again = show(<Probe />);
    expect(text("setting")).toBe("quiet");
    // Back to the default is kept as nothing at all.
    toggle();
    expect(localStorage.getItem(GARDEN_SPEAKING_KEY)).toBeNull();
    again.unmount();
  });

  it("is each person's own where two share a browser", () => {
    const ana = render(
      <I18nProvider i18n={i18n}>
        <Garden personKey="ana">
          <Probe />
        </Garden>
      </I18nProvider>,
    );
    toggle();
    expect(localStorage.getItem(`${GARDEN_SPEAKING_KEY}:ana`)).toBe("quiet");
    ana.unmount();
    render(
      <I18nProvider i18n={i18n}>
        <Garden personKey="ben">
          <Probe />
        </Garden>
      </I18nProvider>,
    );
    expect(text("setting")).toBe("decisions");
    expect(text("band")).toBe("North Wind tonight: four places need you.");
  });

  it("keeps every reader on the page in step, and reads an unknown kept value as the default", () => {
    localStorage.setItem(GARDEN_SPEAKING_KEY, "loud");
    forgetPageCopy();
    show(
      <>
        <Probe />
        <StatusBandReader />
      </>,
    );
    expect(text("setting")).toBe("decisions");
    toggle();
    // The band a host draws from the same words follows the same dial.
    expect(within(screen.getByRole("region", { name: "Where the village stands" })).getByText("4 places need you.")).toBeTruthy();
  });

  it("holds `walk` as data too, and it speaks as the default does until something follows from it", () => {
    show(<Probe />);
    fireEvent.click(screen.getByRole("button", { name: "walk with me" }));
    expect(text("setting")).toBe("walk");
    expect(localStorage.getItem(GARDEN_SPEAKING_KEY)).toBe("walk");
    expect(text("band")).toBe("North Wind tonight: four places need you.");
  });
});

/** A second reader of the dial on the same page: the band, as a host would write it. */
function StatusBandReader() {
  const words = useGardenWords({ now: new Date(2026, 10, 28, 20) });
  return <StatusBand label={words.band({ village: "North Wind", needing: 4 })} />;
}

/** garden.css as its innermost rules, comments gone: each one's selector and its declarations. */
const GARDEN_RULES = Array.from(
  readFileSync(path.resolve(__dirname, "garden.css"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .matchAll(/([^{}]+)\{([^{}]*)\}/g),
  (m) => ({ selector: m[1].trim().replace(/\s+/g, " "), body: m[2] }),
);

/** Every place built, two of them lit: the running garden. */
const BUILT: GardenPlaceState[] = GARDEN_PLACE_KEYS.map((place) => ({ place, href: `/admin/${place}`, waiting: place === "hall" ? 3 : place === "fire" ? 1 : 0 }));

const GROUND_NAMES: Record<GardenGroundKey, string> = { forest: "Forest", valley: "Valley", hills: "Terraced hills", beach: "Beachside" };
const groundPicker = () => screen.getByRole("group", { name: "The ground behind your garden" });
const groundChoice = (ground: GardenGroundKey) => within(groundPicker()).getByRole("button", { name: GROUND_NAMES[ground] });
const theLand = () => document.querySelector(".gd-land") as HTMLElement;

function GroundProbe() {
  const { ground, setGround } = useGardenGround();
  return (
    <>
      <p data-testid="ground">{ground}</p>
      <GroundPicker ground={ground} onChange={setGround} />
    </>
  );
}

function GroundEcho() {
  return <p data-testid="ground-echo">{useGardenGround().ground}</p>;
}

function QuietSwitch() {
  const dial = useGuideSpeaking();
  return (
    <button type="button" onClick={() => dial.setQuiet(!dial.quiet)}>
      brief and quiet
    </button>
  );
}

const showFor = (personKey: string, ui: ReactElement) =>
  render(
    <I18nProvider i18n={i18n}>
      <Garden personKey={personKey}>{ui}</Garden>
    </I18nProvider>,
  );

/**
 * THE GROUND BEHIND THE GARDEN (the founder, 28 Nov 2026: "Let users pick forest, valley, or terraced hills and also a
 * beachside"). Each person's own pick, kept in their own browser. Forest where nobody has picked.
 */
describe("the ground behind the garden: each person's own pick", () => {
  const picked = () => screen.getByTestId("ground").textContent;

  it("holds the four grounds the founder named, and forest is the default", () => {
    expect(GARDEN_GROUND_KEYS).toEqual(["forest", "valley", "hills", "beach"]);
    expect(DEFAULT_GARDEN_GROUND).toBe("forest");
    show(<GroundProbe />);
    expect(picked()).toBe("forest");
    // A person who never picked has nothing kept.
    expect(localStorage.getItem(GARDEN_GROUND_PICK_KEY)).toBeNull();
  });

  it("is one named group of four real buttons, each a finger tall, in the lens toggle's look, with the one showing marked", () => {
    show(<GroundProbe />);
    const buttons = within(groundPicker()).getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["Forest", "Valley", "Terraced hills", "Beachside"]);
    for (const b of buttons) {
      expect(b.tagName).toBe("BUTTON");
      expect(b.getAttribute("type")).toBe("button");
      expect(b.className.split(/\s+/)).toContain("min-h-11");
      expect(b.hasAttribute("aria-pressed")).toBe(true);
    }
    expect(buttons.map((b) => b.getAttribute("aria-pressed"))).toEqual(["true", "false", "false", "false"]);
    expect(groundPicker().className.split(/\s+/)).toContain("gd-lens");
    // Names and no pictures: a picker of thumbnails would fetch all four grounds.
    expect(groundPicker().querySelector("img, svg, picture")).toBeNull();
  });

  it("marks the ground a person picks, and remembers it in their own browser", () => {
    const first = show(<GroundProbe />);
    fireEvent.click(groundChoice("hills"));
    expect(picked()).toBe("hills");
    expect(within(groundPicker()).getAllByRole("button").map((b) => b.getAttribute("aria-pressed"))).toEqual(["false", "false", "true", "false"]);
    expect(localStorage.getItem(GARDEN_GROUND_PICK_KEY)).toBe("hills");
    first.unmount();
    // The next visit asks the browser again.
    forgetPageCopy();
    show(<GroundProbe />);
    expect(picked()).toBe("hills");
  });

  it("is each person's own where two share a browser", () => {
    const ana = showFor("ana", <GroundProbe />);
    fireEvent.click(groundChoice("beach"));
    expect(localStorage.getItem(`${GARDEN_GROUND_PICK_KEY}:ana`)).toBe("beach");
    expect(localStorage.getItem(GARDEN_GROUND_PICK_KEY)).toBeNull();
    ana.unmount();
    showFor("ben", <GroundProbe />);
    expect(picked()).toBe("forest");
  });

  it("reads a kept value that is no ground as forest", () => {
    for (const junk of ["desert", "FOREST", "", "ground-forest.webp", '{"ground":"beach"}']) {
      localStorage.setItem(GARDEN_GROUND_PICK_KEY, junk);
      forgetPageCopy();
      const page = show(<GroundProbe />);
      expect(picked(), junk).toBe("forest");
      expect(groundChoice("forest").getAttribute("aria-pressed"), junk).toBe("true");
      page.unmount();
    }
  });

  it("keeps every reader on the page in step, and sends a pick nowhere", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    show(
      <>
        <GroundProbe />
        <GroundEcho />
      </>,
    );
    fireEvent.click(groundChoice("valley"));
    expect(screen.getByTestId("ground-echo").textContent).toBe("valley");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("says its line warm and plain, and in its brief form when the person asked for brief and quiet", () => {
    show(
      <>
        <GroundProbe />
        <QuietSwitch />
      </>,
    );
    expect(screen.getByText("Pick the ground behind your garden. It changes only your own screen.")).toBeTruthy();
    // The line is the group's description, so a screen reader hears whose screen it changes.
    expect(groundPicker()).toHaveAccessibleDescription("Pick the ground behind your garden. It changes only your own screen.");
    fireEvent.click(screen.getByRole("button", { name: "brief and quiet" }));
    expect(screen.queryByText("Pick the ground behind your garden. It changes only your own screen.")).toBeNull();
    expect(screen.getByText("Your ground. Only your screen.")).toBeTruthy();
    expect(groundPicker()).toHaveAccessibleDescription("Your ground. Only your screen.");
  });
});

/**
 * THE LAND DRAWS IT. The village's own land art first; otherwise the person's pick; and under both, always, the land's
 * own painted colours.
 */
describe("the land: the village's own art, then the person's pick, and only one picture ever named", () => {
  /** How many times the document names a painted ground, anywhere: an attribute, a style, a picture. */
  const groundsNamed = () => document.documentElement.outerHTML.split("/images/garden/ground-").length - 1;

  it("draws the person's pick behind the places, with the picker above the land", () => {
    show(<Grounds places={ALL} />);
    const map = screen.getByRole("navigation", { name: "The grounds" });
    expect(map.getAttribute("data-picker")).toBe("true");
    // The picker is the Grounds' own, above the land in the document, so it is met before the places.
    expect(groundPicker().closest(".gd-grounds")).toBe(map);
    expect(groundPicker().compareDocumentPosition(theLand()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(groundChoice("beach"));
    expect(theLand().getAttribute("data-land")).toBe("ground");
    expect(theLand().getAttribute("data-ground")).toBe("beach");
    expect(theLand().style.getPropertyValue("--gd-land-image")).toBe('url("/images/garden/ground-beach.webp")');
    expect(groundChoice("beach").getAttribute("aria-pressed")).toBe("true");
    // All ten places are still there, each a link, after the ground changes.
    expect(within(map).getAllByRole("link")).toHaveLength(10);
  });

  it("names ONLY the picked ground in the whole document: the other three are never asked for", () => {
    show(<Grounds places={ALL} />);
    for (const ground of [...GARDEN_GROUND_KEYS].reverse()) {
      fireEvent.click(groundChoice(ground));
      const html = document.documentElement.outerHTML;
      expect(html, ground).toContain(gardenGroundUrl(ground));
      for (const other of GARDEN_GROUND_KEYS.filter((g) => g !== ground)) expect(html, `${other} while ${ground} shows`).not.toContain(gardenGroundUrl(other));
      // Named once, as the land's own picture, and by no picture element anywhere.
      expect(groundsNamed(), ground).toBe(1);
      expect(Array.from(document.querySelectorAll("img, source, link")).some((el) => el.outerHTML.includes("ground-")), ground).toBe(false);
    }
  });

  it("puts the village's own land art first, whatever the person picked, and draws no picker: there is nothing to pick", () => {
    localStorage.setItem(GARDEN_GROUND_PICK_KEY, "beach");
    show(<Grounds places={ALL} landImageUrl="/uploads/land/our-land.webp" />);
    const map = screen.getByRole("navigation", { name: "The grounds" });
    expect(theLand().getAttribute("data-land")).toBe("own");
    expect(theLand().hasAttribute("data-ground")).toBe(false);
    expect(theLand().style.getPropertyValue("--gd-land-image")).toBe('url("/uploads/land/our-land.webp")');
    expect(screen.queryByRole("group", { name: "The ground behind your garden" })).toBeNull();
    expect(map.querySelector(".gd-ground-picker")).toBeNull();
    expect(map.hasAttribute("data-picker")).toBe(false);
    // No stock ground is named at all under a village's own land.
    expect(groundsNamed()).toBe(0);
    // And the person's own pick is still kept for a village with no land art.
    expect(localStorage.getItem(GARDEN_GROUND_PICK_KEY)).toBe("beach");
  });

  it("reads an empty land art address as none, and falls back to the person's pick", () => {
    show(<Grounds places={ALL} landImageUrl="   " />);
    expect(theLand().getAttribute("data-land")).toBe("ground");
    expect(theLand().getAttribute("data-ground")).toBe("forest");
    expect(groundPicker()).toBeTruthy();
  });

  it("shares one row with the page's own heading, so the picker stands at the end of the row the heading starts", () => {
    show(<Grounds places={ALL} heading={<h2>The grounds tonight</h2>} />);
    const head = document.querySelector(".gd-grounds-head")!;
    expect(within(head as HTMLElement).getByRole("heading", { name: "The grounds tonight" })).toBeTruthy();
    expect(groundPicker().closest(".gd-grounds-head")).toBe(head);
    // The heading first, the picker after it, and both before the land.
    expect(screen.getByRole("heading", { name: "The grounds tonight" }).compareDocumentPosition(groundPicker()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(head.compareDocumentPosition(theLand()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps the heading and drops the row's picker under a village's own land art; with neither there is no row", () => {
    const own = show(<Grounds places={ALL} heading={<h2>Our land</h2>} landImageUrl="/uploads/land/our-land.webp" />);
    expect(screen.getByRole("heading", { name: "Our land" }).closest(".gd-grounds-head")).toBeTruthy();
    expect(document.querySelector(".gd-ground-picker")).toBeNull();
    own.unmount();
    show(<Grounds places={ALL} landImageUrl="/uploads/land/our-land.webp" />);
    expect(document.querySelector(".gd-grounds-head")).toBeNull();
  });
});

/**
 * THE LAND IS NEVER BLANK, and a place never loses its lantern or its name, whatever happens to the pictures. This is
 * the test that matters most here.
 */
describe("the land is never blank, whatever happens to the pictures", () => {
  /** What must still be true of the page once every picture has failed. */
  function expectTheLandStands() {
    const map = screen.getByRole("navigation", { name: "The grounds" });
    expect(document.querySelectorAll("img")).toHaveLength(0);

    // All ten places, each still a link with its name in sight on its plaque and its lantern beside it.
    const places = within(map).getAllByRole("link");
    expect(places.map((p) => p.getAttribute("data-place"))).toEqual([...GARDEN_PLACE_KEYS]);
    for (const place of places) {
      const key = place.getAttribute("data-place") as keyof typeof GARDEN_PLACES;
      const plaque = place.querySelector(".gd-plaque")!;
      expect(plaque.querySelector(".gd-place-name")?.textContent, key).toBe(i18n._(GARDEN_PLACES[key].name));
      expect(plaque.querySelectorAll(".gd-lantern"), key).toHaveLength(1);
    }
    expect(places.filter((p) => p.querySelector('.gd-lantern[data-lit="true"]')).map((p) => p.getAttribute("data-place"))).toEqual(["fire", "hall"]);
    expect(within(map).getByRole("link", { name: "The Hall, 3 waiting" })).toBeTruthy();
    expect(within(map).getByRole("link", { name: "The Library", description: "Words and agreements Nothing waiting." })).toBeTruthy();

    // THE LAND ITSELF. Its picture is a layer in the stylesheet, which has no error to raise here, so what holds
    // the land is structure, in three parts.
    const land = map.querySelector(".gd-land") as HTMLElement;
    // 1. The Grounds hand the land one thing inline, the picture's address. Never a background of their own, which
    //    would replace the painted colours.
    expect(Array.from({ length: land.style.length }, (_, i) => land.style.item(i))).toEqual(["--gd-land-image"]);
    expect(land.style.background).toBe("");
    expect(land.style.backgroundImage).toBe("");

    // 2. The land's own rule paints it from the garden's tokens: gradients over a solid ground, and no picture.
    const own = GARDEN_RULES.filter((r) => r.selector.split(",").some((s) => s.trim().endsWith(".gd-land")));
    const painted = own.filter((r) => /background(?:-image|-color)?\s*:/.test(r.body));
    expect(painted).toHaveLength(1);
    expect(painted[0].selector).toBe(".gd-land");
    expect(painted[0].body).toMatch(/background-color:\s*var\(--garden-band\);/);
    expect(painted[0].body).toMatch(/background-image:[^;]*linear-gradient\(var\(--garden-ground\), var\(--garden-ground\)\);/);
    expect(painted[0].body).not.toContain("url(");
    expect(painted[0].body).not.toContain("--gd-land-image");

    // 3. The picture is read only by the layer over the land, so a picture that never arrives draws nothing there
    //    and takes nothing away.
    const readers = GARDEN_RULES.filter((r) => r.body.includes("--gd-land-image"));
    expect(readers.length).toBeGreaterThanOrEqual(3);
    for (const r of readers) expect(r.selector.endsWith(".gd-land::before") || r.selector.endsWith('.gd-land[data-land="own"]::before'), r.selector).toBe(true);
    return land;
  }

  it("with every image failing, all ten places still show their names and their lanterns, and the land still has its painted colours", () => {
    show(<Grounds places={BUILT} />);
    const images = Array.from(document.querySelectorAll("img"));
    expect(images).toHaveLength(10);
    for (const img of images) fireEvent.error(img);
    const land = expectTheLandStands();
    // The ground is still named, so it is drawn the moment it can be: nothing was given up.
    expect(land.style.getPropertyValue("--gd-land-image")).toBe('url("/images/garden/ground-forest.webp")');
  });

  it("holds for every ground a person may pick, and for a village's own land art", () => {
    for (const ground of GARDEN_GROUND_KEYS) {
      const page = show(<Grounds places={BUILT} />);
      fireEvent.click(groundChoice(ground));
      for (const img of Array.from(document.querySelectorAll("img"))) fireEvent.error(img);
      expectTheLandStands();
      page.unmount();
    }
    show(<Grounds places={BUILT} landImageUrl="/uploads/land/missing.webp" />);
    for (const img of Array.from(document.querySelectorAll("img"))) fireEvent.error(img);
    expectTheLandStands();
  });

  it("holds as the small map and as the Desk's rows: a failed picture never takes a name or a lantern", () => {
    const small = show(<Grounds places={BUILT} compact />);
    for (const img of Array.from(document.querySelectorAll("img"))) fireEvent.error(img);
    expectTheLandStands();
    small.unmount();
    show(<Desk places={BUILT} />);
    for (const img of Array.from(document.querySelectorAll("img"))) fireEvent.error(img);
    const rows = within(screen.getByRole("navigation", { name: "Places" })).getAllByRole("link");
    expect(rows).toHaveLength(10);
    for (const row of rows) {
      expect(row.querySelector(".gd-place-name")?.textContent).toBeTruthy();
      expect(row.querySelectorAll(".gd-lantern")).toHaveLength(1);
    }
  });
});

/**
 * A REAL LANTERN IS NEVER MISTAKEN FOR A PAINTED ONE. The grounds carry small painted lanterns (the founder, 28 Nov
 * 2026: "We can keep the lanterns"). A real one lives on the place's own label, has exactly two states, and says its
 * state in words.
 */
describe("a real lantern is never mistaken for a painted one", () => {
  it("lives on the place's own label: inside the plaque, with the name, and nowhere else on the land", () => {
    show(<Grounds places={BUILT} />);
    const land = theLand();
    const lanterns = Array.from(land.querySelectorAll(".gd-lantern"));
    expect(lanterns).toHaveLength(10);
    for (const lantern of lanterns) {
      const plaque = lantern.closest(".gd-plaque");
      expect(plaque).toBeTruthy();
      // The same plaque carries the name: the lantern and the name are one label.
      expect(plaque?.querySelector(".gd-place-name")?.textContent).toBeTruthy();
      // One place, one lantern.
      expect(lantern.closest(".gd-place")?.querySelectorAll(".gd-lantern")).toHaveLength(1);
    }
    // Nothing else on the land is a lantern: not the land, not a path, not a building.
    expect(land.querySelectorAll(".gd-lantern")).toHaveLength(land.querySelectorAll(".gd-plaque .gd-lantern").length);
    for (const el of [land, ...Array.from(land.querySelectorAll(".gd-paths, .gd-sprite, .gd-places, li"))]) expect(el.classList.contains("gd-lantern")).toBe(false);
    // And the picker above the land names grounds; it lights nothing.
    expect(document.querySelectorAll(".gd-lantern")).toHaveLength(10);
  });

  it("stands on its plaque's own wood, which no ground shows through", () => {
    // The plaque under a lantern on the map is solid wood with a gold edge, in the full map and the small one.
    const plaques = GARDEN_RULES.filter((r) => r.selector.endsWith('.gd-place[data-lens="grounds"] .gd-plaque'));
    expect(plaques).toHaveLength(2);
    for (const plaque of plaques) {
      expect(plaque.body).toMatch(/background-color:\s*var\(--garden-wood\);/);
      expect(plaque.body).toMatch(/border-color:\s*color-mix\(in srgb, var\(--garden-gold-deep\) 80%, var\(--garden-gold\)\);/);
    }
    // Wood is the gold in shadow taken down to dark: no part of it is see-through.
    const wood = GARDEN_RULES.find((r) => r.selector === ".garden")?.body.match(/--garden-wood:\s*([^;]+);/)?.[1];
    expect(wood).toBe("color-mix(in srgb, var(--garden-gold-deep) 22%, black)");
  });

  it("has exactly two states, lit and dark, whatever count it is given", () => {
    const cases: Array<[number, "true" | "false"]> = [
      [0, "false"],
      [1, "true"],
      [7, "true"],
      [250, "true"],
      [0.4, "false"],
      [-3, "false"],
      [Number.NaN, "false"],
      [Number.POSITIVE_INFINITY, "false"],
    ];
    for (const [waiting, lit] of cases) {
      const page = show(<Place place="hall" waiting={waiting} href="/x" />);
      const lantern = page.container.querySelector(".gd-lantern")!;
      expect(lantern.getAttribute("data-lit"), String(waiting)).toBe(lit);
      // One switch and no other: nothing else on the lantern can make a third look.
      expect(lantern.getAttributeNames().filter((a) => a.startsWith("data-")), String(waiting)).toEqual(["data-lit"]);
      expect(lantern.className.trim(), String(waiting)).toBe("gd-lantern");
      page.unmount();
    }
    // The stylesheet draws those two and no third: the lantern, and the lantern lit.
    expect(GARDEN_RULES.filter((r) => r.selector.includes(".gd-lantern")).map((r) => r.selector)).toEqual([".gd-lantern", '.gd-lantern[data-lit="true"]']);
  });

  it("says its state in words: lit in the place's name, dark in its description", () => {
    show(
      <>
        <Place place="hall" waiting={3} href="/a" />
        <Place place="library" href="/b" />
        <Place place="stage" scaffolding href="/c" />
      </>,
    );
    // Lit: the name says what waits.
    const lit = screen.getByRole("link", { name: "The Hall, 3 waiting" });
    expect(lit.querySelector(".gd-lantern")?.getAttribute("data-lit")).toBe("true");
    expect(lit).toHaveAccessibleDescription(i18n._(GARDEN_PLACES.hall.holds));

    // Dark: the description says nothing waits.
    const dark = screen.getByRole("link", { name: "The Library" });
    expect(dark.querySelector(".gd-lantern")?.getAttribute("data-lit")).toBe("false");
    expect(dark).toHaveAccessibleDescription("Words and agreements Nothing waiting.");
    const [, words] = describedBy(dark);
    expect(words.textContent).toBe("Nothing waiting.");
    // For a screen reader alone: out of sight and out of the reading order, and still what the description points at.
    expect(words.hidden).toBe(true);
    expect(words.closest(".gd-plaque")).toBe(dark.querySelector(".gd-plaque"));

    // The light itself is decoration: the words carry its state.
    for (const lantern of Array.from(document.querySelectorAll(".gd-lantern"))) expect(lantern.getAttribute("aria-hidden")).toBe("true");

    // Under scaffolding there is no lantern, so there are no lantern words: the name says it is not built yet.
    const unbuilt = screen.getByRole("link", { name: "The Stage, not built yet" });
    expect(unbuilt.querySelector(".gd-lantern")).toBeNull();
    expect(describedBy(unbuilt)).toHaveLength(1);
    expect(unbuilt).toHaveAccessibleDescription(i18n._(GARDEN_PLACES.stage.holds));
  });

  it("says a dark lantern on the Desk's rows too, after the caller's own line", () => {
    show(<Place place="gate" lens="desk" note="Two people are new this moon" href="/b" />);
    expect(screen.getByRole("link", { name: "The Gate" })).toHaveAccessibleDescription("Two people are new this moon Nothing waiting.");
  });
});
