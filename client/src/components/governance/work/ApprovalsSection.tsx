/**
 * YOUR WORK'S APPROVALS SECTION (the lead, 27 Nov 2026: "/approvals becomes a view of Your work"), at
 * `/governance/work#approvals`. /approvals redirects here.
 *
 * What a connector proposed and only a person may do: one tap each, run as the person pressing it, through that
 * thing's own route and its gates. It also holds the connector's role changes and seatings, which a second card on
 * this page used to list again (one item, listed once: #1820).
 *
 * `useApprovalsKey` asks first whether this person holds a key that opens the inbox (`APPROVAL_INBOX_READERS`, the
 * route's own list), so a member who holds none makes no request the route would only refuse. A person the inbox
 * refuses sees no section, the way every section of Your work follows its own key; the page refuses as a whole only
 * when every read did. Nothing about who may approve moved: the route decides, as the person.
 */
import { useEffect, useState } from "react";
import { Trans } from "@lingui/react/macro";
import ApprovalInbox, { type InboxRead } from "@/components/approvals/ApprovalInbox";
import { CARD, CHIP, EYEBROW, H2 } from "@/components/journey/look";
import { authToken } from "@/lib/gameApi";
import { mayAsk } from "@/lib/myCapabilities";
import { APPROVAL_INBOX_READERS } from "@shared/approvalInbox";

export interface ApprovalsKey {
  /** Holds a key that opens the inbox; null while that is being asked. */
  open: boolean | null;
  /** What the inbox's own read found, once it has read. */
  read: InboxRead | null;
  setRead: (r: InboxRead) => void;
  /** Closed to this person: no key, or the route refused. */
  shut: boolean;
  /** How many wait, once the read answered. */
  waiting: number;
}

export function useApprovalsKey(userId: unknown): ApprovalsKey {
  const [open, setOpen] = useState<boolean | null>(null);
  const [read, setRead] = useState<InboxRead | null>(null);
  useEffect(() => {
    let live = true;
    if (!authToken()) {
      setOpen(false);
      return;
    }
    void mayAsk(...APPROVAL_INBOX_READERS).then((may) => {
      if (live) setOpen(may);
    });
    return () => {
      live = false;
    };
  }, [userId]);
  return { open, read, setRead, shut: open === false || read?.state === "refused", waiting: read?.state === "ok" ? read.waiting : 0 };
}

export default function ApprovalsSection({ approvals, headers }: { approvals: ApprovalsKey; headers: () => Record<string, string> }) {
  if (!approvals.open) return null;
  return (
    <section id="approvals" aria-labelledby="approvals-heading" className={`${CARD} scroll-mt-24 space-y-4 p-5 sm:p-6`} hidden={approvals.shut}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className={EYEBROW}>
            <Trans context="your work: approvals, eyebrow">One tap, as you</Trans>
          </p>
          <h2 id="approvals-heading" className={`${H2} mt-1`}>
            <Trans context="your work: approvals, heading">Approvals</Trans>
          </h2>
        </div>
        {approvals.waiting > 0 ? (
          <span className={CHIP} data-testid="approvals-count">
            <Trans context="your work: approvals, how many wait">{approvals.waiting} waiting</Trans>
          </span>
        ) : null}
      </div>
      <ApprovalInbox headers={headers} hideRefused onRead={approvals.setRead} />
    </section>
  );
}
