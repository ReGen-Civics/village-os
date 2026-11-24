/**
 * The journal's door on the member's own profile.
 *
 * The FAB and the account menu already reach /journal. The profile is where a
 * member goes to see their own place in the village, and the journal is the
 * most personal thing they keep here, so it has a card of its own: what it is,
 * one tap into today's page, the weekly pulse and feedback, when they last
 * wrote, and where an entry goes.
 *
 * WHERE AN ENTRY GOES is said in the same words the review step uses
 * (ReviewStep.tsx): shared with the village's organisational memory "when
 * that is connected", unless the member keeps it private. The transport is
 * not built yet, so the card never claims a send that has not happened.
 *
 * Renders nothing while the journal module is off for this viewer, and reads
 * only the member's own newest entry: one request, the same one History makes.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { NotebookPen } from "lucide-react";
import type { JournalEntry } from "@shared/journal";
import { useModuleOn } from "@/modules/ModuleProvider";
import { listEntries } from "@/lib/journalApi";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, HINT, dayLabel } from "./ui";
import { Trans } from "@lingui/react/macro";

export default function ProfileJournalCard() {
  const on = useModuleOn("journal");
  // undefined while reading, null when there is nothing yet or it could not be read.
  const [latest, setLatest] = useState<JournalEntry | null | undefined>(undefined);

  useEffect(() => {
    if (!on) return;
    let live = true;
    listEntries({ limit: 1 })
      .then((page) => live && setLatest(page[0] ?? null))
      .catch(() => live && setLatest(null));
    return () => {
      live = false;
    };
  }, [on]);

  if (!on) return null;

  return (
    <section id="journal" aria-labelledby="journal-card-h" className={CARD}>
      <h2 id="journal-card-h" className="flex items-center gap-2 font-display text-lg font-bold text-card-foreground">
        <Trans context="ProfileJournalCard, h2"><NotebookPen className="h-5 w-5 text-notice" aria-hidden="true" />
        Your journal
      </Trans></h2>
      <p className="mt-1 text-sm text-foreground">
        <Trans context="ProfileJournalCard, p">A morning and evening practice, a weekly pulse, a debrief after calls, and a guide that asks one question at a
        time. Talk or type.
      </Trans></p>
      <p className={`${HINT} mt-2`}>
        {latest === undefined
          ? "Reading your journal..."
          : latest
            ? `You last wrote on ${dayLabel(latest.writtenAt)}.`
            : "Nothing written yet. Your first page takes two minutes."}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/journal" className={BTN_PRIMARY}>
          <Trans context="ProfileJournalCard, Link">Write today
        </Trans></Link>
        <Link href="/journal#pulse" className={BTN_SECONDARY}>
          <Trans context="ProfileJournalCard, Link">Weekly pulse
        </Trans></Link>
        <Link href="/journal#feedback" className={BTN_SECONDARY}>
          <Trans context="ProfileJournalCard, Link">Feedback
        </Trans></Link>
      </div>
      <p className={`${HINT} mt-3`}>
        <Trans context="ProfileJournalCard, p">Inside the village your entries are yours alone. Unless you keep one private, it is shared with the village's
        organisational memory when that is connected, with member names replaced by code-names.
      </Trans></p>
    </section>
  );
}
