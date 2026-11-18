/**
 * THE PRICE POPUP'S DIALOG PIECES, loaded when the popup opens (the moon word, 18 Nov 2026). PriceAsk sits on the first
 * view of /propose-a-role, which is at its budget; the Radix dialog it opens was about 10 KB of that view, spent before
 * anybody pressed "Adjust the price". PriceAsk keeps its state and its words, and draws them with these pieces.
 */
import type { ReactNode } from "react";
import * as parts from "@/components/ui/dialog";

export type DialogParts = typeof parts;

export default function PriceAskDialog({ render }: { render: (p: DialogParts) => ReactNode }) {
  return <>{render(parts)}</>;
}
