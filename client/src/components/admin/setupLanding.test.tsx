// @vitest-environment jsdom
/**
 * ONE DOOR INTO MAKE THIS YOURS (the lead, 26 Nov 2026): every way in lands on
 * a step. An asked-for `step` wins; otherwise the first step not done, once
 * the guide and the needs readings have answered.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { LAUNCH_REQUIREMENTS } from "@shared/launchRequirements";
import { landingStep, openSetupStep, setupStepId, useSetupLanding } from "./setupLanding";
import { SETUP_STEPS, type SetupRow, type SetupState } from "./setupProgress";

const rows = (states: Partial<Record<string, SetupState>>): SetupRow[] =>
  SETUP_STEPS.map((s) => {
    const state = states[s.key] ?? "done";
    return { key: s.key, label: s.label, measured: true, source: "measured", state, done: state === "done", declaredDone: false, filled: null, total: null, blank: [] };
  });

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
  vi.restoreAllMocks();
});

describe("where the setup page lands", () => {
  it("goes where a door asked, at once", () => {
    expect(landingStep(null, "purpose")).toEqual({ step: "purpose", wait: false });
  });

  it("waits while the guide or the needs reading has not answered", () => {
    expect(landingStep(rows({ guide: "unknown" }), null).wait).toBe(true);
    expect(landingStep(rows({ needs: "unknown" }), null).wait).toBe(true);
    // A ticked step nobody looked at is not a reading to wait for.
    expect(landingStep(rows({ numbers: "unknown" }), null)).toEqual({ step: "numbers", wait: false });
  });

  it("lands on the first step not done, and nowhere when every step is done", () => {
    expect(landingStep(rows({ images: "todo", map: "todo" }), null)).toEqual({ step: "images", wait: false });
    expect(landingStep(rows({}), null)).toEqual({ step: null, wait: false });
  });
});

function Page({ given }: { given: SetupRow[] | null }) {
  useSetupLanding(given);
  return (
    <>
      {SETUP_STEPS.map((s) => <div key={s.key} id={setupStepId(s.key)} />)}
      <div id={setupStepId("purpose")} />
    </>
  );
}

describe("the landing itself", () => {
  const scrolled = () => {
    const seen: string[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => { cb(0); return 0; });
    Element.prototype.scrollIntoView = vi.fn(function (this: Element) { seen.push(this.id); });
    return seen;
  };

  it("scrolls to the asked-for step once and takes `step` out of the address", () => {
    const seen = scrolled();
    window.history.replaceState({}, "", "/admin?tab=setup&step=purpose");
    const { rerender } = render(<Page given={null} />);
    rerender(<Page given={rows({ images: "todo" })} />);
    expect(seen).toEqual(["setup-step-purpose"]);
    expect(window.location.search).toBe("?tab=setup");
  });

  it("waits for the readings, then lands on the first step not done", () => {
    const seen = scrolled();
    window.history.replaceState({}, "", "/admin?tab=setup");
    const { rerender } = render(<Page given={rows({ guide: "unknown", images: "todo" })} />);
    expect(seen).toEqual([]);
    rerender(<Page given={rows({ images: "todo" })} />);
    expect(seen).toEqual(["setup-step-images"]);
  });

  it("opens a step from inside Admin", () => {
    window.history.replaceState({}, "", "/admin?tab=home");
    const onOpenTab = vi.fn();
    openSetupStep(onOpenTab, "guide");
    expect(onOpenTab).toHaveBeenCalledWith("setup");
    expect(new URLSearchParams(window.location.search).get("step")).toBe("guide");
  });
});

describe("the launch rows land on their step", () => {
  const at = (id: string) => LAUNCH_REQUIREMENTS.find((r) => r.id === id)?.fixAt;
  it("sends the AI key rows to step 1, and the setup rows to their own step", () => {
    expect(at("assistant-key")).toBe("/admin?tab=setup&step=guide");
    expect(at("assistant-own-key")).toBe("/admin?tab=setup&step=guide");
    expect(at("brand-basics")).toBe("/admin?tab=setup&step=identity");
    expect(at("gps-written")).toBe("/admin?tab=setup&step=purpose");
  });

  it("names only steps the page has", () => {
    const known = new Set([...SETUP_STEPS.map((s) => s.key), "purpose"]);
    for (const r of LAUNCH_REQUIREMENTS) {
      const step = /[?&]step=([a-z-]+)/.exec(r.fixAt)?.[1];
      if (step) expect(known.has(step as never), `${r.id} asks for step=${step}`).toBe(true);
    }
  });
});
