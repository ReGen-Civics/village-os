/**
 * A menu list drawn as rows (config/navNest.ts): each link as itself, and each folder as one row that opens to its
 * links (NavFolder.tsx). Every menu surface draws its list through this, so the folders are the same in the desktop
 * dropdowns, the drawer, the account menu and the phone's More sheet. The surface keeps its own look: it renders
 * each link, and passes the folder row's classes and the empty icon slot its links have.
 *
 * ONE FOLDER OPEN AT A TIME (the menu's QA, 27 Nov 2026). The folder holding the page being read opens with the
 * menu; otherwise the folder the group names for a newcomer does (`opens`, config/nav.ts: Join's "Choose your path").
 * Opening another closes it.
 */
import { Fragment, useState, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import type { NavLink } from "@/config/nav";
import { useContext } from "react";
import { MenuFirefly, MenuWaitingFor, folderWord, useFolderNames } from "@/components/nav/menuFolders";
import AccountCount from "@/components/nav/AccountCount";
import { Firefly } from "@/components/nav/joyDoors";
import { folderHolds, navRows } from "@/config/navNest";
import NavFolder from "@/components/nav/NavFolder";

export default function MenuRows({
  links,
  here,
  renderLink,
  rowClassName,
  listClassName,
  asListItems = false,
  gutter = null,
  opens = null,
}: {
  links: readonly NavLink[];
  /** The href of the page being read (Lit.href), so the folder holding it opens with the menu. */
  here?: string | null;
  renderLink: (link: NavLink) => ReactNode;
  rowClassName: string;
  listClassName: string;
  /** The surface is a <ul>: every row is an <li>. */
  asListItems?: boolean;
  /** The empty icon slot the surface's links draw, given to each folder row so siblings start at one edge. */
  gutter?: ReactNode;
  /** A folder (by its platform name) that is open when nothing else is: Join's paths, for a newcomer. */
  opens?: string | null;
}) {
  const { i18n } = useLingui();
  // The village's own folder names, where it gave one (Admin, Menu); else the platform's word.
  const folders = useFolderNames();
  // A shut folder says what is inside it: the waiting count, and the firefly (the menu's QA, round 2).
  const waitingFor = useContext(MenuWaitingFor);
  const pick = useContext(MenuFirefly);
  const rows = navRows(links);
  const [open, setOpen] = useState<string | null>(() => {
    const holding = rows.find((r) => folderHolds(r, here));
    if (holding?.kind === "folder") return holding.label;
    return rows.some((r) => r.kind === "folder" && r.label === opens) ? opens : null;
  });
  return (
    <>
      {rows.map((row) =>
        row.kind === "link" ? (
          asListItems ? <li key={row.link.href}>{renderLink(row.link)}</li> : <Fragment key={row.link.href}>{renderLink(row.link)}</Fragment>
        ) : (
          <NavFolder
            key={row.label}
            label={folderWord(row.label, folders, i18n)}
            badge={
              <>
                {waitingFor && row.links.some((l) => l.count === "waiting") ? <AccountCount count="waiting" who={waitingFor} named /> : null}
                {pick && row.links.some((l) => l.href === pick) ? <Firefly href={pick} /> : null}
              </>
            }
            links={row.links}
            holdsHere={folderHolds(row, here)}
            open={open === row.label}
            onToggle={() => setOpen(open === row.label ? null : row.label)}
            renderLink={renderLink}
            rowClassName={rowClassName}
            listClassName={listClassName}
            asListItem={asListItems}
            gutter={gutter}
          />
        ),
      )}
    </>
  );
}
