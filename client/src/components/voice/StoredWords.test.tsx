// @vitest-environment jsdom
/**
 * "WRITE DOWN THE WORDS" BESIDE A KEPT RECORDING (the lead, 17 Nov 2026), on the
 * deciders' page and Admin's applications panel: StoredWords.tsx, and the
 * panel's "Transcribe all waiting".
 *
 *   - The words come back marked as an AI transcript, naming who wrote them.
 *   - Off: no button; a transcript already kept still shows, marked.
 *   - A refusal is said in the reader's words.
 *   - The panel offers "Transcribe all waiting" only while something waits and
 *     the service is on, and starts one run on the server.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { STORED_TRANSCRIBE_WORDS, VOICE_TRANSCRIBE_WAITING_PATH } from "@shared/voiceTranscribe";
import StoredWords from "./StoredWords";
import OpenProposalsPanel, { waitingCount } from "@/components/admin/OpenProposalsPanel";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const settle = async () => {
  for (let i = 0; i < 8; i += 1) await act(async () => void (await new Promise((r) => setTimeout(r, 0))));
};
const HREF = "/api/admin/open-proposals/op-0123456789abcdef0123/voice/pv-0123456789abcdef";

describe("one kept recording", () => {
  it("writes it down at a press, and shows the words marked as an AI transcript", async () => {
    const asked: string[] = [];
    const poster = async (href: string) => {
      asked.push(href);
      return new Response(JSON.stringify({ written: { text: "Cuido la puerta.", at: "2026-11-17T10:00:00.000Z", by: "groq" } }), { status: 200 });
    };
    const { container } = render(<StoredWords href={HREF} on poster={poster} />);
    expect(container.querySelector("[data-ai-transcript]")).toBeNull();
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: "Write down the words" })));
    await settle();
    expect(asked).toEqual([`${HREF}/transcribe`]);
    expect(container.querySelector("[data-ai-transcript]")?.textContent).toBe("AI transcript, written down by Groq's Whisper. Not checked by the applicant.Cuido la puerta.");
    expect(screen.getByRole("button", { name: "Write it down again" })).toBeTruthy();
  });

  it("while off, draws no button; a transcript already kept still shows, marked; with neither, nothing at all", () => {
    const { container, unmount } = render(<StoredWords href={HREF} on={false} written={{ text: "Kept words.", at: "2026-11-17T10:00:00.000Z", by: "local" }} poster={async () => new Response("{}")} />);
    expect(container.querySelector("[data-ai-transcript]")?.textContent).toContain("written down by the village's own Whisper");
    expect(screen.queryByRole("button")).toBeNull();
    unmount();
    const none = render(<StoredWords href={HREF} on={false} poster={async () => new Response("{}")} />);
    expect(none.container.innerHTML).toBe("");
  });

  it("a refusal is said in the reader's words, and nothing is shown as a transcript", async () => {
    const poster = async () => new Response(JSON.stringify({ error: STORED_TRANSCRIBE_WORDS.dayFull }), { status: 429 });
    const { container } = render(<StoredWords href={HREF} on poster={poster} />);
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: "Write down the words" })));
    await settle();
    expect(screen.getByRole("status").textContent).toBe(STORED_TRANSCRIBE_WORDS.dayFull);
    expect(container.querySelector("[data-ai-transcript]")).toBeNull();
  });
});

describe("Transcribe all waiting, on Admin's panel", () => {
  const note = (id: string) => ({ id, seconds: 30, href: `/api/admin/open-proposals/op-1/voice/${id}` });
  const proposal = (written: Record<string, unknown>) => ({
    id: "op-0123456789abcdef0123",
    name: "Rowan Field",
    email: "rowan@example.test",
    via: null,
    roles: [],
    why: "",
    aim: "",
    confirmedAt: null,
    voice: { notes: [note("pv-000000000000000a"), note("pv-000000000000000b")], transcript: "", clips: [], written },
  });

  it("counts the recordings with no words yet", () => {
    expect(waitingCount([proposal({}) as any])).toBe(2);
    expect(waitingCount([proposal({ "pv-000000000000000a": { text: "x", at: "2026-11-17T10:00:00.000Z", by: "groq" } }) as any])).toBe(1);
  });

  const mount = async (desk: Record<string, unknown>) => {
    const posts: string[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        posts.push(url);
        return new Response(JSON.stringify({ started: 2, waiting: 2 }), { status: 202 });
      }
      return new Response(JSON.stringify({ publicLink: true, publicPath: "/propose-a-role", links: [], ...desk }), { status: 200 });
    });
    render(<OpenProposalsPanel password="pw" />);
    await settle();
    return posts;
  };

  it("is offered while recordings wait and the service is on, and starts one run on the server", async () => {
    const posts = await mount({ proposals: [proposal({})], transcribeOn: true });
    expect(screen.getByText(/2 recordings have no words yet/)).toBeTruthy();
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: "Transcribe all waiting" })));
    expect(posts).toEqual([VOICE_TRANSCRIBE_WAITING_PATH]);
    expect((screen.getByRole("button", { name: "Transcribe all waiting" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("is not offered while the service is off, or when nothing waits", async () => {
    await mount({ proposals: [proposal({})], transcribeOn: false });
    expect(screen.queryByRole("button", { name: "Transcribe all waiting" })).toBeNull();
    cleanup();
    const both = { "pv-000000000000000a": { text: "x", at: "2026-11-17T10:00:00.000Z", by: "groq" }, "pv-000000000000000b": { text: "y", at: "2026-11-17T10:00:00.000Z", by: "groq" } };
    await mount({ proposals: [proposal(both)], transcribeOn: true });
    expect(screen.queryByRole("button", { name: "Transcribe all waiting" })).toBeNull();
    // CONTROL: the kept transcripts are drawn, marked, beside their recordings.
    expect(document.querySelectorAll("[data-ai-transcript]").length).toBe(2);
  });
});
