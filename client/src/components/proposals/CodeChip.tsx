/**
 * THE SHORT CODE ON A CARD (the lead, 20 Nov 2026: "on the corner of the card so I can actually follow suggestions").
 * Small mono text in the card's top corner; a tap copies it, so it can be pasted into a reply to an agent. A batch is
 * B-27 and a change in it B-27.2 (shared/proposedChanges.ts). The long ids stay the keys and are never shown here.
 */
import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { useLingui } from "@lingui/react/macro";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const box = document.createElement("textarea");
      box.value = text;
      box.setAttribute("readonly", "");
      box.style.position = "fixed";
      box.style.opacity = "0";
      document.body.appendChild(box);
      box.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(box);
      return ok;
    } catch {
      return false;
    }
  }
}

export default function CodeChip({ code, className = "" }: { code?: string | null; className?: string }) {
  const { t } = useLingui();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!code) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copyText(code)) {
          setCopied(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), 1600);
        }
      }}
      className={`inline-flex min-h-9 items-center gap-1 rounded-full border border-border bg-muted px-2.5 text-xs font-semibold tabular-nums tracking-wide text-card-foreground hover:border-notice focus-visible:outline focus-visible:outline-2 focus-visible:outline-notice ${className}`}
      aria-label={t({ message: `Copy code ${code}`, context: "proposed changes: a short code" })}
      title={t({ message: "Tap to copy", context: "proposed changes: a short code" })}
      data-testid="code-chip"
      data-code={code}
    >
      {copied ? <Check className="size-3.5" aria-hidden="true" /> : null}
      <span>{code}</span>
      <span className="sr-only" role="status">
        {copied ? t({ message: "Copied", context: "proposed changes: a short code" }) : ""}
      </span>
    </button>
  );
}
