/**
 * HOW A TAKE ENDED, AND PLAYING IT BACK (an applicant, 17 Nov 2026: "I just
 * recorded like 5 minutes ... it doesn't seem to play back"). Shared by the
 * voice card (VoiceInvite.tsx) and the clips beside answers (VoiceClips.tsx).
 */
import { useState, type SyntheticEvent } from "react";
import { voiceKindOfType } from "@shared/voiceNotes";
import { voiceWord } from "@/components/fireflyPath/applyWordsT";
import type { RecorderProblem } from "./useVoiceRecorder";

/** What to tell the person about how a recording ended, or null. Shared by the voice card and the clips. */
export function recorderProblemWords(problem: RecorderProblem): string | null {
  switch (problem) {
    case "blocked":
      return voiceWord("micBlocked");
    case "noMic":
      return voiceWord("noMic");
    case "cut":
      return voiceWord("cutShort");
    case "empty":
      return voiceWord("emptyTake");
    case "limit":
      return voiceWord("reachedLimit");
    default:
      return null;
  }
}

/**
 * A FRESH RECORDING'S LENGTH, on every browser (live test on 1.3.20, 17 Nov
 * 2026). A recording MediaRecorder just made carries no length in its header,
 * so Firefox, and Chromium before a seek, report its duration as Infinity or
 * NaN and the player shows "0:02 /" with no total. The known cure: once the
 * metadata is in, seek far past the end, which makes the browser read the file
 * through and learn its length, then come back to the start. Nothing plays.
 */
export function learnLength(e: SyntheticEvent<HTMLAudioElement>): void {
  const a = e.currentTarget;
  if (Number.isFinite(a.duration) && a.duration > 0) return;
  // A player that was to start by itself (Listen, for the deciders) starts again once it is back.
  const resume = a.autoplay || !a.paused;
  const back = () => {
    if (!Number.isFinite(a.duration)) return;
    a.removeEventListener("durationchange", back);
    a.removeEventListener("timeupdate", back);
    a.currentTime = 0;
    if (resume) void a.play()?.catch?.(() => undefined);
  };
  a.addEventListener("durationchange", back);
  a.addEventListener("timeupdate", back);
  try {
    a.currentTime = 1e7;
  } catch {
    back();
  }
}

/**
 * The player for one take. Where this browser cannot play what it recorded,
 * the person is told the recording is still kept, and is given a copy to save,
 * so nothing they said hangs on the player working.
 */
export function TakePlayer({ url, type, name, label, className = "h-10 min-w-0 flex-1 basis-48" }: { url: string; type: string; name: string; label?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <>
      <audio controls preload="metadata" src={url} aria-label={label} onLoadedMetadata={learnLength} onError={() => setFailed(true)} className={className} data-voice-player="" />
      {failed && (
        <p className="basis-full border-l-4 border-notice pl-3 text-sm text-foreground" role="status" data-voice-cant-play="">
          {voiceWord("cantPlay")}{" "}
          <a href={url} download={`${name}.${voiceKindOfType(type)}`} className="font-medium text-notice underline underline-offset-2 hover:text-foreground">
            {voiceWord("saveCopy")}
          </a>
        </p>
      )}
    </>
  );
}
