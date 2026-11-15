/**
 * The Trail (R47), now THE ROOT STRIP: the one next step, under the header on
 * every page (the Root, game feel wave 2, 11 Nov 2026).
 *
 * This file is the shell's half and stays tiny on purpose. The app shell loads
 * on the first page, and the strip draws with the nature kit and reads the
 * path conductor, neither of which belongs there. So this decides only WHERE
 * the strip is quiet and loads the strip itself (components/path/RootLine.tsx)
 * as its own lazy chunk.
 *
 * QUIET WHERE IT WOULD REPEAT ITSELF OR INTRUDE. It stays away from the
 * profile, which draws the same step as a full card, from the whole-path page,
 * from the doors (sign in, join, set a password), from the team's own rooms,
 * and from the page the step points at: a step that goes nowhere is noise.
 *
 * A visitor sees it too: their step is the front door.
 *
 * ITS SPACE IS HELD FROM THE FIRST PAINT (page speed pass, 14 Nov 2026). The
 * strip arrived after the page had drawn and pushed everything under it down
 * by its height, the last of the landing page's layout shifts. So wherever it
 * is going to show, a plain band of the strip's own height stands in for it
 * while its chunk and the reader's path load (RootStripSlot), and the strip
 * takes its place without moving anything.
 */
import { Suspense, lazy } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";

const RootLine = lazy(() => import("./path/RootLine"));

// The steward and resident pages draw their own journey in the founding register, so a second path strip would show the journey twice (QA2-03).
const QUIET_EXACT = new Set(["/profile", "/path", "/login", "/register", "/forgot-password", "/set-password", "/verify-email", "/steward", "/resident"]);
// The founding-team application draws its own "Step N of 6" and keeps the founding register: the game's strip never blends into it (Phase A brief).
const QUIET_PREFIX = ["/admin", "/project-history", "/journey-to-launch", "/claim", "/application-status", "/sessions/", "/propose-a-role"];

export function isQuietPath(path: string, stepHref?: string | null): boolean {
  const bare = path.split(/[?#]/)[0] || "/";
  if (QUIET_EXACT.has(bare)) return true;
  if (QUIET_PREFIX.some((p) => bare === p || bare.startsWith(p.endsWith("/") ? p : `${p}/`))) return true;
  if (stepHref && stepHref.split(/[?#]/)[0] === bare) return true;
  return false;
}

/**
 * Where a visitor's one step points (shared/yourPath.ts, the visitor's path:
 * read a few roles slowly). The strip is quiet on that page, so no space is
 * held there for a visitor. NextStepTrail.test.tsx holds this equal to the
 * conductor's own answer, which this file cannot import: the conductor belongs
 * to the lazy chunk.
 */
export const VISITOR_STEP_HREF = "/roles";

/**
 * Whether to hold the strip's space before it can say whether it shows. A
 * member's step can point anywhere, so a member's strip can still fold away on
 * the one page their step points at; that is the only case left.
 */
export function holdsStripSpace(path: string, signedIn: boolean): boolean {
  if (isQuietPath(path)) return false;
  return signedIn || !isQuietPath(path, VISITOR_STEP_HREF);
}

/** The strip's height at rest: one line on a phone and a tablet, the step and its detail line from lg up (RootStrip). */
export function RootStripSlot() {
  return (
    <div aria-hidden="true" className="sheet-night" data-root-slot="">
      <div className="h-[76px] border-b border-border bg-card lg:h-[93px]" />
    </div>
  );
}

export default function NextStepTrail() {
  const [location] = useLocation();
  const { token } = useAuth() as { token?: string | null };
  const slot = holdsStripSpace(location, !!token) ? <RootStripSlot /> : null;
  return (
    <Suspense fallback={slot}>
      <RootLine quiet={isQuietPath} pending={slot} />
    </Suspense>
  );
}
