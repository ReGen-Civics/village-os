// @vitest-environment jsdom
/**
 * The Pull a card speed card (registered.ts): registered first, a default after Journal, it opens today's card,
 * and it shows only while the Gene Keys module is on AND the member has found their lines; while the catalog or
 * the lines are still being read it answers null, so the sheet holds the slot.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";

const lines = vi.hoisted(() => ({ on: true, mine: undefined as unknown }));
vi.mock("@/components/geneKeys/useMyGeneKeys", () => ({ useMyGeneKeys: () => ({ on: lines.on, mine: lines.on ? lines.mine : null }) }));
const catalog = vi.hoisted(() => ({ loaded: true }));
vi.mock("@/modules/ModuleProvider", () => ({ useModules: () => ({ loaded: catalog.loaded, failed: false, modules: [] }) }));
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

  it("shows only with the module on and the member's lines found, and holds the slot (null) while either is read", () => {
    const shown = () => renderHook(() => usePullACardShown()).result.current;
    catalog.loaded = false;
    lines.on = false;
    expect(shown()).toBeNull();
    catalog.loaded = true;
    lines.on = true;
    lines.mine = undefined;
    expect(shown()).toBeNull();
    lines.mine = null;
    expect(shown()).toBe(false);
    lines.mine = { type: "Projector" };
    expect(shown()).toBe(true);
    lines.on = false;
    expect(shown()).toBe(false);
  });
});
