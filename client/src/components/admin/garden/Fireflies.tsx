/**
 * FIREFLIES AROUND THE ONE NEXT STEP, and nowhere else (docs/DESIGN_RULE.md).
 *
 * The garden draws no lights of its own. This is the nature kit's Fireflies
 * (components/journey/nature), which is the one firefly on the platform:
 * decoration only (aria-hidden), a still drawing under reduced motion, moved
 * by CSS alone, resting after twenty seconds without input, and it tells the
 * shell to still its own lights while it shows.
 *
 * What this adds is the garden's rule as a type: it wraps exactly ONE child,
 * the next act, and it has no form that fills a field with lights.
 */
import { Children, type ReactElement } from "react";
import KitFireflies from "@/components/journey/nature/Fireflies";
import "./garden.css";

export interface FirefliesProps {
  /** The one next act: a button, a link, or the row that holds it. */
  children: ReactElement;
  /** A full-width act, where the default is one that sits in a line. */
  block?: boolean;
  className?: string;
}

export default function Fireflies({ children, block = false, className }: FirefliesProps) {
  return (
    <KitFireflies block={block} className={className}>
      {Children.only(children)}
    </KitFireflies>
  );
}
