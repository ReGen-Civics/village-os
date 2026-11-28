/**
 * FIND ANYTHING's doors: the root mount, the search icon the header draws, the row the phone's More sheet draws, and
 * Ctrl K or Cmd K anywhere.
 *
 * This file is the only part of the search on the first page, so it is a button, a root that draws nothing until
 * asked, two listeners and a little state. The dialog itself (FindAnythingDialog.tsx) is a lazy chunk, fetched when
 * a pointer or the focus reaches a door, or on the first press.
 *
 * `FindAnythingRoot` is mounted once at the App's root, outside every Layout, so every page has the search, the
 * not-found page included. The doors (SearchSlot.tsx places them) share its state and only open it; mounted alone,
 * a door still answers by itself. The dialog closes back to whatever opened it, the door pressed or the element
 * that had the focus when the keys were.
 *
 * Any page can open it too: `openFindAnything()` and `useFindAnythingReady()` in findAnythingDoor.ts, which imports
 * nothing of the search, so a link costs its page a few lines and shows only while the search is here to answer.
 *
 * On Admin's own page (/admin) the admin search keeps Ctrl K (components/admin/search), and a key another search
 * already took (`defaultPrevented`) is never taken twice.
 */
import { lazy, Suspense, useEffect, useRef, useSyncExternalStore } from "react";
import { Search } from "lucide-react";
import { LeafCompass } from "@/components/sacred/livingCore";
import { Trans, useLingui } from "@lingui/react/macro";
import { FIND_ANYTHING_EVENT, setFindAnythingReady } from "./findAnythingDoor";

const loadDialog = () => import("./FindAnythingDialog");
const FindAnythingDialog = lazy(loadDialog);

interface FindState {
  open: boolean;
  /** The mount that draws the dialog while it is open. */
  owner: number | null;
  /** Where the focus goes back to on close. */
  returnTo: HTMLElement | null;
}

let state: FindState = { open: false, owner: null, returnTo: null };
const subs = new Set<() => void>();
const mounts: number[] = [];
let nextMount = 1;

function setState(next: FindState): void {
  state = next;
  subs.forEach((f) => f());
}

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};
const snapshot = () => state;

/** Open the search. `from` takes the focus back on close; absent, whatever has the focus now does. */
export function openFind(from?: HTMLElement | null): void {
  if (state.open) return;
  const focused = typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
  setState({ open: true, owner: mounts[0] ?? null, returnTo: from ?? focused });
}

/**
 * Close it and hand the focus back. `returnFocus: false` when the close hands the reader on to something that takes
 * the focus itself (the menu, from "Open the menu"), so the two never fight over it.
 */
export function closeFind(opts: { returnFocus?: boolean } = {}): void {
  const back = opts.returnFocus === false ? null : state.returnTo;
  setState({ open: false, owner: null, returnTo: null });
  if (back && typeof back.focus === "function") setTimeout(() => back.isConnected && back.focus(), 0);
}

/** Ctrl K or Cmd K, with no other modifier. */
export function isFindShortcut(e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">): boolean {
  return (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && String(e.key).toLowerCase() === "k";
}

/** `openFindAnything()` from anywhere (findAnythingDoor.ts): open, with the focus back on whatever asked. */
function onAsk(): void {
  openFind(null);
}

/** Admin's own page keeps Ctrl K for the admin search (components/admin/search), which draws there without the shell. */
const adminSearchHere = () => typeof window !== "undefined" && /^\/admin\/?$/.test(window.location.pathname);

function onKey(e: KeyboardEvent): void {
  if (e.defaultPrevented || e.isComposing || !isFindShortcut(e) || adminSearchHere()) return;
  // The browser's own Ctrl K is its address bar's search; on this site the keys are the site's search.
  e.preventDefault();
  openFind(null);
}

/**
 * One mount of the search: the root (FindAnythingRoot, at the App's root, so every page has it, the not-found page
 * included) or a door (FindAnything). The first mount puts the listeners and the ready flag up and the last takes
 * them down; a root goes to the front, so the dialog is the root's whenever there is one.
 */
function useFindMount(root: boolean): { id: number; open: boolean; owns: boolean } {
  const s = useSyncExternalStore(subscribe, snapshot, snapshot);
  const id = useRef(0);
  if (!id.current) id.current = nextMount++;
  useEffect(() => {
    const me = id.current;
    if (root) mounts.unshift(me);
    else mounts.push(me);
    if (mounts.length === 1) {
      document.addEventListener("keydown", onKey);
      window.addEventListener(FIND_ANYTHING_EVENT, onAsk);
      setFindAnythingReady(true);
    }
    return () => {
      mounts.splice(mounts.indexOf(me), 1);
      if (!mounts.length) {
        document.removeEventListener("keydown", onKey);
        window.removeEventListener(FIND_ANYTHING_EVENT, onAsk);
        setFindAnythingReady(false);
      }
      // A mount leaving with the dialog open hands it to the next one, or closes it.
      if (state.open && state.owner === me) {
        if (mounts.length) setState({ ...state, owner: mounts[0] });
        else setState({ open: false, owner: null, returnTo: null });
      }
    };
  }, [root]);
  return { id: id.current, open: s.open, owns: s.open && s.owner === id.current };
}

/** The dialog, drawn by whichever mount owns it. Lazy: nothing of it reaches the first page. */
function Dialog() {
  return (
    <Suspense fallback={null}>
      <FindAnythingDialog onClose={closeFind} />
    </Suspense>
  );
}

/**
 * THE ROOT MOUNT: once, at the App's root, outside every Layout (client/src/App.tsx). It draws nothing until the
 * search opens, and it is what makes Ctrl K, `openFindAnything()` and the ready flag true on every page, the
 * not-found page (which draws no shell) included. The doors in the header and the sheet then only open it.
 */
export function FindAnythingRoot() {
  const { owns } = useFindMount(true);
  return owns ? <Dialog /> : null;
}

/**
 * The door to the search. `variant="icon"` (the default) is the header's icon; `variant="row"` is a full row with
 * the guide's compass and words, for the first row of the phone's More sheet. `className` replaces the default look
 * of either: the icon takes the ink of whatever bar it sits in, the row draws in the sheet's tokens.
 */
export function FindAnything({ className, variant = "icon" }: { className?: string; variant?: "icon" | "row" }) {
  const { t } = useLingui();
  const { open, owns } = useFindMount(false);
  const button = useRef<HTMLButtonElement>(null);
  const warm = () => void loadDialog().catch(() => undefined);

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => openFind(button.current)}
        onPointerEnter={warm}
        onFocus={warm}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-keyshortcuts="Control+K Meta+K"
        // The row says its own name in words; the icon needs one spoken.
        aria-label={variant === "row" ? undefined : t({ message: "Find anything", context: "site header: opens the site search" })}
        title={variant === "row" ? undefined : t({ message: "Find anything (Ctrl K)", context: "site header: the site search button's tooltip" })}
        data-find-anything={variant}
        className={
          className ??
          (variant === "row"
            ? "flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2 text-left font-medium text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            : "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-current hover:opacity-80 focus-visible:outline-2 focus-visible:outline-current")
        }
      >
        {variant === "row" ? (
          <>
            <span aria-hidden="true" className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-notice text-notice">
              <LeafCompass className="size-4" />
            </span>
            {/* One line at 320px: the words give way with an ellipsis, never a second line. */}
            <span className="min-w-0 flex-1 truncate"><Trans context="the phone's More sheet: the search's row">Find a page, a role, a quest</Trans></span>
            <Search aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
          </>
        ) : (
          <Search aria-hidden="true" className="size-5" />
        )}
      </button>
      {owns && <Dialog />}
    </>
  );
}

export default FindAnything;
