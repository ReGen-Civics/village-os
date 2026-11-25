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
import { X } from "lucide-react";
import { gameFetch } from "@/lib/gameApi";
import { natureArtUrl } from "@shared/natureArt";
import type { CompanionView, CompanionsPayload } from "@shared/companionItems";
import CompanionPet from "./CompanionPet";
import { BreathingLoader } from "@/components/natural";

const YourCompanions = lazy(() => import("./YourCompanions"));

/** How many stand in the corner before the rest are counted. */
export const STANDING = 4;

/** One companion standing: its painting in an arched frame, or its pet or portrait when it wears one. */
export function Standing({ c, lead, small }: { c: CompanionView; lead: boolean; small?: boolean }) {
  const size = small ? "h-11 w-9" : lead ? "h-[4.25rem] w-[3.25rem]" : "h-14 w-11";
  return (
    <span
      className={`companion-arch relative -ml-3 inline-flex shrink-0 items-end justify-center overflow-hidden rounded-t-full rounded-b-xl border-2 border-card bg-muted shadow-sm ring-1 ring-notice first:ml-0 ${size}`}
      aria-hidden="true"
    >
      {c.look.source === "nature" && c.look.art ? (
        <img src={natureArtUrl(c.look.art, "sm")} alt="" className="h-full w-full scale-150 object-cover object-[60%_20%]" loading="lazy" />
      ) : (
        <CompanionPet look={c.look} url={c.lookUrl} size={small ? 32 : lead ? 48 : 40} />
      )}
    </span>
  );
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

/** The companions panel: the same YourCompanions as ever, beside the page, with Escape and a close button. */
export function CompanionsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useLingui();
  const close = useRef<HTMLButtonElement>(null);
  const shut = useRef(onClose);
  shut.current = onClose;
  useEffect(() => {
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") shut.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="fixed inset-0 z-[70]" data-companion-panel="">
      <button type="button" tabIndex={-1} aria-hidden="true" onClick={onClose} className="absolute inset-0 h-full w-full cursor-default bg-black/40" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t({ message: "Your companions", context: "companion corner: the panel, read aloud" })}
        className="sheet-night absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl border border-border bg-background p-4 shadow-sm sm:p-6 md:inset-y-0 md:left-auto md:max-h-none md:w-[34rem] md:rounded-none md:rounded-l-2xl"
      >
        <div className="mb-2 flex justify-end">
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
        <Suspense fallback={<BreathingLoader />}>
          <YourCompanions />
        </Suspense>
      </div>
    </div>
  );
}
