/**
 * The constitution in the reader's language (gameMechanicsConstitutionWords.ts). Every law comes from
 * shared/constitution.ts, so a law added there, or a sentence changed there, fails here until the client has it.
 */
import path from "node:path";
import { setupI18n, type MessageDescriptor } from "@lingui/core";
import { formatter } from "@lingui/format-po";
import { describe, expect, it } from "vitest";
import { CONSTITUTION, servedConstitution } from "@shared/constitution";
// @ts-expect-error - scripts/ is untyped JavaScript, deliberately outside tsconfig
import { mergedPoText } from "../../../scripts/lib/poFragments.mjs";
import { CONSTITUTION_WORDS, LAW_OFF_STARTS, localizeConstitution } from "./gameMechanicsConstitutionWords";

// The build precompiles each message (precompileEnglish.ts), so the English is read the way a page reads it.
const EN = setupI18n({ locale: "en", messages: { en: {} } });

function pairs(): { where: string; d: MessageDescriptor | undefined; server: string }[] {
  return CONSTITUTION.flatMap((law) => {
    const w = CONSTITUTION_WORDS[law.title];
    return [
      { where: `${law.title}: title`, d: w?.title, server: law.title },
      { where: `${law.title}: plain`, d: w?.plain, server: law.plain },
      { where: `${law.title}: enforcedBy`, d: w?.enforcedBy, server: law.enforcedBy },
      ...(law.whenModuleOff ? [{ where: `${law.title}: whenModuleOff`, d: w?.whenModuleOff, server: law.whenModuleOff.plain }] : []),
    ];
  });
}

describe("every law the server sends has the client's words for it", () => {
  it("each law and sentence in shared/constitution.ts is here, with the server's English word for word", () => {
    const wrong = pairs()
      .filter((p) => !p.d || EN._(p.d) !== p.server)
      .map((p) => `${p.where}: ${p.d ? "English differs from shared/" : "missing"}`);
    expect(wrong, "correct client/src/pages/gameMechanicsConstitutionWords.ts from shared/constitution.ts").toEqual([]);
    const titles = new Set(CONSTITUTION.map((l) => l.title));
    expect(Object.keys(CONSTITUTION_WORDS).filter((t) => !titles.has(t)), "a law shared/ no longer has").toEqual([]);
  });

  it("tells a law's two served sentences apart by how the off sentence starts", () => {
    for (const law of CONSTITUTION.filter((l) => l.whenModuleOff)) {
      const start = LAW_OFF_STARTS[law.title];
      expect(start, law.title).toBeTruthy();
      expect(law.whenModuleOff!.plain.startsWith(start), law.title).toBe(true);
      expect(law.plain.startsWith(start), law.title).toBe(false);
    }
    expect(Object.keys(LAW_OFF_STARTS).sort()).toEqual(CONSTITUTION.filter((l) => l.whenModuleOff).map((l) => l.title).sort());
  });

  it("Spanish carries every one of them", async () => {
    const dir = path.resolve(__dirname, "../locales");
    const es = await formatter({ lineNumbers: false }).parse(mergedPoText(dir, "es"), { locale: "es", sourceLocale: "en", filename: path.join(dir, "es.po") });
    expect(pairs().filter((p) => !es[p.d!.id]?.translation).map((p) => p.where), "add them to a fragment in client/src/locales/es.d/").toEqual([]);
  });
});

describe("localizeConstitution", () => {
  const money = CONSTITUTION.find((l) => l.whenModuleOff)!;
  const w = CONSTITUTION_WORDS[money.title];
  const es = setupI18n({
    locale: "es",
    messages: { es: { [w.title.id]: "TITULO", [w.plain.id]: "LLENO", [w.whenModuleOff!.id]: "APAGADO", [w.enforcedBy.id]: "CODIGO" } },
  });

  it("in English reads exactly as the server served it, module on or off", () => {
    for (const on of [true, false]) {
      const served = servedConstitution(() => on);
      expect(localizeConstitution(served, EN)).toEqual(served);
    }
  });

  it("draws the sentence that matches what the village was served", () => {
    const on = localizeConstitution(servedConstitution(() => true), es).find((l) => l.title === "TITULO")!;
    const off = localizeConstitution(servedConstitution(() => false), es).find((l) => l.title === "TITULO")!;
    expect(on.plain).toBe("LLENO");
    expect(off.plain).toBe("APAGADO");
    expect(on.enforcedBy).toBe("CODIGO");
  });

  it("leaves a law it does not know as written", () => {
    const ours = { title: "A law a fork wrote", plain: "Ours.", enforcedBy: "our code" };
    expect(localizeConstitution([ours], es)[0]).toBe(ours);
  });
});
