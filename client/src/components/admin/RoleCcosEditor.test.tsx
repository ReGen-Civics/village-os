// @vitest-environment jsdom
/**
 * The CCOS words editor beside the handover words (0274): seven labelled
 * inputs, the parser's sentence under a bad one, and Save goes through a
 * one-change `update_seat` draft carrying only the words that changed.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { resetUnsavedForTests } from "@/lib/unsavedChanges";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import RoleCcosEditor, { CCOS_EDITOR_WORDS } from "./RoleCcosEditor";
import { ROLE_CCOS_WORDS as W } from "@shared/roleCcos";

const role = { id: "intake", name: "Onboarding Lead", existsWhile: "people are still arriving", authorities: ["Invite to a role"], timeCommitment: null };

function setup() {
  const calls: Array<{ path: string; body: any; method?: string }> = [];
  const call = vi.fn(async (path: string, body?: any, method?: string) => {
    calls.push({ path, body, method });
    if (path === "/admin/org/drafts") return { id: "d1" };
    if (path.endsWith("/preview")) return { lines: [{ blocked: null }] };
    return { success: true };
  });
  const onSaved = vi.fn();
  render(<RoleCcosEditor role={role} call={call} onSaved={onSaved} />);
  fireEvent.click(screen.getByRole("button", { name: new RegExp(CCOS_EDITOR_WORDS.open) }));
  return { calls, onSaved };
}

afterEach(() => {
  cleanup();
  resetUnsavedForTests();
});

/** The page's one save bar (components/SaveBar.tsx): the editor has no Save of its own. */
const barSave = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
  });
};

describe("RoleCcosEditor", () => {
  it("says how many of the seven are written, and opens to seven labelled inputs", () => {
    setup();
    expect(screen.getByText("2 of 7 written")).toBeTruthy();
    expect((screen.getByLabelText(W.existsWhile) as HTMLInputElement).value).toBe("people are still arriving");
    expect((screen.getByLabelText(W.authorities) as HTMLTextAreaElement).value).toBe("Invite to a role");
    for (const label of [W.responsibilities, W.signsStretched, W.flowsBack, W.stepBack, W.timeCommitment]) {
      expect(screen.getByLabelText(label), label).toBeTruthy();
    }
  });

  it("shows the parser's sentence under nine lines and holds the save", () => {
    setup();
    fireEvent.change(screen.getByLabelText(W.responsibilities), {
      target: { value: Array.from({ length: 9 }, (_, i) => `Task ${i + 1}`).join("\n") },
    });
    expect(screen.getByRole("alert").textContent).toBe(W.tooMany);
  });

  it("refuses on the bar while a field is wrong, and sends nothing", async () => {
    const { calls } = setup();
    fireEvent.change(screen.getByLabelText(W.responsibilities), {
      target: { value: Array.from({ length: 9 }, (_, i) => `Task ${i + 1}`).join("\n") },
    });
    await barSave();
    expect(await screen.findByText(new RegExp(CCOS_EDITOR_WORDS.fix))).toBeTruthy();
    expect(calls).toEqual([]);
  });

  it("raises no save bar until something changed", () => {
    setup();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.queryByRole("button", { name: CCOS_EDITOR_WORDS.save })).toBeNull();
  });

  it("saves only the changed words through a one-change update_seat draft, then publishes it", async () => {
    const { calls, onSaved } = setup();
    fireEvent.change(screen.getByLabelText(W.responsibilities), { target: { value: "Run onboarding calls\n\nAnswer applications" } });
    fireEvent.change(screen.getByLabelText(W.timeCommitment), { target: { value: "Part of a full-time season" } });
    fireEvent.change(screen.getByLabelText(W.existsWhile), { target: { value: "" } });
    await barSave();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(calls.map((c) => c.path)).toEqual([
      "/admin/org/drafts",
      "/admin/org/drafts/d1/changes",
      "/admin/org/drafts/d1/preview",
      "/admin/org/drafts/d1/publish",
    ]);
    expect(calls[1].body).toEqual({
      op: "update_seat",
      orgRoleId: "intake",
      payload: { existsWhile: null, responsibilities: ["Run onboarding calls", "Answer applications"], timeCommitment: "Part of a full-time season" },
    });
  });
});
