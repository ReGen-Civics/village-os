/**
 * AN ERASED MEMBER'S PUBLIC APPLICATIONS LEAVE WITH THEM (security sweep,
 * 14 Nov 2026). The `open-proposals-after-tombstone` step finds every open
 * role proposal made from the member's real address, and every one whose
 * invitation reached their account, closes one still waiting as withdrawn,
 * anonymises each with the one list every anonymising path uses, and removes
 * its private folder of files and recordings at once. A living person's
 * application, at another address, keeps everything. The references a
 * shortlisted applicant gave (0412) go in the same step.
 *
 * Runs against a scratch schema with every real migration applied. No
 * TEST_DATABASE_URL and the suite skips (harness rule).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { emailKeyOf } from "../../shared/comms/address";
import { openInviteId } from "../../shared/openProposalDecide";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "../db/testDb";
import { anonymizeMember, backfillStepNames, sweepStepNames, type ErasureDeps } from "./erasure";
import { clearMemberDrivers } from "./memberDrivers";
import { usersRepo } from "../repos/users";
import { insertOpenProposal } from "../repos/openProposals";

const configured = testDbConfigured();

let db: TestDb;
let pool: mysql.Pool;
let uploadsDir = "";
let fileDir = "";

async function q(sql: string, params: unknown[] = []): Promise<any[]> {
  const [rows] = await pool.query<any[]>(sql, params); // module-review-ok: seeding and reading back the scratch schema this suite provisioned, which is the assertion
  return rows;
}

function deps(): ErasureDeps {
  const real = usersRepo(pool);
  return {
    members: { byId: (id: string) => real.byId(id), update: (id: string, fn: (u: any) => void) => real.update(id, fn) },
    submissionsRepo: { all: () => [], replaceAll: async () => undefined },
    roleHoldersRepo: { remove: async () => undefined },
    withRoleHolderLock: (fn) => fn(),
    loadRoleHolders: () => [],
    uploadsDir,
    proposalFileDir: fileDir,
  };
}

const BODY = {
  roles: [{ roleId: "r-1", note: "I keep wells." }],
  why: "I live up the road.",
  aim: "The well runs clean.",
  links: [{ url: "https://example.test/me", label: "Me" }],
  references: [{ name: "Ref Person", contact: "ref@example.test", how: "neighbour" }],
  voice: { consent: true, notes: [{ id: "pv-0123456789abcdef", kind: "webm", seconds: 30, size: 8 }], transcript: "What I said aloud." },
};

/** One application with a folder holding a file and a recording. */
async function application(id: string, email: string, status: string): Promise<void> {
  await insertOpenProposal(pool, { id, name: "Wren Halloway", email, emailKey: emailKeyOf(email), targetSeasonId: null, body: BODY as any, confirmHash: `h-${id}`, linkId: null, now: new Date() });
  await q("UPDATE open_role_proposals SET status = ?, confirmed_at = NOW() WHERE id = ?", [status, id]);
  await fs.promises.mkdir(path.join(fileDir, id), { recursive: true });
  await fs.promises.writeFile(path.join(fileDir, id, "pv-0123456789abcdef.webm"), Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
}

const read = async (id: string) => {
  const [r] = await q("SELECT status, name, email, email_key, anonymised_at, body_json FROM open_role_proposals WHERE id = ?", [id]);
  return { ...r, body: typeof r.body_json === "string" ? JSON.parse(r.body_json) : r.body_json };
};

describe.skipIf(!configured)("an erased member's public applications", () => {
  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 }); // module-review-ok: the suite's own pool onto the scratch schema it provisioned
    uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), "village-erasure-op-uploads-"));
    fileDir = fs.mkdtempSync(path.join(os.tmpdir(), "village-erasure-op-files-"));
    clearMemberDrivers();
  });

  afterAll(async () => {
    await pool?.end();
    await db?.drop?.();
    for (const d of [uploadsDir, fileDir]) if (d) fs.rmSync(d, { recursive: true, force: true });
    clearMemberDrivers();
  });

  it("is a step after the tombstone, and one a finished erasure is given", () => {
    const steps = sweepStepNames();
    expect(steps.indexOf("open-proposals-after-tombstone")).toBeGreaterThan(steps.indexOf("tombstone"));
    expect(backfillStepNames()).toContain("open-proposals-after-tombstone");
  });

  it("withdraws and anonymises every application from their address or through their invitation, and removes its folder now; a living person's keeps everything", async () => {
    await usersRepo(pool).add({ id: "op-er-leaver", name: "Wren Halloway", email: "Wren.Halloway@example.test", passwordHash: "x", paths: [] });
    const leaver = (await usersRepo(pool).byId("op-er-leaver"))!;
    // Waiting on the village, from their address (typed in another case).
    await application("op-ee000000000000000001", "wren.halloway@example.test", "confirmed");
    // Adopted through an invitation that made their account, from an address they no longer use.
    await application("op-ee000000000000000002", "wren-old@example.test", "adopted");
    await q("INSERT INTO member_invites (id, token_hash, inviter_user_id, used_at, used_by_user_id) VALUES (?, ?, 'u-steward', NOW(), ?)", [openInviteId("op-ee000000000000000002"), "f".repeat(64), leaver.id]);
    // CONTROL: somebody else's, at another address.
    await application("op-ee000000000000000003", "ash@example.test", "confirmed");

    // The references each gave once shortlisted (0412): personal data of people who never signed up.
    for (const id of ["op-ee000000000000000001", "op-ee000000000000000002", "op-ee000000000000000003"]) {
      await q("INSERT INTO application_references (application_ref, position, name, contact, how_known, why_ally, owner_role_id, added_at) VALUES (?, 1, 'Shortlist Ref', 'shortlist.ref@example.test', 'Neighbour', '', '', NOW())", [id]);
    }

    await anonymizeMember(pool, leaver, "u-steward", deps());

    // Gone at once from both of theirs; somebody else's keeps its reference.
    expect(await q("SELECT application_ref FROM application_references WHERE application_ref IN ('op-ee000000000000000001', 'op-ee000000000000000002')")).toEqual([]);
    expect(await q("SELECT application_ref FROM application_references WHERE application_ref = 'op-ee000000000000000003'")).toHaveLength(1);

    const waiting = await read("op-ee000000000000000001");
    expect(waiting).toMatchObject({ status: "withdrawn", name: null, email: null, email_key: null });
    expect(waiting.anonymised_at).not.toBeNull();
    const adopted = await read("op-ee000000000000000002");
    expect(adopted).toMatchObject({ status: "adopted", name: null, email: null });
    for (const r of [waiting, adopted]) {
      const text = JSON.stringify(r.body);
      for (const gone of ["example.test", "Ref Person", "What I said aloud", "pv-"]) expect(text).not.toContain(gone);
      expect(r.body.why).toBe("I live up the road.");
    }
    expect(fs.existsSync(path.join(fileDir, "op-ee000000000000000001"))).toBe(false);
    expect(fs.existsSync(path.join(fileDir, "op-ee000000000000000002"))).toBe(false);

    const theirs = await read("op-ee000000000000000003");
    expect(theirs).toMatchObject({ status: "confirmed", name: "Wren Halloway", email: "ash@example.test", anonymised_at: null });
    expect(theirs.body.voice.transcript).toBe("What I said aloud.");
    expect(fs.existsSync(path.join(fileDir, "op-ee000000000000000003", "pv-0123456789abcdef.webm"))).toBe(true);
  });
});
