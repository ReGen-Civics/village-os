/**
 * An application sent in parts (the lead, 19 Nov 2026; the host's edge closes a request body still arriving after
 * five minutes): every file, take and clip goes first in a request of its own, and the application after, naming them.
 */
import { describe, expect, it } from "vitest";
import { EMPTY_VOICE, type VoiceState } from "@/components/voice/VoiceInvite";
import { APPLICATION_PATH, PARTS_PATH, partsToSend, sendApplication } from "./sendParts";

const blob = (n: number, type = "audio/webm") => new Blob([new Uint8Array(n)], { type });
const voice = (over: Partial<VoiceState> = {}): VoiceState => ({
  ...EMPTY_VOICE,
  consent: true,
  takes: [
    { blob: blob(10), seconds: 30, url: "blob:a" },
    { blob: blob(20, "audio/mp4"), seconds: 40, url: "blob:b" },
  ],
  clips: { aim: { blob: blob(5), seconds: 5, url: "blob:c", words: "Dawn." } },
  ...over,
});
const pdf = () => new File([new Uint8Array(30)], "cv.pdf", { type: "application/pdf" });

type Call = { url: string; init: RequestInit };
const fake = (answer: (url: string, n: number) => Response) => {
  const calls: Call[] = [];
  const fetchImpl = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return answer(url, calls.length);
  };
  return { calls, fetchImpl };
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("an application sent in parts", () => {
  it("names every file, and the takes and clips only with the tick, in the order the voice description pairs them", () => {
    expect(partsToSend([pdf()], voice()).map((p) => [p.kind, p.name])).toEqual([
      ["files", "cv.pdf"],
      ["voice", "voice-1.webm"],
      ["voice", "voice-2.m4a"],
      ["clips", "aim.webm"],
    ]);
    expect(partsToSend([pdf()], voice({ consent: false })).map((p) => p.kind)).toEqual(["files"]);
  });

  it("sends each part on its own, fields before the file, and then the application naming them, carrying no bytes", async () => {
    const { calls, fetchImpl } = fake((url, n) => (url === PARTS_PATH ? json({ id: `up-${String(n).padStart(32, "0")}`, size: 1 }) : json({ sent: true })));
    const res = await sendApplication({ name: "Rowan" }, [pdf()], voice(), { link: "abc", fetchImpl });
    expect(res.status).toBe(200);
    expect(calls.map((c) => c.url)).toEqual([PARTS_PATH, PARTS_PATH, PARTS_PATH, PARTS_PATH, APPLICATION_PATH]);
    const first = calls[0].init.body as FormData;
    expect(Array.from(first.keys())).toEqual(["kind", "link", "part"]);
    expect(first.get("kind")).toBe("files");
    const last = calls[4].init;
    expect(last.headers).toEqual({ "Content-Type": "application/json" });
    const body = JSON.parse(String(last.body));
    expect(body.parts).toEqual({ files: [`up-${"1".padStart(32, "0")}`], voice: [`up-${"2".padStart(32, "0")}`, `up-${"3".padStart(32, "0")}`], clips: [`up-${"4".padStart(32, "0")}`] });
    expect(body.voice).toMatchObject({ consent: true, seconds: [30, 40], clips: [{ field: "aim", seconds: 5, words: "Dawn." }] });
    // Every request had its own signal, its own window.
    expect(calls.every((c) => c.init.signal instanceof AbortSignal)).toBe(true);
  });

  it("a refused part stops the send and is answered as the whole would be, on its field", async () => {
    const { calls, fetchImpl } = fake((url, n) => (n === 2 ? json({ error: "Too big.", field: "voice" }, 413) : json({ id: `up-${"9".repeat(32)}` })));
    const res = await sendApplication({ name: "Rowan" }, [pdf()], voice(), { fetchImpl });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "Too big.", field: "voice" });
    expect(calls.map((c) => c.url)).toEqual([PARTS_PATH, PARTS_PATH]);
  });

  it("with nothing attached the application goes alone, as before", async () => {
    const { calls, fetchImpl } = fake(() => json({ sent: true }));
    await sendApplication({ name: "Rowan" }, [], voice({ consent: false }), { fetchImpl });
    expect(calls.map((c) => c.url)).toEqual([APPLICATION_PATH]);
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ name: "Rowan" });
  });

  it("the page's own stop reaches the request in flight", async () => {
    const stop = new AbortController();
    const fetchImpl = (_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        stop.abort();
      });
    await expect(sendApplication({ name: "Rowan" }, [pdf()], EMPTY_VOICE, { fetchImpl, signal: stop.signal })).rejects.toMatchObject({ name: "AbortError" });
  });
});
