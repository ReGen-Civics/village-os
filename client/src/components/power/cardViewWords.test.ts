import { setupI18n } from "@lingui/core";
import { describe, expect, it } from "vitest";
import { CARD_VIEW_WORDS, roleCardView } from "@shared/roleCardView";
import { expectMirrorMatches } from "@/i18n/wordTableTesting";
import { CARD_VIEW_MIRROR, cardViewWords } from "./cardViewWords";

describe("a role card's parameter rows in the reader's language (lane ES-A)", () => {
  it("draws exactly the shared English, and every entry goes through the catalog", () => {
    expectMirrorMatches(CARD_VIEW_WORDS, CARD_VIEW_MIRROR, {
      commitmentPct: [[50]],
      firstReviewOn: [["after the first moon"]],
      firstReviewAfter: [[1], [30]],
      firstConversation: [["a walk on the land"]],
      consentedBy: [["the Land circle"]],
      conversationsInAll: [["2 hours"]],
    });
  });

  it("the view model takes the translated rows, and with none reads the shared English", () => {
    const seat = { card: { commitmentPct: 40, track: "volunteer", whereWorked: "land", reviewAfterDays: 30, heldBy: "person" } };
    const english = roleCardView(seat);
    expect(english.rows.map((r) => r.label)).toEqual(["Who can hold it", "Commitment", "Track", "Where", "Review"]);
    expect(roleCardView(seat, undefined, cardViewWords(setupI18n({ locale: "en", messages: { en: {} } })))).toEqual(english);
    const es = setupI18n({ locale: "es", messages: { es: { [CARD_VIEW_MIRROR.labels.track.id]: "Vía", [CARD_VIEW_MIRROR.track.volunteer.id]: "Voluntariado" } } });
    const row = roleCardView(seat, undefined, cardViewWords(es)).rows.find((r) => r.id === "track");
    expect(row).toMatchObject({ label: "Vía", lines: ["Voluntariado"] });
  });
});
