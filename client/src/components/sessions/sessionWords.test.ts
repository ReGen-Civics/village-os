import { describe, it } from "vitest";
import { SESSION_COPY } from "@shared/sessions";
import { RHYTHM_COPY } from "@shared/sessionRhythm";
import { expectMirrorMatches } from "@/i18n/wordTableTesting";
import { SESSION_COPY_MIRROR } from "./sessionWords";
import { RHYTHM_COPY_MIRROR } from "./rhythmWords";

const CIRCLES = [["Garden"], ["Land circle"], [" Water Circle "]] as const;

describe("the live sessions pages in the reader's language (lane ES-A)", () => {
  it("SESSION_COPY: exactly the shared English, every entry through the catalog", () => {
    expectMirrorMatches(SESSION_COPY, SESSION_COPY_MIRROR);
  });

  it("RHYTHM_COPY: exactly the shared English, every entry through the catalog", () => {
    expectMirrorMatches(RHYTHM_COPY, RHYTHM_COPY_MIRROR, {
      skipRhythm: [["Friday 3 Dec"]],
      roomTitle: CIRCLES.map(([c]) => [c, "Friday 3 Dec"]),
      waiting: [[0], [1], [4]],
      zoneHint: [["America/Costa_Rica"]],
      clearConfirm: CIRCLES,
      saved: CIRCLES,
      skipped: CIRCLES.map(([c]) => [c, "Friday 3 Dec"]),
      skippedLast: CIRCLES,
      stopped: CIRCLES,
    });
  });
});
