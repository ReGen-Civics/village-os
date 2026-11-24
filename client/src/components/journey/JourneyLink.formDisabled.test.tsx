// @vitest-environment jsdom
/** A form the page cannot offer yet (an empty investor pack) is drawn disabled and opens nothing. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { JourneyLink } from "./JourneyLink";

afterEach(cleanup);

describe("JourneyLink, a form button", () => {
  it("opens its form, unless the page says that form is not offered yet", () => {
    const onForm = vi.fn();
    const { rerender } = render(
      <JourneyLink action={{ kind: "form", form: "pack-form" } as any} onForm={onForm} className="btn">
        Request the pack
      </JourneyLink>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Request the pack" }));
    expect(onForm).toHaveBeenCalledWith("pack-form");
    onForm.mockClear();
    rerender(
      <JourneyLink action={{ kind: "form", form: "pack-form" } as any} onForm={onForm} formDisabled={(f) => f === "pack-form"} className="btn">
        Request the pack
      </JourneyLink>,
    );
    const button = screen.getByRole("button", { name: "Request the pack" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onForm).not.toHaveBeenCalled();
    // Another form on the same page is untouched.
    rerender(
      <JourneyLink action={{ kind: "form", form: "call-form" } as any} onForm={onForm} formDisabled={(f) => f === "pack-form"} className="btn">
        Book a call
      </JourneyLink>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Book a call" }));
    expect(onForm).toHaveBeenCalledWith("call-form");
  });
});
