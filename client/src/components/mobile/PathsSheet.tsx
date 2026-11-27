/**
 * PATHS, THE PHONE HEADER'S FIRST BUTTON (the lead, 27 Nov 2026: "The top menu should have one button for paths to
 * show the various paths and another button for menu").
 *
 * A sheet listing the village's paths, the same cards as the home page's "Choose your path" (lib/pathCards.ts): each
 * with its picture (or its icon while the village has none), its name and second line from Paths & Stages, and a link
 * to its journey page. Phones only; from `md` up the header keeps its own menu. Built like More (MoreSheet.tsx): a
 * modal sheet over a shade, Escape or the shade closes it, focus goes in on open and back to the Paths button on close.
 */
import { useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useLingui } from "@lingui/react/macro";
import { ArrowRight, X } from "lucide-react";
import { useBrandImages } from "@/lib/gameApi";
import { usePageContent } from "@/hooks/usePageContent";
import { HOME_PAGE } from "@shared/pageContent/home";
import { useStoryPageOffAlone } from "@/lib/brochure";
import { artFocusOr } from "@shared/pathCardArt";
import { pathCardHref, useFoundingOn, visiblePathCards } from "@/lib/pathCards";

export default function PathsSheet({ onClose }: { onClose: () => void }) {
  const { t } = useLingui();
  const [location] = useLocation();
  const page = usePageContent(HOME_PAGE);
  const pageOff = useStoryPageOffAlone();
  const brand = useBrandImages();
  const founding = useFoundingOn() === true;
  const cards = visiblePathCards(page?.paths, pageOff);
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const close = () => closeRef.current();

  useEffect(() => {
    opener.current = document.activeElement;
    panel.current?.querySelector<HTMLElement>("button, a[href]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (opener.current instanceof HTMLElement && opener.current.isConnected) opener.current.focus();
    };
  }, []);
  // A new page closes it.
  const first = useRef(location);
  useEffect(() => {
    if (location !== first.current) closeRef.current();
  }, [location]);

  const heading = page?.paths?.fields.heading || t({ message: "Paths", context: "the phone's Paths sheet: heading when the village has none" });
  const eyebrow = page?.paths?.fields.eyebrow ?? "";
  return (
    <div className="md:hidden" data-paths-sheet="">
      <button type="button" tabIndex={-1} aria-hidden="true" onClick={close} className="fixed inset-0 z-[65] cursor-default bg-black/45" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="paths-sheet-h"
        data-scene=""
        className="fixed inset-x-0 z-[70] max-h-[calc(100svh-var(--tabbar-h,4rem)-4rem)] overflow-y-auto rounded-t-2xl border-t border-border bg-card px-4 pb-4 pt-2 text-card-foreground shadow-sm"
        style={{ bottom: "var(--tabbar-h, 0px)" }}
      >
        <div className="sticky top-0 -mx-4 flex items-center justify-between bg-card px-4 pb-1 pt-1">
          <span aria-hidden="true" className="mx-auto h-1.5 w-11 rounded-full bg-border" />
          <button type="button" onClick={close} aria-label={t({ message: "Close paths", context: "the phone's Paths sheet: close button" })} className="absolute right-2 top-0 inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground">
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        {eyebrow ? <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-notice">{eyebrow}</p> : null}
        <h2 id="paths-sheet-h" className="mt-1 font-display text-2xl leading-tight text-foreground">{heading}</h2>
        {page && cards.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t({ message: "No paths are open yet.", context: "the phone's Paths sheet: when the village shows none" })}</p>
        ) : null}
        <ul className="mt-3 grid gap-2" data-paths-list="">
          {cards.map((card) => {
            const art = brand[card.look.imageKey];
            const Icon = card.look.icon;
            return (
              <li key={card.id}>
                <Link
                  href={pathCardHref(card, founding)}
                  onClick={close}
                  data-path-door={card.id}
                  className="flex min-h-16 items-center gap-3 rounded-xl border border-border bg-muted p-2 pr-3 text-foreground hover:border-notice focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <span className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-card">
                    {art ? (
                      // Decorative: the link's words name the path.
                      <img src={art} alt="" loading="lazy" className="size-full object-cover" style={{ objectPosition: artFocusOr(brand[card.look.focusKey]) }} />
                    ) : (
                      <span className="flex size-full items-center justify-center text-notice"><Icon aria-hidden="true" className="size-7" /></span>
                    )}
                  </span>
                  <span className="grid min-w-0 flex-1">
                    <span className="font-display text-lg leading-tight">{card.title}</span>
                    {card.subtitle ? <span className="text-sm text-muted-foreground">{card.subtitle}</span> : null}
                  </span>
                  <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
