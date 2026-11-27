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
 * In Admin's own page the admin search keeps Ctrl K (components/admin/search): that page draws no site header, so
 * no mount is there, and a key the admin search already took (`defaultPrevented`) is never taken twice.
 */
import { lazy, Suspense, useEffect, useRef, useSyncExternalStore } from "react";
import { Search } from "lucide-react";
import { useLingui } from "@lingui/react/macro";

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

function onKey(e: KeyboardEvent): void {
  if (e.defaultPrevented || e.isComposing || !isFindShortcut(e)) return;
  // The browser's own Ctrl K is its address bar's search; on this site the keys are the site's search.
  e.preventDefault();
  openFind(null);
}

/** The search icon. `className` replaces the default look, which takes the ink of whatever bar it sits in. */
export function FindAnything({ className }: { className?: string }) {
  const { t } = useLingui();
  const s = useSyncExternalStore(subscribe, snapshot, snapshot);
  const id = useRef(0);
  const button = useRef<HTMLButtonElement>(null);
  if (!id.current) id.current = nextMount++;

  useEffect(() => {
    const me = id.current;
    mounts.push(me);
    if (mounts.length === 1) document.addEventListener("keydown", onKey);
    return () => {
      mounts.splice(mounts.indexOf(me), 1);
      if (!mounts.length) document.removeEventListener("keydown", onKey);
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
        aria-label={t({ message: "Find anything", context: "site header: opens the site search" })}
        title={t({ message: "Find anything (Ctrl K)", context: "site header: the site search button's tooltip" })}
        data-find-anything=""
        className={className ?? "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-current hover:opacity-80 focus-visible:outline-2 focus-visible:outline-current"}
      >
        <Search aria-hidden="true" className="size-5" />
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
