import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NATURE_ART_FILES } from "./natureArtFiles";
import { NATURE_ART, assignNatureArt, companionArt, isNatureSlug, natureArtUrl, readChosenArt, shownRoleIds } from "./natureArt";
import { parseLook } from "./companionItems";

const DIR = path.join(__dirname, "..", "server", "assets", "nature");

describe("the nature art library", () => {
  it("holds 83 paintings, each with a file, and every file is in the library", () => {
    expect(NATURE_ART).toHaveLength(83);
    expect(new Set(NATURE_ART.map((a) => a.slug)).size).toBe(NATURE_ART.length);
    const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".webp")).map((f) => f.replace(/\.webp$/, "")).sort();
    expect(files).toEqual(NATURE_ART.map((a) => a.slug).sort());
  });

  it("keeps each painting light enough to ship in the image", () => {
    for (const a of NATURE_ART) expect(fs.statSync(path.join(DIR, `${a.slug}.webp`)).size).toBeLessThan(120 * 1024);
  });

  it("names its URL under /images/nature, with the file's fingerprint so a repaint gets a new address", () => {
    expect(natureArtUrl("jaguar")).toBe(`/images/nature/jaguar.webp?v=${NATURE_ART_FILES.jaguar!.full}`);
    expect(natureArtUrl("jaguar", "sm")).toBe(`/images/nature/sm/jaguar.webp?v=${NATURE_ART_FILES.jaguar!.sm}`);
    expect(natureArtUrl("not-a-painting")).toBe("/images/nature/not-a-painting.webp");
  });
});

describe("assignNatureArt", () => {
  const ids = Array.from({ length: 20 }, (_, i) => `role-${i}`);

  it("gives every role a painting and no two roles the same one", () => {
    const out = assignNatureArt(ids, {});
    expect(Object.keys(out).sort()).toEqual([...ids].sort());
    expect(new Set(Object.values(out)).size).toBe(ids.length);
  });

  it("is the same answer whatever order the roles come in", () => {
    expect(assignNatureArt([...ids].reverse(), {})).toEqual(assignNatureArt(ids, {}));
  });

  it("keeps an admin's choice and steps the others past it", () => {
    const auto = assignNatureArt(ids, {});
    const victim = ids.find((id) => id !== "role-3" && auto[id] === auto["role-3"]) ?? ids[0]!;
    const taken = auto[victim]!;
    const out = assignNatureArt(ids, { "role-3": taken });
    expect(out["role-3"]).toBe(taken);
    expect(Object.values(out).filter((s) => s === taken)).toHaveLength(1);
  });

  it("gives the shown roles distinct paintings first when there are more roles than paintings", () => {
    // More roles than paintings, whatever size the library grows to.
    const many = Array.from({ length: NATURE_ART.length + 31 }, (_, i) => `role-${String(i).padStart(3, "0")}`);
    // The shown roles sit among hidden ones in the id order, the way listed roles do in a real village.
    const shown = many.filter((_, i) => i % 3 === 0);
    const out = assignNatureArt(many, {}, shown);
    expect(new Set(shown.map((id) => out[id])).size).toBe(shown.length);
    // Without the shown set the same roles collide: the control for the case above.
    const plain = assignNatureArt(many, {});
    expect(new Set(shown.map((id) => plain[id])).size).toBeLessThan(shown.length);
    expect(assignNatureArt([...many].reverse(), {}, [...shown].reverse())).toEqual(out);
  });

  it("keeps an admin's choice for a hidden role, and the 47 shown roles share none", () => {
    const many = Array.from({ length: 79 }, (_, i) => `r${i}`);
    const shown = many.slice(10, 57);
    const out = assignNatureArt(many, { r70: "jaguar" }, shown);
    expect(out.r70).toBe("jaguar");
    expect(new Set(shown.map((id) => out[id])).size).toBe(47);
    expect(shown.some((id) => out[id] === "jaguar")).toBe(false);
  });

  it("counts an unlisted coming-soon role and an unlisted venture as shown, and leaves out hidden and rested roles", () => {
    const roles = [
      { id: "open", active: true, listed: null },
      { id: "soon", active: true, listed: false, comingSoon: true },
      { id: "venture", active: true, listed: false, futureVenture: true },
      { id: "hidden", active: true, listed: false },
      { id: "rested", active: false, listed: true },
    ];
    expect(shownRoleIds(roles)).toEqual(["open", "soon", "venture"]);
  });

  it("ignores a choice that is not a painting", () => {
    expect(isNatureSlug(assignNatureArt(["a"], { a: "unicorn" }).a)).toBe(true);
  });
});

describe("companionArt", () => {
  it("gives every companion word to one painting only", () => {
    const owner = new Map<string, string>();
    for (const art of NATURE_ART) for (const w of art.words) {
      expect(owner.get(w), `"${w}" is on ${owner.get(w)} and ${art.slug}`).toBeUndefined();
      owner.set(w, art.slug);
    }
  });

  it("finds the painting a companion's name points at, longest name first", () => {
    expect(companionArt("Sloth")?.slug).toBe("three-toed-sloth");
    expect(companionArt("a quiet hummingbird")?.slug).toBe("violet-sabrewing");
    expect(companionArt("Great green macaw")?.slug).toBe("great-green-macaw");
    expect(companionArt("Macaw")?.slug).toBe("scarlet-macaw");
    expect(companionArt("Tucán")?.slug).toBe("keel-billed-toucan");
    expect(companionArt("Owls")?.slug).toBe("spectacled-owl");
    expect(companionArt("Green sea turtle")?.slug).toBe("green-sea-turtle");
    expect(companionArt("Sea turtle")?.slug).toBe("leatherback-turtle");
    expect(companionArt("Heron")?.slug).toBe("boat-billed-heron");
    expect(companionArt("Caiman")?.slug).toBe("spectacled-caiman");
    expect(companionArt("Sea snake")?.slug).toBe("yellow-bellied-sea-snake");
    expect(companionArt("Spotted dolphin")?.slug).toBe("spotted-dolphin");
    expect(companionArt("Unicorns")).toBeNull();
    expect(companionArt("")).toBeNull();
  });
});

describe("readChosenArt", () => {
  it("drops anything that is not a role id to a painting", () => {
    expect(readChosenArt({ a: "jaguar", b: "dragon", c: 4 })).toEqual({ a: "jaguar" });
    expect(readChosenArt(null)).toEqual({});
    expect(readChosenArt(["jaguar"])).toEqual({});
  });
});

describe("a companion's painted look", () => {
  it("reads a painting by its slug and refuses one that is not in the library", () => {
    expect(parseLook({ source: "nature", art: "kinkajou" })).toEqual({ source: "nature", art: "kinkajou" });
    expect(parseLook({ source: "nature", art: "griffin" })).toBeNull();
    expect(parseLook({ source: "nature" })).toBeNull();
  });
});
