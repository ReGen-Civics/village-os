/**
 * Portal visitors into the village's Brevo list (server/lib/portalSync.ts): only while both halves
 * are set, one list only, the custom attributes dropped when the account lacks them, and removal
 * from that list on a person's request. The outbound call is swapped for a recorder.
 */
import { describe, expect, it } from "vitest";
import { brevoOn, removeFromBrevo, splitName, syncToBrevo, type BrevoDeps } from "./portalSync";

function recorder(fail: (url: string, body: any) => boolean = () => false) {
  const calls: Array<{ url: string; body: any; headers: Record<string, string> }> = [];
  const post = async (url: string, body: unknown, headers: Record<string, string>) => {
    calls.push({ url, body, headers });
    if (fail(url, body)) throw new Error("400");
    return null;
  };
  return { calls, post };
}

const deps = (over: Partial<BrevoDeps> = {}): BrevoDeps => ({ apiKey: () => "test-key", listId: () => 7, ...over });
const ana = { email: "ana@example.org", name: "Ana María Solís", interest: "seeder" as const, whatsapp: "+506 8888 7777" };

describe("the village's email list", () => {
  it("is off until both the key and a list are set", () => {
    expect(brevoOn(deps())).toBe(true);
    expect(brevoOn(deps({ apiKey: () => "" }))).toBe(false);
    expect(brevoOn(deps({ listId: () => 0 }))).toBe(false);
  });

  it("adds one contact to the one list, named, with source and interest, and sends nothing else", async () => {
    const r = recorder();
    expect(await syncToBrevo(deps({ post: r.post }), ana)).toBeNull();
    expect(r.calls).toHaveLength(1);
    expect(r.calls[0].url).toBe("https://api.brevo.com/v3/contacts");
    expect(r.calls[0].headers["api-key"]).toBe("test-key");
    expect(r.calls[0].body).toEqual({
      email: "ana@example.org",
      listIds: [7],
      updateEnabled: true,
      attributes: { FIRSTNAME: "Ana", LASTNAME: "María Solís", PORTAL_SOURCE: "portal", PORTAL_INTEREST: "seeder", WHATSAPP: "+506 8888 7777" },
    });
  });

  it("still lists the person when the account has not made the custom attributes", async () => {
    const r = recorder((_url, body) => "PORTAL_SOURCE" in (body.attributes ?? {}));
    expect(await syncToBrevo(deps({ post: r.post }), ana)).toBeNull();
    expect(r.calls).toHaveLength(2);
    expect(r.calls[1].body.attributes).toEqual({ FIRSTNAME: "Ana", LASTNAME: "María Solís" });
    expect(r.calls[1].body.listIds).toEqual([7]);
  });

  it("says why when Brevo refuses both tries, and never throws", async () => {
    const r = recorder(() => true);
    expect(await syncToBrevo(deps({ post: r.post }), ana)).toMatch(/Brevo refused/);
  });

  it("calls nobody while the list is not set up", async () => {
    const r = recorder();
    expect(await syncToBrevo(deps({ listId: () => 0, post: r.post }), ana)).toMatch(/not set up/);
    expect(await removeFromBrevo(deps({ apiKey: () => "", post: r.post }), ["ana@example.org"])).toBeNull();
    expect(r.calls).toHaveLength(0);
  });

  it("takes a forgotten person off that list only", async () => {
    const r = recorder();
    expect(await removeFromBrevo(deps({ post: r.post }), ["ana@example.org"])).toBeNull();
    expect(r.calls[0].url).toBe("https://api.brevo.com/v3/contacts/lists/7/contacts/remove");
    expect(r.calls[0].body).toEqual({ emails: ["ana@example.org"] });
  });

  it("splits a name the way Brevo's two name fields hold one", () => {
    expect(splitName("  Ana  ")).toEqual({ first: "Ana", last: "" });
    expect(splitName("Ana María Solís")).toEqual({ first: "Ana", last: "María Solís" });
  });
});
