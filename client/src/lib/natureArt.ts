/**
 * Which painted animal or plant each role shows (shared/natureArt.ts, server/routes/natureArt.ts).
 * One read per page load, shared by every card on the page; a card asks with its role id and draws its
 * own fallback while the answer is on its way or when the role has none.
 */
import { useEffect, useState } from "react";
import { gameFetch } from "@/lib/gameApi";
import { companionArt, natureArtUrl, type NatureArtSize } from "@shared/natureArt";

type RoleArtMap = Record<string, string>;

let cache: RoleArtMap | null = null;
let pending: Promise<RoleArtMap> | null = null;
const listeners = new Set<(m: RoleArtMap) => void>();

function load(): Promise<RoleArtMap> {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    // A throw before the request (no fetch at all) is "no painting" too, so a card never blanks its page.
    pending = Promise.resolve()
      .then(() => gameFetch("/api/art/nature"))
      .then((r) => (r.ok ? r.json() : { roles: {} }))
      .then((j) => (j && typeof j.roles === "object" && j.roles ? (j.roles as RoleArtMap) : {}))
      .catch(() => ({}))
      .then((m) => {
        cache = m;
        listeners.forEach((l) => l(m));
        return m;
      });
  }
  return pending;
}

/** Forget the answer, so the next card asks again (after an admin changes a painting). */
export function refreshRoleArt(next?: RoleArtMap): void {
  cache = next ?? null;
  pending = null;
  if (next) listeners.forEach((l) => l(next));
}

/**
 * The painting URL for a role id, or null while loading or for a role the server does not know. Pass "sm" where the
 * painting shows a few centimetres wide (a thumbnail, a strip): the half-size copy is about a third of the bytes.
 */
export function useRoleArt(size: NatureArtSize = "full"): (roleId: string | null | undefined) => string | null {
  const [map, setMap] = useState<RoleArtMap | null>(cache);
  useEffect(() => {
    let live = true;
    const on = (m: RoleArtMap) => live && setMap(m);
    listeners.add(on);
    void load().then(on);
    return () => {
      live = false;
      listeners.delete(on);
    };
  }, []);
  return (roleId) => {
    const slug = roleId && map ? map[roleId] : null;
    return slug ? natureArtUrl(slug, size) : null;
  };
}

/** The painting a Digital Companion's name points at, as a URL, or null. */
export function companionArtUrl(name: string | null | undefined): string | null {
  const art = companionArt(name);
  return art ? natureArtUrl(art.slug) : null;
}
