// @vitest-environment jsdom
/**
 * Village Health's crash card (the lead, 25 Nov 2026): each distinct crash once, with its count, whether it is ours
 * and whether it emailed, and the card a crash alert email links to marked. Every value is made up.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { BrowserCrashesCard, type BrowserCrashes } from "./BrowserCrashesCard";

const SIG = {
  id: "abcdef0123456789",
  message: "n is null",
  topFrame: "render@/assets/Roles.js",
  ours: true,
  firstSeenAt: "2026-11-24T09:00:00Z",
  lastSeenAt: "2026-11-25T04:00:00Z",
  seenCount: 4,
  emailedAt: "2026-11-24T09:00:01Z",
  browsers: ["in-app browser (iOS)"],
  routes: ["/apply"],
};
const data: BrowserCrashes = { crashes: [{ id: "e1", at: "2026-11-25T04:00:00Z", route: "/apply", text: "TypeError: n is null (on /apply)" }], signatures: [SIG, { ...SIG, id: "0123456789abcdef", message: "m is null", ours: false, emailedAt: null }] };

afterEach(() => {
  cleanup();
  window.location.hash = "";
});

describe("the crash card on Village Health", () => {
  it("draws each signature once, with its count, whether it is ours and whether it emailed", async () => {
    render(<BrowserCrashesCard load={async () => data} />);
    expect(await screen.findByText("n is null")).toBeTruthy();
    const ours = document.querySelector('[data-crash-signature="abcdef0123456789"]')!;
    expect(ours.textContent).toContain("Seen 4 times");
    expect(ours.textContent).toContain("A frame is from our own code: render@/assets/Roles.js.");
    expect(ours.textContent).toContain("Browsers: in-app browser (iOS). Pages: /apply.");
    const quiet = document.querySelector('[data-crash-signature="0123456789abcdef"]')!;
    expect(quiet.textContent).toContain("No frame from our own code.");
    expect(quiet.textContent).toContain("Not emailed; counted in the daily digest.");
    expect(screen.getByText("TypeError: n is null (on /apply)")).toBeTruthy();
  });

  it("marks the card a crash alert email linked to", async () => {
    window.location.hash = "#crash-0123456789abcdef";
    render(<BrowserCrashesCard load={async () => data} />);
    await screen.findByText("m is null");
    expect(document.getElementById("crash-0123456789abcdef")?.getAttribute("aria-current")).toBe("true");
    expect(document.getElementById("crash-abcdef0123456789")?.getAttribute("aria-current")).toBeNull();
  });

  it("draws nothing when there is nothing", async () => {
    const { container } = render(<BrowserCrashesCard load={async () => ({ crashes: [], signatures: [] })} />);
    await new Promise((r) => setTimeout(r, 10));
    expect(container.textContent).toBe("");
  });
});
