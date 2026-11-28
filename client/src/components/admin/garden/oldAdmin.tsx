/**
 * A WAY TO THE OLD ADMIN DASHBOARD, AND BACK (the founder, 28 Nov 2026: "yes
 * new one live with the old as a 'return to old' button for now", and "Okay a
 * 'see the old admin dashboard' button").
 *
 * The garden is the admin a person meets first. `SeeOldAdmin` is the plain
 * control in the band that shows that person the old admin, and
 * `ReturnToGarden` is the way back, drawn on the old admin page.
 *
 * AN EXIT, NEVER A CHOICE BETWEEN TWO SIDES. So it is quieter than the band's
 * switches: words with an underline, a full finger tall, and never the filled
 * gold of a marked side.
 *
 * THEY HOLD NOTHING. Neither keeps state, and neither remembers anything: the
 * page that mounts the garden owns where a person's choice is kept. Each takes
 * what pressing it does and nothing else it does not need.
 *
 * ITS OWN COLOURS, FROM THE PAGE'S TOKENS. `ReturnToGarden` is drawn outside
 * the garden's night, on the old admin page, so neither button reads anything
 * of the garden's. The words and their underline are the page's own text
 * colour (`--foreground`, through `text-foreground`), on whatever the page
 * has drawn behind them, and the focus ring is the page's own (`--ring`,
 * through `jw-btn`). No fill, no edge. Inside the garden those same two
 * tokens are the garden's ink and its gold, so the one class string draws
 * right in both places.
 *
 * The words come in both forms, with the garden's other lines (./speaking.tsx),
 * so a person who asked for brief and quiet gets the short one. Outside a
 * <Garden> the old admin page names the person (`personKey`), as the guide's
 * dock does, so their setting is the one read.
 */
import { useGardenWords } from "./speaking";

/** The exit's look: the page's own ink, underlined, 44px tall. Semantic tokens only, so it draws on any page. */
export const GARDEN_EXIT = "jw-btn inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-medium text-foreground underline decoration-1 underline-offset-4 hover:decoration-2";

export interface SeeOldAdminProps {
  /** What pressing it does: the page shows this person the old admin, and keeps that choice wherever it keeps it. */
  onPress: () => void;
  className?: string;
}

/** The band's way to the old admin dashboard. Give it to the band as `exit`. */
export function SeeOldAdmin({ onPress, className = "" }: SeeOldAdminProps) {
  const words = useGardenWords();
  return (
    <button type="button" onClick={() => onPress()} className={`${GARDEN_EXIT} ${className}`.trim()}>
      {words.seeOldAdmin}
    </button>
  );
}

export interface ReturnToGardenProps {
  /** What pressing it does: the page brings this person back to the garden. */
  onPress: () => void;
  /** Outside a <Garden> (the old admin page): the same key the garden is given for this person, so their brief and quiet setting is the one read. */
  personKey?: string;
  className?: string;
}

/** The way back to the garden, for the old admin page. It needs no <Garden> above it. */
export function ReturnToGarden({ onPress, personKey, className = "" }: ReturnToGardenProps) {
  const words = useGardenWords({ personKey });
  return (
    <button type="button" onClick={() => onPress()} className={`${GARDEN_EXIT} ${className}`.trim()}>
      {words.returnToGarden}
    </button>
  );
}
