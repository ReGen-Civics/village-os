// @vitest-environment jsdom
/**
 * Put a quest back (the lead, 27 Nov 2026): a member who took a quest and has not
 * turned it in can let it go from the quest's own page. It asks first, posts to
 * the withdraw route, reads the claims again, and says it is done. A turned-in
 * quest offers no put-back and says who can hand it back.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const gameFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/gameApi", () => ({ gameFetch }));

import QuestActions from "./QuestActions";

const onChanged = vi.fn();

const CLAIMED = {
  id: "claim-1",
  questId: "q-1",
  questTitle: "Tend the swale",
  status: "claimed" as const,
  claimedAt: "2026-09-14T10:00:00.000Z",
  artifactUrl: "",
  note: "",
};

describe("putting a quest back", () => {
  beforeEach(() => {
    gameFetch.mockReset();
    onChanged.mockReset();
  });

  it("asks first, and keeping it posts nothing", () => {
    render(<QuestActions questId="q-1" signedIn claim={CLAIMED} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole("button", { name: "Put this quest back" }));
    expect(screen.getByText("Put this quest back? It leaves your quests and opens for someone else.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));
    expect(gameFetch).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Put this quest back" })).toBeTruthy();
  });

  it("a yes posts to the withdraw route, reads the claims again, and says it is done", async () => {
    gameFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) });
    const { rerender } = render(<QuestActions questId="q-1" signedIn claim={CLAIMED} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole("button", { name: "Put this quest back" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, put it back" }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(gameFetch).toHaveBeenCalledWith("/api/game/quests/q-1/withdraw", { method: "POST" });
    // The page reads the claims again and the claim is gone.
    rerender(<QuestActions questId="q-1" signedIn claim={undefined} onChanged={onChanged} />);
    expect(screen.getByRole("status").textContent).toBe("Put back. It has left your quests and is open for someone else.");
    expect(screen.getByRole("button", { name: /Take this Quest/ })).toBeTruthy();
  });

  it("a refusal keeps the server's sentence and reads the claims again", async () => {
    const refusal = "You already turned this in, so a steward is reading it. Ask the steward if you want it handed back.";
    gameFetch.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: refusal }) });
    render(<QuestActions questId="q-1" signedIn claim={CLAIMED} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole("button", { name: "Put this quest back" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, put it back" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(refusal));
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("a turned-in quest offers no put-back, and offers to take the work back instead", async () => {
    gameFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, status: "claimed" }) });
    render(<QuestActions questId="q-1" signedIn claim={{ ...CLAIMED, status: "submitted" }} onChanged={onChanged} />);
    expect(screen.queryByRole("button", { name: "Put this quest back" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Take it back to change it" }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(gameFetch).toHaveBeenCalledWith("/api/game/quests/q-1/pull-back", { method: "POST" });
  });

  it("a refused take-back keeps the server's sentence", async () => {
    const refusal = "This work was approved and paid, so it cannot be taken back.";
    gameFetch.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: refusal }) });
    render(<QuestActions questId="q-1" signedIn claim={{ ...CLAIMED, status: "submitted" }} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole("button", { name: "Take it back to change it" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(refusal));
  });

  it("work taken back opens the form on what was given, and waits on a step that needs something", () => {
    const back = { ...CLAIMED, note: "Dug ten metres.", submittedAt: "2026-11-27T10:00:00.000Z" };
    const { rerender } = render(<QuestActions questId="q-1" signedIn claim={back} owedSteps={[1]} onChanged={onChanged} />);
    expect(screen.getByText("Step 2 needs something from you first.")).toBeTruthy();
    expect((screen.getByRole("button", { name: /Turn in your work/ }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<QuestActions questId="q-1" signedIn claim={back} owedSteps={[]} stepsCarryEvidence onChanged={onChanged} />);
    fireEvent.click(screen.getByRole("button", { name: /Turn in your work/ }));
    expect((screen.getByPlaceholderText("A few words about what you did") as HTMLTextAreaElement).value).toBe("Dug ten metres.");
    expect(screen.getByText("Your steps hold your work. You can add a link or a few more words if you like.")).toBeTruthy();
  });
});
