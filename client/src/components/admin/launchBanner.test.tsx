// @vitest-environment jsdom
/**
 * THE STRIP ABOVE THE ADMIN HEADER, AND THE ONE READ IT SHARES.
 *
 * Two claims:
 *
 *   1. What the strip says follows the launch facts. It is gone once the
 *      checklist froze, it names an open vote, and it stops telling a village
 *      that is already issuing that it is "ready when a founder asks", which
 *      the server refuses.
 *   2. The strip and the "only this village can answer this" prompt sit on the
 *      same admin screen and both need the launch checklist. They used to ask
 *      for it once each. Mounted together they ask ONCE.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { LaunchFacts } from "@shared/launchFacts";
import { forgetLaunchReads, readLaunchFacts, readLaunchStatus } from "@/lib/launchReads";
import VillageAnswers from "./VillageAnswers";
import { launchBannerState, useLaunchBanner } from "./launchBanner";

const FACTS: LaunchFacts = {
  claimed: true,
  issuing: false,
  issuingSince: null,
  voteCarried: false,
  launchedByBallotId: null,
  checklistFrozen: false,
  launchedAt: null,
  voteOpen: false,
  openBallotId: null,
  lastVote: null,
  founderPowerStands: true,
};

const STATUS = {
  items: [
    { id: "village-timezone", title: "Choose the village's timezone", detail: "Still on UTC", state: "missing", fixAt: "/admin?tab=season" },
    { id: "backups-drilled", title: "Take one backup", detail: "Not confirmed yet", state: "missing", fixAt: "/admin?tab=settings" },
  ],
  blockingOpen: 2,
  recommendedOpen: 3,
  launchedAt: null,
};

describe("launchBannerState: what the strip has to say", () => {
  it("says nothing until the checklist has been read", () => {
    expect(launchBannerState(null, FACTS)).toBeNull();
  });

  it("counts the open rows for a village still being built", () => {
    expect(launchBannerState(STATUS, FACTS)).toEqual({ kind: "rows", blocking: 2, recommended: 3, issuingUnvoted: false });
  });

  it("is gone once the checklist froze, which is the fact the row answers' door reads", () => {
    expect(launchBannerState({ ...STATUS, launchedAt: "2026-12-30T18:00:00.000Z" }, { ...FACTS, checklistFrozen: true, launchedAt: "2026-12-30T18:00:00.000Z" })).toBeNull();
  });

  it("names an open vote in place of the rows", () => {
    expect(launchBannerState(STATUS, { ...FACTS, voteOpen: true, openBallotId: "bal-1" })).toEqual({ kind: "vote-open" });
  });

  it("marks a village that is issuing with no vote carried, so its words do not promise the ask", () => {
    expect(launchBannerState({ ...STATUS, blockingOpen: 0 }, { ...FACTS, issuing: true, founderPowerStands: false })).toEqual({
      kind: "rows",
      blocking: 0,
      recommended: 3,
      issuingUnvoted: true,
    });
  });

  it("falls back to launchedAt when the facts could not be read, and never hides an unlaunched village's journey", () => {
    expect(launchBannerState(STATUS, null)).toEqual({ kind: "rows", blocking: 2, recommended: 3, issuingUnvoted: false });
    expect(launchBannerState({ ...STATUS, launchedAt: "2026-12-30T18:00:00.000Z" }, null)).toBeNull();
  });

  it("reads a count the server did not send as zero, never as NaN on the screen", () => {
    expect(launchBannerState({ items: [] }, FACTS)).toEqual({ kind: "rows", blocking: 0, recommended: 0, issuingUnvoted: false });
  });
});

/** The strip as pages/Admin.tsx draws it, without the page. */
function Strip({ token }: { token: string }) {
  const lines = useLaunchBanner(token);
  return lines ? <p data-testid="strip">{lines.full}</p> : null;
}

describe("the strip and the village's answers share one read of the checklist", () => {
  let asked: string[];
  const serve = (facts: LaunchFacts) => {
    asked = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: any) => {
        asked.push(`${url} ${init?.headers?.Authorization ?? ""}`);
        const body = String(url).endsWith("/facts") ? { facts, label: "setup" } : STATUS;
        return { ok: true, status: 200, json: async () => body };
      }),
    );
  };

  beforeEach(() => forgetLaunchReads());
  afterEach(() => {
    vi.unstubAllGlobals();
    forgetLaunchReads();
  });

  it("asks for the checklist once when both are on the screen, with the token", async () => {
    serve(FACTS);
    render(
      <>
        <Strip token="tok-1" />
        <VillageAnswers password="tok-1" />
      </>,
    );
    await waitFor(() => expect(screen.getByTestId("strip")).toBeTruthy());
    await waitFor(() => expect(screen.getByText("Choose the village's timezone")).toBeTruthy());
    expect(asked.filter((a) => a.startsWith("/api/admin/launch "))).toEqual(["/api/admin/launch Bearer tok-1"]);
    expect(asked.filter((a) => a.startsWith("/api/admin/launch/facts "))).toEqual(["/api/admin/launch/facts Bearer tok-1"]);
    expect(screen.getByTestId("strip").textContent).toBe("Journey to Launch: 2 blocking items open · 3 recommended remaining");
  });

  it("tells a village that is already issuing what is true, with no promise the server would refuse", async () => {
    serve({ ...FACTS, issuing: true, founderPowerStands: false });
    render(<Strip token="tok-1" />);
    await waitFor(() => expect(screen.getByTestId("strip")).toBeTruthy());
    const words = screen.getByTestId("strip").textContent ?? "";
    expect(words).toContain("tokens are being issued and no launch vote has carried");
    expect(words).not.toContain("ready when a founder asks");
  });

  it("asks again for another person's token, and again when a caller says fresh", async () => {
    serve(FACTS);
    await readLaunchStatus("tok-1");
    await readLaunchStatus("tok-1");
    expect(asked).toHaveLength(1);
    await readLaunchStatus("tok-2");
    expect(asked).toHaveLength(2);
    await readLaunchFacts("tok-2");
    await readLaunchFacts("tok-2", { fresh: true });
    expect(asked.filter((a) => a.startsWith("/api/admin/launch/facts "))).toHaveLength(2);
  });

  it("answers null when the read fails, and does not throw at the screen", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await readLaunchStatus("tok-1")).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ error: "auth_required" }) })));
    expect(await readLaunchFacts("tok-1", { fresh: true })).toBeNull();
  });
});
