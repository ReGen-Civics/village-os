/**
 * The small pieces every surface of the Places page shares: the request
 * headers, how a place key reads as a name, and the class strings the photo
 * controls draw with.
 *
 * One file so the place page, the all-photos tab, the viewer and the
 * curator's queue cannot drift apart on any of them.
 */
import { authToken } from "@/lib/gameApi";

/** JSON reads and writes: the member's token when there is one. */
export const jsonHeaders = (): Record<string, string> => {
  const t = authToken();
  return t ? { Authorization: `Bearer ${t}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
};

/**
 * The upload. No Content-Type: the browser sets the multipart boundary itself,
 * and a hand-written header kills the parse on the far side.
 */
export const uploadHeaders = (): Record<string, string> => {
  const t = authToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

/**
 * A place key as a person reads it: "community-kitchen" reads "Community
 * kitchen". It only respaces and capitalises the key the map already holds;
 * it never makes up a name the map does not carry.
 */
export function placeName(key: string): string {
  const spaced = key.replace(/[-_]+/g, " ").trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : key;
}

/** A small edged control inside the viewer and the queue: 44px tall, the sheet's edge, a gold focus ring. */
export const ACT =
  "jw-btn inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

/** The same control for an act that cannot be undone. */
export const ACT_DANGER =
  "jw-btn inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-destructive/60 px-3 text-sm font-medium text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

/** A segment of a switch (the page's views, the queue's states). `on` is the chosen one. */
export const segment = (on: boolean) =>
  `jw-btn inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none sm:px-5 ${
    on ? "bg-notice text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"
  }`;
