// @vitest-environment jsdom
/**
 * The venture accounts panel fails soft (PR #1511, CI run 45280095959).
 *
 * The Tokens tab test stubs fetch with a bare `[]` for any route it does not
 * know, and the panel read that as its list and threw on `roles.map`, which
 * took the whole Tokens tab down with it. A body of the wrong shape now reads
 * as no accounts, and the panel draws its empty state.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import OrgAccountsPanel, { balanceParts, listFrom } from "./OrgAccountsPanel";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("listFrom", () => {
  it("reads any other shape as no accounts and both doors shut", () => {
    for (const body of [[], null, undefined, "nope", 7, { accounts: "x", roles: 3, open: "true" }]) {
      expect(listFrom(body)).toEqual({ accounts: [], roles: [], open: false, routing: false });
    }
  });

  it("keeps a well-formed body as it is", () => {
    const body = { accounts: [{ orgRoleId: "v" }], roles: [{ id: "r", name: "R", futureVenture: false }], open: true, routing: true };
    expect(listFrom(body)).toEqual(body);
  });

  it("writes nothing held for an account with no balances", () => {
    expect(balanceParts({} as any)).toEqual([]);
  });
});

describe("OrgAccountsPanel", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => [] })));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("draws its empty state when the read answers an array", async () => {
    render(<OrgAccountsPanel password="secret" />);
    expect(await screen.findByText("No venture holds an account yet.")).toBeTruthy();
  });
});
