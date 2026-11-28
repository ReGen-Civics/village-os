/**
 * WHAT THE VILLAGE ACTUALLY READS WHEN IT VOTES TO START ITS GAME.
 *
 * `ballots.doc_markdown` is frozen when the vote opens and is the thing every
 * member votes on, so Rye's "so it's there in the proposal to be voted on" is
 * a requirement about THIS STRING and not about a screen. Until this file the
 * only way to check a word of it was to open a real launch vote against a real
 * schema, because the document was an array literal inside a route.
 *
 * No database, no ballot, no server. That is the point of the extraction.
 */
import { describe, expect, it } from "vitest";
import { launchProposalDoc } from "./lib/launchProposal";
import { HANDOVER_SET } from "../shared/capabilities";

const BASE = {
  villageName: "Larksfield",
  quorumPct: 100,
  unityPct: 100,
  onTheRoll: 4,
  weightNote: "",
  openedBy: "Wren",
  openedOn: "2026-09-24",
  slate: [] as Array<{ id: string; name: string }>,
  handover: [] as Array<{ title: string; consequence: string }>,
};

describe("the launch proposal's frozen document", () => {
  it("lists EXACTLY the powers the launch hands to the village, in plain words, so a member votes on the list", () => {
    // Coordinator ruling on #769 (2026-11-01), on Rye's "at launch the stewards select WHAT powers are being passed over".
    const doc = launchProposalDoc({
      ...BASE,
      handover: [
        { title: "Who sits in which role", consequence: "seat people in the village's roles, and take them out again" },
        { title: "The village's story", consequence: "say what this village is, in public, in its own words" },
      ],
    });
    expect(doc).toContain("## What the launch hands to the village");
    expect(doc).toContain("the village holds these 2 powers, and only a village vote hands one back");
    expect(doc).toContain("- Who sits in which role: whoever holds it can seat people in the village's roles, and take them out again.");
    expect(doc).toContain("- The village's story: whoever holds it can say what this village is, in public, in its own words.");
    expect(doc).toContain("The stewards hold every other power");
  });

  it("says out loud when the launch hands the village none of its powers", () => {
    const doc = launchProposalDoc(BASE);
    expect(doc).toContain("## What the launch hands to the village");
    expect(doc).toContain("None of its powers. The stewards hold every one of them after launch");
  });

  it("NAMES the founding stewards it puts forward, and says whose list it is", () => {
    const doc = launchProposalDoc({
      ...BASE,
      slate: [
        { id: "cat-1", name: "Wren" },
        { id: "cat-2", name: "Iris" },
      ],
    });
    expect(doc).toContain("## Who carries the steward role");
    // The slate is IN the document, by name, as a list a member can read.
    expect(doc).toContain("- Wren");
    expect(doc).toContain("- Iris");
    // ONE PERSON CHOSE IT, and the village is owed that plainly. A document
    // that listed names with nobody attached would read as the village's own
    // decision, which it is not until the vote carries.
    expect(doc).toContain("Wren opened this vote and chose who it puts forward");
    expect(doc).toContain("Voting yes is voting for this list");
  });

  it("says accepting means holding ALL the powers, with the count from HANDOVER_SET", () => {
    const doc = launchProposalDoc({ ...BASE, slate: [{ id: "cat-1", name: "Wren" }] });
    /*
     * NOT a hand-typed nineteen. `HANDOVER_SET` is derived from `TRANSFERABLE`
     * so a new entrustable power joins it without anybody remembering to, and
     * a number typed here would pass this test forever while the document told
     * a village the wrong thing.
     */
    expect(doc).toContain(`all ${HANDOVER_SET.length} of the powers this village has to give`);
    expect(doc, "and what the seat actually does").toContain(
      "stop a decision the village has already carried",
    );
    expect(doc, "and that saying no is a real answer").toContain("Anybody named can decline");
  });

  it("says out loud when the proposal names NOBODY, and what that means", () => {
    const doc = launchProposalDoc(BASE);
    expect(doc).toContain("## The steward role");
    expect(doc).toContain("named nobody for the steward role");
    expect(doc, "and that nothing is broken by it").toContain("That stops nothing");
    expect(doc, "so no reader can mistake it for the other branch").not.toContain(
      "Who carries the steward role",
    );
  });

  it("names the admin doors the launch closes, on modules and the org chart, and who holds them after (R166)", () => {
    const section = (doc: string) => doc.split("## What changes when this carries")[1].split("## ")[0];
    const empty = section(launchProposalDoc(BASE));
    expect(empty, "turning a module on leaves the admin panel").toContain("An admin can no longer turn a module on directly.");
    expect(empty, "the valve that stays is said too").toContain("An admin can still pause a module or turn one off");
    expect(empty, "the org chart's door closes").toContain("An admin can no longer publish a change to the org chart directly.");
    expect(empty, "with nobody named, the vote is the door").toContain("Nobody holds those two powers after this vote, so both go to a village vote");
    const named = section(launchProposalDoc({ ...BASE, slate: [{ id: "u1", name: "Wren" }, { id: "u2", name: "Ida" }] }));
    expect(named, "with a slate, whoever accepts holds both").toContain("Whoever on the list below accepts the steward role holds both powers");
    expect(named).not.toContain("Nobody holds those two powers");
  });

  it("keeps every sentence the launch document already carried", () => {
    /*
     * The regression this extraction could have caused. The document moved out
     * of the route whole, and a member reading it should not be able to tell
     * that anything happened to the file it lives in.
     */
    const doc = launchProposalDoc({ ...BASE, weightNote: "Everybody's voice weighs the same here." });
    expect(doc).toContain("# Start the Game");
    expect(doc).toContain("Larksfield is built. This vote is what starts it.");
    expect(doc).toContain("## What changes when this carries");
    expect(doc).toContain("Token issuance turns on.");
    expect(doc).toContain("## What this vote asks");
    // The rule of 2026-11-27, which replaced "Everyone on the roll votes yes".
    expect(doc).toContain("Only founding members vote on this. It carries the moment 3 of them have said yes, unless one of them has said no. It does not wait for the voting window to end.");
    expect(doc).toContain("A no from any one of them holds it for as long as that no stands.");
    expect(doc).toContain("4 founding members are on the roll today, and this vote is frozen to those 4.");
    expect(doc).toContain("An abstention is not a yes and it is not a no.");
    expect(doc).toContain("each person on the roll answers for themselves");
    // Rye, 2026-11-06: the rule is the village's own, and the document says so.
    expect(doc).toContain("How many must say yes, and who is asked, are this village's own settings.");
    expect(doc).toContain("This vote froze them as they stood when it opened.");
    expect(doc, "the old rule is gone from the document").not.toContain("Everyone on the roll votes yes");
    expect(doc).not.toContain("% participation");
    expect(doc).toContain("Everybody's voice weighs the same here.");
    expect(doc).toContain("Every item on the journey to launch read done when Wren opened this, on 2026-09-24.");
  });

  it("names the founders the vote is frozen to, when the caller has their names", () => {
    const doc = launchProposalDoc({ ...BASE, onTheRoll: 3, founders: ["Wren", "Ida", "Tam"] });
    expect(doc).toContain("3 founding members are on the roll today: Wren, Ida and Tam, and this vote is frozen to those 3.");
    // And a member who is not a founder reads where they stand, in the document itself.
    expect(doc).toContain("A member who is not a founding member is not asked on this one vote, and is asked on every vote the village holds after it.");
  });

  it("states the village's OWN number and roll when it has changed them (Rye, 2026-11-06)", () => {
    // The number raised to five on the roll as shipped.
    const five = launchProposalDoc({ ...BASE, onTheRoll: 6, yesNeeded: 5 });
    expect(five).toContain("Only founding members vote on this. It carries the moment 5 of them have said yes, unless one of them has said no.");
    expect(five).toContain("If the window ends before 5 of them have said yes");
    // A stored number below three is never written into a document.
    expect(launchProposalDoc({ ...BASE, yesNeeded: 1 })).toContain("It carries the moment 3 of them have said yes");
    // A village that asks every member.
    const members = launchProposalDoc({ ...BASE, onTheRoll: 9, rollKind: "members" });
    expect(members).toContain("Every member who holds a voice votes on this, each counted once. It carries the moment 3 of them have said yes, unless one of them has said no.");
    expect(members).toContain("9 members are on the roll today, and this vote is frozen to those 9.");
    expect(members, "nobody is told they are not asked when everybody is").not.toContain("is not asked on this one vote");
    expect(members).not.toContain("founding members are on the roll");
  });

  it("a village ALREADY ISSUING keeps the name Start the Game, is told what was already running, and is never told issuance starts", () => {
    // Rye, 2026-11-27: the vote "does not restart issuance". Rye, 2026-11-28: "Let's stay with start the game and
    // have it as the 'birthday of the game' going forward".
    const doc = launchProposalDoc({ ...BASE, slate: [{ id: "u1", name: "Wren" }], ratifying: { issuingSince: "2026-03-14T09:26:53Z" } });
    expect(doc).toContain("# Start the Game");
    expect(doc).toContain(
      "Larksfield has been issuing tokens since 2026-03-14, from before the launch vote existed. This vote starts its Game on the record, and the day it carries is the Game's birthday.",
    );
    expect(doc).toContain("## What was already running");
    expect(doc).toContain("Token issuance. It does not restart, and the day it began stays 2026-03-14. Nothing already issued changes, and nobody's balance moves because of this vote.");
    expect(doc).toContain("That day is the Game's birthday, and Moon 1 is the moon it falls in.");
    expect(doc).toContain("Voting yes is voting for this list as well as for starting the Game.");
    // EVERY "ISSUANCE STARTS" SENTENCE IS REPLACED FOR THIS CASE, and the word Rye turned down is nowhere.
    for (const gone of ["This vote is what starts it", "Token issuance turns on", "nothing can be issued to anybody", "Ratify", "ratif"]) {
      expect(doc, gone).not.toContain(gone);
    }
    // What the launch hands over and who it seats is the same act, so those sections are unchanged.
    for (const kept of ["## What changes when this carries", "## Who carries the steward role", "## What the launch hands to the village", "## What this vote asks", "An admin can no longer publish a change to the org chart directly."]) {
      expect(doc, kept).toContain(kept);
    }
    expect(doc).not.toContain("\n\n\n");
    // With no readable date it still says the truth and names no day.
    const undated = launchProposalDoc({ ...BASE, ratifying: { issuingSince: null } });
    expect(undated).toContain("Larksfield was already issuing tokens before the launch vote existed.");
    expect(undated).toContain("Token issuance. It does not restart, and the day it began does not move.");
    // Control: a first launch reads exactly as it did.
    const first = launchProposalDoc(BASE);
    expect(first).toContain("# Start the Game");
    expect(first).toContain("Token issuance turns on.");
    expect(first).not.toContain("What was already running");
  });

  it("leaves no empty line where a weight note would have been", () => {
    // The `...(note ? [note, ""] : [])` shape, pinned. A blank pair emitted
    // for a village with nothing to say about weight renders as a gap in the
    // middle of the document.
    const doc = launchProposalDoc(BASE);
    expect(doc).not.toContain("\n\n\n");
  });
});
