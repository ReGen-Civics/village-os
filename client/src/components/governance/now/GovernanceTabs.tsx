/**
 * THE GOVERNANCE PAGE'S VIEWS (Governance brief, section F): Now, Decisions, Your work, Treasury, How we decide.
 * Plain links, each its own address, so a view can be shared and the back button works. Your work is a member's, and
 * only offered signed in; the page itself says when somebody holds no work. Treasury holds the cash budget (the lead,
 * 27 Nov 2026) and is offered signed in too, because the budget read refuses anyone not admitted.
 */
import { Link, useLocation } from "wouter";
import { Trans, useLingui } from "@lingui/react/macro";

export default function GovernanceTabs({ signedIn }: { signedIn: boolean }) {
  const [here] = useLocation();
  const { t } = useLingui();
  const tab = (href: string, label: React.ReactNode) => {
    const on = here === href;
    return (
      <Link
        href={href}
        aria-current={on ? "page" : undefined}
        className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-lg px-3 text-sm font-semibold ${on ? "border border-border bg-card text-foreground" : "text-muted-foreground hover:text-foreground"}`}
      >
        {label}
      </Link>
    );
  };
  return (
    <nav aria-label={t({ context: "governance: the views, read aloud", message: "Governance views" })} className="-mx-1 flex gap-1 overflow-x-auto border-b border-border pb-2">
      {tab("/governance", <Trans context="governance: a view">Now</Trans>)}
      {tab("/governance/decisions", <Trans context="governance: a view">Decisions</Trans>)}
      {signedIn ? tab("/governance/work", <Trans context="governance: a view">Your work</Trans>) : null}
      {signedIn ? tab("/governance/treasury", <Trans context="governance: a view">Treasury</Trans>) : null}
      {tab("/governance/how", <Trans context="governance: a view">How we decide</Trans>)}
    </nav>
  );
}
