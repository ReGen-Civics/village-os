/**
 * COMING SOON (Rye, 16 Nov 2026: "list all the regenerative circle roles but
 * say they're 'coming soon'"). A role marked coming soon is shown wherever a
 * listed role is shown, with this badge, and its card's action is the disabled
 * button below where Apply would be. The server sends `comingSoon: true` only
 * on such a role, and refuses an application to it on both doors
 * (shared/roleListing.ts).
 */
import { Trans, useLingui } from "@lingui/react/macro";

export function ComingSoonChip({ role, className = "" }: { role: { comingSoon?: boolean | null } | null | undefined; className?: string }) {
  const { t } = useLingui();
  if (!role || role.comingSoon !== true) return null;
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium bg-secondary text-secondary-foreground border border-border ${className}`}
      title={t({ message: "This role is part of the village's plan. It does not take applications yet.", context: "coming soon badge, hint" })}
      data-testid="coming-soon-chip"
    >
      <Trans context="badge on a role that does not take applications yet">Coming soon</Trans>
    </span>
  );
}

/** Where Apply would be: a disabled "Coming soon", and the sentence that says why. */
export function ComingSoonAction() {
  return (
    <div className="space-y-1" data-coming-soon-action="">
      <button
        type="button"
        disabled
        aria-disabled="true"
        className="min-h-11 w-full rounded-xl border border-border bg-muted px-4 text-sm font-semibold text-muted-foreground cursor-not-allowed"
      >
        <Trans context="disabled button where Apply would be, on a role that opens later">Coming soon</Trans>
      </button>
      <p className="text-xs text-muted-foreground">
        <Trans context="under the disabled Coming soon button">This role opens later. Applications are not taken yet.</Trans>
      </p>
    </div>
  );
}
