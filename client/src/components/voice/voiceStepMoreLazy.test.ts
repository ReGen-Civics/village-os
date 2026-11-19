// @vitest-environment jsdom
/**
 * The hotfix of 19 Nov 2026 (voiceStepMoreLazy.ts): the voice step's second
 * half is imported from ONE place, and its switch lives outside that chunk.
 */
import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { autoWriteDown, forgetTranscriptionOn } from "./voiceWriteDownStore";

const dir = path.dirname(new URL(import.meta.url).pathname);
const read = (f: string) => fs.readFileSync(path.join(dir, f), "utf8");

describe("the voice step's second half is loaded once", () => {
  it("no file but voiceStepMoreLazy.ts imports VoiceStepMore dynamically", () => {
    const callers = fs
      .readdirSync(path.join(dir, "..", ".."), { recursive: true })
      .map(String)
      .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f))
      .filter((f) => /import\(\s*["'][^"']*VoiceStepMore["']\s*\)/.test(fs.readFileSync(path.join(dir, "..", "..", f), "utf8")));
    expect(callers.map((f) => path.basename(f))).toEqual(["voiceStepMoreLazy.ts"]);
  });

  it("VoiceStepMore keeps no module-level let, so nothing in it can be read before it exists", () => {
    expect(read("VoiceStepMore.tsx")).not.toMatch(/^let /m);
  });

  it("the switch's snapshot never throws, even when storage refuses", () => {
    forgetTranscriptionOn();
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(autoWriteDown()).toBe(true);
    spy.mockRestore();
    forgetTranscriptionOn();
  });
});
