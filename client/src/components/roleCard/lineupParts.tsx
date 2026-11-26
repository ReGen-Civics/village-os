/**
 * The small pieces of a founding role's row on the team sheet and in the formation (FoundingLineup.tsx): the
 * status pill that says the role's kind, the domains it holds, how full it is, and the related roles it will onboard.
 *
 * THE CARD LOOK PASS, AS CHOSEN (the lead, 23 Nov 2026): the related roles as wrapping chips (b1); the fill bar and the
 * domains label as they were (b3 was not taken).
 */
import { useId } from "react";
import { ArrowRight, Sprout } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import type { RoleFill } from "@shared/commitmentRange";
import { domainsHeld } from "@shared/rolePieces";
import { fillLine } from "./cardWordsT";
import type { PillKind } from "./frontWords";

/** The domains a role holds, from its own domain words. */
const domainsOf = (seat: Record<string, any>): string[] => domainsHeld(typeof seat?.domain === "string" ? seat.domain : "");

/** "Domains they hold": the role's domains as quiet chips. */
export function Domains({ seat, center = false }: { seat: Record<string, any>; center?: boolean }) {
  const { t } = useLingui();
  const list = domainsOf(seat);
  if (list.length === 0) return null;
  return (
    <div className={`mt-2 grid gap-1.5 ${center ? "justify-items-center text-center" : ""}`} data-domains-held="">
      <p className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">{t({ message: "Domains they hold", context: "founding team: the domains a role holds" })}</p>
      <ul className={`flex flex-wrap gap-1.5 ${center ? "justify-center" : ""}`}>
        {list.map((d) => (
          <li key={d} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-card-foreground">
            <Sprout className="size-3 text-notice" aria-hidden="true" />
            {d}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * THE STATUS PILL SAYS THE KIND (the lead, 23 Nov 2026): "Open paid role" for a role on a paid track, "Open role" for a
 * volunteer role or one whose kind is not said, "Upcoming paid role" on an upcoming role that will be paid. It wraps
 * when it must (the Spanish crawl, 26 Nov 2026): "Próximo rol remunerado" in wide capitals ran past a phone card's
 * edge while it was held to one line. `max-w-full` keeps it inside the card, and the dot sits on the first line.
 */
export function OpenPill({ kind = "open" }: { kind?: PillKind }) {
  const { t } = useLingui();
  const words: Record<PillKind, string> = {
    open: t({ message: "Open role", context: "founding team: nobody holds this role yet" }),
    openPaid: t({ message: "Open paid role", context: "role card status pill: an open role on a paid track" }),
    upcomingPaid: t({ message: "Upcoming paid role", context: "role card status pill: an upcoming role that will be paid" }),
  };
  const live = kind !== "upcomingPaid";
  return (
    <span className="inline-flex max-w-full items-start gap-1.5 rounded-xl border border-notice bg-background/80 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase leading-snug tracking-widest text-notice" data-status-pill={kind}>
      <span className={`mt-[0.45em] size-1.5 shrink-0 rounded-full bg-notice ${live ? "motion-safe:animate-pulse" : ""}`} aria-hidden="true" />
      {words[kind]}
    </span>
  );
}

/**
 * "Related roles this role will onboard:", the roles still to come under a lead role, each one press away (the lead,
 * 21 Nov 2026; worded so since 23 Nov 2026). The label on its own line and the roles as chips that wrap (b1, chosen
 * 23 Nov 2026), the list tied to its label for a screen reader. A long name wraps inside its chip, left aligned.
 */
export function ToBeAdded({ roles, onOpen }: { roles: ReadonlyArray<{ id: string; name: string }>; onOpen?: (id: string) => void }) {
  const { t } = useLingui();
  const labelId = `${useId().replace(/[^a-zA-Z0-9]/g, "")}-related`;
  if (roles.length === 0) return null;
  const label = t({ message: "Related roles this role will onboard:", context: "under a lead role: the coming-soon roles of the circles it leads" });
  return (
    <div className="mt-3 grid gap-1.5" data-roles-to-be-added="">
      <p id={labelId} className="text-sm font-semibold text-card-foreground">
        {label}
      </p>
      <ul className="flex flex-wrap gap-2" aria-labelledby={labelId}>
        {roles.map((c) => (
          <li key={c.id} className="min-w-0">
            {onOpen ? (
              // A 36px chip whose press area reaches 44px (`after:-inset-y-1`), so three of them stack without the gaps.
              <button
                type="button"
                onClick={() => onOpen(c.id)}
                className="relative inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-notice/50 px-3.5 py-1 text-left text-sm font-medium text-notice after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] hover:border-notice hover:bg-notice/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                data-role-to-be-added={c.id}
              >
                <span className="min-w-0">{c.name}</span>
                <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
              </button>
            ) : (
              <span className="inline-flex min-h-9 items-center rounded-full border border-border px-3.5 py-1 text-left text-sm text-card-foreground" data-role-to-be-added={c.id}>
                {c.name}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * HOW FULL A ROLE IS (Rye, 14 Nov 2026, ruling 4): what its holders give against what it needs, as a bar
 * and in words, "50% held · 50% open" or "120% held · covered". A shared role stays open below its target.
 * It shows the role's need, never anyone's worth.
 */
export function FillMeter({ f, center = false }: { f: RoleFill; center?: boolean }) {
  const { t, i18n } = useLingui();
  const width = Math.min(100, Math.round((f.heldPct / f.targetPct) * 100));
  const target = f.targetPct !== 100 ? ` ${t({ message: `(of ${f.targetPct}%)`, context: "role fill, a target other than 100" })}` : "";
  const showBar = !f.coarse || f.covered;
  return (
    <div className={`mt-2 grid gap-1 ${center ? "w-full max-w-40 justify-items-center" : "max-w-xs"}`} data-fill-meter="">
      {/* Without the share (one named holder) there is no bar to draw short of covered. */}
      {showBar && (
        <span className="block h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <span className={`block h-full rounded-full ${f.covered ? "bg-muted-foreground" : "bg-notice"}`} style={{ width: `${width}%` }} />
        </span>
      )}
      <span className="text-xs text-muted-foreground">
        {fillLine(i18n, f)}
        {target}
      </span>
    </div>
  );
}
