// @vitest-environment jsdom
/**
 * The record button beside an answer (Rye, 14 Nov 2026): drawn only on the
 * application (inside its provider), within the village's limit, and with the
 * tick under the first clip.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { VOICE_WORDS } from "@shared/voiceNotes";
import GrowingField from "@/components/form/GrowingField";
import { forField } from "@/components/form/fieldName";
import { VoiceClipsProvider } from "./VoiceClips";
import { EMPTY_VOICE, type VoiceState } from "./VoiceInvite";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const recorder = () => {
  vi.stubGlobal("MediaRecorder", class {});
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => ({}) } });
};
const clip = { blob: new Blob([new Uint8Array([1])]), seconds: 20, url: "blob:c", words: "" };

function Form({ start = EMPTY_VOICE, max = 12 }: { start?: VoiceState; max?: number }) {
  const [voice, setVoice] = useState(start);
  const [why, setWhy] = useState("");
  return (
    <VoiceClipsProvider voice={voice} setVoice={setVoice} limits={{ max, seconds: 60 }}>
      <GrowingField aria-label="Why" clip="why" value={why} onChange={setWhy} />
      <span data-testid="consent">{String(voice.consent)}</span>
    </VoiceClipsProvider>
  );
}

describe("a clip beside an answer", () => {
  it("names every control for its own answer, from the answer's label (a11y sweep P2-9)", () => {
    recorder();
    vi.stubGlobal("URL", Object.assign(URL, { revokeObjectURL: () => {} }));
    function Two() {
      const [voice, setVoice] = useState<VoiceState>({ ...EMPTY_VOICE, clips: { aim: clip } });
      return (
        <VoiceClipsProvider voice={voice} setVoice={setVoice} limits={{ max: 12, seconds: 60 }}>
          <label htmlFor="f-why">Why you, and why now</label>
          <GrowingField id="f-why" clip="why" value="" onChange={() => {}} />
          <label htmlFor="f-aim">Your aim in this role</label>
          <GrowingField id="f-aim" clip="aim" value="" onChange={() => {}} />
        </VoiceClipsProvider>
      );
    }
    render(<Two />);
    expect(screen.getByRole("button", { name: "Record this answer: Why you, and why now" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Record again: Your aim in this role" })).toBeTruthy();
    expect(screen.getByLabelText("Your voice for this answer: Your aim in this role").tagName).toBe("AUDIO");
    expect(screen.getByRole("button", { name: "Remove clip: Your aim in this role" })).toBeTruthy();
  });

  it("is drawn only on the application, where the browser can record", () => {
    recorder();
    render(<GrowingField aria-label="Elsewhere" clip="why" value="" onChange={() => {}} />);
    expect(screen.queryByRole("button", { name: forField(VOICE_WORDS.clipRecord, "Elsewhere") })).toBeNull();
    render(<Form />);
    expect(screen.getByRole("button", { name: forField(VOICE_WORDS.clipRecord, "Why") })).toBeTruthy();
  });

  it("is not drawn where the village allows no clips, and says so when the limit is reached", () => {
    recorder();
    const { unmount } = render(<Form max={0} />);
    expect(screen.queryByRole("button", { name: forField(VOICE_WORDS.clipRecord, "Why") })).toBeNull();
    unmount();
    render(<Form max={1} start={{ ...EMPTY_VOICE, clips: { aim: clip } }} />);
    expect((screen.getByRole("button", { name: forField(VOICE_WORDS.clipRecord, "Why") }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(VOICE_WORDS.clipsFull(1))).toBeTruthy();
  });

  it("shows the clip with the tick under it until it is given, and removes it with one press", () => {
    recorder();
    vi.stubGlobal("URL", Object.assign(URL, { revokeObjectURL: () => {} }));
    render(<Form start={{ ...EMPTY_VOICE, clips: { why: clip } }} />);
    expect(screen.getByRole("button", { name: forField(VOICE_WORDS.clipAgain, "Why") })).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(VOICE_WORDS.consent.slice(0, 30)) }));
    expect(screen.getByTestId("consent").textContent).toBe("true");
    expect(screen.queryByRole("checkbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: forField(VOICE_WORDS.clipRemove, "Why") }));
    expect(screen.getByRole("button", { name: forField(VOICE_WORDS.clipRecord, "Why") })).toBeTruthy();
  });
});
