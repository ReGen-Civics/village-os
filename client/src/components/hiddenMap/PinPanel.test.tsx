// @vitest-environment jsdom
/**
 * Vouching from a pin (QA pass 3, P3-3): the voucher reads the village's own
 * rule, says how they saw the place from the ways the village accepts, and
 * only then can vouch. The way goes to the server with the vouch.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const vouched: any[] = [];
vi.mock("@/lib/hiddenMapApi", async (orig) => ({
  ...(await orig<typeof import("@/lib/hiddenMapApi")>()),
  getPin: async () => ({
    pin: {
      id: "hmp-1", mine: false, layer: "planting", kind: "Seeds", lat: 1, lng: 2, precision: "region", title: "A bed",
      whatWentIn: null, notes: null, stage: "seed", partnerState: null, plantedOn: null, native: false, hidden: false,
      createdAt: "2026-11-15T00:00:00Z", vouches: 0, vouchedByMe: false, photoIds: [],
    },
    visits: [],
    mayVisit: true,
  }),
  vouch: async (id: string, seen: string) => { vouched.push({ id, seen }); return { vouches: 1 }; },
}));

import PinPanel from "./PinPanel";

afterEach(cleanup);

const me: any = {
  open: true, keeper: false, labels: { planting: "Plantings", partner: "P", stop: "S" }, vouchWays: ["in-person", "call"],
  vouchRule: "A sworn member who saw it planted.", vouchesPerPin: 1,
};

describe("vouching from a pin", () => {
  it("shows the village's rule, offers only its ways, and sends the way chosen", async () => {
    // The outbox props arrive with slice 4; spread loosely so this test reads the same on every slice.
    const later: any = { owner: "u-1", onQueueVisit: async () => undefined };
    render(<PinPanel id="hmp-1" me={me} onChanged={() => undefined} onClose={() => undefined} {...later} />);
    fireEvent.click(await screen.findByRole("button", { name: "Vouch: this is real" }));
    expect(screen.getByText("A sworn member who saw it planted.")).toBeTruthy();
    expect(screen.queryByLabelText("The photos leave no doubt")).toBeNull();
    const go = screen.getByRole("button", { name: "Vouch" }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText("I saw it on a live call"));
    expect(go.disabled).toBe(false);
    fireEvent.click(go);
    await waitFor(() => expect(vouched).toEqual([{ id: "hmp-1", seen: "call" }]));
  });
});
