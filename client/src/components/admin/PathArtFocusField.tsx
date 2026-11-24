/**
 * Where a landing path card keeps its focus, under that picture's field in the
 * Setup Wizard's Pictures step (shared/pathCardArt.ts).
 *
 * Only the four path pictures have one; every other image field draws nothing
 * here. The preview is the card's square phone cut at the typed point, so an
 * admin sees what a visitor will see before saving. A value that is not two
 * percentages is kept in the box and ignored by the card, which says so.
 */
import { useLingui } from "@lingui/react/macro";
import { DEFAULT_ART_FOCUS, PATH_ART_KEYS, artFocusOr, parseArtFocus } from "@shared/pathCardArt";

export default function PathArtFocusField({
  imageKey,
  images,
  fallback,
  onChange,
}: {
  imageKey: string;
  images: Record<string, string | undefined>;
  fallback: string | undefined;
  onChange: (key: string, value: string) => void;
}) {
  const { t } = useLingui();
  if (!(PATH_ART_KEYS as readonly string[]).includes(imageKey)) return null;
  const focusKey = `${imageKey}Focus`;
  const focus = images[focusKey] ?? "";
  const src = images[imageKey] || fallback || "";
  const bad = focus.trim() !== "" && !parseArtFocus(focus);
  return (
    <div className="mt-2" data-art-focus-field={imageKey}>
      <label className="block text-[11px] text-muted-foreground">
        {t({ message: `Where the home page card keeps its focus, across then down. Blank keeps ${DEFAULT_ART_FOCUS}, a little above the middle.`, context: "admin pictures, path card focal point" })}
        <input
          type="text"
          value={focus}
          onChange={(e) => onChange(focusKey, e.target.value)}
          placeholder={DEFAULT_ART_FOCUS}
          aria-invalid={bad}
          className="mt-1 w-full min-h-[44px] rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
      {bad ? (
        <p className="mt-1 text-[11px] text-destructive">{t({ message: `Two percentages, for example 50% 30%. Until then the card uses ${DEFAULT_ART_FOCUS}.`, context: "admin pictures, path card focal point refused" })}</p>
      ) : null}
      {src ? (
        <div className="mt-2 aspect-square w-24 overflow-hidden rounded-lg border border-border bg-muted">
          <img src={src} alt="" className="h-full w-full object-cover" style={{ objectPosition: artFocusOr(focus) }} />
        </div>
      ) : null}
    </div>
  );
}
