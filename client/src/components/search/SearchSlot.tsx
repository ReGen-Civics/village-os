/**
 * THE SEARCH LANE'S ONE MOUNT POINT (navigation lanes, 27 Nov 2026). Layout draws this twice: in the desktop header,
 * beside the language picker (`place="desktop"`), and in the phone's top bar, before Paths (`place="phone"`). It draws
 * nothing yet. The search lane (wt/find-anything) fills this file, so search reaches the header without Layout.tsx
 * changing again; anything heavy belongs in a lazy chunk behind it, since the shell loads on the first page.
 */
export type SearchPlace = "desktop" | "phone";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function SearchSlot(_props: { place: SearchPlace }) {
  return null;
}
