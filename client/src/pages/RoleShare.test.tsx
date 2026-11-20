// @vitest-environment jsdom
/**
 * ONE ROLE'S OWN PAGE, `/roles/<slug>` (the lead, 20 Nov 2026; the roles lane's idea 3): the role's card at the
 * top with a way back to every role and its share link, by the name's slug or the id, the bar settling on the
 * role's own address, and one line when no role answers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Router } from "wouter";
import type { ReactNode } from "react";

vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null, token: null, loading: false }), useIsAdmin: () => false }));

import RoleShare from "./RoleShare";

const ORG = {
  circles: [{ id: "c1", name: "Anchor Circle", purpose: "Holds the direction.", isAnchor: true }],
  roles: [
    { id: "role1a", name: "Lead Finance Steward", aim: "Keep the books true.", circleId: "c1", state: "open", archetypes: [], card: {} },
    { id: "garden", name: "Garden Steward", aim: "Grow food.", circleId: "c1", state: "open", archetypes: [], card: {} },
  ],
};
let founding: Record<string, unknown>;

beforeEach(() => {
  founding = { on: true, roleIds: ["role1a"], sections: {}, villagePay: null, showPayRanges: false };
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => {
      const u = String(url);
      const reply = (body: unknown, status = 200) => ({ ok: status < 300, status, json: async () => body });
      if (u === "/api/org") return reply(ORG);
      if (u === "/api/org/founding-team") return reply(founding);
      return reply({}, 404);
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

function at(path: string) {
  window.history.replaceState(null, "", path);
  return render(
    <Router>
      <RoleShare />
    </Router>,
  );
}

describe("a role's own page", () => {
  it("opens the founding role's card at the top by its name's slug, with a way back and its share link", async () => {
    at("/roles/lead-finance-steward");
    const card = await waitFor(() => {
      const el = document.querySelector('[data-full-role-card="role1a"]') as HTMLElement | null;
      if (!el) throw new Error("no card yet");
      return el;
    });
    expect(card.getAttribute("data-register")).toBe("founding");
    expect(screen.getByRole("heading", { level: 1, name: "Lead Finance Steward" })).toBeTruthy();
    const back = document.querySelector("[data-role-page-back]") as HTMLAnchorElement;
    expect(back.getAttribute("href")).toBe("/roles");
    expect(back.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(await screen.findAllByRole("button", { name: "Copy link to Lead Finance Steward" })).not.toHaveLength(0);
  });

  it("takes the id too, settles the bar on the role's own address, and draws a role outside the founding team in the directory's register", async () => {
    at("/roles/garden");
    const card = await waitFor(() => {
      const el = document.querySelector('[data-full-role-card="garden"]') as HTMLElement | null;
      if (!el) throw new Error("no card yet");
      return el;
    });
    expect(card.getAttribute("data-register")).toBe("game");
    await waitFor(() => expect(window.location.pathname).toBe("/roles/garden-steward"));
  });

  it("says so in one line when no role answers, and leads back to every role", async () => {
    at("/roles/nobody");
    const missing = await waitFor(() => {
      const el = document.querySelector("[data-role-page-missing]") as HTMLElement | null;
      if (!el) throw new Error("not yet");
      return el;
    });
    expect(within(missing).getByRole("heading", { level: 1 }).textContent).toBe("That role is not on this page anymore.");
    expect(document.querySelector("[data-full-role-card]")).toBeNull();
    expect((document.querySelector("[data-role-page-back]") as HTMLAnchorElement).getAttribute("href")).toBe("/roles");
  });

  it("lists the roles this steward will build in full under its card, each opening that role's page (the /roles index has one line of them)", async () => {
    const withChildren = {
      circles: [...ORG.circles, { id: "money", name: "Money Circle", purpose: "", leadRoleId: "role1a" }],
      roles: [...ORG.roles, { id: "dev", name: "Development Steward", aim: "Build in step with the land.", circleId: "money", state: "forming", comingSoon: true, archetypes: [], card: {} }],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        const u = String(url);
        const reply = (body: unknown, status = 200) => ({ ok: status < 300, status, json: async () => body });
        if (u === "/api/org") return reply(withChildren);
        if (u === "/api/org/founding-team") return reply(founding);
        return reply({}, 404);
      }),
    );
    at("/roles/lead-finance-steward");
    const list = await waitFor(() => {
      const el = document.querySelector("[data-lead-builds]") as HTMLElement | null;
      if (!el) throw new Error("not yet");
      return el;
    });
    expect(within(list).getByRole("heading", { name: "Roles this steward will build" })).toBeTruthy();
    fireEvent.click(list.querySelector('[data-lead-builds-role="dev"]') as HTMLElement);
    await waitFor(() => expect(window.location.pathname).toBe("/roles/development-steward"));
    // Control: a role that leads no circle lists nothing.
    expect(document.querySelector("[data-lead-builds]")).toBeNull();
  });
});
