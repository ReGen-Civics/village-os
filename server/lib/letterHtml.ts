/**
 * A PLAIN LETTER AS HTML, WITH ITS LINKS TAPPABLE (public launch QA, 24 Nov 2026).
 *
 * The applicant letters are written as plain text and sent with an HTML part
 * made from it, paragraph by paragraph. Seven places did that by hand, and none
 * of them made a link: the confirm link and the status link arrived as bare
 * text. Most mail apps make a bare address tappable; not all do, and the
 * letter that asks someone to confirm who they are is the worst place to rely
 * on it.
 *
 * `plainLetterHtml` escapes every paragraph first, then wraps each http(s)
 * address in an <a>, so nothing in the letter can become markup: the address
 * is matched in the escaped text and stops at any escaped quote or bracket.
 * A letter with one main action (confirm, follow your application) passes it
 * as `action`, and the HTML part carries a button for it in the platform's
 * email look (server/lib/notify.ts), right after the paragraph that holds its
 * link. The plain-text part is never touched.
 */
import { escapeHtml } from "./comms/mailer";
import { NEUTRAL_ACCENT } from "./emailAccent";

/** The platform's neutral email accent, as the notice emails use when a village has none (server/lib/emailAccent.ts). */
export const LETTER_ACCENT = NEUTRAL_ACCENT;

/** An http(s) address in ESCAPED text: it stops at whitespace, "<", and an escaped quote, bracket or apostrophe. */
const ADDRESS = /https?:\/\/(?:(?!&quot;|&#39;|&lt;|&gt;)[^\s<])+/g;
/** Sentence punctuation that follows an address is the sentence's, not the address's. */
const TRAILING = /[.,;:!?)]+$/;

function linked(escaped: string): string {
  return escaped.replace(ADDRESS, (match) => {
    const tail = match.match(TRAILING)?.[0] ?? "";
    const href = tail ? match.slice(0, -tail.length) : match;
    return `<a href="${href}" style="color:inherit">${href}</a>${tail}`;
  });
}

function button(href: string, label: string, accent: string): string {
  return `<p style="margin:16px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:${accent};color:#fff;border-radius:8px;padding:9px 16px;text-decoration:none;font-weight:600">${escapeHtml(label)}</a></p>`;
}

export interface LetterAction {
  href: string;
  label: string;
}

/**
 * One paragraph as HTML. Lines that start with "- " are a list in the plain text, so they become a real list here
 * (the lead, 27 Nov 2026: "make these bullet points when there are multiple steps"); the other lines stay a paragraph.
 */
function paragraphHtml(para: string): string {
  const out: string[] = [];
  let text: string[] = [];
  let items: string[] = [];
  const flushText = () => {
    if (text.length) out.push(`<p>${text.map((l) => linked(escapeHtml(l))).join("<br>")}</p>`);
    text = [];
  };
  const flushItems = () => {
    if (items.length) out.push(`<ul style="margin:0 0 16px;padding-left:20px">${items.map((l) => `<li style="margin:0 0 6px">${linked(escapeHtml(l))}</li>`).join("")}</ul>`);
    items = [];
  };
  for (const line of para.split("\n")) {
    if (line.startsWith("- ")) {
      flushText();
      items.push(line.slice(2));
    } else {
      flushItems();
      text.push(line);
    }
  }
  flushText();
  flushItems();
  return out.join("");
}

/** The paragraphs of `text` (split on blank lines) as escaped HTML, every http(s) address a link, and the action's button after its link. */
export function letterParagraphs(text: string, opts: { action?: LetterAction | null; accent?: string } = {}): string {
  let placed = false;
  return text
    .split("\n\n")
    .map((para) => {
      const html = paragraphHtml(para);
      if (opts.action && !placed && para.includes(opts.action.href)) {
        placed = true;
        return html + button(opts.action.href, opts.action.label, opts.accent ?? LETTER_ACCENT);
      }
      return html;
    })
    .join("");
}

/** The whole HTML part, in the plain letter's frame. `after` is HTML already made (a footer block). */
export function plainLetterHtml(text: string, opts: { action?: LetterAction | null; accent?: string; after?: string } = {}): string {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#1f2937">${letterParagraphs(text, opts)}${opts.after ?? ""}</body></html>`;
}
