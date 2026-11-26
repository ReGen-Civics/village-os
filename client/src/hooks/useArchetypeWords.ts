import { useMemo } from "react";
import { useVillageDocFields } from "@/hooks/useVillageDocTranslation";
import { overlayVillageDoc } from "@shared/villageDocTranslation";

/**
 * THE VILLAGE'S FIVE CLASSES IN THE READER'S LANGUAGE (the lead's Spanish audit, 26 Nov 2026).
 *
 * A village names its classes (/api/archetypes, public); their translation is the village document "archetypes"
 * (shared/villageDocTranslation.ts), addressed `<key>.name`, `.subtitle`, `.blurb` and `<key>.examples.<n>`.
 * Every page that draws a class reads its list through here, in whatever shape it keeps (the whole row, or just
 * a key and a name): a row is matched by its `key`, and only the words it carries are replaced.
 */
export function archetypesInLanguage<A extends { key: string }>(list: A[], fields: Readonly<Record<string, string>>): A[] {
  if (!list.length || !Object.keys(fields).length) return list;
  return (overlayVillageDoc("archetypes", { archetypes: list }, fieldsFor(list, fields)) as { archetypes: A[] }).archetypes;
}

/** Only the fields a row already carries, so a `{ key, name }` row never grows a blurb. */
function fieldsFor(list: readonly { key: string }[], fields: Readonly<Record<string, string>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [f, text] of Object.entries(fields)) {
    const [key, word] = f.split(".");
    const row = list.find((a) => a.key === key) as Record<string, unknown> | undefined;
    if (row && word in row) out[f] = text;
  }
  return out;
}

export function useArchetypesInLanguage<A extends { key: string }>(list: A[]): A[];
export function useArchetypesInLanguage<A extends { key: string }>(list: A[] | null): A[] | null;
export function useArchetypesInLanguage<A extends { key: string }>(list: A[] | null): A[] | null {
  const fields = useVillageDocFields("archetypes");
  return useMemo(() => (list ? archetypesInLanguage(list, fields) : list), [list, fields]);
}

/** A key -> name map (useClassNames) with each translated name laid over it. */
export function useClassNamesInLanguage(names: Record<string, string> | null): Record<string, string> | null {
  const fields = useVillageDocFields("archetypes");
  return useMemo(() => {
    if (!names) return names;
    let out: Record<string, string> | null = null;
    for (const key of Object.keys(names)) {
      const said = fields[`${key}.name`]?.trim();
      if (said) (out ??= { ...names })[key] = said;
    }
    return out ?? names;
  }, [names, fields]);
}
