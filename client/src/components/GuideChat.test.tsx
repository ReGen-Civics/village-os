// @vitest-environment jsdom
/**
 * START A VENTURE OPENS ON THE BUSINESS (the lead, 24 Nov 2026). On /work-with-us?kind=venture the guide's first
 * message asks what the business is, the server hears `focus: "venture"`, and what is sent says `kind: "venture"`.
 * Without it the guide opens as it always did.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/components/MicButton", () => ({ default: () => null }));
const sent = vi.hoisted(() => ({ calls: [] as unknown[][] }));
vi.mock("@/lib/proposals", () => ({
  sendProposal: async (...args: unknown[]) => {
    sent.calls.push(args);
    return { ok: true, idea: null };
  },
}));

import GuideChat from "./GuideChat";

const asked: Record<string, unknown>[] = [];
beforeEach(() => {
  sent.calls = [];
  asked.length = 0;
  Element.prototype.scrollTo = (() => {}) as typeof Element.prototype.scrollTo;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      asked.push(JSON.parse(String(init?.body ?? "{}")));
      return { ok: true, status: 200, json: async () => ({ reply: "Lovely.", complete: true, proposal: { name: "Ana", work: "A bakery." } }) };
    }) as unknown as typeof fetch,
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const chat = (venture?: boolean) =>
  render(
    <GuideChat kind="work-with-us" projectName="Willowbrook" assistantName="Juniper" greeting="Hello from the village's own greeting." empty={{}} onSubmitted={() => {}} onFallback={() => {}} onRefineInForm={() => {}} venture={venture} />,
  );

async function talkAndSend() {
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "A bakery." } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  fireEvent.click(await screen.findByRole("button", { name: /Send proposal/ }));
  await vi.waitFor(() => expect(sent.calls).toHaveLength(1));
}

describe("the guide, set up for a venture", () => {
  it("opens on the business, tells the server it is a venture, and sends kind: venture", async () => {
    chat(true);
    expect(screen.getByText(/^Hi, I'm Juniper\. Let's shape your venture together, one question at a time: what the business is, what it needs from the land and the village, and how it gives back\. First, what is the business, and who is it for\?$/)).toBeTruthy();
    await talkAndSend();
    expect(asked[0]).toMatchObject({ kind: "work-with-us", focus: "venture" });
    expect(sent.calls[0]).toEqual(["work-with-us", { name: "Ana", work: "A bakery.", kind: "venture" }]);
  });

  it("CONTROL: without it the guide says the village's own greeting, sends no focus and no kind", async () => {
    chat();
    expect(screen.getByText("Hello from the village's own greeting.")).toBeTruthy();
    expect(screen.queryByText(/your venture/)).toBeNull();
    await talkAndSend();
    expect(asked[0]).not.toHaveProperty("focus");
    expect(sent.calls[0]).toEqual(["work-with-us", { name: "Ana", work: "A bakery." }]);
  });
});
