/**
 * THE PORTAL ENTRANCE'S STATUS ON THIS DEVICE, asked once per page load and shared by everyone who needs it: the
 * gate that draws the portal (components/EntranceGate.tsx), the front door's "in use" reads
 * (lib/areasInUseReads.ts) and the guide's name (hooks/useGuideName.ts), which must not ask the server anything the
 * entrance would refuse. Entering reloads the
 * page, which asks again.
 */
import { useEffect, useState } from "react";
import { GATE_HINT_COOKIE, pageBehindEntrance, type EntranceStatus } from "@shared/entrance";

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

/**
 * Whether this device may ask past the portal: no entrance kept, or one it has entered. Unreadable: no. A signed-in
 * member is always past it; callers ask only for a visitor.
 */
export async function pastTheEntrance(): Promise<boolean> {
  if (!gateHinted()) return true;
  const status = await readEntranceStatus();
  return !!status && (!status.required || status.entered);
}

/**
 * Whether the portal entrance stands in front of this page for this visitor (or may, while its status is read), so
 * a piece of the shell that leads behind it can step aside: the entrance is the page then, and it carries its own
 * way in. False for a member, on a page in front of the entrance, and wherever the village keeps none.
 */
export function useEntranceStands(location: string, signedIn: boolean): boolean {
  const behind = !signedIn && pageBehindEntrance(location) && gateHinted();
  const [past, setPast] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    if (!behind) return;
    let live = true;
    void pastTheEntrance().then((p) => live && setPast(p));
    return () => {
      live = false;
    };
  }, [behind]);
  return behind && past !== true;
}

/** For tests: forget the status. */
export function forgetEntranceStatusRead(): void {
  statusRead = null;
}

/**
 * Whether this device is a visitor with a profile (a verified address at the entrance, shared/visitorProfile.ts),
 * for the header's "Your visit" link. Asks nothing while the village keeps no entrance, and nothing for a member.
 */
export function useVerifiedVisitor(signedIn: boolean): boolean {
  const [visitor, setVisitor] = useState(false);
  useEffect(() => {
    if (signedIn || !gateHinted()) return;
    let live = true;
    void readEntranceStatus().then((s) => live && setVisitor(!!s?.verifiedVisitor));
    return () => {
      live = false;
    };
  }, [signedIn]);
  return visitor && !signedIn;
}
