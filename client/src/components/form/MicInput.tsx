/**
 * A one-line answer with the voice button in its corner: GrowingField's mic,
 * for the fields that stay one line (an aim, a story line, a value item).
 *
 * Each finished spoken phrase is appended to what is written, whole: nothing
 * said is cut (the ops request of 19 Nov 2026). With `limit`, the field shows
 * its count and how much to trim (LimitSigns.tsx), and the page's send holds an
 * answer over it.
 * The browser's speech service does the listening (MicButton says where the
 * sound goes). Where the browser cannot listen, MicButton draws nothing and the field is
 * the plain input it was.
 */
import { useRef, type InputHTMLAttributes } from "react";
import MicButton from "@/components/MicButton";
import { appendSpoken } from "@/components/journal/GrowingTextarea";
import { ClipBar } from "@/components/voice/VoiceClips";
import { useFieldName } from "@/components/form/fieldName";
import { LimitSigns } from "@/components/form/LimitSigns";

/**
 * A spoken phrase added to the text, whole. A field's limit is shown and held at send, never applied by cutting
 * what was said (the ops request of 19 Nov 2026); `_maxLength` is read no more and kept for the callers' shape.
 */
export function spokenInto(value: string, chunk: string, _maxLength?: number): string {
  return appendSpoken(value, chunk);
}

export default function MicInput({
  value,
  onChange,
  className = "",
  clip,
  limit,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  /** The answer's key for a voice clip beside it (components/voice/VoiceClips.tsx); drawn only inside the application's clip provider. */
  clip?: string;
  /** A limit that never cuts: the count, the notices and the trim under the field (LimitSigns.tsx). Use it in place of `maxLength`. */
  limit?: number;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const fieldName = useFieldName(ref);
  const said = (chunk: string) => onChange(spokenInto(value, chunk, rest.maxLength));
  return (
    <div>
    <div className="relative">
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`pr-14 ${className}`}
        {...rest}
        {...(limit && value.length > limit && rest["aria-invalid"] === undefined ? { "aria-invalid": true } : {})}
        aria-describedby={[rest["aria-describedby"], limit && rest.id ? `${rest.id}-count` : ""].filter(Boolean).join(" ") || undefined}
      />
      {/* MicButton's own wrapper is relative, so the corner is placed out here. */}
      <span className="absolute inset-y-0 right-0.5 flex items-center">
        <MicButton disabled={rest.disabled} onText={said} fieldName={fieldName} />
      </span>
    </div>
    {limit ? <LimitSigns value={value} max={limit} id={rest.id ? `${rest.id}-count` : undefined} /> : null}
    {clip && <ClipBar field={clip} onWords={said} fieldName={fieldName} answer={{ value, set: onChange, limit: limit ?? rest.maxLength }} />}
    </div>
  );
}
