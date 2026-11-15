/**
 * THE ONE OUTBOUND ADDRESS PREDICATE.
 *
 * Every connection this server opens to an address somebody typed (a tool
 * link, a peer, a webhook, a calendar feed, a founder's site, the Saberra
 * service, a Base RPC node) is decided here, after DNS, on the address it
 * will actually dial. There used to be two copies: `ipIsPrivate` in
 * toolcheck.ts and `reservedAddress` in sitePull.ts. The sitePull copy was a
 * superset; the toolcheck copy, which every pinned dialer used, read NAT64,
 * 6to4, multicast and the reserved /4 as public, and each of those is a way
 * to write 127.0.0.1 or 169.254.169.254 that a v4-only check misses. Two
 * copies of a security predicate drift, and the weaker one is the one the
 * most callers reach. So there is one, here, and both files import it.
 *
 * Named ranges rather than a boolean: a refusal that says which block it
 * matched is one a founder can act on, and a reviewer reads the list instead
 * of trusting the word "private".
 *
 * Input is a bare address literal (no brackets). A zone id (`fe80::1%eth0`)
 * is tolerated. Anything that is not an address is refused: this only ever
 * sees resolver answers and literal hosts, and an unreadable one fails closed.
 */
import net from "node:net";

/**
 * The reserved IPv4 blocks, each returning the name of the block it matched.
 */
export function reservedIpv4(ip: string): string | null {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return "an address this platform could not read";
  }
  const [a, b, c] = p;
  if (a === 0) return "the 0.0.0.0/8 block, which includes the unspecified address";
  if (a === 10) return "the private 10.0.0.0/8 block";
  if (a === 127) return "the loopback 127.0.0.0/8 block";
  if (a === 169 && b === 254) return "the link local 169.254.0.0/16 block, where cloud metadata answers";
  if (a === 172 && b >= 16 && b <= 31) return "the private 172.16.0.0/12 block";
  if (a === 192 && b === 168) return "the private 192.168.0.0/16 block";
  if (a === 192 && b === 0 && c === 0) return "the reserved 192.0.0.0/24 block";
  if (a === 192 && b === 0 && c === 2) return "the documentation 192.0.2.0/24 block";
  if (a === 100 && b >= 64 && b <= 127) return "the carrier grade NAT 100.64.0.0/10 block";
  if (a === 198 && (b === 18 || b === 19)) return "the benchmarking 198.18.0.0/15 block";
  if (a === 198 && b === 51 && c === 100) return "the documentation 198.51.100.0/24 block";
  if (a === 203 && b === 0 && c === 113) return "the documentation 203.0.113.0/24 block";
  if (a >= 224 && a <= 239) return "the multicast 224.0.0.0/4 block";
  if (a >= 240) return "the reserved 240.0.0.0/4 block, which includes the broadcast address";
  return null;
}

/**
 * An IPv6 address as eight 16-bit groups, or null when it is not one.
 *
 * Expanded rather than pattern matched, because every bypass in this area is
 * a second spelling of the same address: `::ffff:127.0.0.1` and
 * `::ffff:7f00:1` are one address, and a check that reads the string sees two.
 */
export function ipv6Groups(raw: string): number[] | null {
  let ip = raw.trim().toLowerCase();
  const zone = ip.indexOf("%");
  if (zone >= 0) ip = ip.slice(0, zone);

  // A trailing dotted quad, as in ::ffff:127.0.0.1, is two groups in disguise.
  const dotted = ip.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (dotted && dotted.index !== undefined) {
    const parts = dotted[1].split(".").map(Number);
    if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
    const hi = ((parts[0] << 8) | parts[1]) >>> 0;
    const lo = ((parts[2] << 8) | parts[3]) >>> 0;
    ip = `${ip.slice(0, dotted.index)}${hi.toString(16)}:${lo.toString(16)}`;
  }

  const halves = ip.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  if (halves.length === 1 && head.length !== 8) return null;
  const fill = 8 - head.length - tail.length;
  if (halves.length === 2 && fill < 0) return null;
  const groups = [...head, ...(halves.length === 2 ? new Array(fill).fill("0") : []), ...tail];
  if (groups.length !== 8) return null;
  if (groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map((g) => parseInt(g, 16));
}

/**
 * The one predicate. The name of the reserved range an address sits in, or
 * null when it is an ordinary public address this platform may dial.
 */
export function reservedAddress(ip: string): string | null {
  if (net.isIPv4(ip)) return reservedIpv4(ip);

  const g = ipv6Groups(ip);
  if (!g) return "an address this platform could not read";

  if (g.every((n) => n === 0)) return "the unspecified address ::";
  if (g.slice(0, 7).every((n) => n === 0) && g[7] === 1) return "the IPv6 loopback ::1";

  // The v4 mapped form is legitimate and is checked against the v4 rules.
  if (g.slice(0, 5).every((n) => n === 0) && g[5] === 0xffff) {
    const v4 = `${g[6] >> 8}.${g[6] & 0xff}.${g[7] >> 8}.${g[7] & 0xff}`;
    const why = reservedIpv4(v4);
    return why ? `${why}, written in the IPv4 mapped form` : null;
  }
  // The IPv4 compatible form is deprecated, so nothing legitimate uses it,
  // and ::7f00:1 is one more way to write loopback. Refused whole.
  if (g.slice(0, 6).every((n) => n === 0)) {
    return "the deprecated IPv4 compatible ::/96 form, which is another way to write an IPv4 address";
  }
  // NAT64, 6to4 and Teredo all carry an IPv4 address inside them and reach it
  // through a translator or relay. Refused whole, whatever address they carry:
  // decoding the embedded v4 and allowing the public ones would still hand the
  // dial to a gateway on somebody's network. 64:ff9b:1::/48 is the local-use
  // NAT64 prefix (RFC 8215), the same thing under another number.
  if (g[0] === 0x0064 && g[1] === 0xff9b) return "the NAT64 prefix 64:ff9b::/96, which reaches IPv4 through a local gateway";
  if (g[0] === 0x2002) return "the 6to4 prefix 2002::/16, which carries an IPv4 address inside it";
  if (g[0] === 0x2001 && g[1] === 0x0000) return "the Teredo prefix 2001::/32, which carries an IPv4 address inside it";

  if ((g[0] & 0xfe00) === 0xfc00) return "the unique local fc00::/7 block";
  if ((g[0] & 0xffc0) === 0xfe80) return "the link local fe80::/10 block";
  if ((g[0] & 0xffc0) === 0xfec0) return "the deprecated site local fec0::/10 block";
  if ((g[0] & 0xff00) === 0xff00) return "the IPv6 multicast ff00::/8 block";
  if (g[0] === 0x2001 && g[1] === 0x0db8) return "the documentation 2001:db8::/32 block";
  if (g[0] === 0x0100 && g.slice(1, 4).every((n) => n === 0)) return "the discard-only 100::/64 block";
  return null;
}
