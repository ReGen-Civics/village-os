/**
 * WHEN THE PORTAL ENTRANCE SHOWS (shared/entrance.ts holds the lists; pages/Entrance.tsx is the
 * screen; server/lib/entrance.ts is the gate that matters).
 *
 * In front of the router's pages: on a path behind the entrance, a visitor who is not signed in
 * and whose device has not entered meets the entrance instead of the page, and goes on to that
 * same page after it. A signed-in member never sees it. Every other path renders as it always did.
 *
 * A visitor who entered (and is not signed in) has each page they open noted, first-party, for
 * Admin, Portal visitors: the path without its query, posted once per page (`notePage`).
 *
 * This is the drawing of the gate, not the gate. The server refuses the page's reads to the same
 * visitor whatever this component decides, so a status that cannot be read falls through to the
 * page, which then meets the server's refusal.
 */
import { lazy, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { EVENT_PASS_PARAM, pageBehindEntrance, type EntranceStatus } from "@shared/entrance";

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

/**
 * An invited guest's link (`/events?pass=`, server/lib/comms/gatheringVars.ts): the pass is traded
 * for a cookie that opens that one gathering, and the page loads again without it in the address.
 * Answers true while that is under way.
 */
function takeEventPass(): boolean {
  const params = new URLSearchParams(window.location.search);
  const pass = params.get(EVENT_PASS_PARAM);
  if (!pass) return false;
  params.delete(EVENT_PASS_PARAM);
  const rest = params.toString();
  const clean = window.location.pathname + (rest ? `?${rest}` : "") + window.location.hash;
  // Whatever the answer, the page loads again: a pass that held opens the gathering, and one that
  // ran out leaves the guest at the entrance, where the status says so.
  void fetch("/api/entrance/event-pass", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pass }) })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => window.location.replace(clean));
  return true;
}

let lastNoted = "";

/** Note one page an entered visitor opened. Once per path in a row; a failure is let go. */
function notePage(path: string): void {
  if (path === lastNoted) return;
  lastNoted = path;
  void fetch("/api/entrance/view", { method: "POST", credentials: "same-origin", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path }) })
    .then((r) => r.ok)
    .catch(() => false);
}

/** For tests: forget the status. */
export function forgetEntranceStatus(): void {
  statusRead = null;
  lastNoted = "";
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
    if (location.startsWith("/events") && takeEventPass()) return;
    let live = true;
    void readStatus().then((s) => live && setStatus(s));
    return () => {
      live = false;
    };
  }, [ask, status, location]);

  const visitor = !signedIn && !authLoading && !!status?.visitor;
  useEffect(() => {
    if (visitor) notePage(location);
  }, [visitor, location]);

  if (!behind || signedIn) return <>{children}</>;
  if (authLoading || status === undefined) return <>{waiting}</>;
  if (!status || !status.required || status.entered) return <>{children}</>;
  // An invited guest: the calendar, which the server trims to their gathering.
  if (status.eventPass && (location === "/events" || location.startsWith("/events/"))) return <>{children}</>;
  const next = location + window.location.search + window.location.hash;
  return <Entrance next={next} siteKey={status.siteKey} />;
}
