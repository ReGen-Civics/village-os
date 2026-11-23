/**
 * The small pieces of a founding role's row on the team sheet and in the formation (FoundingLineup.tsx): the
 * "Open role" pill, the domains it holds, how full it is, and the related roles it will onboard.
 *
 * PHASE 1 OF THE CARD LOOK PASS (the lead, 23 Nov 2026: "one more design pass ... easier to read and beautiful,
 * without removing any of the information"). `polish` switches on the readability changes under review, each on
 * its own so a before and after can be shown side by side; with none set every piece draws exactly as before.
 */
import { Fragment } from "react";
import { ArrowRight, Sprout } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import type { RoleFill } from "@shared/commitmentRange";
import { domainsHeld } from "@shared/rolePieces";
import { fillLine } from "./cardWordsT";

/** The readability changes under review: b1 related roles as chips, b2 the facts grouped, b3 the fill labelled. */
export type CardPolish = ReadonlySet<"b1" | "b2" | "b3">;
export const NO_POLISH: CardPolish = new Set();

/** The domains a role holds, from its own domain words. */
const domainsOf = (seat: Record<string, any>): string[] => domainsHeld(typeof seat?.domain === "string" ? seat.domain : "");

/** "Domains they hold": the role's domains as quiet chips. */
export function Domains({ seat, center = false, polish = NO_POLISH }: { seat: Record<string, any>; center?: boolean; polish?: CardPolish }) {
  const { t } = useLingui();
  const list = domainsOf(seat);
  if (list.length === 0) return null;
  // b3: the label at 12px, the size of the chips under it, where it was 10px.
  const label = polish.has("b3") ? "text-xs font-semibold uppercase tracking-widest text-muted-foreground" : "text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground";
  return (
    <div className={`mt-2 grid gap-1.5 ${center ? "justify-items-center text-center" : ""}`} data-domains-held="">
      <p className={label}>{t({ message: "Domains they hold", context: "founding team: the domains a role holds" })}</p>
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

export function OpenPill() {
  const { t } = useLingui();
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-notice bg-background/80 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-widest text-notice">
      <span className="size-1.5 rounded-full bg-notice motion-safe:animate-pulse" aria-hidden="true" />
      {t({ message: "Open role", context: "founding team: nobody holds this role yet" })}
    </span>
  );
}

/**
 * "Related roles this role will onboard:", the roles still to come under a lead role, each one press away (the lead,
 * 21 Nov 2026; worded so since 23 Nov 2026). b1: the label on its own line and the roles as chips that wrap, where
 * they were links strung through a sentence with a middle dot between them.
 */
export function ToBeAdded({ roles, onOpen, polish = NO_POLISH }: { roles: ReadonlyArray<{ id: string; name: string }>; onOpen?: (id: string) => void; polish?: CardPolish }) {
  const { t } = useLingui();
  if (roles.length === 0) return null;
  const label = t({ message: "Related roles this role will onboard:", context: "under a lead role: the coming-soon roles of the circles it leads" });
  if (polish.has("b1")) {
    return (
      <div className="mt-3 grid gap-1.5" data-roles-to-be-added="">
        <p className="text-sm font-semibold text-card-foreground">{label}</p>
        <ul className="flex flex-wrap gap-2">
          {roles.map((c) => (
            <li key={c.id}>
              {onOpen ? (
                // A 36px chip whose press area reaches 44px (`after:-inset-y-1`), so three of them stack without the gaps.
                <button
                  type="button"
                  onClick={() => onOpen(c.id)}
                  className="relative inline-flex min-h-9 items-center gap-1.5 rounded-full border border-notice/50 px-3.5 text-sm font-medium text-notice after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] hover:border-notice hover:bg-notice/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  data-role-to-be-added={c.id}
                >
                  {c.name}
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </button>
              ) : (
                <span className="inline-flex min-h-9 items-center rounded-full border border-border px-3.5 text-sm text-card-foreground" data-role-to-be-added={c.id}>
                  {c.name}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <p className="mt-2 text-sm text-muted-foreground" data-roles-to-be-added="">
      <span className="font-semibold text-card-foreground">{label}</span>{" "}
      {roles.map((c, i) => (
        <Fragment key={c.id}>
          {i > 0 && " · "}
          {onOpen ? (
            <button type="button" onClick={() => onOpen(c.id)} className="min-h-11 font-medium text-notice underline underline-offset-2 hover:text-foreground" data-role-to-be-added={c.id}>
              {c.name}
            </button>
          ) : (
            <span data-role-to-be-added={c.id}>{c.name}</span>
          )}
        </Fragment>
      ))}
    </p>
  );
}

/**
 * HOW FULL A ROLE IS (Rye, 14 Nov 2026, ruling 4): what its holders give against what it needs, as a bar
 * and in words, "50% held · 50% open" or "120% held · covered". A shared role stays open below its target.
 * It shows the role's need, never anyone's worth. b3: a label names what the bar measures, the words sit at
 * 14px in the panel's ink, and the bar is a little thicker.
 */
export function FillMeter({ f, center = false, polish = NO_POLISH }: { f: RoleFill; center?: boolean; polish?: CardPolish }) {
  const { t, i18n } = useLingui();
  const width = Math.min(100, Math.round((f.heldPct / f.targetPct) * 100));
  const target = f.targetPct !== 100 ? ` ${t({ message: `(of ${f.targetPct}%)`, context: "role fill, a target other than 100" })}` : "";
  const showBar = !f.coarse || f.covered;
  if (polish.has("b3") && !center) {
    return (
      <div className="mt-3 grid max-w-sm gap-1.5" data-fill-meter="">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t({ message: "How much of this role is held", context: "founding team: the label over a role's fill bar" })}</span>
          <span className="text-sm font-semibold text-card-foreground">
            {fillLine(i18n, f)}
            {target}
          </span>
        </div>
        {showBar && (
          <span className="block h-2 w-full overflow-hidden rounded-full border border-border/60 bg-muted" aria-hidden="true">
            <span className={`block h-full rounded-full ${f.covered ? "bg-open" : "bg-notice"}`} style={{ width: `${width}%` }} />
          </span>
        )}
      </div>
    );
  }
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
