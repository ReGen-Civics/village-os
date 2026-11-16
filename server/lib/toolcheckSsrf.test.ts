/**
 * SSRF range check: every spelling of a private, loopback or internal host
 * must be refused, including the forms a URL parser or a resolver can hand
 * back (v4-mapped v6, link-local, unique-local, unspecified), and the ranges
 * that carry or reach an IPv4 address through a translator (NAT64, 6to4,
 * Teredo).
 *
 * The predicate is `reservedAddress` (outboundAddress.ts), the ONE every
 * outbound dial shares. toolcheck used to keep a weaker twin, `ipIsPrivate`,
 * which read every address in the "residue" table below as public.
 */
import { describe, expect, it } from "vitest";
import { reservedAddress } from "./outboundAddress";
import { reservedAddress as sitePullReserved } from "./sitePull";
import { guardOutboundUrl } from "./toolcheck";

const refused = (ip: string) => reservedAddress(ip.replace(/^\[|\]$/g, "")) !== null;

describe("the outbound address predicate", () => {
  it("is the same function sitePull uses: one predicate, no twin", () => {
    expect(sitePullReserved).toBe(reservedAddress);
  });

  it.each([
    "127.0.0.1", "0.0.0.0", "10.1.2.3", "169.254.169.254", "192.168.1.1", "172.16.0.1", "100.64.0.1",
    "::1", "::", "[::]", "[::1]",
    "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:7f00:0001", "0:0:0:0:0:ffff:7f00:1", "[::ffff:a9fe:a9fe]",
    "::ffff:10.0.0.1", "::127.0.0.1",
    "fe80::1", "febf::1", "fc00::1", "fd12:3456::1", "fe80::1%eth0",
  ])("refuses %s", (ip) => {
    expect(refused(ip)).toBe(true);
  });

  // The residue #1135 left: each of these was ALLOWED by toolcheck's old
  // ipIsPrivate. The name in each row is the block the refusal must name.
  it.each([
    // 6to4: 2002:WWXX:YYZZ:: carries the IPv4 WW.XX.YY.ZZ. Refused whole.
    ["2002:7f00:1::", "2002::/16"], // 127.0.0.1 inside
    ["2002:a9fe:a9fe::1", "2002::/16"], // 169.254.169.254 inside
    ["2002:c0a8:101::", "2002::/16"], // 192.168.1.1 inside
    ["2002:808:808::", "2002::/16"], // even a public v4 inside: the relay is the risk
    // NAT64: 64:ff9b::/96 with the IPv4 in the low 32 bits. Refused whole.
    ["64:ff9b::7f00:1", "64:ff9b::/96"],
    ["64:ff9b::169.254.169.254", "64:ff9b::/96"],
    ["64:ff9b::a00:1", "64:ff9b::/96"],
    ["64:ff9b:1::a9fe:a9fe", "64:ff9b::/96"], // RFC 8215 local-use prefix
    // Teredo: 2001:0::/32 carries an obfuscated IPv4.
    ["2001:0:4136:e378:8000:63bf:3fff:fdd2", "2001::/32"],
    // IPv6 multicast ff00::/8.
    ["ff02::1", "ff00::/8"],
    ["ff05::2", "ff00::/8"],
    ["ff0e::1", "ff00::/8"],
    // Deprecated site-local fec0::/10.
    ["fec0::1", "fec0::/10"],
    ["feff::1", "fec0::/10"],
    // IPv4 multicast and reserved.
    ["224.0.0.1", "224.0.0.0/4"],
    ["239.255.255.250", "224.0.0.0/4"],
    ["240.0.0.1", "240.0.0.0/4"],
    ["255.255.255.255", "240.0.0.0/4"],
    // 0.0.0.0/8, CGNAT and link-local edges.
    ["0.1.2.3", "0.0.0.0/8"],
    ["100.127.255.255", "100.64.0.0/10"],
    ["169.254.0.1", "169.254.0.0/16"],
    ["169.254.169.254", "169.254.0.0/16"],
    ["::ffff:169.254.169.254", "169.254.0.0/16"],
  ])("refuses %s, naming %s", (ip, block) => {
    expect(reservedAddress(ip)).toContain(block);
  });

  it.each([
    "93.184.216.34", "8.8.8.8", "1.1.1.1", "100.63.255.255", "100.128.0.1", "223.255.255.255",
    "169.253.255.255", "169.255.0.1",
    "2606:4700:4700::1111", "2001:4860:4860::8888", "2a00:1450:4001::200e",
    "::ffff:8.8.8.8", "::ffff:808:808",
    // Neighbours of the refused v6 blocks, which must stay public.
    "2003::1", "2001:200::1", "2001:4860::1",
  ])("allows public %s", (ip) => {
    expect(reservedAddress(ip)).toBeNull();
  });

  // The documentation ranges are routed nowhere, so refusing them closes no
  // SSRF, and the inbox and agent-key suites use https://192.0.2.10/ as their
  // "public, never dialled" address. Allowed on purpose; see outboundAddress.ts.
  it.each(["192.0.2.10", "198.51.100.7", "203.0.113.9", "2001:db8::1"])(
    "allows the documentation address %s, which the suites dial as public",
    (ip) => {
      expect(reservedAddress(ip)).toBeNull();
    },
  );

  it("fails closed on anything that is not an address", () => {
    expect(reservedAddress("not-an-address")).not.toBeNull();
    expect(reservedAddress("1:2:3")).not.toBeNull();
    expect(reservedAddress("gggg::1")).not.toBeNull();
  });
});

describe("guardOutboundUrl literal hosts", () => {
  // The WHATWG URL parser rewrites decimal, octal and hex IPv4 to dotted form.
  it.each([
    "https://2130706433/",
    "https://0177.0.0.1/",
    "https://0x7f.1/",
    "https://0.0.0.0/",
    "https://[::]/",
    "https://[::1]/",
    "https://[::ffff:127.0.0.1]/",
    "https://[::ffff:7f00:1]/",
    "https://[fe80::1]/",
    "https://[fc00::1]/",
    "https://[fd00::1]/",
    "https://[2002:7f00:1::]/",
    "https://[64:ff9b::a9fe:a9fe]/",
    "https://[ff02::1]/",
    "https://[fec0::1]/",
    "https://224.0.0.1/",
    "https://240.0.0.1/",
    "https://100.64.0.1/",
    "https://169.254.169.254/",
  ])("refuses %s", async (u) => {
    expect((await guardOutboundUrl(u)).ok).toBe(false);
  });

  it("passes a public literal address", async () => {
    expect((await guardOutboundUrl("https://93.184.216.34/")).ok).toBe(true);
    expect((await guardOutboundUrl("https://[2606:4700:4700::1111]/")).ok).toBe(true);
  });
});
