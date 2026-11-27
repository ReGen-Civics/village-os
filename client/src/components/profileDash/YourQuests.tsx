/**
 * YOUR QUESTS (the lead, 27 Nov 2026: "Yes any that are suited for that role
 * and any the profile is doing"). Two lists, each row the quest's own page:
 *
 *   doing       every quest in the member's hands or turned in, from the same
 *               `/api/game/me` claims the rest of the profile reads;
 *   suited      open quests suited to the roles they hold, from
 *               `/api/game/quests/suited`: a quest whose role gate they hold,
 *               or whose circle one of their seats sits in. Nothing else links
 *               a quest to a role, so a member whose roles no quest names sees
 *               that list left out, never a guess.
 *
 * The profile's short Quests card (GameDashboard) stays as it was; this is the
 * full list it points into.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { gameFetch, type QuestClaim } from "@/lib/gameApi";
import { useLingui } from "@lingui/react/macro";

interface SuitedQuest {
  id: string;
  title: string;
  circle: string | null;
  why: "role" | "circle";
}

const ROW = "flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-sm text-foreground no-underline hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function YourQuests({ claims }: { claims: readonly QuestClaim[] }) {
  const { t } = useLingui();
  const [suited, setSuited] = useState<SuitedQuest[] | null>(null);
  useEffect(() => {
    let live = true;
    gameFetch("/api/game/quests/suited")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live) setSuited(Array.isArray(d?.quests) ? d.quests : []); })
      .catch(() => { if (live) setSuited([]); });
    return () => { live = false; };
  }, []);

  const doing = claims.filter((c) => c.status === "claimed" || c.status === "submitted");
  if (doing.length === 0 && !suited?.length) return null;

  return (
    <section id="your-quests" className="mb-6 scroll-mt-28 rounded-2xl border border-border bg-card p-5 sm:p-6" aria-labelledby="your-quests-heading">
      <h2 id="your-quests-heading" className="m-0 font-display text-lg font-bold text-card-foreground">
        {t({ message: "Your quests", context: "profile: the full list of the member's quests" })}
      </h2>
      {doing.length > 0 && (
        <>
          <h3 className="mb-2 mt-4 text-sm font-semibold text-muted-foreground">
            {t({ message: "Doing now", context: "profile: quests the member holds or turned in" })}
          </h3>
          <ul className="m-0 list-none space-y-2 p-0">
            {doing.map((c) => (
              <li key={c.id}>
                <Link href={`/quests/${encodeURIComponent(c.questId)}`} className={ROW} data-your-quest={c.status}>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{c.questTitle}</span>
                    <span className="block text-xs text-muted-foreground">
                      {c.status === "claimed"
                        ? c.submittedAt
                          ? t({ message: "Taken back to change. Turn it in again when ready.", context: "profile: a quest taken back after turning it in" })
                          : t({ message: "In your hands. Turn it in when it is done.", context: "profile: a quest the member holds" })
                        : t({ message: "Turned in. Waiting on a steward.", context: "profile: a quest the member turned in" })}
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-notice" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      {suited && suited.length > 0 && (
        <>
          <h3 className="mb-2 mt-5 text-sm font-semibold text-muted-foreground">
            {t({ message: "Suited to your roles", context: "profile: open quests matched to the member's roles" })}
          </h3>
          <ul className="m-0 list-none space-y-2 p-0">
            {suited.map((q) => (
              <li key={q.id}>
                <Link href={`/quests/${encodeURIComponent(q.id)}`} className={ROW} data-suited-quest={q.why}>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{q.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {q.why === "role"
                        ? t({ message: "Held for a role you hold.", context: "profile: a suited quest, matched on its role gate" })
                        : q.circle
                          ? t({ message: `Work in ${q.circle}, a circle where you hold a role.`, context: "profile: a suited quest, matched on the circle of a role the member holds" })
                          : t({ message: "Work in a circle where you hold a role.", context: "profile: a suited quest, matched on a circle, no name" })}
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-notice" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
