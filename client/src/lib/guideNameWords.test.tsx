// @vitest-environment jsdom
/**
 * THE UNNAMED GUIDE IN THE READER'S LANGUAGE (front-door review, 24 Nov 2026: a Spanish reader met "Hola, soy the
 * village guide"). client/src/lib/guideNameWords.ts says the neutral label through Lingui, es.po carries the
 * Spanish, and a name a village typed is never translated: Amora's guide stays "Maia" in Spanish (the lead,
 * 24 Nov 2026). The names here other than that one are invented.
 */
import path from "node:path";
import { i18n as appI18n, setupI18n, type I18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { generateMessageId } from "@lingui/message-utils/generateMessageId";
// @ts-expect-error - scripts/ is untyped JavaScript, deliberately outside tsconfig
import { mergedPoText } from "../../../scripts/lib/poFragments.mjs";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UNNAMED_GUIDE } from "@shared/guideName";
import { guideLabelIn, guideNameIn, unnamedGuideWords } from "./guideNameWords";

vi.mock("@/components/MicButton", () => ({ default: () => null }));
vi.mock("@/lib/proposals", () => ({ sendProposal: async () => ({ ok: true, idea: null }) }));
const guideAnswer = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("@/lib/guideApi", () => ({ fetchGuide: async () => guideAnswer.value }));

import GuideChat from "@/components/GuideChat";
import { useGuideName } from "@/hooks/useGuideName";

/** Every single-line entry of es.po, with the pending es.d fragments folded in as the build folds them, by the id Lingui gives it at runtime. */
function spanishMessages(): Record<string, string> {
  const po = mergedPoText(path.resolve(__dirname, "../locales"), "es");
  const messages: Record<string, string> = {};
  const entry = /(?:^msgctxt "((?:[^"\\]|\\.)*)"\r?\n)?^msgid "((?:[^"\\]|\\.)+)"\r?\nmsgstr "((?:[^"\\]|\\.)+)"$/gm;
  const unquote = (s: string) => JSON.parse(`"${s}"`) as string;
  for (let m = entry.exec(po); m; m = entry.exec(po)) messages[generateMessageId(unquote(m[2]), m[1] === undefined ? undefined : unquote(m[1]))] = unquote(m[3]);
  return messages;
}
const spanish = (): I18n => setupI18n({ locale: "es", messages: { es: spanishMessages() } });
const en = setupI18n({ locale: "en", messages: { en: {} } });
const es = spanish();

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the unnamed guide's label", () => {
  it("in English is exactly shared/guideName.ts's own words", () => {
    expect(unnamedGuideWords(en)).toEqual({ own: UNNAMED_GUIDE.own, shared: UNNAMED_GUIDE.shared });
    expect(guideNameIn("", "member", en)).toEqual({ name: "the village guide", named: false });
    expect(guideNameIn(undefined, "founder", en)).toEqual({ name: "your village guide", named: false });
  });

  it("in Spanish comes from es.po, for each reader", () => {
    expect(guideNameIn("", "public", es)).toEqual({ name: "la guía de la aldea", named: false });
    expect(guideNameIn("  ", "member", es)).toEqual({ name: "la guía de la aldea", named: false });
    expect(guideNameIn(null, "founder", es)).toEqual({ name: "su guía de la aldea", named: false });
    expect(guideNameIn(null, "admin", es)).toEqual({ name: "su guía de la aldea", named: false });
  });

  it("a name the server already resolved: the English label is said in Spanish, keeping its capital", () => {
    expect(guideLabelIn("the village guide", es)).toBe("la guía de la aldea");
    expect(guideLabelIn("The village guide", es)).toBe("La guía de la aldea");
    expect(guideLabelIn("your village guide", es)).toBe("su guía de la aldea");
    expect(guideLabelIn("Your village guide", es)).toBe("Su guía de la aldea");
    expect(guideLabelIn("the village guide", en)).toBe("the village guide");
  });
});

describe("a village's own guide name is never translated", () => {
  it("Maia stays Maia in Spanish, for every reader and every path", () => {
    for (const audience of ["founder", "admin", "member", "public"] as const) {
      expect(guideNameIn("Maia", audience, es)).toEqual({ name: "Maia", named: true });
    }
    expect(guideLabelIn("Maia", es)).toBe("Maia");
    // An invented name with a word in it that looks Spanish-able stays exactly as typed too.
    expect(guideNameIn(" Little River ", "member", es)).toEqual({ name: "Little River", named: true });
  });
});

const inSpanish = (ui: ReactNode) => render(<I18nProvider i18n={es}>{ui}</I18nProvider>);
const chat = (assistantName: string, extra: { venture?: boolean; kind?: "work-with-us" | "quest-proposal" } = {}) =>
  inSpanish(
    <GuideChat kind={extra.kind ?? "work-with-us"} venture={extra.venture} projectName="Willowbrook" assistantName={assistantName} empty={{}} onSubmitted={() => {}} onFallback={() => {}} onRefineInForm={() => {}} />,
  );

describe("the guide's first message, in Spanish", () => {
  it("an unnamed guide says Hola, soy la guía de la aldea, never the English label", () => {
    Element.prototype.scrollTo = (() => {}) as typeof Element.prototype.scrollTo;
    chat(guideNameIn("", "public", es).name, { venture: true });
    expect(screen.getByText(/^Hola, soy la guía de la aldea\. Demos forma juntos a su emprendimiento/)).toBeTruthy();
    expect(document.body.textContent).not.toContain("the village guide");
  });

  it("the greeting a village did not write is Spanish too, for an offer and for a quest", () => {
    Element.prototype.scrollTo = (() => {}) as typeof Element.prototype.scrollTo;
    chat(guideNameIn("", "public", es).name);
    expect(screen.getByText(/^Hola, soy la guía de la aldea, y ayudo a las personas a dar forma a lo que quieren ofrecer a Willowbrook\./)).toBeTruthy();
    cleanup();
    chat(guideNameIn("", "public", es).name, { kind: "quest-proposal" });
    expect(screen.getByText(/^Hola, soy la guía de la aldea\. ¿Falta una misión en el tablero\?/)).toBeTruthy();
  });

  it("a named guide keeps its name: Hola, soy Maia", () => {
    Element.prototype.scrollTo = (() => {}) as typeof Element.prototype.scrollTo;
    chat(guideNameIn("Maia", "public", es).name, { venture: true });
    expect(screen.getByText(/^Hola, soy Maia\. Demos forma juntos/)).toBeTruthy();
  });
});

function Shown() {
  const guide = useGuideName();
  return <p data-testid="guide">{guide.loaded ? guide.name : ""}</p>;
}

describe("useGuideName, which most pages read the name through", () => {
  const serve = (assistantName: string) =>
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ assistantName }) })) as unknown as typeof fetch);

  it("says an unnamed guide in the reader's language", async () => {
    serve("");
    inSpanish(<Shown />);
    await waitFor(() => expect(screen.getByTestId("guide").textContent).toBe("la guía de la aldea"));
  });

  it("says Maia as Maia", async () => {
    serve("Maia");
    inSpanish(<Shown />);
    await waitFor(() => expect(screen.getByTestId("guide").textContent).toBe("Maia"));
  });
});

describe("the founder's Name your guide note, in Spanish", () => {
  it("says the note and the label others read in Spanish", async () => {
    const { default: NameYourGuide } = await import("@/components/NameYourGuide");
    const { Router } = await import("wouter");
    inSpanish(
      <Router>
        <NameYourGuide guide={guideNameIn("", "founder", es)} audience="founder" ready />
      </Router>,
    );
    expect(screen.getByText("Su guía de la aldea todavía no tiene nombre")).toBeTruthy();
    expect(screen.getByText(/ven “la guía de la aldea” hasta que le ponga nombre/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Póngale nombre a su guía/ })).toBeTruthy();
  });

  it("CONTROL: a named guide shows no note at all", async () => {
    const { default: NameYourGuide } = await import("@/components/NameYourGuide");
    inSpanish(<NameYourGuide guide={guideNameIn("Maia", "founder", es)} audience="founder" ready />);
    expect(document.body.textContent).toBe("");
  });
});

describe("a guide name the server sends, read where the page shows it", () => {
  it("the role proposal's AI help names an unnamed guide in Spanish and Maia as Maia", async () => {
    const { aiHelpStatus } = await import("@/components/roleProposal/aiHelp");
    appI18n.load("es", spanishMessages());
    appI18n.activate("es");
    try {
      guideAnswer.value = { answering: "village", options: [{ id: "village", name: "the village guide" }] };
      expect(await aiHelpStatus("words")).toMatchObject({ configured: true, guide: "La guía de la aldea" });
      guideAnswer.value = { answering: "village", options: [{ id: "village", name: "Maia" }] };
      expect(await aiHelpStatus("words")).toMatchObject({ configured: true, guide: "Maia" });
    } finally {
      appI18n.activate("en");
    }
  });
});
