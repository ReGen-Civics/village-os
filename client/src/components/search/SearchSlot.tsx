/**
 * THE SEARCH LANE'S ONE MOUNT POINT (navigation lanes, 27 Nov 2026). Layout draws this twice: in the desktop header,
 * beside the language picker (`place="desktop"`), and in the phone's top bar, before Paths (`place="phone"`). It draws
 * nothing yet. The search lane (wt/find-anything) fills this file, so search reaches the header without Layout.tsx
 * changing again; anything heavy belongs in a lazy chunk behind it, since the shell loads on the first page.
 *
 * FILLED BY THE SEARCH LANE (#1879, QA round 3):
 *   desktop   the search's icon in the header;
 *   phone     the icon from 768px (a tablet, where the bar has room and the More sheet is not the menu), nothing on
 *             a phone, where an icon in the bar pushes Menu off a 320px screen;
 *   sheet     the search's full row, for the first row of the phone's More sheet (the nav lane mounts it there).
 * The dialog is lazy behind every door, and the root mount (FindAnythingRoot, App.tsx) owns it.
 */
import { FindAnything } from "./FindAnything";

export type SearchPlace = "desktop" | "phone" | "sheet";

export default function SearchSlot({ place }: { place: SearchPlace }) {
  if (place === "sheet") return <FindAnything variant="row" />;
  if (place === "phone") {
    return (
      <span className="hidden md:contents">
        <FindAnything />
      </span>
    );
  }
  return <FindAnything />;
}
