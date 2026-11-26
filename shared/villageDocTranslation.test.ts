import { describe, expect, it } from "vitest";
import { translationTarget } from "./contentTranslation";
import { overlayVillageDoc, villageDocEnglishAt, villageDocFieldOk, villageDocFields } from "./villageDocTranslation";

const BRAND = { project: { name: "Village", heroHeadline: "Living together", heroBody: "A sentence.", footerBlurb: "", tagline: "  " } };
const VISIT = {
  hero_subtitle: "Come and see",
  logistics: { getting_there: "Fly to the coast.", what_to_bring: "Rain gear." },
  visit_types: [
    { id: "community-call", title: "Community Call", cost: "Free", cta_url: "https://example.org", order: 1 },
    { id: "land-tour", title: "Land Tour", description: "Walk the land." },
  ],
};

describe("the village's words outside its pages take a translation", () => {
  it("names only the words a reader reads", () => {
    expect(villageDocFieldOk("brand", "project.heroHeadline")).toBe(true);
    expect(villageDocFieldOk("brand", "project.name")).toBe(false);
    expect(villageDocFieldOk("visit-config", "visit_types.land-tour.description")).toBe(true);
    expect(villageDocFieldOk("visit-config", "visit_types.land-tour.cta_url")).toBe(false);
    expect(villageDocFieldOk("visit-config", "visit_types.land-tour.order")).toBe(false);
    expect(villageDocFieldOk("other", "hero_subtitle")).toBe(false);
  });

  it("reads the English a reader sees, and nothing for a blank field", () => {
    expect(villageDocEnglishAt("brand", BRAND, "project.heroHeadline")).toBe("Living together");
    expect(villageDocEnglishAt("brand", BRAND, "project.footerBlurb")).toBeNull();
    expect(villageDocEnglishAt("visit-config", VISIT, "visit_types.community-call.cost")).toBe("Free");
    expect(villageDocFields("brand", BRAND).map((f) => f.field)).toEqual(["project.heroHeadline", "project.heroBody"]);
    expect(villageDocFields("visit-config", VISIT).map((f) => f.field)).toEqual([
      "hero_subtitle",
      "logistics.getting_there",
      "logistics.what_to_bring",
      "visit_types.community-call.title",
      "visit_types.community-call.cost",
      "visit_types.land-tour.title",
      "visit_types.land-tour.description",
    ]);
  });

  it("lays a translation over the document and leaves every other word", () => {
    const out = overlayVillageDoc("visit-config", VISIT, { "visit_types.land-tour.title": "Visita a la tierra", hero_subtitle: "Venga a ver", "visit_types.land-tour.cta_url": "x" });
    expect(out.hero_subtitle).toBe("Venga a ver");
    expect(out.visit_types[1].title).toBe("Visita a la tierra");
    expect(out.visit_types[0]).toEqual(VISIT.visit_types[0]);
    expect((out.visit_types[1] as Record<string, unknown>).cta_url).toBeUndefined();
    expect(VISIT.hero_subtitle).toBe("Come and see");
    expect(overlayVillageDoc("brand", BRAND, {})).toBe(BRAND);
  });

  it("is a content kind the translation table accepts, a link never", () => {
    expect(translationTarget("village_doc", "brand", "project.heroBody").ok).toBe(true);
    expect(translationTarget("village_doc", "visit-config", "visit_types.land-tour.cta_url").ok).toBe(false);
    expect(translationTarget("village_doc", "page-home", "hero.title").ok).toBe(false);
  });
});

describe("the village's path names take a translation (the lead's Spanish audit, 26 Nov 2026)", () => {
  const doc = { paths: [{ id: "investor", label: "Guardian", role: "Hold the land", description: "Fund it.", route: "/investor" }] };
  it("addresses a path's name, second line and sentence, and nothing else", () => {
    expect(villageDocFieldOk("paths", "investor.label")).toBe(true);
    expect(villageDocFieldOk("paths", "investor.role")).toBe(true);
    expect(villageDocFieldOk("paths", "investor.description")).toBe(true);
    expect(villageDocFieldOk("paths", "investor.route")).toBe(false);
    expect(villageDocFieldOk("paths", "investor")).toBe(false);
  });
  it("reads the English the village wrote, and lists every path's words", () => {
    expect(villageDocEnglishAt("paths", doc, "investor.role")).toBe("Hold the land");
    expect(villageDocFields("paths", doc).map((f) => f.field)).toEqual(["investor.label", "investor.role", "investor.description"]);
    expect(overlayVillageDoc("paths", doc, { "investor.label": "Guardiana" }).paths[0].label).toBe("Guardiana");
  });
});

describe("the season calendar and the five classes take a translation (the lead's Spanish audit, 26 Nov 2026)", () => {
  const SEASON = {
    seasons: [{ id: "founding", name: "Founding Season", theme: "Roots", focus: "Land and water", goals: [{ text: "Plant the food forest", done: false }, { text: "", done: false }] }],
  };
  const SERVED = { current: SEASON.seasons[0], upcoming: null, seasons: SEASON.seasons };
  const CLASSES = { archetypes: [{ key: "the-builder", name: "The Builder", subtitle: "Building & Developing", blurb: "Makes things.", examples: ["Raise a roof"] }] };

  it("addresses a season's words and its goals by place, and nothing else", () => {
    expect(villageDocFieldOk("season", "founding.name")).toBe(true);
    expect(villageDocFieldOk("season", "founding.goals.0")).toBe(true);
    expect(villageDocFieldOk("season", "founding.startsOn")).toBe(false);
    expect(villageDocFieldOk("season", "founding.goals.x")).toBe(false);
    expect(villageDocFields("season", SEASON).map((f) => f.field)).toEqual(["founding.name", "founding.theme", "founding.focus", "founding.goals.0"]);
    expect(villageDocEnglishAt("season", SEASON, "founding.goals.0")).toBe("Plant the food forest");
  });

  it("lays a season's translation over the calendar and over the current season /api/season serves", () => {
    const out = overlayVillageDoc("season", SERVED, { "founding.name": "Temporada fundadora", "founding.goals.0": "Sembrar el bosque comestible" });
    expect(out.current.name).toBe("Temporada fundadora");
    expect(out.current.goals[0]).toEqual({ text: "Sembrar el bosque comestible", done: false });
    expect(out.seasons[0].name).toBe("Temporada fundadora");
    expect(out.upcoming).toBeNull();
    expect(SERVED.current.name).toBe("Founding Season");
  });

  it("addresses a class by its key, with its examples by place", () => {
    expect(villageDocFields("archetypes", CLASSES).map((f) => f.field)).toEqual(["the-builder.name", "the-builder.subtitle", "the-builder.blurb", "the-builder.examples.0"]);
    expect(villageDocFieldOk("archetypes", "the-builder.sigil")).toBe(false);
    const out = overlayVillageDoc("archetypes", CLASSES, { "the-builder.name": "La Constructora", "the-builder.examples.0": "Levantar un techo" });
    expect(out.archetypes[0]).toMatchObject({ key: "the-builder", name: "La Constructora", examples: ["Levantar un techo"], blurb: "Makes things." });
  });
});
