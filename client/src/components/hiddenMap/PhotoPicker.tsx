/**
 * Choose a photo, read its location, let the member cover what should not be
 * seen, and hand back a SAFE copy (re-encoded, every hidden detail gone).
 * The original never leaves this component.
 */
import { useState } from "react";
import { Camera } from "lucide-react";
import { Trans, useLingui } from "@lingui/react/macro";
import type { GpsReading } from "@shared/exifGps";
import CoverTool, { type CoverChoice } from "./CoverTool";
import { CannotMakeSafe, makeSafe, readLocation } from "@/lib/hiddenMapPhoto";
import { BTN_PRIMARY, BTN_SECONDARY, HINT, LABEL } from "@/components/journey/look";

export interface SafePhoto {
  blob: Blob;
  preview: string;
}

export default function PhotoPicker({
  onLocation,
  onAdd,
  onStaged,
  label,
}: {
  onLocation?: (p: GpsReading) => void;
  onAdd: (photo: SafePhoto) => void;
  /** True while a photo is chosen and not yet used or left out, so the form can wait for it. */
  onStaged?: (staged: boolean) => void;
  label?: string;
}) {
  const { t } = useLingui();
  const [file, setFile] = useState<File | null>(null);
  const [choice, setChoice] = useState<CoverChoice>({ covers: [], crop: null });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [found, setFound] = useState<string | null>(null);

  const choose = async (f: File | null) => {
    setProblem(null);
    setFound(null);
    setChoice({ covers: [], crop: null });
    setFile(f);
    onStaged?.(f !== null);
    if (!f) return;
    const at = await readLocation(f);
    if (at) {
      onLocation?.(at);
      setFound(t`Location read from the photo. It is removed from the photo before it goes up.`);
    } else {
      setFound(t`This photo carries no location. Paste the place or tap the map instead.`);
    }
  };

  const confirm = async () => {
    if (!file) return;
    setBusy(true);
    setProblem(null);
    try {
      const blob = await makeSafe(file, choice.covers, choice.crop ?? undefined);
      onAdd({ blob, preview: URL.createObjectURL(blob) });
      setFile(null);
      onStaged?.(false);
      setChoice({ covers: [], crop: null });
    } catch (e) {
      setProblem(e instanceof CannotMakeSafe ? t`This phone could not prepare that photo safely, so it was not added. Try a different photo.` : t`That photo could not be prepared. Try a different one.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className={`${BTN_SECONDARY} cursor-pointer`}>
        <Camera className="size-4" aria-hidden="true" />
        <span>{label ?? t({ message: `Add a photo`, context: "hidden map, adding photos to a place" })}</span>
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => void choose(e.target.files?.[0] ?? null)} />
      </label>
      {found && <p className={HINT} aria-live="polite">{found}</p>}
      {file && (
        <div className="space-y-3">
          <CoverTool file={file} value={choice} onChange={setChoice} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={() => void confirm()}>
              {busy ? <Trans context="hidden map, adding photos to a place">Preparing</Trans> : <Trans context="hidden map, adding photos to a place">Use this photo</Trans>}
            </button>
            <button type="button" className={BTN_SECONDARY} onClick={() => void choose(null)}>
              <Trans context="hidden map, adding photos to a place">Leave it out</Trans>
            </button>
          </div>
        </div>
      )}
      {problem && <p className={`${LABEL} text-destructive`} role="alert">{problem}</p>}
    </div>
  );
}
