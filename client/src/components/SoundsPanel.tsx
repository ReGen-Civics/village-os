/**
 * Admin → Make This Yours → Sounds (gap G8).
 *
 * One short file per moment and a village-wide volume. The files live in the
 * uploads volume (server/routes/brandSounds.ts); a member hears them only once
 * they turn the village's sounds on, and reduced motion keeps everything
 * silent. A moment with no file stays silent, which is every village's default.
 *
 * Self-contained like TypographyPanel: Admin.tsx mounts it with one line.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Trans, useLingui } from "@lingui/react/macro";
import { SOUND_MANIFEST } from "@/lib/sound";
import { SOUND_MOMENT_IDS, type SoundMomentId } from "@shared/soundMoments";

interface Sounds {
  volume: number;
  files: Partial<Record<SoundMomentId, { ogg?: string; mp3?: string }>>;
}

export default function SoundsPanel({ password }: { password: string }) {
  const { t } = useLingui();
  const [sounds, setSounds] = useState<Sounds | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const auth = { Authorization: `Bearer ${password}` };

  const load = useCallback(async () => {
    const res = await fetch("/api/brand/sounds", { cache: "no-cache" }).catch(() => null);
    setSounds(res?.ok ? await res.json() : { volume: 0.5, files: {} });
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const upload = async (moment: SoundMomentId, file: File) => {
    setBusy(moment);
    const form = new FormData();
    form.append("file", file);
    form.append("moment", moment);
    const res = await fetch("/api/admin/brand/sound", { method: "POST", headers: auth, body: form }).catch(() => null);
    const d = await res?.json().catch(() => null);
    if (!res?.ok) toast.error(d?.error ?? t`That sound did not save.`);
    else setSounds(d.sounds);
    setBusy(null);
  };

  const remove = async (moment: SoundMomentId) => {
    const res = await fetch(`/api/admin/brand/sound/${moment}`, { method: "DELETE", headers: auth }).catch(() => null);
    const d = await res?.json().catch(() => null);
    if (res?.ok) setSounds(d.sounds);
  };

  const setVolume = async (volume: number) => {
    const res = await fetch("/api/admin/brand/sounds", {
      method: "PUT",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ volume }),
    }).catch(() => null);
    const d = await res?.json().catch(() => null);
    if (res?.ok) setSounds(d.sounds);
  };

  if (!sounds) return null;
  return (
    <div className="bg-card border border-border rounded-2xl p-6 mt-6">
      <h3 className="font-semibold text-foreground mb-1">
        <Trans context="admin: the village sounds panel heading">Sounds</Trans>
      </h3>
      <p className="text-xs text-muted-foreground mb-4 max-w-prose">
        <Trans>
          A short sound for each moment, OGG (best) or MP3, under 300 KB. Members hear them only after they turn the
          village's sounds on, and never with reduced motion. A moment with no file stays silent.
        </Trans>
      </p>
      <label className="flex items-center gap-3 text-sm text-foreground mb-4">
        <Trans context="admin sounds: the village-wide volume">Volume</Trans>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          defaultValue={sounds.volume}
          onMouseUp={(e) => void setVolume(Number((e.target as HTMLInputElement).value))}
          onKeyUp={(e) => void setVolume(Number((e.target as HTMLInputElement).value))}
          className="w-40"
        />
        <span className="text-xs text-muted-foreground">{Math.round(sounds.volume * 100)}%</span>
      </label>
      <ul className="grid gap-3 sm:grid-cols-2 list-none p-0 m-0">
        {SOUND_MOMENT_IDS.map((m) => {
          const f = sounds.files[m];
          const name = f?.ogg ?? f?.mp3;
          return (
            <li key={m} className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium text-foreground m-0">{SOUND_MANIFEST[m].moment}</p>
              <p className="text-xs text-muted-foreground m-0 mb-2">{SOUND_MANIFEST[m].wanted}</p>
              {name ? <audio controls preload="none" src={`/api/uploads/${name}`} className="w-full mb-2" /> : null}
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs rounded-lg border border-border px-2.5 py-1.5 cursor-pointer text-foreground">
                  <input
                    type="file"
                    accept=".ogg,.mp3,audio/ogg,audio/mpeg"
                    className="sr-only"
                    disabled={busy === m}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void upload(m, file);
                    }}
                  />
                  {busy === m ? <Trans context="admin sounds: while a sound uploads">Uploading…</Trans> : name ? <Trans context="admin sounds: replace a moment's sound">Replace</Trans> : <Trans context="admin sounds: add a moment's sound">Add a sound</Trans>}
                </label>
                {name ? (
                  <button type="button" onClick={() => void remove(m)} className="text-xs underline text-muted-foreground">
                    <Trans context="admin sounds: make a moment silent again">Silence</Trans>
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
