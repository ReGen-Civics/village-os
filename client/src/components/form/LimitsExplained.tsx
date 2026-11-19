/**
 * THE FOUR KINDS OF LIMIT, IN PLAIN WORDS (the ops request of 19 Nov 2026). Shown once near the top of the
 * application and behind the "?" beside each box (LimitSigns.tsx), and loaded only when somebody opens it:
 *
 *   (a) the writing limit of an answer, in characters and roughly in minutes of talking;
 *   (b) how long one recording runs;
 *   (c) how big a file or a recording may be;
 *   (d) how long a send can take on a slow connection, and that the answers stay put meanwhile.
 *
 * Every number comes from shared/applyLimits.ts, so the words can never say one limit while the form holds another.
 */
import { useLingui } from "@lingui/react/macro";
import { APPLY_TEXT, FILE_MAX_BYTES, TAKE_MAX_BYTES, TAKE_MAX_SECONDS, VOICE_BOX_FLOOR, halfMinutes, minutesOfTalk } from "@shared/applyLimits";
import { useNumber } from "./LimitSigns";

/** Megabytes as the rest of the form says them (shared/proposalAttachments.ts: 1024 x 1024 bytes). */
const MB = 1024 * 1024;

export default function LimitsExplained({ max, voice = true }: { max?: number; voice?: boolean }) {
  const { t } = useLingui();
  const n = useNumber();
  const take = TAKE_MAX_SECONDS / 60;
  const fileMb = Math.floor(FILE_MAX_BYTES / MB);
  const takeMb = Math.floor(TAKE_MAX_BYTES / MB);
  const writing =
    typeof max === "number"
      ? voice
        ? t({ message: `This answer holds ${n(max)} characters, about ${halfMinutes(minutesOfTalk(max))} minutes of talking. The count under the box shows how much is used.`, context: "how the limits work" })
        : t({ message: `This answer holds ${n(max)} characters. The count under the box shows how much is used.`, context: "how the limits work" })
      : t({ message: `Each answer has a writing limit, counted under its box in characters. "Why you, and why now" holds ${n(APPLY_TEXT.why)}, and every answer you can speak into holds at least ${n(VOICE_BOX_FLOOR)}, about ${halfMinutes(minutesOfTalk(VOICE_BOX_FLOOR))} minutes of talking.`, context: "how the limits work" });
  return (
    <ul className="grid list-disc gap-1.5 pl-5 text-sm leading-relaxed text-muted-foreground" data-limits-explained="">
      <li>
        <span className="font-semibold text-foreground">{t({ message: "Writing:", context: "how the limits work" })}</span> {writing}{" "}
        {t({ message: "If an answer runs over, every word stays in the box, and we show how much to trim before it can be sent.", context: "how the limits work" })}
      </li>
      <li>
        <span className="font-semibold text-foreground">{t({ message: "Recording:", context: "how the limits work" })}</span>{" "}
        {t({ message: `One recording runs up to ${take} minutes. A timer shows the time left, and at the end it stops by itself and keeps everything you said.`, context: "how the limits work" })}
      </li>
      <li>
        <span className="font-semibold text-foreground">{t({ message: "Uploads:", context: "how the limits work" })}</span>{" "}
        {t({ message: `A file such as a CV can be up to ${fileMb} MB, and one recording up to ${takeMb} MB.`, context: "how the limits work" })}
      </li>
      <li>
        <span className="font-semibold text-foreground">{t({ message: "Sending:", context: "how the limits work" })}</span>{" "}
        {t({ message: "With recordings or files, a send can take several minutes on a slow connection. Keep this page open until it says it is sent. Your answers stay on this page while it sends, and on this device too when you have chosen to remember them.", context: "how the limits work" })}
      </li>
    </ul>
  );
}
