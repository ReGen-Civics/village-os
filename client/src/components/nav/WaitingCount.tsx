/**
 * WAITING-ON-YOU DOTS (27 Nov 2026, the lead's "do first" list): a small count on the Govern group, on the account
 * menu's button and on its "Waiting on you" row, when something there waits on the reader (a vote, an approval, a
 * review). The menu then says where to go next.
 *
 * ONE CHEAP READ, SHARED. Every dot reads the same answer: GET /api/admin/review/inbox, the reader's own read of
 * every queue (server/routes/reviewInbox.ts), so a dot never shows more than the queue's own page would. It is read
 * once, kept for two minutes, and read again when the window comes back into focus after a minute away. The answer is
 * kept per member, so a number read for one member is never shown to the next one on the same browser.
 *
 * IT COUNTS WHAT THE ROW OPENS (the menu's QA, round 1: a member with two ballots saw "2" and found nothing on the
 * page). The dots stand for "Waiting on you", which opens /governance/work, so they count only the inbox items decided
 * there: each item names the page it is decided on (`decideAt`, shared/reviewInbox.ts), and an item whose page is
 * /governance/work (or /review, its old address) counts. Ballots, recaps and the rest wait on their own pages.
 *
 * Loaded on its own (Layout and NavDropdown import it lazily), so the first page's scripts do not grow. Nothing
 * shows while it loads, when the read fails, at zero, or for a visitor (the menus mount it only for a member).
 */
import { useEffect, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { authToken, gameFetch } from "@/lib/gameApi";

export const WAITING_URL = "/api/admin/review/inbox";
const KEEP_MS = 120_000;
const FOCUS_AFTER_MS = 60_000;

let kept: { who: string; at: number; n: number | null } | null = null;
let asking: Promise<void> | null = null;
const listeners = new Set<() => void>();

/** An item decided on the page "Waiting on you" opens. */
export const DECIDED_ON_WORK = /^\/(?:governance\/work|review)(?:[?#/]|$)/;

/** The inbox's reply, read defensively: how many of its items wait on /governance/work. Null when it is not one. */
export function waitingOf(v: unknown): number | null {
  const items = (v as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return null;
  return items.filter((i) => typeof (i as { decideAt?: unknown })?.decideAt === "string" && DECIDED_ON_WORK.test((i as { decideAt: string }).decideAt)).length;
}

function ask(who: string): Promise<void> {
  asking ??= gameFetch(WAITING_URL, { cache: "no-store" })
    .then(async (res) => (res.ok ? waitingOf(await res.json().catch(() => null)) : null))
    .catch(() => null)
    .then((n) => {
      kept = { who, at: Date.now(), n };
      asking = null;
      listeners.forEach((l) => l());
    });
  return asking;
}

/** For tests: forget the kept answer. */
export function forgetWaiting(): void {
  kept = null;
  asking = null;
}

/** How many things wait on this member, or null while unknown. */
export function useWaiting(who: string): number | null {
  const [, bump] = useState(0);
  useEffect(() => {
    if (!authToken()) return;
    const listen = () => bump((v) => v + 1);
    listeners.add(listen);
    if (!kept || kept.who !== who || Date.now() - kept.at > KEEP_MS) void ask(who);
    const onFocus = () => {
      if (!kept || Date.now() - kept.at > FOCUS_AFTER_MS) void ask(who);
    };
    window.addEventListener("focus", onFocus);
    return () => {
      listeners.delete(listen);
      window.removeEventListener("focus", onFocus);
    };
  }, [who]);
  return kept && kept.who === who ? kept.n : null;
}

/**
 * `badge`: the number, beside a row's words (the "Waiting on you" row, as Messages carries its unread count).
 * `dot`: a small mark on a group's name or the account button, with the number for a screen reader.
 */
export default function WaitingCount({ who, variant = "badge" }: { who: string | number; variant?: "badge" | "dot" }) {
  const { t } = useLingui();
  const n = useWaiting(String(who));
  if (!n || n <= 0) return null;
  const words = t({ message: `${n} waiting on you`, context: "the menu: how many things wait on the reader, read aloud" });
  return variant === "dot" ? (
    <>
      <span aria-hidden="true" data-waiting-dot="" className="absolute -right-1.5 -top-1 inline-flex min-w-4 h-4 items-center justify-center rounded-full bg-card px-1 text-xs font-bold leading-none text-foreground">
        {n > 9 ? "9+" : n}
      </span>
      <span className="sr-only">, {words}</span>
    </>
  ) : (
    <>
      <span aria-hidden="true" data-waiting-count="" className="ml-2 inline-flex min-w-5 h-5 items-center justify-center rounded-full border border-border bg-muted px-1.5 text-xs font-bold leading-none text-foreground align-middle">
        {n > 99 ? "99+" : n}
      </span>
      <span className="sr-only">, {words}</span>
    </>
  );
}
