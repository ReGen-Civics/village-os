// @vitest-environment jsdom
/**
 * The hatchery's spoken voice: it chooses the kindest installed voice for the
 * page language, speaks at pitch 1 for every character, waits briefly for a
 * browser that loads its voices late, and still works when a browser (or a test
 * stub) cannot list its voices at all.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import { useSpeech, VOICES_WAIT_MS } from "./welcomeKit";

interface FakeUtterance {
  text: string;
  lang?: string;
  voice?: { name: string; lang: string } | null;
  rate?: number;
  pitch?: number;
}

const spoken: FakeUtterance[] = [];
let voices: { name: string; lang: string; localService?: boolean }[] = [];
let listeners: (() => void)[] = [];

function stubSynth(withGetVoices = true) {
  listeners = [];
  const synth: Record<string, unknown> = {
    speak: (u: FakeUtterance) => spoken.push(u),
    cancel: () => {},
    addEventListener: (_: string, fn: () => void) => listeners.push(fn),
    removeEventListener: (_: string, fn: () => void) =>
      (listeners = listeners.filter(l => l !== fn)),
  };
  if (withGetVoices) synth.getVoices = () => voices;
  vi.stubGlobal("speechSynthesis", synth);
}

beforeEach(() => {
  spoken.length = 0;
  voices = [];
  document.documentElement.lang = "en";
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      text: string;
      constructor(text: string) {
        this.text = text;
      }
    }
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.documentElement.lang = "";
});

describe("useSpeech", () => {
  it("picks a natural voice over Windows David, at pitch 1 for the sidekick", () => {
    voices = [
      { name: "Microsoft David - English (United States)", lang: "en-US" },
      {
        name: "Microsoft Ava Online (Natural) - English (United States)",
        lang: "en-US",
        localService: false,
      },
    ];
    stubSynth();
    const { result } = renderHook(() => useSpeech(true, "sidekick"));
    result.current.speak("Hello there");
    expect(spoken).toHaveLength(1);
    expect(spoken[0]!.voice?.name).toBe(
      "Microsoft Ava Online (Natural) - English (United States)"
    );
    expect(spoken[0]!.lang).toBe("en");
    expect(spoken[0]!.pitch).toBe(1);
    expect(spoken[0]!.rate).toBeGreaterThanOrEqual(0.95);
    expect(spoken[0]!.rate).toBeLessThanOrEqual(1);
  });

  it("keeps pitch 1 and a gentle rate for every character", () => {
    voices = [{ name: "Samantha", lang: "en-US" }];
    stubSynth();
    for (const c of [
      "sidekick",
      "trickster",
      "elder",
      "plain",
      "poet",
      "coach",
    ] as const) {
      spoken.length = 0;
      const { result, unmount } = renderHook(() => useSpeech(true, c));
      result.current.speak("hi");
      expect(spoken[0]!.pitch).toBe(1);
      expect(spoken[0]!.rate).toBeGreaterThanOrEqual(0.95);
      expect(spoken[0]!.rate).toBeLessThanOrEqual(1);
      unmount();
    }
  });

  it("a Spanish page gets a Spanish voice", () => {
    document.documentElement.lang = "es";
    voices = [
      { name: "Microsoft Ava Online (Natural)", lang: "en-US" },
      { name: "Google español de Estados Unidos", lang: "es-US" },
    ];
    stubSynth();
    const { result } = renderHook(() => useSpeech(true, "sidekick"));
    result.current.speak("Hola");
    expect(spoken[0]!.voice?.lang).toBe("es-US");
    expect(spoken[0]!.lang).toBe("es");
  });

  it("waits for voiceschanged when the list is empty, then speaks with the chosen voice", () => {
    vi.useFakeTimers();
    stubSynth();
    const { result } = renderHook(() => useSpeech(true, "sidekick"));
    result.current.speak("Late voices");
    expect(spoken).toHaveLength(0);
    voices = [{ name: "Google US English", lang: "en-US" }];
    listeners.forEach(l => l());
    expect(spoken).toHaveLength(1);
    expect(spoken[0]!.voice?.name).toBe("Google US English");
    vi.advanceTimersByTime(VOICES_WAIT_MS * 2);
    expect(spoken).toHaveLength(1);
  });

  it("speaks with the default voice when the list never arrives", () => {
    vi.useFakeTimers();
    stubSynth();
    const { result } = renderHook(() => useSpeech(true, "sidekick"));
    result.current.speak("No voices");
    vi.advanceTimersByTime(VOICES_WAIT_MS - 1);
    expect(spoken).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(spoken).toHaveLength(1);
    expect(spoken[0]!.voice).toBeUndefined();
  });

  it("a cancel while waiting drops the line", () => {
    vi.useFakeTimers();
    stubSynth();
    const { result } = renderHook(() => useSpeech(true, "sidekick"));
    result.current.speak("Never said");
    result.current.cancel();
    vi.advanceTimersByTime(VOICES_WAIT_MS * 2);
    expect(spoken).toHaveLength(0);
  });

  it("speaks at once when the browser cannot list its voices", () => {
    stubSynth(false);
    const { result } = renderHook(() => useSpeech(true, "sidekick"));
    result.current.speak("Stub");
    expect(spoken).toHaveLength(1);
    expect(spoken[0]!.voice).toBeUndefined();
    expect(spoken[0]!.pitch).toBe(1);
  });

  it("says nothing when off, and nothing breaks without speechSynthesis", () => {
    stubSynth();
    const off = renderHook(() => useSpeech(false, "sidekick"));
    off.result.current.speak("quiet");
    expect(spoken).toHaveLength(0);
    vi.stubGlobal("speechSynthesis", undefined);
    const none = renderHook(() => useSpeech(true, "sidekick"));
    expect(none.result.current.can).toBe(false);
    expect(() => none.result.current.speak("nothing")).not.toThrow();
    expect(() => none.result.current.cancel()).not.toThrow();
  });
});
