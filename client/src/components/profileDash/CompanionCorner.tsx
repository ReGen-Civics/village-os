/**
 * THE COMPANIONS' CORNER (profile overhaul, Direction D; the lead, 24 Nov 2026).
 *
 * "There shouldn't be a whole section like this for my companions... show the character at the bottom
 * right of my screen, and when I click on them... it lets me decide which one I can talk to and opens up
 * a comm box there. And if I have multiple companions, it would just show multiple characters all bundled
 * together." So the companions stand together in the corner of the profile, each in its own painting from
 * the village's animals (Scarlet, the scarlet macaw, for everyone; a role's companion in its role card's
 * painting), with a count of drafts waiting for a yes. A tap opens the companions panel beside the page:
 * the same YourCompanions it always was, choosing one, its chat and its drafts, now out of the page's way.
 *
 * They stand just above the lotus shortcut button (MobileFab), which holds the very corner at every width,
 * and below its scrim, so the two never cover each other. The moon dock keeps the opposite corner.
 *
 * The button is a real button with a name that says who stands there and what waits; the panel is a
 * labelled dialog that Escape closes, with focus returned to the button. Nothing draws until the
 * companions are read, and nothing at all for a member with none (absent, not empty).
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
const STANDING = 4;

/** One companion standing: its painting in an arched frame, or its pet or portrait when it wears one. */
function Standing({ c, lead }: { c: CompanionView; lead: boolean }) {
  const size = lead ? "h-[4.25rem] w-[3.25rem]" : "h-14 w-11";
  return (
    <span
      className={`companion-arch relative -ml-3 inline-flex shrink-0 items-end justify-center overflow-hidden rounded-t-full rounded-b-xl border-2 border-card bg-muted shadow-sm ring-1 ring-notice first:ml-0 ${size}`}
      aria-hidden="true"
    >
      {c.look.source === "nature" && c.look.art ? (
        <img src={natureArtUrl(c.look.art, "sm")} alt="" className="h-full w-full scale-150 object-cover object-[60%_20%]" loading="lazy" />
      ) : (
        <CompanionPet look={c.look} url={c.lookUrl} size={lead ? 48 : 40} />
      )}
    </span>
  );
}

export default function CompanionCorner() {
  const { t } = useLingui();
  const [army, setArmy] = useState<CompanionView[] | null>(null);
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);

  const read = useCallback(() => {
    gameFetch("/api/me/companions")
      .then((r) => (r.ok ? (r.json() as Promise<CompanionsPayload>) : null))
      .then((d) => {
        if (d?.companions) setArmy(d.companions.filter((c) => c.status === "active").sort((a, b) => a.sortOrder - b.sortOrder));
      })
      .catch(() => {});
  }, []);
  useEffect(read, [read]);
  // A link to /profile#companions opens the panel once the companions are read.
  useEffect(() => {
    if (army?.length && window.location.hash === "#companions") setOpen(true);
  }, [army]);

  useEffect(() => {
    if (!open) return;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const shut = () => {
    setOpen(false);
    read(); // a yes in the panel changes what waits; the corner's count follows
    window.setTimeout(() => button.current?.focus(), 0);
  };

  if (!army || army.length === 0) return null;

  const waiting = army.reduce((n, c) => n + c.drafts.filter((d) => d.status === "open").length, 0);
  const names = army.map((c) => c.name).join(", ");
  const label =
    waiting === 0
      ? t({ message: `Your companions: ${names}`, context: "companion corner: the button, read aloud" })
      : waiting === 1
        ? t({ message: `Your companions: ${names}. One draft waits for your yes.`, context: "companion corner: the button, read aloud" })
        : t({ message: `Your companions: ${names}. ${waiting} drafts wait for your yes.`, context: "companion corner: the button, read aloud" });
  const standing = army.slice(0, STANDING);
  const more = army.length - standing.length;

  return (
    <>
      <button
        ref={button}
        id="companions"
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-companion-corner=""
        className="companion-corner jw-btn fixed right-4 z-40 flex items-end rounded-full p-1.5 pb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring bottom-[calc(max(calc(env(safe-area-inset-bottom,0px)+3.5rem),3.5rem)+4.75rem)] md:right-6 md:bottom-24"
      >
        {standing.map((c, i) => (
          <Standing key={c.id} c={c} lead={i === 0} />
        ))}
        {more > 0 ? (
          <span aria-hidden="true" className="-ml-2 mb-1 inline-flex size-8 items-center justify-center rounded-full border border-border bg-card text-xs font-semibold text-foreground">
            +{more}
          </span>
        ) : null}
        {waiting > 0 ? (
          <span aria-hidden="true" className="absolute -top-1 left-9 inline-flex min-w-5 items-center justify-center rounded-full bg-notice px-1.5 text-xs font-bold leading-5 text-background ring-2 ring-card">
            {waiting}
          </span>
        ) : null}
        {/* The soft shadow they stand on. */}
        <span aria-hidden="true" className="absolute inset-x-2 bottom-0 -z-10 h-3 rounded-[50%] bg-black/25 blur-[3px]" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50" data-companion-panel="">
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={shut}
            className="absolute inset-0 h-full w-full cursor-default bg-black/40"
          />
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
                onClick={shut}
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
      ) : null}
    </>
  );
}
