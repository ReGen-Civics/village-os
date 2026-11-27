/**
 * THE PLAYER ROLE CARD, live: one card per person, on their own profile, on
 * their public profile, on a role application, on a shared role proposal and
 * in a proposal's Preview step.
 *
 * THE APPROVED DESIGN, SHIPPED AS IT WAS APPROVED: the CCOS version,
 * https://claude.ai/artifact/XGP6VP5WFU1T6ti7RD482P (Rye 2026-10-22), which
 * extends https://claude.ai/artifact/49Fh3tdkSoNYTmNDFv24D1. One night world:
 * the owner's character portrait in a gold ring with the moon pill under it;
 * one icon tile per role, each linking down to its section; across all my
 * roles; each role in full; the moon cycle; what I accomplished, by moon; how
 * I hold my roles; my applications; and agreements in a small closed
 * <details> at the bottom. The look is playerCard.css, the design's own rules
 * with a `pc-` prefix, and the card is a theme-frozen surface: it is drawn in
 * the design's night palette whatever the page's theme (that file says why
 * that is not a dark mode).
 *
 * DRAWN ONLY FROM THE MODEL. The server sends a `PlayerCard`
 * (shared/playerCard.ts) at the reader's tier, and every section here draws
 * what arrived and decides nothing: an unread slot draws nothing, an empty one
 * draws its words. The one thing this file holds is the owner's "Edit my card"
 * switch.
 *
 * WHY NOT `SeatTradingCard` FOR EACH ROLE. That card takes a `SeatInput` and
 * runs its own model (`seatSheet`), which names the role's holders and
 * decides its own words. The player card names nobody but its owner and has
 * already decided every word, so each role is drawn here from `RoleOut`.
 *
 * Phone first, by the design's own media queries: one column at 375px, the
 * hero centred, the tiles two to a row, every control at least 44px, and no
 * row wider than the screen.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { EDIT_WORDS } from "@shared/playerCardEdit";
import type { PlayerCardPayload } from "@shared/playerCardPayload";
import type { RoleOut, TileOut } from "@shared/playerCard";
import {
  CardEditContext,
  ChangedContext,
  countUnwritten,
  Eyebrow,
  NightContext,
  type ChangedWords,
} from "./cardParts";
import { useLingui } from "@lingui/react/macro";
import { CardHero, RoleTiles } from "./CardHeader";
import { AcrossSection } from "./AcrossSection";
import { RoleInFull } from "./RoleInFull";
import {
  Agreements,
  HowIHold,
  MoonTimeline,
  MyApplications,
} from "./CardLower";
import { AccomplishedSection } from "./AccomplishedSection";
import { fetchApplicationCard, fetchCard } from "./playerCardApi";
import "./playerCard.css";
import { CardWordsContext, ProposalWordsContext, cardWordsFor } from "./cardWords";

export const CARD_LOAD_WORDS = {
  failed: "This card did not load.",
  retry: "Retry",
} as const;

/**
 * "live" is a person's card as it stands. "proposal" is the card a role
 * application asks for (PR 3): drawn the same way, never edited, and its live
 * sections already read "Starts once adopted" in the model. "adopted" is
 * that application once the village adopted it: still never edited here, its
 * live sections reading the roles she now holds.
 */
export type CardViewMode = "live" | "proposal" | "adopted";

/**
 * THE ONE LINE IN PLACE OF EVERY "NOT WRITTEN YET" (profile overhaul, Direction D, 25 Nov 2026).
 * The live card used to print each unwritten part under its own heading, dozens of lines across a
 * holder's roles. Now those parts are absent, and the owner alone reads how many wait and one door that
 * opens edit mode, where each part shows its gap beside its edit control. Anyone else reads nothing.
 */
export function UnwrittenLine({ count, onWrite }: { count: number; onWrite: () => void }) {
  const { t } = useLingui();
  if (count <= 0) return null;
  const words =
    count === 1
      ? t({ message: "One part of your card is not written yet.", context: "player card: unwritten parts, one" })
      : t({ message: `${count} parts of your card are not written yet.`, context: "player card: unwritten parts, many" });
  return (
    <p className="pc-f14 pc-dim" data-card-unwritten="">
      {words}{" "}
      <button type="button" onClick={onWrite} className="pc-tab">
        <Pencil aria-hidden="true" />
        {t({ message: "Write them", context: "player card: opens edit mode for unwritten parts" })}
      </button>
    </p>
  );
}

/**
 * THE PROFILE'S MY ROLES: ONE CARD PER ROLE (the lead, 27 Nov 2026, the portal's next moves: "On My
 * roles, Your roles and the player card could merge into one card per role." His answer: "yes").
 *
 * Given, the card draws its roles first, right under the owner's portrait, each role carrying its tile
 * (`mark`, beside its title) and `lead` (after its chips and health) in place of the tile strip, and
 * then the parts that are about the person across their roles. Absent, the card is drawn exactly as
 * everywhere else.
 */
export interface RolesLayout {
  /** The roles' heading, in place of "Each role in full". */
  heading: string;
  /** Beside each role's title: the tile's art. */
  mark: (tile: TileOut | null) => ReactNode;
  /** After each role's chips and health: the member's part of their commitment and the doors. */
  lead: (role: RoleOut) => ReactNode;
  /** A role the member holds that the card did not draw, as its own short card. */
  extra?: ReactNode;
  /** In place of the roles, for a member who holds none. */
  empty?: ReactNode;
  /** Right after the roles: how much the member gives across them. */
  after?: ReactNode;
  /** The proposing door, before the member's role history. */
  door?: ReactNode;
}

/** The card itself, from a payload already read. Exported so tests draw it without a fetch. */
export function PlayerRoleCardView({
  data,
  reload = () => undefined,
  className = "",
  mode = "live",
  changed,
  roles: layout,
}: {
  data: PlayerCardPayload;
  reload?: () => void;
  className?: string;
  mode?: CardViewMode;
  /** A role proposal's changed words by role id, drawn in gold (role proposals PR C). */
  changed?: Readonly<Record<string, ChangedWords>>;
  /** The profile's My roles layout: one card per role. */
  roles?: RolesLayout;
}) {
  // The fixed lines the server sent for a reader in another language; this card's components read them too.
  const { i18n } = useLingui();
  const W = useMemo(() => cardWordsFor(data.card.words, i18n), [data.card.words, i18n, i18n.locale]);
  const [editing, setEditing] = useState(false);
  const { card, sheets, links, viewer, timeZone } = data;
  const mayEdit = viewer.isSelf && mode === "live";
  const unwritten = countUnwritten(card);
  const walletHref = mode === "live" ? links.wallet : undefined;
  const noRoles = !!layout && !card.roles.length && !layout.extra;
  const tiles = new Map(card.tiles.items.kind === "shown" ? card.tiles.items.value.map(t => [t.roleId, t]) : []);
  const actions =
    mayEdit || walletHref ? (
      <>
        {mayEdit ? (
          <button
            type="button"
            onClick={() => setEditing(e => !e)}
            aria-pressed={editing}
            className="pc-tab"
          >
            <Pencil aria-hidden="true" />
            {editing ? EDIT_WORDS.doneEditing : EDIT_WORDS.editMyCard}
          </button>
        ) : null}
        {walletHref ? (
          <a href={walletHref} className="pc-tab">
            {W.wallet}
          </a>
        ) : null}
      </>
    ) : null;
  return (
    <CardWordsContext.Provider value={data.card.words}>
    <ProposalWordsContext.Provider value={data.card.proposalWords}>
    <CardEditContext.Provider
      value={{ editing: mayEdit && editing, owner: mayEdit, reload, quiet: mode !== "proposal" && !(mayEdit && editing) }}
    >
      <NightContext.Provider value={true}>
        <div
          data-player-card
          data-card-mode={mode}
          className={`pc-night pc-card ${className}`}
        >
          <div className="pc-wrap">
            <CardHero header={card.header} actions={actions} />
            {layout ? null : <RoleTiles tiles={card.tiles} />}
            {mayEdit && !editing ? <UnwrittenLine count={unwritten} onWrite={() => setEditing(true)} /> : null}

            {layout ? null : <AcrossSection across={card.across} sheets={sheets} timeZone={timeZone} />}

            {card.roles.length || layout?.extra ? (
              <section aria-labelledby="pc-roles-h" className="pc-roles">
                <div className="pc-headgroup">
                  {card.roles.length ? <Eyebrow gold>{W.myNRoles(card.roles.length)}</Eyebrow> : null}
                  <h3 id="pc-roles-h" className="pc-h2">
                    {layout ? layout.heading : W.eachInFull(card.roles.length)}
                  </h3>
                  {/* 0274: once, above the roles, what an underlined heading does. */}
                  {card.termsKey ? (
                    <p className="pc-dim pc-f13">{card.termsKey}</p>
                  ) : null}
                </div>
                {card.roles.map(r => (
                  <ChangedContext.Provider
                    key={r.id}
                    value={changed?.[r.id] ?? null}
                  >
                    <RoleInFull
                      role={r}
                      health={tiles.get(r.id)?.health ?? null}
                      mark={layout ? layout.mark(tiles.get(r.id) ?? null) : null}
                      lead={layout ? layout.lead(r) : null}
                    />
                  </ChangedContext.Provider>
                ))}
                {layout?.extra}
              </section>
            ) : (
              layout?.empty
            )}
            {layout?.after}
            {/* With no role the door is the next act, so it follows the empty roles, and nothing is drawn across none. */}
            {noRoles ? layout?.door : null}

            {layout && !noRoles ? <AcrossSection across={card.across} sheets={sheets} timeZone={timeZone} /> : null}
            <MoonTimeline timeline={card.timeline} />
            <AccomplishedSection accomplished={card.accomplished} />
            <HowIHold howIHold={card.howIHold} />
            {noRoles ? null : layout?.door}
            <MyApplications applications={card.applications} />
            <Agreements
              agreements={card.agreements}
              newApplicationHref={links.newApplication}
            />
          </div>
        </div>
      </NightContext.Provider>
    </CardEditContext.Provider>
    </ProposalWordsContext.Provider>
    </CardWordsContext.Provider>
  );
}

/**
 * Fetches a card and draws it: a person's by handle (`me` for your own), or,
 * with `applicationId`, the card that application asks for in proposal mode.
 * `fallback` draws instead of the failure line when the card cannot load, and
 * `footer` draws under the card once it has.
 */
export default function PlayerRoleCard({
  handle = "me",
  applicationId,
  mode = applicationId ? "proposal" : "live",
  className = "",
  fallback,
  footer,
}: {
  handle?: string;
  applicationId?: string;
  mode?: CardViewMode;
  className?: string;
  fallback?: ReactNode;
  footer?: ReactNode;
}) {
  const [data, setData] = useState<PlayerCardPayload | null>(null);
  const [failed, setFailed] = useState(false);

  // The card is said in the reader's language on the server, so a change of language reads it again.
  const { i18n } = useLingui();
  const locale = i18n.locale;
  const load = useCallback(() => {
    let alive = true;
    setFailed(false);
    void (
      applicationId ? fetchApplicationCard(applicationId, locale) : fetchCard(handle, locale)
    ).then(r => {
      if (!alive) return;
      if (r.ok) setData(r.data);
      else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [handle, applicationId, locale]);
  useEffect(() => load(), [load]);

  // Arriving by a link to one role (`/profile/:handle#role-<id>`, from /roles):
  // the section exists only once the card has loaded, so scroll to it then.
  useEffect(() => {
    if (!data || typeof window === "undefined") return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id.startsWith("role-")) return;
    document.getElementById(id)?.scrollIntoView?.({ block: "start" });
  }, [data]);

  if (failed && fallback !== undefined) return <>{fallback}</>;
  if (failed) {
    return (
      <p role="status" className="text-foreground">
        {CARD_LOAD_WORDS.failed}{" "}
        <button
          type="button"
          onClick={load}
          className="min-h-11 font-medium text-notice underline underline-offset-2"
        >
          {CARD_LOAD_WORDS.retry}
        </button>
      </p>
    );
  }
  if (!data) return null;
  return (
    <>
      <PlayerRoleCardView
        data={data}
        reload={load}
        className={className}
        mode={mode}
      />
      {footer}
    </>
  );
}
