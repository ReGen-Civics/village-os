/**
 * Admin → Menu → Module entries (the lead, 27 Nov 2026: "all module menu items are up for the village to determine
 * where in the menu they would like them to be and what their name would be").
 *
 * Every module's menu entry, each with its name, its place and a preview of the group it lands in (ModuleMenuFields),
 * beside the folder names. Edits go into the menu document MenuPanel holds and save with the rest of it, through the
 * same route and the same rules. A module that is off keeps its place for the day it comes on. Drawn like the
 * Menu panel it sits in: the page's semantic tokens, which Admin keeps light unless its night is chosen.
 */
import { useLingui } from "@lingui/react/macro";
import { navWord } from "@/config/nav";
import { useModules } from "@/modules/ModuleProvider";
import type { MenuDoc } from "@shared/menuDoc";
import { MODULE_MENU, choiceOf, withChoices, type MenuChoice } from "@shared/moduleMenu";
import ModuleMenuFields from "./ModuleMenuFields";

export default function ModuleMenuList({ doc, setDoc }: { doc: MenuDoc; setDoc: (d: MenuDoc) => void }) {
  const { t, i18n } = useLingui();
  const { modules } = useModules();
  const on = (id: string) => modules.some((m) => m.id === id);
  const change = (c: MenuChoice) => {
    // The place through the rules' own helper; the name exactly as typed, so a space between two words survives.
    const next = withChoices(doc, [c]);
    const labels = { ...doc.labels };
    if (c.label) labels[c.href] = c.label;
    else delete labels[c.href];
    setDoc({ ...next, labels });
  };
  const toggleHidden = (href: string, hide: boolean) => setDoc({ ...doc, hidden: hide ? [...doc.hidden, href] : doc.hidden.filter((h) => h !== href) });

  return (
    <section aria-labelledby="module-menu-entries" className="mb-4">
      <p id="module-menu-entries" className="text-sm font-medium text-foreground mb-1">
        {t({ message: "Module entries", context: "admin menu: the modules' own menu entries" })}
      </p>
      <p className="text-xs text-muted-foreground mb-3 max-w-prose">
        {t({
          message: "Each module brings its own entry. Name it and choose where it sits: a group, a folder in it, and its place among the rows. The preview shows the group as members will meet it. Blank keeps the module's own name.",
          context: "admin menu: the module entries, explained",
        })}
      </p>
      <ul className="grid gap-3 lg:grid-cols-2 list-none p-0 m-0">
        {MODULE_MENU.map((entry) => {
          const name = navWord(entry.label, i18n);
          const off = !on(entry.module);
          return (
            <li key={entry.href} className="rounded-xl border border-border bg-card p-4 text-foreground" data-module-entry={entry.href}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-semibold">{name}</span>
                <span className="font-mono text-xs text-muted-foreground">{entry.href}</span>
                {off ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">{t({ message: "Module off", context: "admin menu: a module entry whose module is off" })}</span> : null}
                <label className="ml-auto flex min-h-11 items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" checked={!doc.hidden.includes(entry.href)} onChange={(e) => toggleHidden(entry.href, !e.target.checked)} />
                  {t({ message: "Shown", context: "admin menu: whether a module entry shows in the menu" })}
                </label>
              </div>
              <ModuleMenuFields entry={entry} doc={doc} choice={choiceOf(entry, doc)} onChange={change} on={on} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
