// @vitest-environment jsdom
/**
 * WHAT THE GARDEN REMEMBERS: the lens a person left open and their own names
 * for the places, in their own browser and nowhere else.
 *
 * The case that matters most is the browser that refuses. Chrome with site
 * data blocked throws on reading `window.localStorage` itself, and Safari's
 * private mode throws on `setItem`. In both the garden still renders, still
 * takes a rename and a lens for as long as the page is open, and never throws.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import type { ReactElement } from "react";
import { Garden, GARDEN_LENS_KEY, GARDEN_NAMES_KEY, LensToggle, Place, RenamePlace, useGardenLens, usePlaceNames, type GardenSettings } from "./index";
import { forgetPageCopy } from "./gardenMemory";
import { readOwnPlaceNames } from "./placeNames";

const realStorage = Object.getOwnPropertyDescriptor(window, "localStorage");

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  localStorage.clear();
  forgetPageCopy();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (realStorage) Object.defineProperty(window, "localStorage", realStorage);
});

const show = (ui: ReactElement, settings: GardenSettings = {}) =>
  render(
    <I18nProvider i18n={i18n}>
      <Garden {...settings}>{ui}</Garden>
    </I18nProvider>,
  );

/** The browser's width, as the lens hook asks for it. */
function screenIs(wide: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: wide && q.includes("min-width: 1024px"), media: q, addEventListener: () => {}, removeEventListener: () => {} }));
}

function LensProbe() {
  const { lens, setLens } = useGardenLens();
  return (
    <>
      <p data-testid="lens">{lens}</p>
      <LensToggle lens={lens} onChange={setLens} />
    </>
  );
}

function NamesProbe() {
  const names = usePlaceNames();
  return (
    <p data-testid="names">
      {names.nameOf("hall")}|{names.villageNameOf("hall")}|{String(names.isRenamed("hall"))}|{names.nameOf("gate")}
    </p>
  );
}

describe("useGardenLens", () => {
  it("opens on the Grounds where there is room for the map, and on the Desk where there is not", () => {
    screenIs(true);
    const wide = show(<LensProbe />);
    expect(screen.getByTestId("lens").textContent).toBe("grounds");
    wide.unmount();
    screenIs(false);
    show(<LensProbe />);
    expect(screen.getByTestId("lens").textContent).toBe("desk");
  });

  it("remembers the person's last choice in their browser, whatever the screen", () => {
    screenIs(true);
    const first = show(<LensProbe />);
    fireEvent.click(screen.getByRole("button", { name: "The Desk" }));
    expect(screen.getByTestId("lens").textContent).toBe("desk");
    expect(localStorage.getItem(GARDEN_LENS_KEY)).toBe("desk");
    first.unmount();
    forgetPageCopy();
    show(<LensProbe />);
    expect(screen.getByTestId("lens").textContent).toBe("desk");
  });

  it("keeps two people who share a browser apart", () => {
    screenIs(true);
    const one = show(<LensProbe />, { personKey: "7" });
    fireEvent.click(screen.getByRole("button", { name: "The Desk" }));
    expect(localStorage.getItem(`${GARDEN_LENS_KEY}:7`)).toBe("desk");
    one.unmount();
    show(<LensProbe />, { personKey: "8" });
    expect(screen.getByTestId("lens").textContent).toBe("grounds");
  });

  it("ignores a stored value that is no lens", () => {
    screenIs(true);
    localStorage.setItem(GARDEN_LENS_KEY, "sideways");
    show(<LensProbe />);
    expect(screen.getByTestId("lens").textContent).toBe("grounds");
  });
});

describe("usePlaceNames and RenamePlace", () => {
  it("shows the platform's names until the person gives one of their own, and every reader on the page follows", () => {
    show(
      <>
        <NamesProbe />
        <Place place="hall" href="/x" waiting={2} />
        <RenamePlace place="hall" />
      </>,
    );
    expect(screen.getByTestId("names").textContent).toBe("The Hall|The Hall|false|The Gate");
    expect(screen.queryByRole("button", { name: "Use the village's name again" })).toBeNull();

    fireEvent.change(screen.getByLabelText("Your name for The Hall"), { target: { value: "  The   Longhouse " } });
    fireEvent.click(screen.getByRole("button", { name: "Keep this name" }));

    expect(screen.getByTestId("names").textContent).toBe("The Longhouse|The Hall|true|The Gate");
    expect(screen.getByRole("link", { name: "The Longhouse, 2 waiting" })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(GARDEN_NAMES_KEY)!)).toEqual({ hall: "The Longhouse" });

    fireEvent.click(screen.getByRole("button", { name: "Use the village's name again" }));
    expect(screen.getByTestId("names").textContent).toBe("The Hall|The Hall|false|The Gate");
    expect(localStorage.getItem(GARDEN_NAMES_KEY)).toBeNull();
  });

  it("puts the village's own name before the platform's, and the person's own before both", () => {
    show(
      <>
        <NamesProbe />
        <RenamePlace place="hall" />
      </>,
      { villageNames: { hall: "The Rancho" } },
    );
    expect(screen.getByTestId("names").textContent).toBe("The Rancho|The Rancho|false|The Gate");
    fireEvent.change(screen.getByLabelText("Your name for The Rancho"), { target: { value: "My desk" } });
    fireEvent.click(screen.getByRole("button", { name: "Keep this name" }));
    expect(screen.getByTestId("names").textContent).toBe("My desk|The Rancho|true|The Gate");
  });

  it("clears the person's name when they type nothing, or the village's own name", () => {
    localStorage.setItem(GARDEN_NAMES_KEY, JSON.stringify({ hall: "The Longhouse" }));
    show(
      <>
        <NamesProbe />
        <RenamePlace place="hall" />
      </>,
    );
    expect(screen.getByTestId("names").textContent).toBe("The Longhouse|The Hall|true|The Gate");
    fireEvent.change(screen.getByLabelText("Your name for The Hall"), { target: { value: "The Hall" } });
    fireEvent.click(screen.getByRole("button", { name: "Keep this name" }));
    expect(screen.getByTestId("names").textContent).toBe("The Hall|The Hall|false|The Gate");
  });

  it("reads only real names for real places out of what the browser kept", () => {
    expect(readOwnPlaceNames(null)).toEqual({});
    expect(readOwnPlaceNames("not json")).toEqual({});
    expect(readOwnPlaceNames("[1,2]")).toEqual({});
    expect(readOwnPlaceNames(JSON.stringify({ hall: "  The Longhouse ", moon: "No such place", gate: 7, store: "   " }))).toEqual({ hall: "The Longhouse" });
  });

  it("never sends a name anywhere: a rename makes no request", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    show(<RenamePlace place="gate" />);
    fireEvent.change(screen.getByLabelText("Your name for The Gate"), { target: { value: "The Arch" } });
    fireEvent.click(screen.getByRole("button", { name: "Keep this name" }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("a browser that refuses storage", () => {
  const page = (
    <>
      <NamesProbe />
      <LensProbe />
      <Place place="hall" href="/x" />
      <RenamePlace place="hall" />
    </>
  );

  function renameAndSwitch() {
    expect(screen.getByTestId("names").textContent).toBe("The Hall|The Hall|false|The Gate");
    act(() => {
      fireEvent.change(screen.getByLabelText("Your name for The Hall"), { target: { value: "The Longhouse" } });
      fireEvent.click(screen.getByRole("button", { name: "Keep this name" }));
      fireEvent.click(screen.getByRole("button", { name: "The Desk" }));
    });
    // Nothing could be stored, and the page still holds both for as long as it is open.
    expect(screen.getByTestId("names").textContent).toBe("The Longhouse|The Hall|true|The Gate");
    expect(screen.getByRole("link", { name: "The Longhouse" })).toBeTruthy();
    expect(screen.getByTestId("lens").textContent).toBe("desk");
  }

  it("renders and still works when reading window.localStorage itself throws", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Access is denied for this document.", "SecurityError");
      },
    });
    screenIs(true);
    expect(() => show(page)).not.toThrow();
    renameAndSwitch();
  });

  it("renders and still works when every call on the store throws", () => {
    for (const method of ["getItem", "setItem", "removeItem"] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      });
    }
    screenIs(true);
    expect(() => show(page)).not.toThrow();
    renameAndSwitch();
  });
});

describe("the rename field", () => {
  it("is at least a finger tall", () => {
    render(
      <I18nProvider i18n={i18n}>
        <Garden>
          <RenamePlace place="hall" />
        </Garden>
      </I18nProvider>,
    );
    expect(screen.getByRole("textbox").className).toContain("min-h-11");
  });
});
