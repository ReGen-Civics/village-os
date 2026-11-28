// @vitest-environment jsdom
/**
 * THE EMPTY LIVE ROOM SAYS THE PLAIN FACT, ALONE (copy key R49, 28 Nov 2026).
 *
 * The founder's pick, from the kinds in docs/COPY_STYLE_KEY.md: a place waiting on others says the plain fact and
 * nothing around it. "Nobody has arrived yet." replaces R48's "The room is quiet. Nobody has arrived yet.", since
 * "quiet" is the all-clear's word (nothing needs you) and a room waiting on people is not that.
 *
 * Two copies carry the line (the server's `ROOM_COPY` and the client's mirror in roomWords.ts), and
 * roomWords.test.ts holds them equal to each other. This file holds the pick itself, and draws the one place the
 * line is read: the list of who is here, with nobody in it.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ROOM_COPY } from "@shared/sessions";
import PeopleHere from "./PeopleHere";
import { makeView } from "./__tests__/roomFixture";

const PICK = "Nobody has arrived yet.";

describe("the room with nobody in it (R49)", () => {
  it("keeps the founder's line in the shared words", () => {
    expect(ROOM_COPY.nobodyHere).toBe(PICK);
  });

  it.each([false, true])("draws that line and no other, in the full list and the header strip (compact: %s)", (compact) => {
    const { container } = render(<PeopleHere view={makeView({ people: [] })} compact={compact} />);
    expect(screen.getByText(PICK)).toBeTruthy();
    expect((container.textContent ?? "").trim()).toBe(PICK);
  });
});
