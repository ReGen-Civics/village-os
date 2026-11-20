/**
 * "COMING SOON" ON THE /roles INDEX (the lead, Anchor session of 19 Nov 2026; one card per role since 20 Nov 2026).
 * Each role is the index's own card (RoleIndexCard.tsx) with the waitlist's acts in place of Apply: "Notify me",
 * which opens the waitlist form inside that card (loaded on open, WaitlistForm.tsx), then "Apply early".
 *
 * Each card carries `id="role-<roleId>"`, and `/roles#waitlist-<roleId>` scrolls to it and opens its form, so
 * the apply flow's picker can send a person straight here (shared/roleWaitlist.ts).
 */
import { lazy, Suspense, useEffect, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { roleAnchor, waitlistHash } from "@shared/roleWaitlist";
import { BTN_SECONDARY, H2 } from "@/components/journey/look";
import { ComingSoonNote } from "@/components/ComingSoon";
import { EarlyWords } from "@/components/fireflyPath/EarlyWords";
import RoleIndexCard from "./RoleIndexCard";

const WaitlistForm = lazy(() => import("./WaitlistForm"));

export interface SoonRole {
  id: string;
  name: string;
  /** The `/api/org` row, which the card reads its tags and bar from. */
  seat: Record<string, any>;
  path: string;
  circleName?: string | null;
}

/** The role a `#waitlist-<id>` hash names, when it is one of these. */
function hashed(roles: SoonRole[]): string | null {
  if (typeof window === "undefined") return null;
  const h = decodeURIComponent(window.location.hash.replace(/^#/, ""));
  return roles.find((r) => h === waitlistHash(r.id))?.id ?? null;
}

export default function ComingSoonRoles({ roles }: { roles: SoonRole[] }) {
  const { t } = useLingui();
  const [open, setOpen] = useState<string | null>(() => hashed(roles));
  useEffect(() => {
    const follow = () => {
      const id = hashed(roles);
      if (!id) return;
      setOpen(id);
      requestAnimationFrame(() => document.getElementById(roleAnchor(id))?.scrollIntoView?.({ block: "start" }));
    };
    follow();
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
    // The list is the page's; a new list re-reads the hash once.
  }, [roles.map((r) => r.id).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  if (roles.length === 0) return null;
  const list = roles.map((r) => ({ id: r.id, name: r.name }));

  return (
    <section aria-labelledby="coming-soon-heading" className="scroll-mt-24" id="coming-soon" data-coming-soon-roles={roles.length}>
      <h2 id="coming-soon-heading" className={H2}>
        {t({ message: "Coming soon", context: "badge on a role whose interviews start after the lead hires" })} ({roles.length})
      </h2>
      {/* The approved notice, said once for every card under it, then the early way. */}
      <ComingSoonNote className="mt-1 max-w-2xl" />
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground" data-early-words="">
        <EarlyWords />
      </p>
      <ul className="mt-4 grid gap-4 md:grid-cols-2">
        {roles.map((r) => (
            <RoleIndexCard
              key={r.id}
              anchorId={roleAnchor(r.id)}
              seat={r.seat}
              path={r.path}
              circleName={r.circleName ?? null}
              kind="soon"
              acts={
                <>
                  {open !== r.id && (
                    <button type="button" className={BTN_SECONDARY} onClick={() => setOpen(r.id)} aria-expanded={false} data-waitlist-open={r.id}>
                      {t({ message: "Notify me", context: "coming-soon waitlist: the button" })}
                      <span className="sr-only">{`: ${r.name}`}</span>
                    </button>
                  )}
                  {/* After the waitlist, the early way (the lead, 20 Nov 2026): the words once, above the list, and a link per role. */}
                  <a href={`/propose-a-role?role=${encodeURIComponent(r.id)}&early=1`} className="inline-flex min-h-11 items-center text-sm font-medium text-notice underline underline-offset-2 hover:text-foreground" data-apply-early={r.id}>
                    {t({ message: `Apply early for ${r.name}`, context: "founding application, add a coming-soon role as an early application" })}
                  </a>
                  {open === r.id && (
                    <div className="basis-full">
                      <Suspense fallback={null}>
                        <WaitlistForm roles={list} chosen={r.id} />
                      </Suspense>
                    </div>
                  )}
                </>
              }
            />
        ))}
      </ul>
    </section>
  );
}
