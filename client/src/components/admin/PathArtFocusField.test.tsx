// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import PathArtFocusField from "./PathArtFocusField";

afterEach(cleanup);

describe("PathArtFocusField", () => {
  it("draws nothing for a picture that is not on a path card", () => {
    const { container } = render(<PathArtFocusField imageKey="hero" images={{ hero: "/a.webp" }} fallback="" onChange={() => {}} />);
    expect(container.innerHTML).toBe("");
  });

  it("writes the focus beside its picture and previews the cut", () => {
    const onChange = vi.fn();
    render(<PathArtFocusField imageKey="investorHero" images={{ investorHero: "/a.webp", investorHeroFocus: "50% 80%" }} fallback="" onChange={onChange} />);
    const box = screen.getByRole("textbox");
    expect((box as HTMLInputElement).value).toBe("50% 80%");
    expect((document.querySelector("img") as HTMLImageElement).style.objectPosition).toBe("50% 80%");
    fireEvent.change(box, { target: { value: "40% 20%" } });
    expect(onChange).toHaveBeenCalledWith("investorHeroFocus", "40% 20%");
  });

  it("says when a value is not two percentages, and previews the default", () => {
    render(<PathArtFocusField imageKey="stewardHero" images={{ stewardHeroFocus: "top" }} fallback="/f.webp" onChange={() => {}} />);
    expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText(/Two percentages/)).toBeTruthy();
    expect((document.querySelector("img") as HTMLImageElement).style.objectPosition).toBe("50% 40%");
  });
});
