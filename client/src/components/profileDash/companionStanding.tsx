/**
 * THE COMPANIONS, STANDING (profile overhaul, Direction D; the lead, 24 Nov 2026), and their panel.
 *
 * "Show the character at the bottom right of my screen... if I have multiple companions, it would just
 * show multiple characters all bundled together." Each stands in its painting from the village's animals
 * (Scarlet, the scarlet macaw, for everyone; a role's companion in its role card's painting), or in its
 * pet or portrait when it wears one. They used to stand in a corner of their own on the profile
 * (CompanionCorner, #1646); since the phone doors (v4, 25 Nov 2026) they ARE the corner, on every page,
 * the button that also leads to help (components/mobile/MobileFab.tsx). One corner element, not two.
 */
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { Link } from "wouter";
import { gameFetch } from "@/lib/gameApi";
import { natureArtUrl } from "@shared/natureArt";
import type { CompanionLook, CompanionView, CompanionsPayload } from "@shared/companionItems";
import CompanionPet from "./CompanionPet";
import { BreathingLoader } from "@/components/natural";

const YourCompanions = lazy(() => import("./YourCompanions"));
// The feedback form loads when its door opens, and its screenshot tools only when a picture is added.
const GuideFeedback = lazy(() => import("@/components/feedback/GuideFeedback"));

/** How many stand in the corner before the rest are counted. */
export const STANDING = 4;

/**
 * A companion's face in a circle (the lead, 27 Nov 2026: "the animal images be circles"): its painting from the
 * village's animals, cropped to the animal's head and shoulders, or its pet or portrait when it wears one.
 */
export function Face({ look, url, size, className = "" }: { look: CompanionLook; url: string | null; size: "sm" | "md" | "lg"; className?: string }) {
  const box = size === "sm" ? "size-10" : size === "lg" ? "size-14" : "size-12";
  return (
    <span
      className={`companion-arch relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-card bg-muted shadow-sm ring-1 ring-notice ${box} ${className}`}
      aria-hidden="true"
      data-companion-face=""
    >
      {look.source === "nature" && look.art ? (
        <img src={natureArtUrl(look.art, "sm")} alt="" className="h-full w-full scale-[1.35] object-cover object-[55%_30%]" loading="lazy" />
      ) : (
        <CompanionPet look={look} url={url} size={size === "sm" ? 30 : size === "lg" ? 44 : 36} />
      )}
    </span>
  );
}

/** One companion standing beside the corner button: its face in a circle, the first a little larger. */
export function Standing({ c, lead, small }: { c: CompanionView; lead: boolean; small?: boolean }) {
  return <Face look={c.look} url={c.lookUrl} size={small ? "sm" : lead ? "lg" : "md"} className="-ml-3 first:ml-0" />;
}

/**
 * A door the guide's panel opens on: the guide's own help, "Share feedback" (which opens inside the
 * panel, `opens`), and Admin's helper for an admin.
 */
export interface GuideDoor {
  key: string;
  label: string;
  sub?: string;
  href?: string;
  /** Opens inside the panel instead of navigating. */
  opens?: "feedback";
  admin?: boolean;
}

/** What the panel's "Share feedback" needs: who the guide is and the face it wears. */
export interface FeedbackHost {
  guide: string;
  face: { look: CompanionLook; url: string | null };
}

/**
 * Tab stays inside the panel (fold QA round 1: Tab after Send left the modal for the page under it). From the
 * last control Tab goes to the first, and Shift+Tab from the first to the last. A panel stepped aside for a
 * screenshot is invisible, so its controls are skipped by `checkVisibility`, and the way back is what is left.
 */
export function keepFocusIn(box: HTMLElement | null, e: KeyboardEvent): void {
  if (!box) return;
  const all = Array.from(
    box.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]'),
  ).filter((el) => el.getAttribute("aria-hidden") !== "true" && (typeof el.checkVisibility !== "function" || el.checkVisibility({ visibilityProperty: true } as CheckVisibilityOptions)));
  if (!all.length) return;
  const first = all[0];
  const last = all[all.length - 1];
  const at = document.activeElement as HTMLElement | null;
  const inside = !!at && box.contains(at);
  if (e.shiftKey && (at === first || !inside)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (at === last || !inside)) {
    e.preventDefault();
    first.focus();
  }
}

/** Drafts waiting for a yes, across every companion. */
export function draftsWaiting(army: readonly CompanionView[]): number {
  return army.reduce((n, c) => n + c.drafts.filter((d) => d.status === "open").length, 0);
}

/**
 * This member's active companions, in their order, or null until read and for
 * anybody the routes refuse (a visitor, a guest without companions): absent,
 * not empty. `reread` refreshes the drafts count after a yes in the panel.
 */
export function useCompanions(signedIn: boolean): { army: CompanionView[] | null; reread: () => void } {
  const [army, setArmy] = useState<CompanionView[] | null>(null);
  const reread = useCallback(() => {
    if (!signedIn) return setArmy(null);
    gameFetch("/api/me/companions")
      .then((r) => (r.ok ? (r.json() as Promise<CompanionsPayload>) : null))
      .then((d) => setArmy(d?.companions ? d.companions.filter((c) => c.status === "active").sort((a, b) => a.sortOrder - b.sortOrder) : null))
      .catch(() => setArmy(null));
  }, [signedIn]);
  useEffect(reread, [reread]);
  return { army, reread };
}

/**
 * The companions panel: the same YourCompanions as ever, beside the page, with Escape and a close button.
 *
 * Opened from the guide's row it is the guide's panel (the lead, 27 Nov 2026: "Scarlet is Maia and Maia admin all
 * 3 can be scarlet"): `title` names the guide, `doors` lead to the guide's help and, for an admin, to Admin's helper,
 * and `companions` false leaves the chats out for a member who has none.
 */
export function CompanionsDialog({
  onClose,
  title,
  doors = [],
  companions = true,
  feedback,
  startOn,
}: {
  onClose: () => void;
  title?: string;
  doors?: GuideDoor[];
  companions?: boolean;
  /** Offer "Share feedback" inside the panel (the guide's panel). */
  feedback?: FeedbackHost;
  /** Open straight on the feedback form (`#feedback`, the footer's door, `/feedback`). */
  startOn?: "feedback";
}) {
  const { t } = useLingui();
  const close = useRef<HTMLButtonElement>(null);
  const shut = useRef(onClose);
  shut.current = onClose;
  const [view, setView] = useState<"doors" | "feedback">(feedback && startOn === "feedback" ? "feedback" : "doors");
  // Stepping aside for a screenshot: the panel stays mounted (the draft is kept) and is not drawn. "pill" leaves a
  // way back for a member taking a phone screenshot; "hidden" draws nothing while the browser captures the screen.
  const [aside, setAside] = useState<false | "pill" | "hidden">(false);
  const asideNow = useRef(aside);
  asideNow.current = aside;
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") return keepFocusIn(box.current, e);
      if (e.key !== "Escape") return;
      // Escape while stepped aside brings the draft back; it never throws the draft away.
      if (asideNow.current) setAside(false);
      else shut.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const back = view === "feedback" && doors.length > 0;
  return (
    <div className={`fixed inset-0 z-[70] ${aside ? "pointer-events-none" : ""}`} data-companion-panel="">
      <button type="button" tabIndex={-1} aria-hidden="true" onClick={onClose} className={`absolute inset-0 h-full w-full cursor-default bg-black/40 ${aside ? "invisible" : ""}`} />
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? t({ message: "Your companions", context: "companion corner: the panel, read aloud" })}
        // A place, not a box of words: `data-scene` keeps the sheet's night in dark mode, where a dialog turns to
        // sand (index.css), so the panel no longer sits cream over the night page (fold QA round 1).
        data-scene=""
        className={`sheet-night absolute inset-x-0 bottom-[var(--kb,0px)] max-h-[min(88vh,calc(var(--vvh,100vh)-1rem))] overflow-y-auto rounded-t-2xl border border-border bg-background p-4 shadow-sm sm:p-6 md:inset-y-0 md:left-auto md:max-h-none md:w-[34rem] md:rounded-none md:rounded-l-2xl ${aside ? "invisible" : ""}`}
      >
        <div className={`mb-2 flex ${back ? "justify-between" : "justify-end"}`}>
          {back ? (
            <button
              type="button"
              onClick={() => setView("doors")}
              className="jw-btn inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              {t({ message: "Back", context: "guide feedback: back to the guide's doors" })}
            </button>
          ) : null}
          <button
            ref={close}
            type="button"
            onClick={onClose}
            aria-label={t({ message: "Close your companions", context: "companion corner: the panel's close button" })}
            className="jw-btn inline-flex size-11 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {view === "feedback" && feedback ? (
          <Suspense fallback={<BreathingLoader />}>
            {/* The form draws the way back from a screenshot itself, so that code loads with it. */}
            <GuideFeedback guide={feedback.guide} face={feedback.face} aside={aside} onAside={setAside} onClose={onClose} />
          </Suspense>
        ) : null}
        {view === "doors" && doors.length && title ? (
          // The guide's panel opens the way every section does: a kicker that places the reader, then the guide's name.
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-notice">{t({ message: "Your village guide", context: "the guide's panel: the kicker over the guide's name" })}</p>
            <h2 className="font-display text-2xl text-foreground">{title}</h2>
          </div>
        ) : null}
        {view === "doors" && doors.length ? (
          <ul className="mb-4 grid list-none gap-2 p-0" data-guide-doors="">
            {doors.map((d) => {
              const cls = "jw-btn flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-2.5 text-left text-card-foreground hover:bg-muted";
              const inner = (
                <>
                  <span className="grid min-w-0">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      {d.label}
                      {d.admin ? (
                        <span className="rounded border border-notice px-1 text-[10px] font-semibold uppercase tracking-wider text-notice">
                          {t({ message: "Admin", context: "the corner: the tag on the Admin helper's row" })}
                        </span>
                      ) : null}
                    </span>
                    {d.sub ? <span className="text-xs text-muted-foreground">{d.sub}</span> : null}
                  </span>
                  <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                </>
              );
              return (
                <li key={d.key}>
                  {d.opens === "feedback" && feedback ? (
                    <button type="button" onClick={() => setView("feedback")} data-guide-door={d.key} className={cls}>
                      {inner}
                    </button>
                  ) : (
                    <Link href={d.href ?? "/"} onClick={onClose} data-guide-door={d.key} className={cls}>
                      {inner}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
        {view === "doors" && companions ? (
          <Suspense fallback={<BreathingLoader />}>
            <YourCompanions />
          </Suspense>
        ) : null}
      </div>
    </div>
  );
}
