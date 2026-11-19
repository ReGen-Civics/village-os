import { describe, expect, it } from "vitest";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { applyFailureLine, errorKeyOf, watchApplyFailures } from "./applyFailureLog";
import { OPEN_WORDS } from "../../shared/openProposals";

/** One post to the local test server, through node:http (the guard on outbound calls reads every global call). */
function post(url: string, body = "", headers: Record<string, string> = {}): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: "POST", headers: { ...headers, "content-length": String(Buffer.byteLength(body)) } }, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode ?? 0));
    });
    req.on("error", reject);
    req.end(body);
  });
}

async function withServer(handler: (app: express.Express) => void, run: (url: string) => Promise<void>) {
  const app = express();
  handler(app);
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  try {
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
}

describe("the application failure log", () => {
  it("logs one line for a refusal: endpoint, status, sizes, field and the words' key, never the body", async () => {
    const lines: string[] = [];
    await withServer(
      (app) => {
        app.use(watchApplyFailures((l) => lines.push(l)));
        app.post("/api/open-proposals", express.json(), (_req, res) => void res.status(429).json({ error: OPEN_WORDS.tooMany }));
        app.post("/api/other", (_req, res) => void res.status(500).json({}));
      },
      async (url) => {
        const body = JSON.stringify({ name: "Rowan Secret", email: "rowan@example.test" });
        await post(`${url}/api/open-proposals`, body, { "content-type": "application/json" });
        await post(`${url}/api/other`);
        await new Promise((r) => setTimeout(r, 20));
      },
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("endpoint=/api/open-proposals");
    expect(lines[0]).toContain("status=429");
    expect(lines[0]).toMatch(/declared=\d+/);
    expect(lines[0]).toContain("multipart=no");
    expect(lines[0]).toContain("error=OPEN_WORDS.tooMany");
    expect(lines[0]).not.toMatch(/Rowan|example\.test/);
  });

  it("logs nothing for a success (control)", async () => {
    const lines: string[] = [];
    await withServer(
      (app) => {
        app.use(watchApplyFailures((l) => lines.push(l)));
        app.post("/api/open-proposals", (_req, res) => void res.json({ sent: true }));
      },
      async (url) => {
        await post(`${url}/api/open-proposals`);
        await new Promise((r) => setTimeout(r, 20));
      },
    );
    expect(lines).toEqual([]);
  });

  it("names words it does not know as other, so a figure in built words never reaches the log", () => {
    expect(errorKeyOf(OPEN_WORDS.tooManyTries)).toBe("OPEN_WORDS.tooManyTries");
    expect(errorKeyOf("Choose 30% or more for Rowan's role.")).toBe("other");
    expect(errorKeyOf(undefined)).toBeNull();
    expect(applyFailureLine({ endpoint: "/x", status: "no-answer", declaredBytes: null, readBytes: 10, ms: 5, multipart: true, field: null, errorKey: null })).toContain("status=no-answer");
  });
});
