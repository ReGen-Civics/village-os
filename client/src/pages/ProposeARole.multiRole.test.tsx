// @vitest-environment jsdom
/**
 * SEVERAL ROLES IN ONE APPLICATION (the lead, 17 Nov 2026, confirmed 18 Nov): the Apply link starts with its role,
 * the applicant may add more from any circle on The terms, each with its own commitment, price and split, and the
 * total across roles is shown (components/fireflyPath/MoreRoles.tsx).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    { id: "r-host", name: "Welcome Host", circle: "Land Circle", aim: "Meet every newcomer.", commitmentMin: 30, payCeiling: { amount: 4000, currency: "USD", per: "month" }, payShape: [{ label: "Cash", pct: 60 }, { label: "Equity", pct: 40 }] },
    { id: "r-well", name: "Well Keeper", circle: "Land Circle", aim: "Keep the well clean." },
    // The picker (production check of 1.3.24): a held role still recruiting and a coming-soon role are offered and marked;
    // a fully held role and a future venture are not.
    { id: "r-oven", name: "Oven Keeper", circle: "Land Circle", aim: "Bake.", stillRecruiting: true },
    { id: "r-bees", name: "Bee Keeper", circle: "Land Circle", aim: "Tend the hives.", comingSoon: true },
    { id: "r-full", name: "Full Keeper", circle: "Land Circle", aim: "Full.", held: true },
    { id: "r-cafe", name: "Cafe Venture", circle: "Land Circle", aim: "A cafe.", futureVenture: true },
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
    // A coming-soon role is never added here (the lead, 19 Nov 2026): it is named under the picker, linked to its waitlist.
    expect(Array.from(add.options).map((o) => o.value)).toEqual(["", "r-host", "r-well", "r-oven"]);
    expect(Array.from(add.options).map((o) => o.textContent).slice(3)).toEqual(["Oven Keeper: More players welcome"]);
    const notYet = document.querySelector("[data-roles-not-open]") as HTMLElement;
    expect(notYet.textContent).toContain("Not open yet.");
    const wait = notYet.querySelector('[data-waitlist-role="r-bees"]') as HTMLAnchorElement;
    expect(wait.textContent).toBe("Join the waitlist for Bee Keeper");
    expect(wait.getAttribute("href")).toBe("/roles#waitlist-r-bees");
    fireEvent.change(add, { target: { value: "r-host" } });
    fireEvent.change(await screen.findByLabelText("Your commitment: Gate Keeper"), { target: { value: "50" } });
    const host = screen.getByLabelText("Your commitment: Welcome Host") as HTMLSelectElement;
    // The added role offers its own range: from its minimum.
    expect(Array.from(host.options).map((o) => o.value)).toEqual(["", "30", "40", "50", "60", "70", "80", "90", "100"]);
    fireEvent.change(host, { target: { value: "40" } });
    // The prices add up: 50% of 6000 and 40% of 4000.
    await waitFor(() => expect(document.querySelector("[data-roles-total]")?.textContent).toMatch(/2 roles: 90% commitment in all, and \$4,600 a (month|moon) together/));
    // The added role's own price: their amount, through the same popup the first role has.
    fireEvent.click(document.querySelector('[data-more-role="1"] [data-adjust-price]') as HTMLElement);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByLabelText("Propose my own price"));
    fireEvent.change(dialog.querySelector("[data-price-amount]") as HTMLInputElement, { target: { value: "1500" } });
    fireEvent.click(within(dialog).getByText("Use this price"));
    await waitFor(() => expect(document.querySelector('[data-more-role="1"] [data-split-control], [data-more-role="1"] [data-split]')).toBeTruthy());
    // REVIEW & SUBMIT (production check of 1.3.24): each role's price and split, and the prices added together.
    const review = () => Array.from(document.querySelectorAll("[data-review-row]")).map((r) => r.textContent ?? "");
    await waitFor(() => expect(review().some((l) => l.includes("Your split: Welcome Host"))).toBe(true));
    expect(review().some((l) => l.includes("Your price: Gate Keeper") && /\$3,000/.test(l))).toBe(true);
    expect(review().some((l) => l.includes("Your price: Welcome Host") && /\$1,500/.test(l))).toBe(true);
    expect(review().some((l) => l.includes("Across your roles") && /\$4,500 a (month|moon) together/.test(l))).toBe(true);
    await agreeAndSend();
    await screen.findByRole("heading", { name: "Check your email" });
    expect(posted).toHaveLength(1);
    // The payload carries the added role's own commitment, price ask and split.
    expect(posted[0].roles[0]).toEqual({ roleId: "r-gate", note: "" });
    expect(posted[0].roles[1]).toMatchObject({ roleId: "r-host", note: "", commitmentPct: 40, payAsk: { kind: "amount", monthly: 1500 } });
    expect(posted[0].roles[1].paySplit.shares.map((x: { label: string; pct: number }) => [x.label, x.pct])).toEqual([["Cash", 60], ["Equity", 40]]);
    expect(posted[0].card.commitmentPct).toBe(50);
  });

  it("a link naming a coming-soon role after the first does not add it; the picker offers its waitlist (the lead, 19 Nov 2026)", async () => {
    await fillToTerms("/propose-a-role?role=r-gate&role=r-bees");
    await screen.findByLabelText("Add another role");
    expect(screen.queryByLabelText("Your commitment: Bee Keeper")).toBeNull();
    expect(document.querySelector('[data-more-role="1"]')).toBeNull();
    expect(document.querySelector('[data-waitlist-role="r-bees"]')?.getAttribute("href")).toBe("/roles#waitlist-r-bees");
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
    // The box starts ticked (the lead, 19 Nov 2026).
    expect((screen.getByLabelText("Remember my answers on this device") as HTMLInputElement).checked).toBe(true);
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
