/**
 * ONE ROW ON THE LIST (lane 4c): what it is, its own words, what deciding it does, when it arrived, and the door to the
 * page it is decided on, named by its verb. The words per kind are `SOURCE_WORDS`; the row never judges or ranks.
 * Rows that are decided on the list itself draw their own component (the connector's cards, OrgDraftRow).
 */
import { Link } from "wouter";
import { Plural, Trans, useLingui } from "@lingui/react/macro";
import { CHIP_SOFT, DOOR, HINT, QUIET } from "@/components/journey/look";
import type { InboxBlocked, InboxItem } from "@shared/reviewInbox";
import { sourceText } from "./sourceWords";

/** The chip on a row that cannot be applied as the village stands. A word, with the edge as a second sign. */
export const CHIP_BLOCKED = "inline-flex items-center gap-1 rounded-full border border-destructive bg-muted px-2.5 py-0.5 text-xs font-semibold text-destructive";

/** "Blocked", as a chip beside a row's kind. */
export function BlockedChip() {
  return (
    <span className={CHIP_BLOCKED} data-testid="blocked-chip">
      <Trans context="review inbox: a row that cannot be applied as the village stands">Blocked</Trans>
    </span>
  );
}

/** Why a row is blocked: the first blocked change in its queue's own words, and how many more there are. */
export function BlockedWhy({ blocked }: { blocked: InboxBlocked }) {
  const more = blocked.count - 1;
  return (
    <p className="text-sm text-destructive" data-testid="blocked-why">
      <Trans context="review inbox: a blocked row">It cannot be applied as the village stands.</Trans>{" "}
      {blocked.reads ? `${blocked.reads}: ` : ""}
      {blocked.why}.
      {more > 0 ? (
        <>
          {" "}
          <Plural context="review inbox: a blocked row" value={more} one="# more of its changes is blocked." other="# more of its changes are blocked." />
        </>
      ) : null}
    </p>
  );
}

/** Where a door goes: a connector change opens its own page already searched for its code. */
export function doorOf(item: InboxItem): string {
  if (item.source === "connector" && item.code) return `${item.decideAt}?find=${encodeURIComponent(item.code)}`;
  return item.decideAt;
}

export default function InboxRow({ item }: { item: InboxItem }) {
  const { i18n } = useLingui();
  const words = sourceText(item.source, i18n);
  const sent = item.filedAt ? i18n.date(new Date(item.filedAt), { day: "numeric", month: "short" }) : null;
  const lapses = item.lapsesAt ? i18n.date(new Date(item.lapsesAt), { day: "numeric", month: "short" }) : null;
  return (
    <li className={`${QUIET} flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between`} data-testid={`row-${item.key}`}>
      <div className="min-w-0 space-y-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className={CHIP_SOFT}>{words.what}</span>
          {item.code ? <span className={CHIP_SOFT}>{item.code}</span> : null}
          {item.blocked ? <BlockedChip /> : null}
        </p>
        <p className="text-base text-foreground">{item.summary}</p>
        <p className="text-sm text-foreground">{words.does}</p>
        {item.blocked ? <BlockedWhy blocked={item.blocked} /> : null}
        {sent ? (
          <p className={HINT}>
            <Trans context="review inbox: item">Sent {sent}</Trans>
          </p>
        ) : null}
        {lapses ? (
          <p className="text-sm font-semibold text-notice" data-testid={`lapses-${item.key}`}>
            <Trans context="review inbox: item, an agent's proposal lapses undecided">Lapses on {lapses} if nobody decides it</Trans>
          </p>
        ) : null}
      </div>
      <Link href={doorOf(item)} className={`${DOOR} shrink-0 self-start whitespace-nowrap`}>
        {words.door}
      </Link>
    </li>
  );
}
