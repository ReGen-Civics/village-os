/**
 * WHO VOTES ON STARTING THE GAME (Rye, 2026-11-27: "at least 3 members holding
 * the founder role"; only founders vote on the launch), AND WHAT A VILLAGE
 * SHORT OF ITS NUMBER IS TOLD (Rye, 2026-11-06: everything changes by the
 * highest village vote, and no action may be left without a vote path).
 *
 * Pins `server/lib/launchRoll.ts`: the roll is the founders present now, each
 * counted once; a village may set it to every member who holds a voice; and a
 * village short of its number reads who is on the roll, which founder accounts
 * are not and why, and the way through that is open to it.
 */
import { describe, expect, it } from "vitest";
import { FOUNDER_SEAT_WEIGHT, launchRollNow, launchRollProblem, type FounderRecord, type LaunchRollDeps } from "./launchRoll";

const person = (id: string, name: string, role: string, extra: Partial<FounderRecord> = {}): FounderRecord => ({ id, name, role, ...extra });

const depsFor = (people: FounderRecord[], opts: { absent?: string[]; left?: string[]; voting?: string[] } = {}): LaunchRollDeps => ({
  members: async () => people,
  isPresent: (m) => !(opts.absent ?? []).includes(String(m.id)),
  withoutFormer: async (list) => list.filter((m) => !(opts.left ?? []).includes(String(m.id))),
  shortName: (name) => name.trim().split(/\s+/)[0] ?? "",
  votingRoll: async () => opts.voting ?? people.map((m) => String(m.id)),
});

const BEFORE_START =
  "The way through: a founder gives the Founder access to more people on their card in Admin, People, or sets the launch to ask every member in the governance settings.";
const WHILE_ISSUING =
  "The way through: nobody new can be given the founder role now that this village is issuing, so the village changes who the launch asks, by a vote at its highest tier that every member answers.";

describe("the launch roll as shipped: the founders", () => {
  it("is the founders and nobody else, each frozen at one", async () => {
    const roll = await launchRollNow(
      depsFor([
        person("u-3", "Tam Reyes", "founder"),
        person("u-1", "Wren Ashby", "founder"),
        person("u-2", "Ida Kestrel", "founder"),
        person("u-4", "Sol Marsh", "admin"),
        person("u-5", "Noa Field", "member"),
      ]),
    );
    expect(roll.kind).toBe("founders");
    expect(roll.electorate).toEqual([
      { userId: "u-1", weight: FOUNDER_SEAT_WEIGHT },
      { userId: "u-2", weight: FOUNDER_SEAT_WEIGHT },
      { userId: "u-3", weight: FOUNDER_SEAT_WEIGHT },
    ]);
    expect(FOUNDER_SEAT_WEIGHT).toBe(1);
    expect(roll.founders).toEqual([
      { id: "u-1", name: "Wren" },
      { id: "u-2", name: "Ida" },
      { id: "u-3", name: "Tam" },
    ]);
    expect(roll.notOnTheRoll).toEqual([]);
    // An admin and a member are not founders, however much voice they hold elsewhere.
    expect(roll.electorate.map((e) => e.userId)).not.toContain("u-4");
    expect(roll.electorate.map((e) => e.userId)).not.toContain("u-5");
    expect(launchRollProblem(roll)).toBeNull();
  });

  it("names a founder account that has not signed in, and one that left, with the reason and the way through", async () => {
    const roll = await launchRollNow(
      depsFor(
        [
          person("u-1", "Wren Ashby", "founder"),
          person("u-2", "Ida Kestrel", "founder"),
          person("u-3", "Tam Reyes", "founder"),
          person("u-4", "Sol Marsh", "founder"),
        ],
        { absent: ["u-3"], left: ["u-4"] },
      ),
    );
    expect(roll.electorate.map((e) => e.userId)).toEqual(["u-1", "u-2"]);
    expect(roll.notOnTheRoll).toEqual([
      { id: "u-3", name: "Tam", reason: "not_signed_in" },
      { id: "u-4", name: "Sol", reason: "left" },
    ]);
    expect(launchRollProblem(roll)).toBe(
      "2 founding members are on the roll today. One more founding member and the village can hold its launch vote. " +
        "On the roll: Wren and Ida. " +
        "Tam holds the founder role and has not signed in yet, so that account is not on the roll. " +
        "Sol holds the founder role and has left the village, so that account is not on the roll. " +
        BEFORE_START,
    );
  });

  it("says nothing once three founders are on it, even with another founder account missing", async () => {
    const roll = await launchRollNow(
      depsFor(
        [
          person("u-1", "Wren", "founder"),
          person("u-2", "Ida", "founder"),
          person("u-3", "Tam", "founder"),
          person("u-4", "Sol", "founder"),
        ],
        { absent: ["u-4"] },
      ),
    );
    expect(roll.electorate).toHaveLength(3);
    expect(roll.notOnTheRoll).toEqual([{ id: "u-4", name: "Sol", reason: "not_signed_in" }]);
    expect(launchRollProblem(roll)).toBeNull();
  });

  it("holds the village's own number, never below three", async () => {
    const three = await launchRollNow(depsFor([person("u-1", "Wren", "founder"), person("u-2", "Ida", "founder"), person("u-3", "Tam", "founder")]));
    expect(launchRollProblem(three, { villageMin: 1 }), "a dial below the floor is held at three").toBeNull();
    expect(launchRollProblem(three, { villageMin: 5 })).toContain("2 more founding members");
    expect(launchRollProblem(three, { villageMin: 5 })).toContain("On the roll: Wren, Ida and Tam.");
  });

  it("an empty village is told plainly, with no names to list, and still told the way through", async () => {
    const roll = await launchRollNow(depsFor([person("u-9", "Noa", "member")]));
    expect(roll.electorate).toEqual([]);
    expect(launchRollProblem(roll)).toBe(
      `No founding member is on the roll today. 3 more founding members and the village can hold its launch vote. ${BEFORE_START}`,
    );
  });

  it("several unsigned accounts are named together", async () => {
    const roll = await launchRollNow(
      depsFor([person("u-1", "Wren", "founder"), person("u-2", "Ida", "founder"), person("u-3", "Tam", "founder")], { absent: ["u-2", "u-3"] }),
    );
    expect(launchRollProblem(roll)).toContain("Ida and Tam hold the founder role and have not signed in yet, so those accounts are not on the roll.");
  });
});

describe("no village is left without a path (Rye, 2026-11-06)", () => {
  const twoFounders = [person("u-1", "Wren", "founder"), person("u-2", "Ida", "founder"), person("u-3", "Tam", "member"), person("u-4", "Sol", "member")];

  it("before the Game starts, the path is a founder's: give the role, or ask every member", async () => {
    const roll = await launchRollNow(depsFor(twoFounders));
    const told = launchRollProblem(roll, { founderPowerStands: true });
    expect(told).toContain("One more founding member");
    expect(told?.endsWith(BEFORE_START)).toBe(true);
    // Absent reads as a village that has not started, which is where this vote is usually asked.
    expect(launchRollProblem(roll)?.endsWith(BEFORE_START)).toBe(true);
  });

  it("once a village is issuing, nobody new is made a founder, so the path is the village's highest vote", async () => {
    // Amora's shape: issuing since before the vote existed, and short of three founders.
    const roll = await launchRollNow(depsFor(twoFounders));
    const told = launchRollProblem(roll, { founderPowerStands: false });
    expect(told?.endsWith(WHILE_ISSUING)).toBe(true);
    expect(told).not.toContain("gives the Founder access");
  });

  it("a village that asks EVERY MEMBER has those four on the roll, each at one, and may open", async () => {
    const roll = await launchRollNow(depsFor(twoFounders), "members");
    expect(roll.kind).toBe("members");
    expect(roll.electorate).toEqual(["u-1", "u-2", "u-3", "u-4"].map((userId) => ({ userId, weight: 1 })));
    expect(roll.founders.map((f) => f.name)).toEqual(["Wren", "Ida", "Tam", "Sol"]);
    // Founder accounts are not singled out on a roll that is not about them.
    expect(roll.notOnTheRoll).toEqual([]);
    expect(launchRollProblem(roll)).toBeNull();
    // Control: the same village on the roll as shipped is one founder short.
    expect(launchRollProblem(await launchRollNow(depsFor(twoFounders)))).toContain("One more founding member");
  });

  it("on a roll of members, only those who hold a voice are on it, and a village short of them is told its own path", async () => {
    const roll = await launchRollNow(depsFor(twoFounders, { voting: ["u-1", "u-3"] }), "members");
    expect(roll.electorate.map((e) => e.userId)).toEqual(["u-1", "u-3"]);
    // At three, the floor nothing lowers, the only way is more people.
    expect(launchRollProblem(roll, { founderPowerStands: true })).toBe(
      "2 members hold a voice in this village today. One more member and the village can hold its launch vote. On the roll: Wren and Tam. " +
        "The way through: more members join. A launch needs three people.",
    );
    // A village that raised its number may also lower it again: a founder before the Game starts, its highest vote after.
    expect(launchRollProblem(roll, { villageMin: 5, founderPowerStands: true })?.endsWith(
      "The way through: more members join, or a founder lowers how many the launch asks in the governance settings, never below three.",
    )).toBe(true);
    expect(launchRollProblem(roll, { villageMin: 5, founderPowerStands: false })?.endsWith(
      "The way through: more members join, or the village lowers how many the launch asks, never below three, by a vote at its highest tier.",
    )).toBe(true);
  });
});
