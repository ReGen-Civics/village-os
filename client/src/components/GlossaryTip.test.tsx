// @vitest-environment jsdom
/**
 * A word the village explains, and the word is the tip (the lead, 27 Nov 2026: "tooltips should be on the word not
 * next to it"): plain text while the village has no sentence for it, and with one, the word itself is the button,
 * named by the word, described by the sentence, opened by a tap or a click and by keyboard focus, closed by Escape.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

let stored: unknown = null;
vi.mock("@/hooks/useVillageContent", () => ({ readVillageSection: () => Promise.resolve(stored) }));

import GlossaryTip, { GlossaryText } from "./GlossaryTip";
import { forgetGlossary } from "@/hooks/useGlossary";

beforeEach(() => forgetGlossary());
afterEach(() => cleanup());

const ROOT = "Your root is the kind of contribution you grow from.";

describe("the glossary word", () => {
  it("is plain text while the village has no sentence for it", async () => {
    stored = { domain: "The part you look after." };
    const { container } = render(<p>Choose the <GlossaryTip slot="root">root</GlossaryTip> you grow from</p>);
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.querySelector(".info-word")).toBeNull();
    expect(container.textContent).toBe("Choose the root you grow from");
  });

  it("is itself the trigger, named by the word, with no mark beside it", async () => {
    stored = { root: ROOT };
    render(<p data-testid="host">Choose the <GlossaryTip slot="root">root</GlossaryTip> you grow from</p>);
    const word = await screen.findByRole("button", { name: "root" });
    expect(word.textContent).toBe("root");
    expect(word.getAttribute("aria-expanded")).toBe("false");
    // The sentence reads as it always did: the plaque is hidden, and there is no "i" anywhere.
    const host = screen.getByTestId("host").cloneNode(true) as HTMLElement;
    host.querySelector('[role="tooltip"]')?.remove();
    expect(host.textContent).toBe("Choose the root you grow from");
    expect(screen.queryByText("i")).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("opens on a click and closes on Escape, and the sentence is its description", async () => {
    stored = { root: ROOT };
    render(<GlossaryTip slot="root">root</GlossaryTip>);
    const word = await screen.findByRole("button", { name: "root" });
    expect(word).toHaveAccessibleDescription(ROOT);
    fireEvent.click(word);
    await waitFor(() => expect(word.getAttribute("aria-expanded")).toBe("true"));
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    await waitFor(() => expect(word.getAttribute("aria-expanded")).toBe("false"));
  });

  it("opens on keyboard focus and toggles with Enter and Space", async () => {
    stored = { quorum: "Quorum is how much of the village's voice has to take part." };
    render(<GlossaryTip slot="quorum">Quorum</GlossaryTip>);
    const word = await screen.findByRole("button", { name: "Quorum" });
    fireEvent.focus(word);
    await waitFor(() => expect(word.getAttribute("aria-expanded")).toBe("true"));
    fireEvent.keyDown(word, { key: "Enter" });
    fireEvent.keyDown(word, { key: "Enter" });
    await waitFor(() => expect(word.getAttribute("aria-expanded")).toBe("false"));
    fireEvent.keyDown(word, { key: " " });
    await waitFor(() => expect(word.getAttribute("aria-expanded")).toBe("true"));
  });

  it("wears the page's own sentence when the village has none and the page gave one", async () => {
    stored = {};
    render(<GlossaryTip slot="moon" fallback="The moons the land turns by.">moons</GlossaryTip>);
    const word = await screen.findByRole("button", { name: "moons" });
    expect(word).toHaveAccessibleDescription("The moons the land turns by.");
  });
});

describe("a line of the village's own words", () => {
  it("puts the tip on the word where the line uses it", async () => {
    stored = { voice: "Voice is your say in village decisions." };
    render(
      <h2>
        <GlossaryText slot="voice" text="How Voice is spread" match={/\bvoice\b/i} whole />
      </h2>,
    );
    const word = await screen.findByRole("button", { name: "Voice" });
    expect(word).toHaveAccessibleDescription("Voice is your say in village decisions.");
    expect(screen.getByRole("heading", { level: 2 })).toHaveAccessibleName("How Voice is spread");
  });

  it("puts it on the whole heading when the line has no such word", async () => {
    stored = { voice: "Voice is your say in village decisions." };
    render(
      <h2>
        <GlossaryText slot="voice" text="Who has a say" match={/\bvoice\b/i} whole />
      </h2>,
    );
    expect(await screen.findByRole("button", { name: "Who has a say" })).toBeTruthy();
  });
});
