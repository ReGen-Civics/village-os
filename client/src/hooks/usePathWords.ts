import { useMemo } from "react";
import { useVillageDocFields } from "@/hooks/useVillageDocTranslation";
import { overlayVillageDoc } from "@shared/villageDocTranslation";
import { GAME_CONFIG } from "@shared/gameConfig";

/**
 * THE VILLAGE'S PATH NAMES IN THE READER'S LANGUAGE (the lead's Spanish audit, 26 Nov 2026).
 *
 * A village names its four paths in Admin, Paths & Stages; the translation of those names is the village
 * document "paths" (shared/villageDocTranslation.ts), addressed `<pathId>.label`, `.role` and `.description`.
 * Every place that draws the village's path words reads them through here: the menu's journey rows, the bottom
 * bar, the join form and the page boxes that name a path. English asks nothing.
 */
type PathWords = { id: string; label: string; role?: string; description?: string };

/** `paths` with each translated name, second line and sentence laid over it; the same array when there are none. */
export function translatedPaths<P extends PathWords>(paths: P[], fields: Readonly<Record<string, string>>): P[] {
  if (!Object.keys(fields).length) return paths;
  return (overlayVillageDoc("paths", { paths }, fields) as { paths: P[] }).paths;
}

/**
 * `menu` with a journey row's words translated where the row shows the village's path words unchanged: its name
 * as the label, its second line as the subtitle. A row the village wrote its own words for is the site page's
 * translation to give (useSiteMenuWords), so it is left as it is.
 */
export function translatedPathRows<M extends Record<string, { label: string; subtitle: string }> | undefined>(
  menu: M,
  paths: readonly PathWords[] | undefined,
  fields: Readonly<Record<string, string>>,
): M {
  if (!menu || !paths?.length || !Object.keys(fields).length) return menu;
  let out: Record<string, { label: string; subtitle: string }> | null = null;
  for (const p of paths) {
    const route = GAME_CONFIG.paths.find((g) => g.id === p.id)?.route;
    const row = route ? (menu[route] ?? menu[route.replace(/^\//, "")]) : undefined;
    if (!route || !row) continue;
    const label = row.label === p.label ? fields[`${p.id}.label`]?.trim() : undefined;
    const subtitle = p.role && row.subtitle === p.role ? fields[`${p.id}.role`]?.trim() : undefined;
    if (!label && !subtitle) continue;
    out ??= { ...menu };
    const key = menu[route] ? route : route.replace(/^\//, "");
    out[key] = { label: label || row.label, subtitle: subtitle || row.subtitle };
  }
  return (out ?? menu) as M;
}

/** The translated fields of the village's path names in the reader's language ({} in English). */
export function usePathFields(): Readonly<Record<string, string>> {
  return useVillageDocFields("paths");
}

/** `paths` in the reader's language. */
export function usePathsInLanguage<P extends PathWords>(paths: P[]): P[];
export function usePathsInLanguage<P extends PathWords>(paths: P[] | null): P[] | null;
export function usePathsInLanguage<P extends PathWords>(paths: P[] | null): P[] | null {
  const fields = usePathFields();
  return useMemo(() => (paths ? translatedPaths(paths, fields) : paths), [paths, fields]);
}
