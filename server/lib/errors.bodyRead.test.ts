/**
 * A BODY THE SERVER COULD NOT READ is the sender's, not a fault (hostile-edges
 * QA, 15 Nov 2026). Before this, a cut-off JSON body or one over the size limit
 * answered 500 "Internal server error" on every JSON route, the public
 * application form among them.
 *
 * The errors are the REAL ones: a small app with the same `express.json()`
 * reader the server mounts and the same terminal handler, sent real bodies over
 * a real socket. A hand-made `{ type: "entity.parse.failed" }` would prove only
 * that the matcher matches itself.
 */
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("./toolcheck", () => ({ guardedFetchJson: vi.fn() }));
const { respondToTerminalError, terminalAnswerFor } = await import("./errors");

let server: Server;
let base = "";

beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: "1kb" }));
  app.post("/echo", (req, res) => res.json({ got: req.body }));
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) return next(err);
    respondToTerminalError(err, res);
  });
  await new Promise<void>((done) => {
    server = app.listen(0, "127.0.0.1", () => done());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((done) => server.close(() => done()));
});

const send = (body: string, type = "application/json") => fetch(`${base}/echo`, { method: "POST", headers: { "content-type": type }, body });

describe("a body the JSON reader refuses", () => {
  it("answers a cut-off body 400 in words, never 500", async () => {
    const r = await send('{"name": ');
    expect(r.status).toBe(400);
    const j = await r.json();
    expect(j.code).toBe("body_unreadable");
    expect(j.error).toContain("couldn't read what was sent");
    expect(j.error).not.toContain("Internal server error");
  });

  it("answers a body over the limit 413 in words", async () => {
    const r = await send(JSON.stringify({ a: "x".repeat(4000) }));
    expect(r.status).toBe(413);
    expect((await r.json()).code).toBe("body_too_large");
  });

  it("answers a charset it cannot decode 415", async () => {
    const r = await send("{}", "application/json; charset=klingon");
    expect(r.status).toBe(415);
    expect((await r.json()).code).toBe("body_unreadable");
  });

  it("still reads a good body", async () => {
    const r = await send('{"a":1}');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ got: { a: 1 } });
  });

  it("keeps a thrown error that only looks like a reader's refusal a 500", () => {
    // `expose` is what body-parser (through http-errors) sets on a client error; a bare `type` is not enough.
    expect(terminalAnswerFor(Object.assign(new Error("boom"), { type: "entity.parse.failed" })).status).toBe(500);
    expect(terminalAnswerFor(Object.assign(new Error("boom"), { type: "something.else", expose: true, status: 400 })).status).toBe(500);
  });

  it("logs the reader's message without a stack, as a warning", () => {
    const err = Object.assign(new SyntaxError("Unexpected end of JSON input"), { type: "entity.parse.failed", expose: true, status: 400 });
    const answer = terminalAnswerFor(err);
    expect(answer.level).toBe("warn");
    expect(answer.detail).toBe("Unexpected end of JSON input");
  });
});
