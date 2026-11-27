// @vitest-environment jsdom
/**
 * `/season`, the one season page (the season fold, 27 Nov 2026), rendered.
 *
 *   - a visitor reads the season and one sign-in card, and nothing private is
 *     asked for;
 *   - a member reads their own steps (join, plan, align), each from its tab's
 *     own answer, and the one next act opens that tab;
 *   - the address picks the tab: #plan, #join, #aligned, and the old pages'
 *     anchors (#everyone, #confidentiality);
 *   - a tab whose module is off is not drawn, and neither is its step;
 *   - the Season tab draws the commons once, with moss where the village
 *     reached a goal.
 *
 * Every name is made up.
 */
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

let signedIn: { id: string } | null = { id: "u-ana" };
let modulesOn = new Set(["governance", "season-places"]);

vi.mock("@/components/Layout", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: signedIn }),
  useOptionalAuth: () => ({ user: signedIn }),
}));
vi.mock("@/modules/ModuleProvider", () => ({
  useModules: () => ({
    loaded: true,
    modules: Array.from(modulesOn).map(id => ({ id, lifecycle: "members" })),
  }),
  useModule: (id: string) =>
    modulesOn.has(id) ? { id, lifecycle: "members" } : null,
}));
vi.mock("@/components/modules/ModuleGate", () => ({
  default: () => <p>Module gate</p>,
  SignInDoors: ({ next }: { next?: string }) => (
    <a href={`/login?next=${next}`}>Sign in</a>
  ),
}));
vi.mock("@/components/natural/useReducedMotion", () => ({
  useReducedMotion: () => true,
  prefersReducedMotion: () => true,
}));
vi.mock("@/lib/newcomer", () => ({ useNewcomer: () => !signedIn }));
// One tab can be made to throw while it draws, to prove the others survive it (QA round 1).
let planThrows = false;
vi.mock("@/components/season/YourPlan", async orig => {
  const real = await orig<typeof import("@/components/season/YourPlan")>();
  return {
    ...real,
    default: (props: Parameters<typeof real.default>[0]) => {
      if (planThrows) throw new Error("a malformed answer");
      return real.default(props);
    },
  };
});

const SEASON = {
  current: {
    id: "s-now",
    name: "Season of Testing",
    theme: "",
    focus: "Lay the ground",
    startsOn: "2026-11-01",
    endsOn: "2027-01-31",
    goals: [
      { id: "g1", text: "Plant the north orchard", done: true },
      { id: "g2", text: "Open the guest kitchen", done: false },
    ],
  },
  upcoming: null,
  needsNextSeason: false,
  daysLeft: 60,
  daysUntilStart: 0,
  timezone: "UTC",
  cadence: "custom",
  today: "2026-11-26",
  planWindow: {
    seasonId: "s-now",
    seasonName: "Season of Testing",
    opensOn: "2026-11-01",
    closesOn: "2026-12-15",
    state: "open",
  },
};
let seasonNow: unknown = SEASON;
vi.mock("@/lib/gameApi", async orig => ({
  ...(await orig<typeof import("@/lib/gameApi")>()),
  useSeason: () => seasonNow,
}));

import Season, { seasonSteps } from "./Season";

const MINE = {
  season: {
    id: "s-now",
    name: "Season of Testing",
    startsOn: "2026-11-01",
    endsOn: "2027-01-31",
    goals: ["Plant the north orchard", "Open the guest kitchen"],
  },
  window: SEASON.planWindow,
  plan: null,
  filed: null,
  changedSinceFiling: false,
  heldSeats: [],
  applications: [],
  questsThisMoon: { done: 0 },
  mayApply: true,
};
const CREW = {
  season: { id: "s-now", name: "Season of Testing" },
  seasons: [],
  goals: [],
  circles: [
    {
      circleId: "c-1",
      name: "Garden circle",
      pickedBy: null,
      berths: null,
      picked: 0,
      berthsLeft: null,
      wanted: 0,
    },
  ],
  mine: {
    id: "cr-1",
    status: "picked",
    wantsCircleId: "c-1",
    pickedCircleId: "c-1",
    pickedCircleName: "Garden circle",
    words: null,
  },
  picksFor: [],
  pool: null,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const asked: string[] = [];
let alignments: unknown[] = [];
let agreement: unknown = null;
let mineOverride: Record<string, unknown> = {};

beforeEach(() => {
  signedIn = { id: "u-ana" };
  seasonNow = SEASON;
  modulesOn = new Set(["governance", "season-places"]);
  alignments = [];
  agreement = null;
  mineOverride = {};
  asked.length = 0;
  window.history.replaceState(null, "", "/season");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      asked.push(url);
      if (url.startsWith("/api/season-plans/mine"))
        return json({ ...MINE, ...mineOverride });
      if (url.startsWith("/api/season-plans"))
        return json({
          season: MINE.season,
          window: MINE.window,
          people: [],
          filedCount: 0,
          memberCount: 3,
          notFiled: [],
        });
      if (url.startsWith("/api/season-places/crew")) return json(CREW);
      if (url.startsWith("/api/season-places/gatherings"))
        return json({ gatherings: [] });
      if (url.startsWith("/api/season-places"))
        return json({
          dials: { who: "member", freeAfter: null, cap: null },
          taken: 1,
          places: [],
          mine: [],
        });
      if (url.startsWith("/api/profile/alignments"))
        return json({ alignments });
      if (url.startsWith("/api/confidentiality"))
        return json({
          agreement,
          you: agreement ? { holds: false, confirmFresh: true } : null,
          message: null,
        });
      if (url.startsWith("/api/aligned"))
        return json({ kinds: [], rows: [], more: false, query: null });
      return json({});
    })
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const tab = (name: string) =>
  screen.getByRole("tab", { name: new RegExp(`^${name}`) });

describe("who reads the season", () => {
  it("a visitor reads the season and the sign-in card, and nothing private is asked", () => {
    signedIn = null;
    render(<Season />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Lay the ground" })
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Sign in" }).getAttribute("href")
    ).toBe("/login?next=/season");
    expect(screen.queryByRole("tablist")).toBeNull();
    // The goal count is the village's working number: a visitor does not see it.
    expect(document.querySelector("[data-season-goals-met]")).toBeNull();
    expect(
      asked.filter(u =>
        /season-plans|season-places|alignments|aligned|confidentiality/.test(u)
      )
    ).toEqual([]);
  });
});

describe("your steps through the season", () => {
  it("reads each step off its tab, and the next act opens the plan", async () => {
    render(<Season />);
    const steps = await screen.findByRole("region", {
      name: "Where you stand",
    });
    await waitFor(() =>
      expect(steps.querySelectorAll("[data-step]").length).toBe(3)
    );
    expect(
      steps.querySelector('[data-step="join"]')!.getAttribute("data-state")
    ).toBe("done");
    expect(
      steps.querySelector('[data-step="plan"]')!.getAttribute("data-state")
    ).toBe("now");
    expect(
      steps.querySelector('[data-step="aligned"]')!.getAttribute("data-state")
    ).toBe("done");
    expect(tab("Season").getAttribute("aria-selected")).toBe("true");
    // The gold act names where it goes, never the step's title again (QA round 1).
    expect(steps.querySelector("[data-season-next]")!.textContent).toBe(
      "Open your plan"
    );
    fireEvent.click(steps.querySelector("[data-season-next]")!);
    expect(tab("Your plan").getAttribute("aria-selected")).toBe("true");
    expect(window.location.hash).toBe("#plan");
  });

  it("says how many texts wait on you in the Align step, and keeps the tab free of a badge", async () => {
    alignments = [
      {
        textId: "t1",
        title: "Terms for Host",
        body: "",
        version: 1,
        seatNames: [],
        href: null,
        state: "pending",
        why: null,
        sealed: false,
        money: false,
        parties: [],
        you: {
          partyKey: "me",
          aligned: false,
          alignedAt: null,
          mayAlign: true,
        },
        contentHash: "c".repeat(64),
        createdAt: null,
      },
    ];
    render(<Season />);
    await waitFor(() =>
      expect(
        document.querySelector('[data-step="aligned"]')?.textContent
      ).toContain("One waits on you")
    );
    expect(tab("Aligned").textContent).toBe("Aligned");
  });

  it("CONTROL: with season places off there is no Join tab and no join step", async () => {
    modulesOn = new Set(["governance"]);
    render(<Season />);
    const steps = await screen.findByRole("region", {
      name: "Where you stand",
    });
    await waitFor(() =>
      expect(steps.querySelectorAll("[data-step]").length).toBe(2)
    );
    expect(screen.queryByRole("tab", { name: "Join" })).toBeNull();
    expect(asked.some(u => u.startsWith("/api/season-places"))).toBe(false);
  });
});

describe("the address picks the tab", () => {
  it.each([
    ["#plan", "Your plan"],
    ["#join", "Join"],
    ["#aligned", "Aligned"],
    ["#confidentiality", "Aligned"],
    ["#everyone", "Season"],
  ])("%s opens %s", async (hash, name) => {
    window.history.replaceState(null, "", `/season${hash}`);
    render(<Season />);
    await waitFor(() =>
      expect(tab(name).getAttribute("aria-selected")).toBe("true")
    );
  });
});

describe("arriving for a tab", () => {
  it("opens it and lands on its panel once, keeping an anchor such as #confidentiality", async () => {
    const scrolled: string[] = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this.id || this.getAttribute("role") || "");
    };
    window.history.replaceState(null, "", "/season#confidentiality");
    render(<Season />);
    await waitFor(() =>
      expect(tab("Aligned").getAttribute("aria-selected")).toBe("true")
    );
    await waitFor(() =>
      expect(scrolled.some(id => id.endsWith("-panel-aligned"))).toBe(true)
    );
    expect(window.location.hash).toBe("#confidentiality");
  });

  it("lands on the agreement for #confidentiality once it has drawn, and on the role for ?renew=", async () => {
    const scrolled: string[] = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this.id);
    };
    agreement = {
      title: "Confidentiality agreement",
      body: "Keep it inside.",
      intent: "I align.",
      version: "v1",
      document: null,
    };
    window.history.replaceState(null, "", "/season#confidentiality");
    render(<Season />);
    await waitFor(() => expect(scrolled).toContain("confidentiality"));
    // The page does the only landing scroll: one scroll, onto the agreement.
    expect(scrolled.filter(id => id === "confidentiality")).toHaveLength(1);
    cleanup();
    scrolled.length = 0;
    agreement = null;
    mineOverride = {
      heldSeats: [
        { id: "seat-host", name: "Host", termEndsOn: null, lapsed: false },
      ],
    };
    window.history.replaceState(null, "", "/season?renew=seat-host#plan");
    render(<Season />);
    await waitFor(() => expect(scrolled).toContain("seat-seat-host"));
    expect(scrolled.filter(id => id === "seat-seat-host")).toHaveLength(1);
    // The role the warning names carries a gold chip that says so, in both modes (QA round 3).
    expect(
      document.querySelector("#seat-seat-host [data-renew-chip]")?.textContent
    ).toBe("Renew this role");
  });

  it("#everyone lands on everyone's plans, on the Season tab", async () => {
    const scrolled: string[] = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this.id);
    };
    window.history.replaceState(null, "", "/season#everyone");
    render(<Season />);
    await waitFor(() => expect(scrolled).toContain("everyone"));
    expect(tab("Season").getAttribute("aria-selected")).toBe("true");
  });

  it("CONTROL: a bare /season stays on the hero and scrolls nowhere", async () => {
    const scrolled: string[] = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this.id);
    };
    render(<Season />);
    await screen.findByRole("tablist");
    await new Promise(r => setTimeout(r, 50));
    expect(tab("Season").getAttribute("aria-selected")).toBe("true");
    expect(scrolled).toEqual([]);
  });
});

describe("the tab bar", () => {
  it("on a stuck bar, a tab brings its own panel up; on a resting bar it does not scroll (QA round 3)", async () => {
    const scrolled: string[] = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this.id);
    };
    render(<Season />);
    const bar = await screen.findByRole("tablist");
    bar.getBoundingClientRect = () => ({ top: 300 }) as DOMRect;
    fireEvent.click(tab("Join"));
    await new Promise(r => setTimeout(r, 30));
    expect(scrolled.some(id => id.endsWith("-panel-join"))).toBe(false);
    bar.getBoundingClientRect = () => ({ top: 96 }) as DOMRect;
    fireEvent.click(tab("Aligned"));
    await waitFor(() =>
      expect(scrolled.some(id => id.endsWith("-panel-aligned"))).toBe(true)
    );
    fireEvent.keyDown(bar, { key: "Home" });
    await waitFor(() =>
      expect(scrolled.some(id => id.endsWith("-panel-season"))).toBe(true)
    );
  });

  it("between seasons, the hero says when the next one begins", () => {
    seasonNow = {
      ...SEASON,
      current: null,
      upcoming: { ...SEASON.current, startsOn: "2027-02-01" },
      daysUntilStart: 66,
    };
    render(<Season />);
    expect(screen.getByText("Begins on 1 February 2027.")).toBeTruthy();
  });

  it("moves with Left, Right, Home and End, and only the selected tab is in the tab order", async () => {
    render(<Season />);
    const bar = await screen.findByRole("tablist");
    expect(tab("Season").tabIndex).toBe(0);
    expect(tab("Join").tabIndex).toBe(-1);
    fireEvent.keyDown(bar, { key: "ArrowRight" });
    expect(tab("Join").getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tab("Join"));
    fireEvent.keyDown(bar, { key: "End" });
    expect(tab("Aligned").getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(bar, { key: "ArrowRight" });
    expect(tab("Season").getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(bar, { key: "ArrowLeft" });
    expect(tab("Aligned").getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(bar, { key: "Home" });
    expect(tab("Season").getAttribute("aria-selected")).toBe("true");
  });

  it("a tab that fails to draw shows Try again in its own panel, and the rest of the page stays", async () => {
    planThrows = true;
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      window.history.replaceState(null, "", "/season#plan");
      render(<Season />);
      expect(
        await screen.findByText("This part of the season could not be drawn.")
      ).toBeTruthy();
      expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
      expect(
        screen.getByRole("heading", { level: 1, name: "Lay the ground" })
      ).toBeTruthy();
      expect(screen.getByRole("tablist")).toBeTruthy();
    } finally {
      planThrows = false;
      quiet.mockRestore();
    }
  });
});

describe("the Season tab", () => {
  it("draws the commons once, moss where the village reached a goal", async () => {
    render(<Season />);
    const commons = await screen.findByTestId("commons");
    expect(
      within(commons).getByText("We have reached 1 of 2 goals so far.")
    ).toBeTruthy();
    expect(screen.getAllByTestId("commons")).toHaveLength(1);
    expect(screen.getByText("1 of 2 goals met")).toBeTruthy();
  });
});

describe("seasonSteps", () => {
  const words = {
    join: "Join",
    plan: "Plan",
    align: "Align",
    acts: { join: "open join", plan: "open plan", aligned: "open aligned" },
    joinLine: { none: "none", applied: "applied", picked: "picked" },
    planLine: {
      filed: "filed",
      changed: "changed",
      notFiled: "not filed",
      before: (on: string) => `before ${on}`,
    },
    alignLine: {
      clear: "clear",
      waiting: (n: number) => `${n} waiting`,
      agreement: "agreement",
    },
  };
  const plan = {
    state: "ready" as const,
    filed: false,
    changed: false,
    window: "open" as const,
    seasonName: "S",
    seasonId: "s",
    goals: [],
  };

  it("leaves out a step whose read has not answered, and never guesses it done", () => {
    expect(
      seasonSteps(
        {
          join: "loading",
          plan: null,
          aligned: { waiting: null, agreement: null },
        },
        words,
        null
      )
    ).toEqual([]);
  });

  it("a filed plan with changes is not done; an application waits on the picker", () => {
    const out = seasonSteps(
      {
        join: "applied",
        plan: { ...plan, filed: true, changed: true },
        aligned: { waiting: 0, agreement: "asked" },
      },
      words,
      null
    );
    expect(out.map(s => [s.tab, s.state, s.line])).toEqual([
      ["join", "wait", "applied"],
      ["plan", "now", "changed"],
      ["aligned", "now", "agreement"],
    ]);
  });

  it("a window not open yet waits, and says when it opens", () => {
    const out = seasonSteps(
      { join: null, plan: { ...plan, window: "before" }, aligned: null },
      words,
      "2026-12-01"
    );
    expect(out[0].state).toBe("wait");
    expect(out[0].line).toContain("before 2026-12-01");
  });
});
