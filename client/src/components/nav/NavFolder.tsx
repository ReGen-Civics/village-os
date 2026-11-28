/**
 * One folder row of the menu (config/navNest.ts): a button with the folder's name that opens to its links, in
 * place, under it. The same component in the desktop dropdowns, the drawer, the phone's More sheet and the account
 * menu (through MenuRows.tsx), so a folder opens the same way everywhere. Each surface keeps its own look for the
 * row and the links, passed in as class strings and a link renderer.
 *
 * MenuRows holds which folder is open, so only one is open at a time in a list (the menu's QA, 27 Nov 2026: Govern
 * with every folder open ran past a 900px screen).
 */
import { useId, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { NavLink } from "@/config/nav";

export default function NavFolder({
  label,
  links,
  holdsHere,
  open,
  onToggle,
  renderLink,
  rowClassName,
  listClassName,
  asListItem = false,
  gutter = null,
  badge = null,
}: {
  /** The folder's name, already in the reader's language. */
  label: string;
  links: readonly NavLink[];
  /** The page being read is one of these links. */
  holdsHere: boolean;
  open: boolean;
  onToggle: () => void;
  renderLink: (link: NavLink) => ReactNode;
  rowClassName: string;
  listClassName: string;
  /** Drawn inside a list (the More sheet's <ul>): the folder is an <li>, and its links a <ul> of <li>. */
  asListItem?: boolean;
  /** The empty icon slot the surface's links have, so the folder's name starts where theirs do (QA, 27 Nov 2026). */
  gutter?: ReactNode;
  /** Shown beside the name while the folder is shut: a count or a firefly for what is inside (MenuRows.tsx). */
  badge?: ReactNode;
}) {
  const listId = useId();
  const Root = asListItem ? "li" : "div";
  const row = (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      // Only while the list is drawn: a shut folder's list is not in the page, and aria-controls must name an element
      // that is (the menu's QA, round 2, 27 Nov 2026).
      aria-controls={open ? listId : undefined}
      aria-current={holdsHere ? "true" : undefined}
      className={`${rowClassName} ${holdsHere ? "font-semibold" : ""}`}
    >
      {gutter}
      <span className="min-w-0 flex-1 text-left">
        {label}
        {open ? null : badge}
      </span>
      <ChevronDown aria-hidden="true" className={`size-3.5 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
    </button>
  );
  return (
    <Root data-nav-folder={label}>
      {row}
      {open ? (
        asListItem ? (
          <ul id={listId} className={listClassName}>
            {links.map((l) => <li key={l.href}>{renderLink(l)}</li>)}
          </ul>
        ) : (
          <div id={listId} role="group" aria-label={label} className={listClassName}>
            {links.map((l) => <div key={l.href}>{renderLink(l)}</div>)}
          </div>
        )
      ) : null}
    </Root>
  );
}
