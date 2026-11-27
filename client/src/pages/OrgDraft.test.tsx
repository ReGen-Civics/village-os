// @vitest-environment jsdom
/**
 * The draft page (the lead, 26 Nov 2026): one draft at its own address, before and after field by field, a change that
 * cannot be applied said plainly with the way to leave it out, the revisions, and a publish that names the changes
 * the page drew.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/lib/gameApi", () => ({ authToken: () => "t" }));
vi.mock("wouter", async (orig) => ({ ...(await (orig as () => Promise<object>)()), useParams: () => ({ draftId: "draft-1" }) }));

import OrgDraft from "./OrgDraft";

const field = (f: object) => ({ hidden: false, base: null, moved: false, movedRuns: [], ...f });
const VIEW = {
  id: "draft-1",
  title: "Roles opening after the founding team",
  rationale: null,
  status: "open",
  createdAt: "2026-11-24T15:02:00.000Z",
  publishedAt: null,
  source: { kind: "agent", moduleId: "saberra", fromProposal: false },
  proposer: { firstName: "Ana", roles: ["Village Steward"] },
  changeIds: ["c1", "c2"],
  mayEdit: true,
  otherOpenDrafts: [],
  revisions: [{ number: 2, at: "2026-11-25T10:00:00.000Z", by: null, note: "Named the soil too", changeId: "c1", leftOut: null, fields: [field({ field: "aim", label: "Purpose", shape: "text", before: "a", after: "b", runs: [{ op: "del", text: "a" }, { op: "add", text: "b" }] })] }],
  changes: [
    {
      id: "c1",
      op: "update_seat",
      kind: "edit",
      targetId: "land",
      target: "Regenerative Land & Building Steward",
      reads: "Change the role \"Regenerative Land & Building Steward\"",
      blocked: null,
      baseKnown: true,
      unchanged: ["domain", "whyItMatters"],
      holders: null,
      fields: [
        field({ field: "aim", label: "Purpose", shape: "text", before: "so the project grows", after: "so the village grows", runs: [{ op: "same", text: "so the " }, { op: "del", text: "project" }, { op: "add", text: "village" }, { op: "same", text: " grows" }] }),
        field({ field: "accountabilities", label: "What you can count on me for", shape: "list", before: ["Keeps the plan.", "Signs off contracts."], after: ["Keeps the plan.", "Reports water use."], runs: [{ op: "same", text: "Keeps the plan." }, { op: "del", text: "Signs off contracts." }, { op: "add", text: "Reports water use." }] }),
        field({ field: "termsOffer", label: "Pay on offer", shape: "terms", before: null, after: null, runs: [], hidden: true }),
      ],
    },
    { id: "c2", op: "create_seat", kind: "new", targetId: "social", target: "Social Media Steward", reads: "Create the role \"Social Media Steward\"", blocked: "A role with that id already exists (a retired role)", baseKnown: false, unchanged: [], holders: null, fields: [field({ field: "name", label: "Role title", shape: "text", before: null, after: "Social Media Steward", runs: [{ op: "add", text: "Social Media Steward" }] })] },
  ],
};
const DECIDE = { status: "open", changes: 2, blocked: 1, holderCount: 1, ballotNeeded: false, youMayPublish: true, adminMayPublish: false, youMayPutToVillage: true, youMayWithdraw: true, governanceOn: true, ballot: null };

function serve(view: object = VIEW) {
  const calls: Array<{ url: string; body: unknown }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
      if (url.endsWith("/view")) return new Response(JSON.stringify(view), { status: 200 });
      if (url.endsWith("/decide")) return new Response(JSON.stringify(DECIDE), { status: 200 });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }),
  );
  return calls;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the draft page", () => {
  it("says what it changes, who proposed it (the role big, the name beside), where it came from and who must act", async () => {
    serve();
    render(<OrgDraft />);
    await screen.findByTestId("org-draft");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Roles opening after the founding team");
    expect(screen.getByText("Village Steward").className).toContain("font-display");
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.getByText("Sera suggested it. A person reads it before anything changes.")).toBeTruthy();
    expect(screen.getByText("You may publish it. A village vote is the other way.")).toBeTruthy();
  });

  it("shows before and after in words and lines, marked without colour alone, and folds what did not change", async () => {
    serve();
    render(<OrgDraft />);
    const card = await screen.findByTestId("draft-change-c1");
    const gone = within(card).getByText("project", { exact: false, selector: "del" });
    expect(gone.textContent).toContain("removed:");
    expect(within(card).getByText("village", { exact: false, selector: "ins" }).textContent).toContain("added:");
    expect(within(card).getByText("Signs off contracts.", { exact: false }).closest("li")?.textContent).toContain("Removed:");
    expect(within(card).getByText("The terms on offer change in this draft. Only people who may read a role's terms see how.")).toBeTruthy();
    expect(within(card).getByText("2 fields unchanged")).toBeTruthy();
  });

  it("names a change that cannot be applied, says why nothing shows on the chart, and leaves it out on a yes", async () => {
    const calls = serve();
    render(<OrgDraft />);
    const card = await screen.findByTestId("draft-change-c2");
    expect(within(card).getByRole("alert").textContent).toContain("A retired role keeps its id");
    fireEvent.click(within(card).getByTestId("leave-out-c2"));
    fireEvent.click(within(card).getByTestId("leave-out-yes-c2"));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith("/revise"))).toBe(true));
    expect(calls.find((c) => c.url.endsWith("/revise"))?.body).toEqual({ changeId: "c2", leaveOut: true, note: "" });
    // Publishing waits while a change cannot be applied.
    expect((screen.getByTestId("draft-publish") as HTMLButtonElement).disabled).toBe(true);
  });

  it("publishes with the change ids it drew, so a draft that changed since is refused", async () => {
    const calls = serve({ ...VIEW, changes: [VIEW.changes[0]], changeIds: ["c1"] });
    render(<OrgDraft />);
    fireEvent.click(await screen.findByTestId("draft-publish"));
    fireEvent.click(screen.getByTestId("draft-confirm"));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith("/publish-by-power"))).toBe(true));
    expect(calls.find((c) => c.url.endsWith("/publish-by-power"))?.body).toEqual({ expectedChanges: ["c1"] });
  });

  it("edits a field's words as a new revision, and lists the revisions", async () => {
    const calls = serve();
    render(<OrgDraft />);
    const card = await screen.findByTestId("draft-change-c1");
    fireEvent.click(within(card).getAllByRole("button", { name: "Edit" })[0]);
    const box = within(card).getByLabelText("New words for Purpose");
    fireEvent.change(box, { target: { value: "So the village grows gently." } });
    fireEvent.click(within(card).getByRole("button", { name: "Save as a new revision" }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith("/revise"))).toBe(true));
    expect(calls.find((c) => c.url.endsWith("/revise"))?.body).toEqual({ changeId: "c1", words: { aim: "So the village grows gently." }, note: "" });
    expect(screen.getByRole("heading", { name: "Revisions" })).toBeTruthy();
    expect(screen.getByText("\"Named the soil too\"")).toBeTruthy();
  });

  it("a draft the reader may not read is no draft at all to them", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "no_such_draft" }), { status: 404 })));
    render(<OrgDraft />);
    expect(await screen.findByText(/There is no draft at this address that you can read/)).toBeTruthy();
  });
});
