/**
 * WHEN THE PORTAL ENTRANCE SHOWS (shared/entrance.ts holds the lists; pages/Entrance.tsx is the
 * screen; server/lib/entrance.ts is the gate that matters).
 *
 * In front of the router's pages: on a path behind the entrance, a visitor who is not signed in
 * and whose device has not entered meets the entrance instead of the page, and goes on to that
 * same page after it. A signed-in member never sees it. Every other path renders as it always did.
 *
 * This is the drawing of the gate, not the gate. The server refuses the page's reads to the same
 * visitor whatever this component decides, so a status that cannot be read falls through to the
 * page, which then meets the server's refusal.
 */
import { lazy, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { pageBehindEntrance, type EntranceStatus } from "@shared/entrance";

const Entrance = lazy(() => import("@/pages/Entrance"));

let statusRead: Promise<EntranceStatus | null> | null = null;

/** The entrance's status, asked once per page load. Entering reloads the page, which asks again. */
function readStatus(): Promise<EntranceStatus | null> {
  if (!statusRead) {
    statusRead = fetch("/api/entrance", { credentials: "same-origin" })
      .then((r) => (r.ok ? (r.json() as Promise<EntranceStatus>) : null))
      .catch(() => null);
  }
  return statusRead;
}

/** For tests: forget the status. */
export function forgetEntranceStatus(): void {
  statusRead = null;
}

export default function EntranceGate({ children, waiting }: { children: ReactNode; waiting: ReactNode }) {
  const [location] = useLocation();
  const auth = useOptionalAuth();
  const behind = pageBehindEntrance(location);
  const signedIn = !!auth?.user;
  const authLoading = !!auth?.loading;
  const ask = behind && !signedIn && !authLoading;
  const [status, setStatus] = useState<EntranceStatus | null | undefined>(undefined);

  useEffect(() => {
    if (!ask || status !== undefined) return;
    let live = true;
    void readStatus().then((s) => live && setStatus(s));
    return () => {
      live = false;
    };
  }, [ask, status]);

  if (!behind || signedIn) return <>{children}</>;
  if (authLoading || status === undefined) return <>{waiting}</>;
  if (!status || !status.required || status.entered) return <>{children}</>;
  const next = location + window.location.search + window.location.hash;
  return <Entrance next={next} siteKey={status.siteKey} />;
}
