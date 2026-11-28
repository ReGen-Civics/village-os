/**
 * HOW THE GUIDE SPEAKS IN A REPLY SHE WRITES (server/lib/guideSpeaking.ts, shared/guideSpeaking.ts).
 *
 *   - the dial is a closed value of three, and anything else reads as the default
 *   - the voice sheet's rules are all in the lines, whatever the setting
 *   - only `quiet` asks for the brief form; the other two speak warm and plain
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_GUIDE_SPEAKING, GUIDE_SPEAKING, readGuideSpeaking, speaksBriefly } from "../../shared/guideSpeaking";
import { speakingPromptLines, STANCE, STANCE_GUARDS, VOICE_LENGTH, VOICE_RULES } from "./guideSpeaking";

describe("the speaking dial", () => {
  it("has the three settings the founder named, and opens on speaking at decisions", () => {
    expect(GUIDE_SPEAKING).toEqual(["quiet", "decisions", "walk"]);
    expect(DEFAULT_GUIDE_SPEAKING).toBe("decisions");
  });

  it("reads an unknown, missing or malformed setting as the default, never as quiet", () => {
    for (const known of GUIDE_SPEAKING) expect(readGuideSpeaking(known)).toBe(known);
    for (const junk of [undefined, null, "", "QUIET", "Quiet", "loud", "quiet ", 0, 1, true, {}, ["quiet"], { setting: "quiet" }]) {
      expect(readGuideSpeaking(junk), JSON.stringify(junk)).toBe("decisions");
    }
  });

  it("is brief only on quiet", () => {
    expect(GUIDE_SPEAKING.filter(speaksBriefly)).toEqual(["quiet"]);
  });
});

describe("the lines a prompt adds", () => {
  it("carry every rule of the voice sheet, for every setting", () => {
    expect(VOICE_RULES.length).toBeGreaterThanOrEqual(7);
    for (const setting of GUIDE_SPEAKING) {
      const lines = speakingPromptLines(setting);
      for (const rule of VOICE_RULES) expect(lines, `${setting}: ${rule}`).toContain(rule);
    }
  });

  it("say the seven things the sheet asks of her, in plain instruction form", () => {
    const lines = speakingPromptLines("decisions");
    expect(lines).toMatch(/what is true, then what to do/);
    expect(lines).toMatch(/deadline or blocks/);
    expect(lines).toMatch(/Money, pay, votes, deadlines, errors and anything that binds the village are said plainly/);
    expect(lines).toMatch(/Never claim an act a person has to press/);
    expect(lines).toMatch(/one question at most, and put it at the end/);
    expect(lines).toMatch(/Never write an address or a path\. Name the page or the control\./);
    expect(lines).toMatch(/When you could not read something, say so yourself/);
    expect(lines).toMatch(/Write the Game, a Quest, the Fund and Gratitude with a capital/);
  });

  it("carry the stance she holds with a founder or an admin: its five points, and what keeps it honest, for every setting", () => {
    expect(STANCE).toHaveLength(5);
    expect(STANCE[0]).toBe("This is a Game, and the players get to design it.");
    expect(STANCE.join(" ")).toMatch(/Say "we" about the village's shared work/);
    expect(STANCE.join(" ")).toMatch(/meant to be fun/);
    expect(STANCE.join(" ")).toMatch(/Every small act connects to the whole/);
    expect(STANCE.join(" ")).toMatch(/A founder is a Catalyst: they set the initial conditions, then hand the keys to the network/);
    for (const setting of GUIDE_SPEAKING) {
      const lines = speakingPromptLines(setting);
      for (const point of STANCE) expect(lines, `${setting}: ${point}`).toContain(point);
      for (const guard of STANCE_GUARDS) expect(lines, `${setting}: ${guard}`).toContain(guard);
    }
    const guards = STANCE_GUARDS.join(" ");
    // The stance never loosens a fact: the binding fact is stated exactly, flavour invents nothing, and the welcome is for a first meeting.
    expect(guards).toMatch(/still states the binding fact exactly/);
    expect(guards).toMatch(/never invents one/);
    expect(guards).toMatch(/big warm welcome is for a first meeting and for launch day/);
    expect(guards).toMatch(/No jokes about money, votes or people/);
  });

  it("ask for the fewest words, with no greeting and no preamble, only on quiet", () => {
    const quiet = speakingPromptLines("quiet");
    expect(quiet).toContain(VOICE_LENGTH.quiet);
    expect(quiet).toMatch(/fewest words that keep every fact/);
    expect(quiet).toMatch(/No greeting, no reasons, no warm words and no sentences about yourself/);
    // Brief keeps what a person must not miss.
    expect(quiet).toMatch(/Keep deadlines, what follows from a choice, and what you left for the person/);
    expect(quiet).not.toContain(VOICE_LENGTH.plain);
    // Brief never loosens what binds: money, pay and votes stay exact.
    expect(quiet).toMatch(/Money, pay, votes and anything that binds stay exact/);
    for (const setting of ["decisions", "walk"] as const) {
      const lines = speakingPromptLines(setting);
      expect(lines).toContain(VOICE_LENGTH.plain);
      expect(lines).not.toContain(VOICE_LENGTH.quiet);
    }
    // Nothing behaves differently for `walk` yet, so it says exactly what the default says.
    expect(speakingPromptLines("walk")).toBe(speakingPromptLines("decisions"));
  });

  it("say they decide where an earlier line differs, and read as rules of the prompt they join", () => {
    const lines = speakingPromptLines("quiet").split("\n");
    expect(lines[0]).toBe("- HOW YOU SPEAK. Where a line above differs, these decide:");
    expect(lines.slice(1).every((l) => l.startsWith("  - ") || l.startsWith("    - "))).toBe(true);
  });
});
