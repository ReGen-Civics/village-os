// @vitest-environment jsdom
/**
 * The protocols page with no signal, the way a member meets it in the field:
 * the app's own boot says nobody is signed in and the module list failed, and
 * the page still draws the protocols this phone kept, runs one, keeps every
 * change in the queue, and sends it all when the signal comes back.
 */
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

let signedIn: { id: string } | null = null;
let modulesState: { loaded: boolean; failed: boolean; modules: Array<{ id: string; lifecycle: string }> } = {
  loaded: true,
  failed: true,
  modules: [],
};
let routeId: string | undefined;
const navigateTo = vi.fn((to: string) => {
  const m = /\/protocols\/run\/(.+)$/.exec(to);
  routeId = m ? decodeURIComponent(m[1]!) : undefined;
});

vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: signedIn }) }));
vi.mock("@/modules/ModuleProvider", () => ({ useModules: () => modulesState }));
vi.mock("@/components/modules/ModuleGate", () => ({
  default: () => <p>Module gate</p>,
  SignInToSee: () => <p>Sign in to see</p>,
}));
vi.mock("@/lib/protocolsOffline", () => ({ keepProtocolsOffline: vi.fn(), pointManifestAtProtocols: () => () => {} }));
vi.mock("wouter", () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
  useLocation: () => ["/protocols", navigateTo],
  useParams: () => (routeId ? { id: routeId } : {}),
}));

import { TOKEN_KEY } from "@/lib/gameApi";
import { writeSnapshot } from "@/lib/offlineQueue";
import { PROTOCOLS_SNAPSHOT, protocolsQueue, type ProtocolsPayload } from "@/lib/protocolsState";
import Protocols from "./Protocols";

const ME = "usr-wren";

function tokenFor(userId: string): string {
  const claims = JSON.stringify({ userId, timestamp: 1, v: 0 });
  return `${btoa(claims).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}.sig`;
}

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  };
}

const KEPT: ProtocolsPayload = {
  protocols: [
    {
      id: "opening-up",
      title: "Opening up",
      summary: "Before anyone arrives.",
      version: 1,
      status: "active",
      updatedAt: "2026-11-15T00:00:00.000Z",
      steps: [
        { id: "lights", text: "Lights on", detail: "", required: true, who: { kind: "member" } },
        { id: "kettle", text: "Kettle filled", detail: "", required: false, who: { kind: "member" } },
        { id: "unlock", text: "Front door unlocked", detail: "", required: true, who: { kind: "role", roleId: "r-key", roleTitle: "Keyholder" } },
      ],
    },
  ],
  runs: [],
  viewer: { id: ME, name: "Wren", roleIds: [] },
  settings: { showInstallCard: false },
  at: "2026-11-15T09:00:00.000Z",
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  localStorage.setItem(TOKEN_KEY, tokenFor(ME));
  signedIn = null;
  modulesState = { loaded: true, failed: true, modules: [] };
  routeId = undefined;
  navigateTo.mockClear();
  fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("with no signal", () => {
  it("draws the protocols this phone kept, though the app's boot knows nobody and no modules", async () => {
    writeSnapshot(PROTOCOLS_SNAPSHOT, ME, KEPT);
    render(<Protocols />);
    expect(await screen.findByText("Opening up")).toBeTruthy();
    expect(screen.queryByText("Module gate")).toBeNull();
    expect(screen.queryByText("Sign in to see")).toBeNull();
  });

  it("with nothing kept, shows the gate and invents nothing", async () => {
    render(<Protocols />);
    expect(await screen.findByText("Module gate")).toBeTruthy();
  });

  it("runs a protocol: the role step waits, completion waits, and every change waits in the queue", async () => {
    writeSnapshot(PROTOCOLS_SNAPSHOT, ME, KEPT);
    const view = render(<Protocols />);
    fireEvent.click(await screen.findByRole("button", { name: "Start" }));
    expect(navigateTo).toHaveBeenCalled();
    view.rerender(<Protocols />);

    const lights = await screen.findByRole("checkbox", { name: "Lights on" });
    fireEvent.click(lights);
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Lights on" }).getAttribute("aria-checked")).toBe("true"));

    // The Keyholder's step is not this member's to tick, offline as online.
    const unlock = screen.getByRole("checkbox", { name: "Front door unlocked" }) as HTMLButtonElement;
    expect(unlock.disabled).toBe(true);
    expect(screen.getByText("For the Keyholder to tick")).toBeTruthy();

    // A required step is open, so the run cannot be completed.
    const complete = screen.getByRole("button", { name: "Mark complete" }) as HTMLButtonElement;
    expect(complete.disabled).toBe(true);
    expect(screen.getByText(/One required step is still open: Front door unlocked \(Keyholder\)\./)).toBeTruthy();

    const waiting = protocolsQueue().pending(ME);
    expect(waiting.map((r) => r.path.replace(/runs\/[^/]+/, "runs/:id"))).toEqual(["/api/protocols/runs", "/api/protocols/runs/:id/ticks"]);
    expect(await screen.findByText(/2 changes are waiting to send\./)).toBeTruthy();
  });

  it("sends the waiting changes, in order, when the signal comes back", async () => {
    writeSnapshot(PROTOCOLS_SNAPSHOT, ME, KEPT);
    const view = render(<Protocols />);
    fireEvent.click(await screen.findByRole("button", { name: "Start" }));
    view.rerender(<Protocols />);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Lights on" }));
    await waitFor(() => expect(protocolsQueue().pending(ME)).toHaveLength(2));

    const sent: string[] = [];
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        sent.push(String(url).replace(/runs\/[^/]+/, "runs/:id"));
        return new Response("{}", { status: 201, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(KEPT), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    await waitFor(() => expect(protocolsQueue().pending(ME)).toHaveLength(0));
    expect(sent).toEqual(["/api/protocols/runs", "/api/protocols/runs/:id/ticks"]);
  });
});

describe("online", () => {
  it("a module the village has switched off shows the gate", async () => {
    modulesState = { loaded: true, failed: false, modules: [] };
    signedIn = { id: ME };
    render(<Protocols />);
    expect(await screen.findByText("Module gate")).toBeTruthy();
  });

  it("keeps what it read, so the next visit with no signal has it", async () => {
    modulesState = { loaded: true, failed: false, modules: [{ id: "protocols", lifecycle: "members" }] };
    signedIn = { id: ME };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(KEPT), { status: 200, headers: { "Content-Type": "application/json" } }));
    render(<Protocols />);
    expect(await screen.findByText("Opening up")).toBeTruthy();
    expect(localStorage.getItem(`village.offline.${PROTOCOLS_SNAPSHOT}.${ME}`)).toContain("opening-up");
  });
});
