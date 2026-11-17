/**
 * THE STATE NOTE, LOADED ONLY WHEN A ROLE NEEDS IT. The application form
 * (/propose-a-role) is held to a first-view budget (scripts/route-first-view.json),
 * and most applicants apply for an Open role, which has no note. A coming-soon
 * role or a future venture fetches ./ComingSoon when its note is drawn.
 */
import { lazy, Suspense } from "react";

const StateNote = lazy(() => import("./ComingSoon").then((m) => ({ default: m.StateNote })));

export function LazyStateNote({ role, className = "" }: { role: { comingSoon?: boolean | null; futureVenture?: boolean | null } | null | undefined; className?: string }) {
  if (role?.comingSoon !== true && role?.futureVenture !== true) return null;
  return (
    <Suspense fallback={null}>
      <StateNote role={role} className={className} />
    </Suspense>
  );
}
