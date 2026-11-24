// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useThanksInView } from "./thanksInView";

function Form() {
  const [sent, setSent] = useState(false);
  const thanks = useThanksInView(sent);
  return sent ? (
    <h1 ref={thanks} tabIndex={-1}>
      Thank you
    </h1>
  ) : (
    <button type="button" onClick={() => setSent(true)}>
      Send
    </button>
  );
}

afterEach(cleanup);

describe("useThanksInView", () => {
  it("takes the reader to the top and to the thank-you once the form is sent, and not before", () => {
    const scrollTo = vi.fn();
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    render(<Form />);
    expect(scrollTo).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Thank you" }));
  });
});
