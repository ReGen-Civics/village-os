// @vitest-environment jsdom
/**
 * THE WAYS IN (the lead, 20 Nov 2026), on /propose-a-role:
 *
 *   - a coming-soon role keeps its waitlist first, and "Apply early" opens the form; a draft this device kept for it
 *     is untouched until then, and read back (never cleared or rewritten) once they apply early
 *   - "Start a conversation": name, email, a link, a few lines and the roles, sent through the same door with
 *     `kind: "conversation"`, then the same "Check your email" threshold
 *
 * server/routes/openProposals.comingSoon.test.ts proves the server's side.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { draftKey } from "@/components/fireflyPath/applyDraft";
import { SETUP } from "@/test/proposeStones";

vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/contexts/AuthContext", () => ({ useOptionalAuth: () => ({ user: null }) }));

import ProposeARole from "./ProposeARole";

const FORM = {
  open: true,
  village: "Test Village",
  season: { id: "s-next", name: "Season of Roots", startsOn: "2099-01-01" },
  goals: [],
  roles: [
    { id: "r-gate", name: "Gate Keeper", circle: "Anchor Circle", aim: "Open the gate at dawn.", comingSoon: true, opensLater: true },
    { id: "r-host", name: "Welcome Host", circle: "Anchor Circle", aim: "Meet every newcomer." },
    { id: "r-full", name: "Full Role", circle: "Anchor Circle", aim: null, held: true },
  ],
  founding: SETUP,
};

let posted: any[] = [];
function serve(answer: { status: number; body: unknown } = { status: 200, body: { sent: true, replyDays: 7 } }) {
  posted = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        posted.push({ url, body: JSON.parse(String(init.body)) });
        return new Response(JSON.stringify(answer.body), { status: answer.status, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify(FORM), { status: 200, headers: { "content-type": "application/json" } });
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.history.pushState({}, "", "/");
});

describe("a coming-soon role: the waitlist first, and an early application", () => {
  it("offers Apply early after the waitlist; pressing it opens the form with the lead's words and reads the kept draft back unchanged", async () => {
    const kept = JSON.stringify({ savedAt: new Date().toISOString(), step: 0, reached: 1, knowUs: [], why: "Kept from before" });
    window.localStorage.setItem(draftKey("r-gate", ""), kept);
    window.history.pushState({}, "", "/propose-a-role?role=r-gate");
    serve();
    render(<ProposeARole />);
    await screen.findByRole("heading", { level: 1, name: "Gate Keeper is not open yet" });
    const offer = document.querySelector("[data-role-not-open]") as HTMLElement;
    // The waitlist first, then the early way.
    expect(Array.from(offer.querySelectorAll("a, button")).map((e) => e.textContent?.trim()).slice(0, 2)).toEqual(["Join the waitlist for Gate Keeper", "Apply early for Gate Keeper"]);
    expect(offer.textContent).toContain("We may not get back to you, and the card details may change, but if you're feeling inspired, go ahead.");
    expect(window.localStorage.getItem(draftKey("r-gate", ""))).toBe(kept);
    fireEvent.click(screen.getByRole("button", { name: "Apply early for Gate Keeper" }));
    expect(await screen.findByRole("heading", { level: 1, name: /^Apply: Gate Keeper/ })).toBeTruthy();
    expect(document.querySelector("[data-early-application]")?.textContent).toMatch(/apply early if you feel/);
    // The draft is read back into the form, never cleared.
    await waitFor(() => expect((document.getElementById("propose-why") as HTMLTextAreaElement).value).toBe("Kept from before"));
    expect(window.localStorage.getItem(draftKey("r-gate", ""))).toContain("Kept from before");
  });

  it("a card's Apply early link (?early=1) opens the form straight away", async () => {
    window.history.pushState({}, "", "/propose-a-role?role=r-gate&early=1");
    serve();
    render(<ProposeARole />);
    expect(await screen.findByRole("heading", { level: 1, name: /^Apply: Gate Keeper/ })).toBeTruthy();
    expect(document.querySelector("[data-role-not-open]")).toBeNull();
  });
});

describe("start a conversation (idea 14)", () => {
  it("sends name, email, a link, a few lines and the roles as a conversation, then asks them to check their email", async () => {
    window.history.pushState({}, "", "/propose-a-role?role=r-host&way=talk");
    serve();
    render(<ProposeARole />);
    expect(await screen.findByRole("heading", { level: 1, name: "Start a conversation" })).toBeTruthy();
    // A held role is not offered; the card's role starts chosen.
    expect(document.querySelector('[data-talk-role="r-full"]')).toBeNull();
    expect((document.querySelector('[data-talk-role="r-host"]') as HTMLInputElement).checked).toBe(true);
    // Nothing goes without a few lines on why.
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Rowan" } });
    fireEvent.change(screen.getByLabelText("Your email"), { target: { value: "rowan@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(posted).toHaveLength(0);
    expect(document.querySelector('[data-talk-problem="why"]')).toBeTruthy();
    fireEvent.change(screen.getByLabelText("A link to your work (optional)"), { target: { value: "https://example.test/rowan" } });
    fireEvent.change(screen.getByLabelText("Why you, and why this role, in a few lines"), { target: { value: "Ten years welcoming people." } });
    fireEvent.click(document.querySelector('[data-talk-role="r-gate"]') as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeTruthy();
    expect(posted).toHaveLength(1);
    expect(posted[0].body).toMatchObject({
      kind: "conversation",
      name: "Rowan",
      email: "rowan@example.test",
      why: "Ten years welcoming people.",
      roles: [{ roleId: "r-host", note: "" }, { roleId: "r-gate", note: "" }],
      links: [{ label: "My work", url: "https://example.test/rowan" }],
    });
    // Nothing of the full application rides along.
    expect(posted[0].body.card).toBeUndefined();
  });

  it("says a problem under the field it names, where focus goes, and marks a role not open yet (applicant QA, 20 Nov 2026)", async () => {
    window.history.pushState({}, "", "/propose-a-role?role=r-host&way=talk");
    serve();
    render(<ProposeARole />);
    await screen.findByRole("heading", { level: 1, name: "Start a conversation" });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    const name = screen.getByLabelText("Your name");
    const line = document.querySelector('[data-talk-problem="name"]') as HTMLElement;
    expect(document.activeElement).toBe(name);
    // Beside the box, under its label: the box's own parent holds the line.
    expect(name.parentElement!.contains(line)).toBe(true);
    expect(name.getAttribute("aria-describedby")).toBe(line.id);
    // The coming-soon role is offered, and said to be not open yet; an open one is not marked (control).
    expect(document.querySelector('[data-talk-role-soon="r-gate"]')?.textContent).toBe("Not open yet. Choosing it makes this an early application.");
    expect(document.querySelector('[data-talk-role-soon="r-host"]')).toBeNull();
  });

  it("the apply form offers the short way, and the short way leads back to the full form", async () => {
    window.history.pushState({}, "", "/propose-a-role?role=r-host");
    serve();
    render(<ProposeARole />);
    await screen.findByRole("heading", { level: 1, name: /^Apply: Welcome Host/ });
    fireEvent.click(screen.getByRole("button", { name: "Short on time? Start a conversation" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Start a conversation" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Fill in the full application instead" }));
    expect(await screen.findByRole("heading", { level: 1, name: /^Apply: Welcome Host/ })).toBeTruthy();
  });
});
