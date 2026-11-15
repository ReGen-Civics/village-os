/**
 * The application's fields keep what a reader can see and lose what only hides
 * (hostile-edges QA, 15 Nov 2026). Each case below was sent to a local 1.3.9
 * boot and stored as sent; the parser cases are the same inputs through the
 * form's own parser, which the intake route calls.
 */
import { describe, expect, it } from "vitest";
import { applicantText, looksEmpty } from "./applicantText";
import { OPEN_WORDS, parseOpenProposal } from "./openProposals";

const cp = (...n: number[]) => String.fromCodePoint(...n);
const ZWSP = cp(0x200b);
const ZWJ = cp(0x200d);
const ZWNJ = cp(0x200c);
const RLO = cp(0x202e);
const PDF = cp(0x202c);

const ctx = { roleIds: new Set(["r1"]), address: (s: string) => (s.includes("@") ? s.trim() : null) };
const form = (over: Record<string, unknown>) => parseOpenProposal({ name: "Ana", email: "ana@example.test", roles: [{ roleId: "r1", note: "" }], why: "I love gardens", aim: "", ...over }, ctx);

describe("applicantText", () => {
  it("reads a field of only invisible characters as empty", () => {
    expect(applicantText(`${ZWSP}${ZWSP}`, 120)).toBe("");
    expect(applicantText(`${ZWSP}${cp(0x2060)}${ZWJ}`, 120)).toBe("");
    expect(applicantText(`${cp(0x200e)} ${cp(0xfe0f)} ${cp(0xad)}`, 120)).toBe("");
    expect(looksEmpty(`${ZWNJ}\n\t`)).toBe(true);
  });

  it("takes controls, overrides and the byte-order mark out of the letters", () => {
    expect(applicantText(`Ana${cp(0)}${cp(7)}${cp(0x1b)}QA`, 120)).toBe("AnaQA");
    expect(applicantText(`${RLO}gnalc${PDF} Admin`, 120)).toBe("gnalc Admin");
    expect(applicantText(`${cp(0xfeff)}Ana${cp(0x2066)}`, 120)).toBe("Ana");
    expect(applicantText(`Ana${cp(0xe0041)}${cp(0xe0042)}`, 120)).toBe("Ana");
  });

  it("keeps the joiners a word needs, and every script's letters", () => {
    // Persian "mi-khaham" is spelled with a non-joiner; a family emoji is three people and two joiners.
    const persian = `می${ZWNJ}خواهم`;
    const family = `${cp(0x1f468)}${ZWJ}${cp(0x1f469)}${ZWJ}${cp(0x1f467)}`;
    expect(applicantText(persian, 120)).toBe(persian);
    expect(applicantText(family, 120)).toBe(family);
    expect(applicantText("שלום עולם", 120)).toBe("שלום עולם");
    expect(applicantText("🌱🌱🌱", 120)).toBe("🌱🌱🌱");
  });

  it("keeps line breaks in an answer and folds them in a name", () => {
    expect(applicantText("one\r\ntwo\rthree", 200)).toBe("one\ntwo\nthree");
    expect(applicantText("Ana\n\tMaría", 120, true)).toBe("Ana María");
  });

  it("still cuts one past the cap, and leaves markup to the renderer as text", () => {
    expect(applicantText("x".repeat(50), 10)).toHaveLength(11);
    expect(applicantText("<script>alert(1)</script>", 200)).toBe("<script>alert(1)</script>");
    expect(applicantText(42, 10)).toBe("");
  });
});

describe("the public form's parser", () => {
  it("asks for a name when the name is only invisible", () => {
    const r = form({ name: `${ZWSP}${ZWSP}` });
    expect(r.ok).toBe(false);
    if (!r.ok) expect([r.field, r.error]).toEqual(["name", OPEN_WORDS.needName]);
  });

  it("asks why when the answer is only invisible", () => {
    const r = form({ why: `${ZWSP}${cp(0x2060)}${ZWJ}` });
    expect(r.ok).toBe(false);
    if (!r.ok) expect([r.field, r.error]).toEqual(["why", OPEN_WORDS.needWhy]);
  });

  it("keeps a name without its override and controls", () => {
    const r = form({ name: `${RLO}Ana${PDF}${cp(0)}\nQA` });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.name).toBe("Ana QA");
  });
});
