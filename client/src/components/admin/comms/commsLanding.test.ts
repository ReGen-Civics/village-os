import { describe, expect, it } from "vitest";
import { SETUP_KEYS } from "@shared/comms/settings";
import { commsLanding, PAUSE_ALL_BUTTON_ID, TEST_EMAIL_BUTTON_ID, setupPanelId } from "./commsLanding";

describe("commsLanding", () => {
  it("lands the test email on its button at the top, with no row opened", () => {
    expect(commsLanding("comms.test-email")).toEqual({ open: null, focus: TEST_EMAIL_BUTTON_ID });
  });

  it("lands Pause all on its button, with nothing opened", () => {
    expect(commsLanding("comms.pause-all")).toEqual({ open: null, focus: PAUSE_ALL_BUTTON_ID });
  });

  it("opens every other checklist item on its own panel", () => {
    for (const key of SETUP_KEYS.filter((k) => k !== "test-email")) {
      expect(commsLanding(`comms.${key}`)).toEqual({ open: key, focus: setupPanelId(key) });
    }
  });

  it("ignores anything that is not one of this page's controls", () => {
    for (const s of [null, "", "season.timezone", "comms.", "comms.nothing", "comms.test-email-x"]) expect(commsLanding(s)).toBeNull();
  });
});
