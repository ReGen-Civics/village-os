/**
 * The hidden map's outbox. Every assertion reads BOTH sides: what the fake
 * server received, and what is left on the phone afterwards. A flush that
 * dropped items without sending them, or sent them and kept them, would pass
 * a one-sided check.
 */
import { describe, expect, it } from "vitest";
import { memoryStore, outbox, type OutboxSender, type PinItem, type VisitItem } from "./hiddenMapOutbox";

const blob = (s: string) => new Blob([s], { type: "image/webp" });

const pin = (clientId: string, owner = "m-a", photos = 2, at = "2026-11-15T10:00:00Z"): PinItem => ({
  kind: "pin",
  clientId,
  owner,
  createdAt: at,
  draft: { clientId, layer: "planting", kind: "Garden", lat: 1, lng: 2, precision: "region" },
  photos: Array.from({ length: photos }, (_, i) => blob(`${clientId}-${i}`)),
});

const visit = (clientId: string, owner = "m-a"): VisitItem => ({
  kind: "visit",
  clientId,
  owner,
  createdAt: "2026-11-15T11:00:00Z",
  pinId: "hmp-1",
  stageSeen: "sprout",
  note: "",
  photos: [blob("v")],
});

function server(opts: { failPinOnce?: string; refuse?: string; offlineAfter?: number } = {}) {
  const calls: string[] = [];
  let n = 0;
  const pins = new Map<string, string>();
  const step = () => {
    n++;
    if (opts.offlineAfter !== undefined && n > opts.offlineAfter) throw new TypeError("Failed to fetch");
  };
  const send: OutboxSender = {
    async createPin(draft) {
      step();
      if (draft.clientId === opts.refuse) throw Object.assign(new Error("Choose a kind for this layer."), { status: 400 });
      calls.push(`pin ${draft.clientId}`);
      const id = pins.get(draft.clientId) ?? `hmp-${draft.clientId}`;
      pins.set(draft.clientId, id);
      return { pin: { id } };
    },
    async addPhotos(pinId, photos) {
      step();
      calls.push(`photos ${pinId} ${photos.length}`);
    },
    async addVisit(pinId, v) {
      step();
      calls.push(`visit ${pinId} ${v.clientId}`);
    },
  };
  return { send, calls };
}

describe("the outbox", () => {
  it("sends a pin, then its photos one at a time, and leaves nothing behind", async () => {
    const box = outbox(memoryStore());
    await box.add(pin("p1"));
    const s = server();
    const r = await box.flush("m-a", s.send);
    expect(r).toMatchObject({ sent: 1, refused: 0, stopped: false });
    expect(s.calls).toEqual(["pin p1", "photos hmp-p1 1", "photos hmp-p1 1"]);
    expect(await box.pending("m-a")).toEqual([]);
  });

  it("sends only the owner's items, and another account on the phone never sees them", async () => {
    const box = outbox(memoryStore());
    await box.add(pin("mine", "m-a"));
    await box.add(pin("theirs", "m-b"));
    const s = server();
    await box.flush("m-a", s.send);
    expect(s.calls.some((c) => c.includes("theirs"))).toBe(false);
    expect((await box.pending("m-a")).length).toBe(0);
    expect((await box.pending("m-b")).map((i) => i.clientId)).toEqual(["theirs"]);
    await box.discard("m-a", "theirs");
    expect((await box.pending("m-b")).length).toBe(1);
  });

  it("stops when the signal goes, keeps the rest, and resumes without sending the pin twice", async () => {
    const store = memoryStore();
    const box = outbox(store);
    await box.add(pin("p1", "m-a", 3));
    await box.add(visit("v1"));
    // Three calls get through: the pin and two photos. The third photo fails.
    const first = server({ offlineAfter: 3 });
    const r1 = await box.flush("m-a", first.send);
    expect(r1.stopped).toBe(true);
    expect(first.calls).toEqual(["pin p1", "photos hmp-p1 1", "photos hmp-p1 1"]);
    const left = await box.pending("m-a");
    expect(left.map((i) => i.clientId)).toEqual(["p1", "v1"]);
    expect((left[0] as PinItem).pinId).toBe("hmp-p1");
    expect(left[0]!.photos.length).toBe(1);

    const second = server();
    const r2 = await box.flush("m-a", second.send);
    expect(r2).toMatchObject({ sent: 2, stopped: false });
    expect(second.calls).toEqual(["photos hmp-p1 1", "visit hmp-1 v1"]);
    expect(await box.pending("m-a")).toEqual([]);
  });

  it("keeps a refused item with the server's words, and carries on with the next", async () => {
    const box = outbox(memoryStore());
    await box.add(pin("bad", "m-a", 1, "2026-11-15T09:00:00Z"));
    await box.add(pin("good", "m-a", 0, "2026-11-15T09:30:00Z"));
    const s = server({ refuse: "bad" });
    const r = await box.flush("m-a", s.send);
    expect(r).toMatchObject({ sent: 1, refused: 1, stopped: false });
    const left = await box.pending("m-a");
    expect(left.map((i) => [i.clientId, i.refused])).toEqual([["bad", "Choose a kind for this layer."]]);
    // A refused item is not retried on the next run.
    const again = server();
    await box.flush("m-a", again.send);
    expect(again.calls).toEqual([]);
  });

  it("sends the oldest first", async () => {
    const box = outbox(memoryStore());
    await box.add(pin("later", "m-a", 0, "2026-11-15T12:00:00Z"));
    await box.add(pin("earlier", "m-a", 0, "2026-11-15T08:00:00Z"));
    const s = server();
    await box.flush("m-a", s.send);
    expect(s.calls).toEqual(["pin earlier", "pin later"]);
  });
});
