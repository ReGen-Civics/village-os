/**
 * BREADCRUMBS (the lead's team call, 26 Nov 2026: "if I'm two levels down from join ... maybe I can click and just go
 * right back ... but also see where I'm at"). A quiet trail at the top left of a page that sits BELOW its menu
 * entry: the group, the entry, and the page's own name when it gives one (crumbLeaf.tsx). Read from the same place
 * as the lit menu (config/navBearings.ts), so the words are the menu's own: the village's renames, in the reader's
 * language. A page that IS a menu entry draws none, so the top-level pages stay as they were.
 *
 * The group is a link only where it has a page of its own (NavGroup.href); otherwise it is plain words.
 */
import { Link } from "wouter";
import { useLingui } from "@lingui/react/macro";

/**
 * 44px on a touch screen (DESIGN_RULE.md, rule 8), the line's own height with a mouse. The trail sits on the root
 * ground above the page's own world, so its links take the root's link colour, the one a page's back link wears there:
 * `text-notice` there is the amber ink, which measured 3.81:1 on the Sea chart's ground.
 */
const CRUMB_LINK = "inline-flex min-h-6 items-center rounded-lg text-teal-deep underline underline-offset-4 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11";

export interface Trail {
  group: string | null;
  groupHref?: string;
  item: { href: string; label: string };
  leaf: string | null;
}

function Sep() {
  return <span aria-hidden="true" className="text-muted-foreground">/</span>;
}

export default function Breadcrumbs({ group, groupHref, item, leaf }: Trail) {
  const { t } = useLingui();
  return (
    <nav aria-label={t({ message: "Breadcrumb", context: "the trail at the top of a page: where it sits in the menu, read aloud" })} className="container pt-4" data-breadcrumbs="">
      <ol className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        {group ? (
          <li className="inline-flex items-center gap-2">
            {groupHref ? <Link href={groupHref} className={CRUMB_LINK}>{group}</Link> : <span>{group}</span>}
            <Sep />
          </li>
        ) : null}
        <li className="inline-flex items-center gap-2">
          <Link href={item.href} className={CRUMB_LINK}>{item.label}</Link>
          {leaf ? <Sep /> : null}
        </li>
        {leaf ? (
          <li className="min-w-0">
            <span aria-current="page" className="block max-w-[14rem] truncate font-semibold text-foreground sm:max-w-md">{leaf}</span>
          </li>
        ) : null}
      </ol>
    </nav>
  );
}
