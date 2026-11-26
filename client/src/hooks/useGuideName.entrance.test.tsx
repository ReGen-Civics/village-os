// @vitest-environment jsdom
/**
 * THE GUIDE'S NAME IS NOT ASKED IN FRONT OF THE ENTRANCE (1.3.75's live check, 26 Nov 2026). Signed out on a
 * village that keeps a portal entrance, every page load sent GET /api/work-with-us-config, the entrance refused
 * it with 401, and the console logged an error: the corner (MobileFab) reads the guide's name on every page and
 * started drawing for visitors in 1.3.75.
 *
 * A visitor's device asks only once it is past the entrance (lib/entranceStatus.ts's pastTheEntrance, the rule
 * the front door's reads already keep); the neutral label stands meanwhile. A member is never in front of it.
 * The corner itself steps aside while the entrance is the page.
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ user: null as null | { id: string; name: string; role?: string } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: session.user, loading: false }) }));
vi.mock("@/lib/haptics", () => ({ haptic: () => false }));
vi.mock("@/lib/gameApi", () => ({ gameFetch: vi.fn(async () => new Response("{}", { status: 403 })) }));

import { useGuideName } from "./useGuideName";
import MobileFab from "@/components/mobile/MobileFab";
import { forgetEntranceStatusRead } from "@/lib/entranceStatus";

const CONFIG = "/api/work-with-us-config";
let entrance: { required: boolean; entered: boolean } | null;
let asked: string[];

function Name() {
  const { name, loaded } = useGuideName();
  return <p data-loaded={loaded}>{name}</p>;
}

async function settle() {
  await act(async () => {
    for (let i = 0; i < 5; i++) await new Promise((done) => setTimeout(done, 0));
  });
}

beforeEach(() => {
  session.user = null;
  entrance = { required: true, entered: false };
  asked = [];
  forgetEntranceStatusRead();
  document.cookie = "vos_gate=1; path=/";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      asked.push(String(url));
      if (url === "/api/entrance") return new Response(JSON.stringify(entrance), { status: 200 });
      if (url === CONFIG) return new Response(JSON.stringify({ assistantName: "Juniper" }), { status: 200 });
      return new Response("{}", { status: 404 });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.cookie = "vos_gate=; path=/; max-age=0";
});

describe("the guide's name, signed out on a village with an entrance", () => {
  it("is not asked while this device has not entered, and the neutral label stands", async () => {
    render(<Name />);
    await settle();
    expect(asked).not.toContain(CONFIG);
    expect(screen.getByText("the village guide")).toHaveAttribute("data-loaded", "true");
  });

  it("is asked once this device has entered", async () => {
    entrance = { required: true, entered: true };
    render(<Name />);
    await settle();
    expect(asked).toContain(CONFIG);
    expect(screen.getByText("Juniper")).toBeInTheDocument();
  });

  it("is asked where the village keeps no entrance, without asking the entrance anything", async () => {
    document.cookie = "vos_gate=; path=/; max-age=0";
    render(<Name />);
    await settle();
    expect(asked).toEqual([CONFIG]);
  });

  it("is asked for a member, without asking the entrance anything", async () => {
    session.user = { id: "u1", name: "Ana" };
    render(<Name />);
    await settle();
    expect(asked).toEqual([CONFIG]);
  });
});

describe("the corner, signed out, in front of the entrance", () => {
  const drawAt = async (path: string) => {
    const { hook } = memoryLocation({ path });
    const r = render(
      <Router hook={hook}>
        <MobileFab />
      </Router>,
    );
    await settle();
    return r;
  };

  it("draws nothing and asks nothing past the entrance while the entrance is the page", async () => {
    const { container } = await drawAt("/quests");
    expect(container.querySelector("[data-mobile-fab]")).toBeNull();
    expect(asked).not.toContain(CONFIG);
  });

  it("draws once this device has entered", async () => {
    entrance = { required: true, entered: true };
    const { container } = await drawAt("/quests");
    expect(container.querySelector("[data-mobile-fab]")).not.toBeNull();
  });
});
