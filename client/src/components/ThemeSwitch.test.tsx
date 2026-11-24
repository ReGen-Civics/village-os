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
    expect(screen.queryByRole("group", { name: "Light or dark" })).toBeNull();
  });

  it("shows for a tester who already holds a choice, with that choice pressed", () => {
    localStorage.setItem(MODE_KEY, "dark");
    document.documentElement.dataset.mode = "dark";
    draw(false);
    expect(screen.getByRole("button", { name: "Dark" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Light" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("flips the page at once and remembers it", () => {
    draw(true);
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    expect(document.documentElement.dataset.mode).toBe("dark");
    expect(localStorage.getItem(MODE_KEY)).toBe("dark");
    expect(screen.getByRole("button", { name: "Dark" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Light" }));
    expect(document.documentElement.dataset.mode).toBe("light");
    expect(localStorage.getItem(MODE_KEY)).toBe("light");
  });
});
