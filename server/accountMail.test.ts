/**
 * The account letters in the reader's language (shared/accountMailWords.ts, shared/mailLanguage.ts). English is
 * held byte for byte to what these letters said before the tables existed, so a reader with no language sees no
 * change at all; Spanish carries every line; and the rule picks the member's language, then the address book's,
 * then the request's, then the village's, then English.
 */
import { describe, expect, it } from "vitest";
import { ACCOUNT_MAIL_WORDS } from "../shared/accountMailWords";
import { MAIL_LANGUAGES, mailLanguage } from "../shared/mailLanguage";
import { LOCALES } from "../shared/i18nLocales";
import { sendPasswordEndedLetter, sendVerifyLetter } from "./lib/emailVerification";
import { sendCodeLetter } from "./lib/entranceCode";
import { languageOfMember } from "./lib/mailLanguage";

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function letters() {
  const sent: Array<{ to: string[]; subject: string; html: string; text?: string; origin?: string }> = [];
  const deps = {
    authSecret: "account-mail-test-secret-0123456789abcdef", // module-review-ok: a throwaway signing key for the link in a test letter, never a real credential
    sendEmail: async (m: (typeof sent)[number]) => {
      sent.push(m);
      return { sent: true };
    },
    escapeHtml,
    origin: () => "https://village.example",
    projectName: () => "Test & Village",
  };
  return { sent, deps };
}

describe("the account letters in English are exactly what they were", () => {
  it("the code", async () => {
    const { sent, deps } = letters();
    await sendCodeLetter(deps, "a@example.org", "123456", true);
    await sendCodeLetter(deps, "a@example.org", "123456", false, "en");
    expect(sent[0].subject).toBe("123 456 is your code for Test & Village");
    expect(sent[0].html).toBe(`<p>Here is your code to sign in to Test &amp; Village.</p>
<p style="font-size:28px;letter-spacing:6px;font-weight:bold">123 456</p>
<p>Type it on the page that asked for it. It works for 15 minutes, once.</p>
<p>If you did not ask for this, you can ignore this message. Nothing happens without the code.</p>`);
    expect(sent[1].text).toBe(
      "Here is your code to keep exploring Test &amp; Village.\n\n123 456\n\nType it on the page that asked for it. It works for 15 minutes, once.\n\nIf you did not ask for this, you can ignore this message. Nothing happens without the code.\n",
    );
  });

  it("the address proof and the Google notice", async () => {
    const { sent, deps } = letters();
    await sendVerifyLetter(deps, { id: "u-1", email: "a@example.org" });
    await sendPasswordEndedLetter(deps, { id: "u-1", email: "a@example.org", prefs: {} });
    const safe = sent[0].html.match(/href="([^"]+)"/)![1];
    expect(sent[0].subject).toBe("Confirm your email address");
    expect(sent[0].html).toBe(`<p>An account on Test &amp; Village was made with this address.</p>
<p>If you made it, <a href="${safe}">confirm this address</a> (the link works for a day). You will be asked to sign in, or for the account's password, so a link opened by somebody else confirms nothing.</p>
<p>If the button does nothing, paste this into your browser:<br>${safe}</p>
<p>If you did not make this account, do not use the link. Nothing has changed, and you can ignore this message.</p>`);
    expect(sent[1].subject).toBe("You signed in with Google");
    expect(sent[1].html).toBe(`<p>You signed in to Test &amp; Village with Google.</p>
<p>This account also had a password, and nobody had ever confirmed this email address for it. So that password has been removed and every other device signed out, because whoever set it might not have been you.</p>
<p>If you set that password yourself, you can choose a new one here: <a href="https://village.example/forgot-password">https://village.example/forgot-password</a></p>`);
  });
});

describe("in Spanish", () => {
  it("a member who chose Spanish gets the letters in Spanish, with the same link and code", async () => {
    const { sent, deps } = letters();
    await sendVerifyLetter(deps, { id: "u-1", email: "a@example.org", prefs: { locale: "es" } });
    await sendPasswordEndedLetter(deps, { id: "u-1", email: "a@example.org", prefs: { locale: "es-CR" } });
    await sendCodeLetter(deps, "a@example.org", "123456", true, "es");
    expect(sent[0].subject).toBe("Confirme su dirección de correo");
    expect(sent[0].html).toContain(">confirme esta dirección</a>");
    expect(sent[0].html).toContain('href="https://village.example/verify-email?token=');
    expect(sent[1].subject).toBe("Usted inició sesión con Google");
    expect(sent[2].subject).toBe("123 456 es su código para Test & Village");
    expect(sent[2].html).toContain("123 456");
    expect(sent[2].html).toContain("iniciar sesión en Test &amp; Village");
  });

  it("every line of every table is written, and none is the English left in place", () => {
    const flat = (o: object, prefix = ""): Array<[string, unknown]> =>
      Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? flat(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v] as [string, unknown]]));
    const en = new Map(flat(ACCOUNT_MAIL_WORDS.en));
    for (const lang of MAIL_LANGUAGES) {
      const mine = new Map(flat(ACCOUNT_MAIL_WORDS[lang]));
      expect([...mine.keys()].sort(), lang).toEqual([...en.keys()].sort());
      if (lang === "en") continue;
      for (const [k, v] of mine) {
        const say = (x: unknown) => (typeof x === "function" ? (x as (...a: string[]) => string)("A", "B") : x);
        expect(say(v), `${lang} ${k}`).not.toBe(say(en.get(k)));
        expect(String(say(v)), `${lang} ${k}`).not.toMatch(/[–—]/);
      }
    }
  });

  it("every mail language is one the site offers", () => {
    const offered = LOCALES.map((l) => l.tag);
    for (const lang of MAIL_LANGUAGES) expect(offered.some((t) => t === lang || t.startsWith(`${lang}-`)), lang).toBe(true);
  });
});

describe("which language", () => {
  it("the member's, the address book's, the request's, the village's, then English", () => {
    expect(mailLanguage({ member: "es", contact: "en", request: "en" })).toEqual({ language: "es", source: "member" });
    expect(mailLanguage({ contact: "es-CR", request: "en" })).toEqual({ language: "es", source: "contact" });
    expect(mailLanguage({ request: "es" })).toEqual({ language: "es", source: "request" });
    expect(mailLanguage({ villageDefault: "es" })).toEqual({ language: "es", source: "village_default" });
    expect(mailLanguage({})).toEqual({ language: "en", source: "english" });
  });

  it("a language with no words is skipped, and the next source read", () => {
    expect(mailLanguage({ member: "fr", contact: "es" })).toEqual({ language: "es", source: "contact" });
    expect(mailLanguage({ member: "fr" })).toEqual({ language: "en", source: "english" });
  });

  it("a member with no language set gets English", () => {
    expect(languageOfMember({ prefs: {} })).toBe("en");
    expect(languageOfMember(null)).toBe("en");
    expect(languageOfMember({ prefs: { locale: "es" } })).toBe("es");
  });
});
