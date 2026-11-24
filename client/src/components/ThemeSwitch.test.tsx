// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { beforeEach, describe, expect, it } from "vitest";
import ThemeSwitch from "./ThemeSwitch";
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
