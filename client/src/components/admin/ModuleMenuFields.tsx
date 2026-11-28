/**
 * ONE MODULE ENTRY'S NAME AND PLACE IN THE MENU, WITH A LIVE PREVIEW (the lead, 27 Nov 2026: "when you turn a module on,
 * you actually say what its name is going to be ... and where in the menu it will show up").
 *
 * The same fields wherever a name and a place are chosen: turning a module on (TurnOnAction.tsx, ModuleStewardPanel.tsx)
 * and later in Admin, Menu (ModuleMenuList.tsx). "In the menu as" starts on the name in force, "Where" on the place in
 * force, and the preview draws that group's rows as a member would meet them, this entry marked. A place the menu's
 * rules refuse (shared/moduleMenu.ts) says why under the fields, in the reader's language, and the save refuses it too.
 *
 * Drawn in the page's semantic tokens (the palette ratchet refuses new numbered colours, Admin's included), so it sits
 * in Admin, Menu and on the module page alike.
 */
import { useMemo } from "react";
import { useLingui } from "@lingui/react/macro";
import { NAV, isGroup, navWord, type NavLink } from "@/config/nav";
import { navRows } from "@/config/navNest";
import { placedMenu } from "@/config/navPlaces";
import { useGameConfig } from "@/lib/gameApi";
import { storyPageShown } from "@/lib/brochure";
import { MENU_ACCOUNT, type MenuPlace } from "@shared/menuPlace";
import { MENU_LABEL_MAX, type MenuDoc } from "@shared/menuDoc";
import { FOLDER_MAX, MENU_SHAPE, foldersOf, positionSlots, problemsFor, withChoices, type MenuChoice, type ModuleMenuEntry } from "@shared/moduleMenu";

const GROUP_KEYS = [...NAV.filter(isGroup).map((g) => g.label), MENU_ACCOUNT];
const SEP = "::";
// The page's own tokens, in Admin and on the module page alike: Admin keeps them light unless its night is chosen.
const LABEL = "block text-sm font-medium text-foreground";
const INPUT = "mt-1 block w-full min-h-11 rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-foreground";

export interface ModuleMenuFieldsProps {
  entry: ModuleMenuEntry;
  /** The village's menu document as it stands, every other choice in it. */
  doc: MenuDoc;
  choice: MenuChoice;
  onChange: (c: MenuChoice) => void;
  /** Whether a module is on, for the preview. This entry's own module counts as on. Absent: every module on. */
  on?: (moduleId: string) => boolean;
}

export default function ModuleMenuFields({ entry, doc, choice, onChange, on }: ModuleMenuFieldsProps) {
  const { t, i18n } = useLingui();
  const cfg = useGameConfig();

  const platformName = navWord(entry.label, i18n);
  const groupName = (g: string) => (g === MENU_ACCOUNT ? t({ message: "Your account menu", context: "module menu place: the account menu as a place" }) : doc.groups[g] || navWord(g, i18n));
  const folderName = (f: string) => doc.folders[f] || navWord(f, i18n);
  const nameOf = (l: NavLink) => (l.href === entry.href ? choice.label.trim() || doc.labels[l.href] || platformName : doc.labels[l.href] || navWord(l.label, i18n));
  const isOn = (m?: string) => !m || m === entry.module || (on ? on(m) : true);
  const shows = (l: NavLink) =>
    l.href === entry.href ||
    (!doc.hidden.includes(l.href) && isOn(l.module) && (!l.unlessModule || !isOn(l.unlessModule)) && (!l.brochure || storyPageShown(cfg, l.story ?? l.href)));

  const next = useMemo(() => withChoices(doc, [choice]), [doc, choice]);
  const placed = useMemo(() => placedMenu(next.places), [next.places]);
  const placedGroup = placed.nav.find((e) => isGroup(e) && e.label === choice.place.group);
  const targetItems: readonly NavLink[] = choice.place.group === MENU_ACCOUNT ? placed.account : placedGroup && isGroup(placedGroup) ? placedGroup.items : [];
  const rows = navRows(targetItems.filter(shows));

  const slots = positionSlots(targetItems, entry.href, choice.place.sub).map((s) => ({ at: s.at, after: s.after ? (s.after.sub && !choice.place.sub ? folderName(s.after.sub) : nameOf(s.after as NavLink)) : null }));
  const at = choice.place.at ?? slots[slots.length - 1]?.at ?? 0;
  const problems = problemsFor(next, entry.href, choice.place);
  const said = problems.map((p) => {
    if (p.code === "rows") {
      const group = groupName(p.group!);
      const count = p.count!;
      const max = p.max!;
      return t({ message: `${group} would show ${count} rows once every module is on, and it shows ${max} at most. Choose one of its folders, or another group.`, context: "module menu place: a group would be too long" });
    }
    if (p.code === "folder-full") {
      const folder = folderName(p.folder!);
      const count = p.count!;
      return t({ message: `The ${folder} folder would hold ${count} entries once every module is on, and a folder holds ${FOLDER_MAX} at most. Choose another folder, or a row of its own.`, context: "module menu place: a folder would be too full" });
    }
    if (p.code === "library-last") return t({ message: "The Module Library stays at the bottom of the menu. Choose a place above it.", context: "module menu place: below the Module Library" });
    return p.sentence;
  });

  const shownGroup = groupName(choice.place.group);
  // One preview line; this entry is marked.
  const here = (l: NavLink) => l.href === entry.href;
  const line = (l: NavLink) => (
    <li key={l.href} className={here(l) ? "font-semibold underline decoration-2 underline-offset-4" : undefined} data-here={here(l) ? "" : undefined}>
      {nameOf(l)}
    </li>
  );
  const setPlace = (place: MenuPlace) => onChange({ ...choice, place });

  return (
    <fieldset className="space-y-3" data-menu-place={entry.href}>
      <label className={LABEL}>
        {t({ message: "In the menu as", context: "module menu place: the entry's name field" })}
        <input
          value={choice.label}
          onChange={(e) => onChange({ ...choice, label: e.target.value.slice(0, MENU_LABEL_MAX) })}
          placeholder={doc.labels[entry.href] || platformName}
          className={INPUT}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={LABEL}>
          {t({ message: "Where", context: "module menu place: the group or folder picker" })}
          <select
            value={`${choice.place.group}${SEP}${choice.place.sub ?? ""}`}
            onChange={(e) => {
              const [group, sub] = e.target.value.split(SEP) as [string, string];
              setPlace({ group, ...(sub ? { sub } : {}) });
            }}
            className={INPUT}
          >
            {GROUP_KEYS.map((g) => {
              const group = groupName(g);
              return (
                <optgroup key={g} label={group}>
                  <option value={`${g}${SEP}`}>{t({ message: `${group}, a row of its own`, context: "module menu place: a group, not in a folder" })}</option>
                  {foldersOf(g, MENU_SHAPE).map((f) => (
                    <option key={f} value={`${g}${SEP}${f}`}>{`${group}, ${folderName(f)}`}</option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </label>
        <label className={LABEL}>
          {t({ message: "Position", context: "module menu place: the position picker" })}
          <select value={String(at)} onChange={(e) => setPlace({ ...choice.place, at: Number(e.target.value) })} className={INPUT}>
            {slots.map((s) => {
              const after = s.after;
              return (
                <option key={s.at} value={String(s.at)}>
                  {after === null ? t({ message: "First", context: "module menu place: the first position" }) : t({ message: `After ${after}`, context: "module menu place: a position after another row" })}
                </option>
              );
            })}
          </select>
        </label>
      </div>
      <div className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground">
        <p className="text-xs text-muted-foreground">
          {t({ message: `${shownGroup} will read`, context: "module menu place: the preview's heading" })}
        </p>
        <ol className="mt-1 space-y-0.5 list-none p-0 m-0" data-menu-preview={choice.place.group}>
          {rows.map((r) =>
            r.kind === "link" ? (
              line(r.link)
            ) : (
              <li key={`f-${r.label}`}>
                {folderName(r.label)}
                <ul className="ml-4 list-none p-0">{r.links.map(line)}</ul>
              </li>
            ),
          )}
        </ol>
      </div>
      {said.length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          {said[0]}
        </p>
      )}
    </fieldset>
  );
}
