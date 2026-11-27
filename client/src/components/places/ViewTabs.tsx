/**
 * A row of tabs that behaves like tabs: Left and Right move between them,
 * Home and End jump to the ends, and only the chosen tab sits in the Tab
 * order, so a keyboard reader steps past the row in one press. Choosing
 * follows focus. The Places page's views and the curators' queue states
 * both draw with it.
 */
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { TAB, TAB_ON } from "@/components/journey/look";

export interface ViewTab<K extends string> {
  key: K;
  label: ReactNode;
}

/** The id of a tab and of the panel it controls, so a page can label its panel. */
export const tabId = (prefix: string, key: string) => `${prefix}-tab-${key}`;
export const panelId = (prefix: string, key: string) => `${prefix}-panel-${key}`;

export default function ViewTabs<K extends string>({
  tabs,
  value,
  onChange,
  label,
  idPrefix,
}: {
  tabs: ViewTab<K>[];
  value: K;
  /** `how` says whether a key or a press chose it: a page may record a press in the history and not each arrow step. */
  onChange: (key: K, how: "key" | "press") => void;
  label: string;
  idPrefix: string;
}) {
  const refs = useRef(new Map<string, HTMLButtonElement>());

  const go = (i: number) => {
    const next = tabs[(i + tabs.length) % tabs.length];
    onChange(next.key, "key");
    refs.current.get(next.key)?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key === "ArrowRight") go(i + 1);
    else if (e.key === "ArrowLeft") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(tabs.length - 1);
    else return;
    e.preventDefault();
  };

  return (
    <div role="tablist" aria-label={label} className="flex gap-1 rounded-xl border border-border bg-card p-1 shadow-sm sm:inline-flex">
      {tabs.map((tab, i) => {
        const on = tab.key === value;
        return (
          <button
            key={tab.key}
            ref={(el) => {
              if (el) refs.current.set(tab.key, el);
              else refs.current.delete(tab.key);
            }}
            type="button"
            role="tab"
            id={tabId(idPrefix, tab.key)}
            aria-controls={panelId(idPrefix, tab.key)}
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(tab.key, "press")}
            onKeyDown={(e) => onKey(e, i)}
            className={on ? TAB_ON : TAB}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
