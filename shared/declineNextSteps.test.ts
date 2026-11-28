import { describe, expect, it } from "vitest";
import { DECLINE_STEPS_DEFAULTS, DECLINE_STEPS_KEYS, declineNextStepsLines } from "./declineNextSteps";
import { OTHER_WAYS_DEFAULTS } from "./otherWays";
import { VARIABLES_BY_KEY } from "./gameVariables";

const none = () => "";
const SITE = "https://village.example";

describe("a kind no's next steps", () => {
  it("registers each setting with the same default the letter uses", () => {
    expect(VARIABLES_BY_KEY[DECLINE_STEPS_KEYS.on]?.default).toBe("true");
    for (const field of ["intro", "waitlist", "quests"] as const) {
      expect(VARIABLES_BY_KEY[DECLINE_STEPS_KEYS[field]]?.default, field).toBe(DECLINE_STEPS_DEFAULTS[field]);
    }
  });

  it("offers the waitlist, open quests and the seeder path, each as a link built from the village's own site", () => {
    const text = declineNextStepsLines(none, { site: `${SITE}/`, on: true }).join("\n");
    expect(text).toContain(DECLINE_STEPS_DEFAULTS.waitlist);
    expect(text).toContain(`${SITE}/roles`);
    expect(text).toContain(`${SITE}/quests`);
    expect(text).toContain(OTHER_WAYS_DEFAULTS.seederTitle);
    expect(text).toContain(`${SITE}/resident`);
  });

  it("takes the village's own words and its own way to stay close as the seeder link", () => {
    const words: Record<string, string> = {
      [DECLINE_STEPS_KEYS.intro]: "Stay close, friend.",
      [DECLINE_STEPS_KEYS.quests]: "Try a quest:",
      "org.other_ways_seeder_title": "Join the Friends",
      "org.stay_close_link": "/friends",
    };
    const text = declineNextStepsLines((k) => words[k] ?? "", { site: SITE, on: true }).join("\n");
    expect(text).toContain("Stay close, friend.");
    expect(text).toContain("- Try a quest: https://village.example/quests");
    expect(text).toContain("Join the Friends.");
    expect(text).toContain(`${SITE}/friends`);
    expect(text).not.toContain(DECLINE_STEPS_DEFAULTS.quests);
  });

  it("an https address the village typed is kept, and a link that is not safe falls back to the resident page", () => {
    const https = declineNextStepsLines((k) => (k === "org.stay_close_link" ? "https://friends.example/join" : ""), { site: SITE, on: true }).join("\n");
    expect(https).toContain("https://friends.example/join");
    const bad = declineNextStepsLines((k) => (k === "org.stay_close_link" ? "javascript:alert(1)" : ""), { site: SITE, on: true }).join("\n");
    expect(bad).toContain(`${SITE}/resident`);
    expect(bad).not.toContain("javascript");
  });

  it("speaks Spanish for a setting still on its default, and keeps a village's own words as written", () => {
    const es = declineNextStepsLines(none, { site: SITE, on: true, lang: "es" }).join("\n");
    expect(es).toContain("Otros roles se abrirán pronto");
    expect(es).not.toContain(DECLINE_STEPS_DEFAULTS.waitlist);
    const own = declineNextStepsLines((k) => (k === DECLINE_STEPS_KEYS.waitlist ? "Escríbenos aquí:" : ""), { site: SITE, on: true, lang: "es" }).join("\n");
    expect(own).toContain("Escríbenos aquí:");
  });

  it("is empty when the village turned it off (control: on)", () => {
    expect(declineNextStepsLines(none, { site: SITE, on: false })).toEqual([]);
    expect(declineNextStepsLines(none, { site: SITE, on: true }).length).toBeGreaterThan(0);
  });
});
