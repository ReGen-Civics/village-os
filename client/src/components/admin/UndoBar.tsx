/**
 * Undo sits at the bottom, near the thumb, until the wait ends.
 *
 * Every surface that calls `holdUndo` mounts this bar, or the action waits its
 * ten seconds with nothing on screen to stop it (undoBarMounts.test.ts holds
 * every caller to a mount). Admin draws it in place. A page outside Admin
 * passes `world`: the bar is then drawn at the end of <body>, inside an
 * element carrying that world's class, so a tab the page hides or an ancestor
 * that moves cannot take the bar with it, and it keeps the page's colours.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cancelUndo, pendingUndoLabel, subscribeUndo } from "./adminUndo";
import { Trans } from "@lingui/react/macro";

export default function UndoBar({ world }: { world?: string }) {
  const [label, setLabel] = useState<string | null>(() => pendingUndoLabel());
  useEffect(() => subscribeUndo(() => setLabel(pendingUndoLabel())), []);
  if (!label) return null;
  const bar = (
    <div className="fixed inset-x-0 bottom-16 z-50 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:bottom-4" data-undo-bar="">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2 text-card-foreground shadow-sm motion-reduce:transition-none">
        <p className="text-sm"><Trans context="UndoBar, p">{label} You have 10 seconds.</Trans></p>
        <button type="button" onClick={cancelUndo} className="inline-flex min-h-[44px] items-center rounded-lg bg-teal-deep px-4 text-sm font-medium text-white">
          <Trans context="UndoBar, button">Undo
        </Trans></button>
      </div>
    </div>
  );
  return world === undefined ? bar : createPortal(<div className={world}>{bar}</div>, document.body);
}
