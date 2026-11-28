// @vitest-environment jsdom
/**
 * /admin/proposals is folded into /admin/review (the accepted cut C8, 27 Nov 2026), and THE OLD ADDRESS KEEPS WORKING:
 * a link already sent, an old anchor, and the address the server still hands to agents all land on the review page's
 * Batches view, which draws the old page's whole desk.
 */
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";

const navigate = vi.fn();
vi.mock("wouter", () => ({ useLocation: () => ["/admin/proposals", navigate], Link: () => null }));
vi.mock("@/components/Layout", () => ({ default: () => null }));

import ProposedChanges from "@/pages/ProposedChanges";
import { BATCHES_VIEW, foldedProposalsAddress } from "./proposalsFold";

afterEach(() => {
  cleanup();
  navigate.mockClear();
  window.history.replaceState(null, "", "/");
});

describe("the old /admin/proposals address", () => {
  it("lands on the review page's Batches view, with the search it carried", () => {
    expect(BATCHES_VIEW).toBe("/admin/review?view=batches");
    expect(foldedProposalsAddress("", "")).toBe("/admin/review?view=batches");
    expect(foldedProposalsAddress("?find=B-71.2", "")).toBe("/admin/review?view=batches&find=B-71.2");
    // An old anchor link becomes the search made on arrival.
    expect(foldedProposalsAddress("", "#B-71")).toBe("/admin/review?view=batches&find=B-71");
    // A search in the address wins over an anchor, and nothing else in the old address is carried.
    expect(foldedProposalsAddress("?find=B-9&x=1", "#B-71")).toBe("/admin/review?view=batches&find=B-9");
    expect(foldedProposalsAddress("?find=%20%20", "#")).toBe("/admin/review?view=batches");
  });

  it("the page at the old address goes there at once, replacing itself in history", async () => {
    window.history.replaceState(null, "", "/admin/proposals?find=B-71.2");
    render(<ProposedChanges />);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/admin/review?view=batches&find=B-71.2", { replace: true }));
  });

  it("THE AGENT CONTRACT STAYS VALID: the address the server hands back is still a route the app draws, and it lands on the desk", () => {
    const server = readFileSync("server/routes/proposedChanges.ts", "utf8");
    const handed = Array.from(server.matchAll(/reviewAt: "([^"]+)"/g)).map((m) => m[1]);
    // The server still names the address agents and stored messages already hold.
    expect(handed.length).toBeGreaterThanOrEqual(2);
    expect(new Set(handed)).toEqual(new Set(["/admin/proposals"]));
    const app = readFileSync("client/src/App.tsx", "utf8");
    expect(app).toContain('<Route path="/admin/proposals" component={ProposedChanges} />');
    expect(app).toContain('<Route path="/admin/review" component={AdminReview} />');
    expect(foldedProposalsAddress("", "").startsWith("/admin/review?")).toBe(true);
  });
});
