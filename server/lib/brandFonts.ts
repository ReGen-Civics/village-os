/**
 * A VILLAGE'S OWN FACES, MORE THAN ONE (gap G2).
 *
 * The upload route used to hold one face (`fontFaceName` / `fontFaceUrl`) and
 * always made it the heading face. A village whose type is a display face, a
 * body face, an accent and a label face (four roles) could set one of them.
 * Now each upload names the role it fills, and the brand keeps one face per
 * role in `theme.fontFaces` (four at most); the role's stack puts the face
 * first, keeping whatever it had behind it as the fallback.
 *
 * The heading upload still writes the one-face fields too, so a reader that
 * only knows them (and every village that uploaded before this) keeps working,
 * and themeCss emits each face once.
 */

export const FONT_ROLES = ["display", "body", "accent", "label"] as const;
export type FontFaceRole = (typeof FONT_ROLES)[number];

export interface UploadedFace {
  family: string;
  url: string;
  role: FontFaceRole;
  /** The weight range the file covers, "400" or "100 900". */
  weight: string;
}

export function fontRoleOf(raw: unknown): FontFaceRole {
  return (FONT_ROLES as readonly string[]).includes(String(raw)) ? (String(raw) as FontFaceRole) : "display";
}

/** "400", "100 900": weights 100 to 900, in hundreds, low first. Anything else is the full range. */
export function fontWeightOf(raw: unknown): string {
  const m = /^\s*([1-9]00)(?:\s+([1-9]00))?\s*$/.exec(String(raw ?? ""));
  if (!m) return "100 900";
  const lo = Number(m[1]);
  const hi = m[2] ? Number(m[2]) : lo;
  return lo === hi ? String(lo) : `${Math.min(lo, hi)} ${Math.max(lo, hi)}`;
}

const STACK_FIELD: Record<Exclude<FontFaceRole, "label">, "fontDisplay" | "fontBody" | "fontAccent"> = {
  display: "fontDisplay",
  body: "fontBody",
  accent: "fontAccent",
};
const DEFAULT_STACK: Record<FontFaceRole, string> = {
  display: '"Raleway", system-ui, sans-serif',
  body: "system-ui, sans-serif",
  accent: "cursive",
  label: "Georgia, serif",
};

/** A stack with `family` first, the rest of `previous` behind it, and the family never twice. */
function withFamilyFirst(family: string, previous: string | undefined, role: FontFaceRole): string {
  const rest = String(previous || DEFAULT_STACK[role])
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && s.replace(/^["']|["']$/g, "") !== family);
  return [`"${family}"`, ...rest].join(", ");
}

/**
 * The theme after one upload: the face kept for its role (replacing that
 * role's earlier face), the role's stack led by it, and for the heading the
 * one-face fields as before.
 */
export function withUploadedFace(theme: Record<string, any>, face: UploadedFace): Record<string, any> {
  const faces: UploadedFace[] = Array.isArray(theme.fontFaces) ? theme.fontFaces.filter((f: any) => f && f.role !== face.role) : [];
  const next: Record<string, any> = { ...theme, fontFaces: [...faces, face].slice(-FONT_ROLES.length) };
  if (face.role === "label") {
    const tokens = theme.tokens && typeof theme.tokens === "object" ? theme.tokens : {};
    next.tokens = { ...tokens, "font-label": withFamilyFirst(face.family, tokens["font-label"], "label") };
  } else {
    const field = STACK_FIELD[face.role];
    next[field] = withFamilyFirst(face.family, theme[field], face.role);
  }
  if (face.role === "display") {
    next.fontFaceName = face.family;
    next.fontFaceUrl = face.url;
  }
  return next;
}
