/**
 * Item 3 of the data lane's Season 2 brief, proved rather than reviewed: a
 * failed boot migration must not leave the village fully dark behind a bare
 * 502. This breaks a real migration against a real scratch database, takes
 * the real `ApplyResult.failedDetail` `applyPending` produces, and confirms
 * the maintenance page actually renders and actually answers HTTP requests
 * with it, for all three refusal kinds `migrate.ts` can report.
 *
 * The unit-level checks (page content per kind) need no database and always
 * run. The end-to-end check (break a migration, watch the page appear) is
 * gated on TEST_DATABASE_URL like every other DB-backed suite in this repo.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ApplyFailureDetail } from "./migrate";
import { applyPending } from "./migrate";
import { publicDetail, renderMaintenanceHtml, startMaintenanceServer } from "./maintenanceMode";
import { testDbConfigured } from "./testDb";

describe("the maintenance page's content, per refusal kind", () => {
  const cases: ApplyFailureDetail[] = [
    { kind: "migration-failed", file: "0099_example.sql", statementIndex: 3, statementsTotal: 7, message: "ER_DUP_ENTRY: Duplicate entry for key PRIMARY" },
    { kind: "tamper-detected", file: "0050_example.sql", message: "0050_example.sql was applied here with checksum abc but the file on disk now hashes to def." },
    { kind: "lock-timeout", lockName: "village-migrate:village_x", timeoutSeconds: 600, message: "could not take the migration lock" },
  ];

  for (const detail of cases) {
    it(`renders a plain page for "${detail.kind}"`, () => {
      const html = renderMaintenanceHtml({ detail, port: 0, instanceLabel: "Riverbend" });
      expect(html).toContain("<html");
      expect(html).toContain("temporarily unavailable");
      // R213: the raw database error never reaches the public page. It can
      // carry table names, a fragment of a row or a host; it goes to the log.
      expect(html).not.toContain(detail.message);
      expect(html).toContain("The full error is in the server log.");
      if (detail.kind === "migration-failed") {
        expect(html).toContain(detail.file);
        expect(html).toContain("step 3 of 7");
      }
      if (detail.kind === "tamper-detected") {
        expect(html).toContain(detail.file);
      }
      // The reassurance every kind must carry: nothing here should ever leave
      // a steward wondering if their village's data is gone.
      expect(html.toLowerCase()).toContain("data is safe");
    });
  }

  it("renders a plain page when the accounts did not add up at boot (R132)", () => {
    // A ledger-invariant refusal threw before any port was bound: a bare 502,
    // and nothing a steward could read. The page says what stopped, and the
    // public text names how many checks failed, never an account.
    const html = renderMaintenanceHtml({
      detail: { kind: "ledger-invariant", problems: 2, message: "2 ledger checks failed at boot. The server log lists each one under [ledger invariant]." },
      port: 0,
      instanceLabel: "Riverbend",
    });
    expect(html).toContain("temporarily unavailable");
    expect(html).toContain("did not add up");
    expect(html).toContain("[ledger invariant]");
    expect(html.toLowerCase()).toContain("nothing was moved");
  });

  it("/health names the kind, the file and the step, never the raw error, which goes to the server log", async () => {
    const raw = "ER_DUP_ENTRY: Duplicate entry 'ada@example.test' for key 'users.email' on db.internal:3306";
    const detail = { kind: "migration-failed" as const, file: "0099_example.sql", statementIndex: 3, statementsTotal: 7, message: raw };
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const server = startMaintenanceServer({ detail, port: 0, host: "127.0.0.1" });
    try {
      await new Promise<void>((resolve) => server.once("listening", () => resolve()));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("expected a bound TCP port");
      const base = `http://127.0.0.1:${address.port}`;
      const health = await fetch(`${base}/health`); // module-review-ok: local maintenance server this test just started
      const body = await health.json();
      expect(health.status).toBe(503);
      expect(body.error).toEqual({ kind: "migration-failed", file: "0099_example.sql", step: 3, steps: 7, message: publicDetail(detail) });
      expect(JSON.stringify(body)).not.toContain("ada@example.test");
      const page = await (await fetch(`${base}/`)).text(); // module-review-ok: local maintenance server this test just started
      expect(page).not.toContain("ada@example.test");
      expect(page).not.toContain("db.internal");
      expect(err.mock.calls.map((c) => String(c[0])).join(" ")).toContain(raw);
    } finally {
      err.mockRestore();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("does not let the instance label or message break the page's HTML", () => {
    const html = renderMaintenanceHtml({
      detail: { kind: "migration-failed", file: '<script>alert(1)</script>.sql', statementIndex: 1, statementsTotal: 1, message: '<script>alert(1)</script> & "quoted"' },
      port: 0,
      instanceLabel: '<b>Not Riverbend</b>',
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<b>Not Riverbend</b>");
    expect(html).toContain("&lt;script&gt;");
  });
});

const configured = testDbConfigured();
if (!configured) {
  // eslint-disable-next-line no-console
  console.warn("[maintenanceMode.test] TEST_DATABASE_URL not set, the end-to-end break-and-serve proof SKIPPED.");
}

describe.skipIf(!configured)("breaking a real migration and watching the page appear", () => {
  let admin: mysql.Connection;
  let schema: string;
  let dir: string;
  const base = process.env.TEST_DATABASE_URL as string;

  beforeAll(async () => {
    const u = new URL(base);
    admin = await mysql.createConnection({
      host: u.hostname,
      port: Number(u.port || 3306),
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      timezone: "Z",
    });
    schema = `maint_proof_${Date.now()}_${process.pid}`;
    await admin.query(`DROP DATABASE IF EXISTS \`${schema}\``);
    await admin.query(`CREATE DATABASE \`${schema}\` CHARACTER SET utf8mb4`);

    // A deliberately broken migration set: the first file is fine, the
    // second is not valid SQL. This is the exact shape item 3 names: an
    // update that stops partway through a file.
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "village-maintenance-proof-"));
    fs.writeFileSync(path.join(dir, "0001_ok.sql"), "CREATE TABLE probe (id varchar(16) PRIMARY KEY);\n");
    fs.writeFileSync(
      path.join(dir, "0002_broken.sql"),
      "INSERT INTO probe (id) VALUES ('a');\nTHIS IS NOT VALID SQL AT ALL;\n",
    );
  }, 60_000);

  afterAll(async () => {
    await admin.query(`DROP DATABASE IF EXISTS \`${schema}\``);
    await admin.end();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("applyPending reports a structured failure, and the maintenance page shows it", async () => {
    const u = new URL(base);
    u.pathname = `/${schema}`;
    const conn = await mysql.createConnection({ uri: u.toString(), timezone: "Z" });
    await conn.query("SET time_zone = '+00:00'");
    let result;
    try {
      result = await applyPending(conn, dir, () => {});
    } finally {
      await conn.end();
    }

    expect(result.failed).not.toBeNull();
    expect(result.applied).toEqual(["0001_ok.sql"]);
    expect(result.failedDetail?.kind).toBe("migration-failed");
    if (result.failedDetail?.kind !== "migration-failed") throw new Error("wrong kind");
    expect(result.failedDetail.file).toBe("0002_broken.sql");
    expect(result.failedDetail.statementIndex).toBe(2); // the good INSERT ran; the bad statement is #2

    // This is the part item 3 asks to actually watch happen: take that real
    // failure and confirm a real HTTP server serves the real page for it,
    // rather than the process simply exiting.
    const server = startMaintenanceServer({
      detail: result.failedDetail,
      port: 0, // let the OS pick a free port
      instanceLabel: "Riverbend",
    });
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("expected a bound TCP port");
    const base_ = `http://127.0.0.1:${address.port}`;

    try {
      const page = await fetch(base_ + "/anything"); // module-review-ok: local maintenance server this test just started
      expect(page.status).toBe(503);
      const body = await page.text();
      expect(body).toContain("temporarily unavailable");
      expect(body).toContain("0002_broken.sql");
      expect(body).toContain("step 2 of 2");
      expect(body.toLowerCase()).toContain("data is safe");

      const health = await fetch(base_ + "/health"); // module-review-ok: local maintenance server this test just started
      expect(health.status).toBe(503);
      const healthBody = await health.json();
      expect(healthBody.status).toBe("maintenance");
      expect(healthBody.error.kind).toBe("migration-failed");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 60_000);
});
