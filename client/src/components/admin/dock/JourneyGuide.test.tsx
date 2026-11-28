// @vitest-environment jsdom
/**
 * THE GUIDE ON THE ROAD TO LAUNCH (./JourneyGuide.tsx). With the village's
 * dock dial off the page draws the launch guide it always drew. With it on,
 * the guide's dock stands in its place and offers the same two conversations
 * on the same two routes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/gameApi", () => ({ authToken: () => "tok" }));
vi.mock("@/components/MicButton", () => ({ default: () => null }));

import { JourneyGuide } from "./JourneyGuide";

const STATUS = { on: true, guide: "Sol", off: null, provider: "anthropic", available: ["anthropic"], names: { anthropic: "Sol" } };

let calls: Array<{ url: string; method: string; init: any }>;
let dockDial: boolean;
beforeEach(() => {
  calls = [];
  dockDial = false;
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: any = {}) => {
    const method = init.method ?? "GET";
    calls.push({ url, method, init });
    const ok = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body }) as any;
    if (method === "GET" && url === "/api/admin/helper") return ok(200, dockDial ? { ...STATUS, dock: true } : STATUS);
    if (method === "POST" && url === "/api/admin/assistant/launch") return ok(200, { reply: "Start with the closing policy." });
    if (method === "POST" && url === "/api/admin/assistant/organize") return ok(200, { reply: "Consent first." });
    throw new Error(`unexpected ${method} ${url}`);
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const settled = () => waitFor(() => expect(calls.some((c) => c.url === "/api/admin/helper")).toBe(true));

describe("the dial off", () => {
  it("draws the launch guide, with its two tabs and its own Close, and no dock", async () => {
    render(<JourneyGuide open onClose={vi.fn()} admin />);
    await settled();
    // The launch guide's own panel: its tabs are plain buttons and its close is the word.
    expect(screen.getByRole("button", { name: "Launch" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Organizing" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
    expect(screen.getByText(/I can see exactly where your launch stands/)).toBeTruthy();
    expect(screen.queryByTestId("guide-dock")).toBeNull();
    expect(Object.keys(localStorage).filter((k) => k.startsWith("guide-dock"))).toEqual([]);
  });

  it("asks through the launch guide's own route, as it always did", async () => {
    render(<JourneyGuide open onClose={vi.fn()} admin />);
    await settled();
    await userEvent.type(screen.getByRole("textbox", { name: "Your question" }), "what is blocking?{Enter}");
    expect(await screen.findByText("Start with the closing policy.")).toBeTruthy();
    expect(calls.filter((c) => c.method === "POST").map((c) => c.url)).toEqual(["/api/admin/assistant/launch"]);
  });

  it("draws nothing and asks nothing while closed, so the page loads exactly as it did, and never asks for anyone who is not an admin", async () => {
    const closed = render(<JourneyGuide open={false} onClose={vi.fn()} admin />);
    expect(closed.container.textContent).toBe("");
    await Promise.resolve();
    expect(calls).toEqual([]);
    closed.unmount();
    // Even with a hint left by an admin on this browser, a member gets the launch guide and no status is read.
    localStorage.setItem("guide-dock:on", "1");
    render(<JourneyGuide open onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
    expect(screen.queryByTestId("guide-dock")).toBeNull();
    expect(calls).toEqual([]);
  });
});

describe("the dial on", () => {
  beforeEach(() => {
    dockDial = true;
  });

  it("puts the dock in the launch guide's place, wide while the village is still on the road", async () => {
    render(<JourneyGuide open onClose={vi.fn()} admin />);
    const dock = await screen.findByTestId("guide-dock");
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    expect(dock.getAttribute("data-shape")).toBe("expanded");
    expect(dock.getAttribute("data-dialogue")).toBe("");
    expect(within(dock).getByRole("heading", { name: "Sol" })).toBeTruthy();
    expect(localStorage.getItem("guide-dock:on")).toBe("1");
    // One read of the status, the page's own.
    expect(calls.filter((c) => c.url === "/api/admin/helper")).toHaveLength(1);
  });

  it("offers the launch guide's two conversations, each on its own route", async () => {
    render(<JourneyGuide open onClose={vi.fn()} admin />);
    const dock = await screen.findByTestId("guide-dock");
    expect(within(dock).getByRole("button", { name: "Launch" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.type(within(dock).getByRole("textbox", { name: "Your question" }), "what is blocking?{Enter}");
    expect(await within(dock).findByText("Start with the closing policy.")).toBeTruthy();
    await userEvent.click(within(dock).getByRole("button", { name: "Organizing" }));
    await userEvent.type(within(dock).getByRole("textbox", { name: "Your question" }), "how do we decide?{Enter}");
    expect(await within(dock).findByText("Consent first.")).toBeTruthy();
    const posts = calls.filter((c) => c.method === "POST");
    expect(posts.map((c) => c.url)).toEqual(["/api/admin/assistant/launch", "/api/admin/assistant/organize"]);
    expect(posts.every((c) => c.init.headers.Authorization === "Bearer tok")).toBe(true);
    expect(posts.every((c) => Object.keys(JSON.parse(c.init.body)).join() === "messages")).toBe(true);
  });

  it("offers organizing alone once the village is live, docked at the side", async () => {
    render(<JourneyGuide open onClose={vi.fn()} admin launched />);
    const dock = await screen.findByTestId("guide-dock");
    expect(dock.getAttribute("data-shape")).toBe("docked");
    expect(within(dock).queryByRole("button", { name: "Launch" })).toBeNull();
    expect(within(dock).getByText(/Ask me about organizing/)).toBeTruthy();
  });

  it("closes through the page's own handler", async () => {
    const onClose = vi.fn();
    render(<JourneyGuide open onClose={onClose} admin launched />);
    await userEvent.click(await screen.findByRole("button", { name: "Close the guide" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
