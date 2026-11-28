/**
 * THE SEARCH LANE'S ONE MOUNT POINT (navigation lanes, 27 Nov 2026). Layout draws this twice: in the desktop header,
 * beside the language picker (`place="desktop"`), and in the phone's top bar, before Paths (`place="phone"`). It draws
 * nothing yet. The search lane (wt/find-anything) fills this file, so search reaches the header without Layout.tsx
 * changing again; anything heavy belongs in a lazy chunk behind it, since the shell loads on the first page.
 *
 * FILLED BY THE SEARCH LANE (#1879):
 *   desktop   the search's icon in the header;
 *   phone     the top bar holds nothing below md (768px), where an icon pushes Menu off a 320px screen and the More
 *             sheet carries the search instead; from md up (a tablet) it draws the icon;
 *   sheet     the search's full row, in the More sheet's sticky top bar (the nav lane mounts `place="sheet"` there),
 *             so it stays in reach however far the sheet scrolls.
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
