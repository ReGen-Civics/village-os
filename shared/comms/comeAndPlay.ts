/**
 * COME AND PLAY: the invitation back into the village that any outgoing email
 * can carry (the Operations role's ask, 16 Nov 2026: "a nice invitation back in
 * to do something ... a whole bunch of ways to come and play in the village").
 *
 * A warm heading, up to six illustrated cards and one main button. It is the
 * same block in every letter that carries it, so a village sees one invitation
 * wherever it goes:
 *
 *   - the applicant letters: not invited, declined, a join request's no
 *     (server/lib/comms/villageLetter.ts dresses them);
 *   - the 90-day closed letter, through its footer hook
 *     (`ClosingDeps.footer` in server/lib/applicantFollowups.ts), and any later
 *     letter, such as an expired invitation's, the same way;
 *   - any member email, as an optional footer (`composeEmail`'s `comeAndPlay`).
 *
 * ── NEVER A DEAD LINK ───────────────────────────────────────────────────────
 *
 * A card shows only when its page will open for the reader. A module's card
 * needs that module on for the reader's audience: `public` for somebody with no
 * account (an applicant), `members` or `public` for a member. The newsletter
 * card needs `org.newsletter_link`; the way-to-stay-close card needs
 * `org.stay_close_name` and `org.stay_close_link`. Quests and gratitude are
 * core, always public. Every address is the village's own site plus the route,
 * or the https address the village typed.
 *
 * ── NOTHING THAT EXPIRES ────────────────────────────────────────────────────
 *
 * No dates, no counts and no role named in words. The cards say what a page
 * is for, and the page says what is on it today.
 *
 * ── THE WORDS ───────────────────────────────────────────────────────────────
 *
 * One table per language, keyed by `ApplicantLanguage`, the same languages the
 * applicant letters speak (shared/applicantWords.ts): a language added there
 * fails the typecheck here until it has these words too.
 *
 * Pure and isomorphic.
 */
import type { ApplicantLanguage } from "../applicantWords";
import type { ModuleLifecycle } from "../modules";
import { buttonHtml, letterPalette, type LetterBody, type LetterPalette } from "./letterFrame";
import { escapeHtml, safeUrl } from "./mergeFields";

// ── The doors ───────────────────────────────────────────────────────────────

/** Every way in a card can name, in the order the block offers them. */
export const PLAY_DOORS = ["stayClose", "roles", "quests", "newsletter", "explore", "gratitude", "events", "pooling"] as const;
export type PlayDoor = (typeof PLAY_DOORS)[number];

/** The most cards the block shows: past six it stops being calm. */
export const MAX_PLAY_CARDS = 6;

/**
 * Where each door goes and what has to be on for it to open. `module` is the
 * module the page belongs to (shared/modules.ts); `null` means the page is
 * always there. The newsletter and the way to stay close are the village's own
 * addresses and have no route here.
 */
export const DOOR_ROUTES: Record<Exclude<PlayDoor, "newsletter" | "stayClose">, { route: string; module: string | null }> = {
  roles: { route: "/roles", module: null },
  // Quests and gratitude are core modules: always public, never switched off (shared/modules.ts).
  quests: { route: "/quests", module: null },
  explore: { route: "/map", module: "map" },
  events: { route: "/events", module: "events" },
  gratitude: { route: "/gratitude", module: null },
  pooling: { route: "/campaigns", module: "crowdpool" },
};

/**
 * Each card's illustration: the platform's own module art, the same paintings
 * the Module Library shows (server/assets/modules, at /images/modules), served from the
 * village's own site. They belong to the platform and to no village, so every
 * village's letter can wear them. `comeAndPlay.test.ts` holds each file to
 * existing.
 */
export const DOOR_ART: Record<PlayDoor, string> = {
  stayClose: "introductions",
  roles: "governance",
  quests: "quests",
  explore: "map",
  events: "events",
  gratitude: "gratitude",
  pooling: "crowdpool",
  newsletter: "comms",
};

/** Where the module art is served, under the village's own site. */
export const ART_PATH = "/images/modules";

/**
 * Each card's picture for Outlook on Windows, whose Word engine cannot draw
 * WebP: an emoji in a soft circle instead. Emoji are text, so they need no
 * image host and draw in colour.
 */
export const DOOR_PICTURES: Record<PlayDoor, string> = {
  stayClose: "\u{1F3E1}",
  roles: "\u{1F91D}",
  quests: "\u{1F9ED}",
  explore: "\u{1F5FA}\u{FE0F}",
  events: "\u{1F525}",
  gratitude: "\u{1F49B}",
  pooling: "\u{1F331}",
  newsletter: "\u{1F48C}",
};

/** Who reads the email: somebody with no account sees only public pages; a member sees members' pages too. */
export type PlayAudience = "public" | "members";

export interface PlayFacts {
  /** The village's own site, an absolute origin. Empty: no card can be built, and the block is empty. */
  site: string;
  audience: PlayAudience;
  /** A module's live lifecycle (`effectiveLifecycle` on the server). */
  lifecycleOf(moduleId: string): ModuleLifecycle;
  /** `org.newsletter_link`, already checked: a page of this site or an https address, or null. */
  newsletter: string | null;
  /** The way to stay close, `org.stay_close_name` and `org.stay_close_link`, or null. */
  stayClose: { name: string; href: string } | null;
  /** Doors a letter leaves out, because it already says them. */
  skip?: readonly PlayDoor[];
}

export interface PlayCard {
  door: PlayDoor;
  url: string;
  /** The village's own name for the way to stay close; every other card takes its title from the words. */
  name?: string;
}

const bare = (site: string): string => String(site ?? "").trim().replace(/\/+$/, "");

/** A page of this site, or an https address, as an absolute link; anything else is null. */
export function playHref(site: string, href: string): string | null {
  const h = String(href ?? "").trim();
  if (/^https:\/\/[^\s]+$/i.test(h)) return safeUrl(h);
  const s = bare(site);
  if (!s || !h.startsWith("/") || h.startsWith("//")) return null;
  return safeUrl(`${s}${h}`);
}

/** The way to stay close, from its two settings, or null when either is missing or the address is not one. */
export function stayCloseFrom(name: string, href: string): { name: string; href: string } | null {
  const n = String(name ?? "").trim().slice(0, 80);
  const h = String(href ?? "").trim().slice(0, 300);
  if (!n || !h || h.startsWith("//")) return null;
  if (!h.startsWith("/") && !/^https:\/\/[^\s]+$/i.test(h)) return null;
  return { name: n, href: h };
}

/** Whether a lifecycle opens the page for this audience. */
export function opensFor(lifecycle: ModuleLifecycle, audience: PlayAudience): boolean {
  return lifecycle === "public" || (audience === "members" && lifecycle === "members");
}

/** The cards this village can offer this reader today, in order, at most six. */
export function playCards(f: PlayFacts): PlayCard[] {
  const skip = new Set(f.skip ?? []);
  const out: PlayCard[] = [];
  for (const door of PLAY_DOORS) {
    if (skip.has(door)) continue;
    let url: string | null = null;
    let name: string | undefined;
    if (door === "newsletter") url = f.newsletter ? playHref(f.site, f.newsletter) : null;
    else if (door === "stayClose") {
      url = f.stayClose ? playHref(f.site, f.stayClose.href) : null;
      name = f.stayClose?.name;
    } else {
      const r = DOOR_ROUTES[door];
      if (!r.module || opensFor(f.lifecycleOf(r.module), f.audience)) url = playHref(f.site, r.route);
    }
    if (url) out.push({ door, url, ...(name ? { name } : {}) });
    if (out.length >= MAX_PLAY_CARDS) break;
  }
  return out;
}

// ── The words ───────────────────────────────────────────────────────────────

export interface ComeAndPlayWords {
  heading: string;
  intro: string;
  /** The one main button, to the village's front page. */
  button: string;
  /** Each card's title (the way to stay close takes the village's own name), its line, and its painting's alt text. */
  cards: Record<PlayDoor, { title: string; line: string; alt: string }>;
  /** The letters' sign-off, above the team that signs. */
  signOff: string;
  /** The team that signs, when the village has not named one (`org.letter_team`). */
  team(village: string): string;
  /** The footer of a letter to somebody who wrote to the village. */
  why(village: string): string;
}

const en: ComeAndPlayWords = {
  heading: "Come and play!",
  intro: "Our app and our game keep growing. Come and see what's new, and find your own way to play.",
  button: "Come and explore",
  cards: {
    stayClose: { title: "", line: "Our open way to stay close to the village and its people.", alt: "A flowering gateway on a village path" },
    roles: { title: "Join the team", line: "See the roles open now and find the one that fits you.", alt: "A circle of carved chairs around a fire" },
    quests: { title: "Take a quest", line: "Small adventures that help the village. Anyone can play.", alt: "A wooden quest board in a green meadow" },
    explore: { title: "Explore the village", line: "Wander the living map and meet the places and people.", alt: "Round green-roofed homes around a campfire" },
    events: { title: "Come to a gathering", line: "Find a call, a circle or a celebration on our calendar.", alt: "A village green strung with lanterns at dusk" },
    gratitude: { title: "Thank-yous and gratitude", line: "Read the thank-yous people share, and add your own.", alt: "A table of gifts under a leafy shelter" },
    pooling: { title: "Pooling Resources", line: "See what we're growing together and how to pitch in.", alt: "Baskets and jars gathered under a shared roof" },
    newsletter: { title: "Read our newsletter", line: "Hear first about new roles, quests and village news.", alt: "A cottage with a little post box on its roof" },
  },
  signOff: "With love,",
  team: (v) => `The ${v} team`,
  why: (v) => `You're getting this because you wrote to ${v}.`,
};

// needs-native-review: the come-and-play words, 16 Nov 2026
const es: ComeAndPlayWords = {
  heading: "¡Ven a jugar!",
  intro: "Nuestra app y nuestro juego siguen creciendo. Ven a ver lo nuevo y encuentra tu propia forma de jugar.",
  button: "Ven a explorar",
  cards: {
    stayClose: { title: "", line: "Nuestra forma abierta de quedarte cerca de la aldea y su gente.", alt: "Un portal florido en un sendero de la aldea" },
    roles: { title: "Únete al equipo", line: "Mira los roles abiertos ahora y encuentra el que va contigo.", alt: "Un círculo de sillas talladas alrededor del fuego" },
    quests: { title: "Toma una misión", line: "Pequeñas aventuras que ayudan a la aldea. Cualquiera puede jugar.", alt: "Un tablero de misiones de madera en un prado verde" },
    explore: { title: "Explora la aldea", line: "Recorre el mapa vivo y conoce los lugares y la gente.", alt: "Casas redondas con techo verde alrededor de una fogata" },
    events: { title: "Ven a un encuentro", line: "Encuentra una llamada, un círculo o una celebración en el calendario.", alt: "Un prado de la aldea con faroles al atardecer" },
    gratitude: { title: "Agradecimientos y gratitud", line: "Lee los agradecimientos que comparte la gente, y suma el tuyo.", alt: "Una mesa de regalos bajo un techo de hojas" },
    pooling: { title: "Juntando Recursos", line: "Mira lo que hacemos crecer juntos y cómo puedes aportar.", alt: "Canastas y jarras reunidas bajo un techo compartido" },
    newsletter: { title: "Lee nuestro boletín", line: "Entérate primero de roles nuevos, misiones y noticias de la aldea.", alt: "Una casita con un buzón en el techo" },
  },
  signOff: "Con cariño,",
  team: (v) => `El equipo de ${v}`,
  why: (v) => `Recibes esto porque escribiste a ${v}.`,
};

export const COME_AND_PLAY_WORDS: Record<ApplicantLanguage, ComeAndPlayWords> = { en, es };

export const comeAndPlayWords = (lang: ApplicantLanguage | null | undefined): ComeAndPlayWords =>
  (lang && COME_AND_PLAY_WORDS[lang]) || COME_AND_PLAY_WORDS.en;

// ── The block ───────────────────────────────────────────────────────────────

export interface ComeAndPlayContext extends PlayFacts {
  lang?: ApplicantLanguage | null;
  /** The village's colours. Build it with `letterPalette`, or pass the frame's. */
  palette?: LetterPalette;
  seed?: string | null;
  character?: string | null;
  /** The village's hero picture, an absolute https address on its own site, with its alt text. */
  hero?: { url: string; alt: string } | null;
  /** False leaves the paintings out and draws each card's emoji circle. */
  art?: boolean;
}

/** The painting at the top of a card. Outlook on Windows draws the emoji circle instead (it cannot draw WebP). */
function artHtml(p: LetterPalette, art: string, alt: string, picture: string): string {
  const d = p.day;
  const r = Math.max(0, p.radiusPx - 1);
  return `<!--[if !mso]><!--><tr><td style="padding:0;line-height:0;font-size:0;"><img src="${escapeHtml(art)}" alt="${escapeHtml(alt)}" width="248" style="display:block;width:100%;height:auto;border:0;outline:none;text-decoration:none;border-radius:${r}px ${r}px 0 0;font-family:${p.fontBody};font-size:13px;line-height:18px;color:${d.muted};" /></td></tr><!--<![endif]-->
<!--[if mso]><tr><td style="padding:18px 18px 0 18px;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" valign="middle" width="44" height="44" bgcolor="${d.dot}" style="font-size:22px;line-height:44px;"><span aria-hidden="true">${picture}</span></td></tr></table></td></tr><![endif]-->`;
}

/** One card: the painting, the title as the link, one line under it. */
function cardHtml(p: LetterPalette, art: string | null, alt: string, picture: string, title: string, line: string, url: string): string {
  const d = p.day;
  const top = art
    ? artHtml(p, art, alt, picture)
    : `<tr><td style="padding:18px 18px 0 18px;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td class="vl-dot" align="center" valign="middle" width="44" height="44" bgcolor="${d.dot}" style="width:44px;height:44px;background-color:${d.dot};border-radius:22px;font-size:22px;line-height:44px;text-align:center;"><span aria-hidden="true" style="font-family:'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif;">${picture}</span></td></tr></table></td></tr>`;
  return `<table role="presentation" class="vl-tile" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${d.card}" style="width:100%;background-color:${d.card};border:1px solid ${d.line};border-radius:${p.radiusPx}px;border-collapse:separate;">
${top}
<tr><td class="vl-tile-body" valign="top" style="padding:14px 18px 18px 18px;height:94px;">
<p style="margin:0 0 4px 0;font-family:${p.fontDisplay};font-size:17px;line-height:23px;font-weight:bold;"><a href="${escapeHtml(url)}" class="vl-accent" style="color:${d.brand};text-decoration:none;">${escapeHtml(title)}&nbsp;&rarr;</a></p>
<p class="vl-muted" style="margin:0;font-family:${p.fontBody};font-size:14px;line-height:21px;color:${d.muted};">${escapeHtml(line)}</p>
</td></tr>
</table>`;
}

/**
 * Cards two to a row on a wide screen, one to a row on a phone, with no media
 * query: each card is an inline block at most half the column wide, so a
 * narrow screen wraps it. Outlook's Word engine ignores inline blocks, so it
 * gets a two-cell table through the `mso` conditionals.
 */
function gridHtml(cells: string[]): string {
  const rows: string[] = [];
  for (let at = 0; at < cells.length; at += 2) {
    const pair = cells.slice(at, at + 2);
    const col = (c: string) =>
      `<div class="vl-col" style="display:inline-block;width:100%;max-width:262px;vertical-align:top;text-align:left;font-size:16px;"><div style="padding:6px;">${c}</div></div>`;
    rows.push(
      `<div style="font-size:0;line-height:0;text-align:center;">
<!--[if mso]><table role="presentation" width="524" cellspacing="0" cellpadding="0" border="0"><tr><td width="262" valign="top"><![endif]-->
${col(pair[0])}
${pair[1] ? `<!--[if mso]></td><td width="262" valign="top"><![endif]-->\n${col(pair[1])}` : ""}
<!--[if mso]></td></tr></table><![endif]-->
</div>`,
    );
  }
  return rows.join("\n");
}

/**
 * THE BLOCK: `{ html, text }`, ready to drop under any letter
 * (`renderLetterFrame`'s `extra`, or `composeEmail`'s `comeAndPlay`). Empty
 * strings when the village has no site to link to, so a caller can always
 * pass it on.
 */
export function renderComeAndPlay(ctx: ComeAndPlayContext): LetterBody {
  const site = bare(ctx.site);
  const home = site ? safeUrl(`${site}/`) : null;
  if (!home) return { html: "", text: "" };
  const w = comeAndPlayWords(ctx.lang);
  const p = ctx.palette ?? letterPalette(ctx.seed ?? null, ctx.character ?? null);
  const d = p.day;
  const cards = playCards(ctx).map((c) => ({
    ...c,
    title: c.door === "stayClose" ? (c.name ?? "") : w.cards[c.door].title,
    line: w.cards[c.door].line,
    alt: w.cards[c.door].alt,
    art: ctx.art === false ? null : safeUrl(`${site}${ART_PATH}/${DOOR_ART[c.door]}.webp`),
  }));
  const hero = ctx.hero ? safeUrl(ctx.hero.url) : null;

  const heroHtml =
    hero && ctx.hero
      ? `<tr><td style="padding:0;"><img src="${escapeHtml(hero)}" alt="${escapeHtml(ctx.hero.alt)}" width="552" style="display:block;width:100%;max-width:552px;height:auto;border:0;outline:none;border-radius:${p.radiusPx}px ${p.radiusPx}px 0 0;font-family:${p.fontBody};font-size:14px;color:${d.muted};" /></td></tr>`
      : "";

  const html = `<table role="presentation" class="vl-wash" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${d.wash}" style="width:100%;background-color:${d.wash};border:1px solid ${d.line};border-radius:${p.radiusPx + 2}px;border-collapse:separate;">
${heroHtml}
<tr><td align="center" style="padding:28px 14px 6px 14px;text-align:center;">
<p style="margin:0 0 6px 0;font-size:28px;line-height:32px;"><span aria-hidden="true" style="font-family:'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif;">&#127807;</span></p>
<h2 class="vl-ink vl-h2" style="margin:0 0 8px 0;font-family:${p.fontDisplay};font-size:28px;line-height:34px;font-weight:bold;color:${d.ink};">${escapeHtml(w.heading)}</h2>
<p class="vl-muted" style="margin:0 auto 18px auto;max-width:420px;font-family:${p.fontBody};font-size:16px;line-height:24px;color:${d.muted};">${escapeHtml(w.intro)}</p>
</td></tr>
${
  cards.length
    ? `<tr><td style="padding:0 8px 4px 8px;">\n${gridHtml(cards.map((c) => cardHtml(p, c.art, c.alt, DOOR_PICTURES[c.door], c.title, c.line, c.url)))}\n</td></tr>`
    : ""
}
<tr><td align="center" style="padding:14px 14px 28px 14px;">
<table role="presentation" align="center" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;"><tr><td align="center">${buttonHtml(p, w.button, home)}</td></tr></table>
</td></tr>
</table>`;

  const text = [
    w.heading,
    w.intro,
    "",
    ...cards.flatMap((c) => [`${c.title}: ${c.url}`, c.line, ""]),
    `${w.button}: ${home}`,
  ].join("\n");

  return { html, text };
}
