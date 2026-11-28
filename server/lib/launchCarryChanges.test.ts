/**
 * WHAT CHANGES WHEN THE LAUNCH VOTE CARRIES, with no database.
 *
 * The list is pure, so each case here is a set of facts and the answer a
 * person would be shown. The first case is the first village's own shape: a
 * village that has been issuing since before the vote existed, with a test
 * account among its founders. `server/launchCarryChanges.routes.e2e.test.ts`
 * reads the same list off the built server and then checks one door against
 * what the list said about it.
 */
import { describe, expect, it } from "vitest";
import {
  carryLangFrom,
  launchCarryChanges,
  testAccountReason,
  type AdminAccount,
  type CarryChangeId,
  type CarryFacts,
} from "./launchCarryChanges";
import { seasonTurnAtLaunch } from "./launchSeasonTurn";

const NAMES: Record<string, string> = {
  ren: "Ren Fenn",
  sera: "Sera Vale",
  qa: "Integration QA",
  ana: "Ana Ruiz",
  bo: "Bo Linde",
  tia: "Tia Marsh",
};
const admin = (id: string, role: string, extra: Partial<AdminAccount> = {}): AdminAccount => ({
  id, name: NAMES[id], role, viaRole: role === "admin" || role === "founder", groups: [], present: true, ...extra,
});

const SEASONS = [
  { id: "foundations", name: "Season of Foundations", startsOn: "2026-03-01", endsOn: "" },
  { id: "rooting", name: "Season of Rooting", startsOn: "2027-01-15", endsOn: "2027-04-15" },
];

/** The first village, before its ratifying vote is opened. */
function firstVillage(over: Partial<CarryFacts> = {}): CarryFacts {
  return {
    kind: "ratifying",
    issuingSince: "2026-03-14T09:26:53Z",
    launchedAt: null,
    admins: [admin("ana", "admin"), admin("bo", "member", { groups: ["Panel Keys"] }), admin("qa", "founder"), admin("ren", "founder"), admin("sera", "founder")],
    holders: { pay: [], moduleSwitch: [], orgDecide: [], tokenMint: [], steward: [] },
    roll: {
      kind: "founders",
      yesNeeded: 3,
      onIt: [{ id: "qa", name: NAMES.qa }, { id: "ren", name: NAMES.ren }, { id: "sera", name: NAMES.sera }],
      notOnIt: [],
    },
    testFounders: [{ id: "qa", name: NAMES.qa, why: "name" }],
    slate: null,
    handover: ["Switch modules", "Decide the org chart"],
    season: seasonTurnAtLaunch(SEASONS, "2026-12-30"),
    stewardTerm: { endsOn: "2027-04-15", problem: null },
    tokenMint: { alreadyHeld: false, rolesWithSomebody: false, treasury: [] },
    adminSources: ["sera"],
    currency: "USD",
    moonSetByHand: false,
    nameOf: (id) => NAMES[id] ?? id,
    ...over,
  };
}

const change = (out: ReturnType<typeof launchCarryChanges>, id: CarryChangeId) => {
  const c = out.changes.find((x) => x.id === id);
  if (!c) throw new Error(`no change ${id}`);
  return c;
};
const ids = (people: Array<{ id: string }>) => people.map((p) => p.id).sort();

describe("the first village, before its ratifying vote is opened", () => {
  const out = launchCarryChanges(firstVillage());

  it("says which vote this is, and that issuance does not restart", () => {
    expect(out.kind).toBe("ratifying");
    // The vote keeps its name, and the day it carries is the Game's birthday (Rye, 2026-11-28).
    expect(out.summary).toBe(
      "This village has been issuing since 2026-03-14 and has never held its Start the Game vote. The day the vote carries is the Game's birthday, and the village's powers pass that day. Issuance was already open and does not restart.",
    );
    expect(out.summary).not.toMatch(/ratif/i);
  });

  it("lists every door once, in one order", () => {
    expect(out.changes.map((c) => c.id)).toEqual([
      "issuance", "founder-powers", "vote-rules", "stewards", "season", "moon-one", "module-switch", "org-publish",
      "pay", "budget-sources", "token-mint", "handover", "keystone", "currency", "checklist",
    ]);
    for (const c of out.changes) {
      expect(c.title, c.id).toBeTruthy();
      expect(c.today, c.id).toBeTruthy();
      expect(c.after, c.id).toBeTruthy();
    }
  });

  it("what hangs off issuance is ALREADY true here, and the vote changes none of it", () => {
    for (const id of ["issuance", "founder-powers", "vote-rules"] as const) {
      expect(change(out, id).standing, id).toBe("already");
      expect(change(out, id).after, id).toBe("Nothing changes.");
    }
    expect(change(out, "issuance").today).toBe("Issuance has been open since 2026-03-14.");
  });

  it("the season turns, and a steward seated by the vote holds the whole new one", () => {
    expect(change(out, "season")).toMatchObject({
      standing: "flips",
      today: "Season of Foundations is running.",
      after: "Season of Rooting begins that day, taking over from Season of Foundations. Nothing else on the calendar moves, and every role keeps the end date it was given.",
    });
    expect(change(out, "stewards").after).toBe(
      "Whoever the proposal names and who accepts holds the steward role, with every power the village has to give, until 2027-04-15. The founder who opens the vote picks the names from the launch roll.",
    );
    expect(change(out, "moon-one").standing).toBe("flips");
  });

  it("NAMES EVERY ADMIN WHO WOULD LOSE A DOOR, the group admin included, because nobody is known to hold the power yet", () => {
    // Turning a module on and publishing the org chart pass any admin today, by role or by group.
    expect(ids(change(out, "module-switch").loses)).toEqual(["ana", "bo", "qa", "ren", "sera"]);
    expect(ids(change(out, "org-publish").loses)).toEqual(["ana", "bo", "qa", "ren", "sera"]);
    expect(out.admins.find((a) => a.id === "bo")?.loses).toEqual(["module-switch", "org-publish"]);
    expect(out.admins.find((a) => a.id === "ana")?.loses).toEqual(["module-switch", "org-publish"]);
    const told = out.attention.find((a) => a.id === "admins-lose");
    expect(told?.text).toBe("5 admins pass a door today that the carry closes to them, on what is known today: Ana Ruiz, Bo Linde, Integration QA, Ren Fenn and Sera Vale.");
  });

  it("the doors that wait for a steward do not flip while nobody is known to be seated", () => {
    // holderDoor lets an admin through for as long as the steward role is empty.
    expect(change(out, "pay")).toMatchObject({ standing: "nothing", loses: [] });
    expect(change(out, "budget-sources").standing).toBe("nothing");
    expect(change(out, "budget-sources").today).toBe("One budget source is on because an admin switched it on: sera.");
    expect(change(out, "token-mint")).toMatchObject({
      standing: "nothing",
      after: "Nobody would be in the steward role or the Treasury role, so nothing moves and an admin keeps minting by hand.",
    });
    expect(change(out, "handover")).toMatchObject({ standing: "nothing", loses: [] });
    expect(change(out, "handover").today).toBe("2 powers are selected to cross at the launch: Switch modules and Decide the org chart.");
  });

  it("the doors that change for every admin alike are listed with nobody singled out", () => {
    for (const id of ["keystone", "currency", "checklist"] as const) {
      expect(change(out, id).standing, id).toBe("flips");
      expect(change(out, id).loses, id).toEqual([]);
    }
    expect(change(out, "currency").today).toBe("An admin can change it. It is USD today.");
  });

  it("SURFACES THE TEST ACCOUNT THAT HOLDS THE FOUNDER ROLE, and that its answer counts", () => {
    const flagged = out.attention.filter((a) => a.id === "test-founder");
    expect(flagged).toHaveLength(1);
    expect(flagged[0].accounts).toEqual([{ id: "qa", name: "Integration QA" }]);
    expect(flagged[0].text).toBe(
      "Integration QA holds the founder role and reads as a test account: its name carries a test word. It is on the launch roll, so its answer counts toward the 3 yeses the launch needs.",
    );
  });
});

describe("with the vote open", () => {
  const open = firstVillage({
    slate: { named: [{ id: "ren", name: NAMES.ren }, { id: "sera", name: NAMES.sera }], accepted: ["ren"], declined: [] },
    tokenMint: { alreadyHeld: false, rolesWithSomebody: true, treasury: [{ id: "tia", name: NAMES.tia }] },
  });
  const out = launchCarryChanges(open);

  it("whoever was named and has accepted keeps every door, and everybody else is named as losing it", () => {
    expect(change(out, "stewards").holds).toEqual([{ id: "ren", name: "Ren Fenn" }]);
    expect(change(out, "stewards").after).toContain("Named: Ren Fenn and Sera Vale. Accepted so far: Ren Fenn.");
    expect(ids(change(out, "module-switch").loses)).toEqual(["ana", "bo", "qa", "sera"]);
    expect(ids(change(out, "module-switch").holds)).toEqual(["ren"]);
  });

  it("the pay doors now flip, for the admins who pass them today: by role, never by group", () => {
    expect(change(out, "pay").standing).toBe("flips");
    // Bo reaches the panel through a group, and the pay door's admin step reads the account role alone.
    expect(ids(change(out, "pay").loses)).toEqual(["ana", "qa", "sera"]);
    expect(change(out, "budget-sources").standing).toBe("flips");
  });

  it("token.mint crosses to the stewards and the Treasury role, and the Treasury holder keeps it", () => {
    expect(change(out, "token-mint").standing).toBe("flips");
    expect(ids(change(out, "token-mint").holds)).toEqual(["ren", "tia"]);
    expect(ids(change(out, "token-mint").loses)).toEqual(["ana", "qa", "sera"]);
  });

  it("the selected powers cross, and the admins who pass by being admins are named", () => {
    expect(change(out, "handover").standing).toBe("flips");
    expect(ids(change(out, "handover").loses)).toEqual(["ana", "qa", "sera"]);
    expect(out.admins.find((a) => a.id === "ren")?.loses).toEqual([]);
    expect(out.admins.find((a) => a.id === "sera")?.loses).toEqual(["module-switch", "org-publish", "pay", "token-mint", "handover"]);
  });

  it("a decline is not an acceptance, and a vote nobody has accepted says what carrying it would mean", () => {
    const declined = launchCarryChanges(firstVillage({ slate: { named: [{ id: "ren", name: NAMES.ren }], accepted: ["ren"], declined: ["ren"] } }));
    expect(change(declined, "stewards").holds).toEqual([]);
    expect(change(declined, "pay").standing).toBe("nothing");
    expect(declined.attention.find((a) => a.id === "nobody-accepted")?.text).toBe(
      "Nobody has accepted the steward role on the open vote. If it carries this way, nobody is seated, no power crosses, and an admin keeps the pay doors and hand minting.",
    );
    expect(out.attention.some((a) => a.id === "nobody-accepted")).toBe(false);
  });

  it("WARNS WHEN THE STEWARD LIST LEAVES OUT SOMEBODY WHO SETS PAY TODAY, by name, before anybody has accepted", () => {
    // Rye, 2026-11-28: the steward list "must include whoever runs pay". Ana sets pay as an admin and is not named.
    const told = out.attention.find((a) => a.id === "pay-left-out");
    expect(ids(told?.accounts ?? [])).toEqual(["ana", "qa"]);
    expect(told?.text).toBe(
      "The steward list leaves out 2 people who can set pay and keep the budget today: Ana Ruiz and Integration QA. Once somebody on the list is seated, they no longer can.",
    );
    // Bo reaches the panel through a group and does not pass the pay door today, so he is not somebody left out of it.
    expect(told?.accounts.some((a) => a.id === "bo")).toBe(false);
    // Somebody who already holds the pay power keeps it whoever is listed, so they are not warned about.
    const held = launchCarryChanges({ ...open, holders: { ...open.holders, pay: ["ana"] } });
    expect(ids(held.attention.find((a) => a.id === "pay-left-out")?.accounts ?? [])).toEqual(["qa"]);
    // A list that names everybody who sets pay says nothing, and so does a village with no vote open.
    const everyone = launchCarryChanges({ ...open, slate: { named: ["ana", "qa", "ren", "sera"].map((id) => ({ id, name: NAMES[id] })), accepted: [], declined: [] } });
    expect(everyone.attention.some((a) => a.id === "pay-left-out")).toBe(false);
    expect(launchCarryChanges(firstVillage()).attention.some((a) => a.id === "pay-left-out")).toBe(false);
  });

  it("somebody who already holds a power keeps its door without being a steward", () => {
    const held = launchCarryChanges(firstVillage({ holders: { pay: ["ana"], moduleSwitch: ["bo"], orgDecide: [], tokenMint: [], steward: ["sera"] } }));
    expect(ids(change(held, "module-switch").loses)).toEqual(["ana", "qa", "ren"]);
    expect(ids(change(held, "pay").loses)).toEqual(["qa", "ren"]);
    expect(change(held, "stewards").today).toBe("Sera Vale holds the steward role today.");
  });
});

describe("a village that has not started its Game", () => {
  const out = launchCarryChanges(firstVillage({ kind: "first", issuingSince: null, adminSources: [], currency: null }));

  it("what hangs off issuance flips with the rest", () => {
    expect(out.summary).toBe("This village has not started its Game. Its launch vote starts issuance and passes the village's powers, in one request.");
    expect(change(out, "issuance")).toMatchObject({
      standing: "flips",
      today: "Nothing can be issued to anybody.",
      after: "Issuance turns on, and the End of Moon shares approved before the vote are paid.",
    });
    expect(change(out, "founder-powers").standing).toBe("flips");
    expect(change(out, "vote-rules").standing).toBe("flips");
  });

  it("a village with no currency has none to lock, and no admin source has none to switch off", () => {
    expect(change(out, "currency")).toMatchObject({ standing: "nothing", today: "No currency is set yet." });
    expect(change(out, "budget-sources")).toMatchObject({ standing: "nothing", today: "No budget source is on because an admin switched it on.", after: "Nothing to switch off." });
  });
});

describe("what a person should look at before the vote", () => {
  it("a roll short of its number, and founders who are not on it", () => {
    const out = launchCarryChanges(firstVillage({
      roll: { kind: "founders", yesNeeded: 3, onIt: [{ id: "ren", name: NAMES.ren }], notOnIt: [{ id: "sera", name: NAMES.sera, reason: "not_signed_in" }] },
      testFounders: [{ id: "qa", name: NAMES.qa, why: "address" }],
    }));
    expect(out.attention.find((a) => a.id === "roll-short")?.text).toBe("1 on the launch roll, and the vote needs 3. It cannot open yet.");
    expect(out.attention.find((a) => a.id === "founders-away")?.text).toBe(
      "Sera Vale: holding the founder role and not on the launch roll, because the account has not signed in or has left.",
    );
    // A test account that is off the roll is still named, and the sentence says it does not count today.
    expect(out.attention.find((a) => a.id === "test-founder")?.text).toBe(
      "Integration QA holds the founder role and reads as a test account: its address carries a test word. It is not on the launch roll today.",
    );
  });

  it("a village that asks every member still counts a test account that holds the founder role", () => {
    // The way through for a village short of founders is to ask every member. The test account is a member too.
    const out = launchCarryChanges(firstVillage({
      roll: { kind: "members", yesNeeded: 3, onIt: [{ id: "qa", name: NAMES.qa }, { id: "ren", name: NAMES.ren }, { id: "tia", name: NAMES.tia }], notOnIt: [] },
    }));
    expect(out.attention.find((a) => a.id === "test-founder")?.text).toBe(
      "Integration QA holds the founder role and reads as a test account: its name carries a test word. It is on the launch roll, so its answer counts toward the 3 yeses the launch needs.",
    );
  });

  it("no next season on the calendar", () => {
    const out = launchCarryChanges(firstVillage({ season: seasonTurnAtLaunch([SEASONS[0]], "2026-12-30"), stewardTerm: { endsOn: null, problem: "The running season has no end date." } }));
    expect(change(out, "season")).toMatchObject({ standing: "nothing", after: "No next season is on the calendar, so the season does not turn." });
    expect(out.attention.find((a) => a.id === "season")?.text).toBe(
      "No next season is on the calendar. The launch begins the next season, so add one, with an end date, before the vote.",
    );
    // Nobody can be seated, so nobody is counted as keeping a door, even somebody who accepted.
    expect(change(out, "stewards")).toMatchObject({ standing: "nothing", holds: [] });
    expect(change(out, "stewards").after).toBe("Nobody can be seated as a steward on today's calendar. The running season has no end date.");
  });

  it("a next season with no end date", () => {
    const seasons = [SEASONS[0], { ...SEASONS[1], endsOn: "" }];
    const out = launchCarryChanges(firstVillage({ season: seasonTurnAtLaunch(seasons, "2026-12-30"), stewardTerm: { endsOn: null, problem: "The running season has no end date." } }));
    expect(out.attention.find((a) => a.id === "season")?.text).toBe(
      "Season of Rooting has no end date. A steward role ends with its season, so nobody can be seated as a steward until it has one.",
    );
  });

  it("a village with nothing to look at is told nothing", () => {
    const calm = launchCarryChanges(firstVillage({ testFounders: [], admins: [admin("ren", "founder")], holders: { pay: [], moduleSwitch: ["ren"], orgDecide: ["ren"], tokenMint: [], steward: ["ren"] } }));
    expect(calm.attention).toEqual([]);
  });
});

describe("a launch that has carried", () => {
  it("has nothing left to change, and says the day", () => {
    const out = launchCarryChanges(firstVillage({ kind: "carried", launchedAt: "2026-12-30T21:14:09.000Z" }));
    expect(out.changes).toEqual([]);
    expect(out.attention).toEqual([]);
    expect(out.summary).toBe("The launch carried on 2026-12-30. Nothing is left to change.");
    expect(out.admins.every((a) => a.loses.length === 0)).toBe(true);
  });
});

describe("in Spanish", () => {
  it("every title and every sentence has its Spanish, and none is left in English", () => {
    const en = launchCarryChanges(firstVillage(), "en");
    const es = launchCarryChanges(firstVillage(), "es");
    expect(es.changes.map((c) => c.id)).toEqual(en.changes.map((c) => c.id));
    for (let i = 0; i < en.changes.length; i++) {
      for (const field of ["title", "today", "after"] as const) {
        expect(es.changes[i][field], `${en.changes[i].id}.${field}`).toBeTruthy();
        expect(es.changes[i][field], `${en.changes[i].id}.${field}`).not.toBe(en.changes[i][field]);
      }
    }
    expect(es.summary).not.toBe(en.summary);
    expect(es.attention.map((a) => a.id)).toEqual(en.attention.map((a) => a.id));
    for (let i = 0; i < en.attention.length; i++) expect(es.attention[i].text).not.toBe(en.attention[i].text);
    expect(change(es, "module-switch").title).toBe("Activar un módulo");
    expect(es.attention.find((a) => a.id === "test-founder")?.text).toBe(
      "Integration QA tiene el rol de fundación y parece una cuenta de prueba: su nombre lleva una palabra de prueba. Está en la lista del lanzamiento, así que su respuesta cuenta para los 3 síes que el lanzamiento necesita.",
    );
  });

  it("reads the language off any Spanish tag, and answers English otherwise", () => {
    expect(carryLangFrom("es")).toBe("es");
    expect(carryLangFrom("es-CR")).toBe("es");
    expect(carryLangFrom(" ES ")).toBe("es");
    expect(carryLangFrom("en")).toBe("en");
    expect(carryLangFrom(undefined)).toBe("en");
    expect(carryLangFrom(["es"])).toBe("es");
    expect(carryLangFrom("fr")).toBe("en");
  });
});

describe("testAccountReason: an account that reads as a test account", () => {
  it("reads the name and the part of the address before the @, as whole words", () => {
    expect(testAccountReason({ name: "Integration QA", email: "someone@village.example" })).toBe("name");
    expect(testAccountReason({ name: "integration-qa", email: "" })).toBe("name");
    expect(testAccountReason({ name: "TEST Ana", email: "ana@village.example" })).toBe("name");
    expect(testAccountReason({ name: "Ana Ruiz", email: "integration-qa@village.example" })).toBe("address");
    expect(testAccountReason({ name: "Ana Ruiz", email: "test+qa@example.invalid" })).toBe("address");
    expect(testAccountReason({ name: "Ana Ruiz", email: "e2e.runner@village.example" })).toBe("address");
  });

  it("reads the flags the platform keeps, ahead of the words", () => {
    expect(testAccountReason({ name: "Ana Ruiz", isExample: true })).toBe("example");
    expect(testAccountReason({ name: "Ana Ruiz", isExample: 1 })).toBe("example");
    expect(testAccountReason({ name: "Ana Ruiz", isAgent: 1 })).toBe("agent");
    expect(testAccountReason({ name: "Ana Ruiz", inQaGroup: true })).toBe("qa-group");
  });

  it("THE CONTROLS: a real name that only contains the letters, and a reserved domain on its own, say nothing", () => {
    expect(testAccountReason({ name: "Quentin Aqua", email: "quentin@village.example" })).toBeNull();
    expect(testAccountReason({ name: "Contessa Testa", email: "contessa@village.example" })).toBeNull();
    expect(testAccountReason({ name: "Demi Botha", email: "demi.botha@village.example" })).toBeNull();
    // Every fixture and many placeholders use a reserved domain, so the domain alone is not read.
    expect(testAccountReason({ name: "Maria Soto", email: "maria@example.test" })).toBeNull();
    expect(testAccountReason({ name: "Maria Soto", email: "maria@example.invalid" })).toBeNull();
    expect(testAccountReason({})).toBeNull();
  });
});
