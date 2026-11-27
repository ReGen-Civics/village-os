// @vitest-environment jsdom
/**
 * EACH CONVERSATION'S NOTES on the team's walkthrough (0444): the panel draws only what the door served, offers the
 * take-off button only on the reader's own notes, and posts a written note to the conversation's own door.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import type { ConversationNotesView } from "@shared/conversationNotes";

i18n.load("en", {});
i18n.activate("en");

const calls: Array<{ path: string; init: RequestInit }> = [];
vi.mock("@/lib/gameApi", () => ({
  authToken: () => "t",
  gameFetch: async (path: string, init: RequestInit = {}) => {
    calls.push({ path, init });
    return new Response(JSON.stringify({ success: true, message: "Saved." }), { status: 200, headers: { "content-type": "application/json" } });
  },
}));

import ConversationNotes from "./ConversationNotes";

afterEach(() => {
  cleanup();
  calls.length = 0;
});

const conv = (notes: ConversationNotesView["notes"]): ConversationNotesView => ({ interviewId: 7, label: "Conversation with Operations Role", roleId: "r-ops", final: false, state: "open", notes });

const draw = (c: ConversationNotesView[], onSaved = () => {}) =>
  render(
    <I18nProvider i18n={i18n}>
      <ConversationNotes base="/api/governance/applications/op-1" conversations={c} onSaved={onSaved} />
    </I18nProvider>,
  );

describe("the conversation notes panel", () => {
  it("draws nothing when the reader may read no conversation", () => {
    const { container } = draw([]);
    expect(container.textContent).toBe("");
  });

  it("shows each note and file, and the take-off button only on the reader's own", () => {
    draw([
      conv([
        { id: 1, kind: "text", body: "Warm and clear.", fileName: null, fileHref: null, author: "Iva", on: "2026-11-27", mine: true },
        { id: 2, kind: "transcript", body: null, fileName: "call.txt", fileHref: "/api/governance/applications/op-1/conversation-notes/2/file", author: "Flor", on: "2026-11-27", mine: false },
      ]),
    ]);
    expect(screen.getByText("Conversation with Operations Role")).toBeTruthy();
    expect(screen.getByText("Warm and clear.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "call.txt" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Take it off" })).toHaveLength(1);
  });

  it("asks once before taking a note off, and keeps it on 'Keep it'", async () => {
    draw([conv([{ id: 1, kind: "text", body: "Warm.", fileName: null, fileHref: null, author: "Iva", on: "2026-11-27", mine: true }])]);
    fireEvent.click(screen.getByRole("button", { name: "Take it off" }));
    expect(calls).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));
    expect(calls).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Take it off" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, take it off" }));
    await waitFor(() => expect(calls.map((c) => [c.path, c.init.method])).toEqual([["/api/governance/applications/op-1/conversation-notes/1", "DELETE"]]));
  });

  it("dates read as words, and the section carries the anchor the bell lands on", () => {
    draw([conv([{ id: 1, kind: "text", body: "Warm.", fileName: null, fileHref: null, author: "Iva", on: "2026-11-27", mine: false }])]);
    expect(document.getElementById("conversation-notes")).toBeTruthy();
    expect(document.body.textContent).toContain("November 27, 2026");
  });

  it("posts a written note to that conversation's door, then reloads", async () => {
    const onSaved = vi.fn();
    draw([conv([])], onSaved);
    // One place, one button: the box opens behind "Add a note or file" (QA round 1).
    expect(screen.queryByLabelText("Write a note")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add a note or file" }));
    fireEvent.change(screen.getByLabelText("Write a note"), { target: { value: "Talked about the budget." } });
    fireEvent.click(screen.getByRole("button", { name: "Save the note" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(calls[0].path).toBe("/api/governance/applications/op-1/interviews/7/notes");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ body: "Talked about the budget." });
  });

  it("QA round 2: the guide is drawn once above the conversations, and every note box has its own id", () => {
    const guide = { items: [{ key: "c:c1", kind: "criterion" as const, text: "Keeps books" }, { key: "q:care", kind: "quality" as const, text: "Care" }], notes: [] };
    render(
      <I18nProvider i18n={i18n}>
        <ConversationNotes base="/api/governance/applications/op-1" conversations={[conv([]), { ...conv([]), interviewId: 8, label: "Conversation with Data Role" }]} guide={guide} onSaved={() => {}} />
      </I18nProvider>,
    );
    expect(document.querySelectorAll("[data-conversation-guide]")).toHaveLength(1);
    const ids = Array.from(document.querySelectorAll("textarea, input")).map((el) => el.id).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
    // The guide sits above the list of conversations.
    const guideEl = document.querySelector("[data-conversation-guide]")!;
    const first = document.querySelector("[data-conversation]")!;
    expect(guideEl.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("QA round 2: the hidden file input comes before its label, so the label can show the keyboard's focus", () => {
    draw([conv([])]);
    fireEvent.click(screen.getByRole("button", { name: "Add a note or file" }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const label = document.querySelector("[data-file-choose]") as HTMLLabelElement;
    expect(input.className.split(" ")).toContain("peer");
    expect(label.className).toMatch(/peer-focus-visible:ring-2/);
    expect(input.nextElementSibling).toBe(label);
    expect(label.htmlFor).toBe(input.id);
  });
});
