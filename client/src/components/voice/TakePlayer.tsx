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
 * A fresh recording's length, on every browser (learnLength.ts). Loaded when a
 * player first has its metadata, so the application's first view does not
 * carry it.
 */
export const learnLengthLater = (e: SyntheticEvent<HTMLAudioElement>): void => {
  const a = e.currentTarget;
  void import("./learnLength").then((m) => m.learnLength(a));
};

/**
 * The player for one take. Where this browser cannot play what it recorded,
 * the person is told the recording is still kept, and is given a copy to save,
 * so nothing they said hangs on the player working.
 */
export function TakePlayer({ url, type, name, label, className = "h-10 min-w-0 flex-1 basis-48" }: { url: string; type: string; name: string; label?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <>
      <audio controls preload="metadata" src={url} aria-label={label} onLoadedMetadata={learnLengthLater} onError={() => setFailed(true)} className={className} data-voice-player="" />
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
