/**
 * The address every IP-keyed limit keys on (audit R105). A caller who reaches
 * the app port directly must not be able to choose it with a header.
 */
import { describe, expect, it } from "vitest";
import { clientIpConfigFromEnv, deriveClientIp, forwardedHeaderIgnored, isPrivatePeer } from "./clientIp";

const ONE_HOP = { hops: 1, anyPeer: false };

describe("deriveClientIp", () => {
  it("a direct client on a public address with a forged header gets its socket address", () => {
    expect(deriveClientIp("1.2.3.4", "203.0.113.9", ONE_HOP)).toBe("203.0.113.9");
    expect(deriveClientIp("9.9.9.9, 1.2.3.4", "::ffff:203.0.113.9", ONE_HOP)).toBe("203.0.113.9");
    expect(forwardedHeaderIgnored("1.2.3.4", "203.0.113.9", ONE_HOP)).toBe(true);
  });

  it("behind one proxy on loopback or a private network, the client is the rightmost entry", () => {
    expect(deriveClientIp("198.51.100.7", "127.0.0.1", ONE_HOP)).toBe("198.51.100.7");
    // A client pre-seeding the header sits to the left and is ignored.
    expect(deriveClientIp("6.6.6.6, 198.51.100.7", "::ffff:172.18.0.1", ONE_HOP)).toBe("198.51.100.7");
    expect(deriveClientIp("198.51.100.7", "100.64.3.2", ONE_HOP)).toBe("198.51.100.7");
    expect(deriveClientIp("198.51.100.7", "fd12:3456::1", ONE_HOP)).toBe("198.51.100.7");
    expect(forwardedHeaderIgnored("198.51.100.7", "10.0.0.5", ONE_HOP)).toBe(false);
  });

  it("two hops reads the second entry from the right", () => {
    expect(deriveClientIp("6.6.6.6, 198.51.100.7, 10.0.0.2", "10.0.0.3", { hops: 2, anyPeer: false })).toBe("198.51.100.7");
  });

  it("zero hops, or no header, is the socket address", () => {
    expect(deriveClientIp("198.51.100.7", "127.0.0.1", { hops: 0, anyPeer: false })).toBe("127.0.0.1");
    expect(deriveClientIp(undefined, "203.0.113.9", ONE_HOP)).toBe("203.0.113.9");
    expect(deriveClientIp(undefined, undefined, ONE_HOP)).toBe("unknown");
  });

  it("TRUSTED_PROXY_PEER=any reads the header from a public peer", () => {
    const cfg = clientIpConfigFromEnv({ TRUSTED_PROXY_HOPS: "1", TRUSTED_PROXY_PEER: "any" } as NodeJS.ProcessEnv);
    expect(cfg).toEqual({ hops: 1, anyPeer: true });
    expect(deriveClientIp("198.51.100.7", "203.0.113.9", cfg)).toBe("198.51.100.7");
  });

  it("defaults to one hop and private peers only", () => {
    expect(clientIpConfigFromEnv({} as NodeJS.ProcessEnv)).toEqual({ hops: 1, anyPeer: false });
    expect(clientIpConfigFromEnv({ TRUSTED_PROXY_HOPS: "junk" } as NodeJS.ProcessEnv).hops).toBe(0);
  });
});

describe("isPrivatePeer", () => {
  it.each(["127.0.0.1", "::1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "100.64.0.1", "169.254.1.1", "fc00::1", "fe80::1", "::ffff:192.168.0.2"])(
    "%s is private",
    (a) => expect(isPrivatePeer(a)).toBe(true),
  );
  it.each(["203.0.113.9", "172.32.0.1", "100.128.0.1", "8.8.8.8", "2001:db8::1", "::ffff:8.8.8.8", "", "not-an-ip"])(
    "%s is not",
    (a) => expect(isPrivatePeer(a)).toBe(false),
  );
});
