/**
 * The caller's address, as far as anything we control can vouch for it.
 *
 * Every IP-keyed limit in the app (sign-in throttling, checkout attempts, the
 * assistant's cost cap, the abuse guard, the admin password doors) keys on
 * what this returns, so a value a stranger can choose resets all of them.
 *
 * X-Forwarded-For grows left to right: each proxy APPENDS the address it
 * received the request from. So the rightmost entries are written by our own
 * infrastructure and the leftmost is whatever the original client sent, which
 * anyone can forge. Counting in from the RIGHT by the number of proxies we
 * actually run lands on the address our own edge observed.
 *
 * THE SECOND CONDITION (audit R105). Counting hops is only sound when the
 * request really came through a proxy. A self-hosted village whose port is
 * published on a public interface can be reached directly, and then the header
 * is entirely the caller's: with TRUSTED_PROXY_HOPS=1 the "rightmost entry"
 * is whatever they typed, and every limit resets per request. So the header is
 * read only when the socket peer is a private or loopback address, which is
 * where a proxy on the same machine or the same private network connects
 * from. A public peer IS the client, and its socket address is the answer.
 *
 * `TRUSTED_PROXY_PEER=any` turns the second condition off, for a platform
 * whose edge connects from a public address. Use it only when nothing can
 * reach this process except through that edge.
 */

export interface ClientIpConfig {
  /** How many proxies sit in front of this process. 0 means none. */
  hops: number;
  /** Trust the header from any peer, not only private and loopback ones. */
  anyPeer: boolean;
}

export function clientIpConfigFromEnv(env: NodeJS.ProcessEnv = process.env): ClientIpConfig {
  return {
    hops: Math.max(0, Number(env.TRUSTED_PROXY_HOPS ?? 1) || 0),
    anyPeer: String(env.TRUSTED_PROXY_PEER ?? "").trim().toLowerCase() === "any",
  };
}

/** `::ffff:10.0.0.1` is the IPv4 address 10.0.0.1 on a dual-stack socket. */
function unmapped(addr: string): string {
  const a = addr.trim().toLowerCase();
  return a.startsWith("::ffff:") && a.includes(".") ? a.slice(7) : a;
}

function ipv4Octets(addr: string): number[] | null {
  const parts = addr.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return nums.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) ? nums : null;
}

/**
 * Loopback, RFC 1918, carrier-grade NAT (RFC 6598, which some platforms use
 * for their internal network), link-local, and the IPv6 equivalents. These
 * are the addresses a proxy we run connects from; none is routable from the
 * open internet, so a request from one already came through our own network.
 */
export function isPrivatePeer(address: string | undefined | null): boolean {
  if (!address) return false;
  const a = unmapped(address);
  const v4 = ipv4Octets(a);
  if (v4) {
    const [x, y] = v4;
    return (
      x === 127 ||
      x === 10 ||
      (x === 172 && y >= 16 && y <= 31) ||
      (x === 192 && y === 168) ||
      (x === 100 && y >= 64 && y <= 127) ||
      (x === 169 && y === 254)
    );
  }
  if (!a.includes(":")) return false;
  if (a === "::1") return true;
  // fc00::/7 (unique local) and fe80::/10 (link local).
  return /^f[cd][0-9a-f]{0,2}:/.test(a) || /^fe[89ab][0-9a-f]?:/.test(a);
}

/** The X-Forwarded-For entries, in order, however the header arrived. */
function forwardedChain(raw: string | string[] | undefined): string[] {
  return (Array.isArray(raw) ? raw.join(",") : String(raw ?? ""))
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * The pure rule, so a test can drive it without a request object.
 * `socketAddress` is the peer the TCP connection came from.
 */
export function deriveClientIp(
  forwardedFor: string | string[] | undefined,
  socketAddress: string | undefined | null,
  config: ClientIpConfig,
): string {
  const socket = socketAddress ? unmapped(socketAddress) : "unknown";
  const chain = forwardedChain(forwardedFor);
  if (!chain.length || config.hops <= 0) return socket;
  if (!config.anyPeer && !isPrivatePeer(socketAddress)) return socket;
  // Fewer entries than hops means the header did not come through the chain
  // we expect; the leftmost is then the least-bad answer available.
  return chain[Math.max(0, chain.length - config.hops)];
}

/** Whether this request carried a header the rule above refused to read. */
export function forwardedHeaderIgnored(
  forwardedFor: string | string[] | undefined,
  socketAddress: string | undefined | null,
  config: ClientIpConfig,
): boolean {
  return forwardedChain(forwardedFor).length > 0 && config.hops > 0 && !config.anyPeer && !isPrivatePeer(socketAddress);
}
