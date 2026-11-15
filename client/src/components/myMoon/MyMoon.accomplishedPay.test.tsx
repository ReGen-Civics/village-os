// @vitest-environment jsdom
/**
 * Paid on what we truly accomplish (Rye, 14 Nov 2026): every seated holder
 * reads how pay works under the My moon header, and every candidate reads the
 * same promise on the goals step of a proposal.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ACCOMPLISHED_PAY_WORDS } from "@shared/accomplishedPay";
import { MyMoonView } from "./MyMoon";
import { myMoon } from "./myMoon.fixture";

afterEach(cleanup);

describe("How pay works, under the My moon header", () => {
  it("names goals, the other tasks, a change either way and the Treasurer's confirmation", () => {
    render(<MyMoonView data={myMoon()} villageRoles={[]} onCycle={() => {}} reload={async () => null} />);
    const box = screen.getByTestId("accomplished-pay");
    const words = box.textContent ?? "";
    expect(words).toContain(ACCOMPLISHED_PAY_WORDS.title);
    expect(words).toContain(ACCOMPLISHED_PAY_WORDS.goals);
    expect(words).toContain(ACCOMPLISHED_PAY_WORDS.review);
    expect(words).toContain(ACCOMPLISHED_PAY_WORDS.confirm);
  });

  it("shows for a member with no roles yet too, so nobody starts a moon without it", () => {
    render(<MyMoonView data={myMoon({ roles: [], items: [] })} villageRoles={[]} onCycle={() => {}} reload={async () => null} />);
    expect(screen.getByTestId("accomplished-pay")).toBeTruthy();
  });
});

describe("The words themselves", () => {
  it("say goals guide us, pay follows what we accomplish, it can go up or down, and nothing pays until the Treasurer confirms", () => {
    const all = Object.values(ACCOMPLISHED_PAY_WORDS).join(" ");
    expect(all).toContain("truly accomplish");
    expect(all).toContain("outside your roles");
    expect(all).toContain("up or down");
    expect(all).toContain("nothing is paid until the Treasurer confirms");
  });
});
