/**
 * The three launch-list fixes from the Admin evolution audit (25 Nov 2026),
 * each held where it lives: the village's name is checked by its value, the
 * sealing key is required and carried by the vote, and the postal address has
 * a launch row read from the mail checklist.
 */
import { describe, expect, it } from "vitest";
import { GAME_CONFIG } from "./gameConfig";
import { LAUNCH_REQUIREMENTS, TEMPLATE_VILLAGE_NAME, villageNameCheck } from "./launchRequirements";

const row = (id: string) => LAUNCH_REQUIREMENTS.find((r) => r.id === id);

describe("villageNameCheck (brand-basics)", () => {
  it("is missing for no name, a blank one, and the template's own name", () => {
    for (const shown of [undefined, null, "", "   ", TEMPLATE_VILLAGE_NAME, ` ${TEMPLATE_VILLAGE_NAME} `]) {
      expect(villageNameCheck(shown).state, String(shown)).toBe("missing");
    }
  });

  it("is ok for a name of the village's own, and says it", () => {
    const r = villageNameCheck("Larksfield");
    expect(r.state).toBe("ok");
    expect(r.detail).toContain("Larksfield");
  });

  it("the template constant is the name upstream's gameConfig ships with", () => {
    // Upstream only: a fork that names itself in gameConfig changes GAME_CONFIG,
    // which is exactly why the check compares against the constant, not it.
    expect(TEMPLATE_VILLAGE_NAME).toBe(GAME_CONFIG.project.name);
  });
});

describe("village-secrets-key", () => {
  it("is required, and the launch vote may carry it, like site-address", () => {
    expect(row("village-secrets-key")).toMatchObject({ severity: "blocking", carriedByVote: true });
    expect(row("site-address")).toMatchObject({ severity: "blocking", carriedByVote: true });
  });
});

describe("email-postal-address", () => {
  it("reads the mail checklist's postal address and lands on it", () => {
    const r = row("email-postal-address")!;
    expect(r).toBeTruthy();
    expect(r.checkKey).toBe("comms:postal-address");
    expect(r.fixAt).toBe("/admin?tab=comms-settings&setting=comms.postal-address");
    expect(r.severity).toBe("recommended");
  });
});
