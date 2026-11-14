/**
 * "Your Progression" shows the top few powers first and the rest under "Show
 * me everything", grouped by kind (Rye, 14 Nov 2026). The rule: what your
 * roles and groups hand you, then what opened most recently, then the rest.
 */
import { describe, expect, it } from "vitest";
import { ALL_CAPABILITIES } from "@shared/capabilities";
import { POWER_KIND_OF, POWER_KINDS, powerGroups, powerKindOf, topPowers, TOP_POWERS } from "./powerKinds";

const row = (key: string, via: "stage" | "appointment", held = true) => ({ key, held, opens: { via } });

describe("the top powers", () => {
  it("puts what roles and groups hand you first, then the newest stage turn, then the rest", () => {
    const held = ["forum.post", "ballot.vote", "map.publish", "org.seat", "event.rsvp", "message.send", "quest.consent", "feed.announce"];
    const catalogue = [row("forum.post", "stage"), row("org.seat", "appointment"), row("feed.announce", "appointment"), row("ballot.vote", "stage"), row("steward.veto", "appointment", false)];
    const history = [
      { unlocked: ["forum.post"], at: "2026-09-01T00:00:00Z" },
      { unlocked: ["map.publish", "ballot.vote"], at: "2026-10-01T00:00:00Z" },
    ];
    expect(topPowers(held, catalogue, history)).toEqual(["org.seat", "feed.announce", "map.publish", "ballot.vote", "forum.post", "event.rsvp"]);
  });

  it("never names a power the member does not hold, and never more than the limit", () => {
    const top = topPowers(["forum.post"], [row("steward.veto", "appointment", false)], [{ unlocked: ["map.publish"], at: "2026-10-01" }]);
    expect(top).toEqual(["forum.post"]);
    expect(topPowers(ALL_CAPABILITIES, [], []).length).toBe(TOP_POWERS);
  });
});

describe("every power, grouped by kind", () => {
  it("gives every capability a kind, and every kind is one the page draws", () => {
    for (const cap of ALL_CAPABILITIES) expect(POWER_KINDS).toContain(POWER_KIND_OF[cap]);
  });

  it("groups in the page's order, leaves out empty kinds, and homes an unknown key", () => {
    const groups = powerGroups(["ballot.vote", "forum.post", "proposal.open", "not.a.key"]);
    expect(groups.map((g) => g.kind)).toEqual(["talk", "decide", "keep"]);
    expect(groups[1].keys).toEqual(["ballot.vote", "proposal.open"]);
    expect(powerKindOf("not.a.key")).toBe("keep");
  });
});
