/**
 * WHAT YOU ASKED OF A ROLE, on the profile (shared/priorities.ts). Each
 * tension the member raised with a role that nobody has answered yet: whether
 * a holder has taken it, and once one has, where it sits on the role's list
 * and the week they expect to pick it up. Plain words, no countdown and no
 * "late": the point is that nobody has to chase.
 *
 * Draws nothing when the member has no ask waiting, or the read is closed.
 */
import { useEffect, useId, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { RAISED_ASKS_API, readRaisedAsks, type RaisedAsk } from "@shared/priorities";
import { gameFetch } from "@/lib/gameApi";
import { CARD, EYEBROW, H2, HINT, TILE } from "@/components/journey/look";
import { dayWords } from "./priorityWords";

/** Where one ask sits, in plain words. */
function AskWhere({ ask }: { ask: RaisedAsk }) {
  const { t } = useLingui();
  const p = ask.place;
  const out: string[] = [];
  if (ask.status === "open") out.push(t`Waiting for a holder of the role to take it.`);
  else {
    if (p?.position != null) out.push(t`Number ${p.position} on the role's list.`);
    if (p?.expectWeek) out.push(t`Expected around the week of ${dayWords(p.expectWeek)}.`);
    if (!out.length) out.push(t`Taken. The holder has not said where it sits yet.`);
  }
  return <p className="mt-2 text-sm font-medium text-foreground">{out.join(" ")}</p>;
}

export default function RaisedAsksCard() {
  const { t } = useLingui();
  const [asks, setAsks] = useState<RaisedAsk[]>([]);
  const headingId = useId();

  useEffect(() => {
    let alive = true;
    gameFetch(RAISED_ASKS_API)
      .then(async (res) => (res.ok ? readRaisedAsks(((await res.json()) as { asks?: unknown }).asks) : []))
      .then((list) => alive && setAsks(list))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  if (!asks.length) return null;
  return (
    <section aria-labelledby={headingId} className={CARD} data-raised-asks>
      <p className={EYEBROW}>{t`Asked of a role`}</p>
      <h2 id={headingId} className={`mt-1 ${H2}`}>
        {t`Where your asks sit`}
      </h2>
      <ul className="mt-4 space-y-3">
        {asks.map((a) => (
          <li key={a.id} className={TILE} data-ask={a.id}>
            <p className="whitespace-pre-line break-words font-semibold leading-snug text-foreground">{a.text}</p>
            <p className={`${HINT} mt-0.5`}>{[a.role, a.circle, t({ message: `Raised ${dayWords(a.raisedOn)}`, context: "an ask raised with a role, the day it was raised" })].filter(Boolean).join(" · ")}</p>
            <AskWhere ask={a} />
          </li>
        ))}
      </ul>
    </section>
  );
}
