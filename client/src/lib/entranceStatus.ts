/**
 * THE PORTAL ENTRANCE'S STATUS ON THIS DEVICE, asked once per page load and shared by everyone who needs it: the
 * gate that draws the portal (components/EntranceGate.tsx) and the front door's "in use" reads
 * (lib/areasInUseReads.ts), which must not ask the server anything the entrance would refuse. Entering reloads the
 * page, which asks again.
 */
import { GATE_HINT_COOKIE, type EntranceStatus } from "@shared/entrance";

let statusRead: Promise<EntranceStatus | null> | null = null;

/** The entrance's status, or null when it could not be read. */
export function readEntranceStatus(): Promise<EntranceStatus | null> {
  if (!statusRead) {
    statusRead = fetch("/api/entrance", { credentials: "same-origin" })
      .then((r) => (r.ok ? (r.json() as Promise<EntranceStatus>) : null))
      .catch(() => null);
  }
  return statusRead;
}

/** Whether the server said, on this page's own response, that the village keeps an entrance. */
export function gateHinted(): boolean {
  try {
    return document.cookie.split(";").some((c) => c.trim() === `${GATE_HINT_COOKIE}=1`);
  } catch {
    return true;
  }
}

/** For tests: forget the status. */
export function forgetEntranceStatusRead(): void {
  statusRead = null;
}
