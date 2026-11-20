/**
 * "COPY LINK" UNDER ONE ROLE ON /roles: the link `/roles?seat=<id>` (Roles.tsx reads it on arrival). Moved out
 * of Roles.tsx (19 Nov 2026) to keep that page under the file-length gate; it loads with an opened row.
 */
import { useEffect, useRef, useState } from "react";
import { Link2 } from "lucide-react";
import { useLingui } from "@lingui/react/macro";

/** The absolute link to one seat's card. */
function seatLink(id: string): string {
  const url = new URL("/roles", window.location.origin);
  url.searchParams.set("seat", id);
  return url.toString();
}

/**
 * "Copy link" under one seat's card. The clipboard write runs inside the
 * click, which is the user activation a browser asks for. Where the clipboard
 * refuses or is missing (an http origin has no `navigator.clipboard`), the
 * link appears in a read-only field, selected, for the reader to copy by
 * hand. The polite line below is in the row from the moment it opens, so what
 * lands in it is announced.
 *
 * Every name here carries the seat. The control sits outside the card's
 * `aria-labelledby`, and a screen reader listing the page's buttons hears
 * each one on its own, so a fixed "this seat" read the same under every row
 * and named none of them. The visible words stay "Copy link" and open the
 * accessible name, so a reader who says what they see still reaches it.
 */
export default function SeatLinkCopy({ seatId, seatName }: { seatId: string; seatName: string }) {
  const { t } = useLingui();
  const link = seatLink(seatId);
  const [said, setSaid] = useState<"" | "copied" | "refused">("");
  // A count so a second refusal selects the field again.
  const [refused, setRefused] = useState(0);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!refused) return;
    field.current?.focus();
    field.current?.select();
  }, [refused]);
  useEffect(() => {
    if (said !== "copied") return;
    const timer = window.setTimeout(() => setSaid(""), 4000);
    return () => window.clearTimeout(timer);
  }, [said]);
  const fallBack = () => {
    setRefused((n) => n + 1);
    setSaid("refused");
  };
  const copy = () => {
    setSaid("");
    const clip = typeof navigator === "undefined" ? undefined : navigator.clipboard;
    if (!clip?.writeText) return fallBack();
    clip.writeText(link).then(() => setSaid("copied"), fallBack);
  };
  const line =
    said === "copied"
      ? t({ message: `Link to ${seatName} copied.`, context: "roles page, role link" })
      : said === "refused"
        ? t`Copying did not work here. The link is selected in the field below.`
        : "";
  return (
    <div className="pt-4 border-t border-border space-y-2">
      <button
        type="button"
        onClick={copy}
        aria-label={t({ message: `Copy link to ${seatName}`, context: "roles page, role link" })}
        className="inline-flex items-center gap-2 min-h-[44px] text-sm font-medium text-foreground underline underline-offset-2"
      >
        <Link2 className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        {t({ message: `Copy link`, context: "roles page, role link" })}
      </button>
      {refused > 0 && (
        <input
          ref={field}
          type="text"
          readOnly
          value={link}
          aria-label={t({ message: `Link to ${seatName}`, context: "roles page, role link" })}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
        />
      )}
      <p role="status" className="text-xs text-muted-foreground">{line}</p>
    </div>
  );
}
