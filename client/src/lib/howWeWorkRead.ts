/**
 * The member's own "I've read this" under How we work together (shared/howWeWorkRead.ts), read and saved through
 * `GET`/`PUT /api/profile/how-we-work-read`. Used by /governance/how (the box and the fold) and by the profile (the
 * read, with the way back in). Both answer only to the signed-in member, so both carry the session.
 */
import { useCallback, useEffect, useState } from "react";
import { authToken } from "@/lib/gameApi";
import { readStored, writeStored } from "@/lib/safeStorage";

/**
 * On this device only: whether the member had read it last time, "1" or "0", never when. It only picks the height
 * of the place the page holds while it asks the server, so a member who folded the chapter does not see a tall
 * empty space first. The server's answer is always the one drawn.
 */
const SEEN_KEY = "howWeWorkRead.seen";
const seenOnDevice = (): boolean => {
  const got = readStored("local", SEEN_KEY);
  return got.status === "value" && got.value === "1";
};
const noteOnDevice = (readAt: string | null) => {
  writeStored("local", SEEN_KEY, readAt ? "1" : "0");
};

const PATH = "/api/profile/how-we-work-read";

const auth = (): Record<string, string> => {
  const t = authToken();
  return t ? { Authorization: `Bearer ${t}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
};

export interface HowWeWorkRead {
  /** When they ticked it; null when they have not, or when the ask failed (the chapter then opens); undefined while asking. */
  readAt: string | null | undefined;
  /** Tick (true) or untick (false). Resolves to whether the server took it; the box follows the server's answer. */
  save: (read: boolean) => Promise<boolean>;
  saving: boolean;
  failed: boolean;
  /** This device's memory of whether it was read last time, for the held place's height only. */
  seenRead: boolean;
}

/** `on` false (a visitor, a newcomer) asks nothing and answers undefined. */
export function useHowWeWorkRead(on: boolean): HowWeWorkRead {
  const [readAt, setReadAt] = useState<string | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [seenRead] = useState(seenOnDevice);

  useEffect(() => {
    if (!on) {
      setReadAt(undefined);
      return;
    }
    if (!authToken()) {
      setReadAt(null);
      return;
    }
    let live = true;
    // A failed ask is an answer too: the read is treated as not there, so the page never waits on it.
    fetch(PATH, { headers: auth() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live) return;
        const at = d && typeof d.readAt === "string" ? d.readAt : null;
        setReadAt(at);
        if (d) noteOnDevice(at);
      })
      .catch(() => {
        if (live) setReadAt(null);
      });
    return () => {
      live = false;
    };
  }, [on]);

  const save = useCallback(async (read: boolean) => {
    setSaving(true);
    setFailed(false);
    try {
      const res = await fetch(PATH, { method: "PUT", headers: auth(), body: JSON.stringify({ read }) });
      const d = res.ok ? await res.json() : null;
      if (!d || !("readAt" in d)) {
        setFailed(true);
        return false;
      }
      const at = typeof d.readAt === "string" ? d.readAt : null;
      setReadAt(at);
      noteOnDevice(at);
      return true;
    } catch {
      setFailed(true);
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  return { readAt, save, saving, failed, seenRead };
}

/** "27 Nov 2026", in the reader's language. */
export function readOnDay(iso: string, locale?: string): string {
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}
