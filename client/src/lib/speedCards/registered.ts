/**
 * THE REGISTERED SPEED CARDS: cards that are not a menu row (registry.ts says why there are any).
 *
 * Each one says what it is, where it goes, and with `useShown` when this member sees it. A lane adding a card adds
 * ONE entry to `REGISTERED_CARDS` below and nothing else: the More sheet, the picker and the defaults pick it up.
 *
 *   Pay          the credits page, shown once credits are in use for this member (shared/payGate.ts). It stood
 *                second among the tiles before the cards could be chosen; it now fills the first open slot of a new
 *                member's six, after Pull a card.
 *   Pull a card  registered by the Pull a card lane (speed-cards-shared.md): `id: PULL_A_CARD_ID`,
 *                `defaultAfter: "/journal"`, and a `useShown` that answers whether Human Design or Gene Keys is on.
 */
import { useEffect, useState } from "react";
import { Coins } from "lucide-react";
import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import { useAuth } from "@/contexts/AuthContext";
import { gameFetch } from "@/lib/gameApi";
import { creditsInUse, type PayRead, type PayRecentRead } from "@shared/payGate";
import { PULL_A_CARD_ID, type SpeedCardDef } from "./registry";

/** A registered card's name is a message, translated where the sheet draws it. */
export type RegisteredCard = Omit<SpeedCardDef, "label"> & { label: MessageDescriptor };

/** Credits are in use for this member (shared/payGate.ts): read once per opening of the sheet. */
export function usePayShown(): boolean {
  const { user } = useAuth();
  const signedIn = !!user;
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    const read = (path: string) => gameFetch(path).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    Promise.all([read("/api/pay") as Promise<PayRead | null>, read("/api/pay/recent") as Promise<PayRecentRead | null>]).then(([pay, recent]) => {
      if (live) setShown(creditsInUse(pay, recent));
    });
    return () => {
      live = false;
    };
  }, [signedIn]);
  return shown;
}

export const PAY_CARD: RegisteredCard = {
  id: "/pay",
  href: "/pay",
  label: msg({ message: "Pay", context: "the phone's More sheet: tile, the credits page" }),
  icon: Coins,
  useShown: usePayShown,
  defaultAfter: PULL_A_CARD_ID,
};

/** Every registered card, in a fixed order (their `useShown` hooks are called in this order). */
export const REGISTERED_CARDS: readonly RegisteredCard[] = [PAY_CARD];
