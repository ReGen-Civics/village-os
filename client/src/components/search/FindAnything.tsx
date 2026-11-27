/**
 * FIND ANYTHING's door: the search icon the header and the phone's top bar draw, and Ctrl K or Cmd K anywhere.
 *
 * This file is the only part of the search on the first page, so it is a button, one key listener and a little
 * state. The dialog itself (FindAnythingDialog.tsx) is a lazy chunk, fetched when a pointer or the focus reaches
 * the button, or on the first press.
 *
 * Mount it anywhere, as often as the shell likes (the header and the phone bar are two mounts): every mount shares
 * one state, one key listener and one dialog. The dialog closes back to whatever opened it, the button pressed or
 * the element that had the focus when the keys were.
 *
 * Any page can open it too: `openFindAnything()` and `useFindAnythingReady()` in findAnythingDoor.ts, which imports
 * nothing of the search, so a link costs its page a few lines and shows only while a mount is here to answer.
 *
 * In Admin's own page the admin search keeps Ctrl K (components/admin/search): that page draws no site header, so
 * no mount is there, and a key the admin search already took (`defaultPrevented`) is never taken twice.
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
export function openFind(from?: HTMLElement | null, owner?: number): void {
  if (state.open) return;
  const focused = typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
  setState({ open: true, owner: owner ?? mounts[0] ?? null, returnTo: from ?? focused });
}

/** Close it and hand the focus back. */
export function closeFind(): void {
  const back = state.returnTo;
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

function onKey(e: KeyboardEvent): void {
  if (e.defaultPrevented || e.isComposing || !isFindShortcut(e)) return;
  // The browser's own Ctrl K is its address bar's search; on this site the keys are the site's search.
  e.preventDefault();
  openFind(null);
}

/**
 * The door to the search. `variant="icon"` (the default) is the header's icon; `variant="row"` is a full row with
 * the guide's compass and words, for the first row of the phone's More sheet. `className` replaces the default look
 * of either: the icon takes the ink of whatever bar it sits in, the row draws in the sheet's tokens.
 */
export function FindAnything({ className, variant = "icon" }: { className?: string; variant?: "icon" | "row" }) {
  const { t } = useLingui();
  const s = useSyncExternalStore(subscribe, snapshot, snapshot);
  const id = useRef(0);
  const button = useRef<HTMLButtonElement>(null);
  if (!id.current) id.current = nextMount++;

  useEffect(() => {
    const me = id.current;
    mounts.push(me);
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
  }, []);

  const warm = () => void loadDialog().catch(() => undefined);

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => openFind(button.current, id.current)}
        onPointerEnter={warm}
        onFocus={warm}
        aria-haspopup="dialog"
        aria-expanded={s.open}
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
            <span className="min-w-0 flex-1"><Trans context="the phone's More sheet: the search's row">Find a page, a role, a quest</Trans></span>
            <Search aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
          </>
        ) : (
          <Search aria-hidden="true" className="size-5" />
        )}
      </button>
      {s.open && s.owner === id.current && (
        <Suspense fallback={null}>
          <FindAnythingDialog onClose={closeFind} />
        </Suspense>
      )}
    </>
  );
}

export default FindAnything;
