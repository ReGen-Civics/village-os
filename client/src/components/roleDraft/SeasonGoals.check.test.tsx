// @vitest-environment jsdom
/**
 * A reached goal's ring fills gold and takes a check. RING sets text-notice,
 * which beat a text-background on the ring, so the check drew gold on its own
 * gold fill and nobody could see it. The check carries its own colour.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";

vi.mock("@/lib/gameApi", () => ({
  useSeason: () => ({ current: { name: "Season of Seeds", startsOn: "2026-10-25", endsOn: "2027-04-23", goals: [{ id: "g1", text: "Plant the food forest" }, { id: "g2", text: "Open the first home", done: true }] } }),
}));
vi.mock("@/components/commons/Commons", () => ({ default: () => null }));
vi.mock("@/components/commons/goalOpenWork", () => ({ useGoalOpenWork: () => null, openWorkFor: () => null }));
vi.mock("@/components/commons/CommonsPanel", () => ({ GoalWords: ({ goal }: { goal: { text: string } }) => <span>{goal.text}</span> }));
vi.mock("wouter", () => ({ Link: ({ children, href }: { children: unknown; href: string }) => <a href={href}>{children as never}</a> }));

import SeasonGoals from "./SeasonGoals";

afterEach(cleanup);

describe("the /roles season goals", () => {
  it("draws a reached goal's check in its own colour, so it shows on the gold fill", () => {
    i18n.loadAndActivate({ locale: "en", messages: {} });
    render(
      <I18nProvider i18n={i18n}>
        <SeasonGoals />
      </I18nProvider>,
    );
    const reached = screen.getByText("Open the first home").closest("li")!;
    expect(reached.getAttribute("data-done")).toBe("true");
    expect(reached.querySelector("svg")!.getAttribute("class")).toContain("text-background");
    expect(screen.getByText("Plant the food forest").closest("li")!.querySelector("svg")).toBeNull();
  });
});
