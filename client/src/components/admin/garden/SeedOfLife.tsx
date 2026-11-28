/**
 * PROGRESS AS GROWTH, NEVER A BAR. The Seed of Life gains one circle per stone
 * walked, and past seven it keeps growing as the Flower of Life.
 *
 * This is the nature kit's own figure (components/journey/nature/SeedOfLife),
 * so the garden draws no second set of circles. It adds the garden's words:
 * a screen reader hears "3 of 14 stones walked", and a road longer than the
 * flower's nineteen circles shows that same sentence beside the figure, where
 * a longer road would otherwise have nothing left to grow.
 *
 * There is no percentage, no fill and no meter here, on purpose.
 */
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import KitSeedOfLife from "@/components/journey/nature/SeedOfLife";
import "./garden.css";

/** The Flower of Life the figure grows into holds this many circles. */
export const SEED_CIRCLES_MAX = 19;

export interface SeedOfLifeProps {
  /** How many stones are walked. */
  walked: number;
  /** How many stones the road has. */
  total: number;
  /** sm sits in a line of text, md in a panel, lg is an illustration. */
  size?: "sm" | "md" | "lg";
  /** Show the sentence beside the figure too. A road past nineteen stones always shows it. */
  words?: boolean;
  /** Open the petals once when every stone is walked. The caller claims the moment; left out, the whole seed is simply there. */
  bloom?: boolean;
  className?: string;
}

const whole = (n: number, floor: number) => (Number.isFinite(n) ? Math.max(floor, Math.floor(n)) : floor);

export default function SeedOfLife({ walked, total, size = "md", words = false, bloom = false, className = "" }: SeedOfLifeProps) {
  const { t } = useLingui();
  const stones = whole(total, 1);
  const done = Math.min(stones, whole(walked, 0));
  const sentence = t({ message: `${done} of ${plural(stones, { one: "# stone", other: "# stones" })} walked`, context: "garden seed of life, read aloud" });

  // One circle per stone, up to the flower's nineteen. Past that the figure only reads as whole when the road is.
  const circles = Math.min(stones, SEED_CIRCLES_MAX);
  const closed = done >= stones ? circles : Math.min(done, circles - 1);
  const spoken = words || stones > SEED_CIRCLES_MAX;

  return (
    <span className={`inline-flex flex-col items-center gap-2 ${className}`.trim()} data-walked={done} data-total={stones}>
      <KitSeedOfLife total={circles} walked={closed} label={spoken ? "" : sentence} size={size} bloom={bloom} />
      {spoken ? <span className="text-sm text-muted-foreground">{sentence}</span> : null}
    </span>
  );
}
