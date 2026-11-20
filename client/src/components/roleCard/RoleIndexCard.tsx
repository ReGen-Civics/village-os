/**
 * ONE ROLE ON THE /roles INDEX (the lead, 20 Nov 2026: "roles are easy to tell apart").
 *
 * Every role on /roles is this one bounded card, with the same anatomy whatever its state: a badge
 * (Open, Coming soon, Future venture), the title, a one-line purpose, three tags (circle, commitment,
 * place), the held/open bar, and two acts. Nothing opens inline: the whole role lives on its own page,
 * `/roles/<slug>` (RoleShare.tsx), which "Read the role" and the card itself go to.
 *
 * THE WHOLE CARD IS A LINK without nesting one control inside another: the title's link is stretched over
 * the card with an `::after` box, and the acts, the children's links and any slot sit above it (`relative
 * z-10`), so each stays its own target and a screen reader meets one link per destination it names.
 *
 * A steward's coming-soon roles are one indented line inside its card ("Will grow into"), each a link to
 * that role's page; the full list is on the steward's own page.
 */
import type { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import { ComingSoonChip } from "@/components/ComingSoon";
import { BTN_PRIMARY, BTN_SECONDARY, CHIP_SOFT } from "@/components/journey/look";
import { roleFill, type RoleFill } from "@shared/commitmentRange";
import { roleCardView } from "@shared/roleCardView";
import { fillLine } from "./cardWordsT";
import { commitmentLine } from "./rewardWords";

export type IndexKind = "open" | "soon" | "venture";

/** A group's heading on /roles: one size up from a panel's H2, so each group reads as its own chapter (the lead, 20 Nov 2026). */
export const GROUP_H2 = "font-display text-3xl font-bold leading-tight text-card-foreground sm:text-4xl";
/** The break above the second and third groups: a gold rule and a wide gap, clearly bigger than the gap between cards. */
export const GROUP_BREAK = "border-t-2 border-notice/40 pt-12 sm:pt-16";

export interface IndexChild {
  id: string;
  name: string;
  path: string;
}

export interface RoleIndexCardProps {
  /** The `/api/org` row as it arrived. */
  seat: Record<string, any>;
  /** Its own page, `/roles/<slug>`. */
  path: string;
  circleName: string | null;
  kind: IndexKind;
  /** The badge on an open role: the seat's state in the card's words ("Open", "Partly held", ...). */
  stateWord?: string;
  /** How full the role is, when the server sent it (the founding team's fills). */
  fill?: RoleFill | { coarse: true; targetPct: number; covered: boolean } | null;
  /** The card's own words for where (a founding card's sections.where), over the listing's label. */
  whereWords?: string | null;
  /** Where Apply goes, or null for no Apply. */
  applyHref?: string | null;
  /** The coming-soon roles this steward will build. */
  children?: readonly IndexChild[];
  /** Acts of its own in place of Apply (a coming-soon role's waitlist and Apply early). */
  acts?: ReactNode;
  /** The card's own anchor, for a link that scrolls to it (`role-<id>` on a coming-soon card). */
  anchorId?: string;
}

/** The fill from the row itself when the server sent none: each holder holds the whole role, as on the server. */
export function rowFill(seat: Record<string, any>): RoleFill {
  const held = Math.max(0, Number(seat?.holderCount ?? 0) || 0);
  const target = seat?.card?.commitmentTarget ?? seat?.commitmentTarget ?? null;
  const f = roleFill(Array.from({ length: held }, () => null), typeof target === "number" ? target : null);
  // One holder: covered or open only, never a share that would read as that person's (security sweep L3).
  return held === 1 ? { ...f, coarse: true } : f;
}

export default function RoleIndexCard({ seat, path, circleName, kind, stateWord, fill, whereWords, applyHref = null, children = [], acts, anchorId }: RoleIndexCardProps) {
  const { t, i18n } = useLingui();
  const id = String(seat?.id ?? "");
  const name = String(seat?.name ?? "");
  const aim = typeof seat?.aim === "string" ? seat.aim.trim() : "";
  const tileSeat = whereWords?.trim() ? { ...seat, card: { ...(seat?.card ?? {}), whereText: whereWords.trim() } } : seat;
  // The same two lines the role's own card draws (its one-minute panel and its seat column), from the same fields.
  const where = roleCardView(tileSeat).rows.find((row) => row.id === "where")?.lines.join(", ") ?? null;
  const tags = [circleName, commitmentLine(i18n, seat), where].filter((x): x is string => !!x);
  const f = (fill ?? rowFill(seat)) as RoleFill;
  const width = f.coarse ? (f.covered ? 100 : 0) : Math.min(100, Math.round((f.heldPct / Math.max(1, f.targetPct)) * 100));
  return (
    <li
      id={anchorId}
      className="relative flex scroll-mt-24 flex-col rounded-2xl border-2 border-border bg-card p-4 shadow-sm transition-colors hover:border-notice/70 focus-within:border-notice sm:p-5"
      data-role-card={id}
      data-role-kind={kind}
      data-coming-soon-role={kind === "soon" ? id : undefined}
    >
      <div className="flex flex-wrap items-center gap-2" data-role-card-badge="">
        {kind === "open" ? (
          <span className="rounded-full border border-notice/50 bg-notice/10 px-2 py-0.5 text-xs font-medium text-notice">{stateWord ?? t({ message: "Open", context: "roles page, role state" })}</span>
        ) : (
          <ComingSoonChip role={kind === "venture" ? { futureVenture: true } : { comingSoon: true }} />
        )}
      </div>
      <h3 className="mt-2 font-display text-xl leading-snug text-card-foreground">
        <Link
          href={path}
          className="rounded-lg after:absolute after:inset-0 after:rounded-2xl after:content-[''] hover:text-notice focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
          data-role-card-link={id}
        >
          {name}
        </Link>
      </h3>
      {aim && <p className="mt-1 line-clamp-1 text-sm text-muted-foreground" data-role-card-purpose="">{aim}</p>}
      {tags.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5" data-role-card-tags="">
          {tags.map((tag) => (
            <li key={tag} className={CHIP_SOFT}>{tag}</li>
          ))}
        </ul>
      )}
      {/* The bar and its words on one line, so the card stays short on a phone. */}
      <div className="mt-2 flex items-center gap-3" data-fill-meter="">
        <span className="block h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <span className={`block h-full rounded-full ${f.covered ? "bg-open" : "bg-notice"}`} style={{ width: `${width}%` }} />
        </span>
        <span className="text-xs text-muted-foreground">{fillLine(i18n, f)}</span>
      </div>
      {children.length > 0 && (
        <p className="relative z-10 mt-3 border-l-2 border-notice/40 pl-3 text-sm text-muted-foreground" data-role-card-children="">
          {t({ message: "Will grow into:", context: "roles index card: the coming-soon roles this steward will build" })}{" "}
          {children.map((c, i) => (
            <span key={c.id}>
              {i > 0 && " · "}
              <Link href={c.path} className="font-medium text-notice underline underline-offset-2 hover:text-foreground" data-role-card-child={c.id}>
                {c.name}
              </Link>
            </span>
          ))}
        </p>
      )}
      <div className="relative z-10 mt-3 flex flex-wrap items-center gap-2" data-role-card-acts="">
        <Link href={path} className={BTN_SECONDARY} data-read-role={id}>
          {t({ message: "Read the role", context: "roles index card: open this role's own page" })}
          <span className="sr-only">{`: ${name}`}</span>
        </Link>
        {acts ??
          (applyHref ? (
            <Link href={applyHref} className={BTN_PRIMARY} data-apply-role={id}>
              {kind === "venture" ? t({ message: "Bring your venture", context: "roles index card: apply to build and run this venture" }) : t({ message: "Apply", context: "roles index card: apply for this role" })}
              <span className="sr-only">{`: ${name}`}</span>
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          ) : null)}
      </div>
    </li>
  );
}
