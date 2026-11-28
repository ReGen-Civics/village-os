/**
 * WHERE A PAGE SITS IN THE MENU, in one line (wayfinding lane, round 1 of QA, 27 Nov 2026):
 * "In Village, and in Govern under This season". Used by the not-found page's suggestions and by Admin's How the menu
 * is used, so the two say it the same way.
 *
 * The places come in the menu's own order (lib/nearestPages.ts menuPages walks config/nav.ts), so a change to the
 * group order there (Join first, for one) is the order here with no second list to keep.
 */
import { useLingui } from "@lingui/react/macro";

export interface MenuPlace {
  /** The group's platform label, or null for the account menu. */
  group: string | null;
  folder: string | null;
}

/**
 * A function from places to the line. `name` turns a platform label (a group or a folder) into the reader's word,
 * the village's own name for it where it gave one.
 */
export function usePlaceLine(name: (platformLabel: string) => string): (places: readonly MenuPlace[]) => string {
  const { t } = useLingui();
  return (places) => {
    // One line per place, the same place once, in the order given.
    const wheres = Array.from(
      new Set(
        places.map((p) => {
          const group = p.group ? name(p.group) : t({ message: "Your account", context: "menu place: the account menu" });
          const folder = p.folder ? name(p.folder) : "";
          return folder ? t({ message: `${group} under ${folder}`, context: "menu place: a folder inside a group" }) : group;
        }),
      ),
    );
    if (!wheres.length) return "";
    const first = wheres[0];
    let line = t({ message: `In ${first}`, context: "menu place: where a page sits" });
    for (const where of wheres.slice(1)) line = t({ message: `${line}, and in ${where}`, context: "menu place: one more place the page sits" });
    return line;
  };
}
