/**
 * MY ROLES: ONE CARD PER ROLE (the lead, 27 Nov 2026, the portal's next moves: "On My roles, Your
 * roles and the player card could merge into one card per role." His answer: "yes").
 *
 * The tab used to stack two panels about the same roles: "Your roles" (each role's name and term, how
 * much you give, Apply and Plan your season, your open proposals) and the player card under it (the
 * portrait, a tile per role, then each role in full). Now it is the player card alone, drawn in its
 * roles layout (`RolesLayout` in PlayerRoleCard.tsx): the portrait, then one card per role, each
 * carrying its art and health, its circle and term, the member's part of their commitment, and the
 * doors to the moon, the season plan and the role's own page. How much you give follows the roles it is
 * about, then the parts that are about the person across their roles, and the proposing door last,
 * before the member's role history.
 *
 * FOUR READS, ALL ALREADY THERE: the card (`/api/people/me/role-card`), the roles held and whether the
 * member may apply (`/api/season-plans/mine`), the member's open applications (asked only when they may
 * apply, because it answers 401 to anybody else), and their commitment. A card that cannot load falls
 * back to the plain "Your roles" panel, so the roles and the door are never lost with it.
 *
 * Its own file because Profile.tsx sits at the file-lines ratchet.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { CalendarDays, Moon, UserPlus } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import type { RoleOut, TileOut } from "@shared/playerCard";
import type { PlayerCardPayload } from "@shared/playerCardPayload";
import { applySeatsHref } from "@shared/seatApplyLinks";
import { sharesOfYou, splitForRoles } from "@shared/commitment";
import { fetchMine, type HeldSeat, type MinePayload } from "@/components/seasonPlans/seasonPlansApi";
import { fetchApplications, type ServedApplication } from "@/components/governance/seatApplicationsApi";
import { fetchCard } from "@/components/playerCard/playerCardApi";
import { PlayerRoleCardView } from "@/components/playerCard/PlayerRoleCard";
import { FirstDaysContext } from "@/components/playerCard/CardLower";
import { Eyebrow } from "@/components/playerCard/cardParts";
import { RoleIconSvg } from "@/components/playerCard/roleIcons";
import RolesCommitment from "@/components/commitment/RolesCommitment";
import YourRolesSection, { YOUR_ROLES_WORDS, openApplicationsOf } from "@/components/profile/YourRolesSection";
import { useMyCommitment } from "@/lib/useMyCommitment";
import { authToken } from "@/lib/gameApi";
import { useModuleOn } from "@/modules/ModuleProvider";

/** Where "This moon" goes: My moon on this page when the village runs it, else the card's own moon cycle. */
const MOON_ON_PAGE = "#my-moon";
const MOON_ON_CARD = "#pc-moons-h";

/** The member's part of their commitment for one role, in words, or null with nothing said. */
export function partOfYou(
  roleId: string,
  heldIds: readonly string[],
  now: { pct: number; split?: { roleId: string; share: number }[] | null } | null,
): { pct: number; share: number | null } | null {
  if (!now || !heldIds.includes(roleId)) return null;
  if (heldIds.length === 1) return { pct: now.pct, share: null };
  const split = splitForRoles(now.split ?? null, heldIds);
  if (!split) return { pct: now.pct, share: null };
  return { pct: sharesOfYou(now.pct, split).get(roleId) ?? 0, share: split.find((s) => s.roleId === roleId)?.share ?? 0 };
}

/** The role's art beside its title: the gold line icon its tile carried. */
function RoleMark({ tile }: { tile: TileOut | null }) {
  if (!tile) return null;
  return (
    <span className="pc-rolelead-icon" aria-hidden="true">
      <RoleIconSvg icon={tile.icon} />
    </span>
  );
}

function RoleLead({
  role,
  seat,
  part,
  manyRoles,
  moonHref,
}: {
  role: { id: string; title: string };
  seat: HeldSeat | null;
  part: { pct: number; share: number | null } | null;
  manyRoles: boolean;
  moonHref: string;
}) {
  const { t } = useLingui();
  const partWords = !part
    ? null
    : part.share !== null
      ? t({ message: `Your part: ${part.pct}% of you, ${part.share}% of what you give`, context: "profile My roles: a role's part of the member's commitment, split" })
      : manyRoles
        ? t({ message: `Shares the ${part.pct}% you give with your other roles`, context: "profile My roles: a role's part of the member's commitment, not split" })
        : t({ message: `You give it ${part.pct}% of yourself`, context: "profile My roles: the commitment of a member's only role" });
  return (
    <div className="pc-stack" data-role-lead={role.id}>
      {seat?.lapsed || partWords ? (
        <p className="pc-health">
          {seat?.lapsed ? <b>{YOUR_ROLES_WORDS.ended}</b> : null}
          {partWords ? <span data-role-part="">{partWords}</span> : null}
        </p>
      ) : null}
      <nav className="pc-doors" aria-label={t({ message: `Doors for ${role.title}`, context: "profile My roles: a role's doors, aria-label" })}>
        <a href={moonHref} className="pc-tab">
          <Moon aria-hidden="true" />
          {t({ message: "This moon", context: "profile My roles: a role's door to My moon" })}
        </a>
        <Link href="/season#plan" className="pc-tab">
          <CalendarDays aria-hidden="true" />
          {t({ message: "Season plan", context: "profile My roles: a role's door to the season plan" })}
        </Link>
        <Link href={`/roles?seat=${encodeURIComponent(role.id)}`} className="pc-tab">
          {t({ message: "On the roles page", context: "profile My roles: a role's door to its place on the Roles page" })}
        </Link>
      </nav>
    </div>
  );
}

/** The door to proposing: apply for roles and plan the season, the open proposals, and where to look. */
function ProposingDoor({ mine, apps }: { mine: MinePayload | null; apps: readonly ServedApplication[] }) {
  const { t } = useLingui();
  const mayApply = mine ? mine.mayApply !== false : false;
  return (
    <section aria-labelledby="pc-propose-h" className="pc-panel" data-proposing-door="">
      <div className="pc-headgroup">
        <Eyebrow gold>{t({ message: "Proposing", context: "profile My roles: the proposing door, eyebrow" })}</Eyebrow>
        <h3 id="pc-propose-h" className="pc-h2">
          {t({ message: "Take on a role", context: "profile My roles: the proposing door, heading" })}
        </h3>
      </div>
      {mine ? (
        mayApply ? (
          <>
            <p className="pc-dim pc-f14">{YOUR_ROLES_WORDS.applyLine}</p>
            <div className="pc-doors">
              <Link href={applySeatsHref([], { seasonId: mine.season?.id ?? null })} className="pc-tab">
                <UserPlus aria-hidden="true" />
                {YOUR_ROLES_WORDS.apply}
              </Link>
              <Link href="/season#plan" className="pc-tab">
                <CalendarDays aria-hidden="true" />
                {YOUR_ROLES_WORDS.plan}
              </Link>
            </div>
          </>
        ) : (
          // A guest is told before the wizard, never at its Review step (red team U5).
          <p className="pc-f14">{YOUR_ROLES_WORDS.membersOnly}</p>
        )
      ) : null}
      {apps.length > 0 ? (
        <div className="pc-stack">
          <h4 className="pc-h3">{YOUR_ROLES_WORDS.openHeading}</h4>
          <ul className="pc-stack pc-list-plain">
            {apps.map((a) => (
              <li key={a.id}>
                <Link href={a.href || `/role-applications/${encodeURIComponent(a.id)}`} className="pc-tab" data-open-proposal={a.id}>
                  {a.seats.map((s) => s.name).join(", ")}: {a.statusWords}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="pc-doors">
        <Link href="/profile/characters" className="pc-tab">
          {YOUR_ROLES_WORDS.fits}
        </Link>
        <Link href="/roles" className="pc-tab">
          {YOUR_ROLES_WORDS.every}
        </Link>
      </div>
    </section>
  );
}

/** A role the member holds that the card did not draw (a card read a moment older than the roles). */
function ShortRoleCard({ seat, lead }: { seat: HeldSeat; lead: ReactNode }) {
  return (
    <article id={`role-${seat.id}`} aria-labelledby={`role-${seat.id}-h`} className="pc-rolecard" data-short-role="">
      <h3 id={`role-${seat.id}-h`} className="pc-roletitle">
        {seat.name}
      </h3>
      {seat.termEndsOn && !seat.lapsed ? <p className="pc-dim pc-f14">{YOUR_ROLES_WORDS.until(seat.termEndsOn)}</p> : null}
      {lead}
    </article>
  );
}

export default function MyRoleCards({ firstDays = false }: { firstDays?: boolean }) {
  const { t, i18n } = useLingui();
  const locale = i18n.locale;
  const moonOn = useModuleOn("moon-review");
  // Asked only with a session: the route refuses anybody else, and a refused read logs red (membersOnlyReads.test.tsx).
  const commitment = useMyCommitment(!!authToken());
  const [card, setCard] = useState<PlayerCardPayload | null>(null);
  const [cardFailed, setCardFailed] = useState(false);
  const [mine, setMine] = useState<MinePayload | null>(null);
  const [apps, setApps] = useState<ServedApplication[]>([]);

  const loadCard = useCallback(() => {
    let alive = true;
    setCardFailed(false);
    void fetchCard("me", locale).then((r) => {
      if (!alive) return;
      if (r.ok) setCard(r.data);
      else setCardFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [locale]);
  useEffect(() => loadCard(), [loadCard]);

  useEffect(() => {
    let alive = true;
    void fetchMine().then((a) => {
      if (!alive || !a.ok || !a.data || typeof a.data !== "object") return;
      setMine(a.data);
      if (a.data.mayApply !== false) {
        void fetchApplications().then((l) => {
          if (alive && l.ok && Array.isArray(l.data?.applications)) setApps(openApplicationsOf(l.data.applications));
        });
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  // Arriving by a link to one role (`/profile#role-<id>`): the role exists only once the card has loaded.
  useEffect(() => {
    if (!card || typeof window === "undefined") return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id.startsWith("role-")) document.getElementById(id)?.scrollIntoView?.({ block: "start" });
  }, [card]);

  // The card is the whole tab; without it, the plain panel still carries the roles and the door.
  if (cardFailed) return <YourRolesSection />;
  if (!card) return null;

  const held = mine?.heldSeats ?? [];
  const heldIds = held.map((s) => s.id);
  const seatOf = new Map(held.map((s) => [s.id, s]));
  const drawn = new Set(card.card.roles.map((r) => r.id));
  const manyRoles = Math.max(held.length, card.card.roles.length) > 1;
  const moonHref = moonOn ? MOON_ON_PAGE : MOON_ON_CARD;
  const leadFor = (role: { id: string; title: string }) => (
    <RoleLead
      role={role}
      seat={seatOf.get(role.id) ?? null}
      part={partOfYou(role.id, heldIds, commitment.now)}
      manyRoles={manyRoles}
      moonHref={moonHref}
    />
  );
  const undrawn = held.filter((s) => !drawn.has(s.id));

  return (
    <FirstDaysContext.Provider value={firstDays}>
      <section id="sheet-roles" aria-label={YOUR_ROLES_WORDS.heading} className="scroll-mt-28" data-my-role-cards="">
        <PlayerRoleCardView
          data={card}
          reload={loadCard}
          roles={{
            heading: YOUR_ROLES_WORDS.heading,
            mark: (tile) => <RoleMark tile={tile} />,
            lead: (r: RoleOut) => leadFor({ id: r.id, title: r.title }),
            extra: undrawn.length
              ? undrawn.map((s) => <ShortRoleCard key={s.id} seat={s} lead={leadFor({ id: s.id, title: s.name })} />)
              : null,
            empty: (
              <section aria-labelledby="pc-roles-h" className="pc-panel" data-no-roles="">
                <div className="pc-headgroup">
                  <h3 id="pc-roles-h" className="pc-h2">
                    {YOUR_ROLES_WORDS.heading}
                  </h3>
                </div>
                <p className="pc-f14">{YOUR_ROLES_WORDS.noSeats}</p>
                <p className="pc-dim pc-f14">
                  {t({ message: "Each role you take on gets its own card here, with its circle, its term and the moon it works to.", context: "profile My roles: the empty state, what will appear" })}
                </p>
              </section>
            ),
            after: held.length ? <RolesCommitment seats={held} mine={commitment} /> : null,
            door: <ProposingDoor mine={mine} apps={apps} />,
          }}
        />
      </section>
    </FirstDaysContext.Provider>
  );
}
