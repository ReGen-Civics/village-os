// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { RIGHTS_RESIDENT_PAGE } from "@shared/pageContent/rights";
import { usePageTranslationFields } from "@/hooks/usePageContent";
import ReadingCopyNote from "./ReadingCopyNote";

function Probe() {
  const fields = usePageTranslationFields(RIGHTS_RESIDENT_PAGE);
  return <p data-testid="headline">{fields["hero.headline"] ?? "ENGLISH"}</p>;
}

function page() {
  return render(
    <I18nProvider i18n={i18n}>
      <ReadingCopyNote spec={RIGHTS_RESIDENT_PAGE} />
      <Probe />
    </I18nProvider>,
  );
}

const served = (translation: unknown) => vi.fn(async () => ({ ok: true, json: async () => ({ translation }) }) as Response);

describe("a binding page's reading copy says the English is binding, and gives the English back in one tap (the lead, 26 Nov 2026)", () => {
  beforeEach(() => {
    act(() => i18n.loadAndActivate({ locale: "es", messages: {} }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the reading copy under the note, and the binding English when asked", async () => {
    vi.stubGlobal("fetch", served({ fields: { "hero.headline": "Sus derechos" }, machine: [], locale: "es", readingCopy: true }));
    page();
    await waitFor(() => expect(screen.getByTestId("headline").textContent).toBe("Sus derechos"));
    const note = screen.getByRole("note");
    expect(note.getAttribute("data-reading-copy")).toBe("copy");
    // The binding sentence in English, always, whatever language the reader chose.
    expect(note.querySelector('[lang="en"]')?.textContent).toBe("The English text is the binding version.");

    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByTestId("headline").textContent).toBe("ENGLISH"));
    expect(screen.getByRole("note").getAttribute("data-reading-copy")).toBe("english");

    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByTestId("headline").textContent).toBe("Sus derechos"));
  });

  it("CONTROL: an ordinary translation draws no note", async () => {
    vi.stubGlobal("fetch", served({ fields: { "hero.headline": "Hola" }, machine: [], locale: "es" }));
    page();
    await waitFor(() => expect(screen.getByTestId("headline").textContent).toBe("Hola"));
    expect(screen.queryByRole("note")).toBeNull();
  });
});

describe("the English sentence is written out, never read from a catalog", () => {
  it("matches the message the reader's language translates", async () => {
    const { BINDING, BINDING_EN } = await import("./ReadingCopyNote");
    const { setupI18n } = await import("@lingui/core");
    expect(BINDING_EN).toBe(setupI18n({ locale: "en", messages: { en: {} } })._(BINDING));
  });
});
