// @vitest-environment jsdom
/**
 * Priorities everyone can see, in the browser (shared/priorities.ts): the
 * asker reads where their ask sits in plain words; a holder gives a taken ask
 * a place; the team reads each person's line by name; the room's round lets a
 * person write their own line and a host anybody's; the board's kept order
 * waits for the facilitator to set the agenda's.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { RAISED_ASKS_API, WEEK_API, askPlaceApi, type RoomBoard, type RoomTops, type WeekPayload } from "@shared/priorities";
import type { TemplateRoomView, TemplateSection } from "@shared/sessionTemplates";
import RaisedAsksCard from "./RaisedAsksCard";
import PlaceInLine from "./PlaceInLine";
import TeamWeek from "./TeamWeek";
import { BoardVoteSection, TopsSection } from "./RoomPriorities";
import { dayWords } from "./priorityWords";

i18n.load("en", {});
i18n.activate("en");
const wrap = (ui: React.ReactElement) => render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", (url: unknown, init?: unknown) => fetchMock(String(url), init));
});
afterEach(() => vi.unstubAllGlobals());

const line = (text: string, weekOf = "2026-11-16") => ({ weekOf, text, servesGoalId: null, servesGoal: null, outcome: null, sessionId: null, setAt: "" });

describe("where your asks sit", () => {
  it("says the place and the week in plain words, and that an open ask waits for a holder", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url === RAISED_ASKS_API
        ? reply(200, {
            asks: [
              { id: "rt-1", role: "Water keeper", circle: "Core", text: "The tank leaks.", status: "taken", raisedOn: "2026-11-10", place: { position: 14, expectWeek: "2026-12-14" } },
              { id: "rt-2", role: "Kitchen keeper", circle: null, text: "Compost smells.", status: "open", raisedOn: "2026-11-12", place: null },
            ],
          })
        : reply(404, {}),
    );
    wrap(<RaisedAsksCard />);
    expect(await screen.findByText(`Number 14 on the role's list. Expected around the week of ${dayWords("2026-12-14")}.`)).toBeInTheDocument();
    expect(screen.getByText("Waiting for a holder of the role to take it.")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/late|overdue/i);
  });

  it("draws nothing when no ask waits", async () => {
    fetchMock.mockResolvedValue(reply(200, { asks: [] }));
    const { container } = wrap(<RaisedAsksCard />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container.querySelector("[data-raised-asks]")).toBeNull();
  });
});

describe("a holder gives a taken ask a place", () => {
  it("sends the place and the weeks ahead, then says them back", async () => {
    fetchMock.mockResolvedValue(reply(200, { place: { position: 14, expectWeek: "2026-12-14" } }));
    wrap(<PlaceInLine tensionId="rt-0123456789abcdef" place={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Give it a place" }));
    fireEvent.change(screen.getByLabelText("Place on your list"), { target: { value: "14" } });
    fireEvent.change(screen.getByLabelText("Expect to pick it up"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(`Number 14 on your list. Expected around the week of ${dayWords("2026-12-14")}.`)).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(askPlaceApi("rt-0123456789abcdef"));
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ position: 14, inWeeks: 4 });
  });

  it("leaves the week out when it is not changed, so the server keeps it", async () => {
    fetchMock.mockResolvedValue(reply(200, { place: { position: 2, expectWeek: "2026-12-14" } }));
    wrap(<PlaceInLine tensionId="rt-0123456789abcdef" place={{ position: 3, expectWeek: "2026-12-14" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    fireEvent.change(screen.getByLabelText("Place on your list"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText(/Number 2 on your list/);
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({ position: 2 });
  });
});

describe("the team's week", () => {
  it("names each person and says when a line carried forward", async () => {
    const week: WeekPayload = {
      weekOf: "2026-11-16",
      mine: null,
      team: [
        { name: "Ana Reyes", line: line("Fix the tank"), thisWeek: true },
        { name: "Ben Ortiz", line: line("Mend the fence", "2026-11-09"), thisWeek: false },
      ],
      goals: [],
    };
    fetchMock.mockImplementation(async (url: string) => (url === WEEK_API ? reply(200, week) : reply(404, {})));
    wrap(<TeamWeek />);
    expect(await screen.findByText("Fix the tank")).toBeInTheDocument();
    expect(screen.getByText("Ben Ortiz")).toBeInTheDocument();
    expect(screen.getByText(`From the week of ${dayWords("2026-11-09")}`)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Set yours on your profile" })).toBeInTheDocument();
  });
});

describe("the room's sections", () => {
  const section = (kind: TemplateSection["kind"], title: string): TemplateSection => ({ key: kind, kind, title, prompt: "", minutes: 5 });
  const tops: RoomTops = {
    weekOf: "2026-11-16",
    people: [
      { no: 1, name: "Ana Reyes", line: line("Fix the tank") },
      { no: 2, name: "Ben Ortiz", line: null },
    ],
  };
  const view = (extra: Partial<TemplateRoomView>): TemplateRoomView => ({
    template: null,
    hosts: false,
    joined: true,
    open: true,
    here: [],
    stick: null,
    priorities: [],
    review: null,
    carried: null,
    shares: [],
    season: null,
    viewerNo: 2,
    ...extra,
  });

  it("lets a person set their own line, and only a host set anybody else's", () => {
    const write = vi.fn(async () => true);
    const { unmount } = wrap(<TopsSection view={view({ tops })} section={section("top_priorities", "Each person's top priority")} busy={false} canHost={false} write={write} />);
    expect(screen.getAllByRole("button", { name: "Set it" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Change" })).toBeNull();
    unmount();
    wrap(<TopsSection view={view({ tops, hosts: true })} section={section("top_priorities", "Each person's top priority")} busy={false} canHost write={write} />);
    expect(screen.getByRole("button", { name: "Change" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set it" })).toBeInTheDocument();
  });

  it("sends a host's line for somebody else with their number", async () => {
    const write = vi.fn(async () => true);
    wrap(<TopsSection view={view({ tops, hosts: true, viewerNo: 9 })} section={section("top_priorities", "Tops")} busy={false} canHost write={write} />);
    fireEvent.click(screen.getByRole("button", { name: "Set it" }));
    fireEvent.change(screen.getByLabelText("Top priority for Ben Ortiz"), { target: { value: "Mend the fence" } });
    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));
    await waitFor(() => expect(write).toHaveBeenCalledWith("/tops", "POST", { text: "Mend the fence", servesGoalId: null, forNo: 2 }));
  });

  it("keeps the board's order only once the facilitator has set the agenda's", () => {
    const board: RoomBoard = {
      items: [{ id: 1, text: "A rain tank", servesGoalId: null, servesGoal: null, ownerRoleId: null, status: "not_started", voteSessionId: 5, voteItemId: 50, place: 1, ownerRole: "Water keeper" }],
      onAgenda: 1,
      orderSet: false,
    };
    const write = vi.fn(async () => true);
    const { unmount } = wrap(<BoardVoteSection view={view({ board, hosts: true })} section={section("priority_vote", "Vote on priorities")} busy={false} canHost write={write} />);
    expect(screen.getByRole("button", { name: "Keep this order on the board" })).toBeDisabled();
    unmount();
    wrap(<BoardVoteSection view={view({ board: { ...board, orderSet: true }, hosts: true })} section={section("priority_vote", "Vote")} busy={false} canHost write={write} />);
    fireEvent.click(screen.getByRole("button", { name: "Keep this order on the board" }));
    expect(write).toHaveBeenCalledWith("/board", "POST", { act: "keep" });
  });
});
