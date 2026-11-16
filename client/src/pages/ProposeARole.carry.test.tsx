// @vitest-environment jsdom
/**
 * A SECOND APPLICATION CARRIES OVER THE FIRST (Rye, 15 Nov 2026, from the Spanish phone QA,
 * P1-1). One application is for one role; somebody taking two fills the form twice, and the
 * second starts from what they wrote about themselves in the first, with a line saying so.
 * The role's own answers, the price ask, references, consent and recordings start fresh
 * (components/fireflyPath/applyCarry.ts).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OPEN_WORDS } from "@shared/openProposals";
import { draftKey } from "@/components/fireflyPath/applyDraft";
import { carryKey } from "@/components/fireflyPath/applyCarry";
import { isKeptKey } from "@/lib/deviceReset";

import { SETUP, fillValue, pressNext, sendNow, stoneNow } from "@/test/proposeStones";

vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/contexts/AuthContext", () => ({ useOptionalAuth: () => ({ user: null }) }));

import ProposeARole from "./ProposeARole";

const FORM = {
  open: true,
  village: "Test Village",
  season: { id: "s-next", name: "Season of Roots", startsOn: "2099-01-01" },
  goals: [{ id: "g-team", text: "Build the team that can build the village" }],
  roles: [
    { id: "r-gate", name: "Gate Keeper", circle: "Anchor Circle", aim: "Open the gate at dawn." },
    { id: "r-host", name: "Welcome Host", circle: "Anchor Circle", aim: "Meet every newcomer." },
  ],
  founding: SETUP,
};
const LETTER = { version: "lv-0123456789abcdef", title: "Membership agreement", body: "Dear friend, welcome home.", intent: "I align with the Membership agreement.", parts: {} };

let posted: any[] = [];
function serve(form: unknown = FORM) {
  posted = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
      if (init?.method === "POST") {
        const multipart = init.body instanceof FormData ? init.body : null;
        posted.push(JSON.parse(String(multipart ? multipart.get("proposal") : init.body)));
        return json({ sent: true });
      }
      if (String(url).startsWith("/api/membership-letter")) return json(LETTER);
      if (String(url).startsWith("/api/profile/alignments")) return json({ alignments: [] });
      return json(form);
    }),
  );
}

const applyFor = async (id: string, form: unknown = FORM) => {
  window.history.pushState({}, "", `/propose-a-role?role=${id}`);
  serve(form);
  render(<ProposeARole />);
  await screen.findByRole("heading", { level: 1, name: /^Apply: / });
};
const value = (label: string | RegExp) => (screen.getByLabelText(label) as HTMLInputElement).value;

/** The first application, whole: their own words, the background-check consent, the role's answers and its commitment, then Send. */
const tickRemember = () => fireEvent.click(screen.getByLabelText("Remember my answers on this device"));

async function sendFirst(form: unknown = FORM, { remember = true }: { remember?: boolean } = {}) {
  await applyFor("r-gate", form);
  if (remember) tickRemember();
  pressNext();
  fireEvent.change(screen.getByLabelText(OPEN_WORDS.nameLabel), { target: { value: "Rowan" } });
  fireEvent.change(screen.getByLabelText(OPEN_WORDS.emailLabel), { target: { value: "rowan@example.test" } });
  fireEvent.change(screen.getByLabelText(OPEN_WORDS.whyLabel), { target: { value: "The gate is always shut." } });
  fireEvent.change(screen.getByLabelText(/Where you are based/), { target: { value: "San José" } });
  fireEvent.click(screen.getByLabelText(/agree to the background check/i));
  fireEvent.change(screen.getByLabelText(OPEN_WORDS.aimLabel), { target: { value: "The gate opens at dawn." } });
  fillValue();
  fireEvent.change(screen.getByLabelText("Your commitment"), { target: { value: "50" } });
  fireEvent.click(await screen.findByLabelText(LETTER.intent));
  fireEvent.click(screen.getByLabelText(/confidentiality agreement before I see/));
  sendNow();
  await screen.findByRole("heading", { name: "Check your email" });
  expect(posted).toHaveLength(1);
}

/** What the second application must start with, and what it must not. */
async function expectCarried() {
  expect((await screen.findByText(/earlier application/)).closest("[data-carried-over]")?.textContent).toMatch(/Change anything you like/);
  expect(document.querySelector("[data-draft-restored]")).toBeNull();
  expect(stoneNow()).toBe("know");
  expect(value(OPEN_WORDS.nameLabel)).toBe("Rowan");
  expect(value(OPEN_WORDS.emailLabel)).toBe("rowan@example.test");
  expect(value(/Where you are based/)).toBe("San José");
  expect((document.querySelector('[data-role-card] input[id$="-0-title"]') as HTMLInputElement).value).toBe("Open the gate each dawn");
  // The role's own answers, references, consent and the price start fresh.
  expect(value(OPEN_WORDS.whyLabel)).toBe("");
  expect(value(OPEN_WORDS.aimLabel)).toBe("");
  expect(value("Reference 1: name")).toBe("");
  expect((screen.getByLabelText(/agree to the background check/i) as HTMLInputElement).checked).toBe(false);
  expect(value("Your commitment")).toBe("");
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.history.pushState({}, "", "/");
});

describe("a second application", () => {
  it("from the sent screen: a door to another role, which opens with their own words and this role's answers blank", async () => {
    await sendFirst();
    fireEvent.click(screen.getByRole("button", { name: "Apply for another role too" }));
    expect(await screen.findByRole("heading", { level: 1, name: OPEN_WORDS.chooseHeading })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Apply: Welcome Host/ }));
    await screen.findByRole("heading", { level: 1, name: OPEN_WORDS.heading("Welcome Host") });
    await expectCarried();
  });

  it("on a later visit, from a card's Apply link: the same words, kept on the device without the reference or the consent", async () => {
    await sendFirst();
    const kept = window.localStorage.getItem(carryKey("")) ?? "";
    expect(kept).toContain("rowan@example.test");
    expect(kept).toContain("San José");
    expect(kept).not.toMatch(/consent|references|The gate is always shut|The gate opens at dawn|payAsk|commitment/);
    cleanup();
    await applyFor("r-host");
    await expectCarried();
  });

  it("a role's own saved draft wins over the carried words", async () => {
    await sendFirst();
    cleanup();
    await applyFor("r-host");
    pressNext();
    fireEvent.change(screen.getByLabelText(OPEN_WORDS.whyLabel), { target: { value: "I greet people well." } });
    expect(window.localStorage.getItem(draftKey("r-host", ""))).toContain("I greet people well.");
    cleanup();
    await applyFor("r-host");
    expect(await screen.findByText(/We kept your answers from last time/)).toBeTruthy();
    expect(document.querySelector("[data-carried-over]")).toBeNull();
    expect(value(OPEN_WORDS.whyLabel)).toBe("I greet people well.");
  });

  it("nothing carries before an application is sent, and the first one opens blank", async () => {
    await applyFor("r-gate");
    pressNext();
    fireEvent.change(screen.getByLabelText(OPEN_WORDS.nameLabel), { target: { value: "Rowan" } });
    expect(window.localStorage.getItem(carryKey(""))).toBeNull();
    cleanup();
    await applyFor("r-host");
    expect(document.querySelector("[data-carried-over]")).toBeNull();
    expect(value(OPEN_WORDS.nameLabel)).toBe("");
  });

  it("without the tick, nothing is kept on this device, and the door to another role still carries their words in the page", async () => {
    await sendFirst(FORM, { remember: false });
    expect(Object.keys(window.localStorage).filter((k) => k.startsWith("apply-"))).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Apply for another role too" }));
    fireEvent.click(await screen.findByRole("button", { name: /Apply: Welcome Host/ }));
    await screen.findByRole("heading", { level: 1, name: OPEN_WORDS.heading("Welcome Host") });
    await expectCarried();
    expect(Object.keys(window.localStorage).filter((k) => k.startsWith("apply-"))).toEqual([]);
  });

  it("forgetting clears every draft and carried answer on this device, and a later visit opens blank", async () => {
    await sendFirst();
    cleanup();
    await applyFor("r-host");
    // What this device already keeps reads as ticked, so they can see it and forget it.
    await waitFor(() => expect((screen.getByLabelText("Remember my answers on this device") as HTMLInputElement).checked).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Forget my answers on this device" }));
    expect(Object.keys(window.localStorage).filter((k) => k.startsWith("apply-"))).toEqual([]);
    expect((screen.getByLabelText("Remember my answers on this device") as HTMLInputElement).checked).toBe(false);
    cleanup();
    await applyFor("r-host");
    expect(document.querySelector("[data-carried-over]")).toBeNull();
    expect(value(OPEN_WORDS.nameLabel)).toBe("");
  });

  it("with only one role on offer, the sent screen has no door to another", async () => {
    await sendFirst({ ...FORM, roles: [FORM.roles[0]] });
    expect(screen.queryByRole("button", { name: "Apply for another role too" })).toBeNull();
  });

  it("/reset keeps the carried words, as it keeps every draft", () => {
    expect(isKeptKey(carryKey(""))).toBe(true);
    expect(isKeptKey(carryKey("abc"))).toBe(true);
  });
});
