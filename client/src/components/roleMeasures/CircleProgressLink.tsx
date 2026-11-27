/**
 * A circle's quiet door to how its roles are going (the lead, 27 Nov 2026: the measures moved to their own page,
 * /admin/role-progress, and each circle's page links there, filtered to that circle).
 *
 * Shown only to a reader who may open that circle's numbers: an administrator, or the circle's lead. The server
 * says which (`GET /api/role-measures/scope`, seat lookups only), read once per sign-in and shared by every circle
 * page; anybody else sees nothing, and a visitor asks nothing.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { authToken, gameFetch } from "@/lib/gameApi";
import { LINK } from "@/components/journey/look";

type Scope = { scope: "village" } | { scope: "circles"; circleIds: string[] } | { scope: "none" };

const reads = new Map<string, Promise<Scope>>();

/** What the server lets this sign-in open, read once per token. A refusal or a failure is "none". */
export function readScope(): Promise<Scope> {
  const key = authToken() ?? "";
  let p = reads.get(key);
  if (!p) {
    p = gameFetch("/api/role-measures/scope")
      .then(async (r) => (r.ok ? ((await r.json()) as Scope) : ({ scope: "none" } as Scope)))
      .catch(() => ({ scope: "none" }) as Scope);
    reads.set(key, p);
  }
  return p;
}

/** For tests: forget what was read. */
export function forgetScope(): void {
  reads.clear();
}

export const mayOpen = (s: Scope, circleId: string): boolean => s.scope === "village" || (s.scope === "circles" && s.circleIds.includes(circleId));

export default function CircleProgressLink({ circleId }: { circleId: string }) {
  const { t } = useLingui();
  const signedIn = !!useOptionalAuth()?.user;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!signedIn) return setOpen(false);
    let live = true;
    void readScope().then((s) => live && setOpen(mayOpen(s, circleId)));
    return () => {
      live = false;
    };
  }, [signedIn, circleId]);
  if (!open) return null;
  return (
    <p>
      <Link href={`/admin/role-progress?circle=${encodeURIComponent(circleId)}`} className={`${LINK} inline-flex min-h-11 items-center gap-1`} data-circle-progress-link="">
        {t({ message: "How this circle's roles are going", context: "circle page, door to the role progress page" })}
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </p>
  );
}
