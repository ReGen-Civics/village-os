/**
 * "ROLES THIS STEWARD WILL BUILD" (Rye, 16 Nov 2026; "steward" by the Operations Steward's naming ruling): under a lead's card, the
 * coming-soon roles of the circles that lead leads (`rolesLeadWillBuild`,
 * shared/roleListing.ts). Professional register, as the lead card is. Each row
 * opens that role's own card on the page, where it can be applied for now.
 */
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { useLingui } from "@lingui/react/macro";
import { ComingSoonChip, ComingSoonNote, HeldByAgentLine } from "@/components/ComingSoon";
import { BTN_SECONDARY } from "@/components/journey/look";
import { rolesLeadWillBuild } from "@shared/roleListing";
import { applyHrefForRole } from "./FullRoleCard";

export interface BuiltRole {
  id: string;
  name: string;
  aim: string | null;
  /** Someone holds it: shown as Held, with no name, and with no Apply unless it is still recruiting. */
  held?: boolean;
  /** Held and still recruiting (the lead, 17 Nov 2026): stays Held, says more players are welcome, keeps its Apply. */
  recruiting?: boolean;
  /** Held by an agent alone: said so, never by name. */
  heldByAgent?: boolean;
}

/**
 * What one lead will build, for its own page: its circles' coming-soon roles (`rolesLeadWillBuild`), then the
 * roles already held in those circles, as Held (the content list, 16 Nov 2026). `recruiting` names the held roles
 * still welcoming more players. The /roles index shows only the coming-soon names, as one line in the card.
 */
export function buildsFor(
  leadId: string,
  rows: ReadonlyArray<Record<string, any> & { id: string }>,
  circles: ReadonlyArray<{ id: string; leadRoleId?: string | null }>,
  recruiting: (row: Record<string, any>) => boolean,
): BuiltRole[] {
  const soon = rolesLeadWillBuild(leadId, rows as any[], circles);
  const led = new Set(circles.filter((c) => c.leadRoleId === leadId).map((c) => String(c.id)));
  const held = rows.filter((r) => r.id !== leadId && !!r.circleId && led.has(String(r.circleId)) && !r.isExample && r.futureVenture !== true && r.listed !== false && r.state === "filled");
  return [
    ...soon.map((r: any) => ({ id: String(r.id), name: String(r.name ?? ""), aim: r.aim ?? null })),
    ...held.map((r) => ({ id: r.id, name: String(r.name ?? ""), aim: r.aim ?? null, held: true, heldByAgent: r.heldByAgent === true, recruiting: recruiting(r) })),
  ];
}

export default function LeadBuilds({ leadName, roles, onOpen }: { leadName: string; roles: readonly BuiltRole[]; onOpen: (id: string) => void }) {
  const { t } = useLingui();
  if (roles.length === 0) return null;
  const headingId = `lead-builds-${roles[0].id}`;
  return (
    <section aria-labelledby={headingId} className="mt-6 rounded-2xl border border-notice/40 bg-card p-5 sm:p-6" data-lead-builds={roles.length}>
      <h3 id={headingId} className="font-display text-2xl leading-tight text-foreground">
        {t({ message: "Roles this steward will build", context: "under a lead steward's card: the coming-soon roles of the circles it leads" })}
      </h3>
      {roles.some((r) => !r.held) && (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            {t({ message: `Coming soon, under the ${leadName}.`, context: "under a lead role's card, the roles it will build" })}
          </p>
          <ComingSoonNote className="mt-3" />
        </>
      )}
      <ul className="mt-4 grid gap-2">
        {roles.map((r) =>
          r.held ? (
            <li key={r.id} className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-background px-4 py-3" data-lead-builds-held={r.id}>
              <span className="grid min-w-0 flex-1 gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="break-words font-semibold text-foreground">{r.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-muted text-foreground border border-border">{t({ message: "Held", context: "under a steward's card: a role someone already holds" })}</span>
                </span>
                {r.aim && <span className="break-words text-sm text-muted-foreground">{r.aim}</span>}
                <HeldByAgentLine role={{ heldByAgent: r.heldByAgent }} />
                {r.recruiting && (
                  <span className="text-sm font-medium text-open" data-more-welcome={r.id}>
                    {t({ message: "More players welcome", context: "a held role that is still recruiting" })}
                  </span>
                )}
              </span>
              {r.recruiting && (
                <Link href={applyHrefForRole(r.id)} className={`shrink-0 ${BTN_SECONDARY}`} data-apply-role={r.id}>
                  {t({ message: "Apply", context: "a held role that is still recruiting: apply to join it" })}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              )}
            </li>
          ) : (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onOpen(r.id)}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-left hover:border-notice focus-visible:outline-2 focus-visible:outline-ring"
              data-lead-builds-role={r.id}
            >
              <span className="grid min-w-0 flex-1 gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="break-words font-semibold text-foreground">{r.name}</span>
                  <ComingSoonChip role={{ comingSoon: true }} />
                </span>
                {r.aim && <span className="break-words text-sm text-muted-foreground">{r.aim}</span>}
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          </li>
          ),
        )}
      </ul>
    </section>
  );
}
