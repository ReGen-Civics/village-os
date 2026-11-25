/**
 * HELD (docs/REVIEW_INBOX_PLAN.md, lane 4b; the lead, 25 Nov 2026: held items stay until a person clears them, with
 * their age showing). What the engine held back, grouped by its fixed reason, each with what would let it through and
 * how long it has waited. A reason is a code with fields, never a filer's words.
 */
import { useState } from "react";
import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import { Plural, Trans, useLingui } from "@lingui/react/macro";
import { BTN_SECONDARY, H2, HINT, QUIET } from "@/components/journey/look";
import { HELD_CODES, type HeldCode } from "@shared/suggestionPipeline/engine";
import type { ConnectorDesk, HeldItem } from "./useConnectorDesk";

/** Why it is held and what lets it through, one sentence each. Fields fill the braces. */
const WHY: Record<HeldCode, MessageDescriptor> = {
  over_cap: msg({ context: "review inbox: held", message: "More than {limit} came from one sender today. It is read again tomorrow." }),
  mixed_script: msg({ context: "review inbox: held", message: "A name mixes letters from more than one alphabet, which can hide a lookalike. A person checks it." }),
  already_live: msg({ context: "review inbox: held", message: "What it asks for is already live." }),
  target_gone: msg({ context: "review inbox: held", message: "What it changes is no longer there." }),
  under_vote: msg({ context: "review inbox: held", message: "A vote covers this. It is read again when the vote closes." }),
  decided_since: msg({ context: "review inbox: held", message: "{decision} decided this after it arrived." }),
  reconsider_waits: msg({ context: "review inbox: held", message: "Sent again after {discarded} was discarded, with a reason. Let it through to be read, or clear it." }),
  recently_discarded: msg({ context: "review inbox: held", message: "The same was discarded recently as {discarded}." }),
  too_many_options: msg({ context: "review inbox: held", message: "There are already {limit} options for this thing." }),
  needs_missing: msg({ context: "review inbox: held", message: "It needs something that does not exist yet." }),
  waits_on_held: msg({ context: "review inbox: held", message: "It needs something that is itself held." }),
  order_cycle: msg({ context: "review inbox: held", message: "It and another suggestion each need the other first." }),
};

const UNKNOWN = msg({ context: "review inbox: held", message: "Held for a reason this page does not know yet." });

const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86_400_000));

function HeldRow({ item, desk }: { item: HeldItem; desk: ConnectorDesk }) {
  const { i18n } = useLingui();
  const f = item.fields;
  const why = i18n._({ ...(item.code && item.code in WHY ? WHY[item.code] : UNKNOWN), values: { limit: f.limit ?? "", decision: f.decision ?? "", discarded: f.discarded ?? "" } });
  const [said, setSaid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const days = daysSince(item.receivedAt);
  const act = async (a: "release" | "clear") => {
    setBusy(true);
    setSaid(await desk.actOnHeld(item.id, a));
    setBusy(false);
  };
  return (
    <li className={`${QUIET} space-y-2`} data-testid={`held-${item.id}`}>
      <p className="text-base text-foreground">{item.where.label}</p>
      <p className="text-sm text-foreground">{why}</p>
      <p className={HINT}>
        {item.filerKind === "member" ? <Trans context="review inbox: held">From a member</Trans> : <Trans context="review inbox: held">From an agent</Trans>}
        {" · "}
        <Plural context="review inbox: held" value={days} _0="Arrived today" one="Waiting # day" other="Waiting # days" />
        {item.released ? (
          <>
            {" · "}
            <Trans context="review inbox: held">Let through to be read</Trans>
          </>
        ) : null}
      </p>
      <div className="flex flex-wrap gap-2">
        {item.code === "reconsider_waits" && !item.released ? (
          <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={() => void act("release")} data-testid={`held-release-${item.id}`}>
            <Trans context="review inbox: held">Let it through</Trans>
          </button>
        ) : null}
        <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={() => void act("clear")} data-testid={`held-clear-${item.id}`}>
          <Trans context="review inbox: held">Clear it</Trans>
        </button>
      </div>
      {said ? (
        <p role="alert" className="text-sm text-destructive">
          {said}
        </p>
      ) : null}
    </li>
  );
}

/** Where a reason sorts: the engine's own order, an unknown reason last. */
const rank = (code: HeldCode | null) => {
  const i = code ? HELD_CODES.indexOf(code) : -1;
  return i < 0 ? HELD_CODES.length : i;
};

export default function HeldList({ desk }: { desk: ConnectorDesk }) {
  if (desk.heldState === "loading") return null;
  if (desk.heldState === "failed")
    return (
      <p className={HINT} role="alert">
        <Trans context="review inbox: held">Held did not load. Suggestions may be waiting there.</Trans>
      </p>
    );
  if (desk.heldState === "refused" || !desk.held.length)
    return (
      <p className={HINT}>
        <Trans context="review inbox: held">Nothing is held. When a suggestion is held back, it waits here until a person clears it.</Trans>
      </p>
    );
  // Grouped by reason, oldest first inside each: the server sends them oldest first, and the sort keeps that order.
  const items = [...desk.held].sort((a, b) => rank(a.code) - rank(b.code));
  return (
    <section className="space-y-3" aria-labelledby="held-heading">
      <h2 id="held-heading" className={H2}>
        <Trans context="review inbox: held">Held back, waiting on a person</Trans>
      </h2>
      <ul className="space-y-2">
        {items.map((item) => (
          <HeldRow key={item.id} item={item} desk={desk} />
        ))}
      </ul>
    </section>
  );
}
