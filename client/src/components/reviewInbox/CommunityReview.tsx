/**
 * THE COMMUNITY FACE OF /review (docs/REVIEW_INBOX_PLAN.md, lane 6): what is open for a member's voice, what waits on a
 * role they hold, and what they sent, each with the door to where they take part.
 *
 * Read from `GET /api/review/community`, the members' own projection (shared/communityReview.ts), never the deciders'
 * payload: each item is a kind, a public title, a stage, when it closes and a door. Nothing is decided on this face;
 * it is an index of doors. Signed out it lists nothing and offers the sign-in; a visitor is told it is for members.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import { Trans, useLingui } from "@lingui/react/macro";
import { BTN_SECONDARY, CHIP_SOFT, DOOR, H2, HINT, LINK, QUIET } from "@/components/journey/look";
import { authToken } from "@/lib/gameApi";
import type { CommunityAnswer, CommunityItem, CommunityKind, CommunityRead } from "@shared/communityReview";

type Load = { phase: "loading" } | { phase: "signedOut" } | { phase: "notMember" } | { phase: "failed" } | { phase: "ready"; answer: CommunityAnswer };

const KIND: Record<CommunityKind, { what: MessageDescriptor; door: MessageDescriptor }> = {
  vote: { what: msg({ context: "review, community: kind", message: "A vote" }), door: msg({ context: "review, community: door", message: "Vote" }) },
  change: { what: msg({ context: "review, community: kind", message: "A change request" }), door: msg({ context: "review, community: door", message: "Take part" }) },
  hand: { what: msg({ context: "review, community: kind", message: "A member asks to hold a power" }), door: msg({ context: "review, community: door", message: "Answer" }) },
  tension: { what: msg({ context: "review, community: kind", message: "A tension raised with your role" }), door: msg({ context: "review, community: door", message: "Answer it" }) },
  task: { what: msg({ context: "review, community: kind", message: "Done work for your role to accept" }), door: msg({ context: "review, community: door", message: "Accept it" }) },
};

/** The stages a member reads, as words. A stage the page does not know shows nothing, never the raw word. */
const STATE: Record<string, MessageDescriptor> = {
  running: msg({ context: "review, community: stage", message: "Voting now" }),
  voting: msg({ context: "review, community: stage", message: "In a vote" }),
  in_review: msg({ context: "review, community: stage", message: "Being read" }),
  gathering: msg({ context: "review, community: stage", message: "Gathering views" }),
  draft: msg({ context: "review, community: stage", message: "Sent" }),
  open: msg({ context: "review, community: stage", message: "Open" }),
  accepted: msg({ context: "review, community: stage", message: "Accepted" }),
  adopted: msg({ context: "review, community: stage", message: "Accepted" }),
  carried: msg({ context: "review, community: stage", message: "Accepted" }),
  declined: msg({ context: "review, community: stage", message: "Not taken up" }),
  withdrawn: msg({ context: "review, community: stage", message: "Withdrawn" }),
  granted: msg({ context: "review, community: stage", message: "Granted" }),
};

const READ_NAME: Record<CommunityRead, MessageDescriptor> = {
  ballots: msg({ context: "review, community: a read", message: "votes" }),
  changes: msg({ context: "review, community: a read", message: "change requests" }),
  hands: msg({ context: "review, community: a read", message: "raised hands" }),
  waiting: msg({ context: "review, community: a read", message: "what waits on your role" }),
};

function headers(): Record<string, string> {
  const t = authToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export default function CommunityReview({ decides = false }: { decides?: boolean }) {
  const { i18n } = useLingui();
  const [load, setLoad] = useState<Load>({ phase: "loading" });

  const read = useCallback(async () => {
    // Signed out, the route would answer 401: say so without the round trip, as the deciders' read does.
    if (!authToken()) return setLoad({ phase: "signedOut" });
    setLoad({ phase: "loading" });
    try {
      const r = await fetch("/api/review/community", { headers: headers() });
      if (r.status === 401) return setLoad({ phase: "signedOut" });
      if (r.status === 403) return setLoad({ phase: "notMember" });
      if (!r.ok) return setLoad({ phase: "failed" });
      const body = (await r.json()) as CommunityAnswer;
      if (!Array.isArray(body?.open) || !Array.isArray(body?.yours) || !Array.isArray(body?.waiting)) return setLoad({ phase: "failed" });
      setLoad({ phase: "ready", answer: body });
    } catch {
      setLoad({ phase: "failed" });
    }
  }, []);
  useEffect(() => {
    void read();
  }, [read]);

  const day = (iso: string | null) => (iso ? i18n.date(new Date(iso), { day: "numeric", month: "short" }) : null);

  const row = (it: CommunityItem) => {
    const k = KIND[it.kind];
    const stage = it.state && STATE[it.state] ? i18n._(STATE[it.state]) : null;
    const closes = day(it.closesAt);
    return (
      <li key={`${it.kind}:${it.id}`} className={`${QUIET} flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between`} data-testid={`community-${it.kind}-${it.id}`}>
        <div className="min-w-0 space-y-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className={CHIP_SOFT}>{i18n._(k.what)}</span>
            {stage ? <span className={HINT}>{stage}</span> : null}
          </p>
          <p className="text-base text-foreground">{it.title}</p>
          {closes ? (
            <p className={HINT}>
              <Trans context="review, community">Closes {closes}</Trans>
            </p>
          ) : null}
        </div>
        <Link href={it.href} className={`${DOOR} shrink-0 self-start whitespace-nowrap`}>
          {i18n._(k.door)}
        </Link>
      </li>
    );
  };

  if (load.phase === "loading")
    return (
      <p className={HINT}>
        <Trans context="review, community">Reading what is open for your voice.</Trans>
      </p>
    );
  if (load.phase === "signedOut")
    return (
      <p className={HINT} data-testid="community-signed-out">
        <Trans context="review, community">This page is for members of the village.</Trans>{" "}
        <Link href="/login" className={LINK}>
          <Trans context="review, community">Sign in to see it</Trans>
        </Link>
      </p>
    );
  if (load.phase === "notMember")
    return (
      <p className={HINT} data-testid="community-not-member">
        <Trans context="review, community">This page is for members of the village. Once you are a member, what is open for your voice shows here.</Trans>
      </p>
    );
  if (load.phase === "failed")
    return (
      <div className={`${QUIET} space-y-2`} role="alert">
        <p className="text-base text-foreground">
          <Trans context="review, community">This did not load. Something may be open for your voice.</Trans>
        </p>
        <button type="button" className={BTN_SECONDARY} onClick={() => void read()}>
          <Trans context="review, community">Try again</Trans>
        </button>
      </div>
    );

  const { open, waiting, yours, reads } = load.answer;
  const failed = reads.filter((r) => r.state === "failed").map((r) => i18n._(READ_NAME[r.name]));
  const failedNames = failed.join(", ");
  return (
    <div className="space-y-8" data-testid="community-review">
      {failed.length ? (
        <div className={`${QUIET} space-y-2`} role="alert">
          <p className="text-base text-foreground">
            <Trans context="review, community">Some of this did not load: {failedNames}. Something may be waiting there.</Trans>
          </p>
          <button type="button" className={BTN_SECONDARY} onClick={() => void read()}>
            <Trans context="review, community">Try again</Trans>
          </button>
        </div>
      ) : null}

      <section className="space-y-3" aria-labelledby="community-open">
        <h2 id="community-open" className={H2}>
          <Trans context="review, community: heading">Open for your voice</Trans>
        </h2>
        {open.length ? (
          <ul className="space-y-2">{open.map(row)}</ul>
        ) : (
          <p className={HINT}>
            <Trans context="review, community">Nothing is open for your voice right now.</Trans>
          </p>
        )}
      </section>

      {waiting.length ? (
        <section className="space-y-3" aria-labelledby="community-waiting">
          <h2 id="community-waiting" className={H2}>
            <Trans context="review, community: heading">Waiting on your role</Trans>
          </h2>
          <ul className="space-y-2">{waiting.map(row)}</ul>
        </section>
      ) : null}

      <section className="space-y-3" aria-labelledby="community-yours">
        <h2 id="community-yours" className={H2}>
          <Trans context="review, community: heading">What you sent</Trans>
        </h2>
        {yours.length ? (
          <ul className="space-y-2">{yours.map(row)}</ul>
        ) : (
          <p className={HINT}>
            <Trans context="review, community">You have not sent anything yet. A change request or a raised hand you send shows here, with where it stands.</Trans>
          </p>
        )}
      </section>

      {decides ? (
        <p className={HINT} data-testid="community-decider-door">
          <Trans context="review, community">You also decide some of what waits on the village.</Trans>{" "}
          <Link href="/review" className={LINK}>
            <Trans context="review, community">Back to what you decide</Trans>
          </Link>
        </p>
      ) : null}
    </div>
  );
}
