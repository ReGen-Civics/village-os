/**
 * A MEMBER'S SPEED CARDS, KEPT: on the server in their own prefs (GET and PUT /api/profile/speed-cards,
 * server/routes/profile.ts), so the cards follow them to every device, and in this browser for an instant first
 * paint. The local copy is keyed by the member's id, so a shared phone never shows one member another's cards, and
 * it only ever holds the signed-in member's own list.
 *
 * `slots` is null while the member has never chosen: the sheet draws the defaults. A save writes the local copy at
 * once and then the server; a refused save keeps the local copy and says so (`failed`), so the change is not lost
 * on this device and the sheet can tell the member it did not reach their other ones.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { gameFetch } from "@/lib/gameApi";
import { parseSpeedCardSlots, type SpeedCardSlots } from "@shared/speedCards";

const KEY = "village-speed-cards:";

function readLocal(who: string): SpeedCardSlots | null | undefined {
  try {
    const raw = window.localStorage.getItem(KEY + who);
    if (raw === null) return undefined;
    const parsed = parseSpeedCardSlots(JSON.parse(raw));
    return parsed.ok ? parsed.value : undefined;
  } catch {
    return undefined;
  }
}

function writeLocal(who: string, slots: SpeedCardSlots | null): void {
  try {
    window.localStorage.setItem(KEY + who, JSON.stringify(slots));
  } catch {
    /* blocked storage: the server copy still holds */
  }
}

export interface SpeedCardsState {
  /** The member's own list, or null for the defaults. */
  slots: SpeedCardSlots | null;
  /** Save a new list, or null to go back to the defaults. Resolves true once the server holds it. */
  save: (slots: SpeedCardSlots | null) => Promise<boolean>;
  /** The last save did not reach the server. */
  failed: boolean;
}

export function useSpeedCards(who: string | null): SpeedCardsState {
  const [slots, setSlots] = useState<SpeedCardSlots | null>(() => (who ? (readLocal(who) ?? null) : null));
  const [failed, setFailed] = useState(false);
  // A save made while the first read is in flight wins over that read's answer.
  const saved = useRef(false);

  useEffect(() => {
    if (!who) return;
    let live = true;
    saved.current = false;
    gameFetch("/api/profile/speed-cards")
      .then((r) => (r.ok ? (r.json() as Promise<{ slots?: unknown }>) : null))
      .then((body) => {
        if (!live || saved.current || !body) return;
        const parsed = parseSpeedCardSlots(body.slots ?? null);
        if (!parsed.ok) return;
        setSlots(parsed.value);
        writeLocal(who, parsed.value);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [who]);

  const save = useCallback(
    async (next: SpeedCardSlots | null) => {
      if (!who) return false;
      saved.current = true;
      setSlots(next);
      writeLocal(who, next);
      try {
        const r = await gameFetch("/api/profile/speed-cards", { method: "PUT", body: JSON.stringify({ slots: next }) });
        setFailed(!r.ok);
        return r.ok;
      } catch {
        setFailed(true);
        return false;
      }
    },
    [who],
  );

  return { slots, save, failed };
}
