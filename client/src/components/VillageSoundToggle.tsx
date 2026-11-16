/**
 * THE MEMBER'S OWN SWITCH FOR THE VILLAGE'S SOUNDS (gap G8). Shown only when
 * the village loaded sounds of its own; they start off, and this turns them on
 * for this member on this device (client/src/lib/sound.ts keeps the choice per
 * member). Reduced motion keeps everything silent whatever this says.
 */
import { useEffect, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { onVillageSounds, useSound, villageHasSounds } from "@/lib/sound";

export default function VillageSoundToggle() {
  const { muted, setMuted } = useSound();
  const [has, setHas] = useState(villageHasSounds);
  useEffect(() => onVillageSounds(() => setHas(villageHasSounds())), []);
  if (!has) return null;
  return (
    <label className="flex items-start gap-2 text-sm text-card-foreground mb-4">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 shrink-0"
        checked={!muted}
        onChange={(e) => setMuted(!e.target.checked)}
        aria-describedby="village-sound-hint"
      />
      <span>
        <Trans>Play the village's sounds</Trans>
        <span id="village-sound-hint" className="block text-xs text-muted-foreground">
          <Trans>A short sound at a few moments, such as a quest done or a stage reached. Off until you turn it on, on this device.</Trans>
        </span>
      </span>
    </label>
  );
}
