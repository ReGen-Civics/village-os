/**
 * ADD A CARD: the picker a "+" slot opens (SpeedCards.tsx). A search field over every page the menu offers this
 * member, grouped the way the menu groups them (Village, Community, Governance, Join, About, then Yours), with the
 * pages this device opens most at the top. Tap one and it fills the slot. A page already on the cards says so and
 * cannot be added twice.
 *
 * Loaded only when a "+" is tapped, so the sheet itself stays small.
 */
import { useEffect, useRef, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { Search, X } from "lucide-react";
import MenuIcon from "@/components/nav/MenuIcon";
import { searchCards, type Registry, type SpeedCard } from "@/lib/speedCards/registry";

/** How many of the pages this device opens most the picker offers first. */
const SUGGESTED = 3;

export interface SpeedCardPickerProps {
  reg: Registry;
  /** The ids on the cards now. */
  kept: readonly string[];
  onPick: (id: string) => void;
  onClose: () => void;
}

export default function SpeedCardPicker({ reg, kept, onPick, onClose }: SpeedCardPickerProps) {
  const { t } = useLingui();
  const [query, setQuery] = useState("");
  const [often, setOften] = useState<string[]>([]);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => field.current?.focus(), []);
  useEffect(() => {
    let live = true;
    // The device's own history (lib/navVisits.ts), read here and never sent. Only pages this member may keep.
    void import("@/lib/navVisits")
      .then((m) => m.mostVisited(kept, 20).filter((p) => reg.byId.has(p)).slice(0, SUGGESTED))
      .then((p) => live && setOften(p))
      .catch(() => undefined);
    return () => {
      live = false;
    };
    // Asked once, as the picker opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const found = query.trim() ? searchCards(reg, query) : null;
  const groups: { label: string; cards: readonly SpeedCard[] }[] = found
    ? reg.groups.map((g) => ({ label: g.label, cards: found.filter((c) => c.group === g.label) })).filter((g) => g.cards.length)
    : [
        ...(often.length
          ? [{ label: t({ message: "You open most", context: "the speed-card picker: the pages this device opens most" }), cards: often.flatMap((id) => reg.byId.get(id) ?? []) }]
          : []),
        ...reg.groups,
      ];
  const has = new Set(kept);
  const eyebrow = "text-xs font-semibold uppercase tracking-widest text-notice";

  return (
    <div
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <button type="button" tabIndex={-1} aria-hidden="true" onClick={onClose} className="fixed inset-0 z-[75] cursor-default bg-black/45" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="speed-pick-title"
        data-speed-picker=""
        className="fixed inset-x-0 bottom-0 top-[12svh] z-[80] flex flex-col rounded-t-2xl border-t border-border bg-card text-card-foreground shadow-sm"
      >
        <div className="flex items-center justify-between gap-2 px-4 pt-3">
          <h2 id="speed-pick-title" className="font-display text-xl font-bold text-card-foreground">
            <Trans context="the speed-card picker: its heading">Add a card</Trans>
          </h2>
          <button type="button" onClick={onClose} aria-label={t({ message: "Close", context: "the speed-card picker: close button, read aloud" })} className="inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <label className="relative mx-4 mt-2 block">
          <span className="sr-only"><Trans context="the speed-card picker: the search field's label">Find a page</Trans></span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={field}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t({ message: "Find a page", context: "the speed-card picker: the search field's hint" })}
            className="min-h-11 w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <div className="mt-2 flex-1 overflow-y-auto px-4 pb-6" data-speed-pick-list="">
          {groups.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground" role="status">
              <Trans context="the speed-card picker: a search with no match">Nothing matches. Try another word.</Trans>
            </p>
          ) : (
            groups.map((g) => (
              <section key={g.label} className="mt-3" aria-label={g.label}>
                <h3 className={eyebrow}>{g.label}</h3>
                <ul className="mt-1 divide-y divide-border/60">
                  {g.cards.map((c) => {
                    const on = has.has(c.id);
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          disabled={on}
                          onClick={() => onPick(c.id)}
                          data-speed-pick={c.id}
                          className="flex min-h-11 w-full items-center gap-3 py-2 text-left text-sm text-foreground hover:text-notice focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default disabled:text-muted-foreground disabled:hover:text-muted-foreground"
                        >
                          {c.href ? <MenuIcon href={c.href} fallback={c.icon} /> : c.icon ? <c.icon className="size-5 shrink-0" /> : <span aria-hidden="true" className="size-5 shrink-0" />}
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="font-medium">{c.label}</span>
                            {c.sub ? <span className="text-xs text-muted-foreground">{c.sub}</span> : null}
                          </span>
                          {on ? (
                            <span className="text-xs font-semibold text-muted-foreground">
                              <Trans context="the speed-card picker: this page is already one of the member's cards">On your cards</Trans>
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
