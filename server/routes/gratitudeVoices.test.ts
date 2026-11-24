/**
 * THE THANKS WALL FOR A VISITOR (the lead, 24 Nov 2026: "yes public and first names too"). A signed-out reader gets
 * every thanks with each person's first name only: no full name, no portrait and no handle, which is a profile's
 * address. A signed-in member reads the wall unchanged. Every name here is invented.
 */
import { describe, expect, it, vi } from "vitest";
import type { WallEntry } from "../../shared/gratitudeVoices";

const ENTRIES: WallEntry[] = [
  {
    id: "g1",
    from: { name: "Juniper Ashdown", handle: "juniper", avatar: "/uploads/juniper.webp" },
    to: { name: "Rowan Hale", handle: "rowan", avatar: null },
    amount: 2,
    message: "For the bread on Thursday.",
    at: "2026-11-20T10:00:00.000Z",
  },
];
vi.mock("../lib/gratitudeVoices", () => ({
  wallEntries: async () => ENTRIES,
  heroVoices: async () => ({ voices: [], realTotal: 0 }),
}));

import { register, strangerSees } from "./gratitudeVoices";

type Handler = (req: unknown, res: { json: (body: unknown) => void }) => Promise<void>;

function wallFor(signedIn: boolean): Promise<unknown> {
  const routes = new Map<string, Handler>();
  const app = { get: (path: string, h: Handler) => routes.set(path, h) };
  register(app as never, {
    getPool: (() => ({})) as never,
    authedUser: (async () => (signedIn ? { id: "u-member" } : null)) as never,
    gratitudeLog: async () => [],
  });
  return new Promise((resolve) => {
    void routes.get("/api/game/gratitude/wall")!({}, { json: resolve });
  });
}

describe("GET /api/game/gratitude/wall", () => {
  it("a visitor reads first names only, with no portrait and no profile address", async () => {
    const body = (await wallFor(false)) as WallEntry[];
    expect(body).toHaveLength(1);
    expect(body[0].from).toEqual({ name: "Juniper", handle: null, avatar: null });
    expect(body[0].to).toEqual({ name: "Rowan", handle: null, avatar: null });
    expect(body[0].message).toBe("For the bread on Thursday.");
    const text = JSON.stringify(body);
    for (const leak of ["Ashdown", "Hale", "juniper", "rowan", "/uploads/"]) expect(text).not.toContain(leak);
  });

  it("CONTROL: a signed-in member reads the wall as it always was", async () => {
    const body = (await wallFor(true)) as WallEntry[];
    expect(body[0].from).toEqual(ENTRIES[0].from);
    expect(body[0].to).toEqual(ENTRIES[0].to);
  });

  it("keeps a departed member's recorded name", () => {
    expect(strangerSees({ name: "Rowan Hale", handle: "rowan", avatar: "/a.webp" })).toEqual({ name: "Rowan", handle: null, avatar: null });
  });
});
