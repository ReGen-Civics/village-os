/**
 * The small pieces every surface of the Places page shares: the request
 * headers and how a place key reads as a name. The class strings are the
 * look's own (components/journey/look.ts).
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
