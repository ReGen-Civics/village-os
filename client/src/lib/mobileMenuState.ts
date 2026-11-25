/**
 * WHETHER THE PHONE MENU DRAWER IS OPEN, told from the header that owns it (components/Layout.tsx) to the bottom bar's
 * More button that opens it (components/mobile/MobileTabBar.tsx), for More's aria-expanded (the five-reviewer QA
 * pass, 25 Nov 2026). The bar renders in a portal, outside the header's state, so the state travels as an event, and
 * the last value is kept for a bar that mounts after the drawer moved.
 */
import { useEffect, useState } from "react";

const EVENT = "mobile-menu-state";
let last = false;

/** The header says the drawer opened or closed. */
export function announceMobileMenu(open: boolean): void {
  last = open;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT, { detail: { open } }));
}

/** Whether the drawer is open, as the header last said. */
export function useMobileMenuOpen(): boolean {
  const [open, setOpen] = useState(last);
  useEffect(() => {
    const told = (e: Event) => setOpen((e as CustomEvent<{ open?: boolean }>).detail?.open === true);
    window.addEventListener(EVENT, told);
    return () => window.removeEventListener(EVENT, told);
  }, []);
  return open;
}
