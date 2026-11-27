/**
 * One folder row of the menu (config/navNest.ts): a button with the folder's name that opens to its links, in
 * place, under it. The same component in the desktop dropdowns, the drawer, the phone's More sheet and the account
 * menu (through MenuRows.tsx), so a folder opens the same way everywhere. Each surface keeps its own look for the
 * row and the links, passed in as class strings and a link renderer.
 *
 * It opens with the menu when the page being read is inside it (`holdsHere`), so the reader sees where they are.
 */
import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { NavLink } from "@/config/nav";

export default function NavFolder({
  label,
  links,
  holdsHere,
  renderLink,
  rowClassName,
  listClassName,
  asListItem = false,
}: {
  /** The folder's name, already in the reader's language. */
  label: string;
  links: readonly NavLink[];
  /** The page being read is one of these links. */
  holdsHere: boolean;
  renderLink: (link: NavLink) => ReactNode;
  rowClassName: string;
  listClassName: string;
  /** Drawn inside a list (the More sheet's <ul>): the folder is an <li>, and its links a <ul> of <li>. */
  asListItem?: boolean;
}) {
  const [open, setOpen] = useState(holdsHere);
  const listId = useId();
  const Root = asListItem ? "li" : "div";
  const row = (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-expanded={open}
      aria-controls={listId}
      aria-current={holdsHere ? "true" : undefined}
      className={`${rowClassName} ${holdsHere ? "font-semibold" : ""}`}
    >
      <span>{label}</span>
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
