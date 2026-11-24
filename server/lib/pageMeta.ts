/**
 * What a link preview reads: the <title>, description and og: tags spliced
 * into the one static index.html for every page the server serves.
 *
 * client/index.html is neutral by construction (it is served byte for byte to
 * every deployment), and a crawler runs no JavaScript, so a title or picture
 * the client paints later is invisible to exactly the readers this is for.
 * Until 2026-10-22 only /quests was rewritten, and every other link to every
 * village unfurled as "Village" with no picture.
 */
import { documentTitle } from "../../shared/pageTitles";
import { SITE_PAGE } from "../../shared/pageContent/site";
import { resolvePage, resolvePageRaw } from "../../shared/pageContent/resolve";
import { pageSectionKey } from "../../shared/pageContent/types";
import { withPathNames, type PathWordsShown } from "../../shared/pageContent/pathNames";
import { villagePaths } from "./villagePaths";

/*
 * The village's share card (server/lib/shareCard.ts makes it). Declared here,
 * beside the tags that name it, so this file stays free of the file system:
 * a client test reads siteWords from it.
 */
/** The card's address, a path on this village's own origin. */
export const SHARE_CARD_PATH = "/api/share-card.jpg";
/** 1.91:1, the shape every major previewer draws a large card at. */
export const SHARE_CARD_WIDTH = 1200;
export const SHARE_CARD_HEIGHT = 630;
/** Answers "is there a card for this picture, and which version". Null keeps the picture's own address. */
export type ShareCardLookup = (picture: string, origin: string) => string | null;

export interface PageMeta {
  title: string;
  description: string;
  /** Absolute URL, or "" for none. */
  image: string;
  /** Absolute URL of this page, or "" when the origin is unknown. */
  url: string;
  siteName: string;
  type: "website" | "article";
  imageSize?: { width: number; height: number };
  /** The picture's media type, when the server knows it for certain (the share card is always JPEG). */
  imageType?: string;
  /** Ask search engines to leave this address out: a page this village does not serve. */
  noindex?: boolean;
}

const escapeAttr = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function trimTo(s: string, n = 200): string {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}...` : s;
}

export function metaTags(m: PageMeta): string {
  return [
    `<title>${escapeAttr(m.title)}</title>`,
    m.description ? `<meta name="description" content="${escapeAttr(m.description)}" />` : "",
    `<meta property="og:type" content="${m.type}" />`,
    `<meta property="og:site_name" content="${escapeAttr(m.siteName)}" />`,
    `<meta property="og:title" content="${escapeAttr(m.title)}" />`,
    m.description ? `<meta property="og:description" content="${escapeAttr(m.description)}" />` : "",
    m.url ? `<meta property="og:url" content="${escapeAttr(m.url)}" />` : "",
    m.image ? `<meta property="og:image" content="${escapeAttr(m.image)}" />` : "",
    m.image && m.imageSize ? `<meta property="og:image:width" content="${m.imageSize.width}" />` : "",
    m.image && m.imageSize ? `<meta property="og:image:height" content="${m.imageSize.height}" />` : "",
    m.image && m.imageType ? `<meta property="og:image:type" content="${escapeAttr(m.imageType)}" />` : "",
    `<meta name="twitter:card" content="${m.image ? "summary_large_image" : "summary"}" />`,
    m.url ? `<link rel="canonical" href="${escapeAttr(m.url)}" />` : "",
    m.noindex ? `<meta name="robots" content="noindex" />` : "",
  ]
    .filter(Boolean)
    .join("\n    ");
}

/**
 * The neutral tags come OUT before ours go in. Two og:title tags is not a
 * richer card, it is a coin toss over which one a crawler believes.
 */
export function spliceMeta(shell: string, m: PageMeta): string {
  return shell
    .replace(/<title>[\s\S]*?<\/title>\s*/i, "")
    .replace(/<meta\s+name="description"[^>]*>\s*/i, "")
    .replace(/<meta\s+property="og:[^"]*"[^>]*>\s*/gi, "")
    // A function, so a `$&` or `$'` in a title is text and never a replacement pattern (R114).
    .replace("</head>", () => `  ${metaTags(m)}\n  </head>`);
}

interface SiteConfig {
  project: { name: string; tagline?: string; commitmentName?: string; location?: string };
  images?: { hero?: string };
}

const absolute = (src: string, origin: string): string => {
  const s = src.trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  return origin && s.startsWith("/") ? origin + s : "";
};

/** The picture a share card names: the Whole site share picture, or else the homepage picture. */
function sharePicture(shareImage: string, config: SiteConfig): string {
  return (shareImage || config.images?.hero || "").trim();
}

/** The same choice, from the stored words, for the card route (server/routes/shareCard.ts). */
export function chosenSharePicture(config: SiteConfig, content: Record<string, unknown> | null): string {
  const site = resolvePage(SITE_PAGE, content?.[pageSectionKey(SITE_PAGE)], {
    village: config.project.name,
    tagline: config.project.tagline ?? "",
    location: config.project.location ?? "",
  }).share.fields;
  return sharePicture(site.image, config);
}

/**
 * The share card for an ordinary page: the page's own name, the village's
 * share sentence (Admin, Pages, Whole site) or its Tagline, and its share
 * picture or homepage picture.
 *
 * `hidden` is a story page this village does not serve (shared/brochure.ts):
 * its route is the not-found page, so its card must not advertise it. It reads
 * as the village alone, names no address of its own, and asks search engines
 * to leave it out.
 *
 * `shareCard` turns the picture into the village's own share card
 * (server/lib/shareCard.ts): when the picture is one of this village's uploads,
 * the card names /api/share-card.jpg, a 1200x630 JPEG made from it, with a
 * `?v=` that changes when the picture does. A picture on another host, a
 * missing file, or no lookup at all keeps the picture's own address.
 */
export function sitePageMeta(
  path: string,
  origin: string,
  config: SiteConfig,
  content: Record<string, unknown> | null,
  hidden = false,
  shareCard?: ShareCardLookup,
): PageMeta {
  const village = config.project.name;
  const site = resolvePage(SITE_PAGE, content?.[pageSectionKey(SITE_PAGE)], {
    village,
    tagline: config.project.tagline ?? "",
    location: config.project.location ?? "",
  }).share.fields;
  const picture = sharePicture(site.image, config);
  const version = origin && shareCard ? shareCard(picture, origin) : null;
  return {
    title: hidden ? village : documentTitle(path, village, { commitment: config.project.commitmentName }),
    description: trimTo((site.description || config.project.tagline || "").trim()),
    image: version ? `${origin}${SHARE_CARD_PATH}?v=${encodeURIComponent(version)}` : absolute(picture, origin),
    ...(version ? { imageSize: { width: SHARE_CARD_WIDTH, height: SHARE_CARD_HEIGHT }, imageType: "image/jpeg" } : {}),
    url: origin && !hidden ? origin + path : "",
    siteName: village,
    type: "website",
    ...(hidden ? { noindex: true } : {}),
  };
}

/**
 * The site-wide words the shell paints on every page, served inside
 * /api/game/config so the footer costs no request of its own.
 *
 * A journey page's menu name is the village's path name (Admin, Paths &
 * Stages) until the village writes its own name for it here
 * (shared/pageContent/pathNames.ts). `menuChanged` is every page whose name
 * differs from the platform's, a renamed path's included, which is what tells
 * the footer to say the new name too.
 */
export function siteWords(
  content: Record<string, unknown> | null,
  config: SiteConfig,
  paths: readonly PathWordsShown[] = villagePaths(),
): { footerSignoff: string; menu: Record<string, { label: string; subtitle: string }>; menuChanged: string[] } {
  const stored = content?.[pageSectionKey(SITE_PAGE)];
  const vars = {
    village: config.project.name,
    tagline: config.project.tagline ?? "",
    location: config.project.location ?? "",
    commitment: config.project.commitmentName?.trim() || "membership agreement",
  };
  const site = withPathNames(SITE_PAGE, stored, resolvePage(SITE_PAGE, stored, vars), paths);
  const defaults = resolvePageRaw(SITE_PAGE, null).menu.lists.pages;
  const platform = resolvePage(SITE_PAGE, null, vars).menu.lists.pages;
  const raw = resolvePageRaw(SITE_PAGE, stored).menu.lists.pages;
  const menu: Record<string, { label: string; subtitle: string }> = {};
  const menuChanged: string[] = [];
  site.menu.lists.pages.forEach((row, i) => {
    const id = String(row.id);
    menu[id] = { label: row.label, subtitle: row.subtitle };
    const ownWords = raw[i].label !== defaults[i].label || raw[i].subtitle !== defaults[i].subtitle;
    const pathRenamed = row.label !== platform[i].label || row.subtitle !== platform[i].subtitle;
    if (ownWords || pathRenamed) menuChanged.push(id);
  });
  return { footerSignoff: site.footer.fields.signoff, menu, menuChanged };
}

/**
 * START THE LANDING PAGE'S PHOTOGRAPH WITH THE PAGE, NOT AFTER IT (page speed pass).
 *
 * The hero is the landing page's largest paint, and the browser learned its
 * address only after the bundle ran, the config and the page's words arrived,
 * and React drew the hero: 15 seconds into a slow phone's visit. The server
 * already knows the address, so `/` names it in a preload. The srcset and
 * sizes must be the ones the page's <img> uses (shared/uploadVariants.ts and
 * HERO_SIZES), or the browser fetches the picture twice. Only a path or a
 * full http(s) URL is named; anything else is left out, and an empty hero
 * adds nothing.
 */
export const HERO_SIZES = "100vw";

export function spliceHeroPreload(shell: string, hero: string | null | undefined, srcset?: string): string {
  const href = String(hero ?? "").trim();
  if (!href || !(/^\/[^/]/.test(href) || /^https?:\/\//i.test(href))) return shell;
  const set = srcset ? ` imagesrcset="${escapeAttr(srcset)}" imagesizes="${HERO_SIZES}"` : "";
  return shell.replace("</head>", () => `  <link rel="preload" as="image" href="${escapeAttr(href)}"${set} fetchpriority="high">\n  </head>`);
}
