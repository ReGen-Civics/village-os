// @vitest-environment jsdom
/**
 * The info mark beside a word the village explains (the lead, 25 Nov 2026): drawn only while the village has a
 * sentence for it, named for the word, opened by a tap or a click and by keyboard focus, closed by Escape.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

let stored: unknown = null;
vi.mock("@/hooks/useVillageContent", () => ({ readVillageSection: () => Promise.resolve(stored) }));

import GlossaryTip from "./GlossaryTip";
import { forgetGlossary } from "@/hooks/useGlossary";

beforeEach(() => forgetGlossary());
afterEach(() => cleanup());

describe("the glossary mark", () => {
  it("draws nothing while the village has no sentence for the word", async () => {
    stored = { domain: "The part you look after." };
    const { container } = render(<p>Choose the root you grow from<GlossaryTip slot="root" word="root" /></p>);
    await new Promise((r) => setTimeout(r, 10));
    expect(container.querySelector("button")).toBeNull();
    expect(container.textContent).toBe("Choose the root you grow from");
  });

  it("sits beside the word, never in place of it, named for the word", async () => {
    stored = { root: "Your root is the kind of contribution you grow from." };
    render(<p>Choose the root you grow from<GlossaryTip slot="root" word="root" /></p>);
    const mark = await screen.findByRole("button", { name: 'What "root" means' });
    expect(document.querySelector("p")?.textContent?.startsWith("Choose the root you grow from")).toBe(true);
    expect(mark.textContent).toBe("i");
    expect(mark.getAttribute("aria-expanded")).toBe("false");
  });

  it("opens on a click and closes on Escape, and the sentence is its description", async () => {
    stored = { root: "Your root is the kind of contribution you grow from." };
    render(<GlossaryTip slot="root" word="root" />);
    const mark = await screen.findByRole("button", { name: 'What "root" means' });
    const describedBy = mark.getAttribute("aria-describedby")!;
    expect(document.getElementById(describedBy)?.textContent).toBe("Your root is the kind of contribution you grow from.");
    fireEvent.click(mark);
    await waitFor(() => expect(mark.getAttribute("aria-expanded")).toBe("true"));
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    await waitFor(() => expect(mark.getAttribute("aria-expanded")).toBe("false"));
  });

  it("opens on keyboard focus", async () => {
    stored = { quorum: "Quorum is how much of the village's voice has to take part." };
    render(<GlossaryTip slot="quorum" word="quorum" />);
    const mark = await screen.findByRole("button", { name: 'What "quorum" means' });
    fireEvent.focus(mark);
    await waitFor(() => expect(mark.getAttribute("aria-expanded")).toBe("true"));
  });
});
