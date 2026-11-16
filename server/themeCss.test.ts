import { describe, expect, it } from "vitest";
import { FONT_CATALOG } from "../shared/fontCatalog";
import {
  THEME_HREF,
  buildThemeCss,
  fontFormatOf,
  sanitizeFontName,
  sanitizeFontStack,
  sanitizeImportUrl,
  themeCssVersion,
  villageFontOrigins,
  withThemeVersion,
} from "./lib/themeCss";
import { register } from "./routes/brandTheme";

describe("theme.css emission", () => {
  it("emits nothing for an untouched fork", () => {
    // The white-label baseline: a village that sets no theme gets an empty
    // file, not someone else's typography.
    expect(buildThemeCss(undefined)).toBe("");
    expect(buildThemeCss({})).toBe("");
    expect(buildThemeCss({ fontImportUrl: "", fontDisplay: "", fontBody: "" })).toBe("");
  });

  it("emits a village's font import and display override", () => {
    const css = buildThemeCss({
      fontImportUrl: "https://amora.cr/fonts/serenity.css", // brand-ok: test fixture proving a VILLAGE (not the platform) can carry its own font
      fontDisplay: '"Serenity", "Raleway", sans-serif',
    }, villageFontOrigins({ project: { siteUrl: "https://amora.cr/" } }, "")); // brand-ok: the village's own site address, as Admin saves it
    expect(css).toContain('@import url("https://amora.cr/fonts/serenity.css");'); // brand-ok: same fixture
    expect(css).toContain('--font-display: "Serenity", "Raleway", sans-serif;');
    // Doubled :root beats the platform defaults regardless of load order.
    expect(css).toContain(":root:root {");
  });

  it("carries a pinned accent from the brand document into the stylesheet", () => {
    // Admin, Look saves `theme.accent`. If emission ignored it, the founder
    // would see a field that saves and changes nothing on the site.
    const derived = buildThemeCss({ seed: "#14362b", character: "civic" });
    const pinned = buildThemeCss({ seed: "#14362b", character: "civic", accent: "#b08d57" });
    const sunOf = (css: string) => /--tone-sun: (#[0-9a-f]{6});/.exec(css)?.[1];
    expect(sunOf(derived)).toBeTruthy();
    expect(sunOf(pinned)).toBeTruthy();
    expect(sunOf(pinned)).not.toBe(sunOf(derived));
    // An accent alone, with no seed, is still the neutral fork.
    expect(buildThemeCss({ accent: "#b08d57" })).toBe("");
  });

  it("takes a font URL only from uploads, Google Fonts or the village's own site", () => {
    const google = "https://fonts.googleapis.com/css2?family=Jost:wght@400;500&display=swap";
    expect(sanitizeImportUrl(google)).toBe(google);
    expect(sanitizeImportUrl("https://fonts.gstatic.com/s/jost/v15/a.woff2")).toBe("https://fonts.gstatic.com/s/jost/v15/a.woff2");
    // Any other host is refused, so a story.tell holder cannot make every
    // visitor's browser call a server of their choosing.
    expect(sanitizeImportUrl("https://tracker.example/f.css")).toBeNull();
    expect(sanitizeImportUrl("https://fonts.googleapis.com.evil.example/f.css")).toBeNull();
    expect(sanitizeImportUrl("https://evil.example@fonts.googleapis.com.x/f.css")).toBeNull();
    expect(sanitizeImportUrl("https://village.example/fonts/a.css")).toBeNull();
    // The village's own site address, and only that host.
    const own = villageFontOrigins({ project: { siteUrl: "https://village.example/about" } }, "https://app.village.example/");
    expect(own).toEqual(["https://village.example", "https://app.village.example"]);
    expect(sanitizeImportUrl("https://village.example/fonts/a.css", own)).toBe("https://village.example/fonts/a.css");
    expect(sanitizeImportUrl("https://other.example/fonts/a.css", own)).toBeNull();
    // A refused host emits nothing, the import and the face alike.
    expect(buildThemeCss({ fontImportUrl: "https://tracker.example/f.css" })).toBe("");
    expect(buildThemeCss({ fontFaceName: "X", fontFaceUrl: "https://tracker.example/x.woff2" })).toBe("");
    // An http: or junk site address adds no host.
    expect(villageFontOrigins({ project: { siteUrl: "http://village.example" } }, "not a url")).toEqual([]);
    expect(villageFontOrigins(null, "")).toEqual([]);
  });

  it("accepts a same-origin uploads path", () => {
    expect(sanitizeImportUrl("/api/uploads/brand-123-abcde.css")).toBe("/api/uploads/brand-123-abcde.css");
  });

  it("passes every catalogue stack through unchanged", () => {
    // The picker saves the offering's stack verbatim. A stack the sanitiser
    // refused would save fine and then emit nothing, so the admin would see
    // their choice stored and the site still in the default face.
    for (const f of FONT_CATALOG) expect(sanitizeFontStack(f.stack), f.id).toBe(f.stack);
  });

  describe("uploaded font packages", () => {
    it("emits a complete @font-face for an uploaded file", () => {
      const css = buildThemeCss({
        fontFaceName: "Village Hand",
        fontFaceUrl: "/api/uploads/brand-font-123-abcde.woff2",
      });
      expect(css).toContain('font-family: "Village Hand";');
      expect(css).toContain('src: url("/api/uploads/brand-font-123-abcde.woff2") format("woff2");');
      expect(css).toContain("font-display: swap;");
    });

    it("emits NOTHING for half a declaration", () => {
      // A name without a file, or a file without a name, would LOOK
      // configured while silently rendering the fallback.
      expect(buildThemeCss({ fontFaceName: "Village Hand" })).toBe("");
      expect(buildThemeCss({ fontFaceUrl: "/api/uploads/brand-font-1-a.woff2" })).toBe("");
      // Unknown extension: no format hint, no declaration.
      expect(buildThemeCss({ fontFaceName: "X", fontFaceUrl: "/api/uploads/brand-font-1-a.css" })).toBe("");
    });

    it("derives the format browsers want from the extension", () => {
      expect(fontFormatOf("/api/uploads/a.woff2")).toBe("woff2");
      expect(fontFormatOf("/api/uploads/a.ttf")).toBe("truetype");
      expect(fontFormatOf("/api/uploads/a.otf")).toBe("opentype");
      expect(fontFormatOf("/api/uploads/a.exe")).toBeNull();
    });

    it("rejects a family name that could escape its quotes", () => {
      expect(sanitizeFontName('A"; } body { display:none } @font-face { font-family: "B')).toBeNull();
      expect(sanitizeFontName("Village Hand")).toBe("Village Hand");
      expect(sanitizeFontName("  ")).toBeNull();
    });
  });

  describe("hostile input is discarded whole, never repaired", () => {
    it("rejects CSS-injection in stacks", () => {
      // One brace and the value could close :root and open its own rule.
      expect(sanitizeFontStack('"A"; } body { display: none } ')).toBeNull();
      expect(sanitizeFontStack('"A" } * { background: url(https://evil.example/x) }')).toBeNull();
    });

    it("rejects URLs that could escape url(\"…\")", () => {
      expect(sanitizeImportUrl('https://x.example/a").css"); @import url("https://evil.example/b')).toBeNull();
      expect(sanitizeImportUrl("javascript:alert(1)")).toBeNull();
      expect(sanitizeImportUrl("http://insecure.example/f.css")).toBeNull(); // https only
      expect(sanitizeImportUrl("/api/uploads/../../../etc/passwd")).toBeNull();
      expect(sanitizeImportUrl("/etc/passwd")).toBeNull();
    });

    it("rejects non-strings without throwing", () => {
      expect(sanitizeFontStack(42 as unknown)).toBeNull();
      expect(sanitizeImportUrl({} as unknown)).toBeNull();
      expect(buildThemeCss({ fontDisplay: 42 as unknown as string })).toBe("");
    });
  });
});

describe("a stylesheet URL that moves when the brand moves", () => {
  const SHELL = '<head>\n    <link rel="stylesheet" href="/api/brand/theme.css" />\n  </head>';

  it("versions the shell's stylesheet link", () => {
    expect(withThemeVersion(SHELL, "0123456789abcdef")).toContain('href="/api/brand/theme.css?v=0123456789abcdef"');
    expect(withThemeVersion(SHELL, "0123456789abcdef")).not.toContain('href="/api/brand/theme.css"');
    expect(THEME_HREF).toBe("/api/brand/theme.css");
  });

  it("leaves a shell without the link exactly as it was, and never throws", () => {
    const other = '<head><link rel="stylesheet" href="/assets/index.css" /></head>';
    expect(withThemeVersion(other, "0123456789abcdef")).toBe(other);
    // A link written any other way is not the anchor, so it is not touched either.
    const single = "<link rel='stylesheet' href='/api/brand/theme.css' />";
    expect(withThemeVersion(single, "0123456789abcdef")).toBe(single);
    expect(withThemeVersion("", "0123456789abcdef")).toBe("");
  });

  it("versions an untouched fork's empty stylesheet too", () => {
    const empty = themeCssVersion(buildThemeCss(undefined));
    expect(empty).toMatch(/^[0-9a-f]{16}$/);
    expect(withThemeVersion(SHELL, empty)).toContain(`?v=${empty}"`);
  });

  it("moves the version when a font field moves", () => {
    const a = themeCssVersion(buildThemeCss({ fontDisplay: '"Cormorant Garamond", serif' }));
    const b = themeCssVersion(buildThemeCss({ fontDisplay: '"Cormorant Garamond", serif', fontBody: '"Jost", sans-serif' }));
    const c = themeCssVersion(buildThemeCss({ fontDisplay: '"Marcellus", serif' }));
    expect(new Set([a, b, c]).size).toBe(3);
    // The same brand gives the same version, so a page load and its stylesheet agree.
    expect(themeCssVersion(buildThemeCss({ fontDisplay: '"Cormorant Garamond", serif' }))).toBe(a);
  });
});

describe("the route and the shell agree on one version", () => {
  it("sends themeCssVersion as the stylesheet's ETag", async () => {
    const theme = { fontDisplay: '"Cormorant Garamond", serif' };
    let handler: ((req: any, res: any) => unknown) | null = null;
    register({ get: (_path: string, h: any) => { handler = h; } } as any, { getBrand: () => ({ theme }) });
    const headers: Record<string, string> = {};
    const res: any = {
      setHeader: (k: string, v: string) => { headers[k.toLowerCase()] = v; },
      status: () => res,
      end: () => res,
      type: () => res,
      send: () => res,
    };
    await handler!({ query: {}, headers: {} }, res);
    expect(headers.etag).toBe(`"${themeCssVersion(buildThemeCss(theme))}"`);
  });
});
