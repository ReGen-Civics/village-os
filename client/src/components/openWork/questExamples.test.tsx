// @vitest-environment jsdom
/**
 * EXAMPLE QUESTS ON THE BOARD (the lead, 24 Nov 2026): "put a big 'example'
 * stamp on the existing cards and say 'quests coming soon' up top with a link
 * to propose a quest". What each case pins:
 *
 *   1. An example card carries the stamp, and its link says "Example quest".
 *   2. A real card carries no stamp.
 *   3. The banner shows only while the board has quests and none of them is
 *      real open work; one real open quest takes it away; a real CLOSED quest
 *      does not count; an empty board keeps its own meadow. While it shows,
 *      the "Don't see your gift here?" panel is hidden, and it returns with
 *      the first real open quest (the lead: "hide the second panel").
 *   4. The quest page's act is a disabled "Example quest" on an example, for a
 *      member and a visitor alike, and the claim route is never called.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { boardHasRealOpenWork, type BoardQuest } from "@/lib/questBoard";

const gameFetch = vi.hoisted(() => vi.fn());
vi.mock("wouter", () => ({
  Link: ({ href, children, className, ...rest }: { href: string; children: ReactNode; className?: string; [k: string]: unknown }) => (
    <a href={href} className={className} aria-label={rest["aria-label"] as string | undefined}>
      {children}
    </a>
  ),
  useSearch: () => "",
}));
vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }), useOptionalAuth: () => ({ user: null }) }));
vi.mock("@/components/ExamplesBanner", () => ({ ExamplesBanner: () => null }));
vi.mock("@/components/geneKeys/MaiaTypeLine", () => ({ default: () => null }));
vi.mock("@/lib/gameApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/gameApi")>()),
  gameFetch,
  fetchGameMe: async () => null,
  useGameConfig: () => ({ stages: [], project: { name: "the village" } }),
}));

import QuestCard from "@/components/QuestCard";
import QuestActions from "@/components/QuestActions";
import Quests from "@/pages/Quests";

const quest = (over: Partial<BoardQuest> & { id: string }): BoardQuest => ({ title: over.id, gratitude: "", status: "Open", ...over });

afterEach(cleanup);

describe("the quest card's link and its roots (QA round 2, 27 Nov 2026)", () => {
  it("lays one link over the card and keeps the roots row out of it, so a root's tip can take a tap", () => {
    render(<QuestCard quest={quest({ id: "q-well", title: "Dig the well", archetypes: ["catalyzing"] })} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("aria-label")).toBe("Dig the well");
    const roots = screen.getByRole("list", { name: "Grows from" });
    expect(links[0].contains(roots)).toBe(false);
    expect(roots.className).toMatch(/z-10/);
  });
});

describe("the example stamp on a quest card", () => {
  it("stamps an example and names it in the card's link", () => {
    const { container } = render(<QuestCard quest={quest({ id: "q-swale", title: "Tend the swale", isExample: true })} />);
    const stamp = container.querySelector("[data-example-stamp]");
    expect(stamp?.textContent).toContain("Example");
    expect(stamp?.querySelector(".sr-only")?.textContent).toBe("Example quest");
    expect(screen.getByRole("link").getAttribute("aria-label")).toBe("Tend the swale, Example quest");
    // An example promises no open status.
    expect(container.querySelector('[data-status="example"]')).toBeTruthy();
  });

  it("leaves a real quest unstamped", () => {
    const { container } = render(<QuestCard quest={quest({ id: "q-well", title: "Dig the well" })} />);
    expect(container.querySelector("[data-example-stamp]")).toBeNull();
    expect(screen.getByRole("link").getAttribute("aria-label")).toBe("Dig the well");
  });
});

describe("boardHasRealOpenWork", () => {
  it("counts a real quest that is not closed, Seasonal included", () => {
    expect(boardHasRealOpenWork([quest({ id: "a", isExample: true })])).toBe(false);
    expect(boardHasRealOpenWork([quest({ id: "a", isExample: true }), quest({ id: "b", status: " closed " })])).toBe(false);
    expect(boardHasRealOpenWork([quest({ id: "a", isExample: true }), quest({ id: "b", status: "Seasonal" })])).toBe(true);
    expect(boardHasRealOpenWork([])).toBe(false);
  });
});

describe("Quests coming soon, at the top of /quests", () => {
  const realFetch = globalThis.fetch;
  let board: BoardQuest[] = [];
  beforeEach(() => {
    globalThis.fetch = vi.fn(async (url: any) => {
      const u = String(url);
      const body = u.startsWith("/api/quests/goals") ? { goals: [] } : u.startsWith("/api/quests/field") ? { perQuest: {}, recent: [] } : u.startsWith("/api/quests") ? board : {};
      return { ok: true, status: 200, json: async () => body } as any;
    }) as any;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("shows over a board of examples, with the one door to propose a quest, and every card stamped", async () => {
    board = [quest({ id: "q-a", circle: "Land", isExample: true }), quest({ id: "q-b", circle: "Land", isExample: true })];
    const { container } = render(<Quests />);
    await waitFor(() => expect(container.querySelector("[data-quests-coming-soon]")).toBeTruthy());
    expect(screen.getByRole("heading", { name: "Quests coming soon" })).toBeTruthy();
    expect(screen.getByText("These are examples of the quests to come. Have one in mind?")).toBeTruthy();
    expect(screen.getByRole("link", { name: /^Propose a quest$/ }).getAttribute("href")).toBe("/propose-quest");
    expect(container.querySelectorAll("[data-circle-group] [data-example-stamp]")).toHaveLength(2);
    // The coming-soon panel is the one door: the second invitation steps aside.
    expect(screen.queryByText("Don't see your gift here?")).toBeNull();
    expect(screen.queryByRole("link", { name: /^Propose a Quest$/ })).toBeNull();
  });

  it("is gone once one real quest is open, and a real closed quest does not count", async () => {
    board = [quest({ id: "q-a", circle: "Land", isExample: true }), quest({ id: "q-b", circle: "Land" })];
    const { container, unmount } = render(<Quests />);
    await waitFor(() => expect(container.querySelectorAll("[data-circle-group] article")).toHaveLength(2));
    expect(container.querySelector("[data-quests-coming-soon]")).toBeNull();
    // ...and "Don't see your gift here?" is back, as before.
    expect(screen.getByText("Don't see your gift here?")).toBeTruthy();
    expect(screen.getByRole("link", { name: /^Propose a Quest$/ }).getAttribute("href")).toBe("/propose-quest");
    unmount();

    board = [quest({ id: "q-a", circle: "Land", isExample: true }), quest({ id: "q-b", circle: "Land", status: "Closed" })];
    const second = render(<Quests />);
    await waitFor(() => expect(second.container.querySelector("[data-quests-coming-soon]")).toBeTruthy());
  });

  it("an empty board keeps its meadow and shows no banner", async () => {
    board = [];
    const { container } = render(<Quests />);
    await waitFor(() => expect(screen.getByText("The meadow is resting")).toBeTruthy());
    expect(container.querySelector("[data-quests-coming-soon]")).toBeNull();
  });
});

describe("taking an example quest", () => {
  beforeEach(() => gameFetch.mockReset());

  it("is a disabled Example quest for a member, and nothing is sent", () => {
    render(<QuestActions questId="q-swale" signedIn claim={undefined} isExample onChanged={() => {}} />);
    const act = screen.getByRole("button", { name: "Example quest" }) as HTMLButtonElement;
    expect(act.disabled).toBe(true);
    fireEvent.click(act);
    expect(gameFetch).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Take this Quest/ })).toBeNull();
  });

  it("is the same for a visitor, who is not sent to sign in for it", () => {
    render(<QuestActions questId="q-swale" signedIn={false} claim={undefined} isExample onChanged={() => {}} />);
    expect((screen.getByRole("button", { name: "Example quest" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText("Sign in to take this Quest")).toBeNull();
  });

  it("a real quest still offers Take this Quest", () => {
    render(<QuestActions questId="q-well" signedIn claim={undefined} onChanged={() => {}} />);
    expect(screen.getByRole("button", { name: /Take this Quest/ })).toBeTruthy();
  });
});
