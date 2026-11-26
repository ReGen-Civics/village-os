// @vitest-environment jsdom
/**
 * The entrance's background video starts by itself (a visitor saw Safari's play button instead, 26 Nov 2026).
 * Safari reads the `muted` ATTRIBUTE, which React never writes; and a browser that refuses is asked again on the
 * visitor's first touch.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import EntranceBackdrop, { startBackgroundVideo } from "./EntranceBackdrop";

const backdrop = { video: "https://village.example/v.mp4", mobile: "https://village.example/m.mp4", poster: "https://village.example/p.jpg" };

afterEach(() => vi.restoreAllMocks());

describe("the entrance's background video", () => {
  it("carries the muted attribute Safari reads, and is started from code", () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
    const { container } = render(<EntranceBackdrop backdrop={backdrop} />);
    const v = container.querySelector("video")!;
    expect(v.hasAttribute("muted")).toBe(true);
    expect(v.muted).toBe(true);
    expect(v.hasAttribute("playsinline")).toBe(true);
    expect(play).toHaveBeenCalled();
  });

  it("asks again on the first touch when the browser refused, then stops asking once it plays", async () => {
    let allow = false;
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => (allow ? Promise.resolve() : Promise.reject(new Error("NotAllowedError"))));
    const v = document.createElement("video");
    const stop = startBackgroundVideo(v);
    await Promise.resolve();
    expect(play).toHaveBeenCalledTimes(1);
    allow = true;
    window.dispatchEvent(new Event("pointerdown"));
    await new Promise((r) => setTimeout(r, 0));
    expect(play).toHaveBeenCalledTimes(2);
    window.dispatchEvent(new Event("pointerdown"));
    expect(play).toHaveBeenCalledTimes(2);
    stop();
  });

  it("does nothing more once the page has left", () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.reject(new Error("NotAllowedError")));
    const stop = startBackgroundVideo(document.createElement("video"));
    stop();
    window.dispatchEvent(new Event("pointerdown"));
    expect(play).toHaveBeenCalledTimes(1);
  });
});
