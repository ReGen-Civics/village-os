/**
 * The member's own "I've read this" under How we work together (shared/howWeWorkRead.ts), read and saved through
 * `GET`/`PUT /api/profile/how-we-work-read`. Used by /governance/how (the box and the fold) and by the profile (the
 * read, with the way back in). Both answer only to the signed-in member, so both carry the session.
 */
import { useCallback, useEffect, useState } from "react";
import { authToken } from "@/lib/gameApi";

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
}

/** `on` false (a visitor, a newcomer) asks nothing and answers undefined. */
export function useHowWeWorkRead(on: boolean): HowWeWorkRead {
  const [readAt, setReadAt] = useState<string | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

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
        if (live) setReadAt(d && typeof d.readAt === "string" ? d.readAt : null);
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
      setReadAt(typeof d.readAt === "string" ? d.readAt : null);
      return true;
    } catch {
      setFailed(true);
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  return { readAt, save, saving, failed };
}

/** "27 Nov 2026", in the reader's language. */
export function readOnDay(iso: string, locale?: string): string {
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}
