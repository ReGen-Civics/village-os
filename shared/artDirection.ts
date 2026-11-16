/**
 * A VILLAGE'S ART DIRECTION (gap G9), in one place every image tool reads.
 *
 * The identity pack (Admin, Make it yours, Identity pack) already held who the
 * village is visually and what it never shows. It now also holds the medium,
 * the palette in words and the subjects, so a prompt for a quest poster, a rite
 * stamp or a portrait is built from the village's own direction instead of the
 * platform's guess. Blank fields add nothing: a village that wrote nothing gets
 * a clause that says nothing, never another village's style.
 *
 * Text only, clipped, and always placed in a prompt as data about the picture.
 */

export const ART_FIELD_MAX = { medium: 600, palette: 400, subjects: 800, description: 2000, never: 1000 } as const;
export type ArtField = keyof typeof ART_FIELD_MAX;

export type ArtDirection = Record<ArtField, string>;

const clean = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, max) : "";

/** The art direction a stored identity pack carries, every field cleaned and clipped. */
export function artDirectionOf(pack: unknown): ArtDirection {
  const p = (pack && typeof pack === "object" ? pack : {}) as Record<string, unknown>;
  return {
    medium: clean(p.medium, ART_FIELD_MAX.medium),
    palette: clean(p.palette, ART_FIELD_MAX.palette),
    subjects: clean(p.subjects, ART_FIELD_MAX.subjects),
    description: clean(p.description, ART_FIELD_MAX.description),
    never: clean(p.never, ART_FIELD_MAX.never),
  };
}

/**
 * The clause an image prompt carries, one labelled line per field the village
 * filled. `colourWords` is the theme's palette in words when a caller has it,
 * used only where the village wrote no palette of its own.
 */
export function artPromptClause(d: ArtDirection, colourWords?: string): string {
  const lines: string[] = [];
  if (d.medium) lines.push(`Medium: ${d.medium}`);
  if (d.description) lines.push(`The village, visually: ${d.description}`);
  const palette = d.palette || (colourWords ?? "").trim();
  if (palette) lines.push(`Palette: ${palette}`);
  if (d.subjects) lines.push(`Subjects: ${d.subjects}`);
  if (d.never) lines.push(`Never show: ${d.never}`);
  return lines.join("\n");
}
