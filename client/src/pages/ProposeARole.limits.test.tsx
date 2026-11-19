// @vitest-environment jsdom
/**
 * ROOM FOR EIGHT MINUTES OF TALKING, SHOWN AND NEVER CUT (the ops request of 19 Nov 2026), on the page itself:
 * the explainer at the top, the count and the notices under "Why you, and why now", an answer over its limit kept
 * whole and holding the send with how much to trim, and a long answer under the limit sent whole.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OPEN_WHY_MAX, OPEN_WORDS } from "@shared/openProposals";
import { SETUP, fillValue, pressNext, sendNow, stoneNow } from "@/test/proposeStones";

vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/contexts/AuthContext", () => ({ useOptionalAuth: () => ({ user: null }) }));

import ProposeARole from "./ProposeARole";

const FORM = {
  open: true,
  village: "Test Village",
  season: { id: "s-next", name: "Season of Roots", startsOn: "2099-01-01" },
  goals: [{ id: "g-team", text: "Build the team" }],
  roles: [{ id: "r-gate", name: "Gate Keeper", circle: "Anchor Circle", aim: "Open the gate at dawn." }],
  founding: SETUP,
};
const LETTER = { version: "lv-0123456789abcdef", title: "Membership agreement", body: "Dear friend, welcome home.", intent: "I align with the Membership agreement.", parts: {} };

let posted: Array<{ body: unknown }> = [];
function serve() {
  posted = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        posted.push({ body: init.body });
        return new Response(JSON.stringify({ sent: true }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (String(url).startsWith("/api/membership-letter")) return new Response(JSON.stringify(LETTER), { status: 200 });
      if (String(url).startsWith("/api/profile/alignments")) return new Response(JSON.stringify({ alignments: [] }), { status: 200 });
      return new Response(JSON.stringify(FORM), { status: 200 });
    }),
  );
}

const open = async () => {
  window.history.pushState({}, "", "/propose-a-role?role=r-gate");
  serve();
  render(<ProposeARole />);
  await screen.findByRole("heading", { level: 1, name: /^Apply: / });
};
const whyBox = () => screen.getByLabelText(OPEN_WORDS.whyLabel) as HTMLTextAreaElement;
const whySigns = () => whyBox().closest("div")?.parentElement?.querySelector("[data-limit-signs]") as HTMLElement | null;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
  window.history.pushState({}, "", "/");
});

describe("the application's limits, on the page", () => {
  it("says once near the top how the limits work", async () => {
    await open();
    const top = document.querySelector("[data-limits-at-top]");
    expect(top?.textContent).toContain("about seven minutes of talking in each");
    fireEvent.click(screen.getByRole("button", { name: "How the limits work" }));
    await waitFor(() => expect(document.querySelector("[data-limits-at-top] [data-limits-explained]")).not.toBeNull());
    const words = document.querySelector("[data-limits-at-top] [data-limits-explained]")?.textContent ?? "";
    expect(words).toContain(`"Why you, and why now" holds 8,000`);
    expect(words).toContain("One recording runs up to 15 minutes.");
    expect(words).toContain("a send can take several minutes on a slow connection");
  });

  it("Why you, and why now: 8,000 characters, the count always, the notice at 80% and the stronger one at 95%", async () => {
    await open();
    expect(OPEN_WHY_MAX).toBe(8000);
    expect(whyBox().maxLength).toBe(-1);
    expect(whySigns()?.querySelector("[data-character-count]")?.textContent).toBe("0 / 8,000");
    fireEvent.change(whyBox(), { target: { value: "w".repeat(6400) } });
    expect(whySigns()?.dataset.limitSigns).toBe("near");
    expect(whySigns()?.querySelector("[data-limit-notice]")?.textContent).toBe("About 1½ minutes of talking left in this answer.");
    fireEvent.change(whyBox(), { target: { value: "w".repeat(7700) } });
    expect(whySigns()?.dataset.limitSigns).toBe("nearer");
    expect(whySigns()?.querySelector("[data-limit-notice]")?.textContent).toBe("Nearly full: 300 characters left.");
  });

  it("an answer over its limit is kept whole and holds the send, saying how much to trim", async () => {
    await open();
    fireEvent.change(screen.getByLabelText(OPEN_WORDS.nameLabel), { target: { value: "Rowan" } });
    fireEvent.change(screen.getByLabelText(OPEN_WORDS.emailLabel), { target: { value: "rowan@example.test" } });
    const long = "w".repeat(OPEN_WHY_MAX + 240);
    fireEvent.change(whyBox(), { target: { value: long } });
    // Every character is still in the box, and the box says so.
    expect(whyBox().value).toBe(long);
    expect(whySigns()?.dataset.limitSigns).toBe("over");
    expect(whySigns()?.querySelector("[data-limit-notice]")?.textContent).toBe("240 characters over the limit. Trim 240 characters to send. Everything you wrote is kept.");
    // Continue on About you holds, and names the box and the trim.
    while (stoneNow() !== "about") pressNext();
    pressNext();
    expect(stoneNow()).toBe("about");
    const said = document.getElementById("propose-problem-why")?.textContent ?? "";
    expect(said).toBe("Why you, and why now: 240 characters over the limit. Trim 240 characters to send. Everything you wrote is kept.");
    expect(whyBox().value).toBe(long);
    expect(posted).toHaveLength(0);
  });

  it("a long answer inside the limit goes whole", async () => {
    await open();
    fireEvent.change(screen.getByLabelText(OPEN_WORDS.nameLabel), { target: { value: "Rowan" } });
    fireEvent.change(screen.getByLabelText(OPEN_WORDS.emailLabel), { target: { value: "rowan@example.test" } });
    const why = ["What I have built before:", "Why this role:", "Why now:", "What I would bring in my first month:"].map((p) => `${p} ${"word ".repeat(380)}`).join("\n\n").trim();
    expect(why.length).toBeGreaterThan(4000);
    expect(why.length).toBeLessThanOrEqual(OPEN_WHY_MAX);
    fireEvent.change(whyBox(), { target: { value: why } });
    fireEvent.click(screen.getByLabelText(/agree to the background check/i));
    fireEvent.change(screen.getByLabelText(OPEN_WORDS.aimLabel), { target: { value: "The gate opens at dawn." } });
    fillValue();
    fireEvent.change(screen.getByLabelText("Your commitment"), { target: { value: "50" } });
    fireEvent.click(await screen.findByLabelText(LETTER.intent));
    fireEvent.click(screen.getByLabelText(/confidentiality agreement before I see/));
    sendNow();
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(JSON.parse(String(posted[0].body)).why).toBe(why);
  });
});
