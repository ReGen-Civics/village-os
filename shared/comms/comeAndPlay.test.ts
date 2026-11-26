import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APPLICANT_LANGUAGES } from "../applicantWords";
import type { ModuleLifecycle } from "../modules";
import { declinedLetter, notInvitedLetter } from "../openProposalDecide";
import { ART_PATH, COME_AND_PLAY_WORDS, DOOR_ART, MAX_PLAY_CARDS, PLAY_DOORS, playCards, renderComeAndPlay, stayCloseFrom, type PlayFacts } from "./comeAndPlay";
import { bodyFromText, letterPalette, NEUTRAL_PALETTE, renderLetterFrame } from "./letterFrame";
import { composeEmail, type EmailVillage } from "./letterHtml";
import { LETTER_SAMPLE_IDS, renderSampleLetters } from "./letterSamples";

const SITE = "https://village.example";
const facts = (over: Partial<PlayFacts> = {}): PlayFacts => ({
  site: SITE,
  audience: "public",
  lifecycleOf: () => "off",
  newsletter: null,
  stayClose: null,
  ...over,
});
const VILLAGE: EmailVillage = { name: "Test Village", url: SITE, logoUrl: null, seed: null, character: null, postalAddress: "" };

describe("the come-and-play cards", () => {
  it("offer only what opens: with every module off, the roles, quests and gratitude pages", () => {
    expect(playCards(facts()).map((c) => c.door)).toEqual(["roles", "quests", "gratitude"]);
  });

  it("show a module's card to somebody with no account only when the module is public, and to a member when it is members too", () => {
    const life = (l: ModuleLifecycle) => (id: string) => (id === "events" ? l : "off");
    expect(playCards(facts({ lifecycleOf: life("members") })).some((c) => c.door === "events")).toBe(false);
    expect(playCards(facts({ lifecycleOf: life("members"), audience: "members" })).some((c) => c.door === "events")).toBe(true);
    expect(playCards(facts({ lifecycleOf: life("preview"), audience: "members" })).some((c) => c.door === "events")).toBe(false);
    expect(playCards(facts({ lifecycleOf: life("public") })).find((c) => c.door === "events")?.url).toBe(`${SITE}/events`);
  });

  it("name the newsletter and the way to stay close only when the village set them, and never an address that is not one", () => {
    expect(playCards(facts({ newsletter: "https://letters.example/join" })).find((c) => c.door === "newsletter")?.url).toBe("https://letters.example/join");
    expect(playCards(facts({ newsletter: "javascript:alert(1)" })).some((c) => c.door === "newsletter")).toBe(false);
    expect(stayCloseFrom("Friends", "//elsewhere")).toBeNull();
    expect(stayCloseFrom("", "/resident")).toBeNull();
    const cards = playCards(facts({ stayClose: stayCloseFrom("Friends", "/resident") }));
    expect(cards[0]).toEqual({ door: "stayClose", url: `${SITE}/resident`, name: "Friends" });
  });

  it("stop at six, in order", () => {
    const all = playCards(facts({ lifecycleOf: () => "public", newsletter: "/news", stayClose: { name: "Friends", href: "/resident" } }));
    expect(all).toHaveLength(MAX_PLAY_CARDS);
    expect(all.map((c) => c.door)).toEqual(PLAY_DOORS.slice(0, MAX_PLAY_CARDS));
  });

  it("build nothing without a site to link to", () => {
    expect(renderComeAndPlay({ ...facts(), site: "" })).toEqual({ html: "", text: "" });
  });

  it("paint each card with art the platform ships", () => {
    for (const door of PLAY_DOORS) {
      // ART_PATH is served from server/assets/modules (server/routes/moduleArt.ts).
      expect(ART_PATH).toBe("/images/modules");
      expect(existsSync(join(__dirname, "../../server/assets/modules", `${DOOR_ART[door]}.webp`)), door).toBe(true);
    }
  });
});

describe("the come-and-play block", () => {
  const block = renderComeAndPlay({ ...facts({ lifecycleOf: () => "public" }) });

  it("carries one main button home, every card's link, and the same links in its text", () => {
    expect(block.html).toContain(`href="${SITE}/"`);
    for (const c of playCards(facts({ lifecycleOf: () => "public" }))) {
      expect(block.html).toContain(`href="${c.url}"`);
      expect(block.text).toContain(c.url);
    }
    expect(block.text).toContain(`Come and explore: ${SITE}/`);
  });

  it("gives every painting alt text, and hides the emoji from screen readers", () => {
    for (const m of block.html.matchAll(/<img [^>]*>/g)) expect(m[0]).toMatch(/alt="[^"]+"/);
    expect(block.html).toContain('aria-hidden="true"');
  });

  it("speaks every applicant language, with a line and alt text for every card", () => {
    for (const lang of APPLICANT_LANGUAGES) {
      const w = COME_AND_PLAY_WORDS[lang];
      for (const door of PLAY_DOORS) {
        expect(w.cards[door].line, `${lang} ${door}`).not.toBe("");
        expect(w.cards[door].alt, `${lang} ${door}`).not.toBe("");
        if (door !== "stayClose") expect(w.cards[door].title, `${lang} ${door}`).not.toBe("");
      }
    }
    expect(renderComeAndPlay({ ...facts(), lang: "es" }).text).toContain("¡Venga a jugar!");
  });

  it("keeps the house voice: no dashes, no contrast framing, nothing that names a date or a count", () => {
    for (const lang of APPLICANT_LANGUAGES) {
      const words = JSON.stringify(COME_AND_PLAY_WORDS[lang].cards) + COME_AND_PLAY_WORDS[lang].heading + COME_AND_PLAY_WORDS[lang].intro;
      expect(words).not.toMatch(/[–—]|rather than|\bseat\b|walk the map|\d/i);
    }
  });
});

describe("the letter frame", () => {
  const frame = renderLetterFrame({
    village: VILLAGE,
    subject: "Hello",
    body: bodyFromText(NEUTRAL_PALETTE, "Hi Sam,\n\nTake a look: https://village.example/quests?a=1&b=2", { label: "Go", url: "https://village.example/go" }),
    signature: { signOff: "With love,", team: "The Human Operations team" },
    extra: renderComeAndPlay(facts()),
    why: "Because.",
  });

  it("is a light-and-dark document, with the night's colours derived from the seed", () => {
    expect(frame.html).toContain('<meta name="color-scheme" content="light dark" />');
    expect(frame.html).toContain("@media (prefers-color-scheme: dark)");
    expect(frame.html).toContain("[data-ogsc] .vl-card");
    const seeded = renderLetterFrame({ village: { ...VILLAGE, seed: "#2d6a4f", character: "field" }, subject: "S", body: { html: "", text: "" } });
    expect(seeded.html).toContain(letterPalette("#2d6a4f", "field").night.page);
  });

  it("makes addresses links without letting a value become markup, and signs with a team", () => {
    expect(frame.html).toContain('href="https://village.example/quests?a=1&amp;b=2"');
    expect(frame.html).toContain("The Human Operations team");
    expect(frame.text).toContain("With love,\nThe Human Operations team");
    expect(frame.text).toMatch(/--\nTest Village\nBecause\.\n$/);
    const hostile = renderLetterFrame({ village: { ...VILLAGE, name: "<b>x</b>" }, subject: "S", body: bodyFromText(NEUTRAL_PALETTE, "<script>alert(1)</script>") });
    expect(hostile.html).not.toContain("<script>alert");
    expect(hostile.html).not.toContain("<b>x</b>");
  });

  it("previews past the greeting", () => {
    expect(frame.preheader).toBe("Take a look: https://village.example/quests?a=1&b=2");
  });
});

describe("the letters that carry it", () => {
  it("leave their own ways in out when the block carries them, and keep them otherwise", () => {
    const base = { firstName: "Sam", village: "Test Village", roleNames: ["Gardener"], site: SITE, lang: "en" as const };
    expect(declinedLetter(base).text).toContain(`${SITE}/quests`);
    const inBlock = declinedLetter({ ...base, doorsInBlock: true }).text;
    expect(inBlock).not.toContain(`${SITE}/quests`);
    expect(inBlock).toContain("propose again next season");
    const stay = { program: null, quests: true, events: true };
    expect(notInvitedLetter({ ...base, stayClose: stay }).text).toContain(`${SITE}/quests`);
    expect(notInvitedLetter({ ...base, stayClose: stay, doorsInBlock: true }).text).not.toContain(`${SITE}/quests`);
  });

  it("is an optional footer on a member email, between the words and the footer", () => {
    const compose = (comeAndPlay?: { html: string; text: string }) =>
      composeEmail({ words: { subject: "S", preheader: null, bodyMd: "Hello." }, values: {}, village: VILLAGE, kind: "essential", comeAndPlay });
    const plain = compose();
    const withBlock = compose(renderComeAndPlay({ ...facts(), audience: "members" }));
    expect(plain.html).not.toContain("Come and play!");
    expect(withBlock.html).toContain("Come and play!");
    expect(withBlock.text.indexOf("Come and play!")).toBeLessThan(withBlock.text.indexOf("--\nTest Village"));
  });

  it("renders every sample for the preview", () => {
    const samples = renderSampleLetters();
    expect(samples.map((s) => s.id)).toEqual([...LETTER_SAMPLE_IDS]);
    for (const s of samples) {
      expect(s.html.startsWith("<!DOCTYPE html>"), s.id).toBe(true);
      expect(s.text.length, s.id).toBeGreaterThan(40);
    }
  });
});
