/**
 * "IN THE MENU AS" AND "WHERE", WHILE A MODULE IS BEING TURNED ON (the lead, 27 Nov 2026: "when you turn a module on,
 * you actually say what its name is going to be we give it a default name and where in the menu it will show up").
 *
 * For each module the plan turns on that brings a menu entry (shared/moduleMenu.ts), the entry's name and place as
 * they stand (the default, or what the village already chose), editable before the person confirms. The caller saves
 * them after the module is on (lib/moduleMenuApi.ts); kept as they are, nothing is written.
 *
 * `readOnly` is for a turn-on the village votes on: the proposer reads where the entry will appear, and the village
 * renames or moves it afterwards in Admin, Menu.
 *
 * Its own chunk: the menu's whole shape and rules come with it, and only someone turning a module on loads them.
 */
import { useEffect, useMemo, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { navWord } from "@/config/nav";
import { useModules } from "@/modules/ModuleProvider";
import { MENU_ACCOUNT } from "@shared/menuPlace";
import type { MenuDoc } from "@shared/menuDoc";
import { choiceOf, choicesAllowed, moduleMenuFor, withChoices, type MenuChoice } from "@shared/moduleMenu";
import ModuleMenuFields from "./ModuleMenuFields";
import { loadMenuDoc } from "@/lib/moduleMenuApi";

export interface MenuPlaceStepProps {
  /** The modules being turned on. Only those with a menu entry draw anything. */
  ids: readonly string[];
  /** The choices as they stand, and whether the menu's rules allow them, whenever either changes. */
  onChoices?: (choices: MenuChoice[], allowed: boolean) => void;
  readOnly?: boolean;
}

export default function MenuPlaceStep({ ids, onChoices, readOnly = false }: MenuPlaceStepProps) {
  const { t, i18n } = useLingui();
  // The preview counts what is on now (ModuleProvider), and these modules as on.
  const { modules } = useModules();
  const key = ids.join(",");
  const entries = useMemo(() => key.split(",").filter(Boolean).flatMap((id) => moduleMenuFor(id)), [key]);
  const [doc, setDoc] = useState<MenuDoc | null>(null);
  const [choices, setChoices] = useState<MenuChoice[]>([]);
  useEffect(() => {
    let alive = true;
    void loadMenuDoc().then((d) => {
      if (!alive) return;
      setDoc(d);
      setChoices(entries.map((e) => choiceOf(e, d)));
    });
    return () => {
      alive = false;
    };
  }, [entries]);
  useEffect(() => {
    if (doc) onChoices?.(choices, choicesAllowed(doc, choices));
  }, [doc, choices, onChoices]);

  if (!entries.length || !doc) return null;
  const quiet = "text-sm text-muted-foreground";
  const head = "font-semibold text-foreground";
  const card = "rounded-xl border border-border bg-card p-4 space-y-4";
  const groupWord = (g: string) => (g === MENU_ACCOUNT ? t({ message: "your account menu", context: "module menu place: the account menu, mid-sentence" }) : doc.groups[g] || navWord(g, i18n));

  if (readOnly) {
    return (
      <div className={card} data-menu-place-step="read">
        {choices.map((c) => {
          const entry = entries.find((e) => e.href === c.href)!;
          const name = c.label || navWord(entry.label, i18n);
          const where = c.place.sub ? `${groupWord(c.place.group)}, ${doc.folders[c.place.sub] || navWord(c.place.sub, i18n)}` : groupWord(c.place.group);
          return (
            <p key={c.href} className={quiet}>
              {t({ message: `In the menu as ${name}, in ${where}.`, context: "module menu place: where a module's entry will appear, read-only" })}
            </p>
          );
        })}
        <p className={quiet}>{t({ message: "Once it is on, the village can rename it or move it in Admin, Menu.", context: "module menu place: changing it later" })}</p>
      </div>
    );
  }

  return (
    <div className={card} data-menu-place-step="edit">
      <div>
        <p className={head}>{t({ message: "In the menu", context: "module menu place: the turn-on step's heading" })}</p>
        <p className={quiet}>
          {t({ message: "Its name and where it shows. Keep them, or make them the village's own. You can change both later in Admin, Menu.", context: "module menu place: the turn-on step, explained" })}
        </p>
      </div>
      {choices.map((c, i) => {
        const entry = entries.find((e) => e.href === c.href)!;
        // Every other entry's choice is part of the menu this one is placed in.
        const withOthers = withChoices(doc, choices.filter((_, j) => j !== i));
        return (
          <ModuleMenuFields
            key={c.href}
            entry={entry}
            doc={withOthers}
            choice={c}
            onChange={(next) => setChoices((all) => all.map((x) => (x.href === next.href ? next : x)))}
            on={(m) => ids.includes(m) || modules.some((x) => x.id === m)}
          />
        );
      })}
    </div>
  );
}
