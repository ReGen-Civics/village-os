/**
 * A one-line answer with the voice button in its corner: GrowingField's mic,
 * for the fields that stay one line (an aim, a story line, a value item).
 *
 * Each finished spoken phrase is appended to what is written, cut at the
 * field's own length limit so speech can never send more than typing could.
 * The browser's speech service does the listening (MicButton says where the
 * sound goes). Where the browser cannot listen, MicButton draws nothing and the field is
 * the plain input it was.
 */
import { useRef, type InputHTMLAttributes } from "react";
import MicButton from "@/components/MicButton";
import { appendSpoken } from "@/components/journal/GrowingTextarea";
import { ClipBar } from "@/components/voice/VoiceClips";
import { useFieldName } from "@/components/form/fieldName";

/** A spoken phrase added to the text, never past the field's limit. */
export function spokenInto(value: string, chunk: string, maxLength?: number): string {
  const next = appendSpoken(value, chunk);
  return typeof maxLength === "number" && maxLength > 0 ? next.slice(0, maxLength) : next;
}

export default function MicInput({
  value,
  onChange,
  className = "",
  clip,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  /** The answer's key for a voice clip beside it (components/voice/VoiceClips.tsx); drawn only inside the application's clip provider. */
  clip?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const fieldName = useFieldName(ref);
  const said = (chunk: string) => onChange(spokenInto(value, chunk, rest.maxLength));
  return (
    <div>
    <div className="relative">
      <input ref={ref} value={value} onChange={(e) => onChange(e.target.value)} className={`pr-14 ${className}`} {...rest} />
      {/* MicButton's own wrapper is relative, so the corner is placed out here. */}
      <span className="absolute inset-y-0 right-0.5 flex items-center">
        <MicButton disabled={rest.disabled} onText={said} fieldName={fieldName} />
      </span>
    </div>
    {clip && <ClipBar field={clip} onWords={said} fieldName={fieldName} />}
    </div>
  );
}
