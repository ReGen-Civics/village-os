// @vitest-environment jsdom
/**
 * Logging a place: Save waits while a photo is chosen and not yet used or left
 * out (QA pass 6, P6-3). Before this, a pin saved with no photo and kept the
 * photo's location, with no word to the member.
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import CaptureForm from "./CaptureForm";

beforeAll(() => {
  (globalThis as any).ResizeObserver ??= class { observe() {} disconnect() {} };
  (URL as any).createObjectURL ??= () => "blob:x";
  (URL as any).revokeObjectURL ??= () => undefined;
});
afterEach(cleanup);

const me: any = {
  open: false, vouchedCount: 0, needed: 7, ownPins: 0, allPins: 0, planters: 0, keeper: false, mayApproveExports: false,
  title: "Our map", kindPrompts: { planting: "What went in?", partner: "What kind of place?", stop: "What kind of stop?" },
  labels: { planting: "Plantings", partner: "Partner places", stop: "Stops" },
  kinds: { planting: ["Seeds"], partner: ["Farm"], stop: ["Overnight"] }, openLayers: [], basemap: "none", maxZoom: 13,
  defaultPrecision: "region", teaser: false, precisions: ["exact", "km", "region"], vouchesPerPin: 1, plantingPays: false,
  openedAt: null, openedBefore: 0,
};

describe("CaptureForm", () => {
  it("holds Save while a photo is chosen and not yet used, and frees it when it is left out", async () => {
    render(<CaptureForm me={me} onSend={async () => ({ kept: true, said: "Saved." })} />);
    fireEvent.change(screen.getByLabelText("Paste coordinates or a maps link"), { target: { value: "40.1, -105.2" } });
    const save = screen.getByRole("button", { name: "Save it" }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File([new Uint8Array([1, 2, 3])], "p.jpg", { type: "image/jpeg" })] } });
    await waitFor(() => expect(save.disabled).toBe(true));
    expect(screen.getByText("Use the photo or leave it out first.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Leave it out" }));
    await waitFor(() => expect(save.disabled).toBe(false));
  });

  it("tells the member a keeper sees the exact place while vouching", () => {
    render(<CaptureForm me={me} onSend={async () => ({ kept: true, said: "" })} />);
    expect(screen.getByText(/whoever keeps the map while they vouch for it/)).toBeTruthy();
  });
});
