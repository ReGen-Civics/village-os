/**
 * "SAVE AND FINISH LATER" ON EVERY STEP (the lead, 24 Nov 2026; fireflyPath/applySaveLater.ts, shared/applicationDrafts.ts).
 *
 * One button under each step. A save keeps the whole application on the server with its files, and the panel
 * under the button says "Saved" with the time, shows the private resume link with a copy button, and says
 * whether the link went to the address the applicant typed. "Remember my answers on this device" stays as it was.
 */
import { useId, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { BTN_SECONDARY, FIELD, HINT, LABEL, TILE } from "@/components/journey/look";
import { DRAFT_KEEP_DAYS, type DraftSaved } from "@shared/applicationDrafts";
import type { SaveResult } from "./applySaveLater";

export interface SaveLaterState {
  saving: boolean;
  saved: DraftSaved | null;
  url: string | null;
  problem: SaveResult | null;
}

export default function SaveLater({ state, onSave, email }: { state: SaveLaterState; onSave: () => void; email: string }) {
  const { t, i18n } = useLingui();
  const linkId = `${useId().replace(/[^a-zA-Z0-9]/g, "")}-resume`;
  const [copied, setCopied] = useState(false);
  const { saving, saved, url, problem } = state;
  const days = DRAFT_KEEP_DAYS;
  const time = saved ? new Date(saved.savedAt).toLocaleTimeString(i18n.locale || "en", { hour: "numeric", minute: "2-digit" }) : "";

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // A browser that keeps the clipboard closed: the link is selected, ready to copy by hand.
      const box = document.getElementById(linkId) as HTMLInputElement | null;
      box?.select();
    }
  };

  const emailLine = (() => {
    if (!saved) return null;
    const to = saved.emailedTo ?? email.trim();
    switch (saved.emailed) {
      case "sent":
      case "already":
        return t({ message: `We emailed this link to ${to}.`, context: "founding application, save and finish later: the link was emailed" });
      case "limited":
        return t({ message: "We have emailed this link a few times today, so we did not send it again. Copy it to keep it.", context: "founding application, save and finish later: email limit" });
      case "failed":
        return t({ message: "We could not email the link just now. Copy it to keep it.", context: "founding application, save and finish later: email failed" });
      default:
        return t({ message: "Add your email on the About you step and save again, and we will email you the link too.", context: "founding application, save and finish later: no email yet" });
    }
  })();

  const problemLine = (() => {
    if (!problem || problem.ok) return null;
    switch (problem.error) {
      case "too_many_asks":
        return t({ message: "That is a lot of saves from here in a short while. Please wait a little and try again.", context: "founding application, save and finish later: rate limited" });
      case "gone":
        return t({ message: "This saved application is no longer kept. Save again to start a new link.", context: "founding application, save and finish later: draft gone" });
      case "too_big":
        return t({ message: "This application is too long to save. Shorten the longest answer and try again.", context: "founding application, save and finish later: too big" });
      case "files":
      case "upload_gone":
        return problem.message ?? t({ message: "A file did not save. Check it and try again.", context: "founding application, save and finish later: a file failed" });
      default:
        return t({ message: "That did not save. Please try again.", context: "founding application, save and finish later: failed" });
    }
  })();

  return (
    <div className="mt-2 grid gap-3 border-t border-border/60 pt-6" data-save-later="">
      <button type="button" className={`${BTN_SECONDARY} justify-self-start`} onClick={onSave} disabled={saving} data-save-later-button="">
        {saving ? t({ message: "Saving", context: "founding application, save and finish later: while saving" }) : t({ message: "Save and finish later", context: "founding application, save and finish later: the button" })}
      </button>
      {problemLine && (
        <p role="alert" className="text-sm text-destructive" data-save-later-problem="">
          {problemLine}
        </p>
      )}
      {saved && url && (
        <div className={`${TILE} grid gap-3`} data-save-later-saved="">
          <p role="status" className="font-semibold text-foreground" data-saved-at="">
            {t({ message: `Saved at ${time}`, context: "founding application, save and finish later: saved, with the time" })}
          </p>
          <label htmlFor={linkId} className={LABEL}>
            {t({ message: "Your private link to finish later", context: "founding application, save and finish later" })}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input id={linkId} readOnly value={url} onFocus={(e) => e.currentTarget.select()} className={`${FIELD} min-w-0 flex-1 px-3 py-2 text-sm`} data-resume-link="" />
            <button type="button" className={`${BTN_SECONDARY} shrink-0`} onClick={() => void copy()} data-copy-resume="">
              {copied ? t({ message: "Copied", context: "founding application, save and finish later: link copied" }) : t({ message: "Copy link", context: "founding application, save and finish later: copy the link" })}
            </button>
          </div>
          <p className={HINT}>{emailLine}</p>
          <p className={HINT}>{t({ message: `Keep it to yourself: anyone with the link can open your saved answers. We keep it for ${days} days after your last save, and nothing reaches the team until you send.`, context: "founding application, save and finish later" })}</p>
        </div>
      )}
    </div>
  );
}

/** The line over a resumed application. */
export function ResumedNote() {
  const { t } = useLingui();
  return (
    <p role="status" className={`mt-3 ${TILE} text-sm text-foreground`} data-draft-resumed="">
      {t({ message: "Your application is saved. Pick up where you left off.", context: "founding application, opened from a save and finish later link" })}
    </p>
  );
}
