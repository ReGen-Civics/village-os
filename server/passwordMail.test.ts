/**
 * The password letters and the address code in the reader's language (shared/passwordMailWords.ts). One builder
 * makes every set-password letter (`passwordLetter`, server/routes/authRecovery.ts). English is held byte for byte
 * to what each letter said before, written out here as it stood in server/index.ts and authRecovery.ts; Spanish
 * carries every line.
 */
import { describe, expect, it } from "vitest";
import { PASSWORD_MAIL_WORDS } from "../shared/passwordMailWords";
import { MAIL_LANGUAGES } from "../shared/mailLanguage";
import { addressCodeLetter } from "./lib/memberEmails";
import { passwordLetter } from "./routes/authRecovery";

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const url = "https://village.example/set-password?token=a&b";
const u = escapeHtml(url);
const village = "Test & Village";
const v = escapeHtml(village);
const at = (kind: Parameters<typeof passwordLetter>[0], lang?: "en" | "es") => passwordLetter(kind, { escapeHtml, village, url, lang });

describe("every set-password letter in English is exactly what it was", () => {
  it("the member's reset and first password", () => {
    expect(at("reset")).toEqual({
      origin: "auth.reset",
      subject: "Set a new password",
      html: `<p>Someone asked to set a new password for your account on ${v}.</p>
<p><a href="${u}">Set a new password</a> (link expires in 60 minutes, and works once).</p>
<p>If the button does nothing, paste this into your browser:<br>${u}</p>
<p>If this wasn't you, nothing has changed. You can ignore this message.</p>`,
    });
    expect(at("first_password", "en")).toEqual({
      origin: "auth.first_password",
      subject: "Set your password",
      html: `<p>Your account on ${v} does not have a password yet, so there is nothing to reset. This link sets your first one.</p>
<p><a href="${u}">Set your password</a> (link expires in 60 minutes, and works once).</p>
<p>If the button does nothing, paste this into your browser:<br>${u}</p>
<p>If this wasn't you, nothing has changed. You can ignore this message.</p>`,
    });
  });

  it("the founder's claim, a new founder account, and an administrator's link", () => {
    expect(at("founder_claim")).toEqual({
      origin: "auth.founder_claim",
      subject: "Set your password",
      html: `<p><a href="${u}">Set your password</a> (link expires in 60 minutes).</p>
<p>If the button does nothing, paste this into your browser:<br>${u}</p>`,
    });
    expect(at("founder_created")).toEqual({
      origin: "auth.founder_claim",
      subject: "You are the founder admin. Set your password",
      html: `<p>Your founder admin account was just created on ${v}.</p>
<p><a href="${u}">Set your password</a> (link expires in 60 minutes).</p>
<p>If the button does nothing, paste this into your browser:<br>${u}</p>`,
    });
    expect(at("admin_link")).toEqual({
      origin: "auth.admin_password_link",
      subject: "Set a new password",
      html: `<p>An administrator of ${v} sent you a link to set a new password.</p>
<p><a href="${u}">Set a new password</a> (link expires in 60 minutes, and works once).</p>
<p>If the button does nothing, paste this into your browser:<br>${u}</p>`,
    });
  });

  it("the address code", () => {
    expect(addressCodeLetter(escapeHtml, village, "123456")).toEqual({
      subject: "Your code to add this address: 123456",
      html: `<p>Somebody signed in to ${v} asked to add this email address to their account.</p>
<p style="font-size:24px;letter-spacing:4px;font-weight:bold">123456</p>
<p>If it was you, enter this code on your profile. It works for 15 minutes.</p>
<p>If it was not you, do nothing. The address is attached only when this code is entered, and nobody else can see it.</p>`,
      text: `Somebody signed in to ${village} asked to add this email address to their account.\n\nYour code: 123456\n\nIf it was you, enter this code on your profile. It works for 15 minutes.\nIf it was not you, do nothing. The address is attached only when this code is entered.`,
    });
  });
});

describe("in Spanish", () => {
  it("every letter keeps its link and origin, in Spanish words", () => {
    for (const kind of ["reset", "first_password", "founder_claim", "founder_created", "admin_link"] as const) {
      const en = at(kind, "en");
      const es = at(kind, "es");
      expect(es.origin, kind).toBe(en.origin);
      expect(es.subject, kind).not.toBe(en.subject);
      expect(es.html, kind).toContain(`<a href="${u}">`);
      expect(es.html, kind).toContain(`<br>${u}</p>`);
    }
    expect(at("reset", "es").html).toContain(">Definir una contraseña nueva</a>");
    const code = addressCodeLetter(escapeHtml, village, "123456", "es");
    expect(code.subject).toBe("Su código para agregar esta dirección: 123456");
    expect(code.text).toContain("Su código: 123456");
  });

  it("every line of every table is written, and none is the English left in place", () => {
    const flat = (o: object, prefix = ""): Array<[string, unknown]> =>
      Object.entries(o).flatMap(([k, val]) => (val && typeof val === "object" ? flat(val, `${prefix}${k}.`) : [[`${prefix}${k}`, val] as [string, unknown]]));
    const say = (x: unknown) => (typeof x === "function" ? String((x as (...a: unknown[]) => unknown)("A", "B")) : x);
    const en = new Map(flat(PASSWORD_MAIL_WORDS.en));
    for (const lang of MAIL_LANGUAGES) {
      const mine = new Map(flat(PASSWORD_MAIL_WORDS[lang]));
      expect([...mine.keys()].sort(), lang).toEqual([...en.keys()].sort());
      if (lang === "en") continue;
      for (const [k, val] of mine) {
        expect(say(val), `${lang} ${k}`).not.toBe(say(en.get(k)));
        expect(String(say(val)), `${lang} ${k}`).not.toMatch(/[–—]/);
      }
    }
  });
});
