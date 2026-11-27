// @vitest-environment jsdom
/**
 * The Pull a card speed card (registered.ts): registered first, a default after Journal, it opens today's card,
 * and it shows only while the Gene Keys module is on AND the member has found their lines, never while the lines
 * are still being read.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";

const lines = vi.hoisted(() => ({ on: true, mine: undefined as unknown }));
vi.mock("@/components/geneKeys/useMyGeneKeys", () => ({ useMyGeneKeys: () => ({ on: lines.on, mine: lines.on ? lines.mine : null }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/lib/gameApi", () => ({ gameFetch: vi.fn() }));

import { PULL_A_CARD, REGISTERED_CARDS, usePullACardShown } from "./registered";
import { PULL_A_CARD_ID } from "./registry";

afterEach(() => cleanup());

describe("the Pull a card speed card", () => {
  it("is registered under the lane's id, opens today's card, and stands after Journal among the defaults", () => {
    expect(REGISTERED_CARDS[0]).toBe(PULL_A_CARD);
    expect(PULL_A_CARD).toMatchObject({ id: PULL_A_CARD_ID, href: "/profile/today-card", defaultAfter: "/journal" });
    expect(String(PULL_A_CARD.label.message)).toBe("Pull a card");
  });

  it("shows only with the module on and the member's lines found", () => {
    lines.on = true;
    lines.mine = undefined;
    expect(renderHook(() => usePullACardShown()).result.current).toBe(false);
    lines.mine = null;
    expect(renderHook(() => usePullACardShown()).result.current).toBe(false);
    lines.mine = { type: "Projector" };
    expect(renderHook(() => usePullACardShown()).result.current).toBe(true);
    lines.on = false;
    expect(renderHook(() => usePullACardShown()).result.current).toBe(false);
  });
});
