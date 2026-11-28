// @vitest-environment jsdom
/**
 * The rung a member crossed still plays once on the profile after GameDashboard left My work: the page
 * claims it off its own /api/game/me read, once per crossing, and never for a payload without one.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import type { GameMe } from "@/lib/gameApi";
import { useClaimedAdvance } from "./useClaimedAdvance";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const me = (lastAdvance: GameMe["lastAdvance"]) => ({ lastAdvance }) as GameMe;
const crossing = { fromStage: "seedling", toStage: "sprout", unlocked: ["quests.claim"], at: "2026-11-27T10:00:00.000Z" };

describe("useClaimedAdvance", () => {
  it("hands up a fresh crossing once, however many reads carry it", () => {
    const onAdvance = vi.fn();
    const { rerender } = renderHook(({ m }) => useClaimedAdvance(m, onAdvance), { initialProps: { m: me(crossing) } });
    rerender({ m: me({ ...crossing }) });
    expect(onAdvance).toHaveBeenCalledTimes(1);
    expect(onAdvance).toHaveBeenCalledWith(crossing);
    // A second mount (a reload) finds it claimed already.
    renderHook(() => useClaimedAdvance(me(crossing), onAdvance));
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it("does nothing before the read lands or for a member who never advanced", () => {
    const onAdvance = vi.fn();
    renderHook(() => useClaimedAdvance(null, onAdvance));
    renderHook(() => useClaimedAdvance(me(null), onAdvance));
    expect(onAdvance).not.toHaveBeenCalled();
  });
});
