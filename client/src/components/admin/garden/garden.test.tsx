// @vitest-environment jsdom
/**
 * THE GARDEN'S PIECES, RENDERED: each one's accessible name and its states.
 *
 * What these hold, piece by piece: a place says the whole of itself to a screen
 * reader ("The Hall, 3 waiting") and its lantern follows what waits; the
 * stepping stones are an ordered list with exactly one current step; fireflies
 * are decoration, around one child, and only where the caller asks; the circle
 * keeps the caller's order; the seed says its count in words and never as a
 * meter; the Grounds draw every place by percentage on the village's land or
 * the painted default.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import type { ReactElement } from "react";
import { GARDEN_PLACE_KEYS, gardenSpriteUrl } from "@shared/gardenArt";
import { Circle, Desk, Fireflies, Garden, GardenFrame, Grounds, Lantern, LensToggle, Place, SeedOfLife, StatusBand, SteppingStones, useGardenDock, type GardenPlaceState, type Stone } from "./index";
import { cssUrl, groundsPaths } from "./Grounds";
import { forgetPageCopy } from "./gardenMemory";
import { GARDEN_PLACES } from "./places";

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
    expect(link.getAttribute("aria-describedby")).toBeTruthy();
    expect(document.getElementById(link.getAttribute("aria-describedby")!)?.textContent).toBe("Words and agreements");
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

  it("stands on the painted default until the village has a land image of its own", () => {
    const { container, unmount } = show(<Grounds places={ALL} />);
    const painted = container.querySelector(".gd-land") as HTMLElement;
    expect(painted.getAttribute("data-land")).toBe("painted");
    expect(painted.style.getPropertyValue("--gd-land-image")).toBe("");
    unmount();
    const own = show(<Grounds places={ALL} landImageUrl="/uploads/land/our-land.webp" />);
    const land = own.container.querySelector(".gd-land") as HTMLElement;
    expect(land.getAttribute("data-land")).toBe("own");
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
    expect(document.getElementById(library.getAttribute("aria-describedby")!)?.className ?? "").not.toContain("sr-only");
    const gate = screen.getByRole("link", { name: "The Gate, 2 waiting" });
    expect(document.getElementById(gate.getAttribute("aria-describedby")!)?.className ?? "").not.toContain("sr-only");
    expect(described(gate)).toBe(i18n._(GARDEN_PLACES.gate.holds));
  });
});
