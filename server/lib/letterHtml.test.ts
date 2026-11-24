import { describe, expect, it } from "vitest";
import { letterParagraphs, plainLetterHtml } from "./letterHtml";

describe("plainLetterHtml", () => {
  it("makes every http(s) address a link, and leaves the sentence's own punctuation outside it", () => {
    const html = letterParagraphs("Confirm here:\nhttps://village.example/propose-a-role/confirm?token=abc&x=1.\n\nThanks.");
    expect(html).toContain('<a href="https://village.example/propose-a-role/confirm?token=abc&amp;x=1" style="color:inherit">https://village.example/propose-a-role/confirm?token=abc&amp;x=1</a>.');
    expect(html).toBe(
      '<p>Confirm here:<br><a href="https://village.example/propose-a-role/confirm?token=abc&amp;x=1" style="color:inherit">https://village.example/propose-a-role/confirm?token=abc&amp;x=1</a>.</p><p>Thanks.</p>',
    );
  });

  it("escapes before it links, so injected markup stays text and cannot break out of an href", () => {
    const html = letterParagraphs(`Hi <script>alert(1)</script>, see https://x.example/a"onmouseover="alert(1) and <b>this</b>`);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    // The address ends at the escaped quote: no attribute can be smuggled in.
    expect(html).toContain('<a href="https://x.example/a" style="color:inherit">https://x.example/a</a>&quot;onmouseover=&quot;alert(1)');
    expect(html).not.toMatch(/<a [^>]*onmouseover/);
  });

  it("links only http and https", () => {
    const html = letterParagraphs("javascript:alert(1) and ftp://x.example and data:text/html,hi");
    expect(html).not.toContain("<a ");
  });

  it("puts the one main action's button right after the paragraph holding its link, once", () => {
    const link = "https://village.example/propose-a-role/confirm?token=t1";
    const html = plainLetterHtml(`Hi Wren,\n\nConfirm it's you:\n${link}\n\nIf this was not you, leave it.\n\nAgain: ${link}`, {
      action: { href: link, label: "Confirm it's me" },
    });
    const buttons = html.match(/display:inline-block/g) ?? [];
    expect(buttons).toHaveLength(1);
    expect(html.indexOf("display:inline-block")).toBeGreaterThan(html.indexOf("Confirm it&#39;s you"));
    expect(html.indexOf("display:inline-block")).toBeLessThan(html.indexOf("If this was not you"));
    expect(html).toContain(`<a href="${link}" style="display:inline-block;`);
    expect(html).toContain(">Confirm it&#39;s me</a>");
    expect(html.startsWith("<!doctype html><html><body")).toBe(true);
  });

  it("draws no button when the action's link is not in the letter", () => {
    expect(letterParagraphs("No link here.", { action: { href: "https://x.example/y", label: "Go" } })).toBe("<p>No link here.</p>");
  });
});
