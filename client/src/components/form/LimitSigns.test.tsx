// @vitest-environment jsdom
/**
 * The signs under a box with a limit (the ops request of 19 Nov 2026): the count always, the calm notice at 80%,
 * the stronger one at 95%, the trim past the limit, every word kept, and the "?" that explains the limits.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import GrowingField from "./GrowingField";
import MicInput from "./MicInput";
import { LimitSigns } from "./LimitSigns";
import { SPEECH_CHARS_PER_MINUTE, halfMinutes, limitState, minutesOfTalk } from "@shared/applyLimits";

afterEach(cleanup);

const MAX = 8000;
const signs = (c: HTMLElement) => c.querySelector("[data-limit-signs]") as HTMLElement;

describe("the signs under a box", () => {
  it("always shows the count, in the reader's number format", () => {
    const { container } = render(<LimitSigns value={"x".repeat(1240)} max={MAX} />);
    expect(container.querySelector("[data-character-count]")?.textContent).toBe("1,240 / 8,000");
    expect(signs(container).dataset.limitSigns).toBe("room");
    expect(container.querySelector("[data-limit-notice]")?.textContent).toBe("");
  });

  it("at 80%: a calm notice in minutes of talking left", () => {
    const used = MAX * 0.8;
    const { container } = render(<LimitSigns value={"x".repeat(used)} max={MAX} />);
    expect(signs(container).dataset.limitSigns).toBe("near");
    // 1,600 characters left at about 1,050 a minute: about 1½ minutes.
    expect(container.querySelector("[data-limit-notice]")?.textContent).toBe("About 1½ minutes of talking left in this answer.");
    expect(screen.getByRole("status").textContent).toBe("This answer is getting full.");
  });

  it("at 95%: the stronger notice", () => {
    const { container } = render(<LimitSigns value={"x".repeat(MAX * 0.95)} max={MAX} />);
    expect(signs(container).dataset.limitSigns).toBe("nearer");
    expect(container.querySelector("[data-limit-notice]")?.textContent).toBe("Nearly full: 400 characters left.");
    expect(screen.getByRole("status").textContent).toBe("This answer is nearly full.");
  });

  it("past the limit: how much to trim, and that nothing was cut", () => {
    const { container } = render(<LimitSigns value={"x".repeat(MAX + 1240)} max={MAX} />);
    expect(signs(container).dataset.limitSigns).toBe("over");
    expect(container.querySelector("[data-limit-notice]")?.textContent).toBe("1,240 characters over the limit. Trim 1,240 characters to send. Everything you wrote is kept.");
    expect(container.querySelector("[data-character-count]")?.textContent).toBe("9,240 / 8,000");
  });

  it("the ? says how the limits work, for this box", async () => {
    const { container } = render(<LimitSigns value="" max={MAX} />);
    fireEvent.click(screen.getByRole("button", { name: "How the limits work" }));
    await waitFor(() => expect(container.querySelector("[data-limits-explained]")).not.toBeNull());
    const words = container.querySelector("[data-limits-explained]")?.textContent ?? "";
    expect(words).toContain("This answer holds 8,000 characters, about 7½ minutes of talking.");
    expect(words).toContain("One recording runs up to 15 minutes.");
    expect(words).toContain("A file such as a CV can be up to 30 MB, and one recording up to 22 MB.");
    expect(words).toContain("stay on this page while it sends");
  });

  it("states and minutes, as numbers", () => {
    expect(limitState(0, 100)).toBe("room");
    expect(limitState(79, 100)).toBe("room");
    expect(limitState(80, 100)).toBe("near");
    expect(limitState(95, 100)).toBe("nearer");
    expect(limitState(100, 100)).toBe("nearer");
    expect(limitState(101, 100)).toBe("over");
    expect(minutesOfTalk(SPEECH_CHARS_PER_MINUTE * 1.5)).toBe(1.5);
    expect(halfMinutes(1.5)).toBe("1½");
    expect(halfMinutes(0.5)).toBe("½");
    expect(halfMinutes(7)).toBe("7");
  });
});

describe("a box with a limit never cuts", () => {
  function Box({ start }: { start: string }) {
    const [v, setV] = useState(start);
    return <GrowingField id="why" aria-label="Why" limit={20} value={v} onChange={setV} />;
  }
  function Line({ start }: { start: string }) {
    const [v, setV] = useState(start);
    return <MicInput id="aim" aria-label="Aim" limit={10} value={v} onChange={setV} />;
  }

  it("a paste past the limit is kept whole, marked, and the box has no maxLength for the browser to cut with", () => {
    render(<Box start="" />);
    const box = screen.getByLabelText("Why") as HTMLTextAreaElement;
    expect(box.maxLength).toBe(-1);
    fireEvent.change(box, { target: { value: "y".repeat(35) } });
    expect(box.value).toBe("y".repeat(35));
    expect(box.getAttribute("aria-invalid")).toBe("true");
    expect(box.getAttribute("aria-describedby")).toBe("why-count");
    expect(document.getElementById("why-count")?.textContent).toBe("35 / 20");
  });

  it("a one-line answer does the same", () => {
    render(<Line start={"z".repeat(14)} />);
    const line = screen.getByLabelText("Aim") as HTMLInputElement;
    expect(line.value).toBe("z".repeat(14));
    expect(line.maxLength).toBe(-1);
    expect(document.querySelector("[data-limit-signs]")?.getAttribute("data-limit-signs")).toBe("over");
  });
});
