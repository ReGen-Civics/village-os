/**
 * A FRESH RECORDING'S LENGTH, on every browser (live test on 1.3.20, 17 Nov
 * 2026). A recording MediaRecorder just made carries no length in its header,
 * so Firefox, and Chromium before a seek, report its duration as Infinity or
 * NaN and the player shows "0:02 /" with no total. The known cure: once the
 * metadata is in, seek far past the end, which makes the browser read the file
 * through and learn its length, then come back to the start. Nothing plays.
 */
export function learnLength(a: HTMLAudioElement): void {
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
