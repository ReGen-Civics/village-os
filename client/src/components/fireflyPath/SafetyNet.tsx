/**
 * THE WAY OUT WHEN A SEND FAILS (apply safety net, 19 Nov 2026).
 *
 * Shown on Review & submit whenever a send fails for a reason the applicant
 * cannot fix in an answer (fireflyPath/applySendFailure.ts): a calm line, Try
 * again, "Download my application" (built on this device, fireflyPath/applyBackup.ts)
 * and, when the village has set a contact address, "Email it to us".
 *
 * The address is the brand's public contact address (`project.contactEmail`,
 * useVillageLinks). Unset, the sentence that names it and the email link are
 * not drawn: a wrong address would be worse than none.
 *
 * Lazy: the page loads this, and the file builder with it, only after a failure.
 */
import { useEffect, useRef } from "react";
import { useLingui } from "@lingui/react/macro";
import { Download, Mail, RotateCcw } from "lucide-react";
import { BTN_PRIMARY, BTN_SECONDARY, LINK } from "@/components/journey/look";
import { useVillageLinks } from "@/lib/gameApi";
import type { ApplyDraft } from "./applyDraft";
import { backupFileName, backupHtml, backupMailto, saveBackup, type BackupRole } from "./applyBackup";

export interface SafetyNetProps {
  village: string;
  roles: BackupRole[];
  goals: Array<{ id: string; text: string }>;
  /** The draft as this browser holds it, read at the moment of the download. */
  draft: () => ApplyDraft;
  onRetry: () => void;
  sending: boolean;
}

export default function SafetyNet({ village, roles, goals, draft, onRetry, sending }: SafetyNetProps) {
  const { t, i18n } = useLingui();
  const { contactEmail } = useVillageLinks();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.focus({ preventScroll: false });
  }, []);
  const roleNames = roles.map((r) => r.name);
  const mailto = backupMailto(contactEmail, roleNames, i18n);
  const download = () => {
    const now = new Date();
    saveBackup(backupHtml({ village, roles, draft: draft(), goals, now, pageUrl: window.location.href }, i18n), backupFileName(roleNames[0] ?? "", now));
  };
  return (
    <div ref={box} id="propose-safety-net" tabIndex={-1} role="status" aria-live="polite" className="mb-8 grid gap-4 rounded-lg border border-notice/60 bg-muted p-4 text-sm text-foreground outline-none" data-safety-net="">
      <p className="text-base leading-relaxed">
        {t({ message: "Something went wrong sending your application. Your answers are safe on this device.", context: "application safety net" })}{" "}
        {contactEmail
          ? t({ message: `Download them and email the file to ${contactEmail} so nothing is lost.`, context: "application safety net" })
          : t({ message: "Download them so nothing is lost.", context: "application safety net" })}{" "}
        {t({ message: "You can also try again.", context: "application safety net" })}
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={BTN_PRIMARY} onClick={download} data-safety-download="">
          <Download className="size-4" aria-hidden="true" />
          {t({ message: "Download my application", context: "application safety net" })}
        </button>
        <button type="button" className={BTN_SECONDARY} onClick={onRetry} disabled={sending} data-safety-retry="">
          <RotateCcw className="size-4" aria-hidden="true" />
          {t({ message: "Try again", context: "application safety net" })}
        </button>
      </div>
      {mailto && (
        <p className="grid gap-1" data-safety-mail="">
          <a href={mailto} className={`${LINK} inline-flex min-h-11 items-center gap-1.5 justify-self-start`}>
            <Mail className="size-4" aria-hidden="true" />
            {t({ message: "Email it to us", context: "application safety net" })}
          </a>
          <span className="text-muted-foreground">{t({ message: "Your email app opens with a message ready. Attach the file you downloaded, and any files you meant to upload, such as your CV.", context: "application safety net" })}</span>
        </p>
      )}
    </div>
  );
}
