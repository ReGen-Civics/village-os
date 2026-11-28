/**
 * THE GOVERNANCE PAGE'S VIEWS (Governance brief, section F): Now, Decisions, Your work, Treasury, How we work
 * together. Plain links, each its own address, so a view can be shared and the back button works. Your work is a
 * member's, and only offered signed in; the page itself says when somebody holds no work. Treasury holds the cash
 * budget (the lead, 27 Nov 2026) and is offered signed in too, because the budget read refuses anyone not admitted.
 *
 * The last view is "How we work together", the lead's name for the page, the same words the menu and the page title
 * use (it read "How we decide" until the game mechanics folded into it, 26 Nov 2026).
 */
import { useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Trans, useLingui } from "@lingui/react/macro";

export default function GovernanceTabs({ signedIn }: { signedIn: boolean }) {
  const [here] = useLocation();
  const { t } = useLingui();
  const navRef = useRef<HTMLElement | null>(null);
  /*
   * On a phone the strip is wider than the screen, and the last views sat past
   * its edge with the one you are on hidden. Bring the current view into the
   * strip, sideways only, so the page never moves under the reader.
   */
  useEffect(() => {
    const nav = navRef.current;
    const on = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !on || nav.scrollWidth <= nav.clientWidth) return;
    const a = on.getBoundingClientRect();
    const n = nav.getBoundingClientRect();
    if (a.right > n.right) nav.scrollLeft += a.right - n.right + 8;
    else if (a.left < n.left) nav.scrollLeft -= n.left - a.left + 8;
  }, [here]);
  const tab = (href: string, label: React.ReactNode) => {
    // A view's own pages keep its tab lit (a change request or a draft under Decisions); Now is /governance alone.
    const on = here === href || (href !== "/governance" && here.startsWith(`${href}/`));
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
    <nav ref={navRef} aria-label={t({ context: "governance: the views, read aloud", message: "Governance views" })} className="-mx-1 flex gap-1 overflow-x-auto border-b border-border pb-2">
      {tab("/governance", <Trans context="governance: a view">What's happening now</Trans>)}
      {tab("/governance/decisions", <Trans context="governance: a view">Decisions</Trans>)}
      {signedIn ? tab("/governance/work", <Trans context="governance: a view">Waiting on you</Trans>) : null}
      {signedIn ? tab("/governance/treasury", <Trans context="governance: a view">Treasury</Trans>) : null}
      {tab("/governance/how", <Trans context="governance: a view">How we work together</Trans>)}
    </nav>
  );
}
