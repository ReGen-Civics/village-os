/**
 * The shell's doors to the menu's small joys (nav/menuJoys.tsx, a lazy chunk): each loads it only when there is
 * something to draw, so the first page carries a few lines here and none of the joys themselves.
 */
import { Suspense, lazy, useContext } from "react";
import { MenuFirefly } from "@/components/nav/menuFolders";

const MenuJoy = lazy(() => import("@/components/nav/menuJoys"));

/** The village's season, a small ring before a menu eyebrow. `hang`: it sits in the gutter before the words. */
export function SeasonMark({ hang = true }: { hang?: boolean }) {
  return (
    <Suspense fallback={null}>
      <MenuJoy kind="season" hang={hang} />
    </Suspense>
  );
}

/** A firefly beside an entry's words when this entry is the new one; otherwise nothing, and nothing loads. */
export function Firefly({ href }: { href: string }) {
  const pick = useContext(MenuFirefly);
  if (pick !== href) return null;
  return (
    <Suspense fallback={null}>
      <MenuJoy kind="firefly" />
    </Suspense>
  );
}

/** Layout's half: chooses the firefly once everything the menu depends on has loaded. */
export function FireflyPicker({ hrefs, here, onPick }: { hrefs: readonly string[]; here: string; onPick: (href: string | null) => void }) {
  return (
    <Suspense fallback={null}>
      <MenuJoy kind="pick" hrefs={hrefs} here={here} onPick={onPick} />
    </Suspense>
  );
}
