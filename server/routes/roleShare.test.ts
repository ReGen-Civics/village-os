/**
 * ONE ROLE'S LINK PREVIEW (server/routes/roleShare.ts): `/roles/<slug>` unfurls as the role, from the role's own
 * words and the village's own configuration, and anything the village does not show falls through.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import http from "node:http";

const ROLES = [
  { id: "role-a1", name: "Lead Finance Steward", aim: "Keep the books true.", whyItMatters: "Goal: a funded first season", archetypes: ["guardian"], isExample: false, active: true, listed: true },
  { id: "garden", name: "Garden Steward", aim: "", whyItMatters: "Goal: food from the land", archetypes: [], isExample: false, active: true, listed: true },
  { id: "hidden", name: "Hidden Role", aim: "Unlisted.", whyItMatters: "", archetypes: [], isExample: false, active: true, listed: false },
  { id: "demo", name: "Demo Role", aim: "An example.", whyItMatters: "", archetypes: [], isExample: true, active: true, listed: true },
];
vi.mock("../lib/orgChart", () => ({ listOrgRoles: async () => ROLES }));

const { register, roleShareMeta } = await import("./roleShare");

const SHELL = `<!doctype html><html><head><title>Village</title><meta property="og:title" content="Village" /></head><body></body></html>`;
const CONFIG = { project: { name: "Willow", tagline: "A place to grow" }, images: { hero: "/uploads/hero.webp" } };

let server: ReturnType<express.Express["listen"]> | null = null;
afterEach(() => {
  server?.close();
  server = null;
});

async function get(path: string): Promise<{ status: number; body: string }> {
  const app = express();
  register(app, {
    shell: () => SHELL,
    config: () => CONFIG as never,
    origin: () => "https://willow.example",
    content: () => null,
    send: (_req, res, html) => res.type("html").send(html),
    pool: () => ({}) as never,
  });
  app.get("/{*splat}", (_req, res) => res.status(200).send("fallthrough"));
  server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  return new Promise((resolve, reject) => {
    http
      .get({ host: "127.0.0.1", port, path }, (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c: string) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      })
      .on("error", reject);
  });
}

describe("a role's link preview", () => {
  it("unfurls by the name's slug as the role at the village: purpose, art, its own address, one og:title", async () => {
    const { body } = await get("/roles/lead-finance-steward");
    expect(body).toContain('<meta property="og:title" content="Lead Finance Steward at Willow" />');
    expect(body).toContain('<meta property="og:description" content="Keep the books true." />');
    expect(body).toMatch(/og:image" content="https:\/\/willow\.example\/images\/avatars\/guardian-[^"]+\.webp"/);
    expect(body).toContain('<meta property="og:url" content="https://willow.example/roles/lead-finance-steward" />');
    expect(body.match(/property="og:title"/g)).toHaveLength(1);
  });

  it("finds a role by its id too, says its goal when it writes no purpose, and takes the village's picture when it has no art", async () => {
    const { body } = await get("/roles/garden");
    expect(body).toContain('og:title" content="Garden Steward at Willow"');
    expect(body).toContain('og:description" content="food from the land"');
    expect(body).toContain('og:image" content="https://willow.example/uploads/hero.webp"');
    expect(body).toContain('og:url" content="https://willow.example/roles/garden-steward"');
  });

  it("falls through for a role the village does not show, an example, a stranger and the roles pages' own words", async () => {
    for (const p of ["/roles/hidden", "/roles/demo", "/roles/nobody", "/roles/select"]) expect((await get(p)).body).toBe("fallthrough");
  });

  it("names no village of its own: the title is the role alone when the village has no name (control)", () => {
    const meta = roleShareMeta(ROLES[1], ROLES, "", { project: { name: "" } } as never, null);
    expect(meta.title).toBe("Garden Steward");
    expect(meta.url).toBe("");
  });
});
