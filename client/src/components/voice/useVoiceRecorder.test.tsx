// @vitest-environment jsdom
/**
 * NOTHING SAID IS LOST QUIETLY (an applicant, 17 Nov 2026: "I just recorded like
 * 5 minutes ... it doesn't seem to play back. And it doesn't seem to say what we
 * heard in your words").
 *
 * The recorder against a stand-in MediaRecorder and speech engine: every way a
 * recording can end keeps what was captured and says what happened, a browser
 * with no speech engine is told so, the speech engine gives the microphone back
 * when it would silence the recording, and Safari records in its own MP4.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { useState } from "react";
import { VOICE_WORDS } from "@shared/voiceNotes";
import { VOICE_BITS_PER_SECOND, pickType, useVoiceRecorder, type FinishedTake } from "./useVoiceRecorder";
import { TakePlayer } from "./TakePlayer";
import { EMPTY_VOICE, VoiceInvite, type VoiceState } from "./VoiceInvite";

const WEBM = () => new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4])], { type: "audio/webm" });

/** The last recorder made, so a case can end it the way a browser would. */
let made: FakeRecorder | null = null;
let chunk: () => Blob = WEBM;

class FakeRecorder {
  state = "inactive";
  mimeType: string;
  options: any;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(_s: unknown, options?: any) {
    this.options = options;
    this.mimeType = options?.mimeType ?? "audio/webm";
    made = this;
  }
  start() {
    this.state = "recording";
  }
  stop() {
    if (this.state === "inactive") return;
    this.state = "inactive";
    this.ondataavailable?.({ data: chunk() });
    this.onstop?.();
  }
  static isTypeSupported(t: string) {
    return t.startsWith("audio/webm") || t === "audio/mp4";
  }
}

/** A microphone track that can be muted or unplugged. */
class FakeTrack extends EventTarget {
  stop() {}
}
let track: FakeTrack;

/** A stand-in speech engine; `engines` holds every one started. */
let engines: any[] = [];
class FakeSpeech {
  onresult: any = null;
  onerror: any = null;
  onend: any = null;
  aborted = false;
  constructor() {
    engines.push(this);
  }
  start() {}
  stop() {
    this.onend?.();
  }
  abort() {
    this.aborted = true;
  }
  say(words: string, isFinal: boolean) {
    this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: words }], { isFinal })] });
  }
}

beforeEach(() => {
  made = null;
  chunk = WEBM;
  engines = [];
  track = new FakeTrack();
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: async () => ({ getTracks: () => [track], getAudioTracks: () => [track] }) },
  });
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:take", revokeObjectURL: () => {} }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete (window as any).webkitSpeechRecognition;
  delete (window as any).SpeechRecognition;
  delete (window as any).chrome;
  Object.defineProperty(navigator, "vendor", { configurable: true, value: "" });
});

function recorder(maxSeconds?: number) {
  const takes: FinishedTake[] = [];
  const hook = renderHook(() => useVoiceRecorder((t) => takes.push(t), maxSeconds));
  return { takes, hook };
}

describe("how a recording ends", () => {
  it("keeps the take and says so when the browser ends the recording before Stop", async () => {
    const { takes, hook } = recorder();
    await act(async () => hook.result.current.start());
    expect(hook.result.current.recording).toBe(true);
    // The microphone taken by another app: the browser stops the recorder itself.
    await act(async () => made!.stop());
    expect(takes).toHaveLength(1);
    expect(takes[0].blob.size).toBeGreaterThan(0);
    // The button comes back: the card is no longer stuck on "Stop recording".
    expect(hook.result.current.recording).toBe(false);
    expect(hook.result.current.problem).toBe("cut");
  });

  it("stops when the microphone track ends, keeping what was said", async () => {
    const { takes, hook } = recorder();
    await act(async () => hook.result.current.start());
    await act(async () => void track.dispatchEvent(new Event("ended")));
    expect(takes).toHaveLength(1);
    expect(hook.result.current.recording).toBe(false);
    expect(hook.result.current.problem).toBe("cut");
  });

  it("says a take with no sound in it, never drops it in silence", async () => {
    chunk = () => new Blob([], { type: "audio/webm" });
    const { takes, hook } = recorder();
    await act(async () => hook.result.current.start());
    await act(async () => hook.result.current.stop());
    expect(takes).toHaveLength(0);
    expect(hook.result.current.problem).toBe("empty");
  });

  it("a Stop pressed by the person says nothing more", async () => {
    const { takes, hook } = recorder();
    await act(async () => hook.result.current.start());
    await act(async () => hook.result.current.stop());
    expect(takes).toHaveLength(1);
    expect(hook.result.current.problem).toBeNull();
  });

  it("reaching the limit keeps the take at the limit's length and says it stopped by itself", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout", "Date"] });
    const { takes, hook } = recorder(300);
    await act(async () => hook.result.current.start());
    await act(async () => void vi.advanceTimersByTime(301_000));
    expect(takes).toHaveLength(1);
    expect(takes[0].seconds).toBe(300);
    expect(hook.result.current.recording).toBe(false);
    expect(hook.result.current.problem).toBe("limit");
  });

  /*
   * THE HARD STOP IS AT 5:00 EXACTLY (the lead, 17 Nov 2026: "cut them off at 5
   * min"). A tab in the background gets its interval slowed to once a minute or
   * less, so the running clock alone could let a take run on. The stop is its
   * own timer, set for the limit itself.
   */
  it("stops at exactly the limit even when the running clock never ticks (a tab in the background)", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout", "Date"] });
    // The clock's interval never fires, as a throttled tab's may not.
    vi.spyOn(window, "setInterval").mockImplementation((() => 0) as any);
    const { takes, hook } = recorder(300);
    await act(async () => hook.result.current.start());
    await act(async () => void vi.advanceTimersByTime(299_999));
    expect(hook.result.current.recording).toBe(true);
    await act(async () => void vi.advanceTimersByTime(1));
    expect(hook.result.current.recording).toBe(false);
    expect(takes).toHaveLength(1);
    expect(takes[0].seconds).toBe(300);
    expect(hook.result.current.problem).toBe("limit");
  });
});

describe("the words heard while it records", () => {
  it("tells a browser with no speech engine (Firefox) at the start, and still records", async () => {
    const { takes, hook } = recorder();
    expect(hook.result.current.engine).toBe(false);
    await act(async () => hook.result.current.start());
    expect(hook.result.current.noWords).toBe(true);
    expect(hook.result.current.recording).toBe(true);
    await act(async () => hook.result.current.stop());
    expect(takes).toHaveLength(1);
  });

  it("writes the words down live, and keeps words still unsettled when the engine restarts itself", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout"] });
    (window as any).webkitSpeechRecognition = FakeSpeech;
    const { takes, hook } = recorder();
    expect(hook.result.current.engine).toBe(true);
    await act(async () => hook.result.current.start());
    await act(async () => engines[0].say("I tend the land", true));
    expect(hook.result.current.live).toBe("I tend the land");
    await act(async () => engines[0].say("and the water", false));
    // Chrome ends a session on a pause: the unsettled words stay, and a new session starts.
    await act(async () => engines[0].onend());
    await act(async () => void vi.advanceTimersByTime(200));
    expect(engines).toHaveLength(2);
    await act(async () => engines[1].say("with my children", true));
    expect(hook.result.current.live).toBe("I tend the land and the water with my children");
    await act(async () => hook.result.current.stop());
    expect(takes[0].words).toBe("I tend the land and the water with my children");
    expect(hook.result.current.noWords).toBe(false);
  });

  it("gives the microphone back to the recording when the engine would mute it", async () => {
    (window as any).webkitSpeechRecognition = FakeSpeech;
    const { takes, hook } = recorder();
    await act(async () => hook.result.current.start());
    await act(async () => void track.dispatchEvent(new Event("mute")));
    expect(engines[0].aborted).toBe(true);
    expect(hook.result.current.noWords).toBe(true);
    // The recording carries on, and is kept at Stop.
    expect(hook.result.current.recording).toBe(true);
    await act(async () => hook.result.current.stop());
    expect(takes).toHaveLength(1);
  });
});

describe("the format and the size", () => {
  it("records MP4 in Safari's engine, which newer Safari also offers WebM in", () => {
    Object.defineProperty(navigator, "vendor", { configurable: true, value: "Apple Computer, Inc." });
    expect(pickType()).toBe("audio/mp4");
  });

  it("records WebM in Chrome's engine", () => {
    Object.defineProperty(navigator, "vendor", { configurable: true, value: "Google Inc." });
    (window as any).chrome = {};
    expect(pickType()).toBe("audio/webm;codecs=opus");
  });

  it("asks for a speech bitrate, so five minutes stays a small upload", async () => {
    const { hook } = recorder();
    await act(async () => hook.result.current.start());
    expect(made!.options.audioBitsPerSecond).toBe(VOICE_BITS_PER_SECOND);
    // Five minutes at that rate, with room for the container, sits far inside the 10 MB a note may weigh.
    expect((300 * VOICE_BITS_PER_SECOND) / 8).toBeLessThan(3 * 1024 * 1024);
  });
});

describe("on the card", () => {
  it("a player that cannot play says the recording is kept and offers a copy", () => {
    const { container } = render(<TakePlayer url="blob:take" type="audio/webm" name="voice-1" />);
    expect(screen.queryByText(VOICE_WORDS.cantPlay, { exact: false })).toBeNull();
    fireEvent.error(container.querySelector("audio")!);
    expect(screen.getByText(VOICE_WORDS.cantPlay, { exact: false })).toBeTruthy();
    const save = screen.getByRole("link", { name: VOICE_WORDS.saveCopy }) as HTMLAnchorElement;
    expect(save.getAttribute("download")).toBe("voice-1.webm");
  });

  function Card() {
    const [v, setV] = useState<VoiceState>(EMPTY_VOICE);
    return <VoiceInvite value={v} onChange={setV} />;
  }

  it("after a recording with no words written down, the empty box says why, and an early end is said", async () => {
    render(<Card />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: VOICE_WORDS.record })));
    expect(screen.getByText(VOICE_WORDS.noEngine)).toBeTruthy();
    await act(async () => made!.stop());
    expect(screen.getByText(/Recording 1/)).toBeTruthy();
    expect(screen.getByText(VOICE_WORDS.heardLabel)).toBeTruthy();
    expect(screen.getByText(VOICE_WORDS.heardNothing)).toBeTruthy();
    expect(screen.getByText(VOICE_WORDS.cutShort)).toBeTruthy();
    expect(screen.getByRole("button", { name: VOICE_WORDS.recordAnother })).toBeTruthy();
  });
});
