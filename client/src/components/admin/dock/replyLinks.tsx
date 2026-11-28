/**
 * NEVER A RAW ADDRESS IN HER WORDS (the overseer's review, round 2).
 *
 * A reply can carry an internal address: the launch guide is told to include a
 * checklist row's `fixAt` so the page can link it, and any guide may write one.
 * The launch guide's own panel drew the address itself as the link
 * (components/journey/LaunchGuide.tsx), so a founder read "open
 * /admin?tab=season". Here the address is still a link, and its WORDS name the
 * page or the control:
 *
 *   1. what the host said that address is (a launch row's own `fixLabel`, where
 *      the checklist is at hand);
 *   2. the Admin tab's own name, from the map the dock was handed, then from
 *      the admin's own table of tabs;
 *   3. a page this file knows by name (the review page, the road to launch);
 *   4. "Open the page", only when nothing names it.
 *
 * The address is never visible text, in the bubble or in the line read to a
 * screen reader (`replyAsWords`). An outside link (https://…) is left exactly
 * as it was: plain text.
 *
 * No lookbehind in the pattern: an older Safari refuses one at parse time.
 */
import type { ReactNode } from "react";
import { Link } from "wouter";
import { useLingui } from "@lingui/react/macro";
import { tabEntry } from "../adminAreas";
import type { NavGroup } from "../adminNavGroups";
import { goTo } from "../search/adminSearchModel";

export type ReplyPiece = { text: string } | { href: string };

/**
 * An internal address: a path of plain segments, an optional query and an
 * optional fragment, standing on its own (at the start, or after a space or an
 * opening mark), so "and/or", a date and the path inside an outside link are
 * never taken for one.
 */
const ADDRESS = /(^|[\s(\["'“‘])(\/[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*(?:\?[\w=&%-]+)?(?:#[\w-]+)?)(?=[\s.,;:!?)\]"'”’]|$)/gi;

/** A reply cut into its words and its internal addresses, in order. PURE. */
export function splitReply(text: string): ReplyPiece[] {
  const out: ReplyPiece[] = [];
  let at = 0;
  for (const m of text.matchAll(ADDRESS)) {
    const start = (m.index ?? 0) + m[1].length;
    if (start > at) out.push({ text: text.slice(at, start) });
    out.push({ href: m[2] });
    at = start + m[2].length;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}

/** The tab an Admin address opens, or null for any other address. PURE. */
export function adminTabOf(href: string): string | null {
  if (!href.startsWith("/admin?")) return null;
  const tab = new URLSearchParams(href.slice("/admin?".length).split("#")[0]).get("tab");
  return tab && /^[a-z0-9][a-z0-9-]*$/.test(tab) ? tab : null;
}

export interface LinkNamer {
  /** The words for an address: what names it, or the fallback. */
  nameOf(href: string): string;
}

/**
 * The words for an internal address, in the order this file's header gives.
 * `named` is what the host knows (a launch row's fixAt and its fixLabel);
 * `groups` is the Admin map the dock was handed.
 */
export function useLinkNamer(named: Readonly<Record<string, string>> | undefined, groups: readonly NavGroup[]): LinkNamer {
  const { t } = useLingui();
  const known: Record<string, string> = {
    "/admin": t({ message: "Admin", context: "guide dock, a link's words: the Admin page" }),
    "/admin/proposals": t({ message: "the review page", context: "guide dock, a link's words: the review page" }),
    "/journey-to-launch": t({ message: "the road to launch", context: "guide dock, a link's words: the launch checklist page" }),
    "/modules": t({ message: "the Module Library", context: "guide dock, a link's words: the module library page" }),
  };
  const fallback = t({ message: "Open the page", context: "guide dock, a link's words when nothing names the page" });
  return {
    nameOf(href) {
      const told = named?.[href]?.trim();
      if (told) return told;
      const tab = adminTabOf(href);
      if (tab) {
        const mapped = groups.flatMap((g) => g.items).find((i) => i.key === tab)?.label ?? tabEntry(tab)?.name;
        if (mapped) return mapped;
      }
      // A page known by name, whatever rides behind its path; an Admin tab nobody could name is still Admin.
      return known[href.split(/[?#]/)[0]] ?? fallback;
    },
  };
}

/** The reply as plain words, each address replaced by its name: for the line read to a screen reader. PURE given a namer. */
export function replyAsWords(text: string, namer: LinkNamer): string {
  return splitReply(text)
    .map((p) => ("href" in p ? namer.nameOf(p.href) : p.text))
    .join("");
}

const LINK = "font-medium text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * The reply drawn: words as words, each internal address as a link named for
 * its page. Inside Admin an Admin address goes through the page's own
 * navigation, so it asks the one leave guard; anywhere else it is an ordinary
 * in-app link.
 */
export function ReplyText({ text, namer, inAdmin }: { text: string; namer: LinkNamer; inAdmin: boolean }): ReactNode {
  return splitReply(text).map((p, i) => {
    if (!("href" in p)) return <span key={i}>{p.text}</span>;
    const words = namer.nameOf(p.href);
    if (inAdmin && (p.href === "/admin" || p.href.startsWith("/admin?"))) {
      const href = p.href;
      return (
        <a
          key={i}
          href={href}
          className={LINK}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            goTo(href);
          }}
        >
          {words}
        </a>
      );
    }
    return (
      <Link key={i} href={p.href} className={LINK}>
        {words}
      </Link>
    );
  });
}
