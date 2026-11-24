/**
 * "What is this?" for the open admin tab.
 *
 * The words come from one file. The button is a real control, at least 44px,
 * and the answer stays on the page.
 */
import { useState } from "react";
import { whatIsThis } from "./adminWords";
import { replayTour } from "./AdminFeel";
import { Trans } from "@lingui/react/macro";

export default function AdminHelp({ tab }: { tab: string }) {
  const [open, setOpen] = useState(false);
  const words = whatIsThis(tab);
  return (
    <section className="mb-4">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-[44px] items-center rounded-lg border border-border bg-card px-3 text-sm font-medium text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Trans context="AdminHelp, button">What is this?
      </Trans></button>
      <button type="button" onClick={replayTour} className="ml-2 inline-flex min-h-[44px] items-center rounded-lg px-3 text-sm text-card-foreground underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Trans context="AdminHelp, button">Show the tour</Trans></button>
      {open && (
        <div className="mt-2 rounded-xl border border-border bg-card p-4 text-card-foreground" role="region" aria-label={`What is this? ${words.name}`}>
          <p className="text-sm font-medium">{words.name}</p>
          <p className="mt-1 text-base">{words.help}</p>
        </div>
      )}
    </section>
  );
}
