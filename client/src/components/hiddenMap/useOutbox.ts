/**
 * The page's handle on the outbox: what this member has waiting, adding to it,
 * discarding from it, and sending it. Sends on load, when the phone comes back
 * online, and when the tab returns.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addPhotos, addVisit, createPin } from "@/lib/hiddenMapApi";
import { authToken } from "@/lib/gameApi";
import { indexedDbStore, memoryStore, outbox, type FlushResult, type OutboxItem } from "@/lib/hiddenMapOutbox";

export function useOutbox(owner: string | null, onSent: () => void) {
  const durable = useMemo(() => indexedDbStore(), []);
  const box = useMemo(() => outbox(durable ?? memoryStore()), [durable]);
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [sending, setSending] = useState(false);
  // Who is signed in now. A run in flight reads this before every request.
  const current = useRef(owner);
  current.current = owner;

  const refresh = useCallback(async () => {
    try {
      setItems(owner ? await box.pending(owner) : []);
    } catch {
      setItems([]);
    }
  }, [box, owner]);

  const flush = useCallback(async (): Promise<FlushResult | null> => {
    if (!owner) return null;
    setSending(true);
    try {
      // The owner's token, pinned for the whole run: no request in it ever carries another session's.
      const token = authToken();
      if (!token) return null;
      const r = await box.flush(
        owner,
        {
          createPin: (d) => createPin(d, token),
          addPhotos: (id, p) => addPhotos(id, p, token),
          addVisit: (id, v, p) => addVisit(id, v, p, token),
        },
        () => current.current === owner && authToken() === token,
      );
      if (r.sent > 0) onSent();
      return r;
    } catch {
      return null;
    } finally {
      setSending(false);
      await refresh();
    }
  }, [box, owner, onSent, refresh]);

  useEffect(() => {
    void refresh().then(() => flush());
    const back = () => void flush();
    const shown = () => document.visibilityState === "visible" && void flush();
    window.addEventListener("online", back);
    document.addEventListener("visibilitychange", shown);
    return () => {
      window.removeEventListener("online", back);
      document.removeEventListener("visibilitychange", shown);
    };
    // Run once per member; flush and refresh are stable for one owner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner]);

  const add = useCallback(async (item: OutboxItem) => {
    await box.add(item);
    await refresh();
  }, [box, refresh]);

  const discard = useCallback(async (clientId: string) => {
    if (!owner) return;
    await box.discard(owner, clientId);
    await refresh();
  }, [box, owner, refresh]);

  return { items, add, discard, flush, sending, durable: durable !== null };
}
