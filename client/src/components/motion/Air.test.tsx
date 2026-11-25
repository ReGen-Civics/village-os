// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import Air, { DAY_PARTS, partOfDay, villageHour } from "./Air";

afterEach(cleanup);

describe("villageHour", () => {
  it("reads the hour on the land, not on the visitor's device", () => {
    // 23:30 UTC is 17:30 in Costa Rica (UTC-6, no daylight saving).
    const at = new Date("2026-11-24T23:30:00Z");
    expect(villageHour("America/Costa_Rica", at)).toBeCloseTo(17.5, 5);
    expect(villageHour("UTC", at)).toBeCloseTo(23.5, 5);
  });
  it("falls back to the device's hour for an unknown zone", () => {
    const at = new Date(2026, 10, 24, 9, 15);
    expect(villageHour("Not/AZone", at)).toBeCloseTo(9.25, 5);
  });
});

describe("partOfDay", () => {
  it("names the light: golden at five, noon at midday, night after dusk, and wraps the clock", () => {
    expect(partOfDay(17)).toBe("golden");
    expect(partOfDay(12.5)).toBe("noon");
    expect(partOfDay(22)).toBe("night");
    expect(partOfDay(2)).toBe("night");
    expect(partOfDay(26)).toBe("night");
    expect(partOfDay(-1)).toBe("night");
    expect(partOfDay(6)).toBe("dawn");
  });
});

describe("the light tokens", () => {
  it("colour every part of the day in motion.css", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const css = fs.readFileSync(path.resolve(__dirname, "motion.css"), "utf8");
    for (const { part } of DAY_PARTS) {
      expect(css, part).toContain(`--m-light-${part}:`);
      expect(css, part).toContain(`.m-air[data-day="${part}"]`);
    }
  });
});

describe("Air", () => {
  it("is decoration: hidden from assistive tech, and lit by the village's hour", () => {
    const { container } = render(<Air timeZone="America/Costa_Rica" />);
    const root = container.querySelector<HTMLElement>(".m-air")!;
    expect(root.getAttribute("aria-hidden")).toBe("true");
    expect(DAY_PARTS.map((d) => d.part)).toContain(root.dataset.day);
    expect(container.querySelectorAll(".m-dapple")).toHaveLength(3);
  });

  it("keeps every firefly slow: no cycle under seven seconds, far below any flash threshold", () => {
    const { container } = render(<Air />);
    const motes = Array.from(container.querySelectorAll<HTMLElement>(".m-mote"));
    expect(motes).toHaveLength(12);
    for (const m of motes) expect(parseFloat(m.style.getPropertyValue("--t"))).toBeGreaterThanOrEqual(7);
  });
});
