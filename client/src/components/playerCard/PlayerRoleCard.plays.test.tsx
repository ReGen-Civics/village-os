// @vitest-environment jsdom
/**
 * THE CLASS CHIPS SAY WHAT THEY MEAN (QA round 3, 27 Nov 2026). A chip's tip was only "Plays as". It is now
 * "Plays as The Catalyst: <the village's own blurb>", on the chip's word. A chip whose archetype has no blurb gets no
 * tip, and then "Plays as" is printed before the chips, so no chip is left unexplained.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { PlayerRoleCardView } from "./PlayerRoleCard";
import { fixturePayload, fixtureRole } from "@/test/playerCardFixture";
import { forgetRootCast } from "@/components/roots/rootCast";

const CATALYST = "Catalysts start things and gather the people to carry them.";
let blurbs: Record<string, string> = {};

beforeEach(() => {
  forgetRootCast();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => {
      const u = String(url);
      const reply = (body: unknown, status = 200) => ({ ok: status < 300, status, json: async () => body });
      if (u === "/api/archetypes") {
        return reply(["catalyzing", "building"].map((key) => ({ key, name: key === "catalyzing" ? "The Catalyst" : "The Builder", subtitle: "", blurb: blurbs[key] ?? "" })));
      }
      return reply({ error: "not here" }, 404);
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const card = () =>
  fixturePayload(1, "self", {
    roles: [{ ...fixtureRole(1), archetypes: ["catalyzing", "building"], archetypesSuggested: false }],
    archetypeNames: { catalyzing: "The Catalyst", building: "The Builder" },
  });

describe("the class chips on a role", () => {
  it("puts each archetype's own meaning on its chip, after 'Plays as' and the chip's name", async () => {
    blurbs = { catalyzing: CATALYST, building: "Builders make what the village stands on." };
    render(<PlayerRoleCardView data={card()} />);
    const chip = await screen.findByRole("button", { name: "The Catalyst" });
    expect(chip).toHaveAccessibleDescription(`Plays as The Catalyst: ${CATALYST}`);
    expect(screen.getByRole("button", { name: "The Builder" })).toHaveAccessibleDescription("Plays as The Builder: Builders make what the village stands on.");
    // Every chip explains itself, so the label is not printed.
    expect(document.querySelector('[data-role-chip="plays-label"]')).toBeNull();
  });

  it("prints 'Plays as' before the chips, and gives no tip to a chip whose archetype has no blurb", async () => {
    blurbs = { catalyzing: CATALYST };
    render(<PlayerRoleCardView data={card()} />);
    await screen.findByRole("button", { name: "The Catalyst" });
    expect(screen.queryByRole("button", { name: "The Builder" })).toBeNull();
    await waitFor(() => expect(document.querySelector('[data-role-chip="plays-label"]')?.textContent).toBe("Plays as"));
  });
});
