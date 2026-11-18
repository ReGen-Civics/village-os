// @vitest-environment jsdom
/**
 * THE VOICE STEP'S ADDITIONS OF 17 NOV 2026 (VoiceStepMore.tsx, VoiceHeard.tsx).
 *
 *   - A clear limit: "Up to 5 minutes per take" before recording, a countdown in
 *     the last minute, and the hard stop at 5:00 with the limit message.
 *   - Writing the words down (the lead: "actually make it automatic and the
 *     button is to turn it off!"): while the village's service is on, each take
 *     and clip goes by itself with its length and language, behind a switch
 *     shown before recording that turns it off and cancels a send running; the
 *     words go in the box for the applicant to fix, replacing what the live
 *     engine caught and nothing they typed.
 *   - A fresh recording's player shows its length before it is played.
 *   - Playback on Safari: a WebM is swapped for its MP4/AAC copy.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { VOICE_WORDS } from "@shared/voiceNotes";
import { TRANSCRIBE_WORDS, VOICE_TRANSCRIBE_PATH } from "@shared/voiceTranscribe";
import { EMPTY_VOICE, VoiceInvite, type VoiceState, type VoiceTake } from "./VoiceInvite";
import { countdownLeft, forgetTranscriptionOn, placeWords, withWrittenWords } from "./VoiceStepMore";
import { VoiceClipsProvider } from "./VoiceClips";
import { TakePlayer } from "./TakePlayer";
import GrowingField from "@/components/form/GrowingField";
import { PlayVoice, mp4Href, wantsMp4Copy } from "./VoiceHeard";

const WEBM = () => new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4])], { type: "audio/webm" });

class FakeRecorder {
  state = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  start() {
    this.state = "recording";
  }
  stop() {
    if (this.state === "inactive") return;
    this.state = "inactive";
    this.ondataavailable?.({ data: WEBM() });
    this.onstop?.();
  }
  static isTypeSupported(t: string) {
    return t.startsWith("audio/webm");
  }
}

/** Every call the page made, and what the server answers. */
let calls: Array<{ url: string; init?: RequestInit }> = [];
let serviceOn = true;
let answer: { status: number; body: unknown } = { status: 200, body: { text: "I keep the gate at dawn, every day." } };
/** Hold every POST until the page aborts it. */
let hold = false;

beforeEach(() => {
  calls = [];
  serviceOn = true;
  answer = { status: 200, body: { text: "I keep the gate at dawn, every day." } };
  hold = false;
  window.sessionStorage.clear();
  forgetTranscriptionOn();
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [], getAudioTracks: () => [] }) } });
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:take", revokeObjectURL: () => {} }));
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url === VOICE_TRANSCRIBE_PATH && (!init || !init.method)) return new Response(JSON.stringify({ on: serviceOn }), { status: 200 });
    if (hold) return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
    return new Response(JSON.stringify(answer.body), { status: answer.status });
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Let the lazy half of the step load, and the "is it on" answer arrive. */
const settle = async () => {
  for (let i = 0; i < 8; i += 1) await act(async () => void (await new Promise((r) => setTimeout(r, 0))));
};

function Card({ start = EMPTY_VOICE, seen }: { start?: VoiceState; seen?: (v: VoiceState) => void }) {
  const [v, setV] = useState<VoiceState>(start);
  seen?.(v);
  return <VoiceInvite value={v} onChange={setV} />;
}

describe("the countdown and the hard stop", () => {
  it("counts the last minute down, whole seconds, never below zero", () => {
    expect(countdownLeft(0)).toBeNull();
    expect(countdownLeft(239.9)).toBeNull();
    expect(countdownLeft(240)).toBe(60);
    expect(countdownLeft(240.2)).toBe(60);
    expect(countdownLeft(299.1)).toBe(1);
    expect(countdownLeft(300)).toBe(0);
    expect(countdownLeft(312)).toBe(0);
  });

  it("says the limit before recording, shows the countdown in the last minute, and stops at 5:00 with the limit message", async () => {
    const { container } = render(<Card />);
    await settle();
    expect(container.querySelector("[data-voice-limit-note]")?.textContent).toContain("Up to 5 minutes per take. It stops by itself at 5:00.");
    vi.useFakeTimers({ toFake: ["setInterval", "setTimeout", "clearInterval", "clearTimeout", "Date"] });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: VOICE_WORDS.record }));
    });
    // The note goes while recording; no countdown before the last minute.
    expect(container.querySelector("[data-voice-limit-note]")).toBeNull();
    await act(async () => void vi.advanceTimersByTime(239_000));
    expect(container.querySelector("[data-voice-countdown]")).toBeNull();
    // The lazy half loaded with the note above, so the countdown draws at once.
    await act(async () => void vi.advanceTimersByTime(1_000));
    expect(container.querySelector("[data-voice-countdown]")?.textContent).toContain("1:00 left");
    await act(async () => void vi.advanceTimersByTime(59_000));
    expect(container.querySelector("[data-voice-countdown]")?.textContent).toContain("0:01 left");
    expect(screen.getByRole("button", { name: VOICE_WORDS.stop })).toBeTruthy();
    await act(async () => void vi.advanceTimersByTime(1_000));
    // 5:00: stopped by itself, the take kept, and said so.
    expect(screen.queryByRole("button", { name: VOICE_WORDS.stop })).toBeNull();
    expect(container.querySelector("[data-voice-countdown]")).toBeNull();
    expect(container.querySelector('[data-voice-problem="limit"]')?.textContent).toBe(VOICE_WORDS.reachedLimit);
    expect(container.querySelectorAll("[data-voice-takes] li")).toHaveLength(1);
  });
});

describe("write down my words, by itself, with a switch to turn it off", () => {
  const take = (words?: string): VoiceTake => ({ blob: WEBM(), seconds: 300, url: "blob:take", words });
  const posts = () => calls.filter((c) => c.init?.method === "POST");
  const autoSwitch = () => screen.getByRole("switch", { name: "Write down my words automatically" }) as HTMLInputElement;

  it("replaces what the live engine caught for that take, keeps what was typed, and adds where nothing was caught", () => {
    const v: VoiceState = { ...EMPTY_VOICE, takes: [take("I keep the"), take()], transcript: "I keep the\n\nTyped by me." };
    const one = withWrittenWords(v, 0, "I keep the gate at dawn.");
    expect(one.transcript).toBe("I keep the gate at dawn.\n\nTyped by me.");
    expect(one.takes[0]).toMatchObject({ words: "I keep the gate at dawn.", written: true });
    const two = withWrittenWords(one, 1, "Second take.");
    expect(two.transcript).toBe("I keep the gate at dawn.\n\nTyped by me.\n\nSecond take.");
    // The applicant edited the caught words away: the service's words are added, never over their typing.
    const edited = withWrittenWords({ ...v, transcript: "My own words." }, 0, "Service words.");
    expect(edited.transcript).toBe("My own words.\n\nService words.");
    // Nothing heard changes nothing.
    expect(withWrittenWords(v, 0, "  ")).toBe(v);
  });

  it("a clip's words replace what was caught in the answer, are added where nothing was, and leave an edited answer alone", () => {
    expect(placeWords("I keep the", "I keep the", "I keep the gate.", 500)).toEqual({ text: "I keep the gate.", placed: true });
    expect(placeWords("Typed first.", "", "Then said.", 500).placed).toBe(true);
    expect(placeWords("Typed first.", "", "Then said.", 500).text).toContain("Then said.");
    expect(placeWords("I rewrote it all.", "I keep the", "I keep the gate.", 500)).toEqual({ text: "I rewrote it all.", placed: false });
  });

  it("while the service is off, no switch, no AI line and no button are drawn, and nothing is sent", async () => {
    serviceOn = false;
    const { container } = render(<Card start={{ ...EMPTY_VOICE, takes: [take()] }} />);
    await settle();
    expect(container.querySelector("[data-voice-limit-note]")).not.toBeNull();
    expect(container.querySelector("[data-voice-ai-line]")).toBeNull();
    expect(container.querySelector("[data-voice-auto-switch]")).toBeNull();
    expect(container.querySelector("[data-voice-transcribe-button]")).toBeNull();
    expect(posts()).toEqual([]);
  });

  it("automatic by default: the consent line and the switch (on) show before recording, and a take is sent as soon as it exists", async () => {
    let latest: VoiceState = EMPTY_VOICE;
    const { container } = render(<Card start={{ ...EMPTY_VOICE, takes: [take("I keep")], transcript: "I keep" }} seen={(v) => (latest = v)} />);
    await settle();
    expect(container.querySelector("[data-voice-limit-note] [data-voice-ai-line]")?.textContent).toBe(TRANSCRIBE_WORDS.consentLine);
    expect(autoSwitch().checked).toBe(true);
    expect(posts()).toHaveLength(1);
    const fd = posts()[0].init!.body as FormData;
    expect(posts()[0].url).toBe(VOICE_TRANSCRIBE_PATH);
    expect(fd.get("seconds")).toBe("300");
    expect((fd.get("voice") as File).type).toBe("audio/webm");
    expect(Array.from(fd.keys()).sort()).toEqual(["kind", "lang", "seconds", "voice"]);
    expect(fd.get("kind")).toBe("take");
    // The live engine had caught "I keep": the service's words fill the box in its place.
    expect(latest.transcript).toBe("I keep the gate at dawn, every day.");
    expect(latest.takes[0].written).toBe(true);
    // No button while it runs by itself, and a redraw never sends it twice.
    expect(container.querySelector("[data-voice-transcribe-button]")).toBeNull();
    await settle();
    expect(posts()).toHaveLength(1);
  });

  it("the switch turned off before recording stops the send; the take offers the button instead, and the choice is remembered for the visit", async () => {
    const first = render(<Card />);
    await settle();
    await act(async () => void fireEvent.click(autoSwitch()));
    expect(autoSwitch().checked).toBe(false);
    expect(window.sessionStorage.getItem("voice-write-down-automatically")).toBe("off");
    first.unmount();
    // A new page in the same visit reads the choice back.
    forgetTranscriptionOn();
    let latest: VoiceState = EMPTY_VOICE;
    render(<Card start={{ ...EMPTY_VOICE, takes: [take()] }} seen={(v) => (latest = v)} />);
    await settle();
    expect(autoSwitch().checked).toBe(false);
    expect(posts()).toEqual([]);
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: "Write down my words" })));
    await settle();
    expect(posts()).toHaveLength(1);
    expect(latest.transcript).toBe("I keep the gate at dawn, every day.");
  });

  it("turning the switch off while a take is being written down cancels it, and the box is left as it was", async () => {
    hold = true;
    let latest: VoiceState = EMPTY_VOICE;
    const { container } = render(<Card start={{ ...EMPTY_VOICE, takes: [take()], transcript: "Mine." }} seen={(v) => (latest = v)} />);
    await settle();
    expect(posts()).toHaveLength(1);
    const signal = posts()[0].init!.signal!;
    expect(signal.aborted).toBe(false);
    await act(async () => void fireEvent.click(autoSwitch()));
    await settle();
    expect(signal.aborted).toBe(true);
    expect(latest.transcript).toBe("Mine.");
    expect(latest.takes).toHaveLength(1);
    expect(container.querySelector("[data-voice-transcribe-said]")?.textContent).toBe("Stopped. Nothing more is sent. Your recording is kept.");
  });

  it("a cap that is hit is said plainly, the take is kept, and the box is left as it was", async () => {
    answer = { status: 429, body: { error: TRANSCRIBE_WORDS.tooMany } };
    let latest: VoiceState = EMPTY_VOICE;
    const { container } = render(<Card start={{ ...EMPTY_VOICE, takes: [take()], transcript: "Mine." }} seen={(v) => (latest = v)} />);
    await settle();
    expect(container.querySelector("[data-voice-transcribe-said]")?.textContent).toBe(
      "That's a lot of recordings written down for one connection. Your recording is still kept. Type what you said, or try again in an hour.",
    );
    expect(latest.transcript).toBe("Mine.");
    expect(latest.takes).toHaveLength(1);
    // The button is there to try again by hand.
    expect(screen.getByRole("button", { name: "Write down my words" })).toBeTruthy();
  });
});

describe("a clip beside an answer gets its words written down too", () => {
  function Form({ seen }: { seen?: (v: VoiceState, why: string) => void }) {
    const [voice, setVoice] = useState<VoiceState>(EMPTY_VOICE);
    const [why, setWhy] = useState("");
    seen?.(voice, why);
    return (
      <VoiceClipsProvider voice={voice} setVoice={setVoice} limits={{ max: 12, seconds: 60 }} link="tok-123">
        <GrowingField aria-label="Why" clip="why" value={why} onChange={setWhy} />
      </VoiceClipsProvider>
    );
  }

  it("shows the AI line and the switch before the first clip, sends the clip by itself, and puts its words in the answer", async () => {
    let voice: VoiceState = EMPTY_VOICE;
    let why = "";
    const { container } = render(<Form seen={(v, w) => ((voice = v), (why = w))} />);
    await settle();
    expect(container.querySelector("[data-voice-clip] [data-voice-ai-line]")?.textContent).toBe(TRANSCRIBE_WORDS.consentLine);
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: "Record this answer: Why" })));
    await settle();
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: "Stop: Why" })));
    await settle();
    expect(posts()).toHaveLength(1);
    expect((posts()[0].init!.body as FormData).get("link")).toBe("tok-123");
    // Counted as a clip on the server, apart from the takes.
    expect((posts()[0].init!.body as FormData).get("kind")).toBe("clip");
    expect(why).toBe("I keep the gate at dawn, every day.");
    expect(voice.clips.why).toMatchObject({ words: "I keep the gate at dawn, every day.", written: true });
  });

  it("with the switch off, nothing is sent until the clip's own button is pressed", async () => {
    window.sessionStorage.setItem("voice-write-down-automatically", "off");
    let why = "";
    render(<Form seen={(_v, w) => (why = w)} />);
    await settle();
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: "Record this answer: Why" })));
    await settle();
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: "Stop: Why" })));
    await settle();
    expect(posts()).toEqual([]);
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: "Write down my words" })));
    await settle();
    expect(posts()).toHaveLength(1);
    expect(why).toBe("I keep the gate at dawn, every day.");
  });

  const posts = () => calls.filter((c) => c.init?.method === "POST");
});

describe("a fresh recording shows its length before it is played", () => {
  it("seeks far past the end when the player cannot read the length, then comes back to the start", async () => {
    render(<TakePlayer url="blob:take" type="audio/webm" name="voice-1" />);
    const audio = document.querySelector("[data-voice-player]") as HTMLAudioElement;
    let duration = Infinity;
    let time = 0;
    Object.defineProperty(audio, "duration", { configurable: true, get: () => duration });
    Object.defineProperty(audio, "currentTime", { configurable: true, get: () => time, set: (v: number) => void (time = v) });
    await act(async () => void audio.dispatchEvent(new Event("loadedmetadata")));
    await settle();
    expect(time).toBe(1e7);
    // The browser read it through and learned its length: back to the start, and the total shows.
    duration = 33;
    await act(async () => void audio.dispatchEvent(new Event("durationchange")));
    expect(time).toBe(0);
  });

  it("leaves a player that knows its length alone", async () => {
    render(<TakePlayer url="blob:take" type="audio/mp4" name="voice-1" />);
    const audio = document.querySelector("[data-voice-player]") as HTMLAudioElement;
    let time = 0;
    Object.defineProperty(audio, "duration", { configurable: true, get: () => 33 });
    Object.defineProperty(audio, "currentTime", { configurable: true, get: () => time, set: (v: number) => void (time = v) });
    await act(async () => void audio.dispatchEvent(new Event("loadedmetadata")));
    await settle();
    expect(time).toBe(0);
  });
});

describe("playback for the deciders on every browser", () => {
  // jsdom names Apple as its vendor; these cases are Chrome's and Firefox's engines unless they say so.
  beforeEach(() => Object.defineProperty(navigator, "vendor", { configurable: true, value: "Google Inc." }));
  afterEach(() => Object.defineProperty(navigator, "vendor", { configurable: true, value: "" }));

  it("asks for the MP4/AAC copy on Safari's engine, or wherever the player says it cannot play the type", () => {
    expect(wantsMp4Copy("audio/webm", () => "maybe", true)).toBe(true);
    expect(wantsMp4Copy("audio/webm", () => "", false)).toBe(true);
    expect(wantsMp4Copy("audio/webm;codecs=opus", () => "probably", false)).toBe(false);
    expect(wantsMp4Copy("audio/mp4", () => "", true)).toBe(false);
    expect(mp4Href("/api/x/voice/pv-1")).toBe("/api/x/voice/pv-1?as=mp4");
  });

  it("Listen on a browser that cannot play WebM fetches the copy and plays it", async () => {
    const asked: string[] = [];
    const fetcher = async (href: string) => {
      asked.push(href);
      return href.endsWith("?as=mp4")
        ? new Response(new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]), { status: 200, headers: { "content-type": "audio/mp4" } })
        : new Response(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]), { status: 200, headers: { "content-type": "audio/webm" } });
    };
    const spy = vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockImplementation((t: string) => (t === "audio/webm" ? "" : "maybe"));
    const { container } = render(<PlayVoice href="/api/x/voice/pv-1" seconds={300} label="Recording 1" fetcher={fetcher} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });
    await settle();
    expect(asked).toEqual(["/api/x/voice/pv-1", "/api/x/voice/pv-1?as=mp4"]);
    expect(container.querySelector("[data-voice-heard-player]")).not.toBeNull();
    spy.mockRestore();
  });

  it("a browser that says it plays WebM is handed the original first; if its player refuses it, the copy is tried once, then it says so", async () => {
    const asked: string[] = [];
    const fetcher = async (href: string) => {
      asked.push(href);
      return new Response(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]), { status: 200, headers: { "content-type": "audio/webm" } });
    };
    const spy = vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockImplementation(() => "maybe");
    render(<PlayVoice href="/api/x/voice/pv-1" seconds={300} label="Recording 1" fetcher={fetcher} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });
    // Listen asked for the original alone.
    expect(asked[0]).toBe("/api/x/voice/pv-1");
    const player = () => document.querySelector("[data-voice-heard-player]");
    await settle();
    if (player()) await act(async () => void player()!.dispatchEvent(new Event("error")));
    await settle();
    if (player()) await act(async () => void player()!.dispatchEvent(new Event("error")));
    await settle();
    // The original refused: the copy once, and when that is refused too, the reader is told.
    expect(asked).toEqual(["/api/x/voice/pv-1", "/api/x/voice/pv-1?as=mp4"]);
    expect(screen.getByRole("status").textContent).toBe(VOICE_WORDS.unplayable);
    spy.mockRestore();
  });
});
