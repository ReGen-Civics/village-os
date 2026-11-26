/**
 * SET UP YOUR AI GUIDE FIRST (Rye, 2026-11-09): "when the Anthropic API key
 * isn't set up, this should be a warning right at the very beginning of Make
 * this yours and on the first page of admin."
 *
 * Shown at the top of Admin Home while no AI can answer (Make This Yours asks
 * the same thing as its own step 1, and the key button opens that step):
 * no Anthropic key of the village's own and no working Sera connection. It
 * asks for the key first because the guide then helps with the rest of the
 * journey, and the helper turns on by itself the moment a key is saved (its
 * switch, `platform.admin_helper`, ships on).
 *
 * It reads the helper's own status (`GET /api/admin/helper`), so the banner and
 * the panel can never disagree about whether the guide is connected. A village
 * that switched the helper off on purpose (`off: "switch"`) is not nagged.
 */
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Trans, useLingui } from "@lingui/react/macro";
import { guideNameAtSentenceStart, UNNAMED_GUIDE } from "@shared/guideName";
import { guideLabelIn } from "@/lib/guideNameWords";
import type { HelperStatus } from "@shared/adminHelper";
import { fetchHelperStatus } from "./adminHelperApi";
import { openSetupStep } from "./setupLanding";

export default function AiSetupBanner({
  password,
  onOpenTab,
  onOpenHelper,
  initialStatus,
}: {
  password: string;
  onOpenTab: (key: string) => void;
  onOpenHelper: () => void;
  /** For tests: skip the fetch. */
  initialStatus?: HelperStatus;
}) {
  const { i18n } = useLingui();
  const [status, setStatus] = useState<HelperStatus | null>(initialStatus ?? null);

  useEffect(() => {
    if (initialStatus) return;
    const ctrl = new AbortController();
    fetchHelperStatus(password, ctrl.signal).then(setStatus).catch(() => { /* no banner rather than a wrong one */ });
    return () => ctrl.abort();
  }, [password, initialStatus]);

  if (!status || status.off !== "key") return null;
  // An unnamed guide in the reader's language; a village's own name exactly as typed.
  const guide = guideNameAtSentenceStart(guideLabelIn(status.guide || UNNAMED_GUIDE.own, i18n));

  return (
    <section
      data-testid="ai-setup-banner"
      aria-labelledby="ai-setup-banner-title"
      className="mb-6 rounded-xl border border-border bg-amber-light p-4 text-foreground"
    >
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-notice" aria-hidden="true" />
        <div className="min-w-0 space-y-2">
          <h2 id="ai-setup-banner-title" className="font-semibold">
            <Trans context="admin, AI setup banner">Set up your AI guide first</Trans>
          </h2>
          <GuideSteps guide={guide} />
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => openSetupStep(onOpenTab, "guide")}
              className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Trans context="admin, AI setup banner: opens Make this yours, step 1, to paste the key">Add your Anthropic key</Trans>
            </button>
            <button
              type="button"
              onClick={onOpenHelper}
              className="inline-flex min-h-11 items-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Trans context="admin, AI setup banner: opens the helper's setup steps">Show me how</Trans>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Short lines, never a paragraph (the lead, 26 Nov 2026). */
function GuideSteps({ guide }: { guide: string }) {
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      <li><Trans context="admin, AI setup banner, line">Connect an Anthropic key, or Sera if your village uses it for org memory.</Trans></li>
      <li><Trans context="admin, AI setup banner, line">{guide} then helps with the rest of setup: finding settings, explaining them, proposing changes for you to approve.</Trans></li>
      <li><Trans context="admin, AI setup banner, line">It turns on by itself once the key is saved.</Trans></li>
    </ul>
  );
}
