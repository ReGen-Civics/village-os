// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ThemeSwitch, { logoMaskUrl, useLogoMask } from "./ThemeSwitch";
import { MODE_KEY } from "@/lib/colourMode";

i18n.loadAndActivate({ locale: "en", messages: {} });
const draw = (live?: boolean) =>
  render(
    <I18nProvider i18n={i18n}>
      <ThemeSwitch live={live} />
    </I18nProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-mode");
});

describe("ThemeSwitch", () => {
  it("is hidden before modes are live, for a visitor who has never chosen", () => {
    draw(false);
    expect(screen.queryByRole("button", { name: /Switch to/ })).toBeNull();
  });

  it("shows for a tester who already holds a choice: the mode it is in, small, and what a tap does", () => {
    localStorage.setItem(MODE_KEY, "dark");
    document.documentElement.dataset.mode = "dark";
    draw(false);
    const b = screen.getByRole("button", { name: "Switch to light mode" });
    expect(b.textContent).toBe("Dark");
  });

  it("flips the page at once, both ways, and remembers it", () => {
    document.documentElement.dataset.mode = "light";
    draw(true);
    fireEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));
    expect(document.documentElement.dataset.mode).toBe("dark");
    expect(localStorage.getItem(MODE_KEY)).toBe("dark");
    fireEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));
    expect(document.documentElement.dataset.mode).toBe("light");
    expect(localStorage.getItem(MODE_KEY)).toBe("light");
  });
});

describe("the logo's mask", () => {
  it("is a same-origin PNG whose address moves with the logo's", () => {
    const a = logoMaskUrl("https://example.test/mark.svg");
    expect(a).toMatch(/^\/api\/brand\/logo-mark\.png\?v=[0-9a-z]+$/);
    expect(logoMaskUrl("https://example.test/mark-2.svg")).not.toBe(a);
    expect(logoMaskUrl("https://example.test/mark.svg")).toBe(a);
  });

  function Probe({ src }: { src: string }) {
    const p = useLogoMask(src);
    return <span data-testid="probe" data-mask={p["data-mask"]} style={p.style} />;
  }

  it("repaints nothing until the mask has loaded, and nothing at all while no mode is set", async () => {
    const made: { onload: null | (() => void); src: string }[] = [];
    vi.stubGlobal("Image", class { onload: null | (() => void) = null; src = ""; constructor() { made.push(this); } });
    render(<Probe src="https://example.test/mark.svg" />);
    expect(made).toHaveLength(0);
    document.documentElement.dataset.mode = "light";
    const { getAllByTestId } = render(<Probe src="https://example.test/mark.svg" />);
    expect(made).toHaveLength(1);
    expect(getAllByTestId("probe")[1].hasAttribute("data-mask")).toBe(false);
    act(() => made[0].onload?.());
    expect(getAllByTestId("probe")[1].hasAttribute("data-mask")).toBe(true);
    expect(getAllByTestId("probe")[1].style.getPropertyValue("--logo-src")).toContain("/api/brand/logo-mark.png?v=");
    vi.unstubAllGlobals();
  });
});
