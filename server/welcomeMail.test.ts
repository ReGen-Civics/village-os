/**
 * The welcome and the reservation letters in the reader's language (shared/welcomeMailWords.ts). Each English line
 * is held to the sentence the letter carried before the table existed (server/routes/visitorProfile.ts,
 * server/routes/housing.ts), so a reader with no language sees no change; Spanish carries every line; and the
 * site's saved language is read from its cookie.
 */
import { describe, expect, it } from "vitest";
import { MAIL_LANGUAGES } from "../shared/mailLanguage";
import { WELCOME_MAIL_WORDS, welcomeMailWords } from "../shared/welcomeMailWords";
import { savedSiteLocale } from "./lib/i18nShell";

describe("the English is exactly what the letters said", () => {
  it("the welcome", () => {
    const W = welcomeMailWords("en").welcome;
    expect(W.subject("Test Village")).toBe("Welcome to Test Village: you are a member now");
    expect(W.hi(W.friend)).toBe("Hi friend,");
    expect(W.hi("Ana")).toBe("Hi Ana,");
    expect(W.member("Test Village")).toBe("You asked for an invitation, and you are now a member of Test Village. Your member account is ready.");
    expect(W.nextHtml(`<a href="s">${W.setWords}</a>`, `<a href="p">${W.profileWords}</a>`)).toBe(
      '<a href="s">Set your password</a>, then go to <a href="p">your profile</a> and fill it out, so the village can get to know you.',
    );
    expect(W.nextText("S", "P")).toBe("Set your password: S\nThen fill out your profile: P");
    expect(W.ranOut).toBe("If the link has run out, ask for a new one on the sign-in page with this address.");
  });

  it("the reservation", () => {
    const R = welcomeMailWords(undefined).reservation;
    expect(R.subject).toBe("We have your reservation request");
    expect(R.heading).toBe("Your reservation request is in");
    expect(R.hi("Ana")).toBe("Hi Ana,");
    expect(R.asked(R.homeType("tiny-home"), "North")).toBe(
      "We have your request for a tiny-home in North. Someone from the founding team will read it and get in touch about the deposit and what happens next.",
    );
    expect(R.asked(R.homeType("villa"), null)).toBe(
      "We have your request for a villa. Someone from the founding team will read it and get in touch about the deposit and what happens next.",
    );
    expect(R.noPayment).toBe("No payment has been taken, and nothing is held against your name yet.");
    expect(R.team).toBe("The team");
  });
});

describe("in Spanish", () => {
  it("says the letters in usted, names the home, and greets someone with no name plainly", () => {
    const es = welcomeMailWords("es");
    expect(es.welcome.hi(es.welcome.friend)).toBe("Hola:");
    expect(es.reservation.asked(es.reservation.homeType("family-home"), null)).toContain("su solicitud de casa familiar");
  });

  it("every line of every table is written, and none is the English left in place", () => {
    const flat = (o: object, prefix = ""): Array<[string, unknown]> =>
      Object.entries(o).flatMap(([k, val]) => (val && typeof val === "object" ? flat(val, `${prefix}${k}.`) : [[`${prefix}${k}`, val] as [string, unknown]]));
    const say = (x: unknown) => (typeof x === "function" ? String((x as (...a: unknown[]) => unknown)("casita", "B")) : x);
    const en = new Map(flat(WELCOME_MAIL_WORDS.en));
    for (const lang of MAIL_LANGUAGES) {
      const mine = new Map(flat(WELCOME_MAIL_WORDS[lang]));
      expect([...mine.keys()].sort(), lang).toEqual([...en.keys()].sort());
      if (lang === "en") continue;
      for (const [k, val] of mine) {
        // A home type the two languages name alike ("casita") is the one line allowed to match.
        if (k !== "reservation.homeType") expect(say(val), `${lang} ${k}`).not.toBe(say(en.get(k)));
        expect(String(say(val)), `${lang} ${k}`).not.toMatch(/[–—]/);
      }
    }
  });
});

describe("the site's saved language", () => {
  it("is read from the vos_locale cookie, and absent without it", () => {
    expect(savedSiteLocale("a=1; vos_locale=es; b=2")).toBe("es");
    expect(savedSiteLocale("a=1")).toBeNull();
    expect(savedSiteLocale(undefined)).toBeNull();
  });
});
