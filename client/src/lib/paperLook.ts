/**
 * LIGHT MODE'S PAPER (the lead, 26 Nov 2026: "Let's go with B as a village setting").
 *
 * A village picks how light mode draws its member pages with the dial
 * `look.light_paper` (shared/gameVariables.ts): "plain", the Golden Hour page,
 * or "sea-chart", the old sea chart in client/src/seaChart.css. The choice
 * rides on /api/game/config, and this module puts it on <html> as
 * `data-paper="sea-chart"`, which is all the stylesheet keys on. Dark mode and
 * Admin never read it (seaChart.css scopes itself to light mode and steps aside
 * on an Admin page).
 *
 * The answer is also kept on the device under PAPER_KEY, so the first-paint
 * script in client/index.html can put the paper down before the page draws:
 * without it, a Sea chart village would flash plain on every load. That script
 * cannot import, so it names the key and the value itself;
 * paperLook.test.ts holds the three together.
 */
export const PAPER_KEY = "village-paper";

/**
 * The attribute the server puts on <html> carrying the village's paper as it
 * stands now (server/routes/brandTheme.ts). The first-paint script prefers it
 * to the device's memory, so a first visit gets the paper too, and a village
 * that went back to plain never flashes the chart. paperLook.test.ts holds the
 * script to this name.
 */
export const VILLAGE_PAPER_ATTR = "data-village-paper";

export type Paper = "plain" | "sea-chart";

export const PAPERS: readonly Paper[] = ["plain", "sea-chart"];

export function isPaper(v: unknown): v is Paper {
  return v === "plain" || v === "sea-chart";
}

/**
 * Put the village's paper on the page and keep it for the next first paint.
 * Anything that is not a known paper (an older server, a failed read) reads as
 * plain, so the look can only ever be on where the village chose it.
 */
export function applyPaper(value: unknown, doc: Document = document): Paper {
  const paper: Paper = isPaper(value) ? value : "plain";
  const root = doc.documentElement;
  if (paper === "plain") root.removeAttribute("data-paper");
  else root.setAttribute("data-paper", paper);
  try {
    if (paper === "plain") window.localStorage.removeItem(PAPER_KEY);
    else window.localStorage.setItem(PAPER_KEY, paper);
  } catch {
    /* storage refused: the look still applies, it just paints plain first next time */
  }
  return paper;
}
