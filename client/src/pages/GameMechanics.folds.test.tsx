// @vitest-environment jsdom
/**
 * THE GAME MECHANICS AS FOLDS, under How we work together (26 Nov 2026).
 *
 * The lead asked for every part of the mechanics in a collapsible section, so a
 * member who has read the page before can skip to the part they need, and for
 * each part to open from its own anchor. What this holds:
 *
 *   - all four folds start shut, each a heading holding a button whose
 *     `aria-expanded` says so and whose `aria-controls` names its panel;
 *   - pressing the button opens the panel, and pressing it again shuts it;
 *   - a link to `#mechanics-dials` (or any fold) opens that fold on arrival, and
 *     a jump inside the page (a hashchange) opens the one it names;
 *   - a notification's `?focus=proposal-<id>` opens Proposals, and a `?dial=`
 *     link opens the Dials;
 *   - the amendment history is read only once its fold is opened.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Router } from "wouter";

vi.mock("@/contexts/AuthContext", async () => {
  const actual = await vi.importActual<typeof import("@/contexts/AuthContext")>("@/contexts/AuthContext");
  return { ...actual, useAuth: () => ({ user: { id: "u1", name: "Ora", role: "member", membershipGranted: true } }) };
});
vi.mock("@/lib/gameApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/gameApi")>()),
  useGameConfig: () => ({ project: { name: "Willowbrook" } }),
  authToken: () => "t",
}));

import GameMechanics, { foldFromUrl, MECHANICS_FOLDS } from "./GameMechanics";

const SNAPSHOT = {
  constitution: [{ title: "Every token is accounted for", plain: "One ledger, balanced to zero.", enforcedBy: "server/lib/ledger.ts" }],
  variables: [
    {
      key: "membership.vouches_required",
      category: "Membership",
      label: "Vouches to admit a member",
      description: "How many members vouch before someone is admitted.",
      type: "integer",
      unit: null,
      min: 1,
      max: 5,
      choices: null,
      default: "2",
      value: "2",
      parsed: 2,
      isDefault: true,
      ring: "open",
      applyTiming: "instant",
    },
  ],
  modules: [],
  governance: { decidesBy: "onsite", method: "custom", autoApply: true, supportThreshold: 3 },
};
const PROPOSAL = {
  id: "p1",
  title: "More vouches",
  rationale: "Known by three first.",
  status: "open",
  ballotId: null,
  lastBallotStatus: null,
  hyphaRef: null,
  hyphaProposalId: null,
  hyphaProposalUrl: null,
  hubLinkSynced: false,
  createdAt: "2026-11-20T10:00:00Z",
  proposer: "Leo",
  supports: 1,
  sponsors: 0,
  changes: [],
};

let calls: string[];
/** Held open to make the rules arrive AFTER the proposals, as they did on QA round 1's slow read. */
let snapshotWaitsFor: Promise<void> | null;
let proposalList: unknown[];
beforeEach(() => {
  calls = [];
  snapshotWaitsFor = null;
  proposalList = [PROPOSAL];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls.push(String(url));
      const u = String(url);
      if (u === "/api/game/mechanics") {
        if (snapshotWaitsFor) await snapshotWaitsFor;
        return new Response(JSON.stringify(SNAPSHOT), { status: 200 });
      }
      if (u === "/api/game/mechanics/proposals") return new Response(JSON.stringify(proposalList), { status: 200 });
      if (u === "/api/game/mechanics/history") return new Response("[]", { status: 200 });
      return new Response("null", { status: 404 });
    }),
  );
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/governance/how");
});

const renderAt = async (url: string) => {
  window.history.replaceState(null, "", url);
  render(
    <Router>
      <GameMechanics />
    </Router>,
  );
  await screen.findByRole("button", { name: /The Constitution/ });
};
const toggle = (name: RegExp) => screen.getByRole("button", { name });

describe("the four folds", () => {
  it("start shut, each a heading holding a button that names its panel", async () => {
    await renderAt("/governance/how");
    for (const [id, name] of [
      ["mechanics-constitution", /The Constitution/],
      ["mechanics-dials", /The Dials/],
      ["mechanics-proposals", /Proposals/],
      ["mechanics-history", /Amendment History/],
    ] as const) {
      const button = toggle(name);
      expect(button.closest("h3"), id).not.toBeNull();
      expect(button).toHaveAttribute("aria-expanded", "false");
      expect(button).toHaveAttribute("aria-controls", `${id}-panel`);
      expect(document.getElementById(`${id}-panel`)).toHaveAttribute("hidden");
      expect(document.getElementById(id)?.tagName).toBe("SECTION");
    }
  });

  it("open and shut on a press, and say so", async () => {
    await renderAt("/governance/how");
    fireEvent.click(toggle(/The Constitution/));
    expect(toggle(/The Constitution/)).toHaveAttribute("aria-expanded", "true");
    const panel = document.getElementById("mechanics-constitution-panel")!;
    expect(panel).not.toHaveAttribute("hidden");
    expect(within(panel).getByText("Every token is accounted for")).toBeInTheDocument();
    fireEvent.click(toggle(/The Constitution/));
    expect(toggle(/The Constitution/)).toHaveAttribute("aria-expanded", "false");
  });

  it("say what each holds while shut", async () => {
    await renderAt("/governance/how");
    expect(toggle(/The Constitution/)).toHaveTextContent("1 laws that no vote can change");
    expect(toggle(/The Dials/)).toHaveTextContent("1 dials in 1 groups");
    await waitFor(() => expect(toggle(/Proposals/)).toHaveTextContent(/1 in play$/));
  });

  it("read the amendment history only once its fold is opened", async () => {
    await renderAt("/governance/how");
    expect(calls).not.toContain("/api/game/mechanics/history");
    fireEvent.click(toggle(/Amendment History/));
    await waitFor(() => expect(calls).toContain("/api/game/mechanics/history"));
    expect(await screen.findByText(/No rules have been changed yet/)).toBeInTheDocument();
  });
});

describe("each fold opens from its own anchor", () => {
  it("opens the fold a link names on arrival, and only that one", async () => {
    await renderAt("/governance/how#mechanics-dials");
    expect(toggle(/The Dials/)).toHaveAttribute("aria-expanded", "true");
    expect(toggle(/The Constitution/)).toHaveAttribute("aria-expanded", "false");
    expect(toggle(/Proposals/)).toHaveAttribute("aria-expanded", "false");
  });

  it("opens the fold a jump inside the page names", async () => {
    await renderAt("/governance/how");
    window.history.replaceState(null, "", "/governance/how#mechanics-proposals");
    act(() => {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(toggle(/Proposals/)).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById("mechanics-proposals-panel")).not.toHaveAttribute("hidden");
  });

  it("opens Proposals for a notification's focus link, so the proposal it names is there to land on", async () => {
    await renderAt("/governance/how?focus=proposal-p1");
    expect(toggle(/Proposals/)).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByText("More vouches")).toBeInTheDocument();
    expect(document.getElementById("proposal-p1")).not.toBeNull();
  });

  it("opens the Dials for a link that names one, with the search already holding it", async () => {
    await renderAt("/governance/how?dial=membership.vouches_required");
    expect(toggle(/The Dials/)).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("searchbox")).toHaveValue("membership.vouches_required");
  });
});

describe("a notification's link, whichever read lands last (QA round 1)", () => {
  it("lands on the proposal when the rules arrive AFTER the proposals", async () => {
    let release!: () => void;
    snapshotWaitsFor = new Promise<void>((r) => (release = r));
    window.history.replaceState(null, "", "/governance/how?focus=proposal-p1");
    render(
      <Router>
        <GameMechanics />
      </Router>,
    );
    // The list is in, the rules are not: no card to land on yet.
    await waitFor(() => expect(calls).toContain("/api/game/mechanics/proposals"));
    await new Promise((r) => setTimeout(r, 20));
    expect(document.getElementById("proposal-p1")).toBeNull();
    release();
    await waitFor(() => expect(document.activeElement?.id).toBe("proposal-p1"));
    expect(toggle(/Proposals/)).toHaveAttribute("aria-expanded", "true");
  });

  it("brings the reader to Proposals when the proposal it names is not on the page any more", async () => {
    proposalList = [];
    const scrolled: string[] = [];
    window.HTMLElement.prototype.scrollIntoView = vi.fn(function (this: HTMLElement) {
      scrolled.push(this.id);
    });
    await renderAt("/governance/how?focus=proposal-gone");
    await waitFor(() => expect(scrolled).toContain("mechanics-proposals"));
    expect(toggle(/Proposals/)).toHaveAttribute("aria-expanded", "true");
  });
});

describe("jumps inside the page", () => {
  it("opens a fold again from a door pressed on the anchor already in the address, after the reader shut it", async () => {
    await renderAt("/governance/how#mechanics-dials");
    fireEvent.click(toggle(/The Dials/));
    expect(toggle(/The Dials/)).toHaveAttribute("aria-expanded", "false");
    act(() => {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(toggle(/The Dials/)).toHaveAttribute("aria-expanded", "true");
  });

  it("opens the fold a router link names (the footer's, sent by pushState with no hashchange)", async () => {
    await renderAt("/governance/how");
    act(() => {
      window.history.pushState(null, "", "/governance/how#mechanics-history");
      window.dispatchEvent(new Event("pushState"));
    });
    expect(toggle(/Amendment History/)).toHaveAttribute("aria-expanded", "true");
  });
});

describe("foldFromUrl", () => {
  it("reads each fold's own anchor", () => {
    for (const id of MECHANICS_FOLDS) expect(foldFromUrl(`#${id}`, "")).toBe(id);
  });
  it("reads a proposal's anchor or focus as Proposals, and a dial as the Dials", () => {
    expect(foldFromUrl("#proposal-abc", "")).toBe("mechanics-proposals");
    expect(foldFromUrl("", "?focus=proposal-abc")).toBe("mechanics-proposals");
    expect(foldFromUrl("", "?dial=comms.daily_cap")).toBe("mechanics-dials");
  });
  it("opens nothing for any other address (CONTROL)", () => {
    expect(foldFromUrl("", "")).toBeNull();
    expect(foldFromUrl("#game-mechanics", "")).toBeNull();
    expect(foldFromUrl("#conflict", "?focus=ballot-1")).toBeNull();
  });
});
