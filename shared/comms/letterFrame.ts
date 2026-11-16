/**
 * THE LETTER FRAME: the shared HTML shell for a letter the village writes by
 * hand in code (an applicant's answer, a join request's answer), and the
 * palette the "come and play" block draws in (shared/comms/comeAndPlay.ts).
 *
 * The comms module's templated emails keep their own frame
 * (`composeEmail` in shared/comms/letterHtml.ts), because their bodies come
 * from markdown with inline light colours. This frame is for letters whose
 * words come from code, so every colour in it is ours to swap for the night.
 *
 * WHAT IT IS, for the mail clients that matter:
 *
 *   - TABLE BASED, INLINE STYLES. One outer table, a 600 pixel column, every
 *     colour and size written on the element. Gmail, Apple Mail and Outlook
 *     (Word's engine included, through the `mso` conditionals) all draw it.
 *   - MOBILE FIRST. The column is fluid up to 600 pixels; the come-and-play
 *     cards are inline blocks that wrap to one column on a phone with no media
 *     query needed. The one media query only trims the side padding.
 *   - DARK MODE SAFE. `color-scheme: light dark`, and a `prefers-color-scheme`
 *     block (plus Outlook.com's `[data-ogsc]` twin) that swaps every surface to
 *     the village's NIGHT, the `--sheet-*` layer `deriveTheme` already derives
 *     from the seed for the role card and the character sheet. A client that
 *     ignores the block keeps the light letter, which is whole on its own.
 *   - ACCESSIBLE. `lang` on the document, `role="presentation"` on every
 *     layout table, alt text on every image, real text everywhere (the cards'
 *     pictures are emoji, which are text, and hidden from screen readers), and
 *     only colour pairs `deriveTheme` measured: white on the brand band, ink on
 *     the card, gold on the night.
 *   - ALWAYS A PLAIN-TEXT TWIN that carries every link the HTML does.
 *
 * NO VILLAGE IS NAMED HERE. The name, logo and colours arrive in
 * `EmailVillage`, read from the brand overlay by `loadEmailVillage`
 * (server/lib/comms/render.ts).
 *
 * Pure and isomorphic.
 */
import { deriveTheme } from "../brandTokens";
import type { EmailVillage, LetterScheme } from "./letterHtml";
import { escapeHtml, safeUrl } from "./mergeFields";

// ── The palette ─────────────────────────────────────────────────────────────

/** Every colour the frame and the block draw, by day and by night. */
export interface LetterPalette {
  day: {
    page: string;
    card: string;
    ink: string;
    muted: string;
    /** Links, the button, accents. White clears AA on it. */
    brand: string;
    /** The header band. White clears AA on it. */
    band: string;
    /** The accent that reads as text on the band. */
    bandAccent: string;
    /** The come-and-play section's wash. */
    wash: string;
    /** The circle behind a card's picture. */
    dot: string;
    line: string;
  };
  night: {
    page: string;
    card: string;
    raised: string;
    ink: string;
    muted: string;
    /** The night's gold: links and the button. The night ground clears AA on it. */
    accent: string;
    accentText: string;
    line: string;
  };
  radiusPx: number;
  fontBody: string;
  fontDisplay: string;
  /** The display face's family name when it is a web font, for the one stylesheet link. */
  webFont: string | null;
  /** True for a village in the dark scheme: the night rules apply whatever the reader's mail app prefers. */
  alwaysNight?: boolean;
}

/** System fonts: the only faces nearly every mail client draws. */
export const SYSTEM_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** The look with no seed: neutral greys by day, a soft charcoal and warm gold by night. Belongs to nobody. */
export const NEUTRAL_PALETTE: LetterPalette = {
  day: {
    page: "#f4f4f5",
    card: "#ffffff",
    ink: "#1f2328",
    muted: "#57606a",
    brand: "#404040",
    band: "#3a3a3d",
    bandAccent: "#e8d9b5",
    wash: "#f6f5f2",
    dot: "#ebe9e4",
    line: "#e4e4e7",
  },
  night: {
    page: "#111214",
    card: "#1a1b1e",
    raised: "#222327",
    ink: "#ececee",
    muted: "#a6a7ad",
    accent: "#e2c27d",
    accentText: "#111214",
    line: "#33353a",
  },
  radiusPx: 12,
  fontBody: SYSTEM_STACK,
  fontDisplay: `Georgia, 'Times New Roman', serif`,
  webFont: null,
};

const attrStack = (stack: string): string => stack.replace(/"/g, "'");

/** The first family in a stack, when it is a named web font (never a generic or a system face). */
function webFontOf(stack: string): string | null {
  const first = stack.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "") ?? "";
  if (!first || /^(system-ui|sans-serif|serif|cursive|monospace|georgia|-apple-system|blinkmacsystemfont)$/i.test(first)) return null;
  return /^[A-Za-z][A-Za-z ]{1,40}$/.test(first) ? first : null;
}

/** The village's palette, derived from its seed exactly as the site and the role card derive theirs. */
export function letterPalette(seed: string | null, character: string | null, scheme?: LetterScheme | null): LetterPalette {
  const derived = scheme
    ? deriveTheme(seed, character, scheme.accent, { mode: scheme.mode, overrides: scheme.overrides })
    : deriveTheme(seed, character);
  if (!derived) return NEUTRAL_PALETTE;
  const v = derived.vars;
  // A village in the dark scheme sends its letters in its own dark colours:
  // the night rules apply always (not only when the reader's mail app is
  // dark), drawn from the site's page, card, inks and primary. The day stays
  // the light derivation for the mail apps that drop a <style> block.
  if (derived.mode === "dark") {
    return {
      ...letterPalette(seed, character),
      night: {
        page: v["--background"],
        card: v["--card"],
        raised: v["--muted"],
        ink: v["--card-foreground"],
        muted: v["--muted-foreground"],
        accent: v["--primary"],
        accentText: v["--primary-foreground"],
        line: v["--border"],
      },
      alwaysNight: true,
    };
  }
  return {
    day: {
      page: v["--background"],
      card: "#ffffff",
      ink: v["--foreground"],
      muted: v["--muted-foreground"],
      brand: v["--tone-brand"],
      band: v["--tone-brand-band"],
      bandAccent: v["--tone-sun-on-band"],
      wash: v["--tone-cream"],
      dot: v["--tone-mist-light"],
      line: v["--border"],
    },
    night: {
      page: v["--sheet-ground"],
      card: v["--sheet-panel"],
      raised: v["--sheet-panel-raised"],
      ink: v["--sheet-ink"],
      muted: v["--sheet-ink-dim"],
      accent: v["--sheet-earned"],
      accentText: v["--sheet-ground"],
      line: v["--sheet-line"],
    },
    radiusPx: Math.max(8, Math.min(16, Math.round(derived.card.radiusRem * 16))),
    fontBody: SYSTEM_STACK,
    fontDisplay: `${attrStack(derived.fonts.display)}, Georgia, serif`,
    webFont: webFontOf(derived.fonts.display),
  };
}

// ── The night, as one style block ───────────────────────────────────────────

/**
 * The classes every piece of the frame and the block wears, and what each one
 * becomes at night. Written twice: once for `prefers-color-scheme` (Apple Mail,
 * iOS, Outlook for Mac) and once under `[data-ogsc]` (Outlook.com's dark mode).
 */
function nightRules(p: LetterPalette): string {
  const n = p.night;
  const rules: Array<[string, string]> = [
    [".vl-page", `background-color:${n.page} !important;`],
    [".vl-card", `background-color:${n.card} !important;border-color:${n.line} !important;`],
    [".vl-band", `background-color:${n.raised} !important;`],
    [".vl-wash", `background-color:${n.raised} !important;border-color:${n.line} !important;`],
    [".vl-tile", `background-color:${n.card} !important;border-color:${n.line} !important;`],
    [".vl-dot", `background-color:${n.raised} !important;`],
    [".vl-ink", `color:${n.ink} !important;`],
    [".vl-muted", `color:${n.muted} !important;`],
    [".vl-accent", `color:${n.accent} !important;`],
    [".vl-btn", `background-color:${n.accent} !important;border-color:${n.accent} !important;`],
    [".vl-btn-text", `color:${n.accentText} !important;`],
    [".vl-rule", `border-color:${n.line} !important;`],
  ];
  const plain = rules.map(([sel, body]) => `${sel}{${body}}`).join("\n");
  const ogsc = rules.map(([sel, body]) => `[data-ogsc] ${sel}{${body}}`).join("\n");
  if (p.alwaysNight) return `${plain}\n${ogsc}`;
  return `@media (prefers-color-scheme: dark){\n${plain}\n}\n${ogsc}`;
}

// ── Pieces ──────────────────────────────────────────────────────────────────

/** Hidden text that pads the preheader, so an inbox does not carry on into the body after it. */
const PREHEADER_PAD = "&#847;&zwnj;&nbsp;".repeat(30);

const oneLine = (s: string, max: number): string =>
  String(s ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

/** A link written out in a sentence, made clickable: escaped first, so nothing a value carries becomes markup. */
function linkify(escaped: string, colour: string): string {
  return escaped.replace(/https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)]/g, (url) => {
    const raw = url.replace(/&amp;/g, "&");
    const safe = safeUrl(raw);
    return safe ? `<a href="${escapeHtml(safe)}" class="vl-accent" style="color:${colour};text-decoration:underline;word-break:break-all;">${url}</a>` : url;
  });
}

/** A bulletproof button: a table cell carries the colour, so Outlook draws it too. */
export function buttonHtml(p: LetterPalette, label: string, url: string): string {
  const safe = safeUrl(url);
  if (!safe) return "";
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 8px 0;">
<tr><td class="vl-btn" align="center" bgcolor="${p.day.brand}" style="border-radius:999px;background-color:${p.day.brand};">
<a href="${escapeHtml(safe)}" class="vl-btn-text" style="display:inline-block;padding:14px 28px;font-family:${p.fontBody};font-size:16px;line-height:20px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
</td></tr>
</table>`;
}

export interface LetterBody {
  html: string;
  text: string;
}

/**
 * A letter's plain-text words as the frame's body: one paragraph per blank
 * line, each line kept, every address made a link. With a button, it sits
 * under the paragraph that carries its address, or at the end.
 */
export function bodyFromText(p: LetterPalette, text: string, button?: { label: string; url: string } | null): LetterBody {
  const paras = String(text ?? "")
    .split(/\n{2,}/)
    .map((para) => para.replace(/^\n+|\n+$/g, ""))
    .filter((para) => para.trim() !== "");
  const html = paras.map(
    (para) =>
      `<p class="vl-ink" style="margin:0 0 16px 0;font-family:${p.fontBody};font-size:16px;line-height:26px;color:${p.day.ink};">${para
        .split("\n")
        .map((line) => linkify(escapeHtml(line), p.day.brand))
        .join("<br>")}</p>`,
  );
  if (button) {
    const at = paras.findIndex((para) => para.includes(button.url));
    html.splice(at >= 0 ? at + 1 : html.length, 0, buttonHtml(p, button.label, button.url));
  }
  return { html: html.join("\n"), text: paras.join("\n\n") };
}

// ── The frame ───────────────────────────────────────────────────────────────

export interface LetterFrameInput {
  village: EmailVillage;
  /** The document's language, for screen readers and hyphenation. */
  lang?: string;
  subject: string;
  preheader?: string | null;
  body: LetterBody;
  /** Who signs: a team, never a person. Null leaves the signature out. */
  signature?: { signOff: string; team: string } | null;
  /** The come-and-play block, or any other section that follows the letter. */
  extra?: LetterBody | null;
  /** The footer's "why you got this" line. */
  why?: string | null;
  /** The reader's own preferences link, with its words. */
  preferences?: { label: string; url: string } | null;
  /** The palette, when the caller already derived it for the block. */
  palette?: LetterPalette;
}

export interface LetterFrame {
  subject: string;
  preheader: string;
  html: string;
  text: string;
}

/** The opening words of the text, past the greeting, for a letter with no preheader of its own. */
function openingWords(text: string): string {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const body = lines.length > 1 && /^(hi|hello|dear|hola)\b.*,$/i.test(lines[0]) ? lines.slice(1) : lines;
  const joined = body.join(" ").replace(/\s+/g, " ").trim();
  if (joined.length <= 110) return joined;
  const cut = joined.slice(0, 110);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 60)).trim()}...`;
}

/** The whole letter: the village's band, the words, the signature, the extra section, the footer. */
export function renderLetterFrame(i: LetterFrameInput): LetterFrame {
  const p = i.palette ?? letterPalette(i.village.seed, i.village.character, i.village.scheme);
  const d = p.day;
  const name = escapeHtml(i.village.name);
  const subject = oneLine(i.subject, 200) || i.village.name;
  const preheader = oneLine(i.preheader ?? "", 200) || oneLine(openingWords(i.body.text), 200) || subject;
  const lang = /^[a-z]{2}(-[A-Za-z]{2})?$/.test(i.lang ?? "") ? String(i.lang) : "en";

  const logo = i.village.logoUrl ? safeUrl(i.village.logoUrl) : null;
  const masthead = logo
    ? `<img src="${escapeHtml(logo)}" alt="${name}" height="44" style="display:block;height:44px;width:auto;max-width:220px;border:0;outline:none;text-decoration:none;color:#ffffff;font-family:${p.fontDisplay};font-size:22px;" />`
    : `<p style="margin:0;font-family:${p.fontDisplay};font-size:24px;line-height:30px;font-weight:bold;color:#ffffff;letter-spacing:0.2px;">${name}</p>`;

  const signature = i.signature
    ? `<p class="vl-muted" style="margin:8px 0 2px 0;font-family:${p.fontBody};font-size:15px;line-height:22px;color:${d.muted};">${escapeHtml(i.signature.signOff)}</p>
<p class="vl-accent" style="margin:0 0 8px 0;font-family:${p.fontDisplay};font-size:19px;line-height:26px;font-weight:bold;color:${d.brand};">${escapeHtml(i.signature.team)}</p>`
    : "";

  const footerLine = (html: string, bold = false) =>
    `<p class="${bold ? "vl-ink" : "vl-muted"}" style="margin:0 0 6px 0;font-family:${p.fontBody};font-size:13px;line-height:20px;color:${bold ? d.ink : d.muted};${bold ? "font-weight:bold;" : ""}">${html}</p>`;
  const prefs = i.preferences ? safeUrl(i.preferences.url) : null;
  const footer = [
    footerLine(name, true),
    i.village.postalAddress.trim() ? footerLine(escapeHtml(i.village.postalAddress.trim())) : "",
    i.why ? footerLine(escapeHtml(i.why)) : "",
    prefs && i.preferences ? footerLine(`<a href="${escapeHtml(prefs)}" class="vl-muted" style="color:${d.muted};text-decoration:underline;">${escapeHtml(i.preferences.label)}</a>`) : "",
  ]
    .filter(Boolean)
    .join("\n");

  const font = p.webFont
    ? `<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(p.webFont).replace(/%20/g, "+")}:wght@600;700&amp;display=swap" rel="stylesheet" />\n`
    : "";

  const html = `<!DOCTYPE html>
<html lang="${lang}" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>${escapeHtml(subject)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
${font}<style>
:root{color-scheme:light dark;supported-color-schemes:light dark;}
body{margin:0 !important;padding:0 !important;width:100% !important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;}
img{-ms-interpolation-mode:bicubic;}
@media (max-width:620px){.vl-pad{padding-left:22px !important;padding-right:22px !important;}.vl-col{max-width:100% !important;}.vl-tile-body{height:auto !important;}.vl-wide{padding-left:12px !important;padding-right:12px !important;}.vl-h2{font-size:24px !important;line-height:30px !important;}}
${nightRules(p)}
</style>
</head>
<body class="vl-page" style="margin:0;padding:0;background-color:${d.page};">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${d.page};mso-hide:all;">${escapeHtml(preheader)}${PREHEADER_PAD}</div>
<table role="presentation" class="vl-page" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${d.page}" style="background-color:${d.page};">
<tr><td align="center" style="padding:28px 12px 32px 12px;">
<!--[if mso]><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
<table role="presentation" class="vl-card" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${d.card}" style="width:100%;max-width:600px;background-color:${d.card};border:1px solid ${d.line};border-radius:${p.radiusPx + 4}px;border-collapse:separate;overflow:hidden;">
<tr><td class="vl-band vl-pad" bgcolor="${d.band}" style="background-color:${d.band};padding:26px 36px 24px 36px;border-radius:${p.radiusPx + 3}px ${p.radiusPx + 3}px 0 0;">
${masthead}
</td></tr>
<tr><td class="vl-pad" style="padding:34px 36px 12px 36px;">
${i.body.html}
${signature}
</td></tr>
${i.extra ? `<tr><td class="vl-wide" style="padding:8px 24px 28px 24px;">\n${i.extra.html}\n</td></tr>` : ""}
</table>
<!--[if mso]></td></tr></table><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;">
<tr><td class="vl-pad" align="center" style="padding:22px 36px 0 36px;text-align:center;">
${footer}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    i.body.text.trim(),
    i.signature ? `${i.signature.signOff}\n${i.signature.team}` : "",
    i.extra ? i.extra.text.trim() : "",
    ["--", i.village.name, i.village.postalAddress.trim(), i.why ?? "", prefs && i.preferences ? `${i.preferences.label}: ${prefs}` : ""].filter((l) => l.trim() !== "").join("\n"),
  ]
    .filter((s) => s.trim() !== "")
    .join("\n\n");

  return { subject, preheader, html, text: `${text}\n` };
}
