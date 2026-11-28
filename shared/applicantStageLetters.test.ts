/**
 * THE NEXT-STEP LETTERS' WORDS (the lead, 27 Nov 2026), the role-only booking, the short role labels, the start day and
 * the letters already on main in the same shape. Pure.
 */
import { describe, expect, it } from "vitest";
import { stageLetter, stageLetterKey, type StageLetterInput } from "./applicantStageLetters";
import { parseRoleShortLabels, roleShortLabel } from "./roleShortLabel";
import { bookingLinksText, roleBookingFor } from "./interviewBooking";
import { adoptedAccountLetter, adoptedInviteLetter, closedLetter, invitedLetter } from "./openProposalDecide";
import { sayOnProfile } from "./applicantWords";
import { START_RULE_WORDS, allHandsOnOrAfter, startDayOf, startOf, weekdayIndex, weekdayName, weekdayOfIso, zoneLabel } from "./startDay";

const base: StageLetterInput = {
  kind: "references",
  firstName: "Rowan",
  roleNames: ["Lead Steward"],
  booking: null,
  followupRole: "Ops",
  finalCallRole: "Visionary",
  anchorCircle: "Anchor Circle",
  referencesOpen: true,
  refineOpen: true,
  statusLink: "https://village.example.test/application-status/op-1?token=t",
  lang: "en",
};

describe("the next-step letters", () => {
  it("one key per application and stage", () => {
    expect(stageLetterKey("op-1", "references")).toBe("open-proposal:op-1:stage:references");
    expect(stageLetterKey("op-1", "final_interview")).not.toBe(stageLetterKey("op-1", "references"));
  });

  it("References and proposal: a bulleted list of steps, the page's link, who acts by role", () => {
    const refs = stageLetter({ ...base, booking: { role: "Community", links: ["https://cal.example.test/c"] } });
    expect(refs.subject).toBe("Next up: your references and your proposal");
    expect(refs.text).toContain("Next step:\nEverything for this step is on your page, one button each: https://village.example.test/application-status/op-1?token=t");
    expect(refs.text).toContain("- Add your references. For each one we need their email, plus a WhatsApp number, a US phone number or a Signal number. Please let them know we'll be in touch.");
    expect(refs.text).toContain("- Keep refining your proposal. You can update it until it goes to the Anchor Circle for review.");
    expect(refs.text).toContain("- Book your conversation with Community: https://cal.example.test/c");
    expect(refs.text).toContain("Who acts next:\nYou, then Ops, who reaches out to your references.");
  });

  it("references already in are never asked again: we say we're about to reach out, and offer an edit while we can", () => {
    const inNow = stageLetter({ ...base, referencesIn: true, referencesEditable: true });
    expect(inNow.text).not.toContain("Add your references");
    expect(inNow.text).toContain("- Your references are in. Ops is about to reach out to them.");
    expect(inNow.text).toContain("- Want to change one? You can edit them on your page until we reach out.");
    // CONTROL: once somebody has reached out, no edit is offered.
    expect(stageLetter({ ...base, referencesIn: true, referencesEditable: false }).text).not.toContain("edit them");
  });

  it("the final conversation: connecting with the source, no presenting, refining continues until the circle", () => {
    const fin = stageLetter({ ...base, kind: "final_interview", booking: { role: "Visionary", links: ["https://cal.example.test/v"] } });
    expect(fin.subject).toBe("Next up: your final conversation with Visionary");
    expect(fin.text).toContain("It's a chance to connect with the source of this village.");
    expect(fin.text).toContain("You won't be presenting it.");
    expect(fin.text).toContain("until it goes to the Anchor Circle for review");
    expect(fin.text).not.toMatch(/fixed/i);
    expect(fin.text).toContain("Next step:\nBook your final conversation with Visionary: https://cal.example.test/v");
  });

  it("Agreement: the anchor circle by its own name accepts or counters, and nothing to book", () => {
    const agr = stageLetter({ ...base, kind: "agreement" });
    expect(agr.subject).toBe("Your proposal is with the Anchor Circle");
    expect(agr.text).toContain("Who acts next:\nThe Anchor Circle.");
    expect(agr.text).toContain("Then you get an email with your start date.");
    expect(stageLetter({ ...base, kind: "agreement", anchorCircle: null }).text).toContain("Who acts next:\nThe circle.");
  });

  it("carries only the booking it is handed: no booking, no link", () => {
    const none = stageLetter({ ...base, booking: null });
    expect(none.text).not.toMatch(/cal\.example\.test/);
    expect(none.text).toContain("- Your next conversation opens on your page when it's ready.");
  });

  it("speaks the applicant's language", () => {
    const es = stageLetter({ ...base, lang: "es", kind: "final_interview", booking: { role: "Visionary", links: ["https://cal.example.test/v"] } });
    expect(es.subject).toBe("Lo que sigue: su conversación final con Visionary");
    expect(es.text.startsWith("Hola Rowan,")).toBe(true);
    expect(es.text).toContain("No tiene que presentarla.");
  });

  it("the refined letter goes with no booking link, only the page", () => {
    const r = stageLetter({ ...base, kind: "refined", booking: { role: "Community", links: ["https://cal.example.test/c"] } });
    expect(r.subject).toBe("Got it: your updated proposal");
    expect(r.text).not.toContain("cal.example.test");
  });
});

describe("the booking button, by role only", () => {
  it("short labels from the village's list, the full name otherwise", () => {
    const raw = "ops-role = Ops\ncommunity-role=Community; final-role = Visionary\n= nothing\nno-equals";
    expect(Array.from(parseRoleShortLabels(raw).entries())).toEqual([["ops-role", "Ops"], ["community-role", "Community"], ["final-role", "Visionary"]]);
    expect(roleShortLabel("ops-role", "Operations Role", raw)).toBe("Ops");
    expect(roleShortLabel("other", "Operations Role", raw)).toBe("Operations Role");
  });

  it("the role's own link first, and no person named", () => {
    const holders = [{ firstName: "Ana", bookingUrl: "https://cal.example.test/ana" }];
    expect(roleBookingFor("Ops", holders, "https://cal.example.test/ops")).toEqual({ label: "Ops", links: [{ who: null, url: "https://cal.example.test/ops" }] });
    // CONTROL: no role link, the holders' links, still unnamed.
    expect(roleBookingFor("Ops", [...holders, { firstName: "Ben", bookingUrl: "https://cal.example.test/ben" }], null).links.map((l) => l.who)).toEqual([null, null]);
    expect(bookingLinksText([{ who: null, url: "https://a.test" }, { who: null, url: "https://b.test" }])).toBe("\n1: https://a.test\n2: https://b.test");
  });
});

describe("the letters already on main, in the same shape (the lead, 27 Nov 2026)", () => {
  it("the invitation: all three calls as a list, the total, only the first one's link, who acts by role", () => {
    const l = invitedLetter({ firstName: "Rowan", village: "V", roleNames: ["Lead Role"], statusLink: null, lang: "en", conversations: [
      { role: "Operations Role", label: "Ops", minutes: 30, bookingLinks: [{ who: null, url: "https://cal.example.test/ops" }] },
      { role: "Community Role", label: "Community", minutes: 30, bookingLinks: [{ who: null, url: "https://cal.example.test/community" }] },
      { role: "Visionary Role", label: "Visionary", minutes: 30, final: true },
    ] });
    expect(l.text).toContain("Your conversations, in order:\n- A conversation with Ops\n- A conversation with Community\n- A final conversation with Visionary\nAbout 90 minutes in all, or longer if needed.");
    expect(l.text).not.toMatch(/30 minutes/);
    expect(l.text).toContain("Next step:\n- Book your first conversation, with Ops: https://cal.example.test/ops");
    expect(l.text).toContain("Who acts next:\nYou book the time. Then Ops meets with you.");
    expect(l.text).not.toContain("cal.example.test/community");
    expect(l.text).not.toContain("decides by consent");
  });

  it("the adoption letters: the start day, the all-hands with its link, who may start them sooner, who acts next", () => {
    const base2 = { firstName: "Rowan", village: "V", roleNames: ["Lead Role"], season: "Season of Roots", startsOn: "1 January 2027", lang: "en" as const, startDay: "Monday 4 January 2027", soonerRole: "Ops", allHands: { when: "Monday at 12:00 Costa Rica time", link: "https://meet.example.test/all-hands" }, flow: true, anchorCircle: "Anchor Circle" };
    for (const l of [adoptedInviteLetter({ ...base2, link: "https://v.example.test/join", days: 14 } as any), adoptedAccountLetter({ ...base2, signIn: "https://v.example.test/profile" } as any)]) {
      expect(l.text).toContain("You start on Monday 4 January 2027.");
      expect(l.text).toContain("If Ops asks you to start sooner, they'll write to you.");
      expect(l.text).toContain("That day, join us for our all-hands meeting, Monday at 12:00 Costa Rica time.\nThe video call: https://meet.example.test/all-hands");
      expect(l.text).toContain("Who acts next:\nYou. Make your profile, and it shows what to align with before you start.");
    }
    // A role still waiting on a seat promises no day.
    expect(adoptedAccountLetter({ ...base2, waitsForSeat: true, signIn: "https://v.example.test/profile" } as any).text).not.toContain("You start on");
    // In the flow the start line is the one statement of when: the headline names no "this moon" or "next season",
    // and "when the season begins" is said only when that is the start day.
    const plain = adoptedAccountLetter({ ...base2, signIn: "https://v.example.test/profile" } as any);
    expect(plain.subject).toBe("The Anchor Circle accepted your proposal");
    expect(plain.text).toContain("The Anchor Circle accepted your proposal to hold Lead Role.");
    expect(plain.text).not.toContain("Your roles start when Season of Roots begins");
    expect(plain.text).toContain("Sign in with this address to see your roles.\nhttps://v.example.test/profile");
    expect(adoptedAccountLetter({ ...base2, seasonSameDay: true, signIn: "https://v.example.test/profile" } as any).text).toContain("Your roles start when Season of Roots begins, on 1 January 2027.");
  });

  it("START NOW (e2e round 3, B2): the roles start today, no 'start sooner' is said, and the all-hands is the next one by its own date", () => {
    const base3 = { firstName: "Rowan", village: "V", roleNames: ["Lead Role"], season: null, startsOn: "28 November 2026", moon: { from: "28 November 2026", to: "9 December 2026" }, flow: true, startToday: true, startDay: "Saturday 28 November 2026", soonerRole: null, allHands: { when: "Monday 30 November 2026 at 12:00 Costa Rica time", link: "https://meet.example.test/all-hands" } };
    for (const lang of ["en", "es"] as const) {
      for (const l of [adoptedInviteLetter({ ...base3, lang, link: "https://v.example.test/join", days: 14 } as any), adoptedAccountLetter({ ...base3, lang, signIn: "https://v.example.test/profile" } as any)]) {
        expect(l.text).toContain(lang === "en" ? "Your roles start today, Saturday 28 November 2026." : "Sus roles empiezan hoy, Saturday 28 November 2026.");
        expect(l.text).toContain(lang === "en" ? "Join us for our next all-hands meeting, Monday 30 November 2026 at 12:00 Costa Rica time.\nThe video call: https://meet.example.test/all-hands" : "Acompáñenos en nuestra próxima reunión general, Monday 30 November 2026 at 12:00 Costa Rica time.");
        expect(l.text).not.toMatch(/start sooner|empezar antes/);
        expect(l.text).not.toMatch(/You start on|Usted empieza el|That day|Ese día/);
      }
    }
  });

  it("OUTSIDE THE CONVERSATION FLOW (e2e round 3, B3): the letter and its subject are the ones production sends, word for word", () => {
    // Production's own letter for a moon role adopted onto an account (fold-qa e2e-r3, s7-noconversation-role-PROD.json).
    const l = adoptedAccountLetter({
      firstName: "Wren", village: "Unnamed Village", roleNames: ["Compost Steward"], season: "Season of Seeds", startsOn: "28 November 2026",
      moon: { from: "28 November 2026", to: "9 December 2026" }, lang: "en", signIn: "http://127.0.0.1:3298/profile", loveLetter: "http://127.0.0.1:3298/love-letter",
      // What the flow would add is ignored without `flow`: no start day, no all-hands, no buddy, no page, no circle's name.
      startDay: "Monday 30 November 2026", soonerRole: "Ops", allHands: { when: "Monday at 12:00", link: null }, buddy: { name: "Iva", role: "Ops" }, statusLink: "http://127.0.0.1:3298/application-status/x", anchorCircle: "Anchor Circle",
    } as any);
    expect(l.subject).toBe("Unnamed Village said yes to your proposal");
    expect(l.text).toBe("Hi Wren,\n\nUnnamed Village said yes to your proposal to hold Compost Steward this moon.\n\nSign in with this address to see your roles. Your roles run from 28 November 2026 to the next new moon, 9 December 2026.\nhttp://127.0.0.1:3298/profile\n\nWhat comes next:\n1. Sign in with this address.\n2. Your profile lists any agreements we ask you to align with before your role starts, such as our confidentiality agreement and your role's terms. Each one has its own door there.\n3. Once your role starts, your profile shows your first days with us, step by step.\n\nBefore you take the role, align with the Love Letter, the village's membership agreement. Aligning with it makes you a member, with a voice in the village's decisions:\nhttp://127.0.0.1:3298/love-letter\n");
    // A reviewed application outside the flow keeps the older welcome too.
    const reviewed = adoptedAccountLetter({ firstName: "Wren", village: "V", roleNames: ["Compost Steward"], season: null, startsOn: "x", lang: "en", signIn: "https://v.example.test/profile", reviewed: true, anchorCircle: "Anchor Circle" } as any);
    expect(reviewed.text).toContain("The circle has consented: we would love you to hold Compost Steward in V. Welcome.");
    const invite = adoptedInviteLetter({ firstName: "Wren", village: "V", roleNames: ["Compost Steward"], season: "Season of Roots", startsOn: "1 January 2027", lang: "en", link: "https://v.example.test/join", days: 14, anchorCircle: "Anchor Circle" } as any);
    expect(invite.subject).toBe("V said yes to your proposal");
    expect(invite.text).toContain("1. Create your profile with the button above.");
    expect(invite.text).not.toContain("Who acts next");
  });

  it("the closed letter: a list of ways to stay close, and who acts next", () => {
    const c = closedLetter({ firstName: "Rowan", village: "V", roleNames: ["Lead Role"], site: "https://v.example.test", team: "Ops", statusLink: null, lang: "en" });
    expect(c.text).toContain("Next step:\nNothing more to do. If you'd like to stay close:\n- Take a quest: https://v.example.test/quests\n- Apply again whenever a role calls to you.");
    expect(c.text).toContain("Who acts next:\nYou, if you choose to apply again.");
    expect(closedLetter({ firstName: null, village: "V", roleNames: [], site: "https://v.example.test", team: "Ops", statusLink: null, lang: "es" }).text).toContain("Quién actúa ahora:");
  });

  it("the profile says the page's 'below' as the application's page", () => {
    expect(sayOnProfile("en", "Book your conversation with Ops below.")).toBe("Book your conversation with Ops on your application's page.");
    expect(sayOnProfile("es", "Reserve abajo su conversación.")).toBe("Reserve en la página de su postulación su conversación.");
  });
});

describe("the start day (the lead, 27 Nov 2026: accepted Friday, start Monday, after the season begins)", () => {
  it("is the first all-hands weekday after the acceptance, and never before the role starts", () => {
    // Accepted Friday 27 Nov 2026, season already begun: Monday 30 Nov.
    expect(startDayOf("2026-11-01", "2026-11-27", 1)).toBe("2026-11-30");
    // Accepted on a Monday: the next Monday, never the same day.
    expect(startDayOf(null, "2026-11-30", 1)).toBe("2026-12-07");
    // The season starts later: the first Monday on or after its first day.
    expect(startDayOf("2027-01-01", "2026-11-27", 1)).toBe("2027-01-04");
    expect(startDayOf("2027-01-04", "2026-11-27", 1)).toBe("2027-01-04");
  });
  it("RULING 8: on or after the NEXT season's start in every term mode; with start now, the day it is adopted and the next all-hands; and says which rule", () => {
    // QA pass 1: a moon-term village got Monday 30 November when the next season begins Monday 21 December.
    const seasons = ["2026-09-21", "2026-12-21", "2027-03-20"];
    expect(startOf({ acceptedIso: "2026-11-27", weekday: 1, seasonStarts: seasons, startNow: false })).toEqual({ iso: "2026-12-21", rule: "next_season", allHandsIso: "2026-12-21" });
    // Start now (e2e round 3, B2): the role starts the day it is adopted, a Friday here, and the all-hands is the NEXT one.
    expect(startOf({ acceptedIso: "2026-11-27", weekday: 1, seasonStarts: seasons, startNow: true })).toEqual({ iso: "2026-11-27", rule: "start_now", allHandsIso: "2026-11-30" });
    // Adopted on the all-hands day itself: that day's all-hands is the next one.
    expect(startOf({ acceptedIso: "2026-11-30", weekday: 1, seasonStarts: seasons, startNow: true })).toEqual({ iso: "2026-11-30", rule: "start_now", allHandsIso: "2026-11-30" });
    expect(startOf({ acceptedIso: "2026-11-27", weekday: 1, seasonStarts: [], startNow: false })).toEqual({ iso: "2026-11-30", rule: "no_season", allHandsIso: "2026-11-30" });
    // A season starting on a Wednesday: the first Monday on or after it.
    expect(startOf({ acceptedIso: "2026-11-27", weekday: 1, seasonStarts: ["2026-12-23"], startNow: false }).iso).toBe("2026-12-28");
    expect(START_RULE_WORDS.next_season("Monday")).toBe("the first Monday on or after the next season begins");
    expect(START_RULE_WORDS.start_now("Monday")).toContain("because Ops chose to start now");
  });
  it("B1 (e2e round 3): adopted on either of a moon's last two days, the start day is a real all-hands day, and its weekday is the date's own", () => {
    // The moon of 9 November to 9 December 2026, whose last all-hands (a Monday) is 7 December. The next season begins 21 December.
    const seasons = ["2026-09-21", "2026-12-21", "2027-03-20"];
    for (const accepted of ["2026-12-08", "2026-12-09"]) {
      const day = startOf({ acceptedIso: accepted, weekday: 1, seasonStarts: seasons, startNow: false });
      expect(day).toEqual({ iso: "2026-12-21", rule: "next_season", allHandsIso: "2026-12-21" });
      // Never the acceptance day, and never the moon's last day.
      expect(day.iso).not.toBe(accepted);
      expect(weekdayOfIso(day.iso)).toBe(1);
      expect(`${weekdayName(weekdayOfIso(day.iso), "en")} ${day.iso}`).toBe("Monday 2026-12-21");
      // With start now the role starts that day, a Tuesday and a Wednesday, and the all-hands is the next Monday by the calendar.
      const now = startOf({ acceptedIso: accepted, weekday: 1, seasonStarts: seasons, startNow: true });
      expect(now).toEqual({ iso: accepted, rule: "start_now", allHandsIso: "2026-12-14" });
      expect(weekdayName(weekdayOfIso(now.iso), "en")).toBe(accepted === "2026-12-08" ? "Tuesday" : "Wednesday");
    }
    // The round's own case: Saturday 28 November 2026 is never called a Monday.
    expect(weekdayName(weekdayOfIso("2026-11-28"), "en")).toBe("Saturday");
    expect(allHandsOnOrAfter("2026-11-28", 1)).toBe("2026-11-30");
  });
  it("reads the village's weekday and zone, in the applicant's language", () => {
    expect(weekdayIndex("Monday")).toBe(1);
    expect(weekdayIndex("jueves")).toBe(4);
    expect(weekdayIndex("nonsense")).toBe(1);
    expect(weekdayName(1, "es")).toBe("lunes");
    expect(zoneLabel("America/Costa_Rica", "en")).toBe("Costa Rica time");
    expect(zoneLabel("America/Costa_Rica", "es")).toBe("hora de Costa Rica");
  });
});
