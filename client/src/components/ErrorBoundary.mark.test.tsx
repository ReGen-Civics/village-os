// @vitest-environment jsdom
/**
 * The refresh screen wears the village's own mark (the lead, 24 Nov 2026): its
 * logo, else its heart logo, else the platform's sprout, and the sprout again
 * when the image will not load. White-label: nothing here names a village.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";

const brand = vi.hoisted(() => ({ images: {} as { logo?: string; heartLogo?: string } }));
vi.mock("@/lib/gameApi", () => ({ useBrandImages: () => brand.images }));
vi.mock("@/lib/crashReport", () => ({ reportCrash: () => false }));

import ErrorBoundary from "./ErrorBoundary";

function Boom(): never {
  throw new Error("a crash for the test");
}

function crash() {
  vi.spyOn(console, "error").mockImplementation(() => {});
  i18n.loadAndActivate({ locale: "en", messages: {} });
  return render(
    <I18nProvider i18n={i18n}>
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    </I18nProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("the refresh screen's mark", () => {
  it("is the village's logo when it set one, and says the crash plainly", () => {
    brand.images = { logo: "/api/uploads/village-logo.webp", heartLogo: "/api/uploads/heart.webp" };
    const { container } = crash();
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/api/uploads/village-logo.webp");
    expect(screen.getByText("We're growing")).toBeTruthy();
    expect(screen.queryByText("A small stumble")).toBeNull();
  });

  it("is the heart logo when there is no logo, and the sprout when there is neither", () => {
    brand.images = { heartLogo: "/api/uploads/heart.webp" };
    const first = crash();
    expect(first.container.querySelector("img")?.getAttribute("src")).toBe("/api/uploads/heart.webp");
    cleanup();
    brand.images = {};
    const second = crash();
    expect(second.container.querySelector("img")).toBeNull();
    expect(second.container.querySelector("svg.jw-unfurl")).not.toBeNull();
  });

  it("falls back to the sprout when the image does not load", () => {
    brand.images = { logo: "/api/uploads/gone.webp" };
    const { container } = crash();
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg.jw-unfurl")).not.toBeNull();
  });
});
