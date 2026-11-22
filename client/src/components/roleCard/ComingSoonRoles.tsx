/**
 * "HEAR WHEN A ROLE OPENS" (the lead, Anchor session of 19 Nov 2026): the coming-soon roles, directly under the
 * open roles and above the roles held now. Each card says the role is not open yet and may change, and offers
 * "Join the waitlist", which opens the waitlist form (loaded on open, WaitlistForm.tsx), then "Apply early" (the lead,
 * 20 Nov 2026). Since 21 Nov 2026 the group is the third on /roles, "Upcoming roles", below the open roles and the open
 * ventures, and each card is its own framed panel.
 *
 * Each card carries `id="role-<roleId>"`, and `/roles#waitlist-<roleId>` scrolls to it and opens its form, so
 * the apply flow's picker can send a person straight here (shared/roleWaitlist.ts).
 */
import { lazy, Suspense, useEffect, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { roleAnchor, waitlistHash } from "@shared/roleWaitlist";
import { BTN_NOTICE, BTN_SECONDARY, EYEBROW } from "@/components/journey/look";
import { ComingSoonNote } from "@/components/ComingSoon";
import { EarlyWords } from "@/components/fireflyPath/EarlyWords";
import { GROUP_H2 } from "./groupLook";
import { useRoleArt } from "@/lib/natureArt";

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

export default function ComingSoonRoles({ roles, className = "" }: { roles: SoonRole[]; className?: string }) {
  const { t } = useLingui();
  const [open, setOpen] = useState<string | null>(() => hashed(roles));
  const artFor = useRoleArt("sm");
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
    <section aria-labelledby="coming-soon-heading" id="coming-soon" className={`flex scroll-mt-24 flex-col gap-3 ${className}`} data-coming-soon-roles={roles.length}>
      <p className={EYEBROW}>{t({ message: "Coming soon", context: "badge on a role whose interviews start after the lead hires" })}</p>
      <h2 id="coming-soon-heading" className={GROUP_H2}>
        {t({ message: "Upcoming roles", context: "roles page, the roles opening after the lead hires" })} <span className="text-lg font-normal text-muted-foreground">({roles.length})</span>
      </h2>
      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {t({ message: "Leave your details and we will write when a role you like opens.", context: "roles page: the coming-soon roles and their waitlist" })}
      </p>
      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground" data-early-words="">
        <EarlyWords />
      </p>
      {/* One framed panel per role, with room between them, two to a row on a wide screen like the ventures, and the two in a
          row the same height with their buttons along the bottom (the lead, 21 Nov 2026). */}
      <ul className="mt-2 grid gap-5 lg:grid-cols-2" data-soon-grid="">
        {roles.map((r) => (
          <li key={r.id} id={roleAnchor(r.id)} className={`scroll-mt-24 overflow-hidden rounded-2xl border border-border bg-card shadow-sm ${open === r.id ? "lg:col-span-2" : ""}`} data-coming-soon-role={r.id}>
            {/* With the waitlist open the panel grows tall, and a full-height strip stretched the painting into a sliver
                (live QA, 21 Nov 2026). Open, the painting sits beside the name at its own 3:4 and the form takes the width. */}
            <div className={open === r.id ? "grid h-full" : "grid h-full grid-cols-[6rem_minmax(0,1fr)] sm:grid-cols-[9rem_minmax(0,1fr)]"}>
            {open !== r.id && (
              <div className="relative min-h-full border-r border-notice/30 bg-muted/40" aria-hidden="true">
                {artFor(r.id) && <img src={artFor(r.id) ?? undefined} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" data-role-art="" />}
              </div>
            )}
            <div className="flex min-w-0 flex-col p-4 sm:p-5">
            <div className="flex items-start gap-4">
            {open === r.id && artFor(r.id) && (
              <img src={artFor(r.id) ?? undefined} alt="" aria-hidden="true" decoding="async" className="aspect-[3/4] w-20 shrink-0 rounded-xl border border-notice/30 object-cover sm:w-28" data-role-art="" />
            )}
            <div className="min-w-0">
            {r.circleName && <p className={EYEBROW}>{r.circleName}</p>}
            <p className="font-display text-xl leading-snug text-card-foreground">{r.name}</p>
            {r.aim && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{r.aim}</p>}
            </div>
            </div>
            <ComingSoonNote className="mt-2" />
            {open === r.id && (
              <div className="mt-3">
                <Suspense fallback={null}>
                  <WaitlistForm roles={list} chosen={r.id} />
                </Suspense>
              </div>
            )}
            {/* The waitlist and the early way side by side, both buttons (the lead, 20 and 21 Nov 2026): the words once,
                above the list, and an Apply early button per role. */}
            <div className="mt-auto flex flex-wrap gap-2 pt-3">
              {open !== r.id && (
                <button type="button" className={BTN_SECONDARY} onClick={() => setOpen(r.id)} aria-expanded={false} data-waitlist-open={r.id}>
                  {t({ message: "Join the waitlist", context: "coming-soon waitlist: the button" })}
                  <span className="sr-only">{`: ${r.name}`}</span>
                </button>
              )}
              <a href={`/propose-a-role?role=${encodeURIComponent(r.id)}&early=1`} className={BTN_NOTICE} data-apply-early={r.id}>
                {t({ message: "Apply early", context: "coming-soon role card: the button, the role is named on the card" })}
                <span className="sr-only">{`: ${r.name}`}</span>
              </a>
            </div>
            </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
