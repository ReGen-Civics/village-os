/**
 * The platform's own words said on the server (server/lib/platformSpeech.ts): the id it computes is Lingui's, and a
 * player card payload goes out in the reader's language when they ask for one and the catalog has it, and in English
 * otherwise, never carrying the builder's record of what it was made from.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { compileMessage } from "@lingui/message-utils/compileMessage";
import { generateMessageId } from "@lingui/message-utils/generateMessageId";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildPlayerCard, CARD_WORDS, type PlayerCardInput } from "../shared/playerCard";
import { CARD_MESSAGES } from "../shared/playerCardMessages";
import type { PlayerCardPayload } from "../shared/playerCardPayload";
import { cardForReader, forgetSpeakers, messageId } from "./lib/platformSpeech";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "platform-speech-"));
// Every message is its English with "ES " in front, compiled as scripts/build-i18n-catalogs.mjs compiles it.
const messages = Object.fromEntries(Object.values(CARD_MESSAGES).map((d) => [messageId(d.message, d.context), compileMessage(`ES ${d.message}`)]));
fs.writeFileSync(path.join(dir, "es.json"), JSON.stringify({ locale: "es", version: "test", messages, unreviewed: [] }));
const empty = fs.mkdtempSync(path.join(os.tmpdir(), "platform-speech-none-"));

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(empty, { recursive: true, force: true });
});
beforeEach(() => forgetSpeakers());

const input: PlayerCardInput = {
  now: new Date("2026-10-22T18:00:00Z"),
  timeZone: "America/Costa_Rica",
  owner: { userId: "u-owner", displayName: "Lena Ortiz", avatar: null },
  viewerUserId: "u-owner",
  villageName: "Riverbend",
  season: { id: "s2", name: "Season of Foundations", startsOn: "2026-10-01", endsOn: "2026-12-31" },
  nextSeasonId: "s3",
  archetypeNames: {},
  roles: [],
  plan: { aim: "Every bed planted.", goals: [] },
  seasonalGoals: null,
  tasks: [],
  signRows: {},
  howIHold: null,
  applications: [],
  roleNames: {},
  bonusTokenName: null,
  loadRead: 3,
};

const payload = (): PlayerCardPayload => ({
  card: buildPlayerCard(input),
  viewer: { level: "self", isSelf: true },
  timeZone: "America/Costa_Rica",
  sheets: {},
  links: { apply: "/apply", plan: "/plan" },
});

const reader = (locale?: string) => ({ get: (h: string) => (h.toLowerCase() === "x-village-locale" ? locale : undefined), headers: {} });
const response = () => {
  const set: Record<string, string> = {};
  return { set: (k: string, v: string) => (set[k] = v), headers: set };
};

describe("messageId", () => {
  it("is the id Lingui gives a message, with and without a context", () => {
    for (const d of Object.values(CARD_MESSAGES)) expect(messageId(d.message, d.context)).toBe(generateMessageId(d.message, d.context));
    expect(messageId("Hello")).toBe(generateMessageId("Hello"));
  });
});

describe("cardForReader", () => {
  it("an English reader gets the card as built, with no record and no words", () => {
    const res = response();
    const out = cardForReader(reader(), res, payload(), [dir]);
    expect(out.card.header.rolesLine).toBe(CARD_WORDS.holdsNoRoles);
    expect(out.card.said).toBeUndefined();
    expect(out.card.words).toBeUndefined();
    expect(res.headers["Cache-Control"]).toBeUndefined();
  });

  it("a Spanish reader gets the card said from the catalog, the components' lines, and no shared cache", () => {
    const res = response();
    const out = cardForReader(reader("es"), res, payload(), [dir]);
    expect(out.card.header.rolesLine).toBe(`ES ${CARD_WORDS.holdsNoRoles}`);
    expect(out.card.header.name).toBe("Lena Ortiz");
    expect(out.card.said).toBeUndefined();
    expect(out.card.words?.purpose).toBe(`ES ${CARD_WORDS.purpose}`);
    expect(res.headers["Cache-Control"]).toBe("no-store");
    expect(res.headers.Vary).toBe("X-Village-Locale");
  });

  it("a language with no catalog reads the English", () => {
    const out = cardForReader(reader("es"), response(), payload(), [empty]);
    expect(out.card.header.rolesLine).toBe(CARD_WORDS.holdsNoRoles);
    expect(out.card.said).toBeUndefined();
    expect(out.card.words).toBeUndefined();
  });

  it("a language the village does not offer reads the English", () => {
    const out = cardForReader(reader("xx"), response(), payload(), [dir]);
    expect(out.card.header.rolesLine).toBe(CARD_WORDS.holdsNoRoles);
  });
});
