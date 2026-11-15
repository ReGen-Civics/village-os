// @vitest-environment jsdom
/**
 * A mic on every free-text answer of the public application (Rye, 14 Nov 2026:
 * "in each spot there's a simple and obvious way to click voice to text").
 * The speech engine is faked; MicButton reads it when its module loads, so it
 * is put on the window before anything is imported.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";

let lastEngine: { onresult?: (e: unknown) => void; start: () => void; stop: () => void; abort: () => void } | null = null;
class FakeSpeech {
  lang = "";
  continuous = false;
  interimResults = false;
  onresult?: (e: unknown) => void;
  onend?: () => void;
  onerror?: (e: unknown) => void;
  constructor() {
    lastEngine = this as never;
  }
  start() {}
  stop() {}
  abort() {}
}
const say = (text: string) =>
  act(() => {
    lastEngine?.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal: true })] });
  });

let MicInput: typeof import("./MicInput").default;
let spokenInto: typeof import("./MicInput").spokenInto;
let AboutYouFacts: typeof import("@/components/openProposal/AboutYou").AboutYouFacts;
let EMPTY_ABOUT_YOU: typeof import("@/components/openProposal/AboutYou").EMPTY_ABOUT_YOU;

beforeAll(async () => {
  (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeSpeech;
  vi.resetModules();
  ({ default: MicInput, spokenInto } = await import("./MicInput"));
  ({ AboutYouFacts, EMPTY_ABOUT_YOU } = await import("@/components/openProposal/AboutYou"));
});
afterEach(() => {
  cleanup();
  lastEngine = null;
});

function Line({ max }: { max?: number }) {
  const [v, setV] = useState("I bring");
  return <MicInput aria-label="Aim" maxLength={max} value={v} onChange={setV} />;
}

describe("a one-line answer you can speak into", () => {
  it("appends each finished phrase to what is written", () => {
    render(<Line />);
    fireEvent.click(screen.getByRole("button", { name: "Speak instead of typing" }));
    say("seed to every household");
    expect((screen.getByLabelText("Aim") as HTMLInputElement).value).toBe("I bring seed to every household");
  });

  it("never goes past the field's own limit", () => {
    render(<Line max={12} />);
    fireEvent.click(screen.getByRole("button", { name: "Speak instead of typing" }));
    say("seed to every household");
    expect((screen.getByLabelText("Aim") as HTMLInputElement).value).toBe("I bring seed");
    expect(spokenInto("", "hello there", 5)).toBe("hello");
    expect(spokenInto("a", "b")).toBe("a b");
  });

  it("puts a mic on where you are based, your languages and your story line", () => {
    render(<AboutYouFacts value={EMPTY_ABOUT_YOU} onChange={() => {}} />);
    expect(screen.getAllByRole("button", { name: "Speak instead of typing" })).toHaveLength(3);
  });
});
