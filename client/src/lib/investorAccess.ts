/**
 * The investor gate, client side (shared/investorInterest.ts is the contract, server/routes/investorAccess.ts the
 * server). A member is known by the token alone, so every investor read sends it; a visitor is known by the entrance
 * cookie, which goes with every same-origin request.
 */
import { useEffect, useState } from "react";
import { authToken } from "@/lib/gameApi";
import type { InvestorAccessState } from "@shared/investorInterest";

/** The reader's token, when they are signed in, with any other headers. */
export function investorHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = authToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

/** Where this reader stands at the investor gate: undefined while it is asked, null when it could not be read. */
export function useInvestorAccess(): { state: InvestorAccessState | null | undefined; reload: () => void } {
  const [state, setState] = useState<InvestorAccessState | null | undefined>(undefined);
  const [asked, setAsked] = useState(0);
  useEffect(() => {
    let live = true;
    fetch("/api/investor/access", { credentials: "same-origin", headers: investorHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (live) setState(j && typeof j.access === "boolean" ? (j as InvestorAccessState) : null); })
      .catch(() => { if (live) setState(null); });
    return () => { live = false; };
  }, [asked]);
  return { state, reload: () => setAsked((n) => n + 1) };
}
