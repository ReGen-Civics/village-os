/**
 * ONE LINE OF PRIVACY under a team section's heading (QA round 4: three to five lines under every heading buried the
 * hierarchy). The line says the one thing a reader needs; who reads it, and the rest, wait behind a disclosure.
 */
import { HINT } from "@/components/journey/look";

export default function PrivacyNote({ line, label, more }: { line: string; label: string; more: string }) {
  return (
    <div className="mt-1 min-w-0" data-privacy-note="">
      <p className={HINT}>{line}</p>
      <details className="min-w-0">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-foreground underline underline-offset-4">{label}</summary>
        <p className={`pb-2 ${HINT}`}>{more}</p>
      </details>
    </div>
  );
}
