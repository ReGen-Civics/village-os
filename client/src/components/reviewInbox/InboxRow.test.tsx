// @vitest-environment jsdom
/** One row on /admin/review: an agent's proposal that lapses undecided says when, and nothing else claims a date. */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import InboxRow from "./InboxRow";

const base = { source: "agent" as const, kind: "seating", code: null, summary: "Seat someone", filedAt: "2026-11-20T00:00:00.000Z", batch: null, decideAt: "/approvals", touchesPerson: true };

afterEach(() => cleanup());

describe("a row on the one list", () => {
  it("says when an agent's proposal lapses if nobody decides it", () => {
    render(<ul><InboxRow item={{ ...base, key: "agent:seating:s1", lapsesAt: "2026-11-27T00:00:00.000Z" }} /></ul>);
    expect(screen.getByTestId("lapses-agent:seating:s1").textContent).toBe("Lapses on Nov 27 if nobody decides it");
  });

  it("names no lapse for what waits until somebody decides it", () => {
    render(<ul><InboxRow item={{ ...base, key: "structure:d1", kind: "role_change", lapsesAt: null }} /></ul>);
    expect(screen.queryByTestId("lapses-structure:d1")).toBeNull();
  });
});
