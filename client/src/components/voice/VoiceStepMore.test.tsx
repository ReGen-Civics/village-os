// @vitest-environment jsdom
/**
 * THE VOICE STEP'S ADDITIONS OF 17 NOV 2026 (VoiceStepMore.tsx, VoiceHeard.tsx).
 *
 *   - A clear limit: "Up to 5 minutes per take" before recording, a countdown in
 *     the last minute, and the hard stop at 5:00 with the limit message.
 *   - "Write down my words": drawn only while the village's service is on, sends
 *     the one take with its length and language, and puts the words in the box
 *     for the applicant to fix, replacing what the live engine caught for that
 *     take and nothing they typed.
 *   - Playback on Safari: a WebM is swapped for its MP4/AAC copy.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { VOICE_WORDS } from "@shared/voiceNotes";
import { TRANSCRIBE_WORDS, VOICE_TRANSCRIBE_PATH } from "@shared/voiceTranscribe";
import { EMPTY_VOICE, VoiceInvite, type VoiceState, type VoiceTake } from "./VoiceInvite";
import { countdownLeft, forgetTranscriptionOn, withWrittenWords } from "./VoiceStepMore";
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

beforeEach(() => {
  calls = [];
  serviceOn = true;
  answer = { status: 200, body: { text: "I keep the gate at dawn, every day." } };
  forgetTranscriptionOn();
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [], getAudioTracks: () => [] }) } });
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:take", revokeObjectURL: () => {} }));
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url === VOICE_TRANSCRIBE_PATH && (!init || !init.method)) return new Response(JSON.stringify({ on: serviceOn }), { status: 200 });
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

describe("write down my words", () => {
  const take = (words?: string): VoiceTake => ({ blob: WEBM(), seconds: 300, url: "blob:take", words });

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

  it("while the service is off, no button and no AI line are drawn, and nothing is sent", async () => {
    serviceOn = false;
    const { container } = render(<Card start={{ ...EMPTY_VOICE, takes: [take()] }} />);
    await settle();
    expect(container.querySelector("[data-voice-limit-note]")).not.toBeNull();
    expect(container.querySelector("[data-voice-ai-line]")).toBeNull();
    expect(container.querySelector("[data-voice-transcribe-button]")).toBeNull();
    expect(calls.filter((c) => c.init?.method === "POST")).toEqual([]);
  });

  it("while on: says an AI service writes it down, sends the one take, and puts the words in the box to fix", async () => {
    let latest: VoiceState = EMPTY_VOICE;
    const { container } = render(<Card start={{ ...EMPTY_VOICE, takes: [take()] }} seen={(v) => (latest = v)} />);
    await settle();
    expect(container.querySelector("[data-voice-ai-line]")?.textContent).toBe(TRANSCRIBE_WORDS.consentLine);
    expect(container.querySelector("[data-voice-transcribe]")?.textContent).toContain(TRANSCRIBE_WORDS.consentLine);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Write down my words" }));
    });
    await settle();
    const post = calls.find((c) => c.init?.method === "POST")!;
    expect(post.url).toBe(VOICE_TRANSCRIBE_PATH);
    const fd = post.init!.body as FormData;
    expect(fd.get("seconds")).toBe("300");
    expect((fd.get("voice") as File).type).toBe("audio/webm");
    expect(Array.from(fd.keys()).sort()).toEqual(["lang", "seconds", "voice"]);
    expect(latest.transcript).toBe("I keep the gate at dawn, every day.");
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("I keep the gate at dawn, every day.");
    expect(screen.getByRole("button", { name: "Write it down again" })).toBeTruthy();
  });

  it("a refusal is said in the reader's words, and the box is left as it was", async () => {
    answer = { status: 429, body: { error: TRANSCRIBE_WORDS.tooMany } };
    let latest: VoiceState = EMPTY_VOICE;
    const { container } = render(<Card start={{ ...EMPTY_VOICE, takes: [take()], transcript: "Mine." }} seen={(v) => (latest = v)} />);
    await settle();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Write down my words" }));
    });
    await settle();
    expect(container.querySelector("[data-voice-transcribe-said]")?.textContent).toBe(TRANSCRIBE_WORDS.tooMany);
    expect(latest.transcript).toBe("Mine.");
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
