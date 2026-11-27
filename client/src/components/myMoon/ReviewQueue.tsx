/**
 * MOON REVIEWS, the work approvers' queue on the profile's Roles tab.
 *
 * It reads `GET /api/moon-review/queue`, which asks the server's one gate
 * (`moon.approve`, or the keys `approvalDecision` reads). A member who holds
 * none of them gets a refusal and this draws nothing: nothing here decides
 * who may approve.
 *
 * Each recap shows who sent it, then its roles with their item counts, items
 * outside their roles, and who can approve. It never shows the member's task
 * score, its band ("Rethink the plan") or their role coverage: those are the
 * member's own reading, and the people approving their pay do not see them
 * (Phase C, decision 2). The server no longer sends them on a queue row. Opening one lists its items with Approve or Return with a
 * note each, then Approve the work. The queue row carries no items or hash in
 * the contract yet (see moonApi.ts); until it does, the recap is returned
 * whole with a note and the page says where its items are read.
 */
import { useCallback, useEffect, useState } from "react";
import {
  dayWords,
} from "@shared/moonRecap";
import * as api from "./moonApi";
import type { QueueData, QueueRowView } from "./moonApi";
import { ERROR, H2, INPUT, KICKER, LABEL, MUTED, PANEL, SMALL_BTN, SMALL_BTN_ON } from "./moonUi";
import { useMoonWords } from "@/components/myMoon/moonWords";
import type { QueueLook } from "@/components/treasury/deskLooks";

/** My Moon's look, the queue's own: Governance's Treasury hands in the sheet's (QUEUE_SHEET, deskLooks.ts). */
export const MOON_QUEUE: QueueLook = {
  section: `${PANEL} flex flex-col gap-4 p-4 sm:p-6`,
  headingTag: "h2",
  heading: H2,
  row: "flex flex-col gap-3 rounded-[14px] border border-dash-edge bg-card p-3",
  item: "flex flex-col gap-2 rounded-lg border border-border p-2",
  toggle: `${SMALL_BTN} self-start`,
  choiceOn: SMALL_BTN_ON,
  choiceOff: SMALL_BTN,
  returnOn: SMALL_BTN_ON,
  approveWork: SMALL_BTN_ON,
  secondary: SMALL_BTN,
  input: INPUT,
};

/** Who sent it, where it waits, and the self-approved mark. */
export function RowHead({ row }: { row: QueueRowView }) {
  const MW = useMoonWords();
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="m-0 text-base font-semibold text-foreground">{row.name}</h4>
        <span className="text-xs text-muted-foreground">
          {row.waitingOn ? MW.queueStage[row.waitingOn] : MW.recapStatus[row.status]}
          {row.dueOn ? `, ${dayWords(row.dueOn)}` : ""}
        </span>
      </div>
      {row.selfApproved ? <p className="m-0 text-xs font-semibold text-destructive" data-testid="self-approved">{MW.selfApproved}</p> : null}
    </div>
  );
}

type ItemDecision = { review: "approved" | "returned"; note: string };

function WorkRow({ row, onDone, noEligible, look }: { row: QueueRowView; onDone: () => Promise<unknown>; noEligible: boolean; look: QueueLook }) {
  const MW = useMoonWords();
  const [open, setOpen] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, ItemDecision>>({});
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const items = (row.items ?? []).filter((i) => i.state === "kept");
  const decide = (id: string, patch: Partial<ItemDecision>) => setDecisions({ ...decisions, [id]: { review: decisions[id]?.review ?? "approved", note: decisions[id]?.note ?? "", ...patch } });

  const approve = async () => {
    if (!row.hash) return;
    setBusy(true);
    setError(null);
    const r = await api.reviewWork(row.recapId, {
      hash: row.hash,
      items: items.map((i) => ({ id: i.id, review: decisions[i.id]?.review ?? "approved", note: decisions[i.id]?.note.trim() || null })),
      note: note.trim() || null,
    });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    await onDone();
  };
  const returnIt = async () => {
    if (!note.trim()) return;
    setBusy(true);
    setError(null);
    const r = await api.returnRecap(row.recapId, { stage: "work", note: note.trim() });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    await onDone();
  };

  return (
    <li className={look.row} data-testid="queue-row">
      <RowHead row={row} />
      <ul className="m-0 list-disc pl-5 text-sm text-foreground">
        {row.roles.map((r) => <li key={r.roleId}>{r.name}: {r.itemCount}</li>)}
      </ul>
      {row.outsideMyRoles > 0 ? <p className={MUTED}>{MW.queue.outside(row.outsideMyRoles)}</p> : null}
      <p className="m-0 text-xs text-muted-foreground">{MW.queue.approvers(row.workApprovers)}</p>
      {noEligible ? <p className="m-0 text-xs text-muted-foreground">{MW.queue.noEligible}</p> : null}
      {row.waitingOn === "work" ? (
        <button type="button" className={look.toggle} aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? MW.queue.close : MW.queue.open}</button>
      ) : null}
      {open ? (
        <div className="flex flex-col gap-3">
          {row.items ? (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {items.map((i) => {
                const d = decisions[i.id];
                const returned = d?.review === "returned";
                return (
                  <li key={i.id} className={look.item}>
                    <p className="m-0 text-sm text-foreground">{i.text}</p>
                    {i.accountabilityWords ? <p className="m-0 text-xs text-muted-foreground">{i.accountabilityWords}</p> : null}
                    <div className="flex flex-wrap gap-2">
                      <button type="button" aria-pressed={!returned} className={!returned ? look.choiceOn : look.choiceOff} onClick={() => decide(i.id, { review: "approved" })}>{MW.queue.approve}</button>
                      <button type="button" aria-pressed={returned} className={returned ? look.returnOn : look.choiceOff} onClick={() => decide(i.id, { review: "returned" })}>{MW.queue.returnIt}</button>
                    </div>
                    {returned ? <input aria-label={MW.queue.note} placeholder={MW.queue.note} value={d?.note ?? ""} onChange={(e) => decide(i.id, { note: e.target.value })} className={look.input} /> : null}
                  </li>
                );
              })}
            </ul>
          ) : <p className={MUTED}>{MW.queue.noItemsInQueue}</p>}
          <label className={LABEL}>
            {MW.queue.note}
            <textarea value={note} rows={2} onChange={(e) => setNote(e.target.value)} className={look.input} />
          </label>
          <div className="flex flex-wrap gap-2">
            {row.items && row.hash ? <button type="button" className={look.approveWork} disabled={busy} onClick={approve}>{MW.queue.approveWork}</button> : null}
            <button type="button" className={look.secondary} disabled={busy || !note.trim()} onClick={returnIt}>{MW.queue.returnIt}</button>
          </div>
          {error ? <p role="alert" className={ERROR}>{error}</p> : null}
        </div>
      ) : null}
    </li>
  );
}

export function ReviewQueueView({ data, reload, look = MOON_QUEUE }: { data: QueueData; reload: () => Promise<unknown>; look?: QueueLook }) {
  const MW = useMoonWords();
  const Heading = look.headingTag;
  const noEligible = new Set(data.noEligible.map((n) => n.recapId));
  return (
    <section aria-label={MW.queue.heading} className={look.section} data-testid="moon-queue">
      <div>
        <p className={KICKER}>{data.moon.periodWords}</p>
        <Heading className={look.heading}>{MW.queue.heading}</Heading>
      </div>
      {data.rows.length === 0 ? <p className={MUTED}>{MW.queue.empty}</p> : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {data.rows.map((r) => <WorkRow key={r.recapId} row={r} onDone={reload} noEligible={noEligible.has(r.recapId)} look={look} />)}
        </ul>
      )}
      {data.rolesWithNoItems.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="m-0 text-base font-semibold text-foreground">{MW.queue.rolesWithNoItems}</h3>
          <ul className="m-0 list-disc pl-5 text-sm text-foreground">
            {data.rolesWithNoItems.map((r) => <li key={`${r.userId}:${r.roleId}`}>{r.name}</li>)}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

/** The loader. A refusal or an off module draws nothing. */
export default function ReviewQueue({ look }: { look?: QueueLook } = {}) {
  const MW = useMoonWords();
  const [data, setData] = useState<QueueData | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await api.fetchQueue(null);
    if (r.ok) {
      setData(r.data);
      setFailed(null);
    } else if (r.status >= 500 || r.status === 0) setFailed(r.error);
    else setData(null);
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (failed) return <p className={ERROR}>{failed || MW.myMoon.failed}</p>;
  if (!data) return null;
  return <ReviewQueueView data={data} reload={load} look={look} />;
}
