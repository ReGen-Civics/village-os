// @vitest-environment jsdom
/**
 * "We love hearing your voice" on the public application (Rye, 14 Nov 2026):
 * an encouraged path that is never required, and a tick that decides whether
 * anything of the voice leaves the device.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { VOICE_WORDS } from "@shared/voiceNotes";
import { EMPTY_VOICE, VoiceInvite, applicationRequest, voiceSent, type VoiceState } from "./VoiceInvite";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const take = (type = "audio/webm") => ({ blob: new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])], { type }), seconds: 42, url: "blob:take-1" });

describe("what is sent", () => {
  const proposal = { name: "Rowan", why: "Gates." };

  it("sends no recording and no words without the tick", () => {
    const v: VoiceState = { ...EMPTY_VOICE, takes: [take()], transcript: "I keep gates." };
    expect(voiceSent(v)).toBe(false);
    const r = applicationRequest(proposal, [], v);
    expect(r.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(String(r.body))).toEqual(proposal);
  });

  it("with the tick, sends the recordings in `voice` and their lengths and words with the proposal", () => {
    const v: VoiceState = { ...EMPTY_VOICE, takes: [take(), take("audio/mp4")], transcript: " I keep gates. ", consent: true };
    const r = applicationRequest(proposal, [], v);
    const fd = r.body as FormData;
    expect(JSON.parse(String(fd.get("proposal")))).toEqual({ ...proposal, voice: { consent: true, seconds: [42, 42], transcript: "I keep gates." } });
    expect((fd.getAll("voice") as File[]).map((f) => f.name)).toEqual(["voice-1.webm", "voice-2.m4a"]);
  });

  it("with the tick and words only, stays a plain JSON post", () => {
    const r = applicationRequest(proposal, [], { ...EMPTY_VOICE, transcript: "Words.", consent: true });
    expect(JSON.parse(String(r.body)).voice).toEqual({ consent: true, seconds: [], transcript: "Words." });
  });
});

function Card({ start = EMPTY_VOICE }: { start?: VoiceState }) {
  const [v, setV] = useState(start);
  return <VoiceInvite value={v} onChange={setV} />;
}

describe("the invitation", () => {
  it("is not drawn where the browser can neither record nor listen, so the form is the typed form", () => {
    render(<Card />);
    expect(screen.queryByText(VOICE_WORDS.inviteTitle)).toBeNull();
  });

  it("invites, records, and can be skipped; once there is a recording, the tick says who hears it", () => {
    vi.stubGlobal("MediaRecorder", class {});
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => ({}) } });
    const { unmount } = render(<Card />);
    expect(screen.getByText(VOICE_WORDS.inviteTitle)).toBeTruthy();
    expect(screen.getByRole("button", { name: VOICE_WORDS.record })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: VOICE_WORDS.skip }));
    expect(screen.queryByText(VOICE_WORDS.inviteTitle)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: VOICE_WORDS.reopen }));
    expect(screen.getByText(VOICE_WORDS.inviteTitle)).toBeTruthy();
    unmount();

    render(<Card start={{ ...EMPTY_VOICE, takes: [take()], transcript: "I keep gates." }} />);
    const tick = screen.getByRole("checkbox", { name: new RegExp(VOICE_WORDS.consent.slice(0, 30)) }) as HTMLInputElement;
    expect(tick.checked).toBe(false);
    expect(screen.getByText(VOICE_WORDS.notKept)).toBeTruthy();
    fireEvent.click(tick);
    expect(screen.getByText(VOICE_WORDS.kept)).toBeTruthy();
    expect(screen.getByRole("button", { name: VOICE_WORDS.recordAnother })).toBeTruthy();
    // Having spoken, they are not offered to skip what they made; Remove takes a recording away.
    expect(screen.queryByRole("button", { name: VOICE_WORDS.skip })).toBeNull();
    vi.stubGlobal("URL", Object.assign(URL, { revokeObjectURL: () => {} }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.queryByText(/Recording 1/)).toBeNull();
  });
});

describe("clips beside answers (Rye, 14 Nov 2026)", () => {
  it("sends each clip in `clips`, described in the same order, only with the tick", () => {
    const clip = { ...take("audio/mp4"), seconds: 20, words: "I keep gates." };
    const v: VoiceState = { ...EMPTY_VOICE, clips: { why: clip, "value-1-title": { ...take(), seconds: 9, words: "" } } };
    expect(applicationRequest({ name: "R" }, [], v).headers).toEqual({ "Content-Type": "application/json" });
    const fd = applicationRequest({ name: "R" }, [], { ...v, consent: true }).body as FormData;
    expect(JSON.parse(String(fd.get("proposal"))).voice.clips).toEqual([
      { field: "why", seconds: 20, words: "I keep gates." },
      { field: "value-1-title", seconds: 9, words: "" },
    ]);
    expect((fd.getAll("clips") as File[]).map((f) => f.name)).toEqual(["why.m4a", "value-1-title.webm"]);
  });
});
