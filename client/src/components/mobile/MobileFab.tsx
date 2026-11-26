/**
 * THE CORNER: your companions, and help (phone doors v4; the lead approved it
 * 25 Nov 2026, https://claude.ai/artifact/ADtgLo9i5uu5DLNrRz2mXL). Bottom
 * right, at EVERY width: on a phone just above the tab bar, from `md` up in the
 * corner itself. The file keeps its old name (it was the lotus of shortcuts),
 * so every hide rule keyed on `data-mobile-fab` in index.css still holds it.
 *
 * ONE corner element. The lotus used to open a column of shortcuts that
 * repeated the menu, and the profile drew its companions in a corner of their
 * own just above it (#1646). Now the companions ARE the button, standing
 * together with a count of drafts waiting for a yes, and a tap opens:
 *
 *   Your companions   one row each; a row opens the companions panel.
 *   Ask {guide}       the village concierge, who answers how things work here
 *                     and who to ask (/map/circles#ask). A visitor's goes to
 *                     the guide's conversation on Work with us.
 *   Ask {guide} about Admin
 *                     for an admin only, tagged Admin. It goes to
 *                     /admin?helper=open, where the Admin helper opens (agreed
 *                     with the Admin evolution lane); it is never mounted over
 *                     a member page.
 *   Sign in           for a visitor.
 *
 * A member with no companions yet, and a visitor, see the guide's spiral in the
 * same spot. Inside Admin the corner draws nothing: Admin's own Ask holds it.
 * Everything a shortcut used to offer is a tab or a tile in More (MoreSheet).
 *
 * Ported from regen-civics WizardRadialMenu. Four things are carried over from
 * that implementation on purpose, because each one is a fix for a real failure:
 *
 *  1. pointer-events-none on the positioning container. Closed rows stay mounted
 *     at opacity 0 so the transition can run, which leaves this fixed box
 *     hundreds of pixels tall while nothing is visible. Without this, the box
 *     itself swallows every tap in the bottom-right of the screen even when the
 *     menu is shut. Interactive children re-enable with pointer-events-auto.
 *  2. A hard floor under the bottom offset. Some iOS Safari cases (PWA mode,
 *     embedded web views, landscape) report env(safe-area-inset-bottom) as 0,
 *     and without a floor the FAB disappears behind the tab bar entirely.
 *     The offset rides the safe area so the overlap is the same on every
 *     device: the trigger's lower edge tucks about 1rem into the bar rather
 *     than floating a thumb's width above it.
 *  3. Layering: setup walk z-[80], a card opened from inside a modal z-[75]
 *     (the Gene Keys seal's), modal sheets z-[70], FAB z-[60], scrim z-[55],
 *     tab bar z-50. NOTHING ENFORCES THIS: a shadcn Dialog or Sheet that sets
 *     no tier lands at z-50, tab-bar level, under any modal it was opened
 *     from, and a phone tap shows nothing with no error (live 2026-10-30).
 *     The scrim has to sit between the FAB and the bar, not over both — and a
 *     modal has to clear all three, or the tab bar sits on top of the sheet's
 *     own buttons (the village map's node card shipped that way at z-50).
 *     Since the button shows at every width, the z-50 dialogs (shadcn's
 *     overlays, the hand-rolled aria-modal ones) would sit UNDER it on a desk,
 *     clickable through the backdrop. index.css hides the button while any
 *     modal is up, and a panel that owns this corner while open opts in with
 *     `data-hides-fab` (the launch guide on /journey-to-launch).
 *  4. Plain tap rows rather than a gesture-driven radial. The gesture version
 *     did not survive iOS Safari.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { LogIn, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { FabTriggerIcon } from "@/config/mobileNav";
import { haptic } from "@/lib/haptics";
import { useGuideName } from "@/hooks/useGuideName";
import { CompanionsDialog, Standing, STANDING, draftsWaiting, useCompanions } from "@/components/profileDash/companionStanding";
import type { CompanionView } from "@shared/companionItems";
import { isBareRoute, normalisePath } from "./MobileTabBar";
import { useLingui } from "@lingui/react/macro";
import { useEntranceStands } from "@/lib/entranceStatus";

/**
 * The founding team's pages: the steward front door, the roles page that
 * opens on the founding section, the application and its status. Quiet,
 * professional, one act each, so the shortcuts button stays off them.
 */
const FOUNDING_ROUTES = ["/steward", "/roles", "/propose-a-role", "/application-status", "/role-applications"];

export function isFoundingRoute(location: string): boolean {
  const here = normalisePath(location);
  return FOUNDING_ROUTES.some((r) => here === r || here.startsWith(`${r}/`));
}

/** Springy easing so rows feel like they pop up out of the corner. */
const SPRING = "cubic-bezier(0.34, 1.4, 0.64, 1)";

/** Where the Admin helper opens from outside Admin (the Admin evolution lane's address). */
export const ADMIN_HELPER_HREF = "/admin?helper=open";
/** Where a member asks the concierge: the village map's search, focused (power/SearchBar.tsx reads the hash). */
export const ASK_GUIDE_HREF = "/map/circles#ask";

/** Inside Admin the corner draws nothing: the header's Ask and Admin's phone bar hold it. */
export function isAdminRoute(location: string): boolean {
  const here = normalisePath(location);
  return here === "/admin" || here.startsWith("/admin/");
}

export type CornerRow = {
  key: string;
  label: string;
  sub?: string;
  href?: string;
  /** Opens the companions panel instead of navigating. */
  companion?: CompanionView;
  admin?: boolean;
};

/** The corner's rows, for who is asking. Pure, so the order and the gates are tested without a page. */
export function cornerRows(o: { signedIn: boolean; admin: boolean; army: readonly CompanionView[] | null; guide: string; t: (d: { message: string; context?: string }) => string }): CornerRow[] {
  const rows: CornerRow[] = [];
  for (const c of o.army ?? []) {
    const waiting = draftsWaiting([c]);
    rows.push({
      key: `companion-${c.id}`,
      label: c.name,
      sub: waiting === 0 ? undefined : waiting === 1 ? o.t({ message: "One draft waits for your yes", context: "the corner: under a companion's name" }) : o.t({ message: `${waiting} drafts wait for your yes`, context: "the corner: under a companion's name" }),
      companion: c,
    });
  }
  const guide = o.guide;
  rows.push({
    key: "ask-guide",
    label: o.t({ message: `Ask ${guide}`, context: "the corner: the help row, the village guide's name follows Ask" }),
    sub: o.t({ message: "How things work here, and who to ask", context: "the corner: under the help row" }),
    href: o.signedIn ? ASK_GUIDE_HREF : "/work-with-us",
  });
  if (o.admin) {
    rows.push({
      key: "ask-admin",
      label: o.t({ message: `Ask ${guide} about Admin`, context: "the corner: the Admin helper's row, for an admin" }),
      sub: o.t({ message: "Find any setting, or get a change drafted for you to save", context: "the corner: under the Admin helper's row" }),
      href: ADMIN_HELPER_HREF,
      admin: true,
    });
  }
  if (!o.signedIn) rows.push({ key: "signin", label: o.t({ message: "Sign in", context: "the corner: a visitor's row" }), href: "/login" });
  return rows;
}

export default function MobileFab() {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const { user } = useAuth();
  // The same rule as AuthContext's useIsAdmin, read off the user the page already has (no second import to mock).
  const admin = user?.role === "admin" || user?.role === "founder";
  const { name: guideName } = useGuideName();
  const { army, reread } = useCompanions(!!user);
  const entrance = useEntranceStands(location, !!user);
  const [panel, setPanel] = useState(false);
  const rows = cornerRows({ signedIn: !!user, admin, army, guide: guideName, t });
  const standing = (army ?? []).slice(0, STANDING);
  const waiting = draftsWaiting(army ?? []);
  // A link to /profile#companions (and the welcome tour) opens the panel once the companions are read.
  useEffect(() => {
    if (army?.length && window.location.hash === "#companions") setPanel(true);
  }, [army]);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Set when the menu was opened from the keyboard, so focus can move into it.
  const focusOnOpen = useRef(false);

  const menuItems = () =>
    Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  const toggle = useCallback((e?: React.MouseEvent) => {
    // "press" is 10ms, the number this line used to spell out. The util in
    // client/src/lib/haptics.ts holds the vocabulary now.
    haptic("press");
    // A click with detail 0 came from Enter or Space, not a pointer.
    focusOnOpen.current = !!e && e.detail === 0;
    setOpen((s) => !s);
  }, []);

  // Tap anywhere else to close.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  // Escape to close. Focus goes back to the trigger when it was inside the
  // menu, because the rows leave the tab order as the menu shuts. The open
  // menu is the top layer, so the key it spent closing itself goes no
  // further: BreakGlass listens on `window` and read the same press as
  // "decline the override".
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      const inside = !!menuRef.current?.contains(document.activeElement);
      setOpen(false);
      if (inside) triggerRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Opened from the keyboard: land on the row nearest the trigger, which is
  // the last one, the way a menu button hands focus to its menu.
  useEffect(() => {
    if (!open || !focusOnOpen.current) return;
    focusOnOpen.current = false;
    const items = menuItems();
    items[items.length - 1]?.focus();
  }, [open]);

  // Arrow keys walk the rows; Home and End jump to either end. Only while the
  // menu is open: a shut menu's rows are invisible, and these keys belong to
  // the page again (they scroll it).
  const onMenuKey = (e: React.KeyboardEvent) => {
    if (!open) return;
    const items = menuItems();
    if (!items.length) return;
    const at = items.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (e.key === "ArrowDown") next = at < 0 ? 0 : (at + 1) % items.length;
    else if (e.key === "ArrowUp") next = at < 0 ? items.length - 1 : (at - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    items[next]?.focus();
  };

  /*
   * IT STEPS ASIDE WHILE A MEMBER READS DOWN THE PAGE. The trigger is a 56px
   * circle over whatever a page puts in its bottom-right corner: the living
   * map's key, a paragraph on /roles (QA pass and sweep, 2026-09-21). Reading
   * down is when that corner holds the thing being read, so it tucks away; a
   * scroll back up, the top of the page, a new page, or a keyboard reaching
   * it brings it back. Never while its menu is open.
   */
  const [tucked, setTucked] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 64) {
        setTucked(false);
        last = y;
        return;
      }
      // Hysteresis, so a thumb resting on the glass does not flicker it.
      if (Math.abs(y - last) < 12) return;
      // Never away from a keyboard that has reached it: the scroll that focus itself causes used to
      // tuck it straight back, leaving the focus on nothing visible (QA, 25 Nov 2026).
      if (document.activeElement === triggerRef.current) {
        last = y;
        return;
      }
      setTucked(y > last);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => setTucked(false), [location]);
  const hidden = tucked && !open;

  // The screens that render no tab bar render no FAB either: the trigger is a
  // 56px circle in the bottom-right, and on /login it sat over the right end
  // of the full-width sign-in button. Same list, same reason (mobileNav.ts).
  if (isBareRoute(location)) return null;
  // The founding team's pages keep their own quiet register and their one act;
  // the button sat over their hero words on a phone (go-live pass, M4).
  if (isFoundingRoute(location)) return null;
  // Inside Admin its own Ask button and phone bar hold this corner (the Admin evolution lane).
  if (isAdminRoute(location)) return null;
  // The portal entrance in front of the page: it is the page then, with its own "I have an account: sign in", and
  // every row here leads behind it (1.3.75's live check: the corner drew over the entrance).
  if (entrance) return null;

  return (
    <>
      {/* Focus scrim, between the tab bar (z-50) and the FAB (z-[60]). */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-[55] bg-black/45 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{ backdropFilter: open ? "blur(2px)" : undefined }}
      />

      <div
        // Rides up clear of the living map's circle peek while one shows (index.css).
        data-mobile-fab
        className="fixed right-4 bottom-[var(--fab-bottom)] md:right-6 md:bottom-6 z-[60] flex flex-col items-end pointer-events-none"
        // Tab bar is h-16 (4rem) of content plus the safe-area pad. Offsetting
        // by that same pad + 3.5rem leaves the trigger's lower edge exactly
        // 0.5rem over the bar's top edge on EVERY phone: the safe area
        // cancels, so a notched phone and a plain one overlap identically
        // instead of drifting apart. Anchored in the corner it belongs in, not
        // hovering a thumb's width above it. Carried as a variable so `md:`
        // can take over from it: from `md` up there is no bar to clear, and
        // the button sits 1.5rem in from the corner itself.
        style={{ "--fab-bottom": "max(calc(env(safe-area-inset-bottom, 0px) + 3.5rem), 3.5rem)" } as React.CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          ref={menuRef}
          role="menu"
          aria-label={t({ message: "Your companions and help", context: "the corner: the menu, read aloud" })}
          aria-hidden={!open}
          onKeyDown={onMenuKey}
          // THE SHUT MENU TAKES NO ROOM AND IS NOT DRAWN.
          //
          // It used to sit in flow above the trigger at opacity 0, so this
          // fixed box was as tall as every row. The rows depend on sign-in and
          // the brochure switch, which answer after first paint, and a row
          // arriving grew the box upward: Chrome scored that as a layout shift
          // on every page, 0.012 to 0.025 at 390 wide, for a menu nobody could
          // see. Out of flow it cannot move the box, and `invisible` keeps a
          // shut menu out of the shift count entirely. The visibility change
          // waits 400ms on the way out, past the rows' 300ms fade plus their
          // stagger, so closing still animates exactly as before.
          className={`absolute bottom-full right-0 mb-3 flex w-max flex-col items-end gap-2.5 ${
            open ? "visible pointer-events-auto" : "invisible pointer-events-none"
          }`}
          style={{ transition: `visibility 0s linear ${open ? "0s" : "400ms"}` }}
        >
          {rows.map((a, i) => {
            // Nearest the trigger reveals first, so the stack springs upward.
            const delay = open ? `${(rows.length - 1 - i) * 38}ms` : `${i * 18}ms`;
            const cls =
              "group/row flex items-center gap-2.5 outline-none transition-[transform,opacity] duration-300 focus-visible:opacity-100 " +
              (open ? "opacity-100 translate-x-0 scale-100" : "opacity-0 translate-x-5 scale-90");
            const style: React.CSSProperties = { transitionDelay: delay, transitionTimingFunction: SPRING };

            const inner = (
              <>
                <span className="flex max-w-[16rem] select-none flex-col items-end rounded-xl border border-border bg-card px-3 py-1.5 text-right shadow-lg transition-colors group-hover/row:bg-muted">
                  <span className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
                    {a.label}
                    {a.admin ? (
                      <span className="rounded border border-notice px-1 text-[10px] font-semibold uppercase tracking-wider text-notice">
                        {t({ message: "Admin", context: "the corner: the tag on the Admin helper's row" })}
                      </span>
                    ) : null}
                  </span>
                  {a.sub ? <span className="text-xs text-muted-foreground">{a.sub}</span> : null}
                </span>
                <span className="flex w-12 h-12 flex-shrink-0 items-center justify-center rounded-full border border-border bg-card text-card-foreground shadow-lg transition-transform duration-200 group-hover/row:scale-105 group-active/row:scale-95">
                  {a.companion ? <Standing c={a.companion} lead={false} small /> : a.key === "signin" ? <LogIn aria-hidden="true" className="size-5" /> : <FabTriggerIcon className="size-5" />}
                </span>
              </>
            );

            const closeThenRun = () => {
              // "tick" is 6ms, the number this line used to spell out.
              haptic("tick");
              // Focus goes back to the trigger first, the way Escape does: the rows are about to hide.
              if (menuRef.current?.contains(document.activeElement)) triggerRef.current?.focus();
              setOpen(false);
              if (a.companion) setPanel(true);
            };

            if (a.href) {
              return (
                <Link key={a.key} href={a.href} onClick={closeThenRun} className={cls} style={style} role="menuitem" tabIndex={open ? 0 : -1}>
                  {inner}
                </Link>
              );
            }
            return (
              <button key={a.key} type="button" onClick={closeThenRun} className={cls} style={style} role="menuitem" tabIndex={open ? 0 : -1}>
                {inner}
              </button>
            );
          })}
        </div>

        {/* Trigger: the companions standing, or the guide's spiral for anybody without one yet. The ring
            lights up when open, so the state is clear without a label. */}
        <button
          ref={triggerRef}
          type="button"
          onClick={toggle}
          onFocus={() => setTucked(false)}
          data-fab-trigger
          // The welcome tour finds the companions by this id (CompanionWelcome.tsx).
          id={standing.length ? "companions" : undefined}
          // Named properties, never `all`: `all` also animates the visibility
          // this button inherits from the hide rule in index.css, which held
          // it on screen through a dialog's opening and late after it closed.
          // One alignment per branch: with both items-end and items-center on the button, the stylesheet's order
          // picked items-end and the bird sat on the circle's bottom edge (the lead, 26 Nov 2026: "centered").
          className={`relative flex justify-center transition-[transform,opacity,box-shadow] duration-300 motion-reduce:transition-none hover:scale-105 active:scale-95 ${
            standing.length ? "min-h-14 items-end rounded-full p-1.5 pb-2" : "w-14 h-14 items-center rounded-full shadow-xl"
          } ${hidden ? "pointer-events-none scale-0 opacity-0" : "pointer-events-auto"} ${open ? "scale-105" : ""}`}
          style={
            standing.length
              ? { boxShadow: open ? "0 0 0 4px color-mix(in srgb, var(--color-notice) 45%, transparent)" : undefined }
              : {
                  background: "linear-gradient(to top, var(--tone-brand-band, var(--mode-brand-band, #105e5d)), var(--tone-brand, var(--mode-brand, #157f7d)))",
                  boxShadow: open ? "0 0 0 4px rgba(236,177,99,0.45), 0 12px 32px rgba(0,0,0,0.4)" : "0 10px 24px rgba(0,0,0,0.35)",
                }
          }
          aria-label={
            open
              ? t({ message: "Close your companions and help", context: "the corner: the button while open, read aloud" })
              : standing.length === 0
                ? t({ message: "Open help", context: "the corner: the button with no companions, read aloud" })
                : waiting === 0
                  ? t({ message: `Your companions: ${(army ?? []).map((c) => c.name).join(", ")}, and help`, context: "the corner: the button, read aloud" })
                  : t({ message: `Your companions: ${(army ?? []).map((c) => c.name).join(", ")}. ${waiting} waiting for your yes. And help`, context: "the corner: the button, read aloud" })
          }
          aria-expanded={open}
          aria-haspopup="menu"
        >
          {standing.length ? (
            <>
              {standing.map((c, i) => (
                <Standing key={c.id} c={c} lead={i === 0} />
              ))}
              {waiting > 0 ? (
                <span aria-hidden="true" className="absolute -top-1 right-1 inline-flex min-w-5 items-center justify-center rounded-full bg-notice px-1.5 text-xs font-bold leading-5 text-background ring-2 ring-card">
                  {waiting}
                </span>
              ) : null}
              {/* The soft shadow they stand on. */}
              <span aria-hidden="true" className="absolute inset-x-2 bottom-0 -z-10 h-3 rounded-[50%] bg-black/25 blur-[3px]" />
            </>
          ) : (
            <span className="flex items-center justify-center">
              {open ? <X className="size-8 text-cream" /> : <FabTriggerIcon className="size-8 text-cream drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]" />}
            </span>
          )}
        </button>
      </div>
      {panel ? (
        <CompanionsDialog
          onClose={() => {
            setPanel(false);
            reread(); // a yes in the panel changes what waits; the count follows
            window.setTimeout(() => triggerRef.current?.focus(), 0);
          }}
        />
      ) : null}
    </>
  );
}
