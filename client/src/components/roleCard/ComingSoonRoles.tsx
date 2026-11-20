/**
 * "HEAR WHEN A ROLE OPENS" (the lead, Anchor session of 19 Nov 2026): the coming-soon roles, directly under the
 * open roles and above the roles held now. Each card says the role is not open yet and may change, and offers
 * "Notify me", which opens the waitlist form (loaded on open, WaitlistForm.tsx), then "Apply early" (the lead, 20 Nov 2026).
 *
 * Each card carries `id="role-<roleId>"`, and `/roles#waitlist-<roleId>` scrolls to it and opens its form, so
 * the apply flow's picker can send a person straight here (shared/roleWaitlist.ts).
 */
import { lazy, Suspense, useEffect, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { roleAnchor, waitlistHash } from "@shared/roleWaitlist";
import { BTN_SECONDARY, EYEBROW } from "@/components/journey/look";
import { ComingSoonNote } from "@/components/ComingSoon";
import { EarlyWords } from "@/components/fireflyPath/EarlyWords";

const WaitlistForm = lazy(() => import("./WaitlistForm"));

export interface SoonRole {
  id: string;
  name: string;
  aim?: string | null;
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
    <section aria-labelledby="coming-soon-heading" className="flex flex-col gap-3" data-coming-soon-roles={roles.length}>
      <p id="coming-soon-heading" className="mt-3 text-xs font-bold uppercase tracking-widest text-notice">
        {t({ message: "Hear when a role opens", context: "roles page: the coming-soon roles and their waitlist" })}
      </p>
      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {t({ message: "Leave your details and we will write when a role you like opens.", context: "roles page: the coming-soon roles and their waitlist" })}
      </p>
      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground" data-early-words="">
        <EarlyWords />
      </p>
      <ul className="grid gap-3">
        {roles.map((r) => (
          <li key={r.id} id={roleAnchor(r.id)} className="scroll-mt-24 rounded-2xl border border-border bg-card p-4" data-coming-soon-role={r.id}>
            {r.circleName && <p className={EYEBROW}>{r.circleName}</p>}
            <p className="font-display text-xl leading-snug text-card-foreground">{r.name}</p>
            {r.aim && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{r.aim}</p>}
            <ComingSoonNote className="mt-2" />
            {open === r.id ? (
              <div className="mt-3">
                <Suspense fallback={null}>
                  <WaitlistForm roles={list} chosen={r.id} />
                </Suspense>
              </div>
            ) : (
              <button type="button" className={`mt-3 ${BTN_SECONDARY}`} onClick={() => setOpen(r.id)} aria-expanded={false} data-waitlist-open={r.id}>
                {t({ message: "Notify me", context: "coming-soon waitlist: the button" })}
                <span className="sr-only">{`: ${r.name}`}</span>
              </button>
            )}
            {/* After the waitlist, the early way (the lead, 20 Nov 2026): the words once, above the list, and a link per role. */}
            <a href={`/propose-a-role?role=${encodeURIComponent(r.id)}&early=1`} className="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-notice underline underline-offset-2 hover:text-foreground" data-apply-early={r.id}>
              {t({ message: `Apply early for ${r.name}`, context: "founding application, add a coming-soon role as an early application" })}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
