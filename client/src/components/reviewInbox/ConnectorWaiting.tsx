/**
 * The connector's waiting changes, decided on /admin/review (lane 4b): each change on its own card, decided here as
 * on /admin/proposals, and every set of changes that write the same thing gathered into one conflict card.
 */
import { useMemo } from "react";
import { CHIP_SOFT, H2 } from "@/components/journey/look";
import ChangeCard from "@/components/proposals/ChangeCard";
import type { Proposal } from "@/components/proposals/reviewTypes";
import { conflictGroups, oldestFirst, waitingConflicts, type ConflictInput } from "@shared/proposalConflicts";
import ConflictCard from "./ConflictCard";
import type { ConnectorDesk } from "./useConnectorDesk";

type Slot = { kind: "one"; change: Proposal } | { kind: "choose"; options: Proposal[] };

export default function ConnectorWaiting({ desk, title, count, found }: { desk: ConnectorDesk; title: string; count: number; found: ReadonlySet<string> }) {
  const { slots, links } = useMemo(() => {
    const list = [...desk.changes].sort(oldestFirst);
    // What each would be accepted with: the person's saved edits when there are any, as the server reads it.
    const inputs: ConflictInput[] = list.map((c) => ({ id: c.id, at: c.at, position: c.position, kind: c.kind, target: c.target, route: c.route, body: desk.edits[c.id] ?? c.body, summary: c.summary }));
    const groups = conflictGroups(inputs);
    const inGroup = new Map<string, string[]>();
    for (const g of groups) for (const id of g) inGroup.set(id, g);
    const byId = new Map(list.map((c) => [c.id, c]));
    const placed = new Set<string>();
    const out: Slot[] = [];
    // A conflict card sits where its oldest option would have been.
    for (const c of list) {
      if (placed.has(c.id)) continue;
      const g = inGroup.get(c.id);
      if (!g) {
        out.push({ kind: "one", change: c });
        placed.add(c.id);
        continue;
      }
      out.push({ kind: "choose", options: g.map((id) => byId.get(id)!).filter(Boolean) });
      for (const id of g) placed.add(id);
    }
    return { slots: out, links: waitingConflicts(inputs) };
  }, [desk.changes, desk.edits]);

  if (!slots.length) return null;
  return (
    <section className="space-y-3" aria-labelledby="review-connector">
      <h2 id="review-connector" className={`${H2} flex items-baseline gap-3`}>
        {title}
        {" "}
        <span className={CHIP_SOFT}>{count}</span>
      </h2>
      {desk.notice ? (
        <p className="text-sm text-foreground" role="status" data-testid="decide-notice">
          {desk.notice}
        </p>
      ) : null}
      <div className="space-y-4">
        {slots.map((s) =>
          s.kind === "choose" ? (
            <ConflictCard key={`choose-${s.options[0]!.id}`} options={s.options} links={links} desk={desk} />
          ) : (
            <ChangeCard
              key={s.change.id}
              change={s.change}
              found={found.has(s.change.id)}
              body={desk.edits[s.change.id] ?? s.change.body}
              zone={desk.zone}
              problems={desk.problems[s.change.id] ?? []}
              saved={desk.saved[s.change.id]}
              busy={desk.busy}
              checkedPage={!!desk.checkedPage[s.change.id]}
              onCheckedPage={(v) => desk.setCheckedPage((p) => ({ ...p, [s.change.id]: v }))}
              onEdit={(path, next) => desk.edit(s.change.id, path, next)}
              onAccept={() => void desk.accept(s.change)}
              onDiscard={() => void desk.discard([s.change.id])}
              seenLive={desk.seenNow(s.change)}
              onSeeLive={() => void desk.seeLive(s.change.id)}
            />
          ),
        )}
      </div>
    </section>
  );
}
