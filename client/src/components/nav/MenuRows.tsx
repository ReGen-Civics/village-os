/**
 * A menu list drawn as rows (config/navNest.ts): each link as itself, and each folder as one row that opens to its
 * links (NavFolder.tsx). Every menu surface draws its list through this, so the folders are the same in the desktop
 * dropdowns, the drawer, the account menu and the phone's More sheet. The surface keeps its own look: it renders
 * each link, and passes the folder row's classes.
 */
import { Fragment, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { navWord, type NavLink } from "@/config/nav";
import { folderHolds, navRows } from "@/config/navNest";
import NavFolder from "@/components/nav/NavFolder";

export default function MenuRows({
  links,
  here,
  renderLink,
  rowClassName,
  listClassName,
  asListItems = false,
}: {
  links: readonly NavLink[];
  /** The href of the page being read (Lit.href), so the folder holding it opens with the menu. */
  here?: string | null;
  renderLink: (link: NavLink) => ReactNode;
  rowClassName: string;
  listClassName: string;
  /** The surface is a <ul>: every row is an <li>. */
  asListItems?: boolean;
}) {
  const { i18n } = useLingui();
  return (
    <>
      {navRows(links).map((row) =>
        row.kind === "link" ? (
          asListItems ? <li key={row.link.href}>{renderLink(row.link)}</li> : <Fragment key={row.link.href}>{renderLink(row.link)}</Fragment>
        ) : (
          <NavFolder
            key={row.label}
            label={navWord(row.label, i18n)}
            links={row.links}
            holdsHere={folderHolds(row, here)}
            renderLink={renderLink}
            rowClassName={rowClassName}
            listClassName={listClassName}
            asListItem={asListItems}
          />
        ),
      )}
    </>
  );
}
