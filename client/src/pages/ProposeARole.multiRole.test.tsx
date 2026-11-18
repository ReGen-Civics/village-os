// @vitest-environment jsdom
/**
 * SEVERAL ROLES IN ONE APPLICATION (the lead, 17 Nov 2026, confirmed 18 Nov): the Apply link starts with its role,
 * the applicant may add more from any circle on The terms, each with its own commitment, price and split, and the
 * total across roles is shown (components/fireflyPath/MoreRoles.tsx).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OPEN_WORDS } from "@shared/openProposals";

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
    { id: "r-gate", name: "Gate Keeper", circle: "Anchor Circle", aim: "Open the gate at dawn.", payCeiling: { amount: 6000, currency: "USD", per: "month" } },
    { id: "r-host", name: "Welcome Host", circle: "Land Circle", aim: "Meet every newcomer.", commitmentMin: 30, payCeiling: { amount: 4000, currency: "USD", per: "month" } },
    { id: "r-well", name: "Well Keeper", circle: "Land Circle", aim: "Keep the well clean." },
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

/** Everything one role needs, up to The terms: their own words, the background-check consent and one value item. */
async function fillToTerms(path: string) {
  window.history.pushState({}, "", path);
  serve();
  render(<ProposeARole />);
  await screen.findByRole("heading", { level: 1, name: /^Apply: / });
  pressNext();
  fireEvent.change(screen.getByLabelText(OPEN_WORDS.nameLabel), { target: { value: "Rowan" } });
  fireEvent.change(screen.getByLabelText(OPEN_WORDS.emailLabel), { target: { value: "rowan@example.test" } });
  fireEvent.change(screen.getByLabelText(OPEN_WORDS.whyLabel), { target: { value: "The gate is always shut." } });
  fireEvent.change(screen.getByLabelText(/Where you are based/), { target: { value: "San José" } });
  fireEvent.click(screen.getByLabelText(/agree to the background check/i));
  fireEvent.change(screen.getByLabelText(OPEN_WORDS.aimLabel), { target: { value: "The gate opens at dawn." } });
  fillValue();
}

async function agreeAndSend() {
  fireEvent.click(await screen.findByLabelText(LETTER.intent));
  fireEvent.click(screen.getByLabelText(/confidentiality agreement before I see/));
  sendNow();
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.history.pushState({}, "", "/");
});

describe("several roles in one application (the lead, 17 Nov 2026)", () => {
  it("adds a role from another circle on The terms, with its own commitment, shows the total, and sends each role's terms", async () => {
    await fillToTerms("/propose-a-role?role=r-gate");
    const add = (await screen.findByLabelText("Add another role")) as HTMLSelectElement;
    // Any circle, never the role already chosen.
    expect(Array.from(add.options).map((o) => o.value)).toEqual(["", "r-host", "r-well"]);
    fireEvent.change(add, { target: { value: "r-host" } });
    fireEvent.change(await screen.findByLabelText("Your commitment: Gate Keeper"), { target: { value: "50" } });
    const host = screen.getByLabelText("Your commitment: Welcome Host") as HTMLSelectElement;
    // The added role offers its own range: from its minimum.
    expect(Array.from(host.options).map((o) => o.value)).toEqual(["", "30", "40", "50", "60", "70", "80", "90", "100"]);
    fireEvent.change(host, { target: { value: "40" } });
    // The prices add up: 50% of 6000 and 40% of 4000.
    await waitFor(() => expect(document.querySelector("[data-roles-total]")?.textContent).toMatch(/2 roles: 90% commitment in all, and \$4,600 a month together/));
    await agreeAndSend();
    await screen.findByRole("heading", { name: "Check your email" });
    expect(posted).toHaveLength(1);
    expect(posted[0].roles).toEqual([{ roleId: "r-gate", note: "" }, { roleId: "r-host", note: "", commitmentPct: 40 }]);
    expect(posted[0].card.commitmentPct).toBe(50);
  });

  it("a link naming two roles starts with both, and an added role with no commitment holds the send on The terms", async () => {
    await fillToTerms("/propose-a-role?role=r-gate&role=r-well");
    expect(await screen.findByLabelText("Your commitment: Well Keeper")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Your commitment: Gate Keeper"), { target: { value: "50" } });
    await agreeAndSend();
    await waitFor(() => expect(stoneNow()).toBe("terms"));
    expect(posted).toHaveLength(0);
    expect(document.querySelector('[data-more-role="1"]')?.textContent).toContain(OPEN_WORDS.needRoleCommitment);
    // Removing it lets one role go on alone.
    fireEvent.click(screen.getByRole("button", { name: "Remove Well Keeper" }));
    expect(screen.queryByLabelText("Your commitment: Well Keeper")).toBeNull();
    expect(screen.getByLabelText("Your commitment")).toBeTruthy();
  });

  it("ticked to remember, a reload comes back with the role added and its commitment (the lead, 18 Nov 2026)", async () => {
    await fillToTerms("/propose-a-role?role=r-gate");
    fireEvent.click(screen.getByLabelText("Remember my answers on this device"));
    fireEvent.change(await screen.findByLabelText("Add another role"), { target: { value: "r-host" } });
    fireEvent.change(await screen.findByLabelText("Your commitment: Welcome Host"), { target: { value: "40" } });
    await waitFor(() => expect(JSON.stringify(Object.values({ ...window.localStorage }))).toContain("r-host"));
    cleanup();
    window.history.pushState({}, "", "/propose-a-role?role=r-gate");
    serve();
    render(<ProposeARole />);
    const host = (await screen.findByLabelText("Your commitment: Welcome Host")) as HTMLSelectElement;
    expect(host.value).toBe("40");
  });
});
