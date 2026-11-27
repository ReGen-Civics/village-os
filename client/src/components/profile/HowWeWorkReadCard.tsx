/**
 * WHAT YOU HAVE READ, on the member's own profile (the lead, 27 Nov 2026: ticking "I've read this" under How we
 * work together makes it "show up in their profile as read, with a link to open it again to read it again if they
 * need"). It sits after "Your contributions", in the sheet's record of what the member has done.
 *
 * Drawn only once there is a read to show: an empty record is left out (the profile's empty-state rule), and the
 * chapter itself carries the box. The read is the member's own (shared/howWeWorkRead.ts) and this asks for it with
 * their session; another member's profile never draws it.
 */
import { Link } from "wouter";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Trans, useLingui } from "@lingui/react/macro";
import { HOW_WE_WORK_HREF } from "@shared/howWeWorkRead";
import { readOnDay, useHowWeWorkRead } from "@/lib/howWeWorkRead";

export default function HowWeWorkReadCard() {
  const { i18n } = useLingui();
  const { readAt } = useHowWeWorkRead(true);
  if (!readAt) return null;
  return (
    <section aria-labelledby="sheet-read-h" data-sheet-section="read" className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <h2 id="sheet-read-h" className="mb-6 font-display text-2xl font-bold text-card-foreground">
        <Trans context="Profile, what you have read: h2">What you have read</Trans>
      </h2>
      <ul className="space-y-4">
        <li className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-muted p-4" data-testid="read-how-we-work">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-open" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold break-words text-foreground">
              <Trans context="Profile, what you have read">How we work together</Trans>
            </p>
            <p className="text-sm text-muted-foreground">
              <Trans context="Profile, what you have read">Read on {readOnDay(readAt, i18n.locale)}</Trans>
            </p>
          </div>
          <Link href={HOW_WE_WORK_HREF} className="inline-flex min-h-11 items-center gap-1 px-1 text-sm font-medium text-notice underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring">
            <Trans context="Profile, what you have read">Read it again</Trans>
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </li>
      </ul>
    </section>
  );
}
