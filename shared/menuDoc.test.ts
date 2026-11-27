/**
 * A village's own menu survives the Governance rename (26 Nov 2026): what it said about /review, /decisions,
 * /governance and the "Decide" group now applies to the entries and group that took their place.
 */
import { describe, expect, it } from "vitest";
import { menuDocOf } from "./menuDoc";

describe("menuDocOf carries a village's words over to the moved entries", () => {
  it("a label, a hidden entry and a group name set on the old key apply to the new one", () => {
    const m = menuDocOf({
      labels: { "/review": "Stewards' desk", "/decisions": "Votes", "/forum": "Crew Talk" },
      hidden: ["/governance", "/forum"],
      groups: { Decide: "Choose together" },
      tabs: ["/decisions"],
    });
    expect(m.labels).toEqual({ "/governance/work": "Stewards' desk", "/governance/decisions": "Votes", "/forum": "Crew Talk" });
    expect(m.hidden.sort()).toEqual(["/forum", "/governance/how"]);
    expect(m.groups).toEqual({ Govern: "Choose together" });
    // Tabs are left alone: the old address still opens, as a redirect.
    expect(m.tabs).toEqual(["/decisions"]);
  });

  it("carries a name the village gave Governance to Govern (round 2, 27 Nov 2026), and it beats one left on Decide", () => {
    expect(menuDocOf({ groups: { Governance: "How we decide" } }).groups).toEqual({ Govern: "How we decide" });
    expect(menuDocOf({ groups: { Decide: "Older", Governance: "Newer" } }).groups).toEqual({ Govern: "Newer" });
  });

  it("never overwrites what the village already said under the new key", () => {
    const m = menuDocOf({ labels: { "/review": "Old", "/governance/work": "New" }, groups: { Decide: "Old", Governance: "New" } });
    expect(m.labels).toEqual({ "/governance/work": "New" });
    expect(m.groups).toEqual({ Govern: "New" });
  });

  it("a document that names nothing moved is read as it was", () => {
    expect(menuDocOf({ labels: { "/forum": "Crew Talk" }, hidden: ["/forum"], groups: { Community: "Aboard" }, tabs: ["/map"] })).toEqual({
      labels: { "/forum": "Crew Talk" },
      hidden: ["/forum"],
      groups: { Community: "Aboard" },
      tabs: ["/map"],
    });
  });
});
