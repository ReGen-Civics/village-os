/**
 * ONE ROW ON THE LIST (lane 4c): what it is, its own words, what deciding it does, when it arrived, and the door to the
 * page it is decided on, named by its verb. The words per kind are `SOURCE_WORDS`; the row never judges or ranks.
 * Rows that are decided on the list itself draw their own component (the connector's cards, OrgDraftRow).
 */
import { Link } from "wouter";
import { Trans, useLingui } from "@lingui/react/macro";
import { CHIP_SOFT, DOOR, HINT, QUIET } from "@/components/journey/look";
import type { InboxItem } from "@shared/reviewInbox";
import { sourceText } from "./sourceWords";

/** Where a door goes: a connector change opens its own page already searched for its code. */
export function doorOf(item: InboxItem): string {
  if (item.source === "connector" && item.code) return `${item.decideAt}?find=${encodeURIComponent(item.code)}`;
  return item.decideAt;
}

export default function InboxRow({ item }: { item: InboxItem }) {
  const { i18n } = useLingui();
  const words = sourceText(item.source, i18n);
  const sent = item.filedAt ? i18n.date(new Date(item.filedAt), { day: "numeric", month: "short" }) : null;
  return (
    <li className={`${QUIET} flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between`} data-testid={`row-${item.key}`}>
      <div className="min-w-0 space-y-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className={CHIP_SOFT}>{words.what}</span>
          {item.code ? <span className={CHIP_SOFT}>{item.code}</span> : null}
        </p>
        <p className="text-base text-foreground">{item.summary}</p>
        <p className="text-sm text-foreground">{words.does}</p>
        {sent ? (
          <p className={HINT}>
            <Trans context="review inbox: item">Sent {sent}</Trans>
          </p>
        ) : null}
      </div>
      <Link href={doorOf(item)} className={`${DOOR} shrink-0 self-start whitespace-nowrap`}>
        {words.door}
      </Link>
    </li>
  );
}
