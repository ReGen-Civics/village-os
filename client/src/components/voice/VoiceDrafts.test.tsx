// @vitest-environment jsdom
/**
 * Drafts from what was said reach the form only through "Use this", only for
 * answers still empty, and as the applicant edited them (shared/voiceDrafts.ts).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { VOICE_DRAFT_WORDS } from "@shared/voiceDrafts";
import { VoiceDrafts, offeredParts } from "./VoiceDrafts";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const HEARD = "I have run the seed library on my road for six years, and I want to bring people to the land the same way.";
const ALL_EMPTY = { why: true, aim: true, story: true, items: true };

describe("drafts from what was said", () => {
  it("offers a draft only for answers still empty", () => {
    const draft = { why: "Why.", aim: "Aim.", story: "Story.", items: [{ title: "T", doneWhen: "D" }] };
    expect(offeredParts(draft, ALL_EMPTY)).toEqual(draft);
    expect(offeredParts(draft, { why: false, aim: true, story: false, items: false })).toEqual({ aim: "Aim." });
    expect(offeredParts(draft, { why: true, aim: false, story: false, items: false })).toEqual({ why: "Why." });
  });

  it("is not offered with too little said", () => {
    render(<VoiceDrafts heard="Hello there." drafting={{ roleId: "r1", empty: ALL_EMPTY, onUse: () => {} }} />);
    expect(screen.queryByRole("button", { name: VOICE_DRAFT_WORDS.button })).toBeNull();
  });

  it("says what it sends, shows each draft to edit, and puts in only what is used, as edited", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ draft: { why: "I keep seed.", aim: "A swap every moon." } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const onUse = vi.fn();
    render(<VoiceDrafts heard={HEARD} drafting={{ roleId: "r1", empty: ALL_EMPTY, onUse }} />);
    expect(screen.getByText(VOICE_DRAFT_WORDS.sends)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: VOICE_DRAFT_WORDS.button }));
    await waitFor(() => expect(screen.getByText(VOICE_DRAFT_WORDS.heading)).toBeTruthy());
    expect(JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toEqual({ roleId: "r1", heard: HEARD });
    expect(onUse).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(VOICE_DRAFT_WORDS.labels.aim), { target: { value: "A seed swap every new moon." } });
    fireEvent.click(screen.getAllByRole("button", { name: "Use this" })[1]);
    expect(onUse).toHaveBeenCalledWith({ aim: "A seed swap every new moon." });
    expect(screen.getByText(VOICE_DRAFT_WORDS.used)).toBeTruthy();
    expect(onUse).toHaveBeenCalledTimes(1);
  });

  it("says plainly when drafting is not available, and puts nothing in", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: VOICE_DRAFT_WORDS.unavailable }), { status: 503 })));
    const onUse = vi.fn();
    render(<VoiceDrafts heard={HEARD} drafting={{ roleId: "r1", empty: ALL_EMPTY, onUse }} />);
    fireEvent.click(screen.getByRole("button", { name: VOICE_DRAFT_WORDS.button }));
    await waitFor(() => expect(screen.getByText(VOICE_DRAFT_WORDS.unavailable)).toBeTruthy());
    expect(onUse).not.toHaveBeenCalled();
  });
});
