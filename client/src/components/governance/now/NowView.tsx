/**
 * THE NOW VIEW (Governance brief, step 3), drawn from `NowAnswer` and nothing else: what waits for your voice (soonest
 * to close first), what closes within two days, Your voice, and what you brought. Presentation only; the read is
 * `useGovernanceNow`, the gate is the server's. A later visual layer restyles this file without touching either.
 */
import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { Plural, Trans, useLingui } from "@lingui/react/macro";
import { Link } from "wouter";
import { BTN_SECONDARY, CARD, CARD_FEATURED, CHIP_SOFT, DOOR, EYEBROW, H2, HINT, LINK, NOTE, QUIET, STATEMENT } from "@/components/journey/look";
import type { CommunityItem, CommunityKind, CommunityRead } from "@shared/communityReview";
import type { NowAnswer, NowRight } from "@shared/governanceNow";

const KIND: Record<CommunityKind, { what: MessageDescriptor; door: MessageDescriptor }> = {
  vote: { what: msg({ context: "governance now: kind", message: "Village vote" }), door: msg({ context: "governance now: door", message: "Vote" }) },
  change: { what: msg({ context: "governance now: kind", message: "Change request" }), door: msg({ context: "governance now: door", message: "Take part" }) },
  hand: { what: msg({ context: "governance now: kind", message: "Raised hand" }), door: msg({ context: "governance now: door", message: "Answer" }) },
  tension: { what: msg({ context: "governance now: kind", message: "A tension for your role" }), door: msg({ context: "governance now: door", message: "Answer it" }) },
  task: { what: msg({ context: "governance now: kind", message: "Done work for your role to accept" }), door: msg({ context: "governance now: door", message: "Accept it" }) },
};

/** A stage the page knows, as words. Anything else shows nothing, never the raw word. */
const STATE: Record<string, MessageDescriptor> = {
  running: msg({ context: "governance now: stage", message: "Voting now" }),
  voting: msg({ context: "governance now: stage", message: "In a vote" }),
  in_review: msg({ context: "governance now: stage", message: "Being read" }),
  open: msg({ context: "governance now: stage", message: "Open" }),
  draft: msg({ context: "governance now: stage", message: "Sent" }),
  accepted: msg({ context: "governance now: stage", message: "Accepted" }),
  declined: msg({ context: "governance now: stage", message: "Not taken up" }),
  withdrawn: msg({ context: "governance now: stage", message: "Withdrawn" }),
};

const RIGHT: Record<NowRight, MessageDescriptor> = {
  "ballot.vote": msg({ context: "governance now: your voice, a right", message: "Vote on village decisions" }),
  "mechanics.propose": msg({ context: "governance now: your voice, a right", message: "Propose a change to the village's rules" }),
  "proposal.open": msg({ context: "governance now: your voice, a right", message: "Open a village vote yourself" }),
};

const READ_NAME: Record<CommunityRead, MessageDescriptor> = {
  ballots: msg({ context: "governance now: a read", message: "votes" }),
  changes: msg({ context: "governance now: a read", message: "change requests" }),
  hands: msg({ context: "governance now: a read", message: "raised hands" }),
  waiting: msg({ context: "governance now: a read", message: "what waits on your role" }),
};

const HOUR = 3_600_000;

export function NowRow({ item, now, closingSoon }: { item: CommunityItem; now: Date; closingSoon: boolean }) {
  const { i18n } = useLingui();
  const k = KIND[item.kind];
  const stage = item.state && STATE[item.state] ? i18n._(STATE[item.state]) : null;
  const closes = item.closesAt ? new Date(item.closesAt) : null;
  const hours = closes ? Math.max(0, Math.round((closes.getTime() - now.getTime()) / HOUR)) : null;
  const day = closes ? i18n.date(closes, { day: "numeric", month: "short" }) : null;
  return (
    <li className={`${QUIET} flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between`} data-testid={`now-${item.kind}-${item.id}`}>
      <div className="min-w-0 space-y-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className={CHIP_SOFT}>{i18n._(k.what)}</span>
          {stage ? <span className={HINT}>{stage}</span> : null}
        </p>
        <p className="text-base text-foreground">{item.title}</p>
        {closes ? (
          <p className={closingSoon ? "text-sm font-semibold text-notice" : HINT}>
            {closingSoon && hours !== null ? (
              <Plural context="governance now: closes" value={hours} one="Closes within the hour" other="Closes in # hours" />
            ) : (
              <Trans context="governance now: closes">Closes {day}</Trans>
            )}
          </p>
        ) : null}
      </div>
      <Link href={item.href} className={`${DOOR} shrink-0 self-start whitespace-nowrap`}>
        {i18n._(k.door)}
      </Link>
    </li>
  );
}

export function VoicePanel({ voice, stageName }: { voice: NowAnswer["voice"]; stageName: (id: string) => string }) {
  const { i18n } = useLingui();
  const token = voice.weighedBy ?? "";
  return (
    <section className={`${CARD_FEATURED} space-y-4`} aria-labelledby="your-voice" data-testid="your-voice">
      <p id="your-voice" className={EYEBROW}>
        <Trans context="governance now: your voice">Your voice</Trans>
      </p>
      {voice.mode === "equal" ? (
        <>
          <p className={STATEMENT}>
            <Trans context="governance now: your voice">Your vote counts 1 on every village vote.</Trans>
          </p>
          <p className={NOTE}>
            <Trans context="governance now: your voice">The village decides one person, one vote. Changing that takes a village vote where almost everyone takes part and agrees.</Trans>
          </p>
        </>
      ) : voice.mode === "token" ? (
        <>
          <p className={STATEMENT}>
            <Trans context="governance now: your voice">Your vote counts your {token} balance when each vote opens.</Trans>
          </p>
          <p className={NOTE}>
            <Trans context="governance now: your voice">It is fixed for that vote, and each vote shows what yours counts. Changing how votes are weighed takes a village vote where almost everyone takes part and agrees.</Trans>
          </p>
        </>
      ) : (
        <>
          <p className={STATEMENT}>
            <Trans context="governance now: your voice">Your vote counts what the village's weight table says.</Trans>
          </p>
          <p className={NOTE}>
            <Trans context="governance now: your voice">Each change to the table is written down with its reason, and each vote shows what yours counts.</Trans>
          </p>
        </>
      )}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">
          <Trans context="governance now: your voice">What you can do</Trans>
        </p>
        <ul className="space-y-2" data-testid="your-rights">
          {voice.rights.map((r) => (
            <li key={r.right} className="flex gap-2 text-base">
              <span aria-hidden="true" className={r.held ? "text-open" : "text-muted-foreground"}>
                {r.held ? "✓" : "○"}
              </span>
              <span className={r.held ? "text-foreground" : "text-muted-foreground"}>
                {i18n._(RIGHT[r.right])}
                {!r.held ? (
                  <span className={`block ${HINT}`}>
                    {r.opensAt ? (
                      <Trans context="governance now: your voice, a right not yet held">Opens at {stageName(r.opensAt)}.</Trans>
                    ) : (
                      <Trans context="governance now: your voice, a right not yet held">Given by a role or a badge.</Trans>
                    )}
                  </span>
                ) : (
                  <span className="sr-only">
                    {" "}
                    <Trans context="governance now: your voice, a right">(you can)</Trans>
                  </span>
                )}
              </span>
            </li>
          ))}
          <li className="flex gap-2 text-base">
            <span aria-hidden="true" className="text-open">✓</span>
            <span className="text-foreground">
              <Trans context="governance now: your voice, a right">Raise a tension with any role</Trans>
            </span>
          </li>
          <li className="flex gap-2 text-base">
            <span aria-hidden="true" className="text-open">✓</span>
            <span className="text-foreground">
              <Trans context="governance now: your voice, a right">Raise your hand to hold a power</Trans>
            </span>
          </li>
        </ul>
      </div>
      <p className={HINT}>
        <Trans context="governance now: your voice">Your vote is yours. It is never bought, sold or traded.</Trans>
      </p>
    </section>
  );
}

export default function NowView({ answer, now, stageName, onRetry }: { answer: NowAnswer; now: Date; stageName: (id: string) => string; onRetry: () => void }) {
  const { i18n } = useLingui();
  const soon = new Set(answer.closingSoon.map((i) => `${i.kind}:${i.id}`));
  const failed = answer.reads.filter((r) => r.state === "failed").map((r) => i18n._(READ_NAME[r.name]));
  const failedNames = failed.join(", ");
  const n = answer.waiting.length;
  const s = answer.closingSoon.length;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start" data-testid="governance-now">
      <div className="min-w-0 space-y-6">
        {failed.length ? (
          <div className={`${QUIET} space-y-2`} role="alert">
            <p className="text-base text-foreground">
              <Trans context="governance now">Some of this did not load: {failedNames}. Something may be waiting there.</Trans>
            </p>
            <button type="button" className={BTN_SECONDARY} onClick={onRetry}>
              <Trans context="governance now">Try again</Trans>
            </button>
          </div>
        ) : null}

        <section className={`${CARD} space-y-4`} aria-labelledby="now-waiting">
          <h2 id="now-waiting" className={H2}>
            <Plural context="governance now: heading" value={n} _0="Waiting for your voice" one="Waiting for your voice · #" other="Waiting for your voice · #" />
          </h2>
          {s ? (
            <p className="text-sm font-semibold text-notice" data-testid="closing-soon">
              <Plural context="governance now" value={s} one="One closes within two days." other="# close within two days." />
            </p>
          ) : null}
          {n ? (
            <ul className="space-y-2">
              {answer.waiting.map((it) => (
                <NowRow key={`${it.kind}:${it.id}`} item={it} now={now} closingSoon={soon.has(`${it.kind}:${it.id}`)} />
              ))}
            </ul>
          ) : (
            <p className={NOTE}>
              <Trans context="governance now">Nothing is waiting for your voice right now.</Trans>
            </p>
          )}
        </section>

        <section className={`${CARD} space-y-4`} aria-labelledby="now-yours">
          <h2 id="now-yours" className={H2}>
            <Trans context="governance now: heading">What you brought</Trans>
          </h2>
          {answer.yours.length ? (
            <ul className="space-y-2">
              {answer.yours.map((it) => (
                <NowRow key={`${it.kind}:${it.id}`} item={it} now={now} closingSoon={false} />
              ))}
            </ul>
          ) : (
            <p className={NOTE}>
              <Trans context="governance now">Nothing yet. A change request or a raised hand you bring shows here, with where it stands.</Trans>
            </p>
          )}
          <p className={HINT}>
            <Link href="/propose" className={LINK}>
              <Trans context="governance now">Make a proposal</Trans>
            </Link>
          </p>
        </section>
      </div>
      <VoicePanel voice={answer.voice} stageName={stageName} />
    </div>
  );
}
