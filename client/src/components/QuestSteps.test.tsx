// @vitest-environment jsdom
/**
 * Each step of a quest takes its own submission (0439; the lead, 27 Nov 2026).
 * A step that needs one says so to everybody; the member holding the quest adds
 * words and takes a piece off while it is in their hands, and once it is turned
 * in the pieces show without the buttons.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const gameFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/gameApi", () => ({ gameFetch, authToken: () => "t" }));
vi.mock("@/lib/imagePrep", () => ({ prepareImageForUpload: async (file: File) => ({ file }) }));

import QuestSteps, { type StepSubmissionView } from "./QuestSteps";

afterEach(() => {
  cleanup();
  gameFetch.mockReset();
});

const CLAIM = { id: "c-1", questId: "q-1", questTitle: "Swale", status: "claimed" as const, claimedAt: "2026-11-20T10:00:00.000Z", artifactUrl: "", note: "" };
const WORDS: StepSubmissionView = { id: "s-1", stepIndex: 1, kind: "text", body: "Dug ten metres.", fileUrl: null, originalName: null, createdAt: null };

describe("the steps of a quest", () => {
  it("says which step needs a submission, to somebody not holding the quest, with no buttons", () => {
    render(<QuestSteps questId="q-1" steps={["Walk the line", "Dig"]} stepNeeds={[false, true]} claim={undefined} rows={[]} reload={() => undefined} />);
    expect(screen.getAllByText("This step needs a photo, a document or a few words from you.")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Add these words" })).toBeNull();
  });

  it("lets the member holding it add words to a step, then reads the steps again", async () => {
    gameFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ submission: WORDS }) });
    const reload = vi.fn();
    render(<QuestSteps questId="q-1" steps={["Walk the line", "Dig"]} stepNeeds={[false, true]} claim={CLAIM} rows={[]} reload={reload} />);
    const boxes = screen.getAllByLabelText("Add a few words for this step");
    fireEvent.change(boxes[1], { target: { value: "Dug ten metres." } });
    fireEvent.click(screen.getAllByRole("button", { name: "Add these words" })[1]);
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(gameFetch).toHaveBeenCalledWith("/api/game/quests/q-1/steps/1", { method: "POST", body: JSON.stringify({ body: "Dug ten metres." }) });
  });

  it("shows what was given and marks the step done; a piece comes off while the quest is in hand", async () => {
    gameFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    const reload = vi.fn();
    render(<QuestSteps questId="q-1" steps={["Walk the line", "Dig"]} stepNeeds={[false, true]} claim={CLAIM} rows={[WORDS]} reload={reload} />);
    expect(screen.getByText("Dug ten metres.")).toBeTruthy();
    expect(screen.getByText("Done: you added something for this step.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Take this off the step" }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(gameFetch).toHaveBeenCalledWith("/api/game/quests/q-1/steps/submissions/s-1", { method: "DELETE" });
  });

  it("once turned in, shows the pieces without the buttons", () => {
    render(<QuestSteps questId="q-1" steps={["Walk the line", "Dig"]} stepNeeds={[false, true]} claim={{ ...CLAIM, status: "submitted" }} rows={[WORDS]} reload={() => undefined} />);
    expect(screen.getByText("Dug ten metres.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Take this off the step" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add these words" })).toBeNull();
  });
});
