/**
 * A circle's name wherever it is shown. The anchor circle carries an anchor
 * before its name. Whether a circle is the anchor comes from the village's
 * data (shared/circlePicker.ts), never from a name typed here.
 */
import { useLingui } from "@lingui/react/macro";
import { ANCHOR_MARK } from "@shared/circlePicker";
import { Taproot } from "@/components/sacred/living";

export default function CircleName({ name, anchor, className }: { name: string; anchor?: boolean | null; className?: string }) {
  const { t } = useLingui();
  if (!anchor) return <span className={className}>{name}</span>;
  return (
    <span className={className}>
      {/* The anchor circle's taproot (the lead, 24 Nov 2026). The plain-text label below keeps the character,
          because an option in a select cannot hold a drawing. */}
      <span role="img" aria-label={t({ message: "Anchor circle", context: "circle name" })} title={t({ message: "Anchor circle", context: "circle name" })} className="inline-flex align-[-0.15em]">
        <Taproot className="size-[1.1em]" aria-hidden="true" />
      </span>{" "}
      {name}
    </span>
  );
}

/** Plain text for an option or a label. */
export function circleLabel(c: { name: string; anchor?: boolean | null }): string {
  return c.anchor ? `${ANCHOR_MARK} ${c.name}` : c.name;
}
