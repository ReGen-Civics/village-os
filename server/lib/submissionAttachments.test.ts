/**
 * A form's attachment is kept off the public uploads volume (audit, 15 Nov 2026):
 * the names this door reads, where it finds the bytes, how it answers, and what
 * the sweep deletes. The routes are pinned in server/uploadStrip.routes.e2e.test.ts.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UNSENT_ATTACHMENT_GRACE_MS, attachmentHeaders, attachmentName, attachmentPath, removeAttachment, sweepUnsentAttachments } from "./submissionAttachments";

const NAME = "proposal-1763200000000-ab12cd.pdf";

let root = "";
let priv = "";
let legacy = "";

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "submission-attachments-"));
  priv = path.join(root, "private-submission-attachments");
  legacy = path.join(root, "uploads");
  fs.mkdirSync(priv);
  fs.mkdirSync(legacy);
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("a form's attachment, off the public volume", () => {
  it("reads only a name the attachment door minted, basenamed", () => {
    expect(attachmentName(NAME)).toBe(NAME);
    expect(attachmentName(`../../${NAME}`)).toBe(NAME);
    expect(attachmentName("brand-1763200000000-ab12cd.png")).toBeNull();
    expect(attachmentName("../../etc/passwd")).toBeNull();
    expect(attachmentName("")).toBeNull();
  });

  it("finds the bytes in the private folder first, and a file sent before the change on the old volume", () => {
    expect(attachmentPath(priv, legacy, NAME)).toBeNull();
    fs.writeFileSync(path.join(legacy, NAME), "old");
    expect(attachmentPath(priv, legacy, NAME)).toBe(path.join(legacy, NAME));
    fs.writeFileSync(path.join(priv, NAME), "new");
    expect(attachmentPath(priv, legacy, NAME)).toBe(path.join(priv, NAME));
    // Nothing outside the door's own names is ever reached.
    fs.writeFileSync(path.join(legacy, "brand-1763200000000-ab12cd.png"), "x");
    expect(attachmentPath(priv, legacy, "brand-1763200000000-ab12cd.png")).toBeNull();
  });

  it("is deleted from both places, and a file already gone passes", () => {
    fs.writeFileSync(path.join(priv, NAME), "a");
    fs.writeFileSync(path.join(legacy, NAME), "b");
    removeAttachment(priv, legacy, NAME);
    expect(fs.existsSync(path.join(priv, NAME))).toBe(false);
    expect(fs.existsSync(path.join(legacy, NAME))).toBe(false);
    expect(() => removeAttachment(priv, legacy, NAME)).not.toThrow();
  });

  it("answers a PDF as a download and never lets the browser guess the type", () => {
    const pdf = attachmentHeaders(NAME);
    expect(pdf["Content-Disposition"]).toMatch(/^attachment;/);
    expect(pdf["Content-Type"]).toBe("application/pdf");
    expect(pdf["X-Content-Type-Options"]).toBe("nosniff");
    expect(pdf["Cache-Control"]).toBe("private, no-store");
    expect(pdf["Content-Security-Policy"]).toContain("sandbox");
    const img = attachmentHeaders("proposal-1763200000000-ab12cd.jpg");
    expect(img["Content-Type"]).toBe("image/jpeg");
    expect(img["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("the sweep deletes an upload nobody sent once it is two days old, and keeps a sent or a fresh one", () => {
    const now = Date.now();
    const old = (now - UNSENT_ATTACHMENT_GRACE_MS - 60_000) / 1000;
    const unsent = "proposal-1763200000001-aaaa.jpg";
    const sent = "proposal-1763200000002-bbbb.jpg";
    const fresh = "proposal-1763200000003-cccc.jpg";
    for (const n of [unsent, sent, fresh]) fs.writeFileSync(path.join(priv, n), "x");
    fs.utimesSync(path.join(priv, unsent), old, old);
    fs.utimesSync(path.join(priv, sent), old, old);
    expect(sweepUnsentAttachments(priv, new Set([sent]), now)).toBe(1);
    expect(fs.readdirSync(priv).sort()).toEqual([sent, fresh].sort());
    expect(sweepUnsentAttachments(path.join(root, "missing"), new Set(), now)).toBe(0);
  });
});
