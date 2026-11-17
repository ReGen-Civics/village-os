/**
 * A sentence box that wraps and grows with what is typed.
 *
 * A single-line input cuts a sentence off at the edge of the screen. This
 * stays at least 44px tall, wraps long words, and grows to the text.
 */
import { useEffect, useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";
import MicButton from "@/components/MicButton";
import { spokenInto } from "@/components/form/MicInput";
import { ClipBar } from "@/components/voice/VoiceClips";
import { useFieldName } from "@/components/form/fieldName";
import { useLingui } from "@lingui/react/macro";

export default function GrowingField({
  value,
  onChange,
  minRows = 2,
  className = "",
  mic = true,
  clip,
  counter = false,
  ...rest
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  minRows?: number;
  /** The voice button in the box's corner (MicButton; the browser's speech service turns speech into text, see MicButton for where it goes). On unless the page says otherwise. */
  mic?: boolean;
  /** The answer's key for a voice clip beside it (components/voice/VoiceClips.tsx); drawn only inside the application's clip provider. */
  clip?: string;
  /** Show how many characters are left of `maxLength`, so the box never cuts an answer off unseen (a11y sweep, 14 Nov 2026). */
  counter?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fieldName = useFieldName(ref);
  // A box drawn inside a hidden step measures 0: it keeps its rows until it is shown, then fits.
  const fit = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    if (el.scrollHeight > 0) el.style.height = `${el.scrollHeight}px`;
  };
  useLayoutEffect(fit, [value]);
  // Shown, or its width changed: fit again. Only a width change counts, so fitting never feeds itself.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let width = el.clientWidth;
    const watch = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fit();
    });
    watch.observe(el);
    return () => watch.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const box = (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`min-h-[44px] w-full max-w-full resize-none overflow-hidden whitespace-pre-wrap break-words ${mic ? "pr-12" : ""} ${className}`}
      {...rest}
      aria-describedby={[rest["aria-describedby"], counter && rest.maxLength && rest.id ? `${rest.id}-count` : ""].filter(Boolean).join(" ") || undefined}
    />
  );
  const said = (chunk: string) => onChange(spokenInto(value, chunk, rest.maxLength));
  const clipBar = clip ? <ClipBar field={clip} onWords={said} fieldName={fieldName} answer={{ value, set: onChange, maxLength: rest.maxLength }} /> : null;
  const max = typeof rest.maxLength === "number" && rest.maxLength > 0 ? rest.maxLength : 0;
  const count = counter && max ? <CharacterCount used={value.length} max={max} id={rest.id ? `${rest.id}-count` : undefined} /> : null;
  if (!mic) return clipBar || count ? <div>{box}{count}{clipBar}</div> : box;
  return (
    <div>
      <div className="relative">
        {box}
        <MicButton className="absolute bottom-1 right-1" disabled={rest.disabled} onText={said} fieldName={fieldName} />
      </div>
      {count}
      {clipBar}
    </div>
  );
}

/**
 * How much of the box is used, under it. Read with the box (aria-describedby),
 * and said once aloud only when the limit is reached, never on every key.
 */
function CharacterCount({ used, max, id }: { used: number; max: number; id?: string }) {
  const { t } = useLingui();
  const full = used >= max;
  const usedText = used.toLocaleString();
  const maxText = max.toLocaleString();
  return (
    <div className="mt-1 flex justify-end text-sm">
      <span id={id} className={`tabular-nums ${full ? "font-semibold text-foreground" : "text-muted-foreground"}`} data-character-count="">
        {t({ message: `${usedText} / ${maxText} characters`, context: "character count under a box" })}
      </span>
      <span className="sr-only" role="status">
        {full ? t({ message: `You have reached the ${maxText} character limit.`, context: "character count under a box" }) : ""}
      </span>
    </div>
  );
}
