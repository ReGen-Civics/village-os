/**
 * WHICH ADDRESSES A PAGE DRAWS (page speed pass, 14 Nov 2026).
 *
 * Every address got the shell and a 200, so a mistyped or retired link read
 * as a page to every crawler and uptime check, while a person saw "Off the
 * trail". The server now answers 404 for an address no route in
 * client/src/App.tsx matches, with the same shell, so a person sees exactly
 * what they saw before. scripts/build-client-routes.mjs writes the patterns.
 *
 * The match is wouter's: `:name` is one segment, and a trailing slash is
 * allowed. It is case-insensitive, so it can only ever say "a page" for more
 * addresses than the router, never fewer.
 */
export function clientRouteMatcher(patterns: readonly string[]): (path: string) => boolean {
  const rx = patterns.map((p) => {
    const body = p
      .split("/")
      .map((seg) => (seg.startsWith(":") ? "[^/]+" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
      .join("/")
      .replace(/\/$/, "");
    return new RegExp(`^${body}/?$`, "i");
  });
  return (path: string) => {
    const bare = path.split(/[?#]/)[0] || "/";
    return rx.some((r) => r.test(bare));
  };
}
