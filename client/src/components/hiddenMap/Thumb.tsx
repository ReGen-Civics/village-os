/**
 * One hidden-map photo, read with the member's token and shown from memory.
 * An `<img src>` cannot carry a token, and these photos are never public.
 */
import { useEffect, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { photoUrl } from "@/lib/hiddenMapApi";

export default function Thumb({ id, size = "thumb", alt, className = "" }: { id: string; size?: "thumb" | "full"; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let gone = false;
    let made: string | null = null;
    photoUrl(id, size)
      .then((u) => {
        made = u;
        if (gone) URL.revokeObjectURL(u);
        else setUrl(u);
      })
      .catch(() => !gone && setFailed(true));
    return () => {
      gone = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id, size]);
  if (failed) return <span className={`flex items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground ${className}`}><Trans>Photo not available</Trans></span>;
  if (!url) return <span className={`block animate-pulse rounded-lg bg-muted ${className}`} aria-hidden="true" />;
  return <img src={url} alt={alt} className={`rounded-lg object-cover ${className}`} />;
}
