/**
 * THE NOW VIEW'S ONE READ (Governance brief, step 3): `GET /api/governance/now`, the member's own allowlisted projection
 * (shared/governanceNow.ts). Data only: the views in this folder draw it, so a later visual layer can restyle them
 * without touching what is read or who may read it (the coordinator, 26 Nov 2026).
 */
import { useCallback, useEffect, useState } from "react";
import { authToken } from "@/lib/gameApi";
import type { NowAnswer } from "@shared/governanceNow";

export type NowLoad = { phase: "loading" } | { phase: "signedOut" } | { phase: "notMember" } | { phase: "failed" } | { phase: "ready"; answer: NowAnswer };

/** Whether an answer has the shape the views draw. A body of any other shape is a failed read, never an empty one. */
export function isNowAnswer(b: unknown): b is NowAnswer {
  const a = b as NowAnswer | null;
  return !!a && Array.isArray(a.waiting) && Array.isArray(a.closingSoon) && Array.isArray(a.yours) && Array.isArray(a.reads) && !!a.voice && Array.isArray(a.voice.rights);
}

export function useGovernanceNow() {
  const [load, setLoad] = useState<NowLoad>({ phase: "loading" });
  const read = useCallback(async () => {
    const token = authToken();
    // Signed out, the route would answer 401: say so without the round trip.
    if (!token) return setLoad({ phase: "signedOut" });
    setLoad({ phase: "loading" });
    try {
      const r = await fetch("/api/governance/now", { headers: { Authorization: `Bearer ${token}` } });
      if (r.status === 401) return setLoad({ phase: "signedOut" });
      if (r.status === 403) return setLoad({ phase: "notMember" });
      const body: unknown = r.ok ? await r.json() : null;
      setLoad(isNowAnswer(body) ? { phase: "ready", answer: body } : { phase: "failed" });
    } catch {
      setLoad({ phase: "failed" });
    }
  }, []);
  useEffect(() => {
    void read();
  }, [read]);
  return { load, read };
}
