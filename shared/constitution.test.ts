import { describe, expect, it } from "vitest";
import { CONSTITUTION, servedConstitution } from "./constitution";

const MONEY = "Money flows in, never out";

describe("servedConstitution", () => {
  it("tells a village without the exchange nothing about buying tokens", () => {
    const law = servedConstitution(() => false).find((l) => l.title === MONEY);
    expect(law?.plain).toBe(
      "No token can ever be sold back for money. There is no cash-out path, and adding one is not a setting.",
    );
    expect(law?.plain).not.toMatch(/\bbuy\b/i);
  });

  it("keeps the full words where the exchange runs", () => {
    const law = servedConstitution((id) => id === "exchange").find((l) => l.title === MONEY);
    expect(law?.plain).toMatch(/^Real money can buy the village's credit tokens/);
  });

  it("names a real module for every override, and never serves the override field", () => {
    const served = servedConstitution(() => false);
    expect(served).toHaveLength(CONSTITUTION.length);
    for (const law of served) expect(law).not.toHaveProperty("whenModuleOff");
    for (const law of CONSTITUTION) if (law.whenModuleOff) expect(law.whenModuleOff.module).toBe("exchange");
  });

  it("changes no title and no enforcement, only the sentence", () => {
    const off = servedConstitution(() => false);
    expect(off.map((l) => [l.title, l.enforcedBy])).toEqual(CONSTITUTION.map((l) => [l.title, l.enforcedBy]));
  });
});
