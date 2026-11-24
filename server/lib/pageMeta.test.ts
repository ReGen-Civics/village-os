import { describe, expect, it } from "vitest";
import { sitePageMeta, spliceHeroPreload, spliceMeta, type ShareCardLookup } from "./pageMeta";
import { documentTitle } from "../../shared/pageTitles";

const config = {
  project: { name: "Willowbrook", tagline: "Roots and rivers", commitmentName: "Village Pledge", location: "" },
  images: { hero: "/uploads/hero.webp" },
};
const SHELL = `<html><head>
    <title>Village</title>
    <meta name="description" content="A coordination platform" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Village" />
  </head><body></body></html>`;

describe("what a shared link shows", () => {
  it("names the page and the village, and falls back to the Tagline and homepage picture", () => {
    const meta = sitePageMeta("/visit", "https://willow.example", config, null);
    expect(meta.title).toBe("Visit · Willowbrook");
    expect(meta.description).toBe("Roots and rivers");
    expect(meta.image).toBe("https://willow.example/uploads/hero.webp");
    expect(meta.url).toBe("https://willow.example/visit");
    expect(meta.siteName).toBe("Willowbrook");
  });

  it("uses the village's own share sentence and picture from Admin, Pages, Whole site", () => {
    const content = { "page-site": { share: { description: "A valley that remembers.", image: "/uploads/share.webp" } } };
    const meta = sitePageMeta("/", "https://willow.example", config, content);
    expect(meta.title).toBe("Willowbrook");
    expect(meta.description).toBe("A valley that remembers.");
    expect(meta.image).toBe("https://willow.example/uploads/share.webp");
  });

  it("calls the commitment page by the village's own word for it", () => {
    expect(documentTitle("/love-letter", "Willowbrook", { commitment: "Village Pledge" })).toBe("Village Pledge · Willowbrook");
    expect(documentTitle("/forum/123", "Willowbrook")).toBe("Forum · Willowbrook");
  });

  it("draws no picture it cannot address absolutely", () => {
    const meta = sitePageMeta("/", "", config, null);
    expect(meta.image).toBe("");
    expect(meta.url).toBe("");
  });

  it("replaces the neutral tags rather than adding a second set", () => {
    const html = spliceMeta(SHELL, sitePageMeta("/team", "https://willow.example", config, null));
    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(html).toContain("<title>Team · Willowbrook</title>");
    expect(html.match(/property="og:title"/g)).toHaveLength(1);
    expect(html).toContain('<meta property="og:image" content="https://willow.example/uploads/hero.webp" />');
    expect(html).not.toContain("A coordination platform");
  });

  it("escapes what a village typed", () => {
    const html = spliceMeta(SHELL, { ...sitePageMeta("/", "", config, null), title: `Willow "&" <brook>` });
    expect(html).toContain("<title>Willow &quot;&amp;&quot; &lt;brook&gt;</title>");
  });
});

describe("the share card of a story page this village switched off", () => {
  it("names the village alone, no address of its own, and asks search engines to leave it out", () => {
    const meta = sitePageMeta("/housing", "https://willow.example", config, null, true);
    expect(meta.title).toBe("Willowbrook");
    expect(meta.url).toBe("");
    const html = spliceMeta(SHELL, meta);
    expect(html).toContain("<title>Willowbrook</title>");
    expect(html).not.toContain("Housing");
    expect(html).not.toContain("/housing");
    expect(html).toContain('<meta name="robots" content="noindex" />');
  });

  it("is the ordinary card while the page is served, the control for the case above", () => {
    const html = spliceMeta(SHELL, sitePageMeta("/housing", "https://willow.example", config, null));
    expect(html).toContain("<title>Housing · Willowbrook</title>");
    expect(html).toContain('<link rel="canonical" href="https://willow.example/housing" />');
    expect(html).not.toContain("noindex");
  });
});

describe("the names of the story pages in the menu and footer", () => {
  it("serves every story page's name, with the village's commitment word, and marks none as changed by default", async () => {
    const { siteWords } = await import("./pageMeta");
    const words = siteWords(null, config);
    expect(words.menu["/visit"]).toEqual({ label: "Plan a Visit", subtitle: "" });
    expect(words.menu["/love-letter"].label).toBe("Sign the Village Pledge");
    expect(words.menuChanged).toEqual([]);
  });

  it("marks only the pages the village renamed, so the footer keeps its own wording for the rest", async () => {
    const { siteWords } = await import("./pageMeta");
    const words = siteWords({ "page-site": { menu: { pages: [{ id: "/visit", label: "Come Stay" }] } } }, config);
    expect(words.menu["/visit"].label).toBe("Come Stay");
    expect(words.menuChanged).toEqual(["/visit"]);
  });
});

describe("a title that carries a replacement pattern (R114)", () => {
  it("is written as typed, never expanded into the page around it", () => {
    // String.replace reads $&, $' and $` in a replacement STRING. A quest
    // titled with one used to copy pieces of the shell into the head.
    const meta = { ...sitePageMeta("/", "https://willow.example", config, null), title: "Save $& and $' and $` now" };
    const out = spliceMeta(SHELL, meta);
    expect(out).toContain("Save $&amp; and $' and $` now");
    expect(out.match(/<\/head>/g)?.length).toBe(1);
    expect(out.match(/<html>/g)?.length).toBe(1);
  });
});

describe("spliceHeroPreload", () => {
  it("names the landing page's hero in a preload, with the srcset the page's own img uses", () => {
    const out = spliceHeroPreload(SHELL, "/api/uploads/hero.webp", "/api/uploads/hero.webp?w=480 480w");
    expect(out).toContain('<link rel="preload" as="image" href="/api/uploads/hero.webp" imagesrcset="/api/uploads/hero.webp?w=480 480w" imagesizes="100vw" fetchpriority="high">');
    expect(out.indexOf("preload")).toBeLessThan(out.indexOf("</head>"));
  });

  it("adds nothing with no hero, and nothing for an address that is not a path or an http(s) URL", () => {
    expect(spliceHeroPreload(SHELL, "")).toBe(SHELL);
    expect(spliceHeroPreload(SHELL, undefined)).toBe(SHELL);
    expect(spliceHeroPreload(SHELL, "javascript:alert(1)")).toBe(SHELL);
    expect(spliceHeroPreload(SHELL, "//evil.example/x.webp")).toBe(SHELL);
  });

  it("escapes what it writes into the attribute", () => {
    expect(spliceHeroPreload(SHELL, 'https://cdn.example/a"b.webp')).toContain('href="https://cdn.example/a&quot;b.webp"');
  });
});

describe("the village's own share card (server/lib/shareCard.ts)", () => {
  const uploaded = { ...config, images: { hero: "/api/uploads/hero-1a2b.webp" } };
  const asked: Array<[string, string]> = [];
  // Stands in for the volume: a card exists for this village's own hero, at version abc123.
  const lookup: ShareCardLookup = (picture, origin) => {
    asked.push([picture, origin]);
    return picture === "/api/uploads/hero-1a2b.webp" ? "abc123" : null;
  };

  it("names the 1200x630 JPEG card, versioned, when the picture is one of the village's uploads", () => {
    asked.length = 0;
    const meta = sitePageMeta("/visit", "https://willow.example", uploaded, null, false, lookup);
    expect(asked).toEqual([["/api/uploads/hero-1a2b.webp", "https://willow.example"]]);
    expect(meta.image).toBe("https://willow.example/api/share-card.jpg?v=abc123");
    const html = spliceMeta(SHELL, meta);
    expect(html).toContain('<meta property="og:image" content="https://willow.example/api/share-card.jpg?v=abc123" />');
    expect(html).toContain('<meta property="og:image:width" content="1200" />');
    expect(html).toContain('<meta property="og:image:height" content="630" />');
    expect(html).toContain('<meta property="og:image:type" content="image/jpeg" />');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
  });

  it("asks about the Whole site share picture first, the same choice as before", () => {
    asked.length = 0;
    const content = { "page-site": { share: { image: "/api/uploads/share-9z.webp" } } };
    const meta = sitePageMeta("/", "https://willow.example", uploaded, content, false, lookup);
    expect(asked[0][0]).toBe("/api/uploads/share-9z.webp");
    // No card for that file (missing on the volume, say): its own address, as before, and no claimed size.
    expect(meta.image).toBe("https://willow.example/api/uploads/share-9z.webp");
    expect(meta.imageSize).toBeUndefined();
    expect(spliceMeta(SHELL, meta)).not.toContain("og:image:type");
  });

  it("keeps a picture on another host exactly as typed", () => {
    const content = { "page-site": { share: { image: "https://cdn.example/valley.webp" } } };
    const meta = sitePageMeta("/", "https://willow.example", uploaded, content, false, lookup);
    expect(meta.image).toBe("https://cdn.example/valley.webp");
    expect(meta.imageType).toBeUndefined();
  });

  it("names no card when the origin is unknown, since the card needs an absolute address", () => {
    asked.length = 0;
    const meta = sitePageMeta("/", "", uploaded, null, false, lookup);
    expect(meta.image).toBe("");
    expect(asked).toEqual([]);
  });

  it("is the old card with no lookup at all (control)", () => {
    const meta = sitePageMeta("/", "https://willow.example", uploaded, null);
    expect(meta.image).toBe("https://willow.example/api/uploads/hero-1a2b.webp");
    expect(meta.imageSize).toBeUndefined();
  });
});
