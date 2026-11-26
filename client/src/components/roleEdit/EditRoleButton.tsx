/**
 * THE TWO DOORS INTO THE EDITOR, drawn on the role card (/roles, the draft board
 * and the Admin org chart): "Edit this role" and "New role from a card".
 *
 * They draw nothing for a visitor or a member without the power to decide the
 * structure (`useEditAccess`), and the editor itself is a separate chunk loaded
 * only when one of these is pressed, so nobody else downloads it. The server asks
 * the same question again on every route (server/routes/roleEdit.ts).
 */
import { lazy, Suspense, useEffect, useState } from "react";
import { Link } from "wouter";
import { Plural, Trans } from "@lingui/react/macro";
import { draftPageHref } from "@shared/orgDraftView";
import { readOpenDrafts } from "./roleEditApi";
import { SECONDARY } from "@/components/roleProposal/parts";
import { useEditAccess } from "./useEditAccess";

const RoleEditor = lazy(() => import("./RoleEditor"));
const NewRoleFromCard = lazy(() => import("./NewRoleFromCard"));

/**
 * "A change is waiting" (the draft page, PR E): for whoever may edit the role, the open org drafts that change it,
 * each a link to its draft page, so nobody edits the card live while a draft of it waits unseen.
 */
function WaitingDrafts({ roleId }: { roleId: string }) {
  const [drafts, setDrafts] = useState<Array<{ id: string; title: string }>>([]);
  useEffect(() => {
    let alive = true;
    void readOpenDrafts(roleId).then((r) => {
      if (alive && r.ok) setDrafts(Array.isArray(r.data.drafts) ? r.data.drafts : []);
    });
    return () => {
      alive = false;
    };
  }, [roleId]);
  if (!drafts.length) return null;
  return (
    <div className="mt-2 text-sm text-foreground" data-testid={`role-drafts-${roleId}`}>
      <p className="font-semibold">
        <Plural context="role card: open drafts of this role" value={drafts.length} one="A change to this role is waiting:" other="# changes to this role are waiting:" />
      </p>
      <ul className="mt-1 space-y-1">
        {drafts.map((d) => (
          <li key={d.id}>
            <Link href={draftPageHref(d.id)} className="inline-flex min-h-11 items-center font-medium text-notice underline underline-offset-2">
              {d.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function EditRoleButton({ roleId, onSaved, className = "" }: { roleId: string; onSaved?: () => void; className?: string }) {
  const door = useEditAccess();
  const [open, setOpen] = useState(false);
  if (!door) return null;
  return (
    <>
      <button type="button" className={`${SECONDARY} ${className}`} onClick={() => setOpen(true)} data-edit-role={roleId}>
        <Trans context="role card, opens the role editor">Edit this role</Trans>
      </button>
      <WaitingDrafts roleId={roleId} />
      {open && (
        <Suspense fallback={null}>
          <RoleEditor roleId={roleId} onClose={() => setOpen(false)} onSaved={onSaved} />
        </Suspense>
      )}
    </>
  );
}

export function NewRoleFromCardButton({ onMade, className = "" }: { onMade?: (roleId: string) => void; className?: string }) {
  const door = useEditAccess();
  const [open, setOpen] = useState(false);
  if (!door) return null;
  return (
    <>
      <button type="button" className={`${SECONDARY} ${className}`} onClick={() => setOpen(true)}>
        <Trans context="role lists, opens the new role from a card dialog">New role from a card</Trans>
      </button>
      {open && (
        <Suspense fallback={null}>
          <NewRoleFromCard onClose={() => setOpen(false)} onMade={onMade} />
        </Suspense>
      )}
    </>
  );
}
