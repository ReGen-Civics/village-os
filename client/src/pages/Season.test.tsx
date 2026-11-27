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
    modules: [...modulesOn].map(id => ({ id, lifecycle: "members" })),
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
vi.mock("@/lib/gameApi", async orig => ({
  ...(await orig<typeof import("@/lib/gameApi")>()),
  useSeason: () => SEASON,
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

beforeEach(() => {
  signedIn = { id: "u-ana" };
  modulesOn = new Set(["governance", "season-places"]);
  alignments = [];
  asked.length = 0;
  window.history.replaceState(null, "", "/season");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      asked.push(url);
      if (url.startsWith("/api/season-plans/mine")) return json(MINE);
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
        return json({ agreement: null, you: null, message: null });
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
    joinActs: "j",
    planActs: "p",
    alignActs: "a",
    joinLine: { none: "none", applied: "applied", picked: "picked" },
    planLine: {
      filed: "filed",
      changed: "changed",
      notFiled: "not filed",
      closed: "closed",
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
