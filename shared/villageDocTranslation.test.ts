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
