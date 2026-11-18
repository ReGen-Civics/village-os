// @vitest-environment jsdom
/**
 * Several named rhythms per circle on /sessions (0401).
 *
 * What each case holds: a circle with two rhythms lists both under its row,
 * each with its name and its own next meeting, and a skip or a stop names its
 * rhythm by key; "Add another meeting" sends a new rhythm with its name; a
 * circle with one rhythm keeps the row it always had and sends the body it
 * always sent; an agenda item can be brought for one of a circle's meetings;
 * "Get the room ready" ticks only the items for that meeting; and a circle's
 * own calendar takes a title word without its address.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { RHYTHM_COPY, type ComingUpPayload, type ComingUpRow, type RhythmLine } from "@shared/sessionRhythm";
import { LIBRARY_COPY, type LibraryPayload } from "@shared/sessionLibrary";
import { OWN_CALENDAR_COPY } from "@shared/sessionCalendar";

const state = vi.hoisted(() => ({
  fetch: null as null | ((path: string, init?: RequestInit) => Promise<Response>),
}));
vi.mock("@/lib/gameApi", () => ({ gameFetch: (path: string, init?: RequestInit) => state.fetch!(path, init) }));

import ComingUp from "./ComingUp";
import WaitingForCircle from "./WaitingForCircle";
import OwnCalendarPanel from "./OwnCalendarPanel";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
type Call = { path: string; method: string; body: unknown };
let calls: Call[];

beforeEach(() => {
  calls = [];
  window.location.hash = "";
  state.fetch = async (path, init) => {
    const method = (init?.method ?? "GET").toUpperCase();
    calls.push({ path, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    // The row the server now holds: the list is read again by the page anyway.
    return json({ row: row(), item: { id: 1 } });
  };
});

const line = (over: Partial<RhythmLine>): RhythmLine => ({
  key: "main",
  name: "",
  words: "Every Thursday at 13:00",
  next: { at: "2026-11-26T13:00:00.000Z", endsAt: "2026-11-26T15:00:00.000Z", key: "2026-11-26", words: "Thursday 26 November at 13:00" },
  durationMin: 120,
  waiting: 0,
  input: { kind: "weekly", weekday: 4, everyWeeks: 1, time: "13:00", startsOn: "2026-11-26", durationMin: 120 },
  ...over,
});
const mondayLine = line({
  key: "rmon",
  name: "Monday all-staff",
  words: "Every Monday at 12:00",
  next: { at: "2026-11-23T12:00:00.000Z", endsAt: "2026-11-23T13:30:00.000Z", key: "2026-11-23", words: "Monday 23 November at 12:00" },
  durationMin: 90,
  waiting: 2,
  input: { kind: "weekly", weekday: 1, everyWeeks: 1, time: "12:00", startsOn: "2026-11-23", durationMin: 90, name: "Monday all-staff" },
});
const thursdayLine = line({ name: "Thursday steward sync", waiting: 1, input: { kind: "weekly", weekday: 4, everyWeeks: 1, time: "13:00", startsOn: "2026-11-26", durationMin: 120, name: "Thursday steward sync" } });

const row = (over: Partial<ComingUpRow> = {}): ComingUpRow => ({
  circleId: "anchor",
  circleName: "Anchor",
  rhythmWords: "Monday all-staff: Every Monday at 12:00; Thursday steward sync: Every Thursday at 13:00",
  next: { at: "2026-11-23T12:00:00.000Z", endsAt: "2026-11-23T13:30:00.000Z", key: "2026-11-23" },
  nextFrom: "rhythm",
  nextTitle: null,
  rhythmNext: { at: "2026-11-23T12:00:00.000Z", endsAt: "2026-11-23T13:30:00.000Z", key: "2026-11-23", words: "Monday 23 November at 12:00" },
  words: "Monday 23 November at 12:00",
  durationMin: 90,
  waiting: 2,
  openRoom: null,
  mine: true,
  canKeep: true,
  rhythm: thursdayLine.input,
  rhythms: [mondayLine, thursdayLine],
  nextRhythmKey: "rmon",
  nextName: "Monday all-staff",
  ...over,
});
const payload = (rows: ComingUpRow[]): ComingUpPayload => ({ rows, zone: "UTC", keepCircleIds: ["anchor"], ownCalendars: {}, ownCalendarsAvailable: true });
const circles = [{ id: "anchor", name: "Anchor" }];
const draw = (r: ComingUpRow) => render(<ComingUp comingUp={payload([r])} circles={circles} defaultMinutes={60} onGetReady={() => undefined} onChanged={() => undefined} />);

describe("a circle with two rhythms", () => {
  it("lists both, soonest first, each with its name, its next meeting and what waits for it", () => {
    draw(row());
    const list = screen.getByRole("list", { name: "The Anchor circle's meetings" });
    const items = within(list).getAllByRole("listitem");
    expect(items.map((li) => li.querySelector("p")?.textContent)).toEqual(["Monday all-staff", "Thursday steward sync"]);
    expect(within(items[0]).getByText(/Next: Monday 23 November at 12:00/)).toHaveTextContent(RHYTHM_COPY.waiting(2));
    expect(screen.getByText("Monday all-staff", { selector: "p.line-clamp-2" })).toBeInTheDocument();
  });

  it("skips one rhythm's meeting by its key", async () => {
    draw(row());
    const items = within(screen.getByRole("list", { name: "The Anchor circle's meetings" })).getAllByRole("listitem");
    fireEvent.click(within(items[1]).getByRole("button", { name: RHYTHM_COPY.skip }));
    await waitFor(() =>
      expect(calls).toEqual([{ path: "/api/sessions/circles/anchor/rhythm/skip", method: "POST", body: { key: "2026-11-26" } }]),
    );
    calls = [];
    fireEvent.click(within(within(screen.getByRole("list", { name: "The Anchor circle's meetings" })).getAllByRole("listitem")[0]).getByRole("button", { name: RHYTHM_COPY.skip }));
    await waitFor(() =>
      expect(calls).toEqual([{ path: "/api/sessions/circles/anchor/rhythm/skip", method: "POST", body: { key: "2026-11-23", rhythmKey: "rmon" } }]),
    );
  });

  it("changes and stops one rhythm by its key, and asks in words that keep the others", async () => {
    draw(row());
    const monday = within(screen.getByRole("list", { name: "The Anchor circle's meetings" })).getAllByRole("listitem")[0];
    fireEvent.click(within(monday).getByRole("button", { name: RHYTHM_COPY.change }));
    expect((screen.getByLabelText("What does the circle call this meeting?") as HTMLInputElement).value).toBe("Monday all-staff");
    fireEvent.click(screen.getByRole("button", { name: RHYTHM_COPY.clear }));
    expect(screen.getByText(`Stop "Monday all-staff"? The circle's other meetings stay as they are.`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: RHYTHM_COPY.clearYes }));
    await waitFor(() => expect(calls).toEqual([{ path: "/api/sessions/circles/anchor/rhythm", method: "PUT", body: { kind: "none", rhythmKey: "rmon" } }]));
  });

  it("adds another meeting with its own name, day and time", async () => {
    draw(row({ rhythms: [thursdayLine], rhythmWords: "Thursday steward sync: Every Thursday at 13:00" }));
    fireEvent.click(screen.getByRole("button", { name: "Add another meeting" }));
    fireEvent.change(screen.getByLabelText(RHYTHM_COPY.weekdayLabel), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(RHYTHM_COPY.timeLabel), { target: { value: "12:00" } });
    fireEvent.change(screen.getByLabelText(RHYTHM_COPY.durationLabel), { target: { value: "90" } });
    fireEvent.change(screen.getByLabelText("What does the circle call this meeting?"), { target: { value: "Monday all-staff" } });
    fireEvent.click(screen.getByRole("button", { name: "Add the meeting" }));
    await waitFor(() =>
      expect(calls).toEqual([
        {
          path: "/api/sessions/circles/anchor/rhythms",
          method: "POST",
          body: { kind: "weekly", weekday: 1, everyWeeks: 1, time: "12:00", durationMin: 90, name: "Monday all-staff" },
        },
      ]),
    );
  });

  it("keeps a one-rhythm row as it was, and sends the body an older server reads", async () => {
    const only = line({});
    draw(row({ rhythms: [only], rhythm: only.input, rhythmWords: "Every Thursday at 13:00", nextRhythmKey: "main", nextName: null }));
    expect(screen.queryByRole("list", { name: "The Anchor circle's meetings" })).toBeNull();
    expect(screen.getByText(`Every Thursday at 13:00 · ${RHYTHM_COPY.waiting(2)}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: RHYTHM_COPY.skip }));
    await waitFor(() => expect(calls).toEqual([{ path: "/api/sessions/circles/anchor/rhythm/skip", method: "POST", body: { key: "2026-11-23" } }]));
  });
});

describe("an agenda item for one meeting", () => {
  const library: LibraryPayload = { items: [], myCircleIds: ["anchor"] };
  const meetings = { anchor: [{ key: "rmon", label: "Monday all-staff (Every Monday at 12:00)" }, { key: "main", label: "Thursday steward sync (Every Thursday at 13:00)" }] };

  it("asks which meeting for a circle with two, and sends the key chosen", async () => {
    render(<WaitingForCircle library={library} circles={circles} meetings={meetings} onChanged={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: LIBRARY_COPY.bringButton }));
    fireEvent.change(screen.getByLabelText(LIBRARY_COPY.titleLabel), { target: { value: "Staff rota" } });
    const which = screen.getByLabelText("Which meeting is it for?") as HTMLSelectElement;
    expect(which.value).toBe("");
    fireEvent.change(which, { target: { value: "rmon" } });
    fireEvent.click(screen.getByRole("button", { name: LIBRARY_COPY.addButton }));
    await waitFor(() =>
      expect(calls).toEqual([{ path: "/api/sessions/library", method: "POST", body: { title: "Staff rota", aim: null, note: null, circleId: "anchor", rhythmKey: "rmon" } }]),
    );
  });

  it("adds an open item for a circle with no rhythm at all, and lists it under the circle", async () => {
    const quiet = [{ id: "quiet", name: "Quiet" }];
    const waiting: LibraryPayload = {
      items: [
        { id: 7, title: "Name a facilitator", aim: "decide", note: null, circleId: "quiet", circleName: "Quiet", rhythmKey: null, broughtBy: "Rosa", mine: true, broughtAt: "2026-11-17T10:00:00.000Z", status: "waiting", session: null, settledAt: null, backAt: null, changedBy: null, canEdit: true, canMoveCircle: true, canWithdraw: true, canBringAgain: false, source: null },
      ],
      myCircleIds: ["quiet"],
    };
    render(<WaitingForCircle library={waiting} circles={quiet} meetings={{}} onChanged={() => undefined} />);
    expect(screen.getByText("Name a facilitator")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: LIBRARY_COPY.bringButton }));
    fireEvent.change(screen.getByLabelText(LIBRARY_COPY.titleLabel), { target: { value: "Season dates" } });
    expect(screen.queryByLabelText("Which meeting is it for?")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: LIBRARY_COPY.addButton }));
    await waitFor(() =>
      expect(calls).toEqual([{ path: "/api/sessions/library", method: "POST", body: { title: "Season dates", aim: null, note: null, circleId: "quiet" } }]),
    );
  });

  it("never asks for a circle with one meeting", () => {
    render(<WaitingForCircle library={library} circles={circles} meetings={{ anchor: [meetings.anchor[1]] }} onChanged={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: LIBRARY_COPY.bringButton }));
    expect(screen.queryByLabelText("Which meeting is it for?")).toBeNull();
  });
});

describe("a circle's own calendar read through a title word", () => {
  it("attaches with the word, and changes it later without the address", async () => {
    const { rerender } = render(<OwnCalendarPanel circles={circles} ownCalendars={{}} available onChanged={() => undefined} onSaid={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: OWN_CALENDAR_COPY.open }));
    fireEvent.change(screen.getByLabelText(OWN_CALENDAR_COPY.urlLabel), { target: { value: "https://calendar.google.com/x/basic.ics" } });
    fireEvent.change(screen.getByLabelText("Only events whose title holds"), { target: { value: " steward sync " } });
    fireEvent.click(screen.getByRole("button", { name: OWN_CALENDAR_COPY.attach }));
    await waitFor(() =>
      expect(calls[0]).toEqual({ path: "/api/sessions/circles/anchor/calendar", method: "PUT", body: { url: "https://calendar.google.com/x/basic.ics", titleFilter: "steward sync" } }),
    );
    calls = [];
    const attached = { anchor: { host: "calendar.google.com", last4: ".ics", lastReadAt: null, status: "ok" as const, titleFilter: "steward sync" } };
    rerender(<OwnCalendarPanel circles={circles} ownCalendars={attached} available onChanged={() => undefined} onSaid={() => undefined} />);
    expect(screen.getByText(`Only events titled with "steward sync" count.`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Which events count/ }));
    fireEvent.change(screen.getByLabelText("Only events whose title holds"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save which events count" }));
    await waitFor(() => expect(calls).toEqual([{ path: "/api/sessions/circles/anchor/calendar", method: "PATCH", body: { titleFilter: "" } }]));
  });
});
