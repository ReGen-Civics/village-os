// @vitest-environment jsdom
/**
 * A ROLE CARD ON THE ONE SAVE BAR (the lead, 25 Nov 2026): "whenever I'm
 * changing a setting, have it pop up ... so I can immediately save it".
 * A role card used to carry six Save buttons, one per editor. Edits in two of
 * them now gather on the one bar, and one Save writes each through its own
 * route.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { resetUnsavedForTests } from "@/lib/unsavedChanges";
import RoleHandoverEditor from "./RoleHandoverEditor";
import RolePowerGroupsEditor from "./RolePowerGroupsEditor";
import { ROLE_HANDOVER_WORDS as W } from "@shared/roleHandover";

afterEach(() => {
  cleanup();
  resetUnsavedForTests();
});

describe("a role card's editors on the one save bar", () => {
  it("gathers a handover edit and a powers edit into one count, and one Save writes both", async () => {
    const calls: Array<{ path: string; body: any; method?: string }> = [];
    const call = vi.fn(async (path: string, body?: any, method?: string) => {
      calls.push({ path, body, method });
      if (path.endsWith("/power-groups") && method === "GET") {
        return { groups: [{ id: "g1", name: "Stewards", capabilities: [], grantsAdmin: false, isExample: false, linked: false }], roleIds: [] };
      }
      if (path.endsWith("/power-groups")) return { roleIds: body.roleIds };
      if (path === "/admin/org/drafts") return { id: "d1" };
      if (path.endsWith("/preview")) return { lines: [{ blocked: null }] };
      return { success: true };
    });
    const role = { id: "water", name: "Water Steward", bringMe: null, notMine: null, runbook: null };
    render(
      <>
        <RoleHandoverEditor role={role} call={call} onSaved={vi.fn()} />
        <RolePowerGroupsEditor role={role} call={call} />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Bring me, not mine to hold and runbook/ }));
    fireEvent.change(screen.getByLabelText(W.runbook), { target: { value: "https://example.org/water" } });
    fireEvent.click(screen.getByRole("button", { name: "Powers this role carries" }));
    fireEvent.click(await screen.findByRole("checkbox"));
    expect(await screen.findByText("2 changes not saved yet")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Save" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Save the powers|Save through a draft/ })).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    await waitFor(() => expect(calls.some((c) => c.path === "/admin/org/drafts/d1/publish")).toBe(true));
    expect(calls.find((c) => c.path === "/admin/org-roles/water/power-groups" && c.method === "PUT")?.body).toEqual({ roleIds: ["g1"] });
  });
});
